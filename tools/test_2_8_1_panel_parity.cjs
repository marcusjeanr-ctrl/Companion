const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { runtime } = require('./test_panel_tracking.cjs');
const fixturePath = path.join(__dirname, 'panel_2_8_1_fixture.json');
const plain = value => JSON.parse(JSON.stringify(value));
function panel(rt, sample) {
    rt.ctx.sample = sample;
    return plain(rt.run(`(() => {
        const chat = sample.messages.map(m => {
            const data = parseCompanion(m.content);
            return {...m, content:stripCompanion(m.content), metadata:{rpg_companion:{swipes:{0:{...data,survival:data.you}}}}};
        });
        const st = emptyChatState();
        st.party.members = sample.party.map(name => ({name,key:lockKey(name)}));
        userNameCache.set('parity','USER');
        return {hms:hmsPanelState('parity',chat,st),plot:plotPanel(chat,st),injuries:injPanel(chat,st),chapters:chaptersPanel(st,chat)};
    })()`));
}
if (process.argv[2] === '--capture') {
    assert(process.argv[3], 'Pass the original 2.8.1 backend path');
    const old = runtime(path.resolve(process.argv[3]));
    const samples = [];
    for (const world of ['rezero', 'overlord', 'cote', 'mushoku']) {
        const sample = plain(old.run(`({world:'${world}',party:SANDBOX_WORLDS.${world}.party,
            messages:SANDBOX_WORLDS.${world}.script.map((fn,i)=>({id:'${world}'+i,role:'assistant',swipe_id:0,content:fn(1)}))})`));
        sample.expected = panel(old, sample);
        samples.push(sample);
    }
    fs.writeFileSync(fixturePath, JSON.stringify({source:'Original supplied HMS 2.8.1 beta demo scripts and panel outputs',samples},null,2)+'\n');
} else {
    const rt = runtime();
    for (const sample of JSON.parse(fs.readFileSync(fixturePath, 'utf8')).samples) {
        const actual = panel(rt, sample);
        const expected = structuredClone(sample.expected);
        if (sample.world === 'mushoku') {
            // Compatibility corrects the old Living World HUD's missing absolute K-year clock.
            assert(actual.hms.systems.clock > expected.hms.systems.clock);
            actual.hms.systems.clock = expected.hms.systems.clock;
            actual.hms.minds.clock = expected.hms.minds.clock;
            if (expected.hms.atlas === null) {
                assert(actual.hms.atlas?.trail.some(x => x.name === 'Buena Village'), 'Mushoku observed-place fallback lost its village');
                actual.hms.atlas = null;
            }
        }
        assert.deepEqual(actual, expected, `${sample.world}: existing 2.8.1 panels changed`);
    }
    console.log('2.8.1 panel parity passed: every panel output in the four original demo worlds is preserved, with only the intended Mushoku calendar and observed-Atlas corrections.');
}
