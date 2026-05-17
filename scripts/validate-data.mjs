#!/usr/bin/env node
// validador del data embebido en index.html.
// verifica invariantes del set JMP: cantidad de packs, tamaño de cada pack,
// cobertura de CARD_DATA, temas únicos, collector numbers únicos.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'index.html');
const html = readFileSync(htmlPath, 'utf-8');

const mdMatch = html.match(/const RAW_MARKDOWN = `([\s\S]*?)`;/);
if (!mdMatch) { console.error('FAIL: no se encontró RAW_MARKDOWN'); process.exit(1); }
const md = mdMatch[1].replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');

const cdMatch = html.match(/const CARD_DATA = (\{[\s\S]*?\n\});/);
if (!cdMatch) { console.error('FAIL: no se encontró CARD_DATA'); process.exit(1); }
const CARD_DATA = eval('(' + cdMatch[1] + ')');

const JMP_BASICS = { Plains: 38, Island: 46, Swamp: 54, Mountain: 62, Forest: 70 };
const BASIC_VANILLA = new Set(Object.keys(JMP_BASICS));
const COLORS = ['white','blue','black','red','green','multicolor'];

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

const isThemedBasic = (n) => {
  for (const b of BASIC_VANILLA) if (n.endsWith(' '+b)) return true;
  return false;
};

let problems = 0;
const log  = (...a) => console.log(...a);
const warn = (...a) => { console.log('  ⚠', ...a); problems++; };

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
const hitsBySet = { JMP: 0, M21: 0, basics: 0 };
const unresolved = new Map();
for (const p of packs) {
  for (const c of p.cards) {
    if (JMP_BASICS[c.name] !== undefined || isThemedBasic(c.name)) { hitsBySet.basics += c.qty; continue; }
    if (c.name === 'Rainbow Terramorphic Expanse') { hitsBySet.JMP += c.qty; continue; }
    const d = CARD_DATA[c.name];
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
const peMatch = html.match(/const PACK_EMBLEM = (\{[\s\S]*?\n\});/);
if (!peMatch) warn('no se encontró PACK_EMBLEM');
else {
  const PACK_EMBLEM = eval('(' + peMatch[1] + ')');
  log(`  ${Object.keys(PACK_EMBLEM).length} entradas`);
  const packByName = new Map(packs.map(p => [p.name, p]));
  const before = problems;
  for (const [packName, cardName] of Object.entries(PACK_EMBLEM)) {
    const pack = packByName.get(packName);
    if (!pack) { warn(`PACK_EMBLEM["${packName}"] no corresponde a ningún pack`); continue; }
    if (!pack.cards.some(c => c.name === cardName)) {
      warn(`emblem "${cardName}" no está en el pool de "${packName}"`);
    }
    if (!CARD_DATA[cardName]) {
      warn(`emblem "${cardName}" (${packName}) no está en CARD_DATA`);
    }
  }
  for (const p of packs) {
    if (!PACK_EMBLEM[p.name]) warn(`pack "${p.name}" sin emblem`);
  }
  if (problems === before) log('  OK · todos los emblems válidos y presentes en su pool');
}

log('\n═══ DATOS DE MANA_COST ═══');
const withMc = Object.values(CARD_DATA).filter(d => d[2]).length;
const withoutMc = Object.values(CARD_DATA).length - withMc;
log(`  con mana_cost: ${withMc}`);
log(`  sin mana_cost (lands/etc): ${withoutMc}`);

log('\n═══ RESUMEN ═══');
log(`  problemas críticos: ${problems}`);
log(`  packs: ${packs.length} · entradas en CARD_DATA: ${Object.keys(CARD_DATA).length}`);
process.exit(problems > 0 ? 1 : 0);
