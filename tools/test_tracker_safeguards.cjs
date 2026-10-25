const assert = require('node:assert/strict');
const { runtime, hud, seed } = require('./test_panel_tracking.cjs');
const rt = runtime();
const schema = { you: 'object', family: 'array', injuries: 'array' };
const state = rt.run('emptyChatState()');
const source = 'Marcus learned Earth Spear. Marcus reliably mastered Water Ball. Marcus practices Earth Wall.';
const chat = [{ id: 'u1', role: 'user', content: 'I want to learn Earth Wall.' },
    { id: 'a1', role: 'assistant', swipe_id: 0, content: hud() + '\n' + source }];
const target = chat[1];
const evidence = (path, key, quote, source = 'reply') => ({ path, key, quote, source });
const validate = (data, messages = chat, st = state, spec = schema) => rt.ctx.trackerValidate(data, spec, messages, messages.at(-1), st, 'Marcus King');
const base = () => ({ you: { learned: [], spells: [], mastered: [], study: [] }, family: [], injuries: [], evidence: [] });
function checkClaim(path, name, quote, text, accepted) {
    const data = base(); data.you[path.split('.')[1]] = [name];
    data.evidence = [evidence(path, name, quote)];
    const messages = structuredClone(chat); messages[1].content = hud() + '\n' + text;
    const out = validate(data, messages);
    assert.equal(out.accepted.some(x => x.path === path), accepted, `${path}: ${quote}`);
}
checkClaim('you.learned', 'Earth Spear', 'Marcus learned Earth Spear.', 'Marcus learned Earth Spear.', true);
checkClaim('you.mastered', 'Water Ball', 'Marcus reliably mastered Water Ball.', 'Marcus reliably mastered Water Ball.', true);
checkClaim('you.learned', 'Earth Spear', 'Marcus learned Earth Spear.', 'Marcus attempted Earth Spear but failed.', false);
checkClaim('you.learned', 'Earth Spear', 'Aurelius cast Earth Spear.', 'Aurelius cast Earth Spear.', false);
checkClaim('you.mastered', 'Water Ball', 'Marcus cast Water Ball.', 'Marcus cast Water Ball.', false);
checkClaim('you.learned', 'Earth Spear', 'Marcus cast Earth Spear', 'Marcus tried to cast Earth Spear but failed.', false);
const valid = base();
valid.you.learned = ['Earth Spear']; valid.you.mastered = ['Water Ball'];
valid.you.study = [{spell:'Earth Wall', progress:null}];
valid.evidence = [evidence('you.learned','Earth Spear','Marcus learned Earth Spear.'),
    evidence('you.mastered','Water Ball','Marcus reliably mastered Water Ball.'),
    evidence('you.study','Earth Wall','Marcus practices Earth Wall.')];
