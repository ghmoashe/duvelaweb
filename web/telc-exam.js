// telc Deutsch A1 exam runner. Consumes web/content/telc-a1-exam-bank.json
// (original content in telc A1 format). Hören/Lesen auto-scored; Schreiben +
// Sprechen scored by the practice-ai-evaluate edge function. Results include a
// review (correct answers + explanations) and are saved to telc_exam_attempts.
const app = document.getElementById('app');
const timerEl = document.getElementById('timer');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[.,;:!?]/g, '');

let bank = null;   // whole file
let exam = null;   // chosen Modelltest
let supa = null;
const state = { sec: 0, part: 0, idx: 0, answers: {}, scores: {}, ai: {}, review: [], audio: {} };
let timerId = null;

await new Promise((res) => {
  if (window.DuvelaWebConfig) return res();
  const s = document.createElement('script');
  s.src = '/web/duvela-web-config.js'; s.onload = res; s.onerror = res;
  document.head.append(s);
});
try { supa = window.DuvelaWebConfig?.createSupabaseClient?.(); } catch { supa = null; }

try {
  bank = await (await fetch('./web/content/telc-a1-exam-bank.json')).json();
} catch {
  app.innerHTML = '<div class="card"><h2>Prüfung konnte nicht geladen werden.</h2></div>';
}
if (bank) pickAndIntro();

