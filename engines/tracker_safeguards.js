// Uses the host bundle's JSON, HUD and spell helpers; performs no IO or model calls.
function trackerSafetyCfg() {
    const c = isPlainObject(settings.trackerSafeguards) ? settings.trackerSafeguards : {};
    return { enabled: c.enabled !== false, repair: c.repair !== false };
}
function trackerRaw(text) {
    const t = stripThink(String(text || ''));
    const m = t.match(/<rpg_companion>([\s\S]*?)(?:<\/rpg_companion>|$)/i);
    const from = m ? m[1] : t.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const obj = repairJSON(from);
    return isPlainObject(obj) ? obj : {};
}
function trackerSchema(instruction) {
    const m = String(instruction || '').match(/<rpg_companion>\s*\{([\s\S]*?)<\/rpg_companion>/i);
    if (!m) return {};
    const text = '{' + m[1], schema = {};
    let depth = 0, quoted = false, escaped = false, start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch !== '"') continue;
            quoted = false;
            if (depth !== 1) continue;
            const tail = text.slice(i + 1).match(/^\s*:\s*([\s\S])/);
            if (tail) {
                const key = text.slice(start, i);
                if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) schema[key] = tail[1] === '[' ? 'array' : tail[1] === '{' ? 'object' : 'scalar';
            }
        } else if (ch === '"') { quoted = true; start = i + 1; }
        else if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
    }
    const you = m[1].match(/"you":\s*\{([\s\S]*?)\}(?=\s*[,}])/);
    if (you) schema._youFields = ['slept','ate','drank','rested','mind','mood','stress','sanity','xp','xpWhy','got','lost','spells','learned','study','mastered']
        .filter(key => new RegExp('"' + key + '"\\s*:').test(you[1]));
    return schema;
}
function trackerPath(obj, path) {
    return path.split('.').reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, obj);
}
function trackerDrop(obj, path) {
    const keys = path.split('.'), key = keys.pop();
    const parent = keys.length ? trackerPath(obj, keys.join('.')) : obj;
    if (isPlainObject(parent)) delete parent[key];
}
function trackerKey(item) {
    if (typeof item === 'string') return item.trim();
    if (!isPlainObject(item)) return '';
    return String(item.spell || item.name || item.text || item.what || item.fact || '').trim();
}
function trackerSources(chat, target) {
    const at = (chat || []).findIndex(m => m.id === target.id);
    const source = [{ id: String(target.id), source: 'reply', swipe: target.swipe_id ?? 0, role: 'assistant', text: stripCompanion(textOf(target.content)) }];
    for (let i = at - 1; i >= 0; i--) {
        const m = chat[i];
        if (m.role === 'assistant') break;
        if (m.role === 'user' && m.extra?.hidden !== true) { source.push({ id: String(m.id), source: 'user', swipe: m.swipe_id ?? 0, role: 'user', text: textOf(m.content) }); break; }
    }
    return source;
}
const TRACKER_EVENT_PATHS = new Set(['money','learned','plot.canonEvents','you.spells','you.learned','you.mastered','you.study','you.got','you.lost']);
const TRACKER_FACT_PATHS = ['family', 'gear', 'holdings', 'money', 'factions', 'secrets', 'contacts', 'objectives', 'agenda', 'injuries', 'learned', 'you.spells', 'you.learned', 'you.mastered', 'you.study', 'you.got', 'you.lost', 'plot.canonEvents'];
function trackerEvidenceRule() {
    return '\nTracking evidence: include "evidence":[] in the same block. For each NEW or CHANGED factual item in ' + TRACKER_FACT_PATHS.join(', ') + ', add {"path":"field path","key":"the item name/text (money: what)","source":"reply|user","quote":"short exact continuous quote from that source"}. Unchanged established facts need no new quote. "reply" means the assistant reply being tracked; "user" means the immediately preceding player message. Do not cite lore, a catalog, another character\'s demonstration, intent as success, or an older turn as proof of a new event. Spell learning/mastery requires the reply to establish the player\'s success. Objectives require the player\'s own choice or acceptance. Injury removals need one evidence entry per healed injury using path "injuries.removed" and key equal to its previous what. Missing or uncertain information stays null; never guess numbers or invent events. The HUD owns its printed clock, location, ranks and pools; do not infer replacements.';
}
function trackerBaseline(chat, target) {
    const baseline = {};
    for (const path of TRACKER_FACT_PATHS) baseline[path] = new Map();
    for (const m of relReadings(chat || [])) {
        if (m.id === target.id) break;
        const data = getSwipeData(m);
        if (!data) continue;
        const raw = { ...data, you: data.survival };
        for (const path of TRACKER_FACT_PATHS) {
            const rows = trackerPath(raw, path);
            if (Array.isArray(rows)) for (const item of rows) {
                const key = lockKey(trackerKey(item));
                if (key) baseline[path].set(key, item);
            }
        }
    }
    return baseline;
}
function trackerUnchanged(item, previous) {
    if (previous === undefined) return false;
    if (typeof item === 'string') return lockKey(item) === lockKey(trackerKey(previous));
    if (!isPlainObject(item) || !isPlainObject(previous)) return false;
    return Object.entries(item).every(([key, value]) => {
        if (['key', 'at', 'readAt', 'msgId'].includes(key)) return true;
        return JSON.stringify(value) === JSON.stringify(previous[key]);
    });
}
function trackerProof(raw, path, key, sources, userName) {
    const proofs = Array.isArray(raw.evidence) ? raw.evidence.slice(0, 96) : [];
    for (const proof of proofs) {
        if (!isPlainObject(proof) || proof.path !== path || lockKey(proof.key || '') !== lockKey(key)) continue;
        const src = sources.find(s => s.source === proof.source || s.id === String(proof.source));
        const quote = typeof proof.quote === 'string' ? proof.quote.trim() : '';
        if (!src || quote.length < 4 || quote.length > 320 || !src.text.includes(quote)) continue;
        const words = lockKey(key).split(' ').filter(w => w.length > 2 && !['the', 'and', 'with', 'from', 'learn', 'meet'].includes(w));
        if (words.length && !words.some(w => lockKey(quote).split(' ').includes(w)) && path !== 'objectives' && path !== 'injuries.removed') continue;
        if (/^you\.(?:spells|learned|mastered)$/.test(path)) {
            const names = ['you', String(userName || '').trim(), String(userName || '').split(/\s+/)[0]].filter(Boolean)
                .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const playerAction = new RegExp(`\\b(?:${names})\\s+(?:(?:have|has|had|can|could|successfully|finally|now|cleanly|reliably|consistently)\\s+)*(?:cast|learned|mastered|completed|formed)\\b`, 'i');
            if (!playerAction.test(quote)) continue;
            if (src.role !== 'assistant' || !/\b(cast|casted|learned|mastered|mastery|successful|successfully|clean|reliable|reliably|consistently|signed off)\b/i.test(quote)) continue;
            const at = src.text.indexOf(quote);
            const context = src.text.slice(Math.max(0, at - 55), at + quote.length + 55);
            if (/\b(fail(?:ed|ure)?|unsuccessful|not yet|cannot|couldn't|could not|unable|tried to|attempted to|hasn't|has not|didn't|did not)\b/i.test(context)) continue;
            if (path === 'you.mastered' && !/\b(mastered|mastery|reliably|consistently|reliable)\b/i.test(quote)) continue;
        }
        if (path === 'you.study' && !/\b(practic\w*|train\w*|stud\w*|taught|lesson|learn\w*)\b/i.test(quote)) continue;
        if (path === 'objectives') {
            if (src.role !== 'user' || /\b(don't|do not|won't|will not|refuse|decline)\b/i.test(quote)) continue;
            if (!/\b(will|want|intend|plan|aim|choose|decide|accept|agree|promise|going to|my goal|yes)\b|\bI (?:begin|start|practice|train|study)\b/i.test(quote)) continue;
        }
        if (path === 'injuries.removed' && (src.role !== 'assistant' || !/\b(heal\w*|closed|restored|recovered|gone)\b/i.test(quote))) continue;
        return { path, key, messageId: src.id, swipeId: src.swipe, quote };
    }
    return null;
}
function trackerValidate(raw, schema, chat, target, st, userName) {
    const issues = [], accepted = [];
    const sources = trackerSources(chat, target), baseline = trackerBaseline(chat, target);
    const issue = (path, reason, key = '', index = null) => {
        if (issues.length < 80) issues.push({ path, reason, key: String(key).slice(0, 100), index });
    };
    for (const [path, type] of Object.entries(schema)) {
        if (path === 'evidence' || path.startsWith('_')) continue;
        const value = raw[path];
        if (!Object.hasOwn(raw, path)) { issue(path, 'missing requested panel'); continue; }
        if (value === null) continue;
        if (type === 'array' && !Array.isArray(value) || type === 'object' && !isPlainObject(value)) issue(path, 'wrong panel data type');
    }
    if (isPlainObject(raw.you)) {
        for (const key of schema._youFields || []) if (!Object.hasOwn(raw.you, key)) issue('you.' + key, 'missing requested player field');
        for (const name of ['spells', 'learned', 'mastered', 'study', 'got', 'lost']) if (raw.you[name] !== undefined && !Array.isArray(raw.you[name])) issue('you.' + name, 'expected an array');
        for (const name of ['sanity', 'xp']) {
            const n = raw.you[name];
            if (n !== null && n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || name === 'sanity' && n > 100)) issue('you.' + name, 'invalid number');
        }
    }
    const rowKeys = {characters:['name'],party:['name'],relations:['name'],quests:['name'],minds:['name'],agendas:['name'],pos:['name'],inbox:['from','text']};
    for (const [path, keys] of Object.entries(rowKeys)) if (Array.isArray(raw[path])) raw[path].slice(0, 100).forEach((item, index) => {
        if (!isPlainObject(item) || keys.some(key => typeof item[key] !== 'string' || !item[key].trim())) issue(path, 'malformed panel item', trackerKey(item), index);
    });
    const latestText = lockKey(sources[0].text);
    const before = (chat || []).slice(0, (chat || []).findIndex(m => m.id === target.id));
    const previous = [...before].reverse().find(m => m.role === 'assistant');
    const oldHud = previous ? parseHud(textOf(previous.content)) : null;
    const newHud = parseHud(textOf(target.content));
    const samePlace = !!(oldHud?.location && newHud?.location && JSON.stringify(oldHud.location) === JSON.stringify(newHud.location));
    if (Array.isArray(raw.characters)) raw.characters.forEach((item, index) => {
        if (!item || typeof item.name !== 'string') return;
        const name = lockKey(item.name), first = name.split(' ')[0];
        const mentioned = (' ' + latestText + ' ').includes(' ' + name + ' ') || first.length >= 3 && (' ' + latestText + ' ').includes(' ' + first + ' ');
        const carried = samePlace && (getSwipeData(previous)?.characters || []).some(x => lockKey(x.name || '') === name);
        if (!mentioned && !carried) issue('characters', 'presence is not supported by the current scene', item.name, index);
    });
    for (const path of ['plot.threads','plot.canonEvents','chekhov.load','chekhov.fired','chekhov.drop','room.features','room.exits']) {
        const value = trackerPath(raw, path);
        if (value !== undefined && value !== null && !Array.isArray(value)) issue(path, 'expected an array');
    }
    for (const path of TRACKER_FACT_PATHS) {
        const rows = trackerPath(raw, path);
        if (!Array.isArray(rows)) continue;
        rows.slice(0, 100).forEach((item, index) => {
            const key = trackerKey(item);
            const strings = ['you.spells','you.learned','you.mastered','you.got','you.lost'];
            if (strings.includes(path) ? typeof item !== 'string' : !isPlainObject(item)) { issue(path, 'wrong fact item type', key, index); return; }
            if (path === 'learned' && !item.how && !item.from) { issue(path, 'NPC knowledge needs an acquisition channel', key, index); return; }
            if (path === 'injuries' && (!INJ_SEVERITY.includes(item.severity) || !['raw','treated','permanent','scar'].includes(item.status))) { issue(path, 'invalid injury severity or status', key, index); return; }
            if (!key) { issue(path, 'missing fact identity', '', index); return; }
            if (path === 'family' && (!item.relation || !famIsKin(item.relation))) { issue(path, 'family requires explicit kinship', key, index); return; }
            if (path === 'gear' && item.state && !gearState(item.state)) { issue(path, 'unknown gear state', key, index); return; }
            if (path === 'money' && (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || !item.amount)) { issue(path, 'invalid amount', key, index); return; }
            if (path === 'you.study' && item.progress !== null && item.progress !== undefined && (typeof item.progress !== 'number' || !Number.isFinite(item.progress) || item.progress < 0 || item.progress > 100)) { issue(path, 'invalid study percentage', key, index); return; }
            const previous = baseline[path].get(lockKey(key));
            if (!TRACKER_EVENT_PATHS.has(path) && trackerUnchanged(item, previous)) return;
            const proof = trackerProof(raw, path, key, sources, userName);
            if (!proof) { issue(path, 'new or changed fact needs source evidence', key, index); return; }
            if (path === 'you.study' && item.progress !== null && item.progress !== undefined &&
                !new RegExp('\\b' + item.progress + '\\s*(?:%|percent)', 'i').test(proof.quote)) {
                issue(path, 'study percentage is not stated in the source', key, index); return;
            }
            if (path === 'money') {
                const named = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
                const numbers = (proof.quote.match(/-?\d+(?:[.,]\d+)*/g) || []).map(x => Number(x.replace(/,(?=\d{3}(?:\D|$))/g, '')));
                for (const word of lockKey(proof.quote).split(' ')) if (named[word]) numbers.push(named[word]);
                if (!numbers.some(n => Math.abs(n) === Math.abs(item.amount))) { issue(path, 'amount is not stated in the source', key, index); return; }
            }
            accepted.push(proof);
        });
    }
    if (Array.isArray(raw.injuries)) {
        const old = st?.injuries?.before?.[target.id] || st?.injuries?.list || [];
        for (const injury of old) if (!injury.manual && !raw.injuries.some(x => x && lockKey(x.what || '') === lockKey(injury.what || ''))) {
            const proof = trackerProof(raw, 'injuries.removed', injury.what, sources, userName);
            if (proof) accepted.push(proof); else issue('injuries', 'injury removal needs healing evidence', injury.what);
        }
    }
    // Detect a narrow, explicit missed learning claim; never infer learning from attempts.
    const reply = sources[0].text;
    const actor = String(userName || 'you').split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const learned = new RegExp(`\\b(?:you|${actor}) (?:have |successfully )?(learned|mastered) ([^.!?\\n]{3,70})`, 'gi');
    for (const hit of reply.matchAll(learned)) {
        const path = hit[1].toLowerCase() === 'mastered' ? 'you.mastered' : 'you.learned';
        if (!isPlainObject(raw.you)) continue;
        const name = hit[2].replace(/\s+(?:and|after|during|with)\b.*$/i, '').trim();
        const rows = trackerPath(raw, path);
        if (Array.isArray(rows) && !rows.some(x => lockKey(name) === lockKey(trackerKey(x)))) issue(path, 'explicit learning statement was omitted', name);
    }
    return { issues, accepted };
}
function trackerSanitize(raw, validation) {
    const clean = JSON.parse(JSON.stringify(raw));
    const whole = new Set(validation.issues.filter(x => x.index === null).map(x => x.path));
    const bad = new Map();
    for (const item of validation.issues) {
        if (item.index === null) continue;
        if (item.path === 'injuries') { whole.add('injuries'); continue; }
        if (!bad.has(item.path)) bad.set(item.path, new Set());
        bad.get(item.path).add(item.index);
    }
    for (const [path, indices] of bad) {
        const rows = trackerPath(clean, path);
        if (!Array.isArray(rows)) continue;
        const keys = path.split('.'), key = keys.pop();
        const parent = keys.length ? trackerPath(clean, keys.join('.')) : clean;
        parent[key] = rows.filter((_x, i) => !indices.has(i));
    }
    for (const path of whole) trackerDrop(clean, path);
    delete clean.evidence;
    return clean;
}
