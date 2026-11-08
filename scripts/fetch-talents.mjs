// Télécharge la géométrie des arbres de talents et les données de talents
// depuis rokbuilder.com, puis les bundle dans data/talents.js.
//
//   node scripts/fetch-talents.mjs

import { writeFile } from 'node:fs/promises';

const UA = 'RoK-Build-Lab/1.0 (local fan tool)';
const BASE = 'https://rokbuilder.com/assets/data/';

async function fetchJson(file) {
  const res = await fetch(BASE + file, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${file}`);
  return res.json();
}

const [layout, talents] = await Promise.all([
  fetchJson('talent-layout.json'),
  fetchJson('talents.json')
]);

const payload = { layout, talents };
const js = `window.ROK_TALENTS = ${JSON.stringify(payload)};\n`;
await writeFile('data/talents.js', js, 'utf8');

console.log(`Écrit data/talents.js (${Math.round(js.length / 1024)} Ko)`);
console.log(`Arbres layout : ${Object.keys(layout.trees || {}).length}`);
console.log(`Arbres talents : ${Object.keys(talents.trees || {}).length}`);
console.log(`Commandants avec builds : ${Object.values(talents.cmd || {}).filter((c) => c.b && c.b.length).length}`);
