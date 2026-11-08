// Importe les données de commandants depuis rokbuilder.com (builds officiels, tier,
// pairings, compétences) et met à jour data/commanders.json + data/commanders.js.
//
//   node scripts/fetch-commander-data.mjs --dry-run --limit 5
//   node scripts/fetch-commander-data.mjs
//
// Les champs manuels (role, roleKey, invest, skillOrder, equipment, notes)
// sont conservés pour les commandants déjà présents. Les builds officiels,
// le tier, les pairings et les compétences sont mis à jour.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(ROOT, 'data', 'commanders.json');
const JS_PATH = path.join(ROOT, 'data', 'commanders.js');
const BASE = 'https://rokbuilder.com';
const ROKSTATS = 'https://app.rokstats.online';
const UA = 'RoK-Build-Lab/1.0 (local fan tool)';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 0;
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? args[onlyArg + 1] : null;

const RARITY = { legendary: 'legendaire', epic: 'epique', elite: 'elite', advanced: 'avance' };
const TROOP = { infantry: 'infanterie', cavalry: 'cavalerie', archer: 'archers', archers: 'archers', leadership: 'polyvalent', engineering: 'siege', universal: 'polyvalent' };
const TREE = {
  Infantry: 'Infanterie', Garrison: 'Garnison', Skill: 'Compétence', Attack: 'Attaque',
  Defense: 'Défense', Cavalry: 'Cavalerie', Archer: 'Archers', Archers: 'Archers',
  Mobility: 'Mobilité', Support: 'Soutien', Peacekeeping: 'Maintien de la paix',
  Gathering: 'Récolte', Integration: 'Intégration', Leadership: 'Leadership',
  Conquering: 'Conquête', Versatility: 'Polyvalence'
};
const USE = {
  field: 'pvp', 'open field': 'pvp', garrison: 'garnison', defending: 'garnison',
  rallying: 'ralliement', barbarians: 'barbares', peacekeeping: 'barbares',
  gathering: 'recolte', 'rallying cities': 'ralliement'
};
const GEAR = {
  cavalerie: ['Casque Windswept', 'Plastron Windswept', 'Hallebarde d’avant-garde', 'Brassards Windswept', 'Jambières d’avant-garde', 'Bottes Windswept'],
  infanterie: ['Casque du Phénix', 'Plastron d’infanterie', 'Lame bénie', 'Brassards du Phénix', 'Jambières d’avant-garde', 'Bottes du Phénix'],
  archers: ['Arc du Souffle du Dragon', 'Tassettes du Souffle du Dragon', 'Casque du Souffle du Dragon', 'Bracelets du Souffle du Dragon', 'Plastron du Souffle du Dragon', 'Bottes du Souffle du Dragon'],
  polyvalent: ['Casque du Phénix', 'Plastron d’infanterie', 'Lame bénie', 'Brassards du Phénix', 'Jambières d’avant-garde', 'Bottes du Phénix'],
  siege: ['Casque du Phénix', 'Plastron d’infanterie', 'Lame bénie', 'Brassards du Phénix', 'Jambières d’avant-garde', 'Bottes du Phénix']
};
const GATHER_GEAR = ['Coiffe de moissonneur', 'Robe de moissonneur', 'Sceptre du gardien de la forêt', 'Gants de moissonneur', 'Pantalon de moissonneur', 'Bottes de moissonneur'];

