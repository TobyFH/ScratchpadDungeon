const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
let browser, server, url;
const output = path.resolve(__dirname, '../test-results/event-log');
before(async () => {
  fs.mkdirSync(output, { recursive: true });
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'));
  server = http.createServer((_, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); });
async function game(t) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(async () => {
    newRun('fighter'); setPace('skip'); closeModal(); closeSpotlight();
    characterLuck = () => .999999; scheduleStunRecovery = () => {};
    state.logs = []; renderLog(); await document.fonts.ready;
  });
  t.after(async () => { await p.close(); assert.deepEqual(errors, []); });
  return p;
}

test('personal travel moments, gold and traits have named explanations that survive a save/reload', async t => {
  const p = await game(t);
  const before = await p.evaluate(() => {
    characterLuck = () => 0;
    travelCharacterMoment({ wall: false, event: null }, { fresh: true });
    state.party[0].trait = null;
    grantTrait(state.party[0], 'focused', 'Kept calm through a dangerous encounter.');
    save();
    return { gold: state.gold, logs: state.logs, details: state.logDetails };
  });
  assert.equal(before.gold, 5);
  assert.ok(before.logs.some(s => s.includes('A KEEN EYE') && s.includes('+5 gold')));
  assert.ok(before.logs.some(s => s.includes('gains Focused')));
  assert.ok(before.details.every(d => d.terms.length));
  assert.equal(before.details.find(d => d.text.includes('A KEEN EYE')).context, 'exploration');
  assert.equal(await p.locator('#log .log-term').filter({ hasText: 'A KEEN EYE' }).count(), 1);
  const focused = p.locator('#log .log-term').filter({ hasText: /^Focused$/ });
  await focused.focus();
  await assert.doesNotReject(() => p.locator('#status-tooltip').waitFor({ state: 'visible' }));
  assert.match(await p.locator('#status-tooltip').innerText(), /Earned: Kept calm/);
  await p.reload();
  assert.deepEqual(await p.evaluate(() => state.logDetails), before.details);
  assert.equal(await p.locator('#log .log-term').filter({ hasText: 'A KEEN EYE' }).count(), 1);
});

test('nested real-action groups retain named moments and trait gains without duplicating hit spam', async t => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(); closeSpotlight(); finishOpeningRoll();
    const h = state.party[0]; state.logs = [];
    const outer = beginHeroRollLog(h), inner = beginCombatLogGroup(h, 'FLURRY');
    characterLuck = () => 0;
    characterMoment('parry', h);
    h.trait = null;
    grantTrait(h, 'focused', 'Held steady during a flurry.');
    log('An ordinary individual hit for 1.');
    finishCombatLogGroup(inner, { shots: [{ type: 'attack', actual: 1 }], damage: 1, healing: 0, block: 0 });
    finishHeroRollLog(outer, h);
    return { logs: state.logs, metadata: state.logDetails };
  });
  assert.equal(r.logs.filter(s => s.includes('LAST-SECOND PARRY')).length, 1);
  assert.equal(r.logs.filter(s => s.includes('gains Focused')).length, 1);
  assert.ok(!r.logs.some(s => s.includes('ordinary individual hit')));
  assert.equal(r.metadata.find(d => d.text.includes('LAST-SECOND PARRY')).category, 'personal');
  assert.equal(r.metadata.find(d => d.text.includes('LAST-SECOND PARRY')).context, 'combat');
  assert.equal(r.metadata.find(d => d.text.includes('gains Focused')).category, 'trait');
});

test('class combinations become explained names in the single action summary', async t => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = makeHero('Test rogue', 'rogue'); state.party = [h];
    const group = beginHeroRollLog(h);
    applyComplementaryEffects(h, [{type:'attack',tier:1},{type:'poison',tier:1},{type:'blank',tier:1}], {});
    finishHeroRollLog(group, h);
    return { logs: state.logs, tips: [...$('#log').querySelectorAll('[data-tooltip]')].map(e=>[e.textContent,e.dataset.tooltip]) };
  });
  assert.equal(r.logs.length, 1);
  assert.match(r.logs[0], /Venom edge/);
  assert.ok(r.tips.some(([name, tip]) => name === 'Venom edge' && tip.includes('+1 physical damage')));
});

test('revealing a cave room logs it once and preserves untouched discoveries', async t => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const indices = neighbors(state.position).slice(0, 2);
    indices.forEach((i, n) => Object.assign(state.map[i], { wall:false, seen:false, room:'log-test', event:n ? 'treasure':null, activated:false }));
    markSeen(indices[0]); markSeen(indices[0]);
    return { entries:state.logs, cells:indices.map(i=>state.map[i]), tip:$('#log [data-tooltip]')?.dataset.tooltip };
  });
  assert.equal(r.entries.filter(s=>s.includes('Cave room')).length,1);
  assert.ok(r.cells.every(c=>c.seen && !c.activated));
  assert.equal(r.cells[1].event,'treasure');
  assert.match(r.tip,/not activated/);
});

