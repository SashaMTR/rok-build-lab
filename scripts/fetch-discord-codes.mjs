// Synchronise les codes depuis le salon Discord (API bot officielle) vers
// data/content.json + data/content.js.
//
//   node scripts/fetch-discord-codes.mjs
//   node scripts/fetch-discord-codes.mjs --dry-run
//   node scripts/fetch-discord-codes.mjs --limit 300 --status active
//
// Variables :
//   DISCORD_BOT_TOKEN   token du bot (jamais dans le navigateur)
//   DISCORD_CHANNEL_ID  id du salon #codes
//
// Le script lit aussi .env à la racine (local). Sur GitHub Actions, les
// variables viennent des secrets du dépôt.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_JSON = path.join(ROOT, 'data', 'content.json');
const CONTENT_JS = path.join(ROOT, 'data', 'content.js');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const argValue = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const dryRun = hasFlag('--dry-run');
const limit = Math.max(1, Number(argValue('--limit', '300')) || 300);
const forcedStatus = argValue('--status', 'auto'); // auto | active | unknown

async function loadEnv() {
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) return;
  try {
    const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match) continue;
      const key = match[1];
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // pas de .env : on utilisera les variables d'environnement
  }
}

function extractCodes(text) {
  const cleaned = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<a?:[^>]+>/g, ' ')
    .replace(/<@[!&]?\d+>/g, ' ')
    .replace(/<#[0-9]+>/g, ' ');

  const set = new Set();
  const regex = /(?<![A-Za-z0-9])(?=[A-Za-z0-9]{4,20}(?![A-Za-z0-9]))(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,20}(?![A-Za-z0-9])/g;
  for (const match of cleaned.matchAll(regex)) set.add(match[0]);
  for (const match of cleaned.matchAll(/\b(ROK|LILITH)[A-Za-z0-9]{2,15}\b/gi)) set.add(match[0]);
  return [...set];
}

function parseExpiry(text) {
  const raw = String(text || '');
  const discordTs = raw.match(/<t:(\d{9,13})(?::[A-Za-z])?>/);
  if (discordTs) {
    let unix = Number(discordTs[1]);
    if (unix > 9999999999) unix = Math.floor(unix / 1000);
    return new Date(unix * 1000).toISOString();
  }

  const months = {
    janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12
  };
  const match = raw.match(/(?<!\d)(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const month = months[match[2].toLowerCase()];
  if (!month) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${match[3]}-${pad(month)}-${pad(Number(match[1]))}T${pad(Number(match[4]))}:${pad(Number(match[5]))}`;
}

function messageRewards(content, code) {
  const cleaned = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[*_`~]/g, ' ');
  const line = cleaned
    .split(/\r?\n/)
    .map((s) => s.replace(/^[🎁\s]+/u, '').trim())
    .find((s) => s && !/^https?:/i.test(s));
  if (!line) return 'Code Discord';
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rewards = line
    .replace(new RegExp(escaped, 'ig'), '')
    .replace(/^(redeem\s*code|code)\s*:?\s*/i, '')
    .replace(/^[-–—:]\s*/, '')
    .trim();
  return (rewards || 'Code Discord').slice(0, 90);
}

async function fetchMessages(token, channelId, max) {
  const out = [];
  let before = null;
  while (out.length < max) {
    const take = Math.min(100, max - out.length);
    const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
    url.searchParams.set('limit', String(take));
    if (before) url.searchParams.set('before', before);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'RoK-Build-Lab/1.0 (local fan tool)'
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord HTTP ${res.status} — ${body.slice(0, 220)}`);
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    before = page[page.length - 1].id;
    if (page.length < take) break;
  }
  return out;
}

function statusFor(message, expiry, forced) {
  if (forced === 'active' || forced === 'unknown') return forced;
  const expired = expiry ? new Date(expiry).getTime() < Date.now() : false;
  if (expired) return 'expired';
  if (expiry) return 'active';
  const date = new Date(message.timestamp || 0);
  const ageDays = Number.isFinite(date.getTime()) ? (Date.now() - date.getTime()) / 86400000 : 999;
  return ageDays <= 30 ? 'active' : 'unknown';
}

async function main() {
  await loadEnv();
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    console.log('Discord non configuré (DISCORD_BOT_TOKEN / DISCORD_CHANNEL_ID absents) — rien à faire.');
    return;
  }

  const messages = await fetchMessages(token, channelId, limit);
  console.log(`Messages Discord lus : ${messages.length}`);

  const found = new Map();
  for (const message of messages) {
    const content = message.content || '';
    if (/(expired|expir[ée]|no longer valid|invalid|ne fonctionne plus)/i.test(content)) continue;
    const expiry = parseExpiry(content);
    const codes = extractCodes(content);
    for (const code of codes) {
      if (!found.has(code.toLowerCase())) {
        found.set(code.toLowerCase(), { code, message, expiry });
      }
    }
  }

  console.log(`Codes trouvés : ${found.size}`);

  const raw = await readFile(CONTENT_JSON, 'utf8');
  const content = JSON.parse(raw);
  content.codes = content.codes || { items: [] };
  content.codes.items = Array.isArray(content.codes.items) ? content.codes.items : [];
  const existing = new Map(content.codes.items.map((item) => [String(item.code).toLowerCase(), item]));

  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  let updated = 0;

  for (const entry of found.values()) {
    const key = entry.code.toLowerCase();
    const expiry = entry.expiry;
    const status = statusFor(entry.message, expiry, forcedStatus);
    const rewards = messageRewards(entry.message.content, entry.code);
    const current = existing.get(key);

    if (current) {
      let changed = false;
      if (expiry && current.expires !== expiry) {
        current.expires = expiry;
        changed = true;
      }
      const genericRewards = !current.rewards || current.rewards === 'Code Discord' || current.rewards.includes(entry.code) || /redeem\s*code/i.test(current.rewards);
      if (genericRewards && current.rewards !== rewards) {
        current.rewards = rewards;
        changed = true;
      }
      if (status === 'expired' && current.status !== 'expired') {
        current.status = 'expired';
        changed = true;
      } else if (expiry && status === 'active' && current.status === 'expired') {
        current.status = 'active';
        changed = true;
      }
      if (changed) updated += 1;
      continue;
    }

    const item = {
      code: entry.code,
      rewards,
      status,
      added: today,
      expires: expiry || null
    };
    content.codes.items.push(item);
    existing.set(key, item);
    added += 1;
  }

  console.log(`Nouveaux codes : ${added} · mis à jour : ${updated} · total : ${content.codes.items.length}`);

  if (added === 0 && updated === 0) {
    console.log('Aucun changement.');
    return;
  }

  content.codes.verifiedAt = today;
  content.codes.source = `Discord (salon ${channelId})`;
  content.codes.note = 'Codes synchronisés depuis ton salon Discord #codes. Les codes sans expiration connue restent à tester.';

  if (dryRun) {
    console.log('Mode --dry-run : fichiers non écrits.');
    return;
  }

  const json = JSON.stringify(content, null, 2) + '\n';
  await writeFile(CONTENT_JSON, json, 'utf8');
  await writeFile(CONTENT_JS, `window.ROK_CONTENT = ${json.trim()};\n`, 'utf8');
  console.log('Écrit : data/content.json et data/content.js');
}

main().catch((err) => {
  console.error(`Erreur : ${err.message}`);
  process.exit(1);
});
