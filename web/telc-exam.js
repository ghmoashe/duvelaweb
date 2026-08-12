// DUVELA EXAM — independent Start Deutsch 1 / telc Deutsch A1 simulation.
const app = document.getElementById('app');
const clockEl = document.getElementById('clock');
const timerEl = document.getElementById('timer');
const timerLabelEl = document.getElementById('timer-label');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[.,;:!?]/g, '');

let bank = null;
let exam = null;
let supa = null;
let timerId = null;
let timerDeadline = 0;
let timerDuration = 0;
let timerCallback = null;
let activeCollector = null;
let activeRecorderCleanup = null;

const state = {
  mode: 'exam',
  selectedTest: '',
  practiceSection: 'all',
  sec: 0,
  part: 0,
  idx: 0,
  answers: {},
  scores: {},
  ai: {},
  review: [],
  audio: {},
  plays: {},
  graded: {},
  autoScored: {},
  formScored: false,
  startTime: 0,
  active: false,
};

await new Promise((resolve) => {
  if (window.DuvelaWebConfig) return resolve();
  const script = document.createElement('script');
  script.src = '/web/duvela-web-config.js';
  script.onload = resolve;
  script.onerror = resolve;
  document.head.append(script);
});
try { supa = window.DuvelaWebConfig?.createSupabaseClient?.() || null; } catch { supa = null; }

try {
  const response = await fetch('./web/content/telc-a1-exam-bank.json');
  if (!response.ok) throw new Error('bank');
  bank = await response.json();
  state.selectedTest = bank.tests?.[0]?.id || '';
  renderSetup();
} catch {
  app.innerHTML = '<section class="paper-card loading-card"><h2>Prüfung konnte nicht geladen werden</h2><p class="muted">Bitte laden Sie die Seite neu.</p></section>';
}

window.addEventListener('beforeunload', (event) => {
  if (!state.active || state.mode !== 'exam') return;
  event.preventDefault();
  event.returnValue = '';
});

// ---------- audio and timer ----------
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch { voices = []; } }
loadVoices();
try { speechSynthesis.onvoiceschanged = loadVoices; } catch {}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    const germanVoice = voices.find((voice) => /de[-_]/i.test(voice.lang));
    if (germanVoice) utterance.voice = germanVoice;
    speechSynthesis.speak(utterance);
    return true;
  } catch { return false; }
}

function stopTimer(hide = true) {
  if (timerId) clearInterval(timerId);
  timerId = null;
  timerDeadline = 0;
  timerCallback = null;
  if (hide) clockEl.hidden = true;
}

function startTimer(minutes, label, onEnd) {
  stopTimer(false);
  timerDuration = Math.max(1, Math.round(minutes * 60));
  timerDeadline = Date.now() + timerDuration * 1000;
  timerCallback = onEnd;
  timerLabelEl.textContent = label;
  clockEl.hidden = false;
  const tick = () => {
    const left = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    const ratio = left / timerDuration;
    clockEl.className = `exam-clock${ratio <= .2 ? ' urgent' : ratio <= .5 ? ' warning' : ''}`;
    if (left > 0) return;
    const callback = timerCallback;
    stopTimer();
    callback?.();
  };
  tick();
  timerId = setInterval(tick, 1000);
}