// ---------- helpers ----------
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch { voices = []; } }
loadVoices();
try { speechSynthesis.onvoiceschanged = loadVoices; } catch {}
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = 0.9;
    const de = voices.find((v) => /de[-_]/i.test(v.lang));
    if (de) u.voice = de;
    speechSynthesis.speak(u);
  } catch {}
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } timerEl.hidden = true; }
function startTimer(minutes, onEnd) {
  stopTimer();
  let left = minutes * 60; timerEl.hidden = false;
  const tick = () => {
    timerEl.textContent = `${String((left / 60) | 0).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    if (left <= 0) { stopTimer(); onEnd?.(); return; }
    left--;
  };
  tick(); timerId = setInterval(tick, 1000);
}
function stepsBar() {
  return '<div class="steps">' + exam.sections.map((s, i) =>
    `<span class="${i < state.sec ? 'done' : i === state.sec ? 'now' : ''}">${esc(s.title)}</span>`).join('') + '</div>';
}

// ---------- intro ----------
function pickAndIntro() {
  exam = bank.tests[Math.floor(Math.random() * bank.tests.length)];
  intro();
}
function intro() {
  stopTimer();
  const totalMin = exam.sections.reduce((a, s) => a + (s.durationMin || 0), 0);
  app.innerHTML = `
    <div class="card">
      <h1>telc Deutsch A1 – ${esc(exam.title)}</h1>
      <p class="muted small">${esc(bank.note || '')}</p>
      ${stepsBar()}
      <div style="margin:16px 0" class="muted">
        <div class="row" style="justify-content:space-between"><span>Dauer</span><b>${totalMin} Min</b></div>
        <div class="row" style="justify-content:space-between"><span>Bestehen ab</span><b>${bank.passMark}%</b></div>
      </div>
      ${exam.sections.map((s) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-top:1px solid #2a2338"><span>${esc(s.title)}</span><span class="muted small">${s.durationMin} Min · max ${s.maxPoints}${s.aiGraded ? ' · KI' : ''}</span></div>`).join('')}
      <button class="btn primary" id="start" style="margin-top:16px">Prüfung starten →</button>
      <button class="btn ghost" id="switch" style="margin-top:8px;width:100%">Anderer Modelltest</button>
      ${!supa ? '<p class="small muted center" style="margin-top:10px">Ohne Anmeldung: Schreiben/Sprechen ohne KI, kein Speichern.</p>' : ''}
    </div>`;
  document.getElementById('start').onclick = () => { Object.assign(state, { sec: 0, part: 0, idx: 0, answers: {}, scores: {}, ai: {}, review: [], audio: {} }); startSection(); };
  document.getElementById('switch').onclick = pickAndIntro;
}

// ---------- section flow ----------
function startSection() {
  const section = exam.sections[state.sec];
  if (!section) return results();
  state.part = 0; state.idx = 0;
  sectionIntro(section);
}
function sectionIntro(section) {
  stopTimer();
  app.innerHTML = `
    <div class="card">
      ${stepsBar()}
      <h1 style="margin-top:12px">${esc(section.title)}</h1>
      <p class="muted">${esc(section.instructions || '')}</p>
      <div class="row" style="justify-content:space-between;margin:14px 0">
        <span class="muted">Zeit: <b>${section.durationMin} Min</b></span>
        <span class="muted">max ${section.maxPoints} Punkte</span>
      </div>
      <button class="btn primary" id="go">Los geht's →</button>
    </div>`;
  document.getElementById('go').onclick = () => { startTimer(section.durationMin, () => nextPart(section)); renderPart(); };
}
function nextPart(section) {
  if (state.part + 1 < section.parts.length) { state.part++; state.idx = 0; renderPart(); }
  else finishSection(section);
}
function finishSection(section) {
  stopTimer();
  if (section.id === 'hoeren' || section.id === 'lesen') scoreAuto(section);
  state.sec++; startSection();
}
function renderPart() {
  const section = exam.sections[state.sec];
  const part = section.parts[state.part];
  const t = part.type;
  if (t === 'audio-choice') return renderAudioChoice(section, part);
  if (t === 'audio-truefalse') return renderTrueFalse(section, part, true);
  if (t === 'read-truefalse') return renderTrueFalse(section, part, false);
  if (t === 'read-match') return renderMatch(section, part);
  if (t === 'form-fill') return renderForm(section, part);
  if (t === 'free-write') return renderWrite(section, part);
  if (t === 'speak-intro' || t === 'speak-cards') return renderSpeak(section, part);
  return nextPart(section);
}

// ---------- Hören ----------
function renderAudioChoice(section, part) {
  const item = part.items[state.idx];
  let sel = state.answers[item.id];
  const plays = { n: 0 };
  app.innerHTML = shell(section, part,
    `<button class="btn primary listen-btn" id="play">▶ Text abspielen</button>
     <div class="plays" id="plays">Sie können den Text 2× hören.</div>
     <div class="q">${esc(item.question)}</div>
     <div class="opts">${item.options.map((o, i) => `<button class="opt ${sel === i ? 'sel' : ''}" data-i="${i}">${esc(String.fromCharCode(97 + i))}) ${esc(o)}</button>`).join('')}</div>`,
    () => sel != null);
  document.getElementById('play').onclick = () => { if (plays.n >= 2) return; plays.n++; speak(item.transcript); document.getElementById('plays').textContent = plays.n >= 2 ? 'Keine weiteren Wiederholungen.' : `Wiedergabe ${plays.n}/2`; };
  app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { sel = Number(b.dataset.i); state.answers[item.id] = sel; app.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel')); b.classList.add('sel'); enableNext(true); });
  wireNext(section, part);
}
function renderTrueFalse(section, part, isAudio) {
  const item = part.items[state.idx];
  let sel = state.answers[item.id];
  const plays = { n: 0 };
  const context = isAudio
    ? `<button class="btn primary listen-btn" id="play">▶ Durchsage abspielen</button><div class="plays" id="plays">Sie können 2× hören.</div>`
    : (item.sign ? `<div class="passage"><span class="label">HINWEIS</span>${esc(item.sign)}</div>` : passageFor(part, item));
  app.innerHTML = shell(section, part,
    `${context}<div class="q">${esc(item.statement)}</div>
     <div class="tf">
       <button class="opt ${sel === true ? 'sel' : ''}" data-v="true">✓ Richtig</button>
       <button class="opt ${sel === false ? 'sel' : ''}" data-v="false">✗ Falsch</button>
     </div>`,
    () => sel != null);
  if (isAudio) document.getElementById('play').onclick = () => { if (plays.n >= 2) return; plays.n++; speak(item.transcript); document.getElementById('plays').textContent = plays.n >= 2 ? 'Keine weiteren Wiederholungen.' : `Wiedergabe ${plays.n}/2`; };
  app.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { sel = b.dataset.v === 'true'; state.answers[item.id] = sel; app.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel')); b.classList.add('sel'); enableNext(true); });
  wireNext(section, part);
}
function passageFor(part, item) {
  if (!part.texts) return '';
  const text = part.texts.find((t) => t.id === item.textRef);
  return text ? `<div class="passage"><span class="label">${esc(text.label || 'TEXT')}</span>${esc(text.body)}</div>` : '';
}
function renderMatch(section, part) {
  const item = part.items[state.idx];
  let sel = state.answers[item.id];
  const ads = (part.ads || []).map((a) => `<div class="passage"><span class="label">Anzeige ${esc(a.label)}</span>${esc(a.body)}</div>`).join('');
  app.innerHTML = shell(section, part,
    `${ads}<div class="q">${esc(item.situation)}</div>
     <div class="tf">${item.options.map((o, i) => `<button class="opt ${sel === i ? 'sel' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`,
    () => sel != null);
  app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { sel = Number(b.dataset.i); state.answers[item.id] = sel; app.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel')); b.classList.add('sel'); enableNext(true); });
  wireNext(section, part);
}

// ---------- Schreiben ----------
function renderForm(section, part) {
  app.innerHTML = shell(section, part,
    `<div class="passage"><span class="label">SITUATION</span>${esc(part.instructions)}</div>
     ${part.fields.map((f) => `<div class="field"><label>${esc(f.label)}</label><input id="fld-${f.id}" value="${esc(state.answers[f.id] || '')}" autocomplete="off"></div>`).join('')}`,
    () => true, 'Weiter →');
  wireNext(section, part, () => { part.fields.forEach((f) => { state.answers[f.id] = document.getElementById('fld-' + f.id).value.trim(); }); });
}
function renderWrite(section, part) {
  app.innerHTML = shell(section, part,
    `<div class="passage"><span class="label">AUFGABE</span>${esc(part.instructions)}</div>
     <ul class="leit muted">${part.leitpunkte.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
     <textarea id="write" placeholder="Schreiben Sie hier … (mind. ${part.minWords} Wörter)">${esc(state.answers[part.id] || '')}</textarea>
     <div class="small muted" id="wc" style="margin-top:6px">0 Wörter</div>`,
    () => true, 'Absenden →');
  const ta = document.getElementById('write'), wc = document.getElementById('wc');
  const count = () => { wc.textContent = ta.value.trim().split(/\s+/).filter(Boolean).length + ' Wörter'; };
  ta.oninput = count; count();
  wireNext(section, part, () => { state.answers[part.id] = ta.value.trim(); });
}

// ---------- Sprechen (audio recording + transcript) ----------
function renderSpeak(section, part) {
  const cards = part.type === 'speak-intro'
    ? `<div style="margin:10px 0">${part.prompts.map((p) => `<span class="pill">${esc(p)}</span>`).join('')}</div>`
    : `<div style="margin:10px 0">${part.cards.map((c) => `<span class="pill">${esc(c.keyword)}</span>`).join('')}<p class="small muted">Beispiel: „${esc(part.cards[0].example)}"</p>`;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  app.innerHTML = shell(section, part,
    `<div class="passage"><span class="label">AUFGABE</span>${esc(part.instructions)}</div>${cards}
     ${(Rec || canRecord) ? `<button class="btn primary" id="rec">🎙 Aufnahme starten</button>
       <div class="small muted center" id="recstate" style="margin-top:8px">Tippen und sprechen Sie.</div>
       <audio id="playback" controls hidden style="width:100%;margin-top:10px"></audio>` : '<p class="small muted">Bitte tippen Sie Ihre Antwort.</p>'}
     <textarea id="say" placeholder="Ihre Antwort (Transkript)…" style="margin-top:10px">${esc(state.answers[part.id] || '')}</textarea>`,
    () => true, 'Absenden →');
  const say = document.getElementById('say');
  const recBtn = document.getElementById('rec');
  if (recBtn) {
    let rec = null, mediaRec = null, chunks = [], stream = null, on = false;
    let finalText = say.value ? say.value + ' ' : '';
    const setState = (t) => { const st = document.getElementById('recstate'); if (st) st.textContent = t; };
    recBtn.onclick = async () => {
      if (on) { try { rec?.stop(); } catch {} try { mediaRec?.stop(); } catch {} return; }
      chunks = [];
      if (canRecord) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRec = new MediaRecorder(stream);
          mediaRec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          mediaRec.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: mediaRec.mimeType || 'audio/webm' });
            const url = URL.createObjectURL(blob);
            state.audio[part.id] = url;
            const pb = document.getElementById('playback'); if (pb) { pb.src = url; pb.hidden = false; }
          };
          mediaRec.start();
        } catch { /* mic denied: transcript only */ }
      }
      if (Rec) {
        rec = new Rec(); rec.lang = 'de-DE'; rec.interimResults = true; rec.continuous = true;
        rec.onresult = (e) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; say.value = finalText + t; };
        rec.onend = () => { finalText = say.value ? say.value + ' ' : finalText; };
        try { rec.start(); } catch {}
      }
      on = true; recBtn.textContent = '⏹ Aufnahme stoppen'; setState('Aufnahme läuft… sprechen Sie.');
      const stopAll = () => { on = false; recBtn.textContent = '🎙 Aufnahme starten'; setState('Aufnahme gestoppt.'); };
      if (mediaRec) mediaRec.addEventListener('stop', stopAll, { once: true });
      if (rec) rec.addEventListener?.('end', stopAll, { once: true });
      if (!mediaRec && !rec) stopAll();
    };
  }
  wireNext(section, part, () => { state.answers[part.id] = say.value.trim(); });
}