let result = validate(valid);
assert.equal(result.issues.length, 0, JSON.stringify(result.issues));
assert.equal(result.accepted[0].messageId, 'a1');
assert.equal(result.accepted[0].swipeId, 0);
const forged = structuredClone(valid); forged.evidence[0].source = 'old-reply';
assert(validate(forged).issues.some(x => x.path === 'you.learned'));
const missing = validate({ family: {}, injuries: [] });
assert(missing.issues.some(x => x.path === 'you'));
assert(missing.issues.some(x => x.path === 'family'));
const family = base();family.family = [{ name: 'Hesper', relation: 'mentor' }];
assert(validate(family).issues.some(x => x.reason.includes('kinship')));
const invalid = base();invalid.you.sanity = null;invalid.you.study = [{spell:'Earth Wall', progress:140}];
assert(validate(invalid).issues.some(x => x.reason.includes('percentage')));
const nullSanity = rt.ctx.parseCompanion('<rpg_companion>{"you":{"sanity":null}}</rpg_companion>');
assert.equal(nullSanity.you.sanity, null);
const wounded = rt.run('emptyChatState()');wounded.injuries = {list:[{what:'arm cut',where:'arm',kind:'wound',severity:'minor',status:'raw'}],before:{}};
const removal = validate(base(), chat, wounded);
assert(removal.issues.some(x => x.reason.includes('healing')));
assert.equal(rt.ctx.trackerSanitize(base(), removal).injuries, undefined);
const established = structuredClone(chat);established.unshift({id:'a0',role:'assistant',content:hud(),metadata:{rpg_companion:{swipes:{0:{family:[{name:'Aurelius King',relation:'father'}]}}}}});
const carry = base();carry.family = [{name:'Aurelius King',relation:'father'}];
assert(!validate(carry, established).issues.some(x => x.path === 'family'));
const percent = structuredClone(valid);percent.you.study[0].progress = 80;
assert(validate(percent).issues.some(x => x.reason.includes('percentage')));
const repeatMoney = structuredClone(established);
repeatMoney[0].metadata.rpg_companion.swipes[0].money = [{what:'Allowance',amount:3,currency:'copper'}];
assert(validate({money:[{what:'Allowance',amount:3,currency:'copper'}]},repeatMoney,state,{money:'array'}).issues.some(x => x.path === 'money'));
const omitted = base();
assert(validate(omitted).issues.some(x => x.reason.includes('omitted')));
const instruction = '<rpg_companion>{"characters":[],"you":{"mood":"brief","sanity":0..100,"study":[{"spell":"name","progress":null}]},"plot":{"now":"short","threads":[]},"family":[],"evidence":[]}</rpg_companion>';
const spec = rt.ctx.trackerSchema(instruction);
assert.equal(spec.characters, 'array');assert.equal(spec.you, 'object');assert.equal(spec.plot, 'object');assert.equal(spec.family, 'array');
assert.deepEqual(Array.from(spec._youFields), ['mood','sanity','study']);
assert(validate({you:{mood:'calm'},characters:[],plot:null,family:[],evidence:[]},chat,state,spec).issues.some(x => x.path === 'you.sanity'));
// The latest user can choose a goal; an NPC proposal alone cannot prove acceptance.
const goalChat = structuredClone(chat);goalChat[0].content = 'I will learn Earth Wall.';
const goal = {objectives:[{text:'Learn Earth Wall',state:'active'}],evidence:[evidence('objectives','Learn Earth Wall','I will learn Earth Wall.','user')]};
assert.equal(validate(goal,goalChat,state,{objectives:'array'}).issues.length,0);
goal.evidence[0] = evidence('objectives','Learn Earth Wall','Marcus practices Earth Wall.','reply');
assert(validate(goal,goalChat,state,{objectives:'array'}).issues.length);
goalChat[0].content = 'I watch the clouds.';
goal.evidence[0] = evidence('objectives','Learn Earth Wall','I watch the clouds.','user');
assert(validate(goal,goalChat,state,{objectives:'array'}).issues.length);
assert(validate({characters:[{name:'Rudeus Greyrat'}]}, chat, state, {characters:'array'}).issues.some(x => x.path === 'characters'));