// ---------- setup ----------
function renderSetup() {
  state.active = false;
  stopTimer();
  cleanupRecorder();
  document.onkeydown = null;
  const testOptions = bank.tests.map((test) => `<option value="${esc(test.id)}" ${test.id === state.selectedTest ? 'selected' : ''}>${esc(test.title)}</option>`).join('');
  const sectionOptions = [
    ['all', 'Komplettes Training'],
    ...bank.tests[0].sections.map((section) => [section.id, section.title]),
  ].map(([value, label]) => `<option value="${esc(value)}" ${value === state.practiceSection ? 'selected' : ''}>${esc(label)}</option>`).join('');

  app.innerHTML = `
    <section class="setup-hero">
      <div class="setup-copy">
        <span class="eyebrow">Deutsch A1 · Prüfungssimulation</span>
        <h1>Üben, als wäre heute <span>Prüfungstag.</span></h1>
        <p class="lead">Ein klarer, realistischer Ablauf mit Hören, Lesen, Schreiben und Sprechen — inklusive Zeitdruck, 60-Punkte-Auswertung und verständlichem Feedback.</p>
        <div class="fact-row"><span>5 Modelltests</span><span>80 Min. Aufgabenzeit</span><span>Bestehen ab 36 / 60</span><span>Originale Übungsinhalte</span></div>
      </div>
      <div class="setup-card">
        <header><div><span class="eyebrow">Prüfung einrichten</span><h3>Wie möchten Sie starten?</h3></div><span>A1</span></header>
        <div class="mode-grid" role="radiogroup" aria-label="Prüfungsmodus">
          <button class="mode-choice ${state.mode === 'exam' ? 'active' : ''}" data-mode="exam" role="radio" aria-checked="${state.mode === 'exam'}"><i>01</i><b>Simulation</b><small>Kompletter Ablauf mit echter Zeitbegrenzung</small></button>
          <button class="mode-choice ${state.mode === 'practice' ? 'active' : ''}" data-mode="practice" role="radio" aria-checked="${state.mode === 'practice'}"><i>02</i><b>Training</b><small>Ohne Zeitdruck, mit direktem Feedback</small></button>
        </div>
        <div class="field"><label for="test-select">Modelltest</label><select id="test-select">${testOptions}</select></div>
        ${state.mode === 'practice' ? `<div class="field"><label for="section-select">Trainingsumfang</label><select id="section-select">${sectionOptions}</select></div>` : ''}
        <div class="setup-actions">
          <button class="button primary" id="continue">${state.mode === 'exam' ? 'Simulation vorbereiten' : 'Training starten'} <span>→</span></button>
          <button class="button secondary" id="sound-check" title="Audio prüfen">Ton prüfen</button>
        </div>
        <p class="exam-note">DUVELA EXAM orientiert sich am Format Start Deutsch 1 / telc Deutsch A1. Die Aufgaben sind eigenständiges Übungsmaterial und kein offizieller telc-Prüfungssatz.</p>
      </div>
      <div class="blueprint" aria-label="Prüfungsaufbau">
        ${blueprintCard('01', 'Hören', '3 Teile · 15 Aufgaben', 'ca. 20 Min.', '15 Punkte')}
        ${blueprintCard('02', 'Lesen', '3 Teile · 15 Aufgaben', 'ca. 25 Min.', '15 Punkte')}
        ${blueprintCard('03', 'Schreiben', 'Formular + Mitteilung', 'ca. 20 Min.', '15 Punkte')}
        ${blueprintCard('04', 'Sprechen', 'Vorstellen · Fragen · Bitten', 'ca. 15 Min.', '15 Punkte')}
      </div>
    </section>`;

  app.querySelectorAll('[data-mode]').forEach((button) => {
    button.onclick = () => { state.mode = button.dataset.mode; renderSetup(); };
  });
  document.getElementById('test-select').onchange = (event) => { state.selectedTest = event.target.value; };
  const sectionSelect = document.getElementById('section-select');
  if (sectionSelect) sectionSelect.onchange = (event) => { state.practiceSection = event.target.value; };
  document.getElementById('sound-check').onclick = () => speak('Guten Tag. Der Ton funktioniert. Sie können die Prüfung beginnen.');
  document.getElementById('continue').onclick = () => {
    exam = bank.tests.find((test) => test.id === state.selectedTest) || bank.tests[0];
    if (state.mode === 'exam') renderPreflight();
    else startSession();
  };
}

function blueprintCard(number, title, description, duration, points) {
  return `<article><header><small>TEIL ${number}</small><span>${number}</span></header><h3>${title}</h3><p>${description}</p><footer><b>${duration}</b><b>${points}</b></footer></article>`;
}

function renderPreflight() {
  app.innerHTML = `
    <section class="preflight">
      <div class="paper-card preflight-main">
        <span class="eyebrow">Vor dem Start</span>
        <h2>Bereit für ${esc(exam.title)}?</h2>
        <p class="lead">Die Simulation folgt dem Ablauf der A1-Prüfung. Antworten und Feedback sehen Sie erst nach dem Abschluss.</p>
        <div class="candidate-strip">
          <span><small>Prüfung</small><b>Deutsch A1</b></span>
          <span><small>Modelltest</small><b>${esc(exam.id.toUpperCase())}</b></span>
          <span><small>Gesamt</small><b>60 Punkte</b></span>
          <span><small>Bestehen</small><b>ab 36 Punkten</b></span>
        </div>
        <div class="check-list">
          ${checkRow('Kopfhörer bereithalten', 'Die Hörtexte werden je nach Prüfungsteil ein- oder zweimal abgespielt.')}
          ${checkRow('80 Minuten freihalten', 'Hören dauert ca. 20 Minuten, Lesen und Schreiben zusammen 45 Minuten, Sprechen ca. 15 Minuten.')}
          ${checkRow('Ohne Hilfsmittel arbeiten', 'Im realen Test sind Wörterbuch, Übersetzer und andere Hilfsmittel nicht erlaubt.')}
          ${checkRow('Ruhigen Ort wählen', 'Die Prüfung läuft ohne Pause. Beim Sprechen benötigt DUVELA Zugriff auf Ihr Mikrofon.')}
        </div>
        <div class="result-actions">
          <button class="button primary" id="begin-exam">Prüfung jetzt starten →</button>
          <button class="button secondary" id="back-setup">Zurück</button>
        </div>
      </div>
      <aside class="paper-card preflight-aside">
        <span class="eyebrow">Offizieller Ablauf</span>
        <h3>Schriftliche Prüfung</h3>
        <div class="format-list"><div><span>Hören</span><small>3 Teile · 20 Min.</small></div><div><span>Lesen + Schreiben</span><small>3 + 2 Teile · 45 Min.</small></div></div>
        <h3>Mündliche Prüfung</h3>
        <div class="format-list"><div><span>Sprechen</span><small>3 Teile · 15 Min.</small></div></div>
        <p class="exam-note">In der echten Prüfung findet Sprechen in der Regel mit vier Teilnehmenden und ohne Vorbereitungszeit statt. Hier simuliert DUVELA die Gesprächssituationen digital.</p>
      </aside>
    </section>`;
  document.getElementById('begin-exam').onclick = startSession;
  document.getElementById('back-setup').onclick = renderSetup;
}

function checkRow(title, text) {
  return `<div class="check-row"><span>✓</span><div><b>${title}</b><p>${text}</p></div></div>`;
}

