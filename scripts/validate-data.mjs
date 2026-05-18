#!/usr/bin/env node
// validador del data embebido en index.html (multi-producto).
// recorre los tres jumpstart products (JMP, J22, J25) y verifica invariantes:
// cantidad de packs, tamaño de cada pack, cobertura de CARD_DATA,
// temas únicos, emblems válidos.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'index.html');
const html = readFileSync(htmlPath, 'utf-8');

const COLORS = ['white','blue','black','red','green','multicolor'];
const BASIC_NAMES = ['Plains','Island','Swamp','Mountain','Forest'];
const BASIC_VANILLA = new Set(BASIC_NAMES);

/* unescape an embedded js template literal back to plain text. mirrors the
   escapes applied at generation time: \` → `, \$ → $, \\ → \ */
const unescapeTemplate = (s) => s.replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');

const isThemedBasic = (n) => {
  for (const b of BASIC_VANILLA) if (n.endsWith(' '+b)) return true;
  return false;
};

function parseMd(md) {
  const packs = [];
  let currentColor = null, currentPack = null, inCode = false;
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\r$/,'');
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const head = line.slice(3).toLowerCase();
      for (const c of COLORS) if (head.startsWith(c)) { currentColor = c; break; }
      continue;
    }
    if (line.startsWith('### ')) {
      const name = line.slice(4).trim();
      const m = name.match(/^(.+?)\s*\((\d+)\)\s*$/);
      const theme = m ? m[1].trim() : name;
      currentPack = { name, theme, color: currentColor, cards: [] };
      packs.push(currentPack);
      continue;
    }
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode && currentPack) {
      const cm = line.match(/^(\d+)\s+(.+)$/);
      if (cm) currentPack.cards.push({ qty: parseInt(cm[1],10), name: cm[2].trim() });
    }
  }
  return packs;
}

function checkProduct(name, productData, totalProblems) {
  const { md, cardData, basics, packEmblem } = productData;
  const log  = (...a) => console.log(...a);
  let problems = 0;
  const warn = (...a) => { console.log('  ⚠', ...a); problems++; };

  const packs = parseMd(md);

  log(`\n══════════════ ${name} ══════════════`);
  log('═══ PACKS ═══');
  log(`total: ${packs.length}`);
  for (const c of COLORS) log(`  ${c.padEnd(11)} ${packs.filter(p=>p.color===c).length}`);

  log('\n═══ TAMAÑO DE PACKS (esperado: 20) ═══');
  const wrongSize = packs.filter(p => p.cards.reduce((s,c)=>s+c.qty,0) !== 20);
  if (wrongSize.length === 0) log('  OK · todos los packs tienen 20 cartas');
  for (const p of wrongSize) {
    warn(`${p.color}/${p.name}: ${p.cards.reduce((s,c)=>s+c.qty,0)} cartas`);
  }

  log('\n═══ COBERTURA DE LOOKUP (CARD_DATA + basics) ═══');
  const hitsBySet = { basics: 0 };
  const unresolved = new Map();
  for (const p of packs) {
    for (const c of p.cards) {
      if (basics[c.name] !== undefined || isThemedBasic(c.name)) { hitsBySet.basics += c.qty; continue; }
      if (c.name === 'Rainbow Terramorphic Expanse' && cardData['Terramorphic Expanse']) {
        const set = cardData['Terramorphic Expanse'][0];
        hitsBySet[set] = (hitsBySet[set] || 0) + c.qty;
        continue;
      }
      const d = cardData[c.name];
      if (d) { hitsBySet[d[0]] = (hitsBySet[d[0]] || 0) + c.qty; continue; }
      if (!unresolved.has(c.name)) unresolved.set(c.name, []);
      unresolved.get(c.name).push(`${p.color}/${p.name}`);
    }
  }
  for (const [s, n] of Object.entries(hitsBySet)) log(`  ${s.padEnd(7)} ${n}`);
  const total = Object.values(hitsBySet).reduce((a,b) => a+b, 0);
  log(`  total: ${total}`);
  if (unresolved.size === 0) log('  OK · 0 cartas sin lookup');
  else {
    warn(`${unresolved.size} nombres sin lookup en CARD_DATA:`);
    for (const [n, where] of [...unresolved.entries()].sort()) {
      log(`    "${n}"  →  ${where.length} pack(s)`);
    }
  }

  log('\n═══ TEMAS ÚNICOS ═══');
  const themes = new Map();
  for (const p of packs) {
    if (!themes.has(p.theme)) themes.set(p.theme, []);
    themes.get(p.theme).push(p);
  }
  log(`  ${themes.size} temas distintos`);

  log('\n═══ PACK EMBLEMS ═══');
  log(`  ${Object.keys(packEmblem).length} entradas`);
  const packByName = new Map(packs.map(p => [p.name, p]));
  const beforeEmblem = problems;
  for (const [packName, cardName] of Object.entries(packEmblem)) {
    const pack = packByName.get(packName);
    if (!pack) { warn(`packEmblem["${packName}"] no corresponde a ningún pack`); continue; }
    if (!pack.cards.some(c => c.name === cardName)) {
      warn(`emblem "${cardName}" no está en el pool de "${packName}"`);
    }
    if (!cardData[cardName]) {
      warn(`emblem "${cardName}" (${packName}) no está en CARD_DATA`);
    }
  }
  for (const p of packs) {
    if (!packEmblem[p.name]) warn(`pack "${p.name}" sin emblem`);
  }
  if (problems === beforeEmblem) log('  OK · todos los emblems válidos y presentes en su pool');

  log('\n═══ DATOS DE MANA_COST ═══');
  const withMc = Object.values(cardData).filter(d => d[2]).length;
  const withoutMc = Object.values(cardData).length - withMc;
  log(`  con mana_cost: ${withMc}`);
  log(`  sin mana_cost (lands/etc): ${withoutMc}`);

  log('\n═══ RESUMEN ' + name + ' ═══');
  log(`  problemas críticos: ${problems}`);
  log(`  packs: ${packs.length} · entradas en CARD_DATA: ${Object.keys(cardData).length}`);
  totalProblems.count += problems;
}

