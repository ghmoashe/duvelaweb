(function () {
  const api = window.DuvelaLiveStudioApi;
  if (!api) return;
  const ru = (localStorage.getItem('duvela.web.lang') || navigator.language || '').toLowerCase().startsWith('ru');
  const t = (en, rus) => ru ? rus : en;
  const reactionDock=document.createElement('div');reactionDock.className='reaction-dock';reactionDock.innerHTML=['👏','❤️','🔥','😂','💡'].map(emoji=>'<button type="button">'+emoji+'</button>').join('');document.querySelector('.stage')?.appendChild(reactionDock);reactionDock.addEventListener('click',async(event)=>{const button=event.target.closest('button');if(!button)return;try{await api.sendReaction(button.textContent);}catch(error){console.warn(error);}});
  window.addEventListener('duvela:studio-event', (event) => {
    const data=event.detail||{};
    if(data.kind==='poll'&&!api.isHost){
      document.querySelector('.studio-poll')?.remove();
      const poll=document.createElement('aside');poll.className='studio-poll';
      const title=document.createElement('h3');title.textContent=data.question||t('Quick poll','Быстрый опрос');poll.appendChild(title);
      (data.options||[]).forEach((option,index)=>{const button=document.createElement('button');button.className='btn';button.textContent=option;button.onclick=async()=>{button.parentElement.querySelectorAll('button').forEach(node=>node.disabled=true);button.classList.add('primary');try{await api.broadcastEvent({kind:'poll-vote',pollId:data.id,option:index});}catch(_){}setTimeout(()=>poll.remove(),1200);};poll.appendChild(button);});
      document.body.appendChild(poll);
    }
    if(data.kind==='poll-close') document.querySelector('.studio-poll')?.remove();
  });
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

  const setupGroup=side.querySelector('[data-studio-group="setup"]');
  const production=document.createElement('section');production.className='studio-section';production.dataset.studioGroup='setup';production.innerHTML='<div class="studio-tool-card"><h3>'+t('Production controls','Управление эфиром')+'</h3><p>'+t('Preview a layout privately, then send it to viewers. Drag the camera directly on the stage and use the size slider.','Сначала проверьте сцену у себя, затем отправьте её зрителям. Камеру можно перетаскивать прямо на сцене и менять её размер.')+'</p><div class="studio-inline"><select id="previewScene"><option value="camera">'+t('Camera','Камера')+'</option><option value="presentation">'+t('Presentation + camera','Экран и камера')+'</option><option value="board">'+t('Whiteboard','Доска')+'</option><option value="focus">'+t('Focus','Фокус')+'</option></select><button class="btn" id="previewSceneBtn">'+t('Preview','Предпросмотр')+'</button><button class="btn primary" id="commitSceneBtn">'+t('Send live','В эфир')+'</button></div><label>'+t('Camera window size','Размер окна камеры')+'<input id="cameraPipSize" type="range" min="18" max="55" value="27"></label><label>'+t('Microphone level','Громкость микрофона')+'<input id="studioMicVolume" type="range" min="0" max="100" value="100"></label><div class="studio-health"><span id="studioNet">'+t('Network: checking','Сеть: проверка')+'</span><span id="studioMicState">'+t('Mic: ready','Микрофон: готов')+'</span><span id="studioEcho">AEC '+t('enabled','включён')+'</span><span id="studioNoise">ANS '+t('enabled','включён')+'</span></div></div>';
  side.insertBefore(production,setupGroup||side.firstChild);sections.push(production);
  let previewing=false;
  const previewBanner=document.createElement('div');previewBanner.className='studio-preview-banner';previewBanner.textContent=t('PRIVATE PREVIEW','ЛИЧНЫЙ ПРЕДПРОСМОТР');previewBanner.hidden=true;document.querySelector('.stage')?.appendChild(previewBanner);
  production.querySelector('#previewSceneBtn').onclick=()=>{api.previewScene(production.querySelector('#previewScene').value);previewing=true;previewBanner.hidden=false;};
  production.querySelector('#commitSceneBtn').onclick=()=>{api.setScene(production.querySelector('#previewScene').value);previewing=false;previewBanner.hidden=true;};
  production.querySelector('#studioMicVolume').oninput=(event)=>api.setMicrophoneVolume(event.target.value);
  const camera=()=>document.getElementById('hostCameraPreview')||document.getElementById('deeparCanvas');
  production.querySelector('#cameraPipSize').oninput=(event)=>{const node=camera();if(!node)return;node.classList.add('camera-pip-edit');node.style.setProperty('width',event.target.value+'%','important');node.style.setProperty('height',Math.round(event.target.value*.62)+'%','important');};
  let drag=null;document.querySelector('.stage')?.addEventListener('pointerdown',(event)=>{const node=event.target.closest('#hostCameraPreview,#deeparCanvas');if(!node||!document.body.classList.contains('scene-presentation'))return;event.preventDefault();node.classList.add('camera-pip-edit');const rect=node.getBoundingClientRect(),stageRect=node.closest('.stage').getBoundingClientRect();drag={node,dx:event.clientX-rect.left,dy:event.clientY-rect.top,stageRect};node.setPointerCapture?.(event.pointerId);});
  window.addEventListener('pointermove',(event)=>{if(!drag)return;const x=Math.max(0,Math.min(drag.stageRect.width-drag.node.offsetWidth,event.clientX-drag.stageRect.left-drag.dx));const y=Math.max(0,Math.min(drag.stageRect.height-drag.node.offsetHeight,event.clientY-drag.stageRect.top-drag.dy));drag.node.style.setProperty('left',x+'px','important');drag.node.style.setProperty('top',y+'px','important');drag.node.style.setProperty('right','auto','important');drag.node.style.setProperty('bottom','auto','important');});window.addEventListener('pointerup',()=>drag=null);

  const peopleTools=document.createElement('div');peopleTools.className='studio-tool-card';peopleTools.innerHTML='<h3>'+t('Raised hands and guests','Поднятые руки и гости')+'</h3><p>'+t('Requests below form the speaking queue. Approve a learner to invite them on stage; reject to remove them from the queue.','Запросы ниже образуют очередь выступающих. Одобрите ученика, чтобы пригласить его на сцену, или отклоните, чтобы убрать из очереди.')+'</p><div class="studio-inline"><span>✋ '+t('Queue is ordered by request time','Очередь по времени запроса')+'</span></div>';
  peopleSection?.insertBefore(peopleTools,peopleSection.firstChild);if(document.getElementById('guestRequestsTitle'))document.getElementById('guestRequestsTitle').textContent=t('Raised-hand queue','Очередь поднятых рук');

  const pollBox=document.createElement('div');pollBox.className='studio-tool-card';pollBox.innerHTML='<h3>'+t('Live poll','Опрос в эфире')+'</h3><input id="pollQuestion" placeholder="'+t('Question','Вопрос')+'"><input id="pollOptions" placeholder="'+t('Options separated by commas','Варианты через запятую')+'"><div class="studio-inline"><button class="btn primary" id="startPoll">'+t('Launch poll','Запустить опрос')+'</button><button class="btn" id="closePoll">'+t('Close','Закрыть')+'</button><b id="pollVotes">0 '+t('votes','ответов')+'</b></div>';
  privateTools.appendChild(pollBox);let activePoll='',pollVotes=0;
  pollBox.querySelector('#startPoll').onclick=async()=>{const question=pollBox.querySelector('#pollQuestion').value.trim(),options=pollBox.querySelector('#pollOptions').value.split(',').map(x=>x.trim()).filter(Boolean);if(!question||options.length<2)return alert(t('Enter a question and at least two options.','Введите вопрос и минимум два варианта.'));activePoll=Date.now().toString(36);pollVotes=0;pollBox.querySelector('#pollVotes').textContent='0 '+t('votes','ответов');await api.broadcastEvent({kind:'poll',id:activePoll,question,options});};
  pollBox.querySelector('#closePoll').onclick=async()=>{if(activePoll)await api.broadcastEvent({kind:'poll-close',pollId:activePoll});activePoll='';};
  window.addEventListener('duvela:studio-event',(event)=>{const data=event.detail||{};if(data.kind==='poll-vote'&&data.pollId===activePoll){pollVotes++;pollBox.querySelector('#pollVotes').textContent=pollVotes+' '+t('votes','ответов');}});

  const net=production.querySelector('#studioNet');function setNetwork(ok,label){net.className=ok?'ok':'bad';net.textContent=label;}
  setNetwork(navigator.onLine,navigator.onLine?t('Network: online','Сеть: подключена'):t('Network: offline','Сеть: отсутствует'));
  window.addEventListener('offline',()=>{setNetwork(false,t('Network: reconnecting…','Сеть: переподключение…'));const banner=document.createElement('div');banner.className='reconnect-banner';banner.id='reconnectBanner';banner.textContent=t('Connection lost. The studio will recover automatically.','Связь потеряна. Студия восстановится автоматически.');document.body.appendChild(banner);});
  window.addEventListener('online',async()=>{setNetwork(true,t('Network: restoring…','Сеть: восстановление…'));try{await api.recoverBroadcast();setNetwork(true,t('Network: online','Сеть: подключена'));document.getElementById('reconnectBanner')?.remove();}catch(error){setNetwork(false,t('Reconnect failed','Не удалось восстановить'));}});
  window.addEventListener('duvela:live-connection',(event)=>{const state=event.detail?.current;if(state==='CONNECTED')setNetwork(true,t('Broadcast connection: stable','Соединение эфира: стабильное'));if(state==='RECONNECTING')setNetwork(false,t('Reconnecting broadcast…','Восстановление эфира…'));if(state==='DISCONNECTED')setNetwork(false,t('Broadcast disconnected','Эфир отключён'));});

  const endButton=document.getElementById('endLive');endButton?.addEventListener('click',(event)=>{if(!api.isPublishing())return;event.preventDefault();event.stopImmediatePropagation();const dialog=document.createElement('div');dialog.className='prelive-modal open';dialog.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('END LIVE','ЗАВЕРШЕНИЕ ЭФИРА')+'</span><h2>'+t('End the broadcast for everyone?','Завершить эфир для всех?')+'</h2><p>'+t('Type END to confirm. This stops the stream for every viewer.','Введите ЗАВЕРШИТЬ для подтверждения. Трансляция остановится у всех зрителей.')+'</p><input class="end-confirm-input" placeholder="'+t('END','ЗАВЕРШИТЬ')+'"><div class="studio-inline"><button class="btn" data-cancel>'+t('Cancel','Отмена')+'</button><button class="btn danger" data-end disabled>'+t('End LIVE','Завершить эфир')+'</button></div></div>';document.body.appendChild(dialog);const input=dialog.querySelector('input'),finish=dialog.querySelector('[data-end]');input.oninput=()=>finish.disabled=input.value.trim().toUpperCase()!==t('END','ЗАВЕРШИТЬ');dialog.querySelector('[data-cancel]').onclick=()=>dialog.remove();finish.onclick=async()=>{finish.disabled=true;await api.endBroadcast();dialog.remove();};input.focus();},true);

  let reportShown=false,wasLive=false;
  new MutationObserver(()=>{
    const status=document.getElementById('statusText')?.textContent||'';
    if(api.isPublishing()){wasLive=true;return;}
    if(reportShown||!wasLive||!/Ended|Заверш/i.test(status))return;
    reportShown=true; const stats=api.getStats();const report=document.createElement('div');report.className='prelive-modal open';report.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('SESSION REPORT','ОТЧЁТ ОБ ЭФИРЕ')+'</span><h2>'+t('Broadcast completed','Эфир завершён')+'</h2><div class="studio-metrics"><div class="studio-metric"><span>'+t('Duration','Длительность')+'</span><b>'+(document.getElementById('elapsedText')?.textContent||'00:00')+'</b></div><div class="studio-metric"><span>'+t('Peak viewers','Пик зрителей')+'</span><b>'+stats.peakViewers+'</b></div><div class="studio-metric"><span>'+t('Reactions','Реакции')+'</span><b>'+stats.reactions+'</b></div><div class="studio-metric"><span>'+t('Messages','Сообщения')+'</span><b>'+stats.messages+'</b></div><div class="studio-metric"><span>'+t('Guests','Гости')+'</span><b>'+stats.guests+'</b></div></div><button class="btn primary">'+t('Close report','Закрыть отчёт')+'</button></div>';document.body.appendChild(report);report.querySelector('button').onclick=()=>report.remove();
  }).observe(document.getElementById('statusText'),{childList:true,subtree:true});
})();
