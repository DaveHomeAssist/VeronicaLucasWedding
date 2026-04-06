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
 */

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1/pages';

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

function text(content, val) {
  return [{ text: { content: String(content ?? '') } }];
}

async function handleRSVP(data, env) {
  const { name, email, attending, plusOne, plusOneName, plusOneDiet, diet, note } = data;

  if (!name || !attending) {
    return { error: 'Name and attending status are required', status: 400 };
  }

  const response = await fetch(NOTION_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: env.RSVP_DB_ID },
      properties: {
        'Guest Name': { title: text(name) },
        'Email': { email: email || null },
        'Attending': { select: { name: attending === 'yes' ? 'Joyfully Accepts' : 'Regretfully Declines' } },
        'Plus One': { checkbox: plusOne === 'yes' },
        'Guest Name (+1)': { rich_text: text(plusOneName) },
        'Guest Dietary (+1)': { rich_text: text(plusOneDiet) },
        'Dietary Restrictions': { rich_text: text(diet) },
        'Notes': { rich_text: text(note) },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Notion RSVP error:', err);
    return { error: 'Failed to save RSVP', status: 502 };
  }

  return { success: true, status: 200 };
}

async function handleShenanigans(data, env) {
  const { author, type, content, extra } = data;

  if (!content) {
    return { error: 'Content is required', status: 400 };
  }

  const typeMap = {
    toast: 'Toast Roast',
    photos: 'Photo Ops',
    songs: 'Song Requests',
    advice: 'Advice & Bets',
  };

  const response = await fetch(NOTION_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: env.SHENANIGANS_DB_ID },
      properties: {
        'Author': { title: text(author || 'Anonymous') },
        'Type': { select: { name: typeMap[type] || type } },
        'Content': { rich_text: text(content) },
        'Extra': { rich_text: text(extra) },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Notion Shenanigans error:', err);
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

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
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
