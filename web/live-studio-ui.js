(function () {
  const api = window.DuvelaLiveStudioApi;
  if (!api) return;
  const ru = (localStorage.getItem('duvela.web.lang') || navigator.language || '').toLowerCase().startsWith('ru');
  const t = (en, rus) => ru ? rus : en;
  const reactionDock=document.createElement('div');reactionDock.className='reaction-dock';reactionDock.innerHTML=['👏','❤️','🔥','😂','💡'].map(emoji=>'<button type="button">'+emoji+'</button>').join('');document.querySelector('.stage')?.appendChild(reactionDock);reactionDock.addEventListener('click',async(event)=>{const button=event.target.closest('button');if(!button)return;try{await api.sendReaction(button.textContent);}catch(error){console.warn(error);}});
  if (!api.isHost) return;
  const side = document.querySelector('.side-card');
  const dock = document.querySelector('.control-dock');
  let meterStream = null;
  let meterFrame = 0;

  const tabs = document.createElement('nav');
  tabs.className = 'studio-tabs';
  tabs.innerHTML = [
    ['setup', t('Setup','Настройка')], ['design',t('Design','Оформление')], ['materials',t('Materials','Материалы')],
    ['people',t('People','Участники')], ['health',t('Health','Диагностика')]
  ].map((item, index) => '<button type="button" data-studio-tab="'+item[0]+'" class="'+(index===0?'active':'')+'">'+item[1]+'</button>').join('');
  side.insertBefore(tabs, side.querySelector('.studio-section'));

  const map = {
    setup: ['setupSection','timelineSection'], design: ['effectsSection'], materials: ['linksTitle'],
    people: ['guestRequestsSection','viewerActionsSection'], health: ['diagnosticsSection','checklistTitle','detailsTitle']
  };
  const sections = Array.from(side.querySelectorAll('.studio-section'));
  sections.forEach((section) => section.dataset.studioGroup = 'setup');
  Object.entries(map).forEach(([group, ids]) => ids.forEach((id) => {
    const node=document.getElementById(id); const section=node && node.closest('.studio-section'); if(section) section.dataset.studioGroup=group;
  }));
  function showTab(name) {
    tabs.querySelectorAll('button').forEach((button)=>button.classList.toggle('active',button.dataset.studioTab===name));
    sections.forEach((section)=>{ section.style.display=section.dataset.studioGroup===name?'grid':'none'; });
  }
  tabs.addEventListener('click',(event)=>{ const button=event.target.closest('[data-studio-tab]'); if(button) showTab(button.dataset.studioTab); });
  showTab('setup');
  const savedScene=localStorage.getItem('duvela.live.scene')||'camera'; const sceneSelect=document.getElementById('scenePreset'); if(sceneSelect){sceneSelect.value=savedScene;sceneSelect.addEventListener('change',()=>localStorage.setItem('duvela.live.scene',sceneSelect.value));}

  dock.insertAdjacentHTML('afterbegin','<button type="button" class="btn" id="studioShareScreen">▣ '+t('Share screen','Экран')+'</button><button type="button" class="btn" id="studioNotesBtn">✎ '+t('Notes','Заметки')+'</button><button type="button" class="btn" id="studioPlanBtn">◷ '+t('Lesson plan','План')+'</button>');
  document.getElementById('studioShareScreen').addEventListener('click',async function(){ try { const on=await api.toggleScreenShare(); this.classList.toggle('primary',on); this.textContent=on?t('Stop sharing','Остановить экран'):t('Share screen','Экран'); } catch(error){ alert(error.message); } });

  const privateTools=document.createElement('section'); privateTools.className='studio-section'; privateTools.id='privateTeacherTools'; privateTools.dataset.studioGroup='materials';
  privateTools.innerHTML='<div><h3>'+t('Private teacher workspace','Личное пространство преподавателя')+'</h3><p>'+t('These notes are stored only in this browser and are never shown to viewers.','Эти данные хранятся только в браузере и не видны зрителям.')+'</p></div><textarea id="studioPrivateNotes" rows="6" placeholder="'+t('Private notes…','Личные заметки…')+'"></textarea><div class="lesson-plan-row"><input id="lessonPlanText" placeholder="'+t('Lesson stage','Этап урока')+'"><input id="lessonPlanMinutes" type="number" min="1" value="10"><button class="btn" id="lessonPlanStart">'+t('Start timer','Запустить')+'</button></div><div class="plan-timer" id="lessonPlanTimer">10:00</div>';
  side.insertBefore(privateTools, document.getElementById('linksTitle')?.closest('.studio-section') || null); sections.push(privateTools);
  const notesKey='duvela.live.notes.'+(new URLSearchParams(location.search).get('s')||'new');
  const notes=privateTools.querySelector('#studioPrivateNotes'); notes.value=localStorage.getItem(notesKey)||''; notes.addEventListener('input',()=>localStorage.setItem(notesKey,notes.value));
  function openPrivateTools(){ showTab('materials'); notes.focus(); }
  document.getElementById('studioNotesBtn').addEventListener('click',openPrivateTools); document.getElementById('studioPlanBtn').addEventListener('click',openPrivateTools);
  const peopleSection=document.getElementById('guestRequestsSection');if(peopleSection){peopleSection.insertAdjacentHTML('afterbegin','<div class="moderator-box"><h3>'+t('Moderator','Модератор')+'</h3><p>'+t('Add a trusted Duvela user by profile ID.','Добавьте доверенного пользователя Duvela по ID профиля.')+'</p><div class="lesson-plan-row"><input id="moderatorUserId" placeholder="User UUID"><button class="btn" id="addModerator">'+t('Add','Добавить')+'</button></div></div>');document.getElementById('addModerator').addEventListener('click',async()=>{try{await api.addModerator(document.getElementById('moderatorUserId').value.trim());alert(t('Moderator added.','Модератор добавлен.'));}catch(error){alert(error.message);}});}
  const boardRow=document.getElementById('whiteboardLabel')?.closest('.option-row');
  if(boardRow){boardRow.insertAdjacentHTML('afterend','<div class="option-row"><span>'+t('Board tools','Инструменты доски')+'</span><div style="display:flex;gap:8px;align-items:center"><input type="color" id="boardColor" value="#6d3fe0" title="Color"><input type="range" id="boardWidth" min="2" max="18" value="5" title="Line width"></div></div>'); const update=()=>api.setBoardTool(document.getElementById('boardColor').value,document.getElementById('boardWidth').value);document.getElementById('boardColor').addEventListener('input',update);document.getElementById('boardWidth').addEventListener('input',update);}
  let planTimer=null; privateTools.querySelector('#lessonPlanStart').addEventListener('click',()=>{ clearInterval(planTimer); let seconds=Math.max(1,Number(privateTools.querySelector('#lessonPlanMinutes').value)||10)*60; const out=privateTools.querySelector('#lessonPlanTimer'); const draw=()=>{out.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'); if(seconds--<=0){clearInterval(planTimer);out.classList.add('done');}}; draw(); planTimer=setInterval(draw,1000); });

  const modal=document.createElement('div'); modal.className='prelive-modal open'; modal.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('PRE-LIVE CHECK','ПРОВЕРКА ПЕРЕД ЭФИРОМ')+'</span><h2>'+t('Ready to enter the studio?','Готовы войти в студию?')+'</h2><p>'+t('Choose devices and confirm the connection before broadcasting.','Выберите устройства и проверьте соединение перед эфиром.')+'</p><div class="prelive-preview"><video autoplay muted playsinline></video></div><label>'+t('Camera','Камера')+'<select id="preCamera"></select></label><label>'+t('Microphone','Микрофон')+'<select id="preMic"></select></label><div class="mic-meter"><i></i></div><div class="preflight-status"><span>● '+(navigator.onLine?t('Internet ready','Интернет готов'):t('Offline','Нет сети'))+'</span><span id="preNetwork">'+(navigator.connection?.effectiveType||t('Checking…','Проверка…'))+'</span></div><button class="btn primary" id="enterStudio">'+t('Enter studio','Войти в студию')+'</button></div>';
  document.body.appendChild(modal);
  async function loadDevices(){
    try {
      meterStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); modal.querySelector('video').srcObject=meterStream;
      const devices=await navigator.mediaDevices.enumerateDevices(); const cam=modal.querySelector('#preCamera'),mic=modal.querySelector('#preMic');
      cam.innerHTML=devices.filter(d=>d.kind==='videoinput').map((d,i)=>'<option value="'+d.deviceId+'">'+(d.label||t('Camera ','Камера ')+(i+1))+'</option>').join('');
      mic.innerHTML=devices.filter(d=>d.kind==='audioinput').map((d,i)=>'<option value="'+d.deviceId+'">'+(d.label||t('Microphone ','Микрофон ')+(i+1))+'</option>').join('');
      const context=new AudioContext(),source=context.createMediaStreamSource(meterStream),analyser=context.createAnalyser(),data=new Uint8Array(analyser.frequencyBinCount); source.connect(analyser);
      const draw=()=>{analyser.getByteFrequencyData(data); const level=data.reduce((a,b)=>a+b,0)/data.length/255; modal.querySelector('.mic-meter i').style.width=Math.min(100,level*260)+'%'; meterFrame=requestAnimationFrame(draw);}; draw();
    } catch(error){ modal.querySelector('.preflight-status').innerHTML='<span class="bad">'+error.message+'</span>'; }
  }
  modal.querySelector('#enterStudio').addEventListener('click',async()=>{ const cam=modal.querySelector('#preCamera').value,mic=modal.querySelector('#preMic').value; cancelAnimationFrame(meterFrame); meterStream?.getTracks().forEach(track=>track.stop()); try{await api.setDevices(cam,mic);}catch(_){} modal.classList.remove('open'); });
  loadDevices();

  let reportShown=false,wasLive=false;
  new MutationObserver(()=>{
    const status=document.getElementById('statusText')?.textContent||'';
    if(api.isPublishing()){wasLive=true;return;}
    if(reportShown||!wasLive||!/Ended|Заверш/i.test(status))return;
    reportShown=true; const stats=api.getStats();const report=document.createElement('div');report.className='prelive-modal open';report.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('SESSION REPORT','ОТЧЁТ ОБ ЭФИРЕ')+'</span><h2>'+t('Broadcast completed','Эфир завершён')+'</h2><div class="studio-metrics"><div class="studio-metric"><span>'+t('Duration','Длительность')+'</span><b>'+(document.getElementById('elapsedText')?.textContent||'00:00')+'</b></div><div class="studio-metric"><span>'+t('Peak viewers','Пик зрителей')+'</span><b>'+stats.peakViewers+'</b></div><div class="studio-metric"><span>'+t('Reactions','Реакции')+'</span><b>'+stats.reactions+'</b></div><div class="studio-metric"><span>'+t('Messages','Сообщения')+'</span><b>'+stats.messages+'</b></div><div class="studio-metric"><span>'+t('Guests','Гости')+'</span><b>'+stats.guests+'</b></div></div><button class="btn primary">'+t('Close report','Закрыть отчёт')+'</button></div>';document.body.appendChild(report);report.querySelector('button').onclick=()=>report.remove();
  }).observe(document.getElementById('statusText'),{childList:true,subtree:true});
})();