// ---------- session flow ----------
function resetSession() {
  Object.assign(state, {
    sec: 0, part: 0, idx: 0, answers: {}, scores: {}, ai: {}, review: [], audio: {}, plays: {}, graded: {}, autoScored: {}, formScored: false,
    startTime: Date.now(), active: true,
  });
  if (state.mode === 'practice' && state.practiceSection !== 'all') {
    state.sec = Math.max(0, exam.sections.findIndex((section) => section.id === state.practiceSection));
  }
}

function startSession() {
  if (!exam) exam = bank.tests.find((test) => test.id === state.selectedTest) || bank.tests[0];
  resetSession();
  startSection();
}

function startSection() {
  const section = exam.sections[state.sec];
  if (!section) return results();
  state.part = 0;
  state.idx = 0;
  sectionIntro(section);
}

function sectionIntro(section) {
  cleanupRecorder();
  document.onkeydown = null;
  if (state.mode === 'practice') stopTimer();
  const isReadingBlock = state.mode === 'exam' && section.id === 'lesen';
  const duration = isReadingBlock ? 45 : section.durationMin;
  const parts = isReadingBlock ? '3 Teile Lesen + 2 Teile Schreiben' : `${section.parts.length} Teile`;
  const points = isReadingBlock ? 30 : section.maxPoints;
  app.innerHTML = `
    <section class="paper-card section-intro">
      ${stepsBar()}
      <div class="section-mark">${String(state.sec + 1).padStart(2, '0')}</div>
      <span class="eyebrow">${state.mode === 'practice' ? 'Training' : 'Prüfungsabschnitt'}</span>
      <h2>${isReadingBlock ? 'Lesen und Schreiben' : esc(section.title)}</h2>
      <p class="lead">${esc(isReadingBlock ? 'Lesen Sie die Texte, lösen Sie die Aufgaben und bearbeiten Sie anschließend beide Schreibaufgaben.' : section.instructions || '')}</p>
      <div class="section-meta">
        <span><small>Zeit</small><b>${state.mode === 'practice' ? 'ohne Limit' : `${duration} Minuten`}</b></span>
        <span><small>Aufbau</small><b>${parts}</b></span>
        <span><small>Punkte</small><b>${points} Punkte</b></span>
      </div>
      <p class="exam-note">${sectionRule(section, isReadingBlock)}</p>
      <div class="result-actions"><button class="button primary" id="start-section">${state.mode === 'practice' ? 'Training beginnen' : 'Abschnitt starten'} →</button>${state.mode === 'practice' ? '<button class="button secondary" id="back-setup">Zur Auswahl</button>' : ''}</div>
    </section>`;
  document.getElementById('start-section').onclick = () => {
    if (state.mode === 'exam') {
      if (section.id === 'hoeren') startTimer(20, 'Hören', () => handleTimeout('hoeren'));
      if (section.id === 'lesen') startTimer(45, 'Lesen + Schreiben', () => handleTimeout('lesen-schreiben'));
      if (section.id === 'sprechen') startTimer(15, 'Sprechen', () => handleTimeout('sprechen'));
    }
    renderPart();
  };
  document.getElementById('back-setup')?.addEventListener('click', renderSetup);
}

function sectionRule(section, isReadingBlock) {
  if (state.mode === 'practice') return 'Sie erhalten direkt nach jeder Auswahl eine Lösung und können Aufgaben ohne Zeitdruck bearbeiten.';
  if (section.id === 'hoeren') return 'Teil 1 und Teil 3 hören Sie zweimal. Teil 2 hören Sie einmal. Nicht beantwortete Aufgaben zählen als falsch.';
  if (isReadingBlock) return 'Für Lesen und Schreiben gelten zusammen 45 Minuten. Zwischen beiden Teilen gibt es keine Pause.';
  return 'In der echten Prüfung sprechen Sie mit anderen Teilnehmenden. Hier nehmen Sie Ihre Antworten nacheinander auf.';
}

async function handleTimeout(block) {
  activeCollector?.();
  cleanupRecorder();
  if (block === 'hoeren') {
    scoreAuto(exam.sections.find((section) => section.id === 'hoeren'));
    state.sec = exam.sections.findIndex((section) => section.id === 'lesen');
    startSection();
    return;
  }
  if (block === 'lesen-schreiben') {
    scoreAuto(exam.sections.find((section) => section.id === 'lesen'));
    state.sec = exam.sections.findIndex((section) => section.id === 'sprechen');
    startSection();
    return;
  }
  await results();
}

function nextPart(section) {
  if (state.part + 1 < section.parts.length) {
    state.part++;
    state.idx = 0;
    renderPart();
    return;
  }
  finishSection(section);
}

function finishSection(section) {
  if (section.id === 'hoeren' || section.id === 'lesen') scoreAuto(section);
  if (state.mode === 'practice' && state.practiceSection !== 'all') {
    stopTimer();
    results();
    return;
  }
  if (state.mode === 'exam' && section.id === 'lesen') {
    state.sec = exam.sections.findIndex((item) => item.id === 'schreiben');
    state.part = 0;
    state.idx = 0;
    renderPart();
    return;
  }
  stopTimer();
  state.sec++;
  startSection();
}