const ALIASES = {
  boudica: 'boudica', 'joan of arc': 'jeanne', 'city keeper': 'city-keeper',
  markswoman: 'markswoman', 'dragon lancer': 'dragon-lancer',
  belisarius: 'belisaire', pelagius: 'pelagius', 'bjorn ironside': 'bjorn',
  'scipio africanus': 'scipio', 'richard i': 'richard',
  'alexander the great': 'alexander', 'leonidas i': 'leonidas',
  'constantine i': 'constantine', 'edward of woodstock': 'edward',
  'cyrus the great': 'cyrus', 'genghis khan': 'genghis',
  'julius caesar': 'caesar', 'frederick i': 'frederick',
  aethelflaed: 'aethelflaed', 'cleopatra vii': 'cleopatra',
  baibars: 'baibars', 'osman i': 'osman', 'mehmed ii': 'mehmed',
  'artemisia i': 'artemisia', 'el cid': 'el-cid',
  'matilda of flanders': 'matilda', sarka: 'sarka',
  'gaius marius': 'gaius-marius', 'caius marius': 'gaius-marius',
  'sun tzu': 'sun-tzu', 'minamoto no yoshitsune': 'minamoto',
  'cao cao': 'cao-cao', 'tomoe gozen': 'tomoe', lancelot: 'lancelot',
  'guan yu': 'guan-yu', pyrrhus: 'pyrrhus', 'ragnar lodbrok': 'ragnar',
  'wu zetian': 'wu-zetian', 'charles martel': 'charles-martel',
  'yi seong-gye': 'yi-seong-gye', 'takeda shingen': 'takeda',
  'hannibal barca': 'hannibal', charlemagne: 'charlemagne',
  'tomyris': 'tomyris', 'ramses ii': 'ramses', 'saladin': 'saladin',
  'attila': 'attila', 'hermann': 'hermann', 'kusunoki masashige': 'kusunoki',
  'eulji mundeok': 'eulji', 'lohar': 'lohar', 'mulan': 'mulan',
  'ishida mitsunari': 'ishida', 'seondeok': 'seondeok', 'keira': 'keira',
  'centurion': 'centurion', 'constance': 'constance'
};

function decodeHtml(value) {
  return String(value)
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function norm(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseBuildPoints(value) {
  const map = {};
  String(value || '').split(',').forEach((pair) => {
    const [id, points] = pair.split(':');
    if (id) map[id] = Number(points) || 0;
  });
  return map;
}

function makeSkillOrder(skills) {
  const list = (skills || []).filter((s) => s && s.name);
  const active = list.find((s) => /active/i.test(s.type)) || list.find((s) => /expertise/i.test(s.type));
  const passives = list.filter((s) => s !== active && /passive/i.test(s.type));
  const expertise = list.find((s) => /expertise/i.test(s.type));

  if (!active) {
    return 'Monte les compétences dans l’ordre 5-1-1-1 avant les étoiles, puis 5-5-5-5 + expertise.';
  }

  const parts = [`« ${active.name} » (active) à 5 en premier`];
  if (passives.length) parts.push(`puis ${passives.map((p) => `« ${p.name} »`).join(' → ')}`);
  if (expertise && expertise !== active) parts.push(`enfin « ${expertise.name} » (expertise)`);

  return `${parts.join(', ')}. Ordre 5-1-1-1 avant les étoiles, puis 5-5-5-5.`;
}

/* ------------------------------------------------------------------ *
 * Analyse des compétences (RokStats) : on lit les descriptions pour
 * en déduire le profil de combat réel du commandant (dégâts, tank,
 * soutien, utilité) au lieu de se fier uniquement au tier.
 * ------------------------------------------------------------------ */

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function skillSentences(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);
}

async function fetchRokStatsDossier(slug, name) {
  const candidates = [slug, name ? norm(name).replace(/\s+/g, '-') : null].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    try {
      const res = await fetch(`${ROKSTATS}/commanders/${candidate}`, { headers: { 'user-agent': UA, accept: 'text/html' } });
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/<script type="application\/json" id="commander-dossier-data">([\s\S]*?)<\/script>/);
      if (match) return JSON.parse(match[1]);
    } catch (err) {
      /* on tente le candidat suivant */
    }
  }
  return null;
}

