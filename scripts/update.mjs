#!/usr/bin/env node
/**
 * RoK Build Lab — mise à jour des données
 *
 * Usage :
 *   node scripts/update.mjs                     # régénère data/commanders.js depuis data/commanders.json
 *   node scripts/update.mjs --source <URL>      # récupère un JSON distant, le fusionne, puis régénère
 *   node scripts/update.mjs --check --source <URL>  # vérifie juste si une version plus récente existe
 *
 * Le JSON distant doit avoir la même forme que data/commanders.json :
 *   { "meta": { "version": "2026.11.08", ... }, "commanders": [ ... ] }
 *
 * Variables d'environnement :
 *   ROK_SOURCE_URL   équivalent de --source
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(ROOT, 'data', 'commanders.json');
const JS_PATH = path.join(ROOT, 'data', 'commanders.js');
const CONTENT_JSON = path.join(ROOT, 'data', 'content.json');
const CONTENT_JS = path.join(ROOT, 'data', 'content.js');

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const hasFlag = (name) => args.includes(name);

const source = getArg('--source') || process.env.ROK_SOURCE_URL;
const checkOnly = hasFlag('--check');
const noBump = hasFlag('--no-bump');

function todayVersion() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function assertData(data, label) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} : un objet JSON est attendu.`);
  }
  if (!Array.isArray(data.commanders)) {
    throw new Error(`${label} : la propriété "commanders" doit être un tableau.`);
  }
  const seen = new Set();
  data.commanders.forEach((c, index) => {
    if (!c || typeof c !== 'object') throw new Error(`${label} : commandant #${index} invalide.`);
    if (typeof c.id !== 'string' || !c.id.trim()) throw new Error(`${label} : commandant #${index} sans "id".`);
    if (seen.has(c.id)) throw new Error(`${label} : id dupliqué "${c.id}".`);
    seen.add(c.id);
    if (typeof c.name !== 'string' || !c.name.trim()) throw new Error(`${label} : "${c.id}" sans "name".`);
    if (!Array.isArray(c.trees)) throw new Error(`${label} : "${c.id}" sans tableau "trees".`);
  });
}

async function readJson(file) {
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  return response.json();
}

async function writeData(data) {
  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFile(JSON_PATH, json, 'utf8');
  await writeFile(JS_PATH, `window.ROK_DATA = ${json};\n`, 'utf8');
}

async function writeContent() {
  try {
    const raw = await readFile(CONTENT_JSON, 'utf8');
    JSON.parse(raw);
    await writeFile(CONTENT_JS, `window.ROK_CONTENT = ${raw.trim()};\n`, 'utf8');
    console.log('Écrit : data/content.js');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function main() {
  const local = await readJson(JSON_PATH);
  assertData(local, 'data/commanders.json');

  let remote = null;
  if (source) {
    console.log(`Source distante : ${source}`);
    remote = await fetchJson(source);
    assertData(remote, 'source distante');
  }

  if (checkOnly) {
    if (!remote) throw new Error('--check nécessite --source (ou ROK_SOURCE_URL).');
    const localVersion = local.meta?.version || '—';
    const remoteVersion = remote.meta?.version || '—';
    if (localVersion === remoteVersion) {
      console.log(`À jour (v${localVersion}).`);
      process.exit(0);
    }
    console.log(`Nouvelle version disponible : v${localVersion} → v${remoteVersion}.`);
    process.exit(1);
  }

  const merged = new Map(local.commanders.map((c) => [c.id, c]));
  if (remote) {
    for (const commander of remote.commanders) {
      merged.set(commander.id, { ...(merged.get(commander.id) || {}), ...commander });
    }
  }

  const version = remote?.meta?.version || (noBump ? local.meta?.version : todayVersion());

  const output = {
    meta: {
      ...local.meta,
      ...(remote?.meta || {}),
      version,
      updatedAt: new Date().toISOString().slice(0, 10),
      source: source || local.meta?.source || 'Dataset local'
    },
    commanders: [...merged.values()]
  };

  assertData(output, 'résultat fusionné');
  await writeData(output);
  await writeContent();

  const added = remote ? remote.commanders.filter((c) => !local.commanders.some((l) => l.id === c.id)).length : 0;
  console.log(`OK — v${version} · ${output.commanders.length} commandants` + (added ? ` · ${added} ajoutés` : ''));
  console.log('Écrit : data/commanders.json et data/commanders.js');
}

main().catch((err) => {
  console.error(`Erreur : ${err.message}`);
  process.exit(1);
});