function renderPart() {
  cleanupRecorder();
  activeCollector = null;
  document.onkeydown = null;
  const section = exam.sections[state.sec];
  const part = section?.parts?.[state.part];
  if (!part) return nextPart(section);
  if (part.type === 'audio-choice') return renderAudioChoice(section, part);
  if (part.type === 'audio-truefalse') return renderTrueFalse(section, part, true);
  if (part.type === 'read-truefalse') return renderTrueFalse(section, part, false);
  if (part.type === 'read-match') return renderMatch(section, part);
  if (part.type === 'form-fill') return renderForm(section, part);
  if (part.type === 'free-write') return renderWrite(section, part);
  if (part.type === 'speak-intro' || part.type === 'speak-cards') return renderSpeak(section, part);
  nextPart(section);
}

// ---------- receptive tasks ----------
function renderAudioChoice(section, part) {
  const item = part.items[state.idx];
  const selected = state.answers[item.id];
  const limit = audioLimit(part);
  const used = state.plays[item.id] || 0;
  const options = item.options.map((option, index) => `<button class="option ${answerClass(item, selected, index)}" data-answer="${index}"><span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${esc(option)}</span></button>`).join('');
  app.innerHTML = questionShell(section, part, `
    <div class="listen-box"><button class="listen-button" id="play-audio" ${used >= limit ? 'disabled' : ''} aria-label="Hörtext abspielen">▶</button><div><b>Hörtext abspielen</b><small id="play-status">${audioStatus(used, limit)}</small></div></div>
    <div class="question">${esc(item.question)}</div>
    <div class="options">${options}</div>
    ${feedbackHtml(item, part, selected)}`);
  wireAudio(item, part);
  wireChoices(item, part, '[data-answer]');
  wireNavigation(section, part);
  wireChoiceKeys(3);
}

function renderTrueFalse(section, part, isAudio) {
  const item = part.items[state.idx];
  const selected = state.answers[item.id];
  const limit = audioLimit(part);
  const used = state.plays[item.id] || 0;
  const context = isAudio
    ? `<div class="listen-box"><button class="listen-button" id="play-audio" ${used >= limit ? 'disabled' : ''} aria-label="Durchsage abspielen">▶</button><div><b>Durchsage abspielen</b><small id="play-status">${audioStatus(used, limit)}</small></div></div>`
    : (item.sign ? `<div class="passage"><span class="passage-label">Hinweis</span>${esc(item.sign)}</div>` : passageFor(part, item));
  app.innerHTML = questionShell(section, part, `
    ${context}
    <div class="question">${esc(item.statement)}</div>
    <div class="true-false">
      <button class="tf-btn ${answerClass(item, selected, true)}" data-value="true"><span>+</span><span>Richtig</span></button>
      <button class="tf-btn ${answerClass(item, selected, false)}" data-value="false"><span>−</span><span>Falsch</span></button>
    </div>
    ${feedbackHtml(item, part, selected)}`);
  if (isAudio) wireAudio(item, part);
  app.querySelectorAll('[data-value]').forEach((button) => {
    button.onclick = () => { state.answers[item.id] = button.dataset.value === 'true'; renderPart(); };
  });
  wireNavigation(section, part);
  document.onkeydown = (event) => {
    if (isTyping(event)) return;
    if (event.key.toLowerCase() === 'r') app.querySelector('[data-value="true"]')?.click();
    if (event.key.toLowerCase() === 'f') app.querySelector('[data-value="false"]')?.click();
  };
}

function renderMatch(section, part) {
  const item = part.items[state.idx];
  const selected = state.answers[item.id];
  const ads = (part.ads || []).map((ad) => `<div class="passage"><span class="passage-label">Anzeige ${esc(ad.label)}</span>${esc(ad.body)}</div>`).join('');
  const options = item.options.map((option, index) => `<button class="option ${answerClass(item, selected, index)}" data-answer="${index}"><span class="option-letter">${String(option).toUpperCase()}</span><span>Anzeige ${esc(option)}</span></button>`).join('');
  app.innerHTML = questionShell(section, part, `${ads}<div class="question">${esc(item.situation)}</div><div class="options">${options}</div>${feedbackHtml(item, part, selected)}`);
  wireChoices(item, part, '[data-answer]');
  wireNavigation(section, part);
  wireChoiceKeys(item.options.length);
}

function passageFor(part, item) {
  const text = (part.texts || []).find((entry) => entry.id === item.textRef);
  return text ? `<div class="passage"><span class="passage-label">${esc(text.label || 'Text')}</span>${esc(text.body)}</div>` : '';
}

function wireChoices(item, part, selector) {
  app.querySelectorAll(selector).forEach((button) => {
    button.onclick = () => { state.answers[item.id] = Number(button.dataset.answer); renderPart(); };
  });
}

function wireChoiceKeys(count) {
  document.onkeydown = (event) => {
    if (isTyping(event)) return;
    const index = 'abc'.indexOf(event.key.toLowerCase());
    if (index >= 0 && index < count) app.querySelector(`[data-answer="${index}"]`)?.click();
  };
}

function isTyping(event) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
}

function audioLimit(part) {
  return Number(part.plays || (part.type === 'audio-truefalse' ? 1 : 2));
}

function audioStatus(used, limit) {
  if (used >= limit) return 'Keine weitere Wiedergabe möglich.';
  if (used === 0) return `${limit === 1 ? 'Einmalige' : 'Bis zu zweimalige'} Wiedergabe · noch ${limit}`;
  return `Wiedergabe ${used} von ${limit} · noch ${limit - used}`;
}