// ---------- shell + nav ----------
function shell(section, part, inner, canProceed, nextLabel) {
  const total = part.items ? part.items.length : 1;
  const cur = part.items ? state.idx + 1 : 1;
  return `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div><small class="muted" style="font-weight:800">${esc(section.title)} · ${esc(part.title)}</small></div>
        <div class="muted small">${cur} / ${total}</div>
      </div>
      <div class="prog"><i style="width:${Math.round((cur / total) * 100)}%"></i></div>
      <p class="muted small">${esc(part.instructions || '')}</p>
      ${inner}
      <button class="btn primary" id="next" style="margin-top:16px" ${canProceed && canProceed() ? '' : 'disabled'}>${esc(nextLabel || 'Weiter →')}</button>
    </div>`;
}
function enableNext(ok) { const b = document.getElementById('next'); if (b) b.disabled = !ok; }
function wireNext(section, part, collect) {
  const b = document.getElementById('next'); if (!b) return;
  b.onclick = () => {
    collect?.();
    const total = part.items ? part.items.length : 1;
    if (part.items && state.idx + 1 < total) { state.idx++; renderPart(); return; }
    if (section.aiGraded && (part.type === 'free-write' || part.type === 'speak-intro' || part.type === 'speak-cards')) {
      gradeAi(section, part).then(() => nextPart(section));
    } else nextPart(section);
  };
}