function buildSkillProfile(dossier) {
  const skills = [...(dossier.skills || []), dossier.expertise].filter(Boolean);
  const entries = skills.map((skill) => {
    const levels = skill.levels || [];
    const level = levels[levels.length - 1] || {};
    return {
      kind: skill.kind || '',
      name: skill.name || '',
      targetType: skill.targetType || '',
      text: level.description || '',
      rage: toNum(level.rage),
      power: toNum(level.power)
    };
  });

  const profile = {
    damageFactor: 0, aoe: false, targets: 1, skillDamageBonus: 0, selfDamageBonus: 0,
    healFactor: 0, selfAttack: 0, selfDefense: 0, selfHealth: 0, selfDamageReduction: 0,
    selfDefensePenalty: 0, selfSpeed: 0, selfRage: 0,
    teamAttack: 0, teamDefense: 0, teamHealth: 0, teamDamageReduction: 0, teamRage: 0, teamSpeed: 0,
    enemyAttackDown: 0, enemyDefenseDown: 0, enemySpeedDown: 0, enemyDamageDown: 0, enemyDamageTaken: 0,
    control: false, shield: false, counter: false, garrison: false, barbarianBonus: 0,
    activeRage: 0, garrisonOnly: false, secondaryOnly: false, primaryOnly: false,
    secondary: { skillDamage: 0, damage: 0, attack: 0, support: 0 },
    active: '', tags: [], summary: ''
  };

  const setMax = (key, value) => {
    const n = toNum(value);
    if (n > profile[key]) profile[key] = n;
  };

  const secondaryTexts = [];

  for (const entry of entries) {
    if (!entry.text) continue;
    const text = entry.text;

    const garrisonOnly = /garrison/i.test(text) && !/(field|open field)/i.test(text);
    const secondaryOnly = /secondary commander/i.test(text);
    const primaryOnly = /primary commander/i.test(text);

    if (garrisonOnly) {
      profile.garrisonOnly = true;
      continue;
    }
    if (secondaryOnly) {
      profile.secondaryOnly = true;
      secondaryTexts.push(text);
      continue;
    }
    if (primaryOnly) profile.primaryOnly = true;

    if (entry.kind.toLowerCase() === 'active' && !profile.active) {
      profile.active = entry.name;
      if (entry.rage) profile.activeRage = profile.activeRage ? Math.min(profile.activeRage, entry.rage) : entry.rage;
    }

    (text.match(/Damage Factor\s+(\d+)/gi) || []).forEach((match) => setMax('damageFactor', match.match(/\d+/)[0]));
    if (/AoE|up to \d+ enemy troops|fan shape|fan of/i.test(text) || entry.targetType.toLowerCase() === 'aoe') profile.aoe = true;
    const targetMatch = text.match(/up to (\d+) enemy troops/i);
    if (targetMatch) profile.targets = Math.max(profile.targets, Number(targetMatch[1]));
    const healMatch = text.match(/Healing Factor\s+(\d+)/i);
    if (healMatch) setMax('healFactor', Number(healMatch[1]));
    const sdbMatch = text.match(/(\d+)%\s+more skill damage/i);
    if (sdbMatch) setMax('skillDamageBonus', Number(sdbMatch[1]));
    const barbMatch = text.match(/(\d+)%\s+more damage to barbarians/i);
    if (barbMatch) setMax('barbarianBonus', Number(barbMatch[1]));
    if (/shield/i.test(text)) profile.shield = true;
    if (/counterattack/i.test(text)) profile.counter = true;
    if (/garrison/i.test(text)) profile.garrison = true;
    if (/silence|disarm|stun|immobiliz|taunt|fear|provoke/i.test(text)) profile.control = true;

    const skillTeam = /(allied|friendly|nearby|all troops|all units|your city|garrison)/i.test(text);

    for (const sentence of skillSentences(text)) {
      const enemy = /(target|enemy)/i.test(sentence);
      const team = skillTeam || /(allied|friendly|nearby|all troops|all units|your city|garrison)/i.test(sentence);
      const losing = /(loses?|reduce[sd]?|decrease[sd]?|less|down)/i.test(sentence);
      const gaining = /(gains?|increase[sd]?|bonus|extra|more)/i.test(sentence);

      const attack = sentence.match(/(\d+)%\s+(?:more\s+|extra\s+)?Attack/i);
      const defense = sentence.match(/(\d+)%\s+(?:more\s+|extra\s+)?Defense/i);
      const health = sentence.match(/(\d+)%\s+(?:more\s+|extra\s+)?Health/i);
      const speed = sentence.match(/(\d+)%\s+(?:more\s+|extra\s+)?March Speed/i);
      const lessDamage = sentence.match(/(\d+)%\s+less damage/i);
      const damageReceived = sentence.match(/damage received by\s+(\d+)%/i);
      const moreDamage = sentence.match(/(\d+)%\s+more damage/i);
      const rage = sentence.match(/(\d+)\s+(?:extra\s+)?Rage/i);
      const defenseLoss = sentence.match(/lose[s]?\s+(\d+)%\s+Defense/i);

      if (enemy && damageReceived) setMax('enemyDamageTaken', Number(damageReceived[1]));
      else if (damageReceived) setMax('selfDamageReduction', Number(damageReceived[1]));

      if (enemy && losing) {
        if (attack) setMax('enemyAttackDown', Number(attack[1]));
        if (defense) setMax('enemyDefenseDown', Number(defense[1]));
        if (speed) setMax('enemySpeedDown', Number(speed[1]));
        if (lessDamage) setMax('enemyDamageDown', Number(lessDamage[1]));
      } else {
        if (attack && gaining) {
          if (team) setMax('teamAttack', Number(attack[1]));
          else setMax('selfAttack', Number(attack[1]));
        }
        if (defense && gaining) {
          if (defenseLoss) setMax('selfDefensePenalty', Number(defenseLoss[1]));
          else if (team) setMax('teamDefense', Number(defense[1]));
          else setMax('selfDefense', Number(defense[1]));
        }
        if (health && gaining) {
          if (team) setMax('teamHealth', Number(health[1]));
          else setMax('selfHealth', Number(health[1]));
        }
        if (speed && gaining) {
          if (team) setMax('teamSpeed', Number(speed[1]));
          else setMax('selfSpeed', Number(speed[1]));
        }
        if (lessDamage) {
          if (team) setMax('teamDamageReduction', Number(lessDamage[1]));
          else setMax('selfDamageReduction', Number(lessDamage[1]));
        }
      }

      if (rage) {
        if (team) setMax('teamRage', Number(rage[1]));
        else setMax('selfRage', Number(rage[1]));
      }
      if (moreDamage && !/skill damage|barbarians|damage received/i.test(sentence)) {
        if (team) setMax('teamAttack', Number(moreDamage[1]));
        else setMax('selfDamageBonus', Number(moreDamage[1]));
      }
    }
  }

  for (const text of secondaryTexts) {
    const sdb = text.match(/(\d+)%\s+more skill damage/i);
    if (sdb) profile.secondary.skillDamage = Math.max(profile.secondary.skillDamage, Number(sdb[1]));
    const dmg = text.match(/(\d+)%\s+more damage/i);
    if (dmg && !/skill damage|barbarians/i.test(text)) profile.secondary.damage = Math.max(profile.secondary.damage, Number(dmg[1]));
    const atk = text.match(/(\d+)%\s+(?:more\s+|extra\s+)?Attack/i);
    if (atk) profile.secondary.attack = Math.max(profile.secondary.attack, Number(atk[1]));
    if (/allied|friendly|nearby|all troops|all units/i.test(text)) profile.secondary.support = Math.max(profile.secondary.support, 2);
  }

  const tags = [];
  if (profile.damageFactor >= 400) tags.push('damage');
  if (profile.aoe) tags.push('aoe');
  if (profile.healFactor) tags.push('heal');
  if (profile.teamAttack || profile.teamDefense || profile.teamHealth || profile.teamDamageReduction || profile.teamRage) tags.push('support');
  if (profile.enemyAttackDown || profile.enemyDefenseDown || profile.enemyDamageDown || profile.enemyDamageTaken || profile.control) tags.push('debuff');
  if (profile.selfDefense || profile.selfHealth || profile.selfDamageReduction || profile.shield || profile.counter) tags.push('tank');
  if (profile.selfRage || profile.teamRage) tags.push('rage');
  if (profile.barbarianBonus) tags.push('barbares');
  if (profile.garrison || profile.garrisonOnly) tags.push('garnison');
  if (profile.secondary.skillDamage || profile.secondary.damage || profile.secondary.attack) tags.push('secondary');
  profile.tags = tags;

  const summary = [];
  if (profile.damageFactor) summary.push(profile.aoe ? 'dégâts AoE' : 'dégâts monocible');
  if (profile.healFactor) summary.push('soin');
  if (profile.teamAttack || profile.teamDefense || profile.teamHealth || profile.teamDamageReduction) summary.push('buffs d’équipe');
  if (profile.selfAttack) summary.push('buff attaque');
  if (profile.selfDefense || profile.selfHealth || profile.selfDamageReduction) summary.push('tank');
  if (profile.enemyAttackDown || profile.enemyDefenseDown || profile.enemyDamageDown || profile.enemyDamageTaken) summary.push('debuff');
  if (profile.control) summary.push('contrôle');
  if (profile.selfRage || profile.teamRage) summary.push('rage');
  if (profile.barbarianBonus) summary.push('anti-barbares');
  if (profile.garrison || profile.garrisonOnly) summary.push('garnison');
  if (profile.secondary.skillDamage || profile.secondary.damage) summary.push('bonus en secondaire');
  profile.summary = summary.slice(0, 7).join(' · ');

  return profile;
}