function wireAudio(item, part) {
  const button = document.getElementById('play-audio');
  if (!button) return;
  button.onclick = () => {
    const limit = audioLimit(part);
    const used = state.plays[item.id] || 0;
    if (used >= limit) return;
    state.plays[item.id] = used + 1;
    speak(item.transcript);
    button.disabled = state.plays[item.id] >= limit;
    document.getElementById('play-status').textContent = audioStatus(state.plays[item.id], limit);
  };
}

function answerClass(item, selected, candidate) {
  if (selected === undefined) return '';
  if (state.mode !== 'practice') return selected === candidate ? 'selected' : '';
  if (candidate === item.answer) return 'correct';
  if (selected === candidate && selected !== item.answer) return 'incorrect';
  return '';
}

function feedbackHtml(item, part, selected) {
  if (state.mode !== 'practice' || selected === undefined) return '';
  const ok = selected === item.answer;
  return `<div class="practice-feedback ${ok ? 'ok' : ''}"><b>${ok ? 'Richtig.' : `Noch nicht. Richtig ist: ${esc(labelChoice(item, part, item.answer))}.`}</b>${esc(item.explain || '')}</div>`;
}

// ---------- productive tasks ----------
function renderForm(section, part) {
  app.innerHTML = questionShell(section, part, `
    <div class="passage"><span class="passage-label">Situation</span>${esc(part.instructions)}</div>
    <div class="form-grid">${part.fields.map((field) => `<div class="field"><label for="field-${esc(field.id)}">${esc(field.label)}</label><input id="field-${esc(field.id)}" value="${esc(state.answers[field.id] || '')}" autocomplete="off"></div>`).join('')}</div>`);
  activeCollector = () => part.fields.forEach((field) => { state.answers[field.id] = document.getElementById(`field-${field.id}`)?.value.trim() || ''; });
  wireNavigation(section, part, activeCollector);
}

function renderWrite(section, part) {
  app.innerHTML = questionShell(section, part, `
    <div class="passage"><span class="passage-label">Aufgabe</span>${esc(part.instructions)}</div>
    <ul class="leit">${part.leitpunkte.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>
    <textarea class="exam-textarea" id="write-answer" placeholder="Schreiben Sie zu jedem Punkt ein bis zwei Sätze. Denken Sie an Anrede und Gruß.">${esc(state.answers[part.id] || '')}</textarea>
    <div class="word-count" id="word-count">0 Wörter</div>`);
  const textarea = document.getElementById('write-answer');
  const updateCount = () => { document.getElementById('word-count').textContent = `${wordCount(textarea.value)} Wörter · Empfehlung: ca. ${part.minWords || 30}`; };
  textarea.oninput = updateCount;
  updateCount();
  activeCollector = () => { state.answers[part.id] = textarea.value.trim(); };
  wireNavigation(section, part, activeCollector);
}

function renderSpeak(section, part) {
  const isIntro = part.type === 'speak-intro';
  const cards = isIntro
    ? `<div class="keyword-grid">${part.prompts.map((prompt) => `<div class="keyword-card"><small>Stichwort</small><b>${esc(prompt)}</b></div>`).join('')}</div>`
    : `<div class="keyword-grid">${part.cards.map((card) => `<div class="keyword-card"><small>Prüfungskarte</small><b>${esc(card.keyword)}</b><p>Beispiel: ${esc(card.example)}</p></div>`).join('')}</div>`;
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  app.innerHTML = questionShell(section, part, `
    <div class="passage"><span class="passage-label">Aufgabe</span>${esc(part.instructions)}</div>
    ${cards}
    ${(canRecord || Recognition) ? `<div class="recording-box"><button class="record-button" id="record" aria-label="Aufnahme starten">●</button><div><b id="record-title">Antwort aufnehmen</b><small id="record-status">Drücken Sie auf den roten Knopf und sprechen Sie deutlich.</small></div><audio class="audio-playback" id="playback" controls hidden></audio></div>` : '<p class="exam-note">Ihr Browser unterstützt keine Audioaufnahme. Schreiben Sie ersatzweise ein Transkript Ihrer Antwort.</p>'}
    <div class="field"><label for="speak-answer">Transkript Ihrer Antwort</label><textarea id="speak-answer" placeholder="Das erkannte Gesprochene erscheint hier. Sie können den Text korrigieren.">${esc(state.answers[part.id] || '')}</textarea></div>`);
  const textarea = document.getElementById('speak-answer');
  activeCollector = () => { state.answers[part.id] = textarea.value.trim(); };
  setupRecorder(part, textarea, Recognition, canRecord);
  wireNavigation(section, part, activeCollector);
}