test('using supplies and equipping gear record their actual item names and shared descriptions', async t => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h=state.party[0]; h.hp-=12; state.bag={potion:1};
    await useItem('potion');
    const type=Object.keys(EQUIPMENT_DEFS).find(k=>canEquipGear(h,EQUIPMENT_DEFS[k]));
    state.bag[type]=1;
    await equipCharacter(type,0);
    return {logs:state.logs, names:[ITEM_DEFS.potion.name,EQUIPMENT_DEFS[type].name], tips:[...$('#log').querySelectorAll('.log-term')].map(e=>[e.textContent,e.dataset.tooltip])};
  });
  for(const name of r.names) {
    assert.ok(r.logs.some(s=>s.includes(name)));
    assert.ok(r.tips.some(([n,description])=>n===name && description.length>10));
  }
});

test('only revealed nearby visible stalactites log drops; distant and occluded drops remain quiet', async t => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.map.forEach(c => Object.assign(c, { terrain:'floor',wall:false,seen:false,event:null,stalactite:null }));
    state.position = W*3+3;
    const near=state.position+1, blocked=state.position-W*2, far=state.position+W*4;
    for(const i of [near,blocked,far]) Object.assign(state.map[i], {seen:true,terrain:'stalactite',stalactite:{remaining:1,drops:0}});
    Object.assign(state.map[state.position-W], {wall:true,terrain:'stone'});
    renderMap(); await livingDungeonStep();
    const visible=state.logs.slice();
    state.logs=[];
    state.map[near].seen=false; state.map[near].stalactite.remaining=1;
    await livingDungeonStep();
    return {visible, hidden:state.logs, near};
  });
  assert.equal(r.visible.length,1);
  assert.match(r.visible[0],/Stalactite falls/);
  assert.equal(r.hidden.length,0);
});

test('legacy strings render safely, annotations use whole names, and descriptions are frozen at log time', async t => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.logs=['Old treasure found.','unstunned, stun, stunned, goldfish, gold.']; state.logDetails=[]; renderLog();
    const legacy=[...$('#log').querySelectorAll('.log-term')].map(e=>e.textContent);
    log('<img src=x onerror="window.logInjected=true"> Gold', {terms:[{name:'Gold',description:'<script>not executable</script>'}]});
    const escaped=!$('#log img') && !window.logInjected;
    const description=$('#log [data-tooltip]').dataset.tooltip;
    const first=state.logDetails[0];
    state.logs[0]='Replaced line'; renderLog();
    const staleIgnored=!$('#log li:first-child [data-tooltip]');
    return {legacy,escaped,description,staleIgnored,first};
  });
  assert.ok(r.legacy.includes('treasure'));
  assert.deepEqual(r.legacy.slice(1),['stun','stunned','gold']);
  assert.ok(r.escaped && r.staleIgnored);
  assert.equal(r.description,'<script>not executable</script>');
});

test('log stays bounded, keeps reading position/focus, and adds no gameplay randomness', async t => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let randomCalls=0;
    const original=Math.random;
    Math.random=()=>{randomCalls++;return .5};
    for(let i=0;i<75;i++) log(`Treasure ${i}: +10 gold.`);
    renderLog();
    Math.random=original;
    const root=$('#log'); root.scrollTop=80;
    const term=root.querySelector('li:nth-child(4) .log-term'); term.focus({preventScroll:true});
    const id=term.closest('li').dataset.logId;
    log('A new room.');
    const focused=document.activeElement.closest('li')?.dataset.logId;
    const scroll=root.scrollTop;
    const node=document.activeElement; renderLog();
    return {randomCalls,logs:state.logs.length,details:state.logDetails.length,id,focused,scroll,stable:node===document.activeElement};
  });
  assert.equal(r.randomCalls,0);
  assert.equal(r.logs,60); assert.equal(r.details,60);
  assert.equal(r.id,r.focused); assert.ok(r.scroll>0); assert.ok(r.stable);
});

test('Event log and hover/focus explanations fit desktop/compact sizes and every palette', async t => {
  const p = await game(t);
  await p.evaluate(() => {
    log('Cave room revealed. Its contents wait untouched.');
    log('Treasure: +35 gold.');
    const h=state.party[0]; grantTrait(h,'focused','Kept calm through a dangerous encounter.');
    log(`${h.name} · Venom edge.`,{category:'combat'});
  });
  for(const [width,height] of [[1920,1080],[1280,800],[390,844],[320,844]]) {
    await p.setViewportSize({width,height});
    for(const palette of ['default','warm','dark']) {
      await p.evaluate(async palette=>{setPalette(palette);fitNotebook();requestFitUI(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},palette);
      const term=p.locator('#log .log-term').filter({hasText:'Venom edge'});
      await term.scrollIntoViewIfNeeded();
      await p.locator("#log").focus();
      await term.focus();
      await p.locator('#status-tooltip').waitFor({state:'visible'});
      const r=await p.evaluate(()=>{
        const b=$('#status-tooltip').getBoundingClientRect(), h=$('.journal h3').getBoundingClientRect(), j=$('.journal').getBoundingClientRect();
        return {bounds:b.toJSON(),viewport:[innerWidth,innerHeight],tipFits:b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1,titleFits:h.right<=j.right+1,underline:getComputedStyle($('#log .log-term')).textDecorationLine};
      });
      assert.ok(r.tipFits && r.titleFits,`${width} ${palette}: ${JSON.stringify(r)}`);
      assert.equal(r.underline,'underline');
      assert.equal(await p.locator('.journal h3').innerText(),'EVENT LOG');
      await p.screenshot({path:path.join(output,`event-log-${width}-${palette}.png`),fullPage:false,animations:'disabled'});
    }
  }
});