function computeCombat(profile, treeIds) {
  const trees = (treeIds || []).map(Number);
  const has = (...ids) => ids.some((id) => trees.includes(id));

  let damage = clamp(0, 10,
    profile.damageFactor / 200 +
    (profile.aoe ? 1.5 : 0) +
    (profile.targets > 1 ? 1 : 0) +
    profile.selfAttack / 12 +
    profile.selfDamageBonus / 12 +
    profile.skillDamageBonus / 12 +
    profile.selfRage / 100 +
    profile.enemyDamageTaken / 25 +
    Math.max(0, (1000 - (profile.activeRage || 1000)) / 200)
  );
  let tank = clamp(0, 10,
    profile.selfDefense / 8 +
    profile.selfHealth / 6 +
    profile.selfDamageReduction / 6 -
    profile.selfDefensePenalty / 12 +
    profile.healFactor / 400 +
    (profile.shield ? 1.5 : 0) +
    (profile.counter ? 1.5 : 0) +
    (profile.garrison ? 1 : 0)
  );
  let support = clamp(0, 10,
    profile.teamAttack / 12 +
    profile.teamDefense / 12 +
    profile.teamHealth / 12 +
    profile.teamDamageReduction / 8 +
    profile.teamRage / 100 +
    profile.healFactor / 700 +
    profile.enemyAttackDown / 15 +
    profile.enemyDefenseDown / 15 +
    profile.enemyDamageDown / 15 +
    profile.enemyDamageTaken / 15 +
    (profile.control ? 1.5 : 0)
  );
  let utility = clamp(0, 10,
    profile.enemyAttackDown / 10 +
    profile.enemyDefenseDown / 10 +
    profile.enemySpeedDown / 10 +
    profile.enemyDamageDown / 10 +
    profile.enemyDamageTaken / 10 +
    profile.selfSpeed / 15 +
    profile.selfRage / 80 +
    profile.teamRage / 80 +
    (profile.control ? 2 : 0)
  );

  // Les arbres de talents complètent l'analyse des compétences.
  if (has(11, 12)) damage += 1.5;
  if (has(7, 13)) tank += 1.5;
  if (has(14, 5, 6)) support += 1.5;
  if (has(15)) utility += 1;
  if (has(2, 3)) damage += 0.75;
  if (has(1)) tank += 0.75;

  const combatTrees = has(1, 2, 3, 7, 11, 12, 13, 14);
  const farming = has(8, 9) && !combatTrees;
  if (!combatTrees && has(8, 9)) {
    damage *= 0.4;
    tank *= 0.4;
    support *= 0.4;
    utility *= 0.4;
  }

  damage = clamp(0, 12, damage);
  tank = clamp(0, 12, tank);
  support = clamp(0, 12, support);
  utility = clamp(0, 12, utility);

  const role = farming
    ? 'farming'
    : (damage >= tank && damage >= support ? 'damage' : (tank >= support ? 'tank' : 'support'));
  const secondary = (profile.secondary?.skillDamage || 0) / 10 +
    (profile.secondary?.damage || 0) / 10 +
    (profile.secondary?.attack || 0) / 15 +
    (profile.secondary?.support || 0);
  const score = damage + tank * 0.9 + support * 0.8 + utility * 0.5 + secondary * 0.5;

  return {
    damage: round1(damage),
    tank: round1(tank),
    support: round1(support),
    utility: round1(utility),
    secondary: round1(secondary),
    role,
    score: round1(score),
    tags: profile.tags,
    summary: profile.summary
  };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return res.text();
}