// ---------- scoring + review ----------
function labelChoice(item, part, val) {
  if (part.type === 'audio-truefalse' || part.type === 'read-truefalse') return val === true ? 'Richtig' : val === false ? 'Falsch' : '—';
  if (part.type === 'read-match') return val != null ? `Anzeige ${item.options[val]}` : '—';
  return val != null && item.options ? item.options[val] : '—';
}
function scoreAuto(section) {
  let got = 0, max = 0;
  section.parts.forEach((part) => (part.items || []).forEach((item) => {
    max++;
    const ans = state.answers[item.id];
    const ok = item.answer !== undefined && ans !== undefined && ans === item.answer;
    if (ok) got++;
    state.review.push({
      sec: section.title, part: part.title,
      q: item.question || item.statement || item.situation,
      your: labelChoice(item, part, ans),
      correct: labelChoice(item, part, item.answer),
      ok, explain: item.explain || '',
    });
  }));
  state.scores[section.id] = { pts: Math.round((got / Math.max(1, max)) * section.maxPoints), max: section.maxPoints, got, items: max };
}
async function gradeAi(section, part) {
  loading('Ihre Antwort wird bewertet…');
  const isWrite = part.type === 'free-write';
  const answer = state.answers[part.id] || '';
  let result = null;
  if (supa && answer.length >= 4) {
    try {
      const { data } = await supa.functions.invoke('practice-ai-evaluate', {
        body: { action: isWrite ? 'evaluate-writing' : 'evaluate-speaking', [isWrite ? 'text' : 'transcript']: answer, language: 'de', level: 'A1', nativeLocale: 'ru-RU', prompt: part.instructions },
      });
      result = data && !data.error ? data : null;
    } catch { result = null; }
  }
  const maxPts = part.rubric?.maxPoints || section.maxPoints;
  const pts = (result && typeof result.score === 'number') ? Math.round((result.score / 100) * maxPts) : Math.round(heuristicBand(answer, part) * maxPts);
  const prev = state.scores[section.id] || { pts: 0, max: section.maxPoints };
  state.scores[section.id] = { pts: (prev.pts || 0) + pts, max: section.maxPoints };
  state.ai[part.id] = result;
  state.review.push({ sec: section.title, part: part.title, q: part.instructions, your: answer || '—', correct: '', ok: pts >= maxPts * 0.6, explain: result?.summary || result?.nextStep || 'Antwort erfasst.' });
}
function heuristicBand(answer, part) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 4) return 0;
  return Math.max(0.3, Math.min(1, words / (part.minWords || 12) * 0.8));
}

