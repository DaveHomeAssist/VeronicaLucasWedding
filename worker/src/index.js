/**
 * Cloudflare Worker — Wedding API Proxy
 *
 * Receives form submissions from veronicaandlucas.com and writes them
 * to Notion databases. Keeps the Notion API key server-side.
 *
 * Environment variables (set in wrangler.toml or via `wrangler secret put`):
 *   NOTION_API_KEY      — Notion internal integration token (secret)
 *   RSVP_DB_ID          — Notion database ID for RSVPs
 *   SHENANIGANS_DB_ID   — Notion database ID for Shenanigans
 *   ALLOWED_ORIGIN      — CORS origin (https://veronicaandlucas.com)
 *
 * Notion schema note: for edit-in-place RSVPs, the RSVP database should
 * have a "Response ID" rich text property. If it is missing the worker
 * still saves RSVPs (it falls back to plain creates) but edits will
 * append new rows instead of updating the original.
 *
 * Abuse protections (the site is a public form, so the Origin check is
 * a courtesy fence, not a guarantee): request size cap, per-IP rate
 * limit (best-effort, per isolate), honeypot field, field length caps,
 * strict value validation, and responseId-based dedupe for RSVPs.
 */

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1/pages';
const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

const rateBuckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.start > RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_MAX;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function str(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function text(content) {
  return [{ text: { content: String(content ?? '') } }];
}

function notionHeaders(env) {
  return {
    Authorization: `Bearer ${env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESPONSE_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** Find an existing RSVP page by Response ID. Returns page id or null. */
async function findExistingRSVP(responseId, env) {
  const res = await fetch(`https://api.notion.com/v1/databases/${env.RSVP_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({
      filter: { property: 'Response ID', rich_text: { equals: responseId } },
      page_size: 1,
    }),
  });
  if (!res.ok) {
    // Likely the "Response ID" property does not exist yet — fall back to create.
    console.error('Notion RSVP query error:', await res.text());
    return null;
  }
  const body = await res.json();
  return body.results?.[0]?.id || null;
}

async function handleRSVP(data, env) {
  const name = str(data.name, 200);
  const email = str(data.email, 254);
  const attending = data.attending;
  const plusOne = data.plusOne === 'yes' ? 'yes' : 'no';
  const plusOneName = str(data.plusOneName, 200);
  const plusOneDiet = str(data.plusOneDiet, 500);
  const diet = str(data.diet, 500);
  const note = str(data.note, 1000);
  const responseId = RESPONSE_ID_RE.test(String(data.responseId ?? '')) ? data.responseId : null;

  if (!name || (attending !== 'yes' && attending !== 'no')) {
    return { error: 'Name and attending status are required', status: 400 };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: 'That email address does not look right', status: 400 };
  }

  const properties = {
    'Guest Name': { title: text(name) },
    'Email': { email: email || null },
    'Attending': { select: { name: attending === 'yes' ? 'Joyfully Accepts' : 'Regretfully Declines' } },
    'Plus One': { checkbox: plusOne === 'yes' },
    'Guest Name (+1)': { rich_text: text(plusOneName) },
    'Guest Dietary (+1)': { rich_text: text(plusOneDiet) },
    'Dietary Restrictions': { rich_text: text(diet) },
    'Notes': { rich_text: text(note) },
  };

  // Update-in-place when this browser already submitted an RSVP.
  if (responseId) {
    const existingPageId = await findExistingRSVP(responseId, env);
    if (existingPageId) {
      const patch = await fetch(`${NOTION_API}/${existingPageId}`, {
        method: 'PATCH',
        headers: notionHeaders(env),
        body: JSON.stringify({ properties: { ...properties, 'Response ID': { rich_text: text(responseId) } } }),
      });
      if (!patch.ok) {
        console.error('Notion RSVP update error:', await patch.text());
        return { error: 'Failed to update RSVP', status: 502 };
      }
      return { success: true, updated: true, status: 200 };
    }
    properties['Response ID'] = { rich_text: text(responseId) };
  }

  let response = await fetch(NOTION_API, {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({ parent: { database_id: env.RSVP_DB_ID }, properties }),
  });

  if (!response.ok && properties['Response ID']) {
    // The database may not have the "Response ID" property yet.
    // Never lose an RSVP over dedupe metadata — retry without it.
    console.error('Notion RSVP create error (with Response ID):', await response.text());
    delete properties['Response ID'];
    response = await fetch(NOTION_API, {
      method: 'POST',
      headers: notionHeaders(env),
      body: JSON.stringify({ parent: { database_id: env.RSVP_DB_ID }, properties }),
    });
  }

  if (!response.ok) {
    console.error('Notion RSVP error:', await response.text());
    return { error: 'Failed to save RSVP', status: 502 };
  }

  return { success: true, status: 200 };
}

async function handleShenanigans(data, env) {
  const author = str(data.author, 120) || 'Anonymous';
  const content = str(data.content, 2000);
  const extra = str(data.extra, 500);

  if (!content && !extra) {
    return { error: 'Content is required', status: 400 };
  }

  const typeMap = {
    toast: 'Toast Roast',
    photos: 'Photo Ops',
    songs: 'Song Requests',
    advice: 'Advice & Bets',
  };

  const typeName = typeMap[data.type];
  if (!typeName) {
    return { error: 'Unknown submission type', status: 400 };
  }

  const response = await fetch(NOTION_API, {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({
      parent: { database_id: env.SHENANIGANS_DB_ID },
      properties: {
        'Author': { title: text(author) },
        'Type': { select: { name: typeName } },
        'Content': { rich_text: text(content) },
        'Extra': { rich_text: text(extra) },
      },
    }),
  });

  if (!response.ok) {
    console.error('Notion Shenanigans error:', await response.text());
    return { error: 'Failed to save', status: 502 };
  }

  return { success: true, status: 200 };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = origin === env.ALLOWED_ORIGIN || origin === 'http://127.0.0.1:4173';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowed ? origin : env.ALLOWED_ORIGIN),
      });
    }

    if (!allowed) {
      return json({ error: 'Origin not allowed' }, 403, env.ALLOWED_ORIGIN);
    }

    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return json({ error: 'Too many requests — please slow down' }, 429, origin);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'Request too large' }, 413, origin);
    }

    let data;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return json({ error: 'Request too large' }, 413, origin);
      }
      data = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }
    if (!data || typeof data !== 'object') {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }

    // Honeypot: humans never see this field; bots that fill it get a
    // quiet "success" and nothing is written.
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return json({ success: true }, 200, origin);
    }

    let result;

    if (url.pathname === '/rsvp') {
      result = await handleRSVP(data, env);
    } else if (url.pathname === '/shenanigans') {
      result = await handleShenanigans(data, env);
    } else {
      return json({ error: 'Not found' }, 404, origin);
    }

    const { status, ...body } = result;
    return json(body, status, origin);
  },
};