function parsePage(slug, html) {
  const meta = html.match(/<meta name="description" content="([^"]+)"/);
  const metaText = meta ? decodeHtml(meta[1]) : '';
  const rt = metaText.match(/Rise of Kingdoms\.\s*([A-Za-z]+),\s*([A-Za-z]+)\./);
  const rarity = rt ? RARITY[rt[1].toLowerCase()] || 'epique' : 'epique';
  const troops = rt ? TROOP[rt[2].toLowerCase()] || 'polyvalent' : 'polyvalent';

  const title = html.match(/<title>([^<]+): Best Pairings/);
  const name = title ? decodeHtml(title[1]).trim() : slug;

  const overviewMatch = html.match(/<p>([\s\S]*?is an? (?:legendary|epic|elite|advanced) commander[\s\S]*?)<\/p>/);
  const overview = overviewMatch ? stripTags(overviewMatch[1]) : '';
  const specMatch = overview.match(/with the ([^.]+) talent trees/);
  const specialities = specMatch
    ? specMatch[1].split(/,| and /).map((s) => TREE[s.trim()] || s.trim()).filter(Boolean)
    : [];
  const useMatch = overview.match(/Typical use:\s*([^.]+)\./);
  const usage = useMatch
    ? useMatch[1].split(/,| and /).map((s) => USE[s.trim().toLowerCase()] || null).filter(Boolean)
    : [];

  const tierMatch = html.match(/rated\s+(S\+|S|A\+|A|B\+|B|C\+|C|D)\s+overall/);
  const tier = tierMatch ? tierMatch[1].replace('+', '') : 'B';

  const buildMatch = html.match(/<div class="build"[^>]*>([\s\S]*?)<\/div>/);
  const build = buildMatch ? buildMatch[1] : '';
  const trees = [];
  const coreMatch = build.match(/<ul class="core">([\s\S]*?)<\/ul>/);
  if (coreMatch) {
    const groups = new Map();
    const liRegex = /<li><strong>(.*?)<\/strong>\s*\((\d+)\/(\d+)\)\s*<span class="muted">(.*?)<\/span><\/li>/g;
    let match;
    while ((match = liRegex.exec(coreMatch[1]))) {
      const nodeName = decodeHtml(match[1]).trim();
      const points = `${match[2]}/${match[3]}`;
      const treeRaw = decodeHtml(match[4]).trim();
      const tree = TREE[treeRaw] || treeRaw;
      if (!groups.has(tree)) groups.set(tree, []);
      groups.get(tree).push(`${nodeName} (${points})`);
    }
    for (const [tree, pathNodes] of groups) trees.push({ name: tree, path: pathNodes });
  }

  const skills = [];
  const skillHeaders = html.matchAll(/<div class="sk-h">([\s\S]*?)<\/div>/g);
  for (const header of skillHeaders) {
    const skillName = header[1].match(/<h3>(.*?)<\/h3>/);
    const tag = header[1].match(/<span class="tag">(.*?)<\/span>/);
    if (skillName) {
      skills.push({
        name: decodeHtml(skillName[1]).trim(),
        type: tag ? decodeHtml(tag[1]).trim() : ''
      });
    }
  }

  const pairMatch = html.match(/pair [^<]+ with:\s*([^<]+)\./);
  const pairingNames = pairMatch
    ? pairMatch[1].split(',').map((s) => s.replace(/\([^)]*\)/g, '').trim()).filter(Boolean)
    : [];

  const firstNode = trees[0]?.path?.[0] || '';
  const firstTalent = firstNode.replace(/\s*\(\d+\/\d+\)$/, '');

  const portraitMatch = html.match(/<figure class="cmd-fig"><img src="([^"]+)"/);
  const portrait = portraitMatch ? portraitMatch[1] : null;

  const grades = {};
  const tableMatch = html.match(/<table class="data">([\s\S]*?)<\/table>/);
  if (tableMatch) {
    const cells = [...tableMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
    if (cells.length >= 5) {
      grades.overall = cells[0];
      grades.field = cells[1];
      grades.rally = cells[2];
      grades.garrison = cells[3];
      grades.canyon = cells[4];
    }
  }

  const isGatherer = specialities.some((s) => /récolte|recolte/i.test(s));
  const gear = isGatherer ? GATHER_GEAR : (GEAR[troops] || GEAR.polyvalent);
  const skillOrder = makeSkillOrder(skills);

  return { slug, name, rarity, troops, specialities, usage, tier, trees, firstTalent, skills, pairingNames, overview, portrait, grades, gear, skillOrder };
}

