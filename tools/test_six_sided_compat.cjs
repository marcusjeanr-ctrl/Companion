const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../dist/backend.js'), 'utf8');
const arcEntries = JSON.parse(fs.readFileSync(path.join(__dirname, 'six_sided_arc_fixture.json')));
function section(from, to) { const a = src.indexOf(from), b = src.indexOf(to, a + from.length); assert(a >= 0 && b > a, from); return src.slice(a, b); }
const code = [
 section('const HUD_HEAD_RE =', '/**\n * True when the HUD was replaced'),
 section('const WORLD_LABEL =', '// ── Expansions read from the bots'),
 section('const MT_ABBR =', '/** The panel payload for the world card'),
 section('/** In-world minutes from the HUD', 'function hmsSpan('),
 section('function spellStanding(lines)', '/** What the story reports'),
 'const SPELL_MT_WORDS = {beginner:0,basic:0,elementary:0,elem:0,intermediate:1,advanced:2,saint:3,king:4,emperor:5,imperial:5,god:6,divine:6};',
 'function spellMtStep(s) { const m=String(s).toLowerCase().match(/\\b(beginner|basic|elementary|elem|intermediate|advanced|saint|king|emperor|imperial|god|divine)\\b/); return m ? SPELL_MT_WORDS[m[1]] : null; }',
 'function spellSchoolKey(s) { return String(s).toLowerCase(); }',
 'function spellTitle(s) { return s; }',
 'function lockKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }',
 'function hudFieldsFixed(s) { return s; }',
 'function hmsMarkBlocks() {}',
 'function worldLore() { return null; }',
 'function worldSpellIndex() { return null; }',
 'function spellIndexFromCatalog() { return null; }',
 'function getLorePool() { return entries; }',
 'function isPlainObject(x) { return x && typeof x === "object" && !Array.isArray(x); }',
 'const SPELL_ELEMENTS = /water|earth|fire|wind/i;',
 'const entries = [];',
 'function hmsClockTest(h) { return hmsClock(h); }',
].join('\n');
const ctx = vm.createContext({}); vm.runInContext(code, ctx);
function evalExpr(expr) { return vm.runInContext(expr, ctx); }
const six = `### WORLD STATE ###\nArmored Dragon Calendar: K417, Thawmoon (Month 2), Day 8 — Dragonsday | Season: Spring | Time: 07:15 (Early Morning)\n◆ Central Continent → Asura Kingdom → Fittoa Region → House King Estate → Training Yard\nRace: Human | Origin: Native | Age: 13 (born K404, Month 2)\nMana Capacity: Vast | Reserve: Full\nTouki (Battle Aura): Active\nSword Style: Sword God (Intermediate)\nMagic Tiers: Water (Intermediate), Earth (Intermediate), Fire (Beginner)\nVoiceless Casting: Active\nCanon: Living\nNarrative Mode: Strict Agency\nCurrent Arc: Sandbox\n***\nScene.`;
const living = `### WORLD STATE ###\nYear: K.417 | Day: 8 | Time: 07:15\nLocation: ◆ Six-Faced World → Central Continent → Asura Kingdom → Buena Village\nBirth: K.404 | Race: Human | Age: 13 | Origin: Native\nMana Capacity: Monstrous\nCasting Method: Voiceless (Silent)\nTouki: Active\nMartial Style: Sword God Style: Intermediate\nMagic School: Water: Intermediate, Earth: Intermediate\nCurrent Arc: Arc 3: Demon Continent\n***\nScene.`;
const h6 = ctx.parseHud(six), hl = ctx.parseHud(living);
assert.deepEqual(Array.from(h6.location), ['Central Continent','Asura Kingdom','Fittoa Region','House King Estate','Training Yard']);
assert.equal(ctx.worldOf(ctx.worldLines(h6)), 'mushoku');
assert.equal(ctx.worldOf(ctx.worldLines(hl)), 'mushoku');
const w6=ctx.worldMushoku('test',ctx.worldLines(h6),{}), wl=ctx.worldMushoku('test',ctx.worldLines(hl),{});
assert.equal(w6.year,417); assert.equal(w6.month,2); assert.equal(w6.day,8);
assert.equal(w6.birth,404); assert.equal(w6.birthMonth,2); assert.equal(w6.age,13);
assert.equal(w6.mana,'Vast'); assert.equal(w6.reserve,'Full'); assert.equal(w6.touki,'Active');
assert.equal(w6.magic[0].step,1); assert.equal(w6.magic[2].step,0);
assert.equal(w6.martial[0].step,1); assert.equal(w6.agency,'Strict Agency'); assert.equal(w6.canon,'Living');
assert.equal(wl.mana,'Monstrous'); assert.equal(wl.magic[0].step,1); assert.equal(wl.martial[0].step,1);
assert.equal(ctx.spellStanding(h6.lines).voiceless,true); assert.equal(ctx.spellStanding(h6.lines).schools.get('water').step,1);
assert.equal(ctx.spellStanding(hl.lines).schools.get('water').step,1);
assert.equal(w6.saga.participation,'personal'); assert.equal(w6.saga.personalArc,'Sandbox');
assert.equal(wl.saga.participation,'explicit');
assert.equal(ctx.hmsClockTest(h6).dated,true);
const later=ctx.parseHud(six.replace('Day 8','Day 9'));
assert.equal(ctx.hmsClockTest(later).minutes-ctx.hmsClockTest(h6).minutes,1440);
evalExpr('entries').push(...arcEntries);
assert.equal(ctx.mtArcList('test').length,22);
assert.equal(ctx.mtArcList('test').find(x=>x.no===3).year,417);
console.log('Compatibility assertions passed: Six-Sided HUD, Living World HUD, calendar, ranks, casting, saga, and 22 lorebook arcs.');
