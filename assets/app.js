(function () {
  'use strict';

  const STORAGE_KEY = 'rok-build-lab:owned-v1';
  const TIER_ORDER = { 'S+': 0, S: 1, A: 2, B: 3, C: 4, D: 5 };
  const RARITY_LABEL = { legendaire: 'Légendaire', epique: 'Épique', elite: 'Élite', avance: 'Avancé' };
  const TROOP_LABEL = { cavalerie: 'Cavalerie', infanterie: 'Infanterie', archers: 'Archers', polyvalent: 'Polyvalent', siege: 'Siège' };
  const USAGE_LABEL = { pvp: 'PvP', barbares: 'Barbares', forts: 'Forts', garnison: 'Garnison', ralliement: 'Ralliement', recolte: 'Récolte', xp: 'XP', utilitaire: 'Utilitaire' };
  const TROOP_MARCHES = ['cavalerie', 'infanterie', 'archers', 'polyvalent'];

  let DATA = window.ROK_DATA;
  let CONTENT = window.ROK_CONTENT || {};
  const TALENTS = window.ROK_TALENTS || null;
  let byId = new Map();
  let meta = {};

  const state = {
    owned: new Set(loadOwned()),
    query: '',
    rarity: 'all',
    troop: 'all',
    grade: 'all',
    sort: 'tier',
    onlyOwned: false,
    tab: 'collection',
    showUnknownCodes: false,
    layoutId: null,
    buildModes: {}
  };

  const $ = (sel) => document.querySelector(sel);

  const els = {
    versionChip: $('#versionChip'),
    refreshBtn: $('#refreshBtn'),
    statOwned: $('#statOwned'),
    statTotal: $('#statTotal'),
    statComps: $('#statComps'),
    search: $('#searchInput'),
    rarity: $('#rarityFilter'),
    troop: $('#troopFilter'),
    sort: $('#sortFilter'),
    grade: $('#gradeFilter'),
    ownedOnly: $('#ownedOnly'),
    clearBtn: $('#clearBtn'),
    catalogue: $('#catalogue'),
    catalogueEmpty: $('#catalogueEmpty'),
    builds: $('#builds'),
    buildsEmpty: $('#buildsEmpty'),
    comps: $('#comps'),
    compsEmpty: $('#compsEmpty'),
    codesMeta: $('#codesMeta'),
    codesList: $('#codesList'),
    codesEmpty: $('#codesEmpty'),
    showUnknownCodes: $('#showUnknownCodes'),
    copyAllCodes: $('#copyAllCodes'),
    offersNote: $('#offersNote'),
    offersTiers: $('#offersTiers'),
    offersPlans: $('#offersPlans'),
    offersAvoid: $('#offersAvoid'),
    techNote: $('#techNote'),
    techPaths: $('#techPaths'),
    layoutsNote: $('#layoutsNote'),
    layoutTabs: $('#layoutTabs'),
    layoutView: $('#layoutView'),
    footerVersion: $('#footerVersion'),
    footerDate: $('#footerDate'),
    toast: $('#toast')
  };

  /* ---------------- helpers ---------------- */

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadOwned() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveOwned() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.owned]));
    } catch (err) {
      /* storage may be unavailable */
    }
  }

  function hue(id) {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
    return h;
  }

  function initials(name) {
    const parts = String(name).replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
    const first = (parts[0] || '?')[0] || '?';
    const second = (parts[1] || '')[0] || '';
    return (first + second).toUpperCase();
  }

  function tierValue(c) {
    return TIER_ORDER[c.tier] ?? 9;
  }

  function sortByTier(list) {
    return [...list].sort((a, b) => tierValue(a) - tierValue(b) || a.name.localeCompare(b.name, 'fr'));
  }

  const GRADE_ORDER = { 'S+': 0, S: 1, 'A+': 2, A: 3, 'B+': 4, B: 5, 'C+': 6, C: 7, 'D+': 8, D: 9 };
  const RARITY_ORDER = { legendaire: 0, epique: 1, elite: 2, avance: 3 };

  function gradeValue(c) {
    const raw = c.grades?.overall;
    if (!raw) return 99;
    return GRADE_ORDER[String(raw).trim().toUpperCase()] ?? 99;
  }

  function gradeLetter(c) {
    const raw = String(c.grades?.overall || '').trim().toUpperCase();
    return raw.replace('+', '');
  }

  function sortCommanders(list) {
    const arr = [...list];
    const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
    const byTier = (a, b) => tierValue(a) - tierValue(b) || byName(a, b);
    switch (state.sort) {
      case 'name':
        return arr.sort(byName);
      case 'grade':
        return arr.sort((a, b) => gradeValue(a) - gradeValue(b) || byTier(a, b));
      case 'troop':
        return arr.sort((a, b) => (TROOP_LABEL[a.troops] || a.troops).localeCompare(TROOP_LABEL[b.troops] || b.troops, 'fr') || byTier(a, b));
      case 'rarity':
        return arr.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || byTier(a, b));
      case 'build':
        return arr.sort((a, b) => (a.build ? 0 : 1) - (b.build ? 0 : 1) || byTier(a, b));
      case 'owned':
        return arr.sort((a, b) => (state.owned.has(a.id) ? 0 : 1) - (state.owned.has(b.id) ? 0 : 1) || byTier(a, b));
      case 'tier':
      default:
        return arr.sort(byTier);
    }
  }

  function ownedCommanders() {
    return DATA.commanders.filter((c) => state.owned.has(c.id));
  }

  function portrait(c) {
    return `<div class="portrait" style="--hue:${hue(c.id)}">
      <img src="assets/img/${esc(c.id)}.webp" alt="" loading="lazy" onerror="this.remove()" />
      <span class="initials">${esc(initials(c.name))}</span>
    </div>`;
  }

  const ROLE_LABELS = {
    gatherer: 'Récolteur',
    support_gather: 'Soutien / récolte',
    peacekeeper: 'Farm barbares',
    peace_support: 'Farm + soutien',
    tank: 'Tank / garnison',
    support: 'Soutien',
    nuker: 'Nuke',
    damage: 'Dégâts',
    runner: 'Coursier / mobilité',
    rally: 'Rally / polyvalent',
    generic: 'Polyvalent'
  };

  function computeRoleKey(c) {
    const specs = (c.specialities || []).map((s) => s.toLowerCase());
    const has = (needle) => specs.some((s) => s.includes(needle));
    const gather = has('récolte') || has('recolte');
    const peace = has('maintien de la paix');
    const support = has('soutien');
    const garrison = has('garnison') || has('défense') || has('defense');
    const skill = has('compétence') || has('competence');
    const attack = has('attaque');
    const mobility = has('mobilité') || has('mobilite');
    const leadership = has('leadership') || has('conquête') || has('conquete');

    if (gather && support) return 'support_gather';
    if (gather) return 'gatherer';
    if (peace && support) return 'peace_support';
    if (peace) return 'peacekeeper';
    if (skill) return 'nuker';
    if (attack) return 'damage';
    if (garrison) return 'tank';
    if (support) return 'support';
    if (mobility) return ['elite', 'avance'].includes(c.rarity) ? 'runner' : 'damage';
    if (leadership) return 'rally';
    return 'generic';
  }

  function roleInfo(c) {
    const key = c.roleKey || computeRoleKey(c);
    let label = ROLE_LABELS[key] || key;
    const troop = (TROOP_LABEL[c.troops] || c.troops).toLowerCase();
    if (['nuker', 'damage'].includes(key) || (key === 'generic' && c.troops !== 'polyvalent')) {
      label += ' ' + troop;
    }
    return { key, label };
  }

  function troopTree(troop) {
    switch (troop) {
      case 'cavalerie':
        return { name: 'Cavalerie', path: ['Emblazoned Shield', 'Dragon Saber', 'Undying Fury', 'Charge'] };
      case 'archers':
        return { name: 'Archer', path: ['Venomous Sting', 'Phoenix-Tail Arrows', 'Whistling Arrows', 'Razor Sharp', 'Full Quiver'] };
      case 'infanterie':
        return { name: 'Infanterie', path: ['Call of the Pack', 'Double-Headed Axe', 'Hold the Line', 'Elite Soldiers'] };
      default:
        return { name: 'Attaque', path: ['Burning Blood', 'Effortless', 'Armored Joints'] };
    }
  }

  function autoBuild(c) {
    const { key } = roleInfo(c);
    const troop = TROOP_LABEL[c.troops] || c.troops;

    switch (key) {
      case 'gatherer':
        return {
          trees: [{ name: 'Récolte', path: ['Gathering Mastery (les 4 ressources)', 'The More The Better', 'Superior Tools', 'Armed Convoy', 'Modified Axle'] }],
          skillOrder: '5-5-1-1. Niveau 37 suffit.',
          equipment: 'Set Harvest.',
          notes: 'Gatherer : ne pas dépasser le palier de talents utile.'
        };
      case 'support_gather':
        return {
          trees: [
            { name: 'Récolte', path: ['Gathering Mastery (les 4 ressources)', 'The More The Better', 'Superior Tools'] },
            { name: 'Soutien', path: ['Burning Blood', 'Rejuvenate', 'Counterattack', 'Loose Formation'] }
          ],
          skillOrder: 'Comp 1 à 5 avant les étoiles. 5-1-1-1 minimum.',
          equipment: 'Set Harvest pour la récolte, sinon rien de dédié.',
          notes: 'Double usage : récolte et soutien en secondaire.'
        };
      case 'peacekeeper':
        return {
          trees: [
            { name: 'Maintien de la paix', path: ['Insight', 'Quick Study', 'Trophy Hunter', 'Thoroughbreds', 'Domination', 'Killer Instinct'] },
            { name: 'Compétence', path: ['Rejuvenate', 'Feral Nature'] }
          ],
          skillOrder: 'Comp 1 à 5, puis 2★. Viser Insight + dégâts barbares.',
          equipment: 'Aucun équipement dédié.',
          notes: 'Farm barbares/forts : AP réduit et XP augmentée.'
        };
      case 'peace_support':
        return {
          trees: [
            { name: 'Maintien de la paix', path: ['Insight', 'Quick Study', 'Trophy Hunter', 'Curing Chant'] },
            { name: 'Soutien', path: ['Burning Blood', 'Rejuvenate', 'Loose Formation'] }
          ],
          skillOrder: 'Comp 1 à 5, puis 2★.',
          equipment: 'Aucun.',
          notes: 'Farm + soutien : en principal pour l’XP, en secondaire pour les buffs.'
        };
      case 'tank':
        return {
          trees: [
            { name: 'Garnison', path: ['Nowhere to Turn', 'Impregnable', 'Adamantine Walls', 'City Guardian'] },
            { name: 'Infanterie', path: ['Call of the Pack', 'Double-Headed Axe', 'Hold the Line', 'Elite Soldiers'] }
          ],
          skillOrder: '5-5-1-1.',
          equipment: 'Set infanterie défense/santé.',
          notes: 'Tank de garnison : encaisse et protège la ville.'
        };
      case 'support':
        return {
          trees: [
            { name: 'Soutien', path: ['Burning Blood', 'Rejuvenate', 'Counterattack', 'Emergency Protection', 'Armored to the Teeth', 'Loose Formation'] },
            { name: 'Intégration', path: ['Hasty Departure', 'vitesse de marche'] }
          ],
          skillOrder: 'Comp 1 à 5 avant les étoiles. 5-1-1-1 minimum.',
          equipment: 'Aucun équipement dédié.',
          notes: 'Soutien : à jouer en secondaire derrière un nuker/tank.'
        };
      case 'nuker':
        return {
          trees: [
            { name: 'Compétence', path: ['Burning Blood', 'All For One', 'Rejuvenate', 'Heraldic Shield', 'Tactical Mastery', 'Feral Nature'] },
            troopTree(c.troops)
          ],
          skillOrder: 'Comp 1 à 5 avant les étoiles, puis 2★/4★. 5-1-1-1 minimum.',
          equipment: `Set ${troop.toLowerCase()} attaque.`,
          notes: 'Nuke : enchaîne les compétences. En secondaire, les talents ne comptent pas.'
        };
      case 'damage':
        return {
          trees: [
            troopTree(c.troops),
            { name: 'Attaque', path: ['Burning Blood', 'Effortless', 'Armored Joints', 'Unyielding'] }
          ],
          skillOrder: 'Comp 1 à 5 avant les étoiles. 5-1-1-1 minimum.',
          equipment: `Set ${troop.toLowerCase()} attaque.`,
          notes: 'Dégâts : bon en mêlée, à protéger des focus.'
        };
      case 'runner':
        return {
          trees: [
            { name: 'Mobilité', path: ['Lightning Charge', 'Hasty Departure', 'Swiftness', 'Time Management'] },
            { name: 'Cavalerie', path: ['Emblazoned Shield', 'Dragon Saber', 'Undying Fury'] }
          ],
          skillOrder: '5-5-1-1.',
          equipment: 'Aucun équipement dédié.',
          notes: 'Coursier : runes, objectifs, chasse aux gatherers. Pas un combattant.'
        };
      case 'rally':
        return {
          trees: [
            { name: 'Leadership', path: ['Hidden Wrath', 'Strategic Prowess', 'Close Formation', 'Name of the King'] },
            { name: 'Conquête', path: ['Entrenched', 'Meteor Shower'] }
          ],
          skillOrder: '5-5-1-1.',
          equipment: 'Set polyvalent.',
          notes: 'Rally lead : pour mener des rallys, pas pour l’open field.'
        };
      default:
        return {
          trees: [
            troopTree(c.troops),
            { name: 'Compétence', path: ['Burning Blood', 'Rejuvenate'] }
          ],
          skillOrder: '5-5-1-1.',
          equipment: `Set ${troop.toLowerCase()}.`,
          notes: 'Build polyvalent généré automatiquement.'
        };
    }
  }

  function buildFor(c) {
    const auto = autoBuild(c);
    if (!Array.isArray(c.trees) || c.trees.length === 0) {
      return {
        ...auto,
        skillOrder: c.skillOrder || auto.skillOrder,
        equipment: c.equipment || auto.equipment,
        notes: c.notes || auto.notes,
        generated: true
      };
    }
    return {
      trees: c.trees,
      skillOrder: c.skillOrder || auto.skillOrder,
      equipment: c.equipment || auto.equipment,
      notes: c.notes || auto.notes,
      generated: false
    };
  }

  const COMBAT_TAG_LABEL = {
    damage: 'Dégâts',
    aoe: 'AoE',
    heal: 'Soin',
    support: 'Soutien',
    debuff: 'Debuff',
    tank: 'Tank',
    rage: 'Rage',
    barbares: 'Barbares',
    garnison: 'Garnison'
  };

  const COMBAT_ROLE_LABEL = {
    damage: 'Dégâts',
    tank: 'Tank',
    support: 'Soutien',
    hybrid: 'Hybride',
    farming: 'Farm'
  };

  const BUILD_MODE_LABEL = {
    combat: 'PvP / combat',
    farm: 'Farm',
    barbares: 'Barbares',
    garrison: 'Garnison'
  };

  function combatTags(c, limit = 4) {
    const tags = combatOf(c).tags || [];
    return [...new Set(tags)]
      .filter((tag) => COMBAT_TAG_LABEL[tag])
      .slice(0, limit)
      .map((tag) => COMBAT_TAG_LABEL[tag]);
  }

  // Profil de combat calculé depuis les descriptions de compétences (data/commanders.json).
  // Fallback si le profil n'est pas encore disponible (anciennes données).
  function combatOf(c) {
    if (c.combat && typeof c.combat.damage === 'number') return c.combat;
    const role = roleInfo(c).key;
    const base = Math.max(2, 7 - tierValue(c));
    const damage = ['nuker', 'damage'].includes(role) ? base + 3 : (['archers', 'cavalerie'].includes(c.troops) ? base : 2);
    const tank = role === 'tank' ? base + 3 : (c.troops === 'infanterie' ? base : 1);
    const support = ['support', 'support_gather'].includes(role) ? base + 3 : 1;
    const utility = role === 'runner' ? 2 : 3;
    const combatRole = role === 'tank' ? 'tank' : ['support', 'support_gather'].includes(role) ? 'support' : ['nuker', 'damage'].includes(role) ? 'damage' : 'hybrid';
    return {
      damage,
      tank,
      support,
      utility,
      secondary: 0,
      role: combatRole,
      score: damage + tank * 0.9 + support * 0.8 + utility * 0.5,
      tags: [],
      summary: ''
    };
  }

  function vengeanceLineup() {
    const entries = ownedCommanders()
      .map((c) => ({ c, combat: combatOf(c) }))
      .filter((e) => e.combat.role !== 'farming');
    if (!entries.length) return { front: [], mid: [], back: [] };

    const used = new Set();
    const slots = { front: [], mid: [], back: [] };
    const total = () => slots.front.length + slots.mid.length + slots.back.length;

    const take = (filter, sort, target, max) => {
      const candidates = entries.filter((e) => !used.has(e.c.id) && filter(e)).sort(sort);
      for (const e of candidates) {
        if (target.length >= max) break;
        target.push(e.c);
        used.add(e.c.id);
      }
    };

    // Avant : tanks / infanterie, selon la résistance réelle (skills + arbre Défense/Garnison).
    take(
      (e) => roleInfo(e.c).key === 'tank' || e.c.troops === 'infanterie',
      (a, b) => b.combat.tank - a.combat.tank || b.combat.support - a.combat.support || b.combat.damage - a.combat.damage || tierValue(a.c) - tierValue(b.c),
      slots.front,
      2
    );

    // Milieu : soutien (buffs d'équipe, soins, debuffs).
    take(
      (e) => ['support', 'support_gather', 'peace_support'].includes(roleInfo(e.c).key) || e.combat.support >= 6,
      (a, b) => b.combat.support - a.combat.support || b.combat.utility - a.combat.utility || b.combat.damage - a.combat.damage || tierValue(a.c) - tierValue(b.c),
      slots.mid,
      1
    );

    // Arrière : dégâts, avec synergie de troupe pour le 2e slot.
    const backPool = entries
      .filter((e) => !used.has(e.c.id) && (['nuker', 'damage'].includes(roleInfo(e.c).key) || e.combat.role === 'damage' || (e.c.usage || []).includes('pvp')))
      .sort((a, b) => b.combat.damage - a.combat.damage || b.combat.utility - a.combat.utility || tierValue(a.c) - tierValue(b.c));
    const firstBack = backPool[0];
    if (firstBack) {
      slots.back.push(firstBack.c);
      used.add(firstBack.c.id);
      const secondBack = backPool
        .filter((e) => !used.has(e.c.id))
        .sort((a, b) => {
          const scoreA = a.combat.damage + (a.c.troops === firstBack.c.troops ? 1.5 : 0) + officialSynergy(firstBack.c, a.c, 'pvp');
          const scoreB = b.combat.damage + (b.c.troops === firstBack.c.troops ? 1.5 : 0) + officialSynergy(firstBack.c, b.c, 'pvp');
          return scoreB - scoreA || tierValue(a.c) - tierValue(b.c);
        })[0];
      if (secondBack) {
        used.add(secondBack.c.id);
        const [a, b] = orderPair(firstBack.c, secondBack.c);
        slots.back = [a, b];
      }
    }

    // Compléter avec les meilleurs profils de combat restants.
    const remaining = entries
      .filter((e) => !used.has(e.c.id))
      .sort((a, b) => b.combat.score - a.combat.score || tierValue(a.c) - tierValue(b.c) || a.c.name.localeCompare(b.c.name, 'fr'));
    for (const e of remaining) {
      if (total() >= 5) break;
      let target = null;
      if (slots.back.length < 2) target = slots.back;
      else if (slots.front.length < 2) target = slots.front;
      else if (slots.mid.length < 1) target = slots.mid;
      if (!target) break;
      target.push(e.c);
      used.add(e.c.id);
    }
    return slots;
  }

  function badges(c) {
    const tierClass = ['C', 'D'].includes(c.tier) ? ' low' : '';
    const overall = c.grades?.overall;
    return `
      <span class="badge badge-${esc(c.rarity)}">${esc(RARITY_LABEL[c.rarity] || c.rarity)}</span>
      <span class="badge badge-troop">${esc(TROOP_LABEL[c.troops] || c.troops)}</span>
      <span class="badge badge-tier${tierClass}">${esc(c.tier)}</span>
      ${overall ? `<span class="badge badge-grade" title="Grade global">${esc(overall)}</span>` : ''}
    `;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  /* ---------------- rendering ---------------- */

  function renderVersion() {
    const version = meta.version || '—';
    els.versionChip.textContent = `v${version}`;
    els.footerVersion.textContent = `v${version}`;
    els.footerDate.textContent = meta.updatedAt ? `mise à jour du ${meta.updatedAt}` : '';
  }

  function renderStats() {
    els.statOwned.textContent = String(state.owned.size);
    els.statTotal.textContent = String(DATA.commanders.length);
    els.statComps.textContent = String(countComps());
  }

  function filteredCommanders() {
    const q = state.query.trim().toLowerCase();
    return DATA.commanders.filter((c) => {
      if (state.onlyOwned && !state.owned.has(c.id)) return false;
      if (state.rarity !== 'all' && c.rarity !== state.rarity) return false;
      if (state.troop !== 'all' && c.troops !== state.troop) return false;
      if (state.grade !== 'all' && gradeLetter(c) !== state.grade) return false;
      if (!q) return true;
      const haystack = [c.name, c.role, roleInfo(c).label, c.tier, c.grades?.overall, ...(c.specialities || []), TROOP_LABEL[c.troops] || '', RARITY_LABEL[c.rarity] || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function renderCatalogue() {
    const list = sortCommanders(filteredCommanders());
    els.catalogue.innerHTML = list
      .map((c) => {
        const owned = state.owned.has(c.id);
        return `
          <article class="cmd-card${owned ? ' is-owned' : ''}" data-id="${esc(c.id)}">
            ${portrait(c)}
            <div class="cmd-meta">
              <h3 title="${esc(c.name)}">${esc(c.name)}</h3>
              <p class="role" title="${esc(c.role || '')}">${esc(roleInfo(c).label)}</p>
              <div class="badges">${badges(c)}</div>
            </div>
            <label class="pick" title="${owned ? 'Retirer de ma collection' : 'Ajouter à ma collection'}">
              <input type="checkbox" data-id="${esc(c.id)}" ${owned ? 'checked' : ''} aria-label="${esc(c.name)}" />
              <span class="check"></span>
            </label>
          </article>`;
      })
      .join('');
    els.catalogueEmpty.hidden = list.length > 0;
  }

  const TREE_NAME_TO_ID = {
    'Infanterie': 1,
    'Archers': 2,
    'Archer': 2,
    'Cavalerie': 3,
    'Intégration': 4,
    'Leadership': 5,
    'Conquête': 6,
    'Garnison': 7,
    'Maintien de la paix': 8,
    'Récolte': 9,
    'Polyvalence': 10,
    'Compétence': 11,
    'Attaque': 12,
    'Défense': 13,
    'Soutien': 14,
    'Mobilité': 15,
    'Siège': 16,
    'Engineering': 16,
    'Smite': 17,
    'Combo': 18
  };

  let NODE_BY_ID = null;
  let OFFICIAL_BY_TREESET = null;
  let OFFICIAL_BY_TREE = null;

  function getNodeMap() {
    if (NODE_BY_ID) return NODE_BY_ID;
    NODE_BY_ID = new Map();
    for (const [treeId, tree] of Object.entries(TALENTS?.layout?.trees || {})) {
      for (const [id, node] of Object.entries(tree.nodes || {})) {
        NODE_BY_ID.set(String(id), { ...node, id: String(id), treeId: String(treeId) });
      }
    }
    return NODE_BY_ID;
  }

  // Arbres réels du commandant (les arbres sont universels, seul le chemin change).
  function commanderTreeIds(c) {
    if (c.treeIds && c.treeIds.length) return c.treeIds.slice(0, 3).map(String);
    const ids = (c.specialities || [])
      .map((s) => TREE_NAME_TO_ID[String(s).trim()])
      .filter(Boolean);
    return [...new Set(ids)].slice(0, 3).map(String);
  }

  function getOfficialIndexes() {
    if (OFFICIAL_BY_TREESET) return;
    OFFICIAL_BY_TREESET = new Map();
    OFFICIAL_BY_TREE = new Map();
    (DATA.commanders || []).forEach((c) => {
      if (!c.build || !c.build.points || !(c.treeIds || []).length) return;
      const key = c.treeIds.map(String).sort().join('-');
      if (!OFFICIAL_BY_TREESET.has(key)) OFFICIAL_BY_TREESET.set(key, []);
      OFFICIAL_BY_TREESET.get(key).push(c);
      c.treeIds.forEach((rawId) => {
        const id = String(rawId);
        if (!OFFICIAL_BY_TREE.has(id)) OFFICIAL_BY_TREE.set(id, []);
        OFFICIAL_BY_TREE.get(id).push(c);
      });
    });
  }

  function donorScore(target, donor) {
    let score = 0;
    if (donor.troops === target.troops) score += 4;
    if (roleInfo(donor).key === roleInfo(target).key) score += 3;
    const targetRole = combatOf(target).role;
    const donorRole = combatOf(donor).role;
    if (targetRole && donorRole && targetRole === donorRole) score += 6;
    else if (targetRole === 'tank' && donorRole === 'support') score += 3;
    const usage = target.usage || [];
    if ((donor.usage || []).some((u) => usage.includes(u))) score += 1;
    return score;
  }

  function donorTreePoints(donor, treeId) {
    const nodes = TALENTS.layout?.trees?.[treeId]?.nodes || {};
    const out = {};
    Object.entries(donor.build.points || {}).forEach(([id, value]) => {
      if (nodes[id]) out[id] = value;
    });
    return out;
  }

  function requiredNodes(points) {
    const required = new Set();
    const nodeMap = getNodeMap();
    Object.keys(points).forEach((id) => {
      const node = nodeMap.get(id);
      if (!node) return;
      const walk = (pre) => {
        (pre || []).forEach((rawId) => {
          const parentId = String(rawId);
          if (points[parentId] !== undefined) required.add(parentId);
          const parent = nodeMap.get(parentId);
          if (parent) walk(parent.pre);
        });
      };
      walk(node.pre);
    });
    return required;
  }

  function trimPoints(points, budget) {
    const nodeMap = getNodeMap();
    const total = () => Object.values(points).reduce((sum, value) => sum + Number(value || 0), 0);
    let guard = 0;
    while (total() > budget && guard < 200) {
      guard += 1;
      const required = requiredNodes(points);
      const leaves = Object.keys(points).filter((id) => !required.has(id));
      if (!leaves.length) break;
      leaves.sort((a, b) => {
        const na = nodeMap.get(a) || {};
        const nb = nodeMap.get(b) || {};
        return (na.big ? 1 : 0) - (nb.big ? 1 : 0) || Number(points[a]) - Number(points[b]);
      });
      delete points[leaves[0]];
    }
    return points;
  }

  function modeScore(donor, mode) {
    const usage = donor.usage || [];
    const has = (u) => usage.includes(u);
    if (mode === 'farm') return (has('recolte') ? 10 : 0) - (has('pvp') ? 3 : 0);
    if (mode === 'barbares') {
      return (has('barbares') ? 8 : 0) + (has('forts') ? 3 : 0) - (has('pvp') ? 2 : 0) - (has('recolte') ? 4 : 0);
    }
    if (mode === 'garrison') return (has('garnison') ? 10 : 0) - (has('recolte') ? 4 : 0);
    return (has('pvp') ? 10 : 0) + (has('barbares') ? 1 : 0) + (has('garnison') ? 1 : 0) - (has('recolte') ? 6 : 0);
  }

  function treesForMode(c, mode) {
    const all = commanderTreeIds(c);
    const drawable = all.filter((id) => TALENTS.layout?.trees?.[id]);
    const base = drawable.length ? drawable : all;
    let filtered = base;
    if (mode === 'combat') filtered = base.filter((id) => !['8', '9'].includes(id));
    else if (mode === 'barbares') filtered = base.filter((id) => id !== '9');
    else if (mode === 'garrison') filtered = base.filter((id) => !['8', '9'].includes(id));
    if (!filtered.length) filtered = base;
    const preferred = mode === 'farm' ? ['9'] : mode === 'barbares' ? ['8'] : mode === 'garrison' ? ['7', '13'] : [];
    filtered = [...filtered].sort((a, b) => (preferred.includes(a) ? 0 : 1) - (preferred.includes(b) ? 0 : 1));
    return filtered.slice(0, 3);
  }

  function donorTreeWeight(donor, treeId) {
    const nodes = TALENTS.layout?.trees?.[treeId]?.nodes || {};
    return Object.keys(donor.build.points || {}).reduce(
      (sum, id) => sum + (nodes[id] ? Number(donor.build.points[id] || 0) : 0),
      0
    );
  }

  function bestModeDonor(target, donors, treeId, mode) {
    if (!donors || !donors.length) return null;
    const withPoints = donors.filter((donor) => donorTreeWeight(donor, treeId) > 0);
    const pool = withPoints.length ? withPoints : donors;
    return [...pool].sort((a, b) => {
      const scoreA = modeScore(a, mode) * 10 + donorTreeWeight(a, treeId) + donorScore(target, a);
      const scoreB = modeScore(b, mode) * 10 + donorTreeWeight(b, treeId) + donorScore(target, b);
      return scoreB - scoreA;
    })[0];
  }

  function defaultBuildMode(c) {
    const usage = c.usage || [];
    const has = (u) => usage.includes(u);
    const trees = (c.treeIds || []).map(Number);
    if (has('pvp')) return 'combat';
    if (has('garnison') && trees.includes(7)) return 'garrison';
    if (has('barbares') || has('forts') || has('xp')) return 'barbares';
    if (has('recolte')) return 'farm';
    if (combatOf(c).role === 'farming') return 'farm';
    return 'combat';
  }

  function availableBuildModes(c) {
    const usage = c.usage || [];
    const trees = (c.treeIds || []).map(Number);
    const modes = ['combat'];
    if (usage.includes('recolte') || trees.includes(9)) modes.push('farm');
    if (usage.includes('barbares') || usage.includes('forts') || usage.includes('xp') || trees.includes(8)) modes.push('barbares');
    if (usage.includes('garnison') || trees.includes(7)) modes.push('garrison');
    return modes;
  }

  // Chemin conseillé pour un commandant sans build officiel : on réutilise les
  // chemins de builds officiels qui partagent les arbres, en filtrant selon le
  // mode (PvP / farm / barbares / garnison) pour ne pas coller un build récolte
  // sur un commandant de combat.
  function generatedTalentPlan(c, mode = 'combat') {
    if (!TALENTS) return null;
    getOfficialIndexes();
    const baseTrees = commanderTreeIds(c);
    if (!baseTrees.length) return null;
    const treeIds = treesForMode(c, mode);
    const points = {};
    const targetRole = combatOf(c).role;
    const allDrawable = baseTrees.every((id) => TALENTS.layout?.trees?.[id]);

    const key = [...baseTrees].sort().join('-');
    const exact = OFFICIAL_BY_TREESET.get(key);
    const exactDonor = exact && allDrawable && exact.some((d) => {
      if (modeScore(d, mode) < 8) return false;
      if (mode !== 'combat') return true;
      const donorRole = combatOf(d).role;
      return donorRole === targetRole || (targetRole === 'tank' && donorRole === 'support');
    })
      ? bestModeDonor(c, exact, treeIds[0], mode)
      : null;

    if (exactDonor) {
      Object.assign(points, exactDonor.build.points);
      if (mode === 'combat') {
        const nodeMap = getNodeMap();
        Object.keys(points).forEach((id) => {
          const treeId = nodeMap.get(id)?.treeId;
          if (treeId && ['8', '9'].includes(treeId)) delete points[id];
        });
      }
    } else {
      treeIds.forEach((treeId) => {
        const donor = bestModeDonor(c, OFFICIAL_BY_TREE.get(treeId) || [], treeId, mode);
        if (donor) Object.assign(points, donorTreePoints(donor, treeId));
      });
    }

    trimPoints(points, 74);

    const ancestors = new Set();
    const nodeMap = getNodeMap();
    Object.keys(points).forEach((id) => {
      const node = nodeMap.get(id);
      if (!node) return;
      const walk = (pre) => {
        (pre || []).forEach((rawId) => {
          const parentId = String(rawId);
          const parent = nodeMap.get(parentId);
          if (!parent) return;
          if (points[parentId] === undefined) ancestors.add(parentId);
          walk(parent.pre);
        });
      };
      walk(node.pre);
    });

    return { treeIds, points, ancestors, generated: true, mode };
  }

  function renderTalentTree(c, mode = 'combat') {
    if (!TALENTS) return '';

    let treeIds;
    let points;
    let ancestors = new Set();
    let buildName;
    let generated = false;

    if (c.build && c.build.points && (c.treeIds || []).length) {
      treeIds = c.treeIds.slice(0, 3).map(String);
      points = c.build.points;
      buildName = c.build.name || 'Build officiel';
    } else {
      const plan = generatedTalentPlan(c, mode);
      if (!plan) return '';
      treeIds = plan.treeIds.slice(0, 3);
      points = plan.points;
      ancestors = plan.ancestors;
      buildName = `Chemin conseillé · ${BUILD_MODE_LABEL[mode] || mode}`;
      generated = true;
    }

    const parts = [];
    const treeStats = [];

    for (const treeId of treeIds) {
      const layoutTree = TALENTS.layout?.trees?.[treeId];
      const talentTree = TALENTS.talents?.trees?.[treeId];
      if (!layoutTree || !layoutTree.nodes || !talentTree || !talentTree.n) continue;

      const infoById = new Map();
      talentTree.n.forEach((row) => infoById.set(String(row[0]), { name: row[1], max: row[5] }));

      const nodes = Object.entries(layoutTree.nodes).map(([id, node]) => {
        const info = infoById.get(String(id)) || { name: `Nœud ${id}`, max: 5 };
        return {
          id,
          x: Number(node.x),
          y: Number(node.y),
          big: Boolean(node.big),
          pre: (node.pre || []).map(String),
          name: info.name,
          max: info.max
        };
      });

      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs) - 7;
      const maxX = Math.max(...xs) + 7;
      const minY = Math.min(...ys) - 7;
      const maxY = Math.max(...ys) + 7;
      const width = maxX - minX;
      const height = maxY - minY;

      const pos = new Map(nodes.map((n) => [n.id, { x: n.x - minX, y: n.y - minY }]));

      const edges = [];
      nodes.forEach((node) => {
        const child = pos.get(node.id);
        node.pre.forEach((parentId) => {
          const parent = pos.get(parentId);
          if (parent) {
            edges.push(`<line x1="${parent.x.toFixed(2)}" y1="${parent.y.toFixed(2)}" x2="${child.x.toFixed(2)}" y2="${child.y.toFixed(2)}"></line>`);
          }
        });
      });

      const circles = nodes.map((node) => {
        const p = pos.get(node.id);
        const selected = points[node.id] !== undefined;
        const isPath = ancestors.has(node.id);
        const radius = node.big ? 3.2 : 1.9;
        const fill = selected ? '#e7b75f' : isPath ? '#6b5834' : '#252c3d';
        const stroke = selected ? '#f2d79b' : isPath ? '#8a6f3f' : '#3a4258';
        const label = selected
          ? `${node.name} — ${points[node.id]}/${node.max}`
          : isPath
            ? `${node.name} — prérequis`
            : node.name;
        return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"><title>${esc(label)}</title></circle>`;
      });
      const selectedCount = nodes.filter((node) => points[node.id] !== undefined).length;
      const totalPoints = nodes.reduce((sum, node) => sum + (points[node.id] !== undefined ? Number(points[node.id]) : 0), 0);
      if (selectedCount === 0) continue;
      treeStats.push({ name: talentTree.en || `Arbre ${treeId}`, total: totalPoints, count: selectedCount });

      parts.push(`
        <div class="tt-tree">
          <div class="tt-title">${esc(talentTree.en || `Arbre ${treeId}`)}</div>
          <svg class="tt-svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Arbre de talents ${esc(talentTree.en || treeId)}">
            <g class="tt-edges">${edges.join('')}</g>
            <g class="tt-nodes">${circles.join('')}</g>
          </svg>
        </div>`);
    }

    if (!parts.length) return '';

    return `
      <div class="tt-wrap">
        <div class="tt-head">
          <span class="tt-build">${esc(buildName)}</span>
          <span class="tt-hint">${generated ? 'Nœuds dorés = chemin conseillé · bruns = prérequis' : 'Nœuds dorés = talents du build officiel'}</span>
        </div>
        <div class="tt-summary">${treeStats.map((stat) => `<span>${esc(stat.name)} <b>${stat.total}</b></span>`).join('<span class="sep">·</span>')}</div>
        <div class="tt-grid">${parts.join('')}</div>
      </div>`;
  }

  function renderGrades(c) {
    const g = c.grades;
    if (!g) return '';
    return [
      ['Global', g.overall],
      ['Champ', g.field],
      ['Rally', g.rally],
      ['Garnison', g.garrison],
      ['Canyon', g.canyon]
    ]
      .filter(([, value]) => value && value !== 'n/a')
      .map(([label, value]) => `<span class="tag grade">${esc(label)} <b>${esc(value)}</b></span>`)
      .join('');
  }

  function treeHtml(tree) {
    const path = (tree.path || [])
      .map((node, i) => `${i > 0 ? '<span class="arrow">→</span>' : ''}<span class="node">${esc(node)}</span>`)
      .join('');
    return `
      <div class="tree">
        <h4>Arbre · ${esc(tree.name)}</h4>
        <div class="path">${path}</div>
      </div>`;
  }

  function buildCard(c, coreSet) {
    const role = roleInfo(c);
    const build = buildFor(c);
    const isCore = Boolean(coreSet && coreSet.has(c.id));
    const combat = combatOf(c);
    const combatTagList = combatTags(c, 6);
    const mode = c.build ? 'combat' : (state.buildModes[c.id] || defaultBuildMode(c));
    const modeButtons = c.build ? '' : `
      <div class="build-mode">
        <span>Talents :</span>
        ${availableBuildModes(c).map((key) => `
          <button type="button" class="tag ${mode === key ? 'ok' : ''}" data-build-mode="${key}" data-id="${esc(c.id)}">${esc(BUILD_MODE_LABEL[key] || key)}</button>`).join('')}
      </div>`;

    const partners = (c.pairings || []).map((id) => {
      const partner = byId.get(id);
      if (!partner) return '';
      const ok = state.owned.has(id);
      return `<span class="tag ${ok ? 'ok' : 'miss'}">${ok ? '✓ ' : ''}${esc(partner.name)}</span>`;
    }).join('');

    const usage = (c.usage || [])
      .map((u) => `<span class="tag">${esc(USAGE_LABEL[u] || u)}</span>`)
      .join('');

    const skills = (c.skills || [])
      .map((s) => `<span class="tag">${esc(s.name)}${s.type ? ' · ' + esc(s.type) : ''}</span>`)
      .join('');

    const gearList = (c.gear && c.gear.length) ? c.gear : null;

    const sourceNote = build.generated
      ? `<p class="unverified">⚙️ Chemin généré (${esc(BUILD_MODE_LABEL[mode] || mode)}) à partir des builds officiels qui partagent ces arbres.</p>`
      : (c.verified
        ? ''
        : '<p class="unverified">⚠ Recommandation générique par rôle — à confirmer selon ta version du jeu.</p>');

    return `
      <article class="build-card">
        <header class="build-head">
          ${portrait(c)}
          <div class="build-title">
            <h3>${esc(c.name)}</h3>
            <p>${esc(c.role || role.label)} · ${esc(RARITY_LABEL[c.rarity] || c.rarity)} · ${esc(TROOP_LABEL[c.troops] || c.troops)}</p>
            <div class="badges">${badges(c)}<span class="badge badge-role">Rôle : ${esc(role.label)}</span></div>
            ${renderGrades(c) ? `<div class="chips grades">${renderGrades(c)}</div>` : ''}
          </div>
          <div class="build-first">
            <small>1er talent</small>
            <strong>${esc(c.firstTalent || '—')}</strong>
          </div>
        </header>
        <div class="build-body">
          ${isCore ? '<div class="invest-banner yes"><strong>✅ Noyau prioritaire</strong><span>Farm / PvP / Vengeance : concentre tes sculptures et tes ressources ici.</span></div>' : ''}
          ${modeButtons}
          ${renderTalentTree(c, mode) || `<div class="build-grid">${build.trees.map(treeHtml).join('')}</div>`}
          <div class="build-grid">
            <div class="kv"><small>Ordre des compétences</small><p>${esc(build.skillOrder || '—')}</p></div>
            <div class="kv"><small>Équipement recommandé (à farmer)</small>${gearList ? `<div class="chips">${gearList.map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : `<p>${esc(build.equipment || '—')}</p>`}</div>
          </div>
          <div class="kv"><small>Profil de combat (analyse des compétences)</small>
            <div class="chips">
              <span class="tag ok">${esc(COMBAT_ROLE_LABEL[combat.role] || combat.role)}</span>
              ${combatTagList.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}
            </div>
            ${c.skillProfile?.summary ? `<p class="muted">${esc(c.skillProfile.summary)}</p>` : ''}
          </div>
          <div class="kv"><small>À savoir</small><p>${esc(build.notes || '—')}</p></div>
          <div class="kv"><small>Compétences</small><div class="chips">${skills || '<span class="tag miss">—</span>'}</div></div>
          <div class="build-grid">
            <div class="kv"><small>Partenaires</small><div class="chips">${partners || '<span class="tag miss">—</span>'}</div></div>
            <div class="kv"><small>Usage</small><div class="chips">${usage || '<span class="tag miss">—</span>'}</div></div>
          </div>
          ${sourceNote}
        </div>
      </article>`;
  }

  function coreRoster() {
    const picks = new Map();
    const add = (c, tag, reason) => {
      if (!c) return;
      if (!picks.has(c.id)) picks.set(c.id, { c, tags: new Set(), reasons: new Set() });
      const entry = picks.get(c.id);
      entry.tags.add(tag);
      if (reason) entry.reasons.add(reason);
    };

    const farm = bestFarmMarch();
    if (farm) add(farm.a, 'Farm', 'Meilleure récolteuse de ta collection.');

    const pvp = bestPvPMarch();
    if (pvp) {
      add(pvp.a, 'PvP', 'Cœur de ta meilleure marche PvP.');
      add(pvp.b, 'PvP', 'Secondaire de ta meilleure marche PvP.');
    }

    const v = vengeanceLineup();
    [...v.front, ...v.mid, ...v.back].forEach((c) => {
      add(c, 'Vengeance', 'Sélectionné pour ton board Path of Vengeance.');
    });

    // Il faut au moins 5 commandants pour couvrir farm + PvP + vengeance.
    for (const c of sortByTier(ownedCommanders())) {
      if (picks.size >= 5) break;
      add(c, 'Noyau', 'Complète ton noyau prioritaire.');
    }

    const rank = (entry) => {
      if (entry.tags.has('PvP')) return 0;
      if (entry.tags.has('Vengeance')) return 1;
      if (entry.tags.has('Farm')) return 2;
      return 3;
    };

    return [...picks.values()].sort((a, b) =>
      rank(a) - rank(b) ||
      tierValue(a.c) - tierValue(b.c) ||
      gradeValue(a.c) - gradeValue(b.c) ||
      a.c.name.localeCompare(b.c.name, 'fr')
    );
  }

  function renderBuilds() {
    const owned = sortByTier(ownedCommanders());
    if (!owned.length) {
      els.builds.innerHTML = '';
      els.buildsEmpty.hidden = false;
      return;
    }

    const core = coreRoster();
    const coreSet = new Set(core.map((entry) => entry.c.id));

    const summary = `
      <article class="comp-card invest-summary">
        <h3>Qui améliorer ?</h3>
        <p>Ton noyau prioritaire : un nombre limité de commandants à monter, choisis pour couvrir le farm, le PvP et le Path of Vengeance.</p>
        <ol class="invest-list">
          ${core.map((entry, index) => `
            <li class="invest-item">
              <span class="invest-rank">${index + 1}</span>
              ${portrait(entry.c)}
              <div class="invest-who">
                <span class="who">${esc(entry.c.name)}</span>
                <span class="role">${esc(roleInfo(entry.c).label)} · ${esc(TROOP_LABEL[entry.c.troops] || entry.c.troops)} · ${esc(RARITY_LABEL[entry.c.rarity] || entry.c.rarity)} · Tier ${esc(entry.c.tier)}</span>
                <span class="invest-why">${esc([...entry.reasons].join(' · '))}</span>
              </div>
              <div class="chips">
                <span class="tag ok">${esc(COMBAT_ROLE_LABEL[combatOf(entry.c).role] || combatOf(entry.c).role)}</span>
                ${[...entry.tags].map((tag) => `<span class="tag ${tag === 'PvP' ? 'ok' : ''}">${esc(tag)}</span>`).join('')}
              </div>
            </li>`).join('')}
        </ol>
        <p class="invest-note">Le reste peut attendre : garde tes sculptures et tes ressources pour ce noyau. Les légendaires coûtent plus cher à maxer que les épiques — la rareté est indiquée pour t’aider à arbitrer.</p>
      </article>`;

    const sorted = [...owned].sort((a, b) => {
      const ra = coreSet.has(a.id) ? 0 : 1;
      const rb = coreSet.has(b.id) ? 0 : 1;
      return ra - rb || tierValue(a) - tierValue(b) || a.name.localeCompare(b.name, 'fr');
    });

    els.builds.innerHTML = summary + sorted.map((c) => buildCard(c, coreSet)).join('');
    els.buildsEmpty.hidden = true;
  }

  function countComps() {
    return duoList().length + marchList().length;
  }

  function duoList() {
    const seen = new Set();
    const out = [];
    ownedCommanders().forEach((c) => {
      (c.pairings || []).forEach((partnerId) => {
        if (!state.owned.has(partnerId)) return;
        const key = [c.id, partnerId].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const partner = byId.get(partnerId);
        if (!partner) return;
        out.push({ a: c, b: partner });
      });
    });
    return out.sort((x, y) => tierValue(x.a) - tierValue(y.a) || x.a.name.localeCompare(y.a.name, 'fr'));
  }

  const PVP_PRIMARY_ROLES = ['nuker', 'damage', 'tank', 'rally'];
  const SUPPORT_ROLES = ['support', 'support_gather', 'peace_support'];

  function primaryCombatScore(c) {
    const combat = combatOf(c);
    return combat.damage + combat.tank * 0.5 + combat.utility * 0.3;
  }

  function secondaryCombatScore(c, troop) {
    const combat = combatOf(c);
    return combat.damage * 0.7 + combat.support * 0.9 + combat.utility * 0.4 +
      (combat.secondary || 0) +
      (c.troops === troop ? 1.5 : 0) +
      (SUPPORT_ROLES.includes(roleInfo(c).key) ? 1 : 0);
  }

  const SCENARIO_MATCH = {
    pvp: ['field'],
    field: ['field'],
    barbares: ['peacekeeping'],
    farm: ['gathering'],
    garnison: ['garrison']
  };

  function officialPairing(a, b) {
    return (a.officialPairings || []).find((p) => p.partner === b.id) ||
      (b.officialPairings || []).find((p) => p.partner === a.id) ||
      null;
  }

  function officialSynergy(a, b, scenario) {
    const pair = officialPairing(a, b);
    if (!pair) return 0;
    let bonus = 2;
    const wanted = (SCENARIO_MATCH[scenario] || []).map((s) => s.toLowerCase());
    if (pair.scenario && wanted.includes(pair.scenario.toLowerCase())) bonus += 8;
    return bonus;
  }

  // Respecte le rôle primary/secondary recommandé par la synergie officielle.
  function orderPair(a, b) {
    const pair = officialPairing(a, b);
    if (pair && pair.role === 'secondary') {
      const reverse = (b.officialPairings || []).find((p) => p.partner === a.id);
      if (reverse && reverse.role === 'primary') return [b, a];
    }
    return [a, b];
  }

  function bestFarmMarch() {
    const pool = ownedCommanders().filter(
      (c) => (c.usage || []).includes('recolte') || ['gatherer', 'support_gather'].includes(roleInfo(c).key)
    );
    if (!pool.length) return null;
    const dedicated = pool.filter((c) => ['gatherer', 'support_gather'].includes(roleInfo(c).key));
    const main = sortByTier(dedicated.length ? dedicated : pool)[0];
    return { kind: 'farm', troop: main.troops, a: main, b: null };
  }

  function barbarianScore(c) {
    const combat = combatOf(c);
    let score = combat.damage + combat.utility * 0.5 + combat.tank * 0.3;
    score += (c.skillProfile?.barbarianBonus || 0) / 5;
    if ((c.treeIds || []).map(Number).includes(8)) score += 4;
    if ((c.usage || []).includes('barbares')) score += 3;
    if ((c.usage || []).includes('forts')) score += 1;
    if (['peacekeeper', 'peace_support'].includes(roleInfo(c).key)) score += 2;
    return score;
  }

  function bestBarbarianMarch() {
    const pool = ownedCommanders().filter((c) => {
      const usage = c.usage || [];
      return usage.includes('barbares') || usage.includes('forts') ||
        (c.treeIds || []).map(Number).includes(8) ||
        ['peacekeeper', 'peace_support'].includes(roleInfo(c).key);
    });
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => barbarianScore(b) - barbarianScore(a) || tierValue(a) - tierValue(b));
    const main = sorted[0];
    const second = [...sorted.slice(1)]
      .sort((a, b) => {
        const scoreA = barbarianScore(a) + officialSynergy(main, a, 'barbares');
        const scoreB = barbarianScore(b) + officialSynergy(main, b, 'barbares');
        return scoreB - scoreA || tierValue(a) - tierValue(b);
      })[0] || null;
    const [a, b] = second ? orderPair(main, second) : [main, null];
    return { kind: 'barbares', troop: a.troops, a, b };
  }

  function bestPvPMarch() {
    const pool = ownedCommanders().filter((c) => (c.usage || []).includes('pvp'));
    if (pool.length < 2) return null;

    let best = null;
    ['infanterie', 'cavalerie', 'archers'].forEach((troop) => {
      let primaries = pool.filter((c) => c.troops === troop && PVP_PRIMARY_ROLES.includes(roleInfo(c).key));
      if (!primaries.length) primaries = pool.filter((c) => c.troops === troop);
      if (!primaries.length) return;
      const primary = [...primaries].sort((a, b) => primaryCombatScore(b) - primaryCombatScore(a) || tierValue(a) - tierValue(b))[0];
      const secondaries = pool.filter((c) => c.id !== primary.id && (
        c.troops === troop ||
        c.troops === 'polyvalent' ||
        SUPPORT_ROLES.includes(roleInfo(c).key)
      ));
      if (!secondaries.length) return;
      const secondary = [...secondaries].sort((a, b) => secondaryCombatScore(b, troop) - secondaryCombatScore(a, troop) || tierValue(a) - tierValue(b))[0];
      const [a, b] = orderPair(primary, secondary);
      const score = primaryCombatScore(a) + secondaryCombatScore(b, troop) + officialSynergy(a, b, 'pvp');
      const pair = { kind: 'pvp', troop, a, b, score };
      if (!best || score > best.score) best = pair;
    });

    if (!best) {
      const top = [...pool].sort((a, b) => combatOf(b).score - combatOf(a).score);
      if (top.length >= 2) best = { kind: 'pvp', troop: top[0].troops, a: top[0], b: top[1], score: 0 };
    }
    return best;
  }

  function marchList() {
    const farm = bestFarmMarch();
    const barbares = bestBarbarianMarch();
    const pvp = bestPvPMarch();
    if (barbares && pvp) {
      const barbKey = [barbares.a.id, barbares.b?.id].filter(Boolean).sort().join('|');
      const pvpKey = [pvp.a.id, pvp.b?.id].filter(Boolean).sort().join('|');
      if (barbKey === pvpKey) barbares.sameAsPvp = true;
    }
    return [farm, barbares, pvp].filter(Boolean);
  }

  function missingList() {
    const out = [];
    TROOP_MARCHES.forEach((troop) => {
      const ownedOfTroop = ownedCommanders().filter((c) => c.troops === troop);
      if (ownedOfTroop.length === 0) return;
      const missing = sortByTier(
        DATA.commanders.filter(
          (c) => c.troops === troop && !state.owned.has(c.id) && (c.usage || []).includes('pvp') && tierValue(c) <= 2
        )
      ).slice(0, 3);
      if (missing.length) out.push({ troop, missing });
    });
    return out;
  }

  function duoCard(pair) {
    const { a, b } = pair;
    return `
      <article class="comp-card">
        <h3>Duo recommandé</h3>
        <p>Deux commandants que tu possèdes et qui fonctionnent ensemble.</p>
        <div class="comp-duo">
          ${portrait(a)}
          <div><span class="who">${esc(a.name)}</span><span class="role">${esc(roleInfo(a).label)}</span></div>
          <span class="plus">+</span>
          ${portrait(b)}
          <div><span class="who">${esc(b.name)}</span><span class="role">${esc(roleInfo(b).label)}</span></div>
        </div>
      </article>`;
  }

  function marchCard(march) {
    const { kind, troop, a, b } = march;
    const title = kind === 'farm'
      ? 'Meilleure marche farm'
      : kind === 'barbares'
        ? 'Meilleure marche barbares'
        : `Meilleure marche PvP · ${TROOP_LABEL[troop] || troop}`;
    const desc = kind === 'farm'
      ? 'La meilleure récolteuse de ta collection : un seul commandant suffit. Dans « Mes builds », passe-la en mode Farm pour les talents Récolte.'
      : kind === 'barbares'
        ? `Le meilleur duo de ta collection pour farmer les barbares et les forts.${march.sameAsPvp ? ' C’est aussi ton meilleur duo PvP : change seulement les talents (Maintien de la paix ↔ combat).' : ''}`
        : 'Le meilleur duo PvP de ta collection, choisi sur l’analyse des compétences et la synergie de troupe.';
    const secondary = b
      ? `
          <span class="plus">+</span>
          ${portrait(b)}
          <div><span class="who">${esc(b.name)}</span><span class="role">Secondaire · ${esc(roleInfo(b).label)}</span></div>`
      : '';
    const tagList = [...new Set([...combatTags(a, 3), ...(b ? combatTags(b, 3) : [])])];
    const pair = b ? officialPairing(a, b) : null;
    return `
      <article class="comp-card">
        <h3>${esc(title)}</h3>
        <p>${desc}</p>
        <div class="comp-duo">
          ${portrait(a)}
          <div><span class="who">${esc(a.name)}</span><span class="role">Principal · ${esc(roleInfo(a).label)}</span></div>
          ${secondary}
        </div>
        ${tagList.length ? `<div class="chips march-tags"><span class="tag">Profil</span>${tagList.map((tag) => `<span class="tag ok">${esc(tag)}</span>`).join('')}</div>` : ''}
        ${pair ? `<p class="pair-note">🤝 Synergie officielle : <b>${esc(pair.name)}</b>${pair.scenario ? ` (${esc(pair.scenario)})` : ''}. ${esc(pair.description)}</p>` : ''}
      </article>`;
  }

  function missingCard(entry) {
    const names = entry.missing.map((c) => `<span class="tag miss">${esc(c.name)} (${esc(c.tier)})</span>`).join('');
    return `
      <article class="comp-card">
        <h3>À viser · ${esc(TROOP_LABEL[entry.troop] || entry.troop)}</h3>
        <p>Des commandants qui compléteraient bien ta collection dans cette spécialité.</p>
        <div class="chips">${names}</div>
      </article>`;
  }

  function vengeanceSlot(c, number) {
    if (!c) {
      return `<div class="vslot empty"><span class="vnum">${number}</span><span class="vname">—</span></div>`;
    }
    const tags = combatTags(c, 3);
    return `<div class="vslot" title="${esc(roleInfo(c).label)}${c.skillProfile?.summary ? ' — ' + esc(c.skillProfile.summary) : ''}">
      <span class="vnum">${number}</span>
      ${portrait(c)}
      <span class="vname">${esc(c.name)}</span>
      <span class="vrole">${esc(roleInfo(c).label)} · ${esc(TROOP_LABEL[c.troops] || c.troops)}</span>
      ${tags.length ? `<span class="vtags">${tags.map((tag) => `<span class="vtag">${esc(tag)}</span>`).join('')}</span>` : ''}
    </div>`;
  }

  function vengeanceCard() {
    if (state.owned.size === 0) return '';
    const line = vengeanceLineup();
    const row = (label, list, offset) => `
      <div class="vrow">
        <span class="vlabel">${label}</span>
        <div class="vslots">${list.map((c, i) => vengeanceSlot(c, offset + i)).join('')}</div>
      </div>`;
    const backPair = line.back.length === 2 ? officialPairing(line.back[0], line.back[1]) : null;
    return `
      <article class="comp-card vcard">
        <h3>Compo Path of Vengeance</h3>
        <p>Board 5 slots construit sur l’analyse des compétences (dégâts, tank, soutien, debuff) et des arbres de talents : tanks/infanterie devant, soutien au milieu, meilleurs profils de dégâts derrière.</p>
        <div class="vboard">
          ${row('Avant', line.front, 1)}
          ${row('Milieu', line.mid, 3)}
          ${row('Arrière', line.back, 4)}
        </div>
        ${backPair ? `<p class="pair-note">🤝 Backline : synergie officielle <b>${esc(backPair.name)}</b> (${esc(backPair.scenario)}).</p>` : ''}
      </article>`;
  }

  function renderComps() {
    if (state.owned.size === 0) {
      els.comps.innerHTML = '';
      els.compsEmpty.hidden = false;
      return;
    }
    const duos = duoList();
    const marches = marchList();
    const missing = missingList();

    const blocks = [];
    const v = vengeanceCard();
    if (v) blocks.push(v);
    if (marches.length) blocks.push('<h2 class="panel-head" style="margin:6px 0 0"><span style="font-size:15px">Marches recommandées</span></h2>');
    marches.forEach((m) => blocks.push(marchCard(m)));
    if (duos.length) blocks.push('<h2 class="panel-head" style="margin:6px 0 0"><span style="font-size:15px">Duos qui fonctionnent</span></h2>');
    duos.forEach((d) => blocks.push(duoCard(d)));
    if (missing.length) blocks.push('<h2 class="panel-head" style="margin:6px 0 0"><span style="font-size:15px">Objectifs de collection</span></h2>');
    missing.forEach((m) => blocks.push(missingCard(m)));

    els.comps.innerHTML = blocks.join('');
    els.compsEmpty.hidden = blocks.length > 0;
  }

  function parseExpiry(raw) {
    if (!raw) return null;
    const value = String(raw);
    const d = value.includes('T') ? new Date(value) : new Date(value + 'T23:59:59');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function codeState(item) {
    if (item.status === 'expired') return 'expired';
    const d = parseExpiry(item.expires);
    if (d && d.getTime() < Date.now()) return 'expired';
    return item.status === 'active' ? 'active' : 'unknown';
  }

  function formatExpiry(raw) {
    const d = parseExpiry(raw);
    return d ? d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : String(raw);
  }

  function renderCodes() {
    const cfg = CONTENT.codes || { items: [] };
    const items = cfg.items || [];
    const active = items.filter((i) => codeState(i) === 'active').length;
    els.codesMeta.textContent = cfg.verifiedAt
      ? `Vérifiés le ${cfg.verifiedAt} · ${active} actifs · ${items.length} listés au total`
      : '—';

    const visible = items.filter((i) => {
      const s = codeState(i);
      if (s === 'expired') return false;
      if (s === 'unknown') return state.showUnknownCodes;
      return true;
    });

    els.codesList.innerHTML = visible.map((i) => {
      const s = codeState(i);
      const badge = s === 'active'
        ? '<span class="badge badge-ok">Actif</span>'
        : '<span class="badge badge-warn">À tester</span>';
      const exp = i.expires ? `Expire le ${esc(formatExpiry(i.expires))}` : 'Expiration non communiquée';
      return `
        <article class="code-row">
          <div class="code-main">
            <code class="code">${esc(i.code)}</code>
            ${badge}
            <span class="code-rewards">${esc(i.rewards || '')}</span>
          </div>
          <div class="code-side">
            <span class="code-exp">${esc(exp)}${i.added ? ' · ajouté ' + esc(i.added) : ''}</span>
            <button class="btn btn-ghost code-copy" data-code="${esc(i.code)}" type="button">Copier</button>
          </div>
        </article>`;
    }).join('');

    els.codesEmpty.hidden = visible.length > 0;
  }

  function renderOffers() {
    const cfg = CONTENT.offers || {};
    els.offersNote.textContent = cfg.note || '';
    els.offersTiers.innerHTML = (cfg.tiers || []).map((t) => `
      <article class="offer-card rank-${esc(t.rank)}">
        <div class="offer-top">
          <span class="rank">${esc(t.rank)}</span>
          <h3>${esc(t.name)}</h3>
          <span class="price">${esc(t.price)}</span>
        </div>
        <p class="offer-value">${esc(t.value)}</p>
        <p class="offer-why">${esc(t.why)}</p>
        <span class="tag">Budget : ${esc(t.budget)}</span>
      </article>`).join('');
    els.offersPlans.innerHTML = (cfg.plans || []).map((p) => `
      <article class="comp-card">
        <h3>${esc(p.budget)}</h3>
        <p>${esc(p.buy)}</p>
      </article>`).join('');
    els.offersAvoid.innerHTML = (cfg.avoid || []).map((a) => `<span class="tag miss">${esc(a)}</span>`).join('');
  }

  /* ---------------- technology tree ---------------- */

  const TECH_TREES = [
    {
      id: 'militaire',
      label: 'Arbre militaire',
      icon: '⚔️',
      hint: 'Débloque les unités de ta troupe principale, puis monte les technologies de combat correspondantes.',
      levels: [
        [{ id: 'disc', label: 'Discipline militaire', icon: '🎖️', big: true, sub: 'Racine' }],
        [
          { id: 'fer', label: 'Travail du fer', icon: '⛏️', parent: 'disc', sub: 'Infanterie' },
          { id: 'fleches', label: 'Amélioration de flèches', icon: '🏹', parent: 'disc', sub: 'Archers' },
          { id: 'equitation', label: 'Équitation', icon: '🐎', parent: 'disc', sub: 'Cavalerie' },
          { id: 'projectile', label: 'Projectile enflammé', icon: '🔥', parent: 'disc', sub: 'Siège' }
        ],
        [
          { id: 'epeiste', label: 'Épéiste', icon: '🗡️', parent: 'fer', sub: 'T1 → T5' },
          { id: 'archer', label: 'Archer', icon: '🏹', parent: 'fleches', sub: 'T1 → T5' },
          { id: 'cav-legere', label: 'Cavalerie légère', icon: '🐎', parent: 'equitation', sub: 'T1 → T5' },
          { id: 'scorpion', label: 'Scorpion', icon: '🛞', parent: 'projectile', sub: 'T1 → T5' }
        ],
        [
          { id: 'mailles', label: 'Armure de mailles', icon: '🛡️', parent: 'epeiste' },
          { id: 'arc-long', label: 'Arc long', icon: '🎯', parent: 'archer' },
          { id: 'cav-lourde', label: 'Cavalerie lourde', icon: '🏇', parent: 'cav-legere' },
          { id: 'baliste', label: 'Baliste', icon: '🏹', parent: 'scorpion' }
        ],
        [
          { id: 'science', label: 'Science militaire', icon: '📜', big: true, parents: ['mailles', 'arc-long', 'cav-lourde', 'baliste'], sub: 'Bonus globaux' }
        ]
      ]
    },
    {
      id: 'economie',
      label: 'Arbre économique',
      icon: '🌾',
      hint: 'L’économie fait tourner la ville : récolte, construction et recherche avant tout.',
      levels: [
        [{ id: 'eco', label: 'Développement économique', icon: '🏛️', big: true, sub: 'Racine' }],
        [
          { id: 'agri', label: 'Agriculture', icon: '🌾', parent: 'eco', sub: 'Nourriture' },
          { id: 'foret', label: 'Exploitation forestière', icon: '🪵', parent: 'eco', sub: 'Bois' },
          { id: 'pierre', label: 'Extraction de pierre', icon: '🪨', parent: 'eco', sub: 'Pierre' },
          { id: 'or', label: 'Exploitation aurifère', icon: '🪙', parent: 'eco', sub: 'Or' }
        ],
        [
          { id: 'irrigation', label: 'Irrigation', icon: '💧', parent: 'agri' },
          { id: 'scierie', label: 'Scierie', icon: '🪚', parent: 'foret' },
          { id: 'taille', label: 'Taille de pierre', icon: '⛏️', parent: 'pierre' },
          { id: 'fonderie', label: 'Fonderie', icon: '🔥', parent: 'or' }
        ],
        [
          { id: 'construction', label: 'Construction', icon: '🏗️', parent: 'irrigation', sub: 'Vitesse' },
          { id: 'recherche', label: 'Recherche', icon: '📖', parent: 'scierie', sub: 'Vitesse' },
          { id: 'stockage', label: 'Stockage', icon: '🏺', parent: 'taille', sub: 'Capacité' },
          { id: 'logistique', label: 'Logistique', icon: '🐂', parent: 'fonderie', sub: 'Charge' }
        ],
        [
          { id: 'prosperite', label: 'Prospérité', icon: '👑', big: true, parents: ['construction', 'recherche', 'stockage', 'logistique'], sub: 'Bonus globaux' }
        ]
      ]
    }
  ];

  function wrapTechLabel(label, maxChars) {
    const words = String(label).split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 2);
  }

  function renderTechTreeSvg(tree) {
    const marginX = 70;
    const width = 1000;
    const top = 34;
    const step = 122;
    const nodeH = 62;
    const positions = new Map();

    tree.levels.forEach((nodes, levelIndex) => {
      const n = nodes.length;
      const available = width - marginX * 2;
      const slot = available / Math.max(n, 1);
      const nodeW = Math.max(118, Math.min(214, slot - 26));
      nodes.forEach((node, i) => {
        const cx = n === 1 ? width / 2 : marginX + slot * i + slot / 2;
        const cy = top + levelIndex * step + nodeH / 2;
        positions.set(node.id, { cx, cy, w: nodeW });
      });
    });

    const height = top + (tree.levels.length - 1) * step + nodeH + 34;
    const edges = [];

    tree.levels.forEach((nodes) => {
      nodes.forEach((node) => {
        const parents = node.parents || (node.parent ? [node.parent] : []);
        const child = positions.get(node.id);
        parents.forEach((parentId) => {
          const parent = positions.get(parentId);
          if (!parent) return;
          const y1 = parent.cy + nodeH / 2;
          const y2 = child.cy - nodeH / 2;
          const mid = (y2 - y1) / 2;
          edges.push(`<path d="M ${parent.cx.toFixed(1)} ${y1.toFixed(1)} C ${parent.cx.toFixed(1)} ${(y1 + mid).toFixed(1)}, ${child.cx.toFixed(1)} ${(y2 - mid).toFixed(1)}, ${child.cx.toFixed(1)} ${y2.toFixed(1)}"></path>`);
        });
      });
    });

    const boxes = [];
    tree.levels.forEach((nodes) => {
      nodes.forEach((node) => {
        const p = positions.get(node.id);
        const x = p.cx - p.w / 2;
        const y = p.cy - nodeH / 2;
        const maxChars = Math.max(12, Math.floor((p.w - 20) / 6.4));
        const lines = wrapTechLabel(node.label, maxChars);
        const lineHeight = 14;
        const hasSub = Boolean(node.sub);
        const labelStart = p.cy - (lines.length - 1) * (lineHeight / 2) - (hasSub ? 4 : 0);
        const text = lines
          .map((line, i) => `<tspan x="${p.cx.toFixed(1)}" y="${(labelStart + i * lineHeight).toFixed(1)}">${esc(line)}</tspan>`)
          .join('');
        const sub = hasSub
          ? `<text class="tech-sub" x="${p.cx.toFixed(1)}" y="${(labelStart + lines.length * lineHeight + 1).toFixed(1)}">${esc(node.sub)}</text>`
          : '';
        boxes.push(`
          <g class="tech-node${node.big ? ' is-root' : ''}">
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${nodeH}" rx="12"></rect>
            <text class="tech-label" text-anchor="middle">${text}</text>
            ${sub}
            <title>${esc(node.label)}${node.sub ? ' — ' + esc(node.sub) : ''}</title>
          </g>`);
      });
    });

    return `
      <figure class="tech-tree">
        <figcaption class="tech-tree-head">
          <span>${esc(tree.icon || '')} ${esc(tree.label)}</span>
          <small>${esc(tree.hint || '')}</small>
        </figcaption>
        <svg class="tech-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(tree.label)}">
          <g class="tech-edges">${edges.join('')}</g>
          <g class="tech-boxes">${boxes.join('')}</g>
        </svg>
      </figure>`;
  }

  function renderTech() {
    const cfg = CONTENT.tech || {};
    els.techNote.textContent = cfg.note || '';
    els.techPaths.innerHTML = TECH_TREES.map(renderTechTreeSvg).join('') + (cfg.paths || []).map((p) => `
      <article class="comp-card tech-card">
        <h3>${esc(p.icon || '')} ${esc(p.label)}</h3>
        <ol class="steps">${(p.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </article>`).join('');
  }

  function renderLayouts() {
    const cfg = CONTENT.layouts || {};
    els.layoutsNote.textContent = cfg.note || '';
    const brackets = cfg.brackets || [];
    if (!brackets.length) {
      els.layoutTabs.innerHTML = '';
      els.layoutView.innerHTML = '';
      return;
    }
    if (!brackets.some((b) => b.id === state.layoutId)) state.layoutId = brackets[0].id;
    els.layoutTabs.innerHTML = brackets.map((b) => `
      <button class="tag ${b.id === state.layoutId ? 'ok' : ''}" data-layout="${esc(b.id)}" type="button">${esc(b.label)}</button>`).join('');

    const b = brackets.find((x) => x.id === state.layoutId) || brackets[0];
    els.layoutView.innerHTML = `
      <div class="layout-head">
        <h3>${esc(b.label)}</h3>
        <span class="tag">${esc(b.level || '')}</span>
      </div>
      <div class="schematic">
        <div class="zone outside">
          <span class="zone-label">Hors muraille</span>
          <div class="chips">${(b.outside || []).map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
        </div>
        <div class="zone wall">
          <span class="zone-label">Muraille · ${(b.wall || []).join(' · ')}</span>
          <div class="zone inside">
            <div class="chips">${(b.inside || []).map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
          </div>
          <div class="zone core">
            <span class="zone-label">Cœur de ville</span>
            <div class="chips">${(b.core || []).map((x) => `<span class="tag ok">${esc(x)}</span>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="tips">${(b.tips || []).map((t) => `<p>• ${esc(t)}</p>`).join('')}</div>
      ${(cfg.gallery || []).length ? `
        <div class="layout-gallery">
          ${cfg.gallery.map((g) => `
            <figure class="layout-shot">
              <a href="${esc(g.src)}" target="_blank" rel="noopener">
                <img src="${esc(g.src)}" alt="${esc(g.label)}" loading="lazy" />
              </a>
              <figcaption>
                <strong>${esc(g.label)}</strong>
                ${g.note ? `<span>${esc(g.note)}</span>` : ''}
              </figcaption>
            </figure>`).join('')}
        </div>` : ''}`;
  }

  function renderAll() {
    renderVersion();
    renderStats();
    renderCatalogue();
    renderBuilds();
    renderComps();
    renderCodes();
    renderOffers();
    renderTech();
    renderLayouts();
  }

  /* ---------------- events ---------------- */

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
      const panel = document.getElementById(`panel-${btn.dataset.tab}`);
      if (panel) panel.hidden = btn.dataset.tab !== tab;
    });
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    els.catalogue.addEventListener('change', (event) => {
      const input = event.target.closest('input[type="checkbox"][data-id]');
      if (!input) return;
      const id = input.dataset.id;
      if (input.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
      renderAll();
    });

    els.catalogue.addEventListener('click', (event) => {
      if (event.target.closest('.pick')) return;
      const card = event.target.closest('.cmd-card');
      if (!card) return;
      const input = card.querySelector('input[type="checkbox"]');
      if (input) input.click();
    });

    els.search.addEventListener('input', () => {
      state.query = els.search.value;
      renderCatalogue();
    });

    els.rarity.addEventListener('change', () => {
      state.rarity = els.rarity.value;
      renderCatalogue();
    });

    els.troop.addEventListener('change', () => {
      state.troop = els.troop.value;
      renderCatalogue();
    });

    if (els.sort) {
      els.sort.addEventListener('change', () => {
        state.sort = els.sort.value;
        renderCatalogue();
      });
    }

    if (els.builds) {
      els.builds.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-build-mode]');
        if (!btn) return;
        state.buildModes[btn.dataset.id] = btn.dataset.buildMode;
        renderBuilds();
      });
    }

    if (els.grade) {
      els.grade.addEventListener('change', () => {
        state.grade = els.grade.value;
        renderCatalogue();
      });
    }

    els.ownedOnly.addEventListener('change', () => {
      state.onlyOwned = els.ownedOnly.checked;
      renderCatalogue();
    });

    els.clearBtn.addEventListener('click', () => {
      if (state.owned.size === 0) return;
      if (!window.confirm('Retirer tous les commandants de ta collection ?')) return;
      state.owned.clear();
      saveOwned();
      renderAll();
      toast('Collection vidée.');
    });

    els.refreshBtn.addEventListener('click', refreshData);

    if (els.showUnknownCodes) {
      els.showUnknownCodes.addEventListener('change', () => {
        state.showUnknownCodes = els.showUnknownCodes.checked;
        renderCodes();
      });
    }

    if (els.copyAllCodes) {
      els.copyAllCodes.addEventListener('click', async () => {
        const codes = (CONTENT.codes?.items || []).filter((i) => codeState(i) === 'active').map((i) => i.code);
        if (!codes.length) {
          toast('Aucun code actif.');
          return;
        }
        try {
          await navigator.clipboard.writeText(codes.join('\n'));
          toast(`${codes.length} codes copiés.`);
        } catch (err) {
          toast('Copie impossible — sélectionne les codes à la main.');
        }
      });
    }

    if (els.codesList) {
      els.codesList.addEventListener('click', async (event) => {
        const btn = event.target.closest('.code-copy');
        if (!btn) return;
        try {
          await navigator.clipboard.writeText(btn.dataset.code);
          toast(`Code copié : ${btn.dataset.code}`);
        } catch (err) {
          toast('Copie impossible — sélectionne le code à la main.');
        }
      });
    }

    if (els.layoutTabs) {
      els.layoutTabs.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-layout]');
        if (!btn) return;
        state.layoutId = btn.dataset.layout;
        renderLayouts();
      });
    }
  }

  async function refreshData() {
    try {
      const [cmdRes, contentRes] = await Promise.all([
        fetch('data/commanders.json', { cache: 'no-store' }),
        fetch('data/content.json', { cache: 'no-store' }).catch(() => null)
      ]);
      if (!cmdRes.ok) throw new Error(`HTTP ${cmdRes.status}`);
      const json = await cmdRes.json();
      if (!json || !Array.isArray(json.commanders)) throw new Error('format invalide');

      let changed = false;
      const incoming = json.meta?.version || '—';
      if (incoming !== meta.version) {
        setData(json);
        changed = true;
      }

      if (contentRes && contentRes.ok) {
        const content = await contentRes.json();
        if (content && (content.codes || content.offers || content.tech || content.layouts)) {
          CONTENT = content;
          changed = true;
        }
      }

      renderAll();
      toast(changed ? 'Données actualisées.' : 'Données déjà à jour.');
    } catch (err) {
      toast('Vérification impossible — ouvre le site via le serveur local (scripts\\serve.ps1).');
    }
  }

  function setData(next) {
    DATA = next;
    byId = new Map(DATA.commanders.map((c) => [c.id, c]));
    meta = DATA.meta || {};
    OFFICIAL_BY_TREESET = null;
    OFFICIAL_BY_TREE = null;
    const known = new Set(DATA.commanders.map((c) => c.id));
    [...state.owned].forEach((id) => {
      if (!known.has(id)) state.owned.delete(id);
    });
    renderAll();
  }

  /* ---------------- boot ---------------- */

  if (!DATA || !Array.isArray(DATA.commanders)) {
    document.body.innerHTML = '<p style="padding:40px;color:#f28b82">Impossible de charger les données (data/commanders.js).</p>';
    return;
  }

  setData(DATA);
  bindEvents();
  setTab('collection');
})();