function setupRecorder(part, textarea, Recognition, canRecord) {
  const button = document.getElementById('record');
  if (!button) return;
  let recognition = null;
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];
  let recording = false;
  let finalText = textarea.value ? `${textarea.value} ` : '';
  const status = document.getElementById('record-status');
  const title = document.getElementById('record-title');
  const stop = () => {
    try { recognition?.stop(); } catch {}
    try { if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); } catch {}
    stream?.getTracks().forEach((track) => track.stop());
    recording = false;
    button.classList.remove('active');
    button.textContent = '●';
    title.textContent = 'Antwort aufnehmen';
    status.textContent = 'Aufnahme beendet. Sie können Ihre Antwort anhören oder neu aufnehmen.';
  };
  button.onclick = async () => {
    if (recording) return stop();
    chunks = [];
    if (canRecord) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const oldUrl = state.audio[part.id];
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          const url = URL.createObjectURL(blob);
          state.audio[part.id] = url;
          const playback = document.getElementById('playback');
          if (playback) { playback.src = url; playback.hidden = false; }
        };
        mediaRecorder.start();
      } catch {
        status.textContent = 'Mikrofonzugriff wurde nicht erlaubt. Nutzen Sie bitte das Textfeld.';
      }
    }
    if (Recognition) {
      recognition = new Recognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = (event) => {
        let current = '';
        for (let index = event.resultIndex; index < event.results.length; index++) current += event.results[index][0].transcript;
        textarea.value = finalText + current;
      };
      recognition.onend = () => { finalText = textarea.value ? `${textarea.value} ` : finalText; };
      try { recognition.start(); } catch {}
    }
    recording = true;
    button.classList.add('active');
    button.textContent = '■';
    title.textContent = 'Aufnahme läuft';
    status.textContent = 'Sprechen Sie jetzt. Drücken Sie zum Beenden erneut auf den Knopf.';
  };
  activeRecorderCleanup = stop;
}

function cleanupRecorder() {
  if (!activeRecorderCleanup) return;
  const cleanup = activeRecorderCleanup;
  activeRecorderCleanup = null;
  cleanup();
}

function wordCount(value) { return String(value || '').trim().split(/\s+/).filter(Boolean).length; }

// ---------- shared task chrome ----------
function questionShell(section, part, content) {
  const progress = taskProgress(section, part);
  return `
    <div class="exam-layout">
      <section class="paper-card question-card">
        <div class="task-head"><div><small>${esc(section.title)} · ${esc(part.title)}</small><h2>Aufgabe ${progress.current}</h2></div><span class="task-number">${progress.current} / ${progress.total}</span></div>
        <div class="progress-track"><i style="width:${progress.percent}%"></i></div>
        ${part.instructions ? `<p class="instruction">${esc(part.instructions)}</p>` : ''}
        ${content}
        <div class="task-actions"><div><button class="button secondary" id="previous" ${canGoBack(section, part) ? '' : 'disabled'}>← Zurück</button><button class="button ghost" id="leave-session">Beenden</button></div><button class="button primary" id="next">${nextLabel(section, part)}</button></div>
      </section>
      <aside class="exam-sidebar">
        <div class="sidebar-card"><span class="eyebrow">Prüfungsverlauf</span>${sidebarSections()}</div>
        <div class="sidebar-card"><h3>${esc(part.title)}</h3><p>${answeredInPart(part)} von ${part.items?.length || 1} Aufgaben beantwortet</p>${partNavigator(part)}</div>
        <div class="sidebar-card"><h3>${state.mode === 'practice' ? 'Trainingsmodus' : 'Prüfungsmodus'}</h3><p>${state.mode === 'practice' ? 'Lösungen werden direkt angezeigt. Die Zeit ist nicht begrenzt.' : 'Lösungen und Ergebnis erscheinen erst nach dem letzten Teil.'}</p></div>
      </aside>
    </div>`;
}

function taskProgress(section, part) {
  if (part.items) {
    const itemParts = section.parts.filter((entry) => entry.items);
    const previous = itemParts.slice(0, itemParts.indexOf(part)).reduce((sum, entry) => sum + entry.items.length, 0);
    const total = itemParts.reduce((sum, entry) => sum + entry.items.length, 0);
    const current = previous + state.idx + 1;
    return { current, total, percent: Math.round((current / Math.max(1, total)) * 100) };
  }
  const current = state.part + 1;
  return { current, total: section.parts.length, percent: Math.round((current / section.parts.length) * 100) };
}

function canGoBack(section, part) {
  return !!part.items && state.idx > 0 && !(state.mode === 'exam' && section.id === 'hoeren');
}

function nextLabel(section, part) {
  if (part.items && state.idx + 1 < part.items.length) return 'Weiter →';
  if (state.part + 1 < section.parts.length) return 'Nächster Teil →';
  if (state.mode === 'exam' && section.id === 'lesen') return 'Weiter zu Schreiben →';
  return 'Abschnitt abschließen →';
}

function answeredInPart(part) {
  if (part.items) return part.items.filter((item) => state.answers[item.id] !== undefined).length;
  if (part.fields) return part.fields.filter((field) => state.answers[field.id]).length;
  return state.answers[part.id] ? 1 : 0;
}

function partNavigator(part) {
  if (!part.items) return '';
  return `<div class="part-nav">${part.items.map((item, index) => `<span class="${index === state.idx ? 'now' : state.answers[item.id] !== undefined ? 'done' : ''}">${index + 1}</span>`).join('')}</div>`;
}

function sidebarSections() {
  return exam.sections.map((section, index) => {
    const status = index < state.sec ? 'done' : index === state.sec ? 'now' : '';
    return `<div class="sidebar-section ${status}"><i>${index < state.sec ? '✓' : index + 1}</i><b>${esc(section.title)}</b><small>${section.maxPoints} P</small></div>`;
  }).join('');
}