/* ===== extract data per product from index.html =====
   the html embeds JMP as top-level let RAW_MARKDOWN/CARD_DATA/JMP_BASICS/PACK_EMBLEM,
   and J22/J25 inside a `const SETS = { J22: { ... }, J25: { ... } };` literal.
   we extract each product's blocks separately. */

function findJmpBlocks() {
  const mdMatch = html.match(/const RAW_MARKDOWN_JMP = `([\s\S]*?)`;/);
  const cdMatch = html.match(/const CARD_DATA_JMP = (\{[\s\S]*?\n\});/);
  const basMatch = html.match(/const JMP_BASICS_JMP = (\{[^}]*\});/);
  const emMatch  = html.match(/const PACK_EMBLEM_JMP = (\{[\s\S]*?\n\});/);
  if (!mdMatch || !cdMatch || !basMatch || !emMatch) {
    console.error('FAIL: no se pudieron extraer bloques de JMP');
    process.exit(1);
  }
  return {
    md: unescapeTemplate(mdMatch[1]),
    cardData: eval('(' + cdMatch[1] + ')'),
    basics: eval('(' + basMatch[1] + ')'),
    packEmblem: eval('(' + emMatch[1] + ')'),
  };
}

function findSetBlock(code) {
  // each SETS entry: `  CODE: {  ...  },` — match a single key block by balancing braces
  const startRe = new RegExp(`\\b${code}: \\{`, 'g');
  const startMatch = startRe.exec(html);
  if (!startMatch) {
    console.error(`FAIL: no se encontró bloque para ${code}`);
    process.exit(1);
  }
  let depth = 1, i = startMatch.index + startMatch[0].length;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  const block = html.slice(startMatch.index, i + 1);  // "CODE: {...}"
  const inner = block.slice(block.indexOf('{') + 1, -1);

  // pull each named field with a balanced parser inside the inner block
  const grab = (key, openCh, closeCh) => {
    const re = new RegExp(`\\b${key}\\s*:\\s*\\${openCh}`);
    const m = inner.match(re);
    if (!m) return null;
    let depth = 1, j = m.index + m[0].length;
    while (j < inner.length && depth > 0) {
      const c = inner[j];
      if (c === openCh) depth++;
      else if (c === closeCh) depth--;
      if (depth === 0) break;
      j++;
    }
    return inner.slice(m.index + m[0].length - 1, j + 1);
  };

  const grabTemplate = () => {
    const tag = 'rawMarkdown:';
    const idx = inner.indexOf(tag);
    if (idx === -1) return null;
    const tickStart = inner.indexOf('`', idx);
    let k = tickStart + 1;
    while (k < inner.length) {
      if (inner[k] === '\\') { k += 2; continue; }
      if (inner[k] === '`') break;
      k++;
    }
    return inner.slice(tickStart + 1, k);
  };

  const cardBlk = grab('cardData', '{', '}');
  const basBlk  = grab('basics',   '{', '}');
  const emBlk   = grab('packEmblem','{', '}');
  const md = grabTemplate();
  if (!cardBlk || !basBlk || !emBlk || md == null) {
    console.error(`FAIL: bloques faltantes en ${code}`);
    process.exit(1);
  }
  return {
    md: unescapeTemplate(md),
    cardData: eval('(' + cardBlk + ')'),
    basics: eval('(' + basBlk + ')'),
    packEmblem: eval('(' + emBlk + ')'),
  };
}

const totalProblems = { count: 0 };
checkProduct('JMP', findJmpBlocks(), totalProblems);
checkProduct('J22', findSetBlock('J22'), totalProblems);
checkProduct('J25', findSetBlock('J25'), totalProblems);

console.log(`\n══════════ TOTAL ══════════`);
console.log(`  problemas críticos: ${totalProblems.count}`);
process.exit(totalProblems.count > 0 ? 1 : 0);
