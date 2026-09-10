/**
 * Unit tests for the Wedding API Worker (worker/src/index.js).
 *
 * Runs on Node's built-in test runner with no dependencies:
 *   node --test worker/test/
 *
 * The Notion API is mocked by replacing global fetch, so these tests
 * exercise the worker's own behavior: CORS, method/origin gating, size
 * caps, rate limiting, the honeypot, validation, and the Notion payloads
 * it constructs (including update-in-place via Response ID).
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ALLOWED_ORIGIN = 'https://veronicaandlucas.com';
const env = {
  NOTION_API_KEY: 'test-key',
  RSVP_DB_ID: 'rsvp-db-id',
  SHENANIGANS_DB_ID: 'shen-db-id',
  ALLOWED_ORIGIN,
};

// ── Notion fetch mock ────────────────────────────────────────────────
let notionCalls;
let queryResults; // rows returned by the RSVP "Response ID" lookup
let notionFailures; // set of URL substrings that should return 500

beforeEach(() => {
  notionCalls = [];
  queryResults = [];
  notionFailures = new Set();
});

globalThis.fetch = async (url, init = {}) => {
  const call = { url: String(url), init, body: init.body ? JSON.parse(init.body) : null };
  notionCalls.push(call);
  for (const marker of notionFailures) {
    if (call.url.includes(marker)) {
      return new Response(JSON.stringify({ message: 'mock notion error' }), { status: 500 });
    }
  }
  if (call.url.includes('/databases/')) {
    return new Response(JSON.stringify({ results: queryResults }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: 'mock-page-id' }), { status: 200 });
};

// ── Helpers ──────────────────────────────────────────────────────────
let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function makeRequest(path, { method = 'POST', body, origin = ALLOWED_ORIGIN, ip } = {}) {
  const headers = new Headers({ 'CF-Connecting-IP': ip || uniqueIp() });
  if (origin !== null) headers.set('Origin', origin);
  let payload;
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request(`https://wedding-api.test.workers.dev${path}`, { method, headers, body: payload });
}

const validRsvp = {
  name: 'Test Guest',
  email: 'guest@example.com',
  attending: 'yes',
  plusOne: 'no',
  plusOneName: '',
  plusOneDiet: '',
  diet: 'vegetarian',
  note: 'So excited!',
  responseId: 'abcd1234-ef56-7890-abcd-1234567890ab',
  website: '',
};

// ── Gate behavior ────────────────────────────────────────────────────
test('OPTIONS preflight from the allowed origin returns 204 with CORS headers', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { method: 'OPTIONS' }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ALLOWED_ORIGIN);
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/);
});

test('a request from a disallowed origin is rejected with 403', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: validRsvp, origin: 'https://evil.example.com' }), env);
  assert.equal(res.status, 403);
  assert.equal(notionCalls.length, 0);
});

test('non-POST methods are rejected with 405', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { method: 'GET' }), env);
  assert.equal(res.status, 405);
});

test('an unknown path returns 404', async () => {
  const res = await worker.fetch(makeRequest('/nope', { body: validRsvp }), env);
  assert.equal(res.status, 404);
});

test('an oversized body is rejected with 413', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, note: 'x'.repeat(9000) } }), env);
  assert.equal(res.status, 413);
  assert.equal(notionCalls.length, 0);
});

test('invalid JSON is rejected with 400', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: '{not json' }), env);
  assert.equal(res.status, 400);
});

test('a filled honeypot gets a quiet success and writes nothing', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, website: 'http://spam.example' } }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(notionCalls.length, 0);
});

test('the per-IP rate limit returns 429 after 10 requests in a window', async () => {
  const ip = uniqueIp();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await worker.fetch(makeRequest('/rsvp', { body: validRsvp, ip }), env);
  }
  assert.equal(last.status, 429);
});

// ── RSVP behavior ────────────────────────────────────────────────────
test('an RSVP without a name or attending status is rejected with 400', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, name: '' } }), env);
  assert.equal(res.status, 400);
  const res2 = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, attending: 'maybe' } }), env);
  assert.equal(res2.status, 400);
  assert.equal(notionCalls.length, 0);
});

test('a malformed email is rejected with 400', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, email: 'not-an-email' } }), env);
  assert.equal(res.status, 400);
  assert.equal(notionCalls.length, 0);
});

test('a valid new RSVP creates a Notion page with the guest fields and Response ID', async () => {
  const res = await worker.fetch(makeRequest('/rsvp', { body: validRsvp }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  // First call: Response ID lookup; second: page create.
  assert.equal(notionCalls.length, 2);
  assert.match(notionCalls[0].url, /databases\/rsvp-db-id\/query/);
  const create = notionCalls[1];
  assert.match(create.url, /api\.notion\.com\/v1\/pages$/);
  assert.equal(create.init.method, 'POST');
  assert.equal(create.body.parent.database_id, env.RSVP_DB_ID);
  const props = create.body.properties;
  assert.equal(props['Guest Name'].title[0].text.content, 'Test Guest');
  assert.equal(props['Email'].email, 'guest@example.com');
  assert.equal(props['Attending'].select.name, 'Joyfully Accepts');
  assert.equal(props['Dietary Restrictions'].rich_text[0].text.content, 'vegetarian');
  assert.equal(props['Response ID'].rich_text[0].text.content, validRsvp.responseId);
});

test('an RSVP whose Response ID already exists updates the page in place', async () => {
  queryResults = [{ id: 'existing-page-id' }];
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, attending: 'no' } }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.updated, true);

  const patch = notionCalls[1];
  assert.match(patch.url, /v1\/pages\/existing-page-id$/);
  assert.equal(patch.init.method, 'PATCH');
  assert.equal(patch.body.properties['Attending'].select.name, 'Regretfully Declines');
});

test('a Notion update failure surfaces as 502, not a fake success', async () => {
  queryResults = [{ id: 'existing-page-id' }];
  notionFailures.add('v1/pages/existing-page-id');
  const res = await worker.fetch(makeRequest('/rsvp', { body: validRsvp }), env);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.success, undefined);
  assert.ok(body.error);
});

test('when the Response ID lookup fails the RSVP is still created, tagged with its Response ID', async () => {
  // e.g. the Notion database has no "Response ID" property yet.
  notionFailures.add('/databases/');
  const res = await worker.fetch(makeRequest('/rsvp', { body: validRsvp }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.updated, undefined);
  const create = notionCalls[1];
  assert.equal(create.init.method, 'POST');
  assert.match(create.url, /v1\/pages$/);
  assert.equal(create.body.properties['Response ID'].rich_text[0].text.content, validRsvp.responseId);
});

test('when the create with Response ID is rejected the RSVP is retried without it and not lost', async () => {
  let createAttempts = 0;
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/pages') && init?.method === 'POST') {
      createAttempts += 1;
      if (createAttempts === 1) {
        notionCalls.push({ url: String(url), init, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ message: 'Response ID is not a property' }), { status: 400 });
      }
    }
    return baseFetch(url, init);
  };
  try {
    const res = await worker.fetch(makeRequest('/rsvp', { body: validRsvp }), env);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).success, true);
    assert.equal(createAttempts, 2);
    const first = notionCalls[1];
    const retry = notionCalls[2];
    assert.ok(first.body.properties['Response ID']);
    assert.equal(retry.body.properties['Response ID'], undefined);
    assert.equal(retry.body.properties['Guest Name'].title[0].text.content, 'Test Guest');
  } finally {
    globalThis.fetch = baseFetch;
  }
});

test('a Notion create failure surfaces as 502, not a fake success', async () => {
  notionFailures.add('api.notion.com/v1/pages');
  const res = await worker.fetch(makeRequest('/rsvp', { body: { ...validRsvp, responseId: '' } }), env);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.success, undefined);
  assert.ok(body.error);
});

// ── Shenanigans behavior ─────────────────────────────────────────────
test('a shenanigan without content is rejected with 400', async () => {
  const res = await worker.fetch(makeRequest('/shenanigans', { body: { author: 'A', type: 'toast', content: '', extra: '' } }), env);
  assert.equal(res.status, 400);
});

test('an unknown shenanigan type is rejected with 400', async () => {
  const res = await worker.fetch(makeRequest('/shenanigans', { body: { author: 'A', type: 'karaoke', content: 'hi' } }), env);
  assert.equal(res.status, 400);
});

test('a valid shenanigan writes to the Shenanigans database with the mapped type', async () => {
  const res = await worker.fetch(makeRequest('/shenanigans', { body: { author: 'Best Friend', type: 'songs', content: 'Play the classics', extra: '' } }), env);
  assert.equal(res.status, 200);
  assert.equal(notionCalls.length, 1);
  const create = notionCalls[0];
  assert.equal(create.body.parent.database_id, env.SHENANIGANS_DB_ID);
  assert.equal(create.body.properties['Type'].select.name, 'Song Requests');
  assert.equal(create.body.properties['Author'].title[0].text.content, 'Best Friend');
});