function stepsBar() {
  return `<ol class="steps">${exam.sections.map((section, index) => `<li class="${index < state.sec ? 'done' : index === state.sec ? 'now' : ''}"><span class="step-dot">${index < state.sec ? '✓' : index + 1}</span><span>${esc(section.title)}</span></li>`).join('')}</ol>`;
}

function wireNavigation(section, part, collect = null) {
  const previous = document.getElementById('previous');
  if (previous && !previous.disabled) previous.onclick = () => { collect?.(); state.idx--; renderPart(); };
  document.getElementById('leave-session').onclick = () => {
    if (state.mode === 'practice' || window.confirm('Prüfung wirklich beenden? Ihr aktueller Fortschritt geht verloren.')) renderSetup();
  };
  document.getElementById('next').onclick = async () => {
    collect?.();
    cleanupRecorder();
    if (part.items && state.idx + 1 < part.items.length) {
      state.idx++;
      renderPart();
      return;
    }
    if (section.aiGraded && ['free-write', 'speak-intro', 'speak-cards'].includes(part.type)) await gradeAi(section, part, true);
    nextPart(section);
  };
}

// ---------- scoring ----------
function labelChoice(item, part, value) {
  if (part.type === 'audio-truefalse' || part.type === 'read-truefalse') return value === true ? 'Richtig' : value === false ? 'Falsch' : '—';
  if (part.type === 'read-match') return value != null ? `Anzeige ${item.options[value]}` : '—';
  return value != null && item.options ? item.options[value] : '—';
}

function scoreAuto(section) {
  if (!section || state.autoScored[section.id]) return;
  let got = 0;
  let max = 0;
  section.parts.forEach((part) => (part.items || []).forEach((item) => {
    max++;
    const answer = state.answers[item.id];
    const ok = item.answer !== undefined && answer !== undefined && answer === item.answer;
    if (ok) got++;
    state.review.push({ sectionId: section.id, sec: section.title, part: part.title, q: item.question || item.statement || item.situation, your: labelChoice(item, part, answer), correct: labelChoice(item, part, item.answer), ok, explain: item.explain || '' });
  }));
  state.scores[section.id] = { pts: Math.round((got / Math.max(1, max)) * section.maxPoints), max: section.maxPoints, got, items: max };
  state.autoScored[section.id] = true;
}

async function gradeAi(section, part, showLoading = false) {
  const gradeKey = `${section.id}:${part.id}`;
  if (state.graded[gradeKey]) return;
  if (showLoading) loading('Ihre Antwort wird ausgewertet …');
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
  const maxPoints = part.rubric?.maxPoints || section.maxPoints;
  const points = result && typeof result.score === 'number' ? Math.round((result.score / 100) * maxPoints) : Math.round(heuristicBand(answer, part) * maxPoints);
  const previous = state.scores[section.id] || { pts: 0, max: section.maxPoints };
  state.scores[section.id] = { pts: Math.min(section.maxPoints, (previous.pts || 0) + points), max: section.maxPoints };
  state.ai[part.id] = result;
  state.graded[gradeKey] = true;
  state.review.push({ sectionId: section.id, sec: section.title, part: part.title, q: part.instructions, your: answer || '—', correct: '', ok: points >= maxPoints * .6, explain: result?.summary || result?.nextStep || (answer ? 'Antwort erfasst und anhand von Umfang und Aufgabe eingeschätzt.' : 'Keine Antwort abgegeben.') });
}

function heuristicBand(answer, part) {
  const words = wordCount(answer);
  if (words < 4) return 0;
  return Math.max(.3, Math.min(1, (words / (part.minWords || 12)) * .8));
}

function scoreForm(section) {
  if (!section || state.formScored) return;
  const form = section.parts.find((part) => part.type === 'form-fill');
  if (!form) return;
  let correct = 0;
  form.fields.forEach((field) => {
    const ok = norm(state.answers[field.id]) === norm(field.expected);
    if (ok) correct++;
    state.review.push({ sectionId: section.id, sec: section.title, part: form.title, q: field.label, your: state.answers[field.id] || '—', correct: field.expected, ok, explain: '' });
  });
  const previous = state.scores[section.id] || { pts: 0, max: section.maxPoints };
  state.scores[section.id] = { pts: Math.min(section.maxPoints, (previous.pts || 0) + Math.round((correct / Math.max(1, form.fields.length)) * 5)), max: section.maxPoints };
  state.formScored = true;
}

function includedSections() {
  if (state.mode === 'practice' && state.practiceSection !== 'all') return exam.sections.filter((section) => section.id === state.practiceSection);
  return exam.sections;
}

async function gradePending(sections) {
  for (const section of sections) {
    if (section.id === 'hoeren' || section.id === 'lesen') scoreAuto(section);
    if (section.id === 'schreiben') scoreForm(section);
    if (!section.aiGraded) continue;
    for (const part of section.parts) {
      if (['free-write', 'speak-intro', 'speak-cards'].includes(part.type)) await gradeAi(section, part, false);
    }
  }
}

// ---------- results ----------
function loading(message) {
  app.innerHTML = `<section class="paper-card loading-card"><div class="spinner"></div><h3>${esc(message)}</h3><p class="muted small">Einen Moment bitte.</p></section>`;
}

