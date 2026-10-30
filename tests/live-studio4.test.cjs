const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const root=require('node:path').resolve(__dirname,'..')+'/';
function guard(live=[],classes=[],error=null){
 const sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(root+'web/duvela-session-guard.js','utf8'),sandbox);
 return {run:(domain,id,user='teacher')=>sandbox.window.DuvelaSessionGuard.assertFree({from(table){const result={data:table==='live_sessions'?live:classes,error};const q={select(){return q},eq(){return q},then(resolve){resolve(result)}};return q}},user,domain,id)};
}
test('no sessions permits either format',async()=>{await guard().run('broadcast');await guard().run('classroom')});
test('active broadcast blocks classroom',async()=>assert.rejects(guard([{id:'live'}]).run('classroom'),/Another teaching session/));
test('active classroom blocks broadcast',async()=>assert.rejects(guard([],[{id:'class'}]).run('broadcast'),/Another teaching session/));
test('same room can resume',async()=>{await guard([{id:'same'}]).run('broadcast','same');await guard([],[{id:'same'}]).run('classroom','same')});
test('IDs from different domains remain separate',async()=>assert.rejects(guard([],[{id:'same'}]).run('broadcast','same'),/Another teaching session/));
test('query error prevents starting',async()=>assert.rejects(guard([],[],{message:'offline'}).run('broadcast'),/Cannot verify/));
test('authentication required',async()=>assert.rejects(guard().run('broadcast',null,null),/Sign in/));
const source=fs.readFileSync(root+'web/live-page.js','utf8');
function payload(metadata=null){
 const values={topicInput:{value:'QA lesson'},privateInput:{checked:false},allowViewerRequests:{checked:true},audience18Plus:{checked:false},videoQuality:{value:'auto'},languageInput:{value:'German'},levelInput:{value:'B1'}};
 const box={el:id=>values[id],tr:a=>a,createChannelName:()=> 'channel',displayName:()=> 'Teacher',studio4Metadata:metadata};vm.createContext(box);
 const start=source.indexOf('  function hostSessionPayload('),end=source.indexOf('  async function createLiveSession',start);
 vm.runInContext(source.slice(start,end),box);
 return box.hostSessionPayload({id:'teacher'},'scheduled','2026-10-20T10:00:00Z',null);
}
test('provider payload preserves setup',()=>{const p=payload();assert.equal(p.teacher_id,'teacher');assert.equal(p.language,'German');assert.equal(p.level,'B1');assert.equal(p.is_private,false);assert.equal(p.allow_guest_requests,true);assert.equal(p.status,'scheduled')});
test('optional metadata follows schema capability',()=>{assert.equal('thumbnail_url' in payload(),false);assert.equal(payload({category:'Grammar',thumbnail_url:'https://example.com/cover.png'}).category,'Grammar')});
test('classroom reserves start before SDK entry',()=>{const s=fs.readFileSync(root+'classroom-src/main.js','utf8');const begin=s.indexOf('async function join()');const part=s.slice(begin,s.indexOf('async function toggleMic',begin));assert.match(part,/roomRole = auth.role === 1/);assert(part.indexOf("action: 'start'")<part.indexOf('await client.join'));assert.match(part,/DuvelaSessionGuard.assertFree/)});
test('Studio V5 keeps the existing Agora host controls and separates scene selection from publishing',()=>{
 const page=fs.readFileSync(root+'live.html','utf8');
 const studio=fs.readFileSync(root+'web/live-studio-ui.js','utf8');
 const styles=fs.readFileSync(root+'web/app-live-studio5.css','utf8');
 const has=(text,part)=>assert.ok(text.includes(part),'missing: '+part);
 has(page,'app-live-studio5.css?v=20261030-studio5-focus');
 has(page,'live-page.js?v=20261030-studio5-focus');
 has(page,'live-studio-ui.js?v=20261030-studio5-focus');
 has(studio,'api.previewScene(previewSelect.value)');
 has(studio,'api.setScene(previewSelect.value)');
 has(studio,'api.toggleScreenShare()');
 has(studio,'api.isPublishing()');
 // V5 dock buttons forward to the original live-page.js controls instead of re-implementing them.
 has(studio,"forward('toggleMic'");
 has(studio,"forward('toggleCam'");
 has(studio,"['hostAction', 'endLive'].forEach");
 has(source,'getDeviceState: getHostDeviceState');
 has(studio,'api.getDeviceState?.()');
 has(studio,'studioMicState');
 assert.doesNotMatch(studio,/28 ?ms|1\.2 Mbps|1\.8 Mbps/);
 has(styles,'.duvela-studio-v5 .main');
 has(styles,'--v5-bg: #0B0914');
 has(styles,'studio-v5-scene-grid');
 has(styles,'@media (max-width: 760px)');
});
test('Studio V5 status and Health only show values reported by Agora',()=>{
 const studio=fs.readFileSync(root+'web/live-studio-ui.js','utf8');
 const has=(text,part)=>assert.ok(text.includes(part),'missing: '+part);
 has(source,"client.on('network-quality'");
 has(source,'getRtcHealth: getHostRtcHealth');
 has(source,'client?.getRTCStats?.()');
 has(source,'getSceneState: function');
 has(source,'function syncLiveScene()');
 has(studio,"const live = publishing && health.connectionState === 'CONNECTED'");
 has(studio,"NOT_AVAILABLE = t('Not available'");
 has(studio,'api.syncLiveScene?.()');
});
test('Studio V5 serves late joiners, previews the microphone and switches it in place',()=>{
 const page=fs.readFileSync(root+'live.html','utf8');
 const studio=fs.readFileSync(root+'web/live-studio-ui.js','utf8');
 const has=(text,part)=>assert.ok(text.includes(part),'missing: '+part);
 has(source,"event: 'state-request'");
 has(source,'localAudioTrack.setDevice(selectedMicrophoneId)');
 has(studio,"addEventListener('duvela:state-request'");
 has(studio,'startPreviewMeter(');
 has(page,'body.scene-focus #player { transform: scale(1.3)');
});
test('Studio V5 timeline initially limits the recent rooms to three',()=>{
  assert.match(source,/hostHistorySessions\.slice\(0, 3\)/);
  assert.match(source,/toggleTimelineHistory/);
});