// ---------- results ----------
function loading(msg) { app.innerHTML = `<div class="card center"><div class="spinner"></div><p class="muted">${esc(msg)}</p></div>`; }
async function results() {
  stopTimer();
  const schreiben = exam.sections.find((s) => s.id === 'schreiben');
  const formPart = schreiben?.parts.find((p) => p.type === 'form-fill');
  if (formPart) {
    let ok = 0;
    formPart.fields.forEach((f) => {
      const good = norm(state.answers[f.id]) === norm(f.expected);
      if (good) ok++;
      state.review.push({ sec: 'Schreiben', part: 'Formular', q: f.label, your: state.answers[f.id] || '—', correct: f.expected, ok: good, explain: '' });
    });
    const prev = state.scores.schreiben || { pts: 0, max: schreiben.maxPoints };
    state.scores.schreiben = { pts: (prev.pts || 0) + Math.round((ok / formPart.fields.length) * 5), max: schreiben.maxPoints };
  }
  const weights = bank.weights || {};
  let weightedSum = 0, weightTotal = 0;
  const rows = exam.sections.map((s) => {
    const sc = state.scores[s.id] || { pts: 0, max: s.maxPoints };
    const pct = Math.round((sc.pts / Math.max(1, sc.max)) * 100);
    const w = weights[s.id] || 25;
    weightedSum += pct * w; weightTotal += w;
    return { id: s.id, title: s.title, pts: sc.pts, max: sc.max, pct };
  });
  const overall = Math.round(weightedSum / Math.max(1, weightTotal));
  const passed = overall >= bank.passMark;
  const sectionScores = rows.reduce((o, r) => (o[r.id] = { pts: r.pts, max: r.max, pct: r.pct }, o), {});
  const saved = await saveAttempt(overall, passed, sectionScores);

  app.innerHTML = `
    <div class="card center">
      <small class="muted" style="font-weight:800">ERGEBNIS · ${esc(exam.title)}</small>
      <div class="result-score ${passed ? 'pass' : 'fail'}">${overall}%</div>
      <div class="result-band ${passed ? 'pass' : 'fail'}">${passed ? '✓ Bestanden' : 'Noch nicht bestanden'}</div>
      <p class="muted small">Bestehen ab ${bank.passMark}% ${saved ? '· gespeichert ✓' : ''}</p>
    </div>
    <div class="card">
      ${rows.map((r) => `<div class="bar"><b>${esc(r.title)}</b><div class="track"><i style="width:${r.pct}%"></i></div><span class="small muted">${r.pct}%</span></div>`).join('')}
    </div>
    <div class="card">
      <h2>Auswertung</h2>
      <p class="muted small">Ihre Antworten mit Lösung und Erklärung.</p>
      ${reviewHtml()}
    </div>
    <div class="card">
      <button class="btn primary" id="again">Neue Prüfung</button>
      <button class="btn ghost" id="home" style="margin-top:8px;width:100%">Zur Startseite</button>
    </div>`;
  document.getElementById('again').onclick = pickAndIntro;
  document.getElementById('home').onclick = () => { location.href = './app.html?role=learner#study'; };
}
function reviewHtml() {
  return state.review.map((r) => `
    <div class="review ${r.ok ? 'ok' : 'bad'}">
      <div class="review-head"><span>${r.ok ? '✓' : '✗'}</span><small class="muted">${esc(r.sec)} · ${esc(r.part)}</small></div>
      <div class="review-q">${esc(r.q || '')}</div>
      <div class="small"><span class="muted">Ihre Antwort:</span> ${esc(r.your)}</div>
      ${r.correct ? `<div class="small"><span class="muted">Richtig:</span> <b>${esc(r.correct)}</b></div>` : ''}
      ${r.explain ? `<div class="small muted" style="margin-top:4px">${esc(r.explain)}</div>` : ''}
    </div>`).join('');
}
async function saveAttempt(pct, passed, sectionScores) {
  if (!supa) return false;
  try {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return false;
    const { error } = await supa.from('telc_exam_attempts').insert({ user_id: user.id, exam: bank.exam, level: bank.level, score_pct: pct, passed, section_scores: sectionScores });
    return !error;
  } catch { return false; }
}