function deriveRole(specialities, troops) {
  const s = specialities.map((x) => x.toLowerCase());
  if (s.includes('récolte') || s.includes('recolte')) return 'Récolte';
  if (s.includes('maintien de la paix')) return 'Farm barbares';
  if (s.includes('garnison') || s.includes('défense')) return 'Tank / garnison';
  if (s.includes('soutien')) return 'Soutien';
  if (s.includes('compétence')) return `Nuke ${troops}`;
  if (s.includes('attaque')) return `Dégâts ${troops}`;
  if (s.includes('mobilité')) return 'Coursier / mobilité';
  return 'Polyvalent';
}

async function main() {
  const raw = await readFile(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  const byId = new Map(data.commanders.map((c) => [c.id, c]));
  const byName = new Map();
  data.commanders.forEach((c) => byName.set(norm(c.name), c.id));

  const talentsRes = await fetch(`${BASE}/assets/data/talents.json`, { headers: { 'user-agent': UA } });
  const talentsData = talentsRes.ok ? await talentsRes.json() : { cmd: {} };

  const listHtml = await fetchText(`${BASE}/commanders/`);
  const slugs = [...new Set([...listHtml.matchAll(/href="\/commanders\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
  const selected = only ? [only] : (limit > 0 ? slugs.slice(0, limit) : slugs);
  console.log(`Commandants trouvés : ${slugs.length} | à traiter : ${selected.length}`);

  const stats = { updated: 0, created: 0, builds: 0, portraits: 0, errors: [] };

  for (let i = 0; i < selected.length; i += 1) {
    const slug = selected[i];
    try {
      const html = await fetchText(`${BASE}/commanders/${slug}/`);
      const parsed = parsePage(slug, html);

      const cmd = talentsData.cmd?.[slug];
      const officialBuild = cmd?.b?.[0] || null;
      const build = officialBuild
        ? { id: officialBuild.id, name: officialBuild.en, points: parseBuildPoints(officialBuild.t) }
        : null;
      const treeIds = cmd?.t || [];

      const dossier = await fetchRokStatsDossier(slug, parsed.name);
      const skillProfile = dossier ? buildSkillProfile(dossier) : null;
      const combat = skillProfile
        ? computeCombat(skillProfile, dossier?.talents?.trees || treeIds)
        : null;
      const officialPairings = (dossier?.pairings?.official || [])
        .map((p) => ({
          partner: p.partner?.slug || null,
          name: p.name || '',
          role: p.role || '',
          scenario: p.tags?.scenario || '',
          troop: p.tags?.troop || '',
          description: p.description || ''
        }))
        .filter((p) => p.partner);

      const alias = ALIASES[norm(parsed.name)];
      const existingId = (alias && byId.has(alias))
        ? alias
        : (byId.has(slug) ? slug : byName.get(norm(parsed.name)));
      let commander = existingId ? byId.get(existingId) : null;

      if (!commander) {
        commander = {
          id: slug,
          slug,
          name: parsed.name,
          rarity: parsed.rarity,
          troops: parsed.troops,
          specialities: parsed.specialities,
          role: deriveRole(parsed.specialities, parsed.troops),
          tier: parsed.tier,
          grades: parsed.grades,
          gear: parsed.gear,
          treeIds,
          build,
          skillProfile,
          combat,
          officialPairings,
          firstTalent: parsed.firstTalent,
          trees: parsed.trees,
          skillOrder: parsed.skillOrder,
          equipment: `Set ${parsed.troops} selon la troupe.`,
          notes: parsed.overview,
          pairings: [],
          usage: parsed.usage,
          skills: parsed.skills,
          source: 'rokbuilder.com',
          dataUpdatedAt: new Date().toISOString().slice(0, 10),
          verified: parsed.trees.length > 0
        };
        data.commanders.push(commander);
        byId.set(commander.id, commander);
        byName.set(norm(commander.name), commander.id);
        stats.created += 1;
      } else {
        commander.slug = slug;
        commander.rarity = parsed.rarity;
        commander.troops = parsed.troops;
        commander.specialities = parsed.specialities;
        commander.tier = parsed.tier;
        commander.grades = parsed.grades;
        commander.gear = parsed.gear;
        commander.treeIds = treeIds;
        commander.build = build;
        if (skillProfile) {
          commander.skillProfile = skillProfile;
          commander.combat = combat;
        }
        if (officialPairings.length) commander.officialPairings = officialPairings;
        commander.trees = parsed.trees;
        commander.firstTalent = parsed.firstTalent;
        commander.skills = parsed.skills;
        commander.skillOrder = parsed.skillOrder || commander.skillOrder;
        commander.source = 'rokbuilder.com';
        commander.dataUpdatedAt = new Date().toISOString().slice(0, 10);
        commander.verified = parsed.trees.length > 0;
        if (!commander.usage || commander.usage.length === 0) commander.usage = parsed.usage;
        if (!commander.notes) commander.notes = parsed.overview;
        stats.updated += 1;
      }

      if (parsed.trees.length > 0) stats.builds += 1;

      if (!dryRun && parsed.portrait) {
        const dest = path.join(ROOT, 'assets', 'img', `${commander.id}.webp`);
        try {
          const img = await fetch(BASE + parsed.portrait, { headers: { 'user-agent': UA } });
          if (img.ok) {
            await writeFile(dest, Buffer.from(await img.arrayBuffer()));
            stats.portraits += 1;
          }
        } catch (err) {
          stats.errors.push(`portrait ${commander.id}: ${err.message}`);
        }
      }

      // Pairings : noms -> ids
      const pairIds = parsed.pairingNames
        .map((n) => ALIASES[norm(n)] || byName.get(norm(n)))
        .filter((id, index, arr) => id && arr.indexOf(id) === index);
      if (pairIds.length > 0) commander.pairings = pairIds;

      process.stdout.write(`\r${i + 1}/${selected.length} ${slug}          `);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      stats.errors.push(`${slug}: ${err.message}`);
    }
  }

  console.log('');
  data.meta = {
    ...data.meta,
    version: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    updatedAt: new Date().toISOString().slice(0, 10),
    dataSource: 'rokbuilder.com',
    dataUpdatedAt: new Date().toISOString().slice(0, 10)
  };

  console.log(`Mis à jour : ${stats.updated} | créés : ${stats.created} | builds : ${stats.builds} | portraits : ${stats.portraits} | erreurs : ${stats.errors.length}`);
  stats.errors.slice(0, 10).forEach((e) => console.log(` - ${e}`));

  if (dryRun) {
    console.log('Mode --dry-run : fichiers non écrits.');
    if (only || limit === 1) {
      console.log(JSON.stringify(data.commanders.find((c) => c.id === (only || selected[0])), null, 2));
    }
    return;
  }

  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFile(JSON_PATH, json, 'utf8');
  await writeFile(JS_PATH, `window.ROK_DATA = ${json};\n`, 'utf8');
  console.log('Écrit : data/commanders.json et data/commanders.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