async function main() {
    const run = runtime();seed(run);
    run.run('settings.trackerSafeguards = {enabled:true,repair:true};');
    run.messages[1].content = hud() + '\nMarcus learned Earth Spear.';
    const text = '<rpg_companion>{"you":{"learned":["Earth Spear"]}}</rpg_companion>';
    const instr = '<rpg_companion>{"you":{},"family":[]}</rpg_companion>';
    let calls = 0;
    run.quiet(() => { calls++;run.response({you:{learned:['Earth Spear']},family:[],evidence:[evidence('you.learned','Earth Spear','Marcus learned Earth Spear.')]}); });
    const guarded = await run.ctx.trackerGuardReport('test',text,run.messages,run.messages[1],await run.ctx.getChatState('test'),instr,'Marcus King');
    assert.equal(calls,1);assert.equal(guarded.audit.retried,true);assert.equal(guarded.audit.pending.length,0);
    assert.equal(guarded.comp.you.learned[0],'Earth Spear');
    // A complete supported report makes no correction call.
    calls = 0;
    const complete = '<rpg_companion>'+JSON.stringify({you:{learned:['Earth Spear']},family:[],evidence:[evidence('you.learned','Earth Spear','Marcus learned Earth Spear.')]})+'</rpg_companion>';
    await run.ctx.trackerGuardReport('test',complete,run.messages,run.messages[1],state,instr,'Marcus King');
    assert.equal(calls,0);
    // Local rereads never initiate a repair; unresolved facts stay out of committed data.
    const local = await run.ctx.trackerGuardReport('test',text,run.messages,run.messages[1],state,instr,'Marcus King',false);
    assert.equal(calls,0);assert.equal(local.comp.you.learned.length,0);assert(local.audit.pending.length);
    // Even an unsuccessful correction is bounded to one model request.
    run.quiet(() => { calls++;run.response({family:[],you:{learned:['Earth Spear']},evidence:[]}); });
    const failed = await run.ctx.trackerGuardReport('test',text,run.messages,run.messages[1],state,instr,'Marcus King');
    assert.equal(calls,1);assert(failed.audit.pending.length);assert.equal(failed.comp.you.learned.length,0);
    // A changed active swipe prevents correction from starting.
    calls = 0;const stale = structuredClone(run.messages);run.messages[1].swipe_id = 1;
    const swiped = await run.ctx.trackerGuardReport('test',text,stale,stale[1],state,instr,'Marcus King');
    assert.equal(calls,0);assert.equal(swiped.audit.retried,false);
    run.run('sandbox = {mode:"demo"};');
    const demo = await run.ctx.trackerGuardReport('__rpgc_test_zone__',text,stale,stale[1],state,instr,'Marcus King');
    assert.equal(calls,0);assert.equal(demo.audit,null);
    // Real separate-mode orchestration: a complete, supported report uses one call.
    const full = runtime();seed(full);full.run('settings.trackerSafeguards = {enabled:true,repair:true};');
    full.messages[1].content = hud() + '\nMarcus learned Earth Spear.';
    let modelCalls = 0, fullReport = null;
    full.quiet(request => {
        modelCalls++;
        const schema = full.ctx.trackerSchema(request.messages.at(-1).content);
        fullReport = Object.fromEntries(Object.entries(schema).filter(([key]) => !key.startsWith('_')).map(([key,type]) => [key,type === 'array' ? [] : null]));
        fullReport.you = Object.fromEntries((schema._youFields || []).map(key => [key,['got','lost','spells','learned','study','mastered'].includes(key) ? [] : null]));
        fullReport.you.learned = ['Earth Spear'];
        fullReport.evidence = [evidence('you.learned','Earth Spear','Marcus learned Earth Spear.')];
        full.response(fullReport);
    });
    await full.ctx.runSeparateUpdate('test');
    assert.equal(modelCalls,1);
    const stored = full.ctx.getSwipeData(full.messages[1]);
    assert(stored.trackingAudit);assert.equal(stored.trackingAudit.pending.length,0);
    assert.equal(stored.trackingAudit.evidence[0].messageId,'a1');
    assert.equal(stored.survival.learned[0],'Earth Spear');
    // The same evidence survives inline processing without an extra generation.
    const inline = runtime();seed(inline);inline.run('settings.trackerSafeguards = {enabled:true,repair:true};settings.generationMode = "together";');
    inline.messages[1].content = hud() + '\nMarcus learned Earth Spear.\n<rpg_companion>' + JSON.stringify(fullReport) + '</rpg_companion>';
    let inlineCalls = 0;inline.quiet(() => {inlineCalls++;});
    await inline.ctx.hmsHandleReply('test',inline.messages,inline.messages[1],'normal');
    assert.equal(inlineCalls,0);
    assert.equal(inline.ctx.getSwipeData(inline.messages[1]).trackingAudit.pending.length,0);
    console.log('Safeguard tests passed: evidence, player attribution, attempts, omitted learning, panel coverage, types, nulls, kinship, injury retention, established facts, one-shot correction, no-call rereads and stale swipes.');
}
main().catch(error => { console.error(error);process.exitCode=1; });
