// Réécrit un fichier JSON en UTF-8 propre (sans échappement \uXXXX).
// Utilisé après les scripts PowerShell pour éviter les problèmes d'encodage.
import { readFile, writeFile } from 'node:fs/promises';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/normalize-json.mjs <fichier.json>');
  process.exit(1);
}

const raw = await readFile(target, 'utf8');
const data = JSON.parse(raw);
await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Normalisé : ${target}`);