async function results() {
  if (!state.active && app.querySelector('.result-wrap')) return;
  state.active = false;
  stopTimer();
  cleanupRecorder();
  document.onkeydown = null;
  activeCollector?.();
  const sections = includedSections();
  loading('Ergebnis wird berechnet');
  await gradePending(sections);
  const rows = sections.map((section) => {
    const score = state.scores[section.id] || { pts: 0, max: section.maxPoints };
    return { id: section.id, title: section.title, pts: score.pts || 0, max: score.max || section.maxPoints, pct: Math.round(((score.pts || 0) / Math.max(1, score.max || section.maxPoints)) * 100) };
  });
  const points = rows.reduce((sum, row) => sum + row.pts, 0);
  const maxPoints = rows.reduce((sum, row) => sum + row.max, 0);
  const percent = Math.round((points / Math.max(1, maxPoints)) * 100);
  const isFull = sections.length === exam.sections.length;
  const passed = isFull && points >= 36;
  const predicate = isFull ? resultPredicate(points) : 'Training abgeschlossen';
  const sectionScores = rows.reduce((result, row) => { result[row.id] = { pts: row.pts, max: row.max, pct: row.pct }; return result; }, {});
  const saved = state.mode === 'exam' && isFull ? await saveAttempt(percent, passed, sectionScores) : false;
  const durationMinutes = Math.max(1, Math.round((Date.now() - state.startTime) / 60000));

  app.innerHTML = `
    <div class="result-wrap">
      <section class="result-card result-hero">
        <div><span class="eyebrow">${state.mode === 'exam' ? 'Prüfungsergebnis' : 'Trainingsergebnis'} · ${esc(exam.title)}</span><span class="result-status ${isFull && !passed ? 'fail' : ''}">${isFull ? (passed ? 'BESTANDEN' : 'NOCH NICHT BESTANDEN') : 'ABGESCHLOSSEN'}</span><h2 style="margin-top:14px">${esc(predicate)}</h2><p class="lead">${isFull ? `Sie haben ${points} von 60 Punkten erreicht. Zum Bestehen benötigen Sie mindestens 36 Punkte.` : `Sie haben ${points} von ${maxPoints} Punkten in diesem Training erreicht.`}</p><p class="small muted">Bearbeitungszeit: ${durationMinutes} Min.${saved ? ' · Ergebnis im Profil gespeichert' : ''}</p></div>
        <div class="score-ring"><div><b>${points} / ${maxPoints}</b><small>${percent}%</small></div></div>
      </section>
      <section class="paper-card question-card"><span class="eyebrow">Leistungsprofil</span><h2>Ergebnis nach Fertigkeit</h2><div class="score-grid">${rows.map(scoreBox).join('')}</div></section>
      <section class="paper-card question-card"><span class="eyebrow">Auswertung</span><h2>Antworten und Erklärungen</h2><p class="muted">Nutzen Sie die Hinweise, um Ihren nächsten Trainingsschwerpunkt zu wählen.</p><div class="review-list">${reviewHtml(sections)}</div></section>
      <div class="result-actions"><button class="button primary" id="again">Neuen Modelltest starten</button><button class="button secondary" id="home">Zum Lernbereich</button></div>
      <p class="small muted">Der DUVELA-Ergebnisbericht ist eine Übungsauswertung und kein offizielles Sprachzertifikat.</p>
    </div>`;
  document.getElementById('again').onclick = renderSetup;
  document.getElementById('home').onclick = () => { location.href = './app.html?role=learner#study'; };
}

function resultPredicate(points) {
  if (points >= 54) return 'Sehr gut';
  if (points >= 48) return 'Gut';
  if (points >= 42) return 'Befriedigend';
  if (points >= 36) return 'Ausreichend';
  return 'Teilgenommen';
}

function scoreBox(row) {
  return `<article class="score-box"><header><b>${esc(row.title)}</b><strong>${row.pts} / ${row.max}</strong></header><div class="mini-track"><i style="width:${row.pct}%"></i></div><small>${row.pct}% erreicht</small></article>`;
}

function reviewHtml(sections) {
  const allowed = new Set(sections.map((section) => section.id));
  const items = state.review.filter((item) => allowed.has(item.sectionId));
  if (!items.length) return '<p class="exam-note">Für diesen Abschnitt liegt noch keine Detailauswertung vor.</p>';
  return items.map((item) => `
    <article class="review-item ${item.ok ? 'ok' : ''}">
      <header><b>${item.ok ? '✓' : '○'} ${esc(item.sec)} · ${esc(item.part)}</b><span>${item.ok ? 'richtig / erfüllt' : 'verbessern'}</span></header>
      <h3>${esc(item.q || '')}</h3>
      <div class="review-answer"><div><small>IHRE ANTWORT</small>${esc(item.your)}</div>${item.correct ? `<div><small>RICHTIGE ANTWORT</small>${esc(item.correct)}</div>` : '<div><small>BEWERTUNG</small>Siehe Hinweis unten</div>'}</div>
      ${item.explain ? `<p class="review-explain">${esc(item.explain)}</p>` : ''}
    </article>`).join('');
}

async function saveAttempt(percent, passed, sectionScores) {
  if (!supa) return false;
  try {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return false;
    const { error } = await supa.from('telc_exam_attempts').insert({ user_id: user.id, exam: bank.exam, level: bank.level, score_pct: percent, passed, section_scores: sectionScores });
    return !error;
  } catch { return false; }
}
