// DUVELA EXAM — independent Start Deutsch / telc Deutsch simulation.
const app = document.getElementById('app');
const clockEl = document.getElementById('clock');
const timerEl = document.getElementById('timer');
const timerLabelEl = document.getElementById('timer-label');
const EXAM_LEVEL = String(document.body.dataset.examLevel || 'A1').toUpperCase();
const EXAM_NUMBER = EXAM_LEVEL === 'A2' ? '2' : '1';
const BANK_URL = document.body.dataset.examBank || `./web/content/telc-${EXAM_LEVEL.toLowerCase()}-exam-bank.json`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[.,;:!?]/g, '');
const textAnswerCorrect = (value, expected) => {
  const answer = norm(value);
  const target = norm(expected);
  return answer === target || (answer.length >= 2 && (target.includes(answer) || answer.includes(target)));
};
const examI18n = window.DUVELA_EXAM_I18N || { locales: [{ code: 'de', flag: '🇩🇪', name: 'Deutsch', dir: 'ltr' }], text: { de: {} } };
const normalizeUiLocale = (value) => {
  const raw = String(value || '').toLowerCase().replace('_', '-');
  const base = raw.split('-')[0];
  return examI18n.locales.some((locale) => locale.code === base) ? base : 'de';
};
const initialUiLocale = normalizeUiLocale(localStorage.getItem('duvela.webLang') || localStorage.getItem('duvela.web.lang') || navigator.language);
const tx = (key) => examI18n.text[state?.uiLocale]?.[key] ?? examI18n.text.en?.[key] ?? examI18n.text.de?.[key] ?? key;
const uiLocaleMeta = () => examI18n.locales.find((locale) => locale.code === state.uiLocale) || examI18n.locales[0];

let bank = null;
let exam = null;
let supa = null;
let timerId = null;
let timerDeadline = 0;
let timerDuration = 0;
let timerCallback = null;
let activeCollector = null;
let activeRecorderCleanup = null;
let activeExamAudio = null;
let preflightMicUrl = '';
const SESSION_KEY = `duvela_exam_session_${EXAM_LEVEL.toLowerCase()}_v2`;
const HISTORY_KEY = 'duvela_exam_history_v1';
const preflight = { sound: false, microphone: false, browser: false, online: navigator.onLine, recording: false };

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
  speakTurn: 0,
  timerBlock: '',
  timeWarnings: [],
  candidateName: '',
  candidateNumber: '',
  reportId: '',
  completedSections: [],
  integrity: { focusLeaves: 0, reconnects: 0, reloads: 0 },
  aborted: false,
  finishedAt: 0,
  uiLocale: initialUiLocale,
};

syncLocalizedChrome();

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
  const response = await fetch(BANK_URL);
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

document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !state.active || state.mode !== 'exam') return;
  state.integrity.focusLeaves++;
  persistSession();
});

window.addEventListener('offline', () => {
  if (!state.active || state.mode !== 'exam') return;
  showExamNotice('Internetverbindung unterbrochen. Die Prüfungszeit läuft weiter.', true);
});

window.addEventListener('online', () => {
  if (!state.active || state.mode !== 'exam') return;
  state.integrity.reconnects++;
  showExamNotice('Internetverbindung wiederhergestellt.');
  persistSession();
});

document.querySelector('.back-link')?.addEventListener('click', (event) => {
  if (!state.active || state.mode !== 'exam') return;
  event.preventDefault();
  submitExamEarly();
});

// ---------- audio and timer ----------
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch { voices = []; } }
loadVoices();
try { speechSynthesis.onvoiceschanged = loadVoices; } catch {}

function speak(text, onDone) {
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    const germanVoice = voices.find((voice) => /de[-_]/i.test(voice.lang));
    if (germanVoice) utterance.voice = germanVoice;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    speechSynthesis.speak(utterance);
    return true;
  } catch { return false; }
}

function stopExamAudio() {
  try { activeExamAudio?.pause(); } catch {}
  activeExamAudio = null;
  try { speechSynthesis.cancel(); } catch {}
}

function playExamAudio(item, onDone) {
  stopExamAudio();
  if (!item.audio) { speak(item.transcript, onDone); return; }
  const audio = new Audio(item.audio);
  activeExamAudio = audio;
  audio.onended = () => { activeExamAudio = null; onDone?.(); };
  audio.onerror = () => { activeExamAudio = null; speak(item.transcript, onDone); };
  audio.play().catch(() => { activeExamAudio = null; speak(item.transcript, onDone); });
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
  state.timerBlock = label;
  timerLabelEl.textContent = label;
  clockEl.hidden = false;
  const tick = () => {
    const left = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    const ratio = left / timerDuration;
    clockEl.className = `exam-clock${ratio <= .2 ? ' urgent' : ratio <= .5 ? ' warning' : ''}`;
    for (const mark of [600, 300, 60]) {
      if (left <= mark && timerDuration > mark && !state.timeWarnings.includes(mark)) {
        state.timeWarnings.push(mark);
        showTimeNotice(mark);
        persistSession();
      }
    }
    if (left > 0) return;
    const callback = timerCallback;
    stopTimer();
    callback?.();
  };
  tick();
  timerId = setInterval(tick, 1000);
  persistSession();
}

function showTimeNotice(seconds) {
  const old = document.getElementById('time-notice');
  old?.remove();
  const notice = document.createElement('div');
  notice.id = 'time-notice';
  notice.className = `time-notice${seconds <= 60 ? ' urgent' : ''}`;
  notice.textContent = seconds === 60 ? 'Noch 1 Minute.' : `Noch ${seconds / 60} Minuten.`;
  document.body.append(notice);
  setTimeout(() => notice.remove(), 5000);
}

function showExamNotice(message, urgent = false) {
  const old = document.getElementById('time-notice');
  old?.remove();
  const notice = document.createElement('div');
  notice.id = 'time-notice';
  notice.className = `time-notice${urgent ? ' urgent' : ''}`;
  notice.textContent = message;
  document.body.append(notice);
  setTimeout(() => notice.remove(), 6000);
}

function showConfirm({ title, message, confirmLabel = 'Bestätigen', cancelLabel = 'Zurück', tone = 'primary' }) {
  return new Promise((resolve) => {
    document.querySelector('.confirm-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.innerHTML = `
      <section class="confirm-dialog ${esc(tone)}" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <button class="confirm-close" type="button" aria-label="Dialog schließen">×</button>
        <div class="confirm-icon" aria-hidden="true">${tone === 'danger' ? '!' : tone === 'warning' ? '?' : '✓'}</div>
        <span class="eyebrow">DUVELA EXAM</span>
        <h2 id="confirm-title">${esc(title)}</h2>
        <p id="confirm-message">${esc(message)}</p>
        <div class="confirm-actions">
          <button class="button secondary" type="button" data-confirm="cancel">${esc(cancelLabel)}</button>
          <button class="button ${tone === 'danger' ? 'danger' : 'primary'}" type="button" data-confirm="accept">${esc(confirmLabel)} <span>→</span></button>
        </div>
      </section>`;
    document.body.append(backdrop);
    document.body.classList.add('modal-open');
    const accept = backdrop.querySelector('[data-confirm="accept"]');
    const cancel = backdrop.querySelector('[data-confirm="cancel"]');
    const close = (answer) => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.classList.add('closing');
      document.body.classList.remove('modal-open');
      setTimeout(() => backdrop.remove(), 150);
      resolve(answer);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key !== 'Tab') return;
      const controls = [cancel, accept];
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); accept.focus(); }
      if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); cancel.focus(); }
    };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(false); });
    backdrop.querySelector('.confirm-close').onclick = () => close(false);
    cancel.onclick = () => close(false);
    accept.onclick = () => close(true);
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => { backdrop.classList.add('visible'); cancel.focus(); });
  });
}

function remainingSeconds() {
  return timerDeadline ? Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000)) : 0;
}

function persistSession() {
  if (!state.active) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      examId: exam?.id,
      state: { ...state, audio: {} },
      remaining: remainingSeconds(),
      savedAt: Date.now(),
    }));
  } catch {}
}

function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

function savedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!saved?.state?.active || !bank.tests.some((test) => test.id === saved.examId)) return null;
    return saved;
  } catch { return null; }
}

function readExamHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(history) ? history.filter((entry) => entry && ['A1', 'A2'].includes(entry.level)) : [];
  } catch { return []; }
}

function saveLocalAttempt(attempt) {
  try {
    const history = readExamHistory();
    history.unshift({ id: state.reportId, date: new Date(state.finishedAt).toISOString(), ...attempt });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 60)));
    return true;
  } catch { return false; }
}

function levelProgress(level) {
  const attempts = readExamHistory().filter((entry) => entry.level === level && entry.mode === 'exam');
  const completed = new Set(attempts.map((entry) => entry.testId)).size;
  const best = attempts.length ? Math.max(...attempts.map((entry) => Number(entry.percent) || 0)) : null;
  return { attempts, completed, best };
}

function progressHubHtml() {
  const cards = ['A1', 'A2'].map((level) => {
    const progress = levelProgress(level);
    const href = level === 'A1' ? './telc-exam.html' : './telc-a2-exam.html';
    const current = level === EXAM_LEVEL;
    return `<a class="level-progress ${current ? 'current' : ''}" href="${href}" ${current ? 'aria-current="page"' : ''}>
      <span class="level-progress-mark">${level}</span>
      <span><small>Deutsch ${level}</small><b>✓ ${progress.completed} / 5</b></span>
      <strong>${progress.best == null ? '—' : `★ ${progress.best}%`}</strong>
    </a>`;
  }).join('');
  return `<section class="progress-hub"><header><span class="eyebrow">DUVELA EXAM</span><h2>A1 + A2</h2></header><div>${cards}</div></section>`;
}

// ---------- setup ----------
function syncLocalizedChrome() {
  const locale = uiLocaleMeta();
  document.documentElement.lang = locale.code;
  const backLink = document.querySelector('.back-link');
  const backLabel = backLink?.querySelector('span');
  if (backLabel) backLabel.textContent = tx('nav');
  if (backLink) backLink.setAttribute('aria-label', `${tx('back')}: ${tx('nav')}`);
  if (timerLabelEl) timerLabelEl.textContent = tx('timeLabel');
}

function levelText(value) {
  if (EXAM_LEVEL === 'A1') return value;
  return String(value).replaceAll('A1', EXAM_LEVEL).replaceAll('Start Deutsch 1', `Start Deutsch ${EXAM_NUMBER}`).replaceAll('80', '70').replaceAll('۸۰', '۷۰');
}

function renderSetup() {
  syncLocalizedChrome();
  state.active = false;
  document.body.classList.remove('exam-active');
  if (state.finishedAt) {
    Object.assign(preflight, { sound: false, microphone: false, browser: false, online: navigator.onLine, recording: false });
    state.finishedAt = 0;
  }
  stopTimer();
  cleanupRecorder();
  document.onkeydown = null;
  const testOptions = bank.tests.map((test) => `<option value="${esc(test.id)}" ${test.id === state.selectedTest ? 'selected' : ''}>${esc(test.title)}</option>`).join('');
  const sectionOptions = [
    ['all', tx('allTraining')],
    ...bank.tests[0].sections.map((section) => [section.id, section.title]),
  ].map(([value, label]) => `<option value="${esc(value)}" ${value === state.practiceSection ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const resumable = savedSession();
  const languageOptions = examI18n.locales.map((locale) => `<option value="${locale.code}" ${locale.code === state.uiLocale ? 'selected' : ''}>${locale.flag} ${esc(locale.name)}</option>`).join('');
  const locale = uiLocaleMeta();

  app.innerHTML = `
    <section class="setup-hero localized-copy" dir="${locale.dir}" lang="${locale.code}">
      <div class="setup-copy">
        <div class="hero-badge"><span></span>Deutsch ${EXAM_LEVEL} · ${esc(tx('simulation'))}</div>
        <h1>${esc(tx('heroPrefix'))} <span>${esc(tx('heroAccent'))}</span></h1>
        <p class="lead">${esc(tx('heroDesc'))}</p>
        <div class="fact-row"><span>${esc(tx('factTests'))}</span><span>${esc(levelText(tx('factTime')))}</span><span>${esc(tx('factPass'))}</span></div>
        <p class="hero-assurance"><b>✓</b> ${esc(tx('assurance'))}</p>
      </div>
      <div class="setup-card">
        <header><div><span class="eyebrow">${esc(tx('configure'))}</span><h3>${esc(tx('choose'))}</h3><p>${esc(tx('chooseDesc'))}</p></div><span>${EXAM_LEVEL}</span></header>
        <div class="mode-grid" role="radiogroup" aria-label="${esc(tx('choose'))}">
          <button class="mode-choice ${state.mode === 'exam' ? 'active' : ''}" data-mode="exam" role="radio" aria-checked="${state.mode === 'exam'}"><i>01</i><b>${esc(tx('simulation'))}</b><small>${esc(tx('simDesc'))}</small></button>
          <button class="mode-choice ${state.mode === 'practice' ? 'active' : ''}" data-mode="practice" role="radio" aria-checked="${state.mode === 'practice'}"><i>02</i><b>${esc(tx('training'))}</b><small>${esc(tx('trainingDesc'))}</small></button>
        </div>
        <div class="field"><label for="test-select">${esc(tx('modelTest'))}</label><select id="test-select">${testOptions}</select></div>
        <div class="field locale-field"><label for="exam-language">${esc(tx('language'))}</label><select id="exam-language">${languageOptions}</select><small>${esc(tx('germanNote'))}</small></div>
        ${state.mode === 'practice' ? `<div class="field"><label for="section-select">${esc(tx('scope'))}</label><select id="section-select">${sectionOptions}</select></div>` : ''}
        <div class="setup-actions">
          <button class="button primary" id="continue">${esc(state.mode === 'exam' ? tx('prepare') : tx('startTraining'))} <span>→</span></button>
          <button class="button secondary" id="sound-check" title="${esc(tx('soundCheck'))}"><span class="sound-icon">♪</span> ${esc(tx('soundCheck'))}</button>
        </div>
        <p class="exam-note">${esc(levelText(tx('disclaimer')))}</p>
      </div>
      ${resumable ? `<div class="resume-banner"><div><span class="eyebrow">${esc(tx('savedAttempt'))}</span><b>${esc(tx('resumeCopy'))}</b><small>${esc(tx('modelTest'))} ${esc(String(resumable.examId).replace('mt', ''))} · ${esc(resumable.state.timerBlock || tx('examWord'))}</small></div><button class="button primary" id="resume-session">${esc(tx('resume'))} →</button><button class="button ghost" id="discard-session">${esc(tx('discard'))}</button></div>` : ''}
      <div class="blueprint" aria-label="${esc(tx('flow'))}">
        ${blueprintCard('01', 'Hören', '3 Teile · 15 Aufgaben', 'ca. 20 Min.', '15 Punkte')}
        ${blueprintCard('02', 'Lesen', '3 Teile · 15 Aufgaben', EXAM_LEVEL === 'A2' ? 'ca. 30 Min.' : 'ca. 25 Min.', '15 Punkte')}
        ${blueprintCard('03', 'Schreiben', 'Formular + Mitteilung', 'ca. 20 Min.', '15 Punkte')}
        ${blueprintCard('04', 'Sprechen', EXAM_LEVEL === 'A2' ? 'Vorstellen · Gespräch · Aushandeln' : 'Vorstellen · Fragen · Bitten', 'ca. 15 Min.', '15 Punkte')}
      </div>
      ${progressHubHtml()}
    </section>`;

  app.querySelectorAll('[data-mode]').forEach((button) => {
    button.onclick = () => { state.mode = button.dataset.mode; renderSetup(); };
  });
  document.getElementById('test-select').onchange = (event) => { state.selectedTest = event.target.value; };
  document.getElementById('exam-language').onchange = (event) => {
    state.uiLocale = normalizeUiLocale(event.target.value);
    localStorage.setItem('duvela.webLang', state.uiLocale);
    localStorage.setItem('duvela.webLang.userChoice', '1');
    window.DuvelaCurrentAppLang = state.uiLocale;
    renderSetup();
  };
  const sectionSelect = document.getElementById('section-select');
  if (sectionSelect) sectionSelect.onchange = (event) => { state.practiceSection = event.target.value; };
  document.getElementById('sound-check').onclick = () => speak('Guten Tag. Der Ton funktioniert. Sie können die Prüfung beginnen.');
  document.getElementById('continue').onclick = () => {
    exam = bank.tests.find((test) => test.id === state.selectedTest) || bank.tests[0];
    if (state.mode === 'exam') renderPreflight();
    else startSession();
  };
  document.getElementById('resume-session')?.addEventListener('click', resumeSession);
  document.getElementById('discard-session')?.addEventListener('click', () => { clearSession(); renderSetup(); });
}

function blueprintCard(number, title, description, duration, points) {
  return `<article><header><small>TEIL ${number}</small><span>${number}</span></header><h3>${title}</h3><p>${description}</p><footer><b>${duration}</b><b>${points}</b></footer></article>`;
}

function renderPreflight() {
  syncLocalizedChrome();
  preflight.browser = supportsExamBrowser();
  preflight.online = navigator.onLine;
  if (preflightMicUrl) { URL.revokeObjectURL(preflightMicUrl); preflightMicUrl = ''; }
  const locale = uiLocaleMeta();
  app.innerHTML = `
    <section class="preflight" data-ui-locale="${locale.code}">
      <div class="paper-card preflight-main localized-copy" dir="${locale.dir}" lang="${locale.code}">
        <div class="preflight-titlebar"><div><span class="eyebrow">${esc(tx('before'))}</span><h2>${esc(tx('ready'))}</h2></div><label class="inline-locale"><span>${esc(tx('language'))}</span><select id="preflight-language">${examI18n.locales.map((item) => `<option value="${item.code}" ${item.code === state.uiLocale ? 'selected' : ''}>${item.flag} ${esc(item.name)}</option>`).join('')}</select></label></div>
        <p class="lead">${esc(tx('intro'))}</p>
        <div class="candidate-strip">
          <span><small>Prüfung</small><b>Deutsch ${EXAM_LEVEL}</b></span>
          <span><small>Modelltest</small><b>${esc(exam.id.toUpperCase())}</b></span>
          <span><small>Gesamt</small><b>60 Punkte</b></span>
          <span><small>Bestehen</small><b>ab 36 Punkten</b></span>
        </div>
        <div class="candidate-fields">
          <div class="field"><label for="candidate-name">${esc(tx('name'))}</label><input id="candidate-name" autocomplete="name" maxlength="80" placeholder="Anna Müller" value="${esc(state.candidateName)}"></div>
          <div class="field"><label for="candidate-number">${esc(tx('number'))}</label><input id="candidate-number" readonly value="${esc(state.candidateNumber || createCandidateNumber())}"></div>
        </div>
        <div class="equipment-grid" aria-label="Geräteprüfung">
          ${equipmentCard('browser', tx('browser'), preflight.browser ? tx('compatible') : tx('unchecked'), tx('browserDesc'), preflight.browser)}
          ${equipmentCard('online', tx('connection'), preflight.online ? tx('online') : tx('unchecked'), tx('connectionDesc'), preflight.online)}
          ${equipmentCard('sound', tx('sound'), preflight.sound ? tx('heard') : tx('unchecked'), tx('soundDesc'), preflight.sound, `<div class="equipment-actions"><button class="button secondary compact" id="test-sound">${esc(tx('testSound'))}</button><button class="button primary compact" id="confirm-sound" hidden>${esc(tx('heard'))} ✓</button></div>`)}
          ${equipmentCard('microphone', tx('microphone'), preflight.microphone ? tx('compatible') : tx('unchecked'), tx('micDesc'), preflight.microphone, `<button class="button secondary compact" id="test-mic">${esc(tx('testMic'))}</button><audio id="preflight-playback" controls hidden></audio>`)}
        </div>
        <label class="rules-confirm"><input type="checkbox" id="rules-confirm"><span>${esc(levelText(tx('rules')))}</span></label>
        <p class="preflight-status" id="preflight-status" aria-live="polite">${esc(tx('initial'))}</p>
        <div class="result-actions">
          <button class="button primary" id="begin-exam" disabled>${esc(tx('start'))} →</button>
          <button class="button secondary" id="back-setup">${esc(tx('back'))}</button>
        </div>
      </div>
      <aside class="paper-card preflight-aside localized-copy" dir="${locale.dir}" lang="${locale.code}">
        <span class="eyebrow">${esc(tx('flow'))}</span>
        <h3>${esc(tx('written'))}</h3>
        <div class="format-list"><div><span>Hören</span><small>3 Teile · 20 Min.</small></div><div><span>Lesen + Schreiben</span><small>3 + 2 Teile · ${EXAM_LEVEL === 'A2' ? '50' : '45'} Min.</small></div></div>
        <h3>${esc(tx('oral'))}</h3>
        <div class="format-list"><div><span>Sprechen</span><small>3 Teile · 15 Min.</small></div></div>
        <p class="exam-note">${esc(tx('speakingNote'))}</p>
      </aside>
    </section>`;
  const nameInput = document.getElementById('candidate-name');
  const numberInput = document.getElementById('candidate-number');
  state.candidateNumber = numberInput.value;
  document.getElementById('preflight-language').onchange = (event) => {
    state.candidateName = nameInput.value.trim();
    state.uiLocale = normalizeUiLocale(event.target.value);
    localStorage.setItem('duvela.webLang', state.uiLocale);
    localStorage.setItem('duvela.webLang.userChoice', '1');
    renderPreflight();
  };
  nameInput.addEventListener('input', updatePreflightReady);
  document.getElementById('rules-confirm').addEventListener('change', updatePreflightReady);
  document.getElementById('test-sound').onclick = () => {
    speak('Guten Tag. Wenn Sie diese Ansage hören, funktioniert die Tonausgabe.');
    document.getElementById('confirm-sound').hidden = false;
    document.getElementById('preflight-status').textContent = tx('soundDesc');
  };
  document.getElementById('confirm-sound').onclick = () => {
    preflight.sound = true;
    updateEquipmentCard('sound', true, tx('heard'));
    updatePreflightReady();
  };
  document.getElementById('test-mic').onclick = testPreflightMicrophone;
  document.getElementById('begin-exam').onclick = () => {
    state.candidateName = nameInput.value.trim();
    state.candidateNumber = numberInput.value;
    requestExamFullscreen();
    startSession();
  };
  document.getElementById('back-setup').onclick = renderSetup;
  verifyConnection();
  updatePreflightReady();
}

function supportsExamBrowser() {
  try { localStorage.setItem('duvela_device_test', '1'); localStorage.removeItem('duvela_device_test'); } catch { return false; }
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.Audio);
}

function equipmentCard(id, title, status, text, ready, action = '') {
  return `<article class="equipment-card ${ready ? 'ready' : ''}" id="equipment-${id}"><span class="equipment-icon">${ready ? '✓' : '•'}</span><div><small>${esc(title)}</small><b class="equipment-state">${esc(status)}</b><p>${esc(text)}</p>${action}</div></article>`;
}

function updateEquipmentCard(id, ready, status) {
  const card = document.getElementById(`equipment-${id}`);
  if (!card) return;
  card.classList.toggle('ready', ready);
  card.querySelector('.equipment-icon').textContent = ready ? '✓' : '!';
  card.querySelector('.equipment-state').textContent = status;
}

async function verifyConnection() {
  try {
    const response = await fetch(BANK_URL, { cache: 'no-store' });
    preflight.online = response.ok;
  } catch { preflight.online = false; }
  updateEquipmentCard('online', preflight.online, preflight.online ? tx('online') : tx('unchecked'));
  updatePreflightReady();
}

async function testPreflightMicrophone() {
  if (preflight.recording) return;
  const button = document.getElementById('test-mic');
  const status = document.getElementById('preflight-status');
  preflight.recording = true;
  button.disabled = true;
  button.textContent = '● 3…';
  status.textContent = tx('micDesc');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      preflight.microphone = blob.size > 100;
      if (preflightMicUrl) URL.revokeObjectURL(preflightMicUrl);
      preflightMicUrl = URL.createObjectURL(blob);
      const playback = document.getElementById('preflight-playback');
      playback.src = preflightMicUrl;
      playback.hidden = !preflight.microphone;
      updateEquipmentCard('microphone', preflight.microphone, preflight.microphone ? tx('compatible') : tx('unchecked'));
      button.textContent = tx('testMic');
      button.disabled = false;
      preflight.recording = false;
      status.textContent = preflight.microphone ? tx('micDesc') : tx('initial');
      updatePreflightReady();
    };
    recorder.start();
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 3000);
  } catch {
    preflight.recording = false;
    button.disabled = false;
    button.textContent = tx('testMic');
    status.textContent = tx('initial');
    updateEquipmentCard('microphone', false, tx('unchecked'));
    updatePreflightReady();
  }
}

function updatePreflightReady() {
  const button = document.getElementById('begin-exam');
  if (!button) return;
  const nameReady = document.getElementById('candidate-name').value.trim().length >= 3;
  const rulesReady = document.getElementById('rules-confirm').checked;
  const ready = nameReady && rulesReady && preflight.browser && preflight.online && preflight.sound && preflight.microphone;
  button.disabled = !ready;
  const status = document.getElementById('preflight-status');
  if (ready) status.textContent = tx('allReady');
}

function createCandidateNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `DVL-${EXAM_LEVEL}-${date}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function requestExamFullscreen() {
  const request = document.documentElement.requestFullscreen?.();
  request?.catch?.(() => {});
}

// ---------- session flow ----------
function resetSession() {
  Object.assign(state, {
    sec: 0, part: 0, idx: 0, answers: {}, scores: {}, ai: {}, review: [], audio: {}, plays: {}, graded: {}, autoScored: {}, formScored: false,
    startTime: Date.now(), active: true, speakTurn: 0, timerBlock: '', timeWarnings: [], reportId: createReportId(), completedSections: [],
    integrity: { focusLeaves: 0, reconnects: 0, reloads: 0 }, aborted: false, finishedAt: 0,
  });
  document.body.classList.toggle('exam-active', state.mode === 'exam');
  if (state.mode === 'practice' && state.practiceSection !== 'all') {
    state.sec = Math.max(0, exam.sections.findIndex((section) => section.id === state.practiceSection));
  }
}

function resumeSession() {
  const saved = savedSession();
  if (!saved) return renderSetup();
  exam = bank.tests.find((test) => test.id === saved.examId) || bank.tests[0];
  Object.assign(state, saved.state, { audio: {}, active: true });
  state.uiLocale = normalizeUiLocale(state.uiLocale || initialUiLocale);
  state.integrity = { focusLeaves: 0, reconnects: 0, reloads: 0, ...(state.integrity || {}) };
  state.integrity.reloads++;
  document.body.classList.add('exam-active');
  const block = state.timerBlock;
  const adjustedRemaining = Math.max(0, Number(saved.remaining || 0) - Math.floor((Date.now() - Number(saved.savedAt || Date.now())) / 1000));
  if (state.mode === 'exam' && adjustedRemaining > 0 && block) {
    const callbackBlock = block === 'Hören' ? 'hoeren' : block === 'Sprechen' ? 'sprechen' : 'lesen-schreiben';
    startTimer(adjustedRemaining / 60, block, () => handleTimeout(callbackBlock));
  } else if (state.mode === 'exam' && block) {
    const callbackBlock = block === 'Hören' ? 'hoeren' : block === 'Sprechen' ? 'sprechen' : 'lesen-schreiben';
    handleTimeout(callbackBlock);
    return;
  }
  renderPart();
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
  const duration = isReadingBlock ? (EXAM_LEVEL === 'A2' ? 50 : 45) : section.durationMin;
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
      if (section.id === 'lesen') startTimer(EXAM_LEVEL === 'A2' ? 50 : 45, 'Lesen + Schreiben', () => handleTimeout('lesen-schreiben'));
      if (section.id === 'sprechen') startTimer(15, 'Sprechen', () => handleTimeout('sprechen'));
    }
    renderPart();
  };
  document.getElementById('back-setup')?.addEventListener('click', renderSetup);
}

function sectionRule(section, isReadingBlock) {
  if (state.mode === 'practice') return 'Sie erhalten direkt nach jeder Auswahl eine Lösung und können Aufgaben ohne Zeitdruck bearbeiten.';
  if (section.id === 'hoeren') return 'Teil 1 und Teil 3 hören Sie zweimal. Teil 2 hören Sie einmal. Nicht beantwortete Aufgaben zählen als falsch.';
  if (isReadingBlock) return `Für Lesen und Schreiben gelten zusammen ${EXAM_LEVEL === 'A2' ? 50 : 45} Minuten. Zwischen beiden Teilen gibt es keine Pause.`;
  return 'In der echten Prüfung sprechen Sie mit anderen Teilnehmenden. Hier nehmen Sie Ihre Antworten nacheinander auf.';
}

async function handleTimeout(block) {
  activeCollector?.();
  cleanupRecorder();
  if (block === 'hoeren') {
    if (!state.completedSections.includes('hoeren')) state.completedSections.push('hoeren');
    scoreAuto(exam.sections.find((section) => section.id === 'hoeren'));
    state.sec = exam.sections.findIndex((section) => section.id === 'lesen');
    startSection();
    return;
  }
  if (block === 'lesen-schreiben') {
    for (const id of ['lesen', 'schreiben']) if (!state.completedSections.includes(id)) state.completedSections.push(id);
    scoreAuto(exam.sections.find((section) => section.id === 'lesen'));
    state.sec = exam.sections.findIndex((section) => section.id === 'sprechen');
    startSection();
    return;
  }
  if (!state.completedSections.includes('sprechen')) state.completedSections.push('sprechen');
  await results();
}

function nextPart(section) {
  if (state.part + 1 < section.parts.length) {
    state.part++;
    state.idx = 0;
    state.speakTurn = 0;
    persistSession();
    renderPart();
    return;
  }
  finishSection(section);
}

function finishSection(section) {
  if (!state.completedSections.includes(section.id)) state.completedSections.push(section.id);
  persistSession();
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
  stopExamAudio();
  activeCollector = null;
  document.onkeydown = null;
  const section = exam.sections[state.sec];
  const part = section?.parts?.[state.part];
  if (!part) return nextPart(section);
  if (part.type === 'audio-choice') return renderAudioChoice(section, part);
  if (part.type === 'audio-fill') return renderAudioFill(section, part);
  if (part.type === 'read-choice') return renderReadChoice(section, part);
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
    ${trainingHintHtml(part, item)}
    <div class="listen-box"><button class="listen-button" id="play-audio" ${used >= limit ? 'disabled' : ''} aria-label="Hörtext abspielen">▶</button><div><b>Hörtext abspielen</b><small id="play-status">${audioStatus(used, limit)}</small></div></div>
    <div class="question">${esc(item.question)}</div>
    <div class="options">${options}</div>
    ${feedbackHtml(item, part, selected)}`);
  wireAudio(item, part);
  wireChoices(item, part, '[data-answer]');
  wireNavigation(section, part);
  wireChoiceKeys(item.options.length);
}

function renderAudioFill(section, part) {
  const item = part.items[state.idx];
  const limit = audioLimit(part);
  const used = state.plays[item.id] || 0;
  app.innerHTML = questionShell(section, part, `
    ${trainingHintHtml(part, item)}
    <div class="listen-box"><button class="listen-button" id="play-audio" ${used >= limit ? 'disabled' : ''} aria-label="Hörtext abspielen">▶</button><div><b>Hörtext abspielen</b><small id="play-status">${audioStatus(used, limit)}</small></div></div>
    <div class="question">${esc(item.question)}</div>
    <div class="field"><label for="audio-fill-answer">Telefonnotiz ergänzen</label><input id="audio-fill-answer" autocomplete="off" value="${esc(state.answers[item.id] || '')}" placeholder="Kurze Antwort"></div>
    ${state.mode === 'practice' && state.answers[item.id] ? `<div class="practice-feedback ${textAnswerCorrect(state.answers[item.id], item.answer) ? 'ok' : ''}"><b>${textAnswerCorrect(state.answers[item.id], item.answer) ? 'Richtig.' : `Richtig ist: ${esc(item.answer)}.`}</b>${esc(item.explain || '')}</div>` : ''}`);
  const input = document.getElementById('audio-fill-answer');
  activeCollector = () => { state.answers[item.id] = input.value.trim(); persistSession(); };
  input.addEventListener('input', activeCollector);
  wireAudio(item, part);
  wireNavigation(section, part, activeCollector);
}

function renderReadChoice(section, part) {
  const item = part.items[state.idx];
  const selected = state.answers[item.id];
  const options = item.options.map((option, index) => `<button class="option ${answerClass(item, selected, index)}" data-answer="${index}"><span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${esc(option)}</span></button>`).join('');
  app.innerHTML = questionShell(section, part, `${readingToolsHtml(part, item)}${passageFor(part, item)}<div class="question">${esc(item.question)}</div><div class="options">${options}</div>${feedbackHtml(item, part, selected)}`);
  wireChoices(item, part, '[data-answer]');
  wireNavigation(section, part);
  wireChoiceKeys(item.options.length);
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
    ${isAudio ? trainingHintHtml(part, item) : readingToolsHtml(part, item)}
    ${context}
    <div class="question">${esc(item.statement)}</div>
    <div class="true-false">
      <button class="tf-btn ${answerClass(item, selected, true)}" data-value="true"><span>+</span><span>Richtig</span></button>
      <button class="tf-btn ${answerClass(item, selected, false)}" data-value="false"><span>−</span><span>Falsch</span></button>
    </div>
    ${feedbackHtml(item, part, selected)}`);
  if (isAudio) wireAudio(item, part);
  app.querySelectorAll('[data-value]').forEach((button) => {
    button.onclick = () => { state.answers[item.id] = button.dataset.value === 'true'; persistSession(); renderPart(); };
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
  app.innerHTML = questionShell(section, part, `${readingToolsHtml(part, item)}${ads}<div class="question">${esc(item.situation)}</div><div class="options">${options}</div>${feedbackHtml(item, part, selected)}`);
  wireChoices(item, part, '[data-answer]');
  wireNavigation(section, part);
  wireChoiceKeys(item.options.length);
}

function passageFor(part, item) {
  const text = (part.texts || []).find((entry) => entry.id === item.textRef);
  return text ? `<div class="passage"><span class="passage-label">${esc(text.label || 'Text')}</span>${esc(text.body)}</div>` : '';
}

function readingToolsHtml(part, item) {
  if (state.mode !== 'practice') return '';
  const keywords = readingKeywords(item);
  return `<aside class="reading-tools">
    <header><span><small>LESESTRATEGIE</small><b>Erst Aufgabe, dann Text</b></span><strong>3 Schritte</strong></header>
    <div class="reading-keywords"><small>SCHLÜSSELWÖRTER</small>${keywords.map((word) => `<i>${esc(word)}</i>`).join('')}</div>
    <ol><li><b>1</b> Schlüsselwörter in der Aufgabe lesen</li><li><b>2</b> Passende Textstelle suchen</li><li><b>3</b> Negationen und Zeiten vergleichen</li></ol>
    ${trainingHintHtml(part, item)}
  </aside>`;
}

function readingKeywords(item) {
  const task = item.question || item.statement || item.situation || '';
  const stop = new Set(['aber','alle','auch','dann','dass','eine','einen','einer','einem','eines','haben','kann','können','möchte','möchten','nicht','oder','sich','sind','über','welche','welcher','werden','wird','wollen','wurde','zum','zur','ihnen','ihre','ihrer','ihrem','ihren','man','was','wann','wer','wie','wo']);
  const words = String(task).match(/[\p{L}\p{N}€–-]+/gu) || [];
  return [...new Set(words.filter((word) => (word.length >= 4 || /\d/.test(word)) && !stop.has(word.toLowerCase())))].slice(0, 5);
}

function trainingHintHtml(part) {
  if (state.mode !== 'practice') return '';
  const tips = {
    'audio-choice': 'Lesen Sie vor dem Hören alle drei Antworten. Achten Sie besonders auf Zahlen, Uhrzeiten, Orte und Korrekturen mit „nicht … sondern“.',
    'audio-fill': 'Notieren Sie nur die verlangte Information. Ein kurzes Wort, eine Zahl oder eine Uhrzeit reicht.',
    'audio-truefalse': 'Vergleichen Sie die Aussage genau mit der Ansage. Ein einziges anderes Detail kann die Aussage falsch machen.',
    'read-choice': 'Suchen Sie nicht jedes Wort. Finden Sie zuerst die Textstelle mit demselben Thema und prüfen Sie dann die Details.',
    'read-truefalse': 'Prüfen Sie Subjekt, Zeit und Negation. „Immer“, „nur“ oder „kein“ verändern oft die ganze Aussage.',
    'read-match': 'Streichen Sie zuerst Anzeigen, die beim wichtigsten Wunsch nicht passen. Eine Anzeige darf auch unbenutzt bleiben.',
    'form-fill': 'Übernehmen Sie die Angaben exakt aus der Situation. Bei Namen, Datum und Zahlen zählt die richtige Schreibweise.',
    'free-write': 'Planen Sie zuerst drei Inhaltspunkte. Schreiben Sie danach Anrede, vier bis fünf kurze Sätze und eine Schlussformel.',
  };
  const tip = tips[part.type];
  return tip ? `<details class="training-hint"><summary>Tipp anzeigen</summary><p>${esc(tip)}</p></details>` : '';
}

function wireChoices(item, part, selector) {
  app.querySelectorAll(selector).forEach((button) => {
    button.onclick = () => { state.answers[item.id] = Number(button.dataset.answer); persistSession(); renderPart(); };
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
    button.disabled = true;
    button.textContent = '…';
    document.getElementById('play-status').textContent = audioStatus(state.plays[item.id], limit);
    persistSession();
    playExamAudio(item, () => {
      button.textContent = '▶';
      button.disabled = state.plays[item.id] >= limit;
    });
  };
  if (state.mode === 'exam' && (state.plays[item.id] || 0) === 0) setTimeout(() => button.click(), 650);
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
    ${trainingHintHtml(part)}
    <div class="passage"><span class="passage-label">Situation</span>${esc(part.instructions)}</div>
    <div class="form-grid">${part.fields.map((field) => `<div class="field"><label for="field-${esc(field.id)}">${esc(field.label)}</label><input id="field-${esc(field.id)}" value="${esc(state.answers[field.id] || '')}" autocomplete="off"></div>`).join('')}</div>`);
  activeCollector = () => part.fields.forEach((field) => { state.answers[field.id] = document.getElementById(`field-${field.id}`)?.value.trim() || ''; });
  app.querySelectorAll('.form-grid input').forEach((input) => input.addEventListener('input', () => { activeCollector(); persistSession(); }));
  wireNavigation(section, part, activeCollector);
}

function renderWrite(section, part) {
  const training = state.mode === 'practice';
  const phraseBank = ['Hallo …,', 'Sehr geehrte Damen und Herren,', 'leider', 'weil', 'deshalb', 'Können Sie bitte …?', 'Vielen Dank.', 'Viele Grüße'];
  app.innerHTML = questionShell(section, part, `
    ${trainingHintHtml(part)}
    <div class="passage"><span class="passage-label">Aufgabe</span>${esc(part.instructions)}</div>
    <ul class="leit">${part.leitpunkte.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>
    ${training ? `<section class="writing-tools"><header><span><small>SCHREIBWERKSTATT</small><b>Nützliche Bausteine</b></span><em>Zum Einfügen anklicken</em></header><div>${phraseBank.map((phrase) => `<button type="button" data-writing-phrase="${esc(phrase)}">+ ${esc(phrase)}</button>`).join('')}</div></section>` : ''}
    <textarea class="exam-textarea" id="write-answer" placeholder="Schreiben Sie zu jedem Punkt ein bis zwei Sätze. Denken Sie an Anrede und Gruß.">${esc(state.answers[part.id] || '')}</textarea>
    <div class="word-count" id="word-count">0 Wörter</div>
    ${training ? writingChecklistHtml(part) : ''}
    ${training && part.sample ? `<section class="model-answer"><button class="button secondary compact" id="show-model-answer" type="button" disabled>Beispielantwort nach eigener Lösung</button><small id="model-answer-lock">Schreiben Sie zuerst mindestens 20 Wörter.</small><div id="model-answer-text" hidden><span class="passage-label">Beispielantwort</span><p>${esc(part.sample)}</p><small>Es gibt viele richtige Lösungen. Nutzen Sie dieses Beispiel nur zum Vergleichen.</small></div></section>` : ''}`);
  const textarea = document.getElementById('write-answer');
  const updateCount = () => {
    document.getElementById('word-count').textContent = `${wordCount(textarea.value)} Wörter · Empfehlung: ca. ${part.minWords || 30}`;
    updateWritingChecklist(part, textarea.value);
  };
  textarea.oninput = () => { updateCount(); state.answers[part.id] = textarea.value.trim(); persistSession(); };
  app.querySelectorAll('[data-writing-phrase]').forEach((button) => {
    button.onclick = () => {
      const phrase = button.dataset.writingPhrase || '';
      const prefix = textarea.value && !/\s$/.test(textarea.value.slice(0, textarea.selectionStart)) ? ' ' : '';
      textarea.setRangeText(`${prefix}${phrase} `, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.focus();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    };
  });
  document.getElementById('show-model-answer')?.addEventListener('click', (event) => {
    const answer = document.getElementById('model-answer-text');
    const visible = !answer.hidden;
    answer.hidden = visible;
    event.currentTarget.textContent = visible ? 'Beispielantwort anzeigen' : 'Beispielantwort schließen';
  });
  updateCount();
  activeCollector = () => { state.answers[part.id] = textarea.value.trim(); };
  wireNavigation(section, part, activeCollector);
}

function writingChecklistHtml(part) {
  const labels = ['Passende Anrede', 'Mindestens drei Inhaltspunkte', 'Sätze mit Verbindung', `Etwa ${part.minWords || 30} Wörter`, 'Passende Schlussformel'];
  return `<aside class="writing-checklist"><header><small>A2-CHECK</small><b>Ist Ihre Nachricht vollständig?</b></header><ul>${labels.map((label, index) => `<li data-write-check="${index}"><i>✓</i>${esc(label)}</li>`).join('')}</ul></aside>`;
}

function updateWritingChecklist(part, value) {
  const text = String(value || '').trim();
  const words = wordCount(text);
  const sentenceCount = text.split(/[.!?]+/).filter((sentence) => wordCount(sentence) >= 3).length;
  const checks = [
    /^(hallo|liebe[rn]?|sehr geehrte)/i.test(text),
    sentenceCount >= 3 && words >= 25,
    /\b(und|aber|weil|deshalb|dann|leider|auch|denn)\b/i.test(text),
    words >= Math.max(30, Number(part.minWords || 30) - 5),
    /\b(viele grüß|freundlich\w*\s+grüß|liebe grüß|bis bald|dank)/i.test(text),
  ];
  document.querySelectorAll('[data-write-check]').forEach((item, index) => item.classList.toggle('done', checks[index]));
  const modelButton = document.getElementById('show-model-answer');
  const lock = document.getElementById('model-answer-lock');
  if (modelButton) modelButton.disabled = words < 20;
  if (words < 20) {
    const model = document.getElementById('model-answer-text');
    if (model) model.hidden = true;
    if (modelButton) modelButton.textContent = 'Beispielantwort nach eigener Lösung';
  }
  if (lock) lock.textContent = words < 20 ? `Noch ${20 - words} Wörter bis zur Beispielantwort.` : 'Jetzt können Sie Ihre Lösung vergleichen.';
}

function renderSpeak(section, part) {
  const turns = speakingTurns(part);
  const turn = turns[state.speakTurn] || turns[0];
  const answerKey = `${part.id}:turn:${state.speakTurn}`;
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  app.innerHTML = questionShell(section, part, `
    ${EXAM_LEVEL === 'A2' && part.type === 'speak-cards' ? `<div class="speaking-topic-visual topic-${Number(exam.visualPanel) || 1}" role="img" aria-label="Thema: ${esc(exam.topic || part.instructions)}"><span><small>THEMA</small><b>${esc(exam.topic || part.instructions)}</b></span></div>` : ''}
    <div class="speaking-room">
      <div class="examiner-row"><span class="examiner-avatar">D</span><div class="examiner-bubble"><small>${esc(turn.role)}</small><b>${esc(turn.prompt)}</b>${turn.spoken ? `<button class="speaker-mini" id="speak-prompt" aria-label="Ansage wiederholen">▶ Ansage</button>` : ''}</div></div>
      ${turn.partner ? `<div class="partner-row"><span class="partner-avatar">M</span><div><small>Prüfungspartnerin Mia</small><p>${esc(turn.partner)}</p></div></div>` : ''}
      ${turn.keyword ? `<div class="speaking-card"><small>IHRE KARTE</small><b>${esc(turn.keyword)}</b>${state.mode === 'practice' && turn.example ? `<p>Beispiel: ${esc(turn.example)}</p>` : ''}</div>` : ''}
    </div>
    ${(canRecord || Recognition) ? `<div class="recording-box"><button class="record-button" id="record" aria-label="Aufnahme starten">●</button><div><b id="record-title">Antwort aufnehmen <span class="record-time" id="record-time">00:00</span></b><small id="record-status">Drücken Sie auf den roten Knopf und sprechen Sie deutlich.</small></div><audio class="audio-playback" id="playback" controls hidden></audio></div>` : '<p class="exam-note">Ihr Browser unterstützt keine Audioaufnahme. Schreiben Sie ersatzweise ein Transkript Ihrer Antwort.</p>'}
    <div class="field"><label for="speak-answer">Transkript dieser Antwort</label><textarea id="speak-answer" placeholder="Das erkannte Gesprochene erscheint hier. Sie können den Text korrigieren.">${esc(state.answers[answerKey] || '')}</textarea></div>
    <div class="speech-readiness"><span><b id="speech-word-count">0 Wörter</b><small>A2-Ziel: klar, vollständig und verbunden</small></span><i><b id="speech-readiness-bar"></b></i></div>
    ${state.mode === 'practice' ? speakingCoachHtml(part) : ''}`);
  const textarea = document.getElementById('speak-answer');
  activeCollector = () => { state.answers[answerKey] = textarea.value.trim(); persistSession(); };
  const updateCoach = () => updateSpeakingCoach(part, textarea.value);
  textarea.addEventListener('input', () => { activeCollector(); updateCoach(); });
  updateCoach();
  setupRecorder(part, answerKey, textarea, Recognition, canRecord);
  wireNavigation(section, part, activeCollector);
  document.getElementById('speak-prompt')?.addEventListener('click', () => speak(turn.spoken));
  if (state.mode === 'exam' && turn.spoken) setTimeout(() => speak(turn.spoken), 500);
}

function speakingCoachHtml(part) {
  const checks = part.id === 'sp1'
    ? ['Mindestens zwei Informationen', 'Vollständige Sätze', 'Deutliches Ende']
    : part.id === 'sp2'
      ? ['Passende Frage oder Antwort', 'Direkte Reaktion auf Mia', 'Mindestens ein vollständiger Satz']
      : ['Konkreter Vorschlag', 'Zustimmen oder widersprechen', 'Grund oder Kompromiss nennen'];
  return `<aside class="speaking-coach" id="speaking-coach"><header><span>TRAININGSCOACH</span><b>So klingt eine starke A2-Antwort</b></header><ul>${checks.map((label, index) => `<li data-check="${index}"><i>✓</i>${label}</li>`).join('')}</ul></aside>`;
}

function updateSpeakingCoach(part, value) {
  const words = wordCount(value);
  const wordTarget = part.id === 'sp1' ? 12 : 8;
  const percent = Math.min(100, Math.round((words / wordTarget) * 100));
  const count = document.getElementById('speech-word-count');
  const bar = document.getElementById('speech-readiness-bar');
  if (count) count.textContent = `${words} Wörter`;
  if (bar) bar.style.width = `${percent}%`;
  const text = String(value || '').toLowerCase();
  let checks;
  if (part.id === 'sp1') checks = [words >= 5, /\b(ich|mein|meine|aus|wohne|arbeite|lerne)\b/i.test(text) && words >= 8, words >= 12];
  else if (part.id === 'sp2') checks = [/\?|\b(wer|wie|was|wann|wo|warum|welche|können|möchten)\b/i.test(text), /\b(ja|nein|gern|auch|aber|mia|finde|denke)\b/i.test(text), words >= 8];
  else checks = [/\b(vorschlag|schlage|können|sollten|würde|möchte)\b/i.test(text), /\b(ja|einverstanden|leider|aber|lieber|stimmt)\b/i.test(text), /\b(weil|deshalb|dann|kompromiss|also)\b/i.test(text) || words >= 12];
  document.querySelectorAll('#speaking-coach [data-check]').forEach((item, index) => item.classList.toggle('done', !!checks[index]));
}

function speakingTurns(part) {
  if (part.type === 'speak-intro') return [
    { role: 'Prüferin DUVI', prompt: 'Bitte stellen Sie sich kurz vor.', spoken: 'Guten Tag. Bitte stellen Sie sich kurz vor.' },
    { role: 'Prüferin DUVI', prompt: 'Können Sie bitte Ihren Familiennamen buchstabieren?', spoken: 'Danke. Können Sie bitte Ihren Familiennamen buchstabieren?' },
    { role: 'Prüferin DUVI', prompt: 'Und wie ist bitte Ihre Telefonnummer oder Hausnummer?', spoken: 'Und wie ist bitte Ihre Telefonnummer oder Hausnummer?' },
  ];
  const cards = (part.cards || []).slice(0, 2);
  if (part.id === 'sp2') return cards.flatMap((card) => [
    { role: 'Prüferin DUVI', prompt: `Stellen Sie Mia eine Frage mit dem Wort „${card.keyword}“.`, spoken: `Bitte stellen Sie Ihrer Partnerin eine Frage mit dem Wort ${card.keyword}.`, keyword: card.keyword, example: card.example },
    { role: 'Prüfungspartnerin Mia', prompt: partnerQuestion(card.keyword), spoken: partnerQuestion(card.keyword), partner: partnerAnswer(card.keyword) },
  ]);
  if (EXAM_LEVEL === 'A2') return cards.flatMap((card) => [
    { role: 'Prüferin DUVI', prompt: `Machen Sie einen Vorschlag zum Punkt „${card.keyword}“.`, spoken: `Bitte machen Sie einen Vorschlag zum Punkt ${card.keyword}.`, keyword: card.keyword, example: card.example },
    { role: 'Prüfungspartnerin Mia', prompt: `Mia macht einen anderen Vorschlag zu „${card.keyword}“. Reagieren Sie und einigen Sie sich.`, spoken: `Ich habe einen anderen Vorschlag zum Punkt ${card.keyword}. Was meinen Sie?`, partner: `Mia: „Ich würde ${card.keyword} gern anders planen. Können wir einen Kompromiss finden?“` },
  ]);
  return cards.flatMap((card) => [
    { role: 'Prüferin DUVI', prompt: `Formulieren Sie eine Bitte mit „${card.keyword}“.`, spoken: `Bitte formulieren Sie eine Bitte mit dem Wort ${card.keyword}.`, keyword: card.keyword, example: card.example },
    { role: 'Prüfungspartnerin Mia', prompt: `Reagieren Sie auf Mias Bitte: „${partnerRequest(card.keyword)}“`, spoken: partnerRequest(card.keyword), partner: 'Mia reagiert auf Ihre Bitte: „Ja, natürlich.“ Jetzt bittet sie Sie um etwas.' },
  ]);
}

function partnerAnswer(keyword) {
  const answers = { Supermarkt: 'Der Supermarkt ist neben dem Bahnhof.', Brot: 'Das Brot kostet zwei Euro.', Öffnungszeiten: 'Der Laden ist von acht bis zwanzig Uhr geöffnet.', Zug: 'Der Zug fährt um neun Uhr.', Fahrkarte: 'Die Fahrkarte kostet zwölf Euro.', Hotel: 'Das Hotel ist in der Gartenstraße.', Gehalt: 'Das Gehalt kommt am Monatsende.', Urlaub: 'Ich habe vier Wochen Urlaub.', Vertrag: 'Mein Vertrag läuft ein Jahr.', Flugticket: 'Das Flugticket kostet 150 Euro.', Visum: 'Für dieses Land brauchen Sie kein Visum.', Bruder: 'Mein Bruder heißt Daniel.', Schwester: 'Meine Schwester ist 20 Jahre alt.', Familie: 'In meiner Familie sind fünf Personen.' };
  return answers[keyword] || `Hier ist meine Information zum Thema ${keyword}.`;
}

function partnerQuestion(keyword) {
  const questions = { Supermarkt: 'Wo kaufen Sie normalerweise ein?', Brot: 'Was essen Sie gern zum Frühstück?', Öffnungszeiten: 'Wann gehen Sie gern einkaufen?', Zug: 'Wohin fahren Sie gern mit dem Zug?', Fahrkarte: 'Wo kaufen Sie Ihre Fahrkarte?', Hotel: 'Wo übernachten Sie im Urlaub?', Gehalt: 'Wann bekommen Sie Ihr Gehalt?', Urlaub: 'Wohin fahren Sie im Urlaub?', Vertrag: 'Wo arbeiten Sie?', Flugticket: 'Wohin möchten Sie fliegen?', Visum: 'In welches Land möchten Sie reisen?', Bruder: 'Wie heißt Ihr Bruder?', Schwester: 'Wie alt ist Ihre Schwester?', Familie: 'Wie groß ist Ihre Familie?' };
  return questions[keyword] || `Was können Sie über ${keyword} sagen?`;
}

function partnerRequest(keyword) {
  const requests = { Fenster: 'Können Sie bitte das Fenster schließen?', Stift: 'Geben Sie mir bitte einen Stift.', Licht: 'Machen Sie bitte das Licht aus.', Tür: 'Können Sie bitte die Tür öffnen?', Wasser: 'Kann ich bitte ein Glas Wasser haben?', Handy: 'Kann ich bitte kurz Ihr Handy benutzen?', Bericht: 'Können Sie mir bitte den Bericht zeigen?', Kopiermaschine: 'Helfen Sie mir bitte mit der Kopiermaschine.', Präsentation: 'Können Sie mir bitte bei der Präsentation helfen?', Koffer: 'Helfen Sie mir bitte mit dem Koffer.', Weg: 'Zeigen Sie mir bitte den Weg zum Bahnhof.', Rechnung: 'Bringen Sie mir bitte die Rechnung.', Kuchen: 'Kann ich bitte ein Stück Kuchen haben?', Spiel: 'Spielen Sie bitte mit mir.', Hilfe: 'Können Sie mir bitte helfen?' };
  return requests[keyword] || `Können Sie mir bitte mit ${keyword} helfen?`;
}

function setupRecorder(part, answerKey, textarea, Recognition, canRecord) {
  const button = document.getElementById('record');
  if (!button) return;
  let recognition = null;
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];
  let recording = false;
  let recordTimer = null;
  let recordStartedAt = 0;
  let finalText = textarea.value ? `${textarea.value} ` : '';
  const status = document.getElementById('record-status');
  const title = document.getElementById('record-title');
  const stop = () => {
    try { recognition?.stop(); } catch {}
    try { if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); } catch {}
    stream?.getTracks().forEach((track) => track.stop());
    recording = false;
    if (recordTimer) clearInterval(recordTimer);
    recordTimer = null;
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
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const oldUrl = state.audio[answerKey];
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          const url = URL.createObjectURL(blob);
          state.audio[answerKey] = url;
          const playback = document.getElementById('playback');
          if (playback) { playback.src = url; playback.hidden = false; }
          if (!Recognition && !textarea.value.trim() && supa) {
            const nextButton = document.getElementById('next');
            if (nextButton) nextButton.disabled = true;
            status.textContent = 'Aufnahme wird sicher transkribiert …';
            try {
              const audioBase64 = await blobToBase64(blob);
              const { data, error } = await supa.functions.invoke('practice-ai-evaluate', {
                body: { action: 'transcribe-speaking', audioBase64, mimeType: blob.type, language: 'de' },
              });
              if (error || data?.error) throw error || new Error(data.error);
              textarea.value = String(data?.text || '').trim();
              activeCollector?.();
              updateSpeakingCoach(part, textarea.value);
              status.textContent = textarea.value
                ? 'Transkript erstellt. Bitte kurz prüfen und bei Bedarf korrigieren.'
                : 'Keine Sprache erkannt. Bitte noch einmal aufnehmen oder den Text eingeben.';
            } catch {
              status.textContent = 'Automatische Transkription nicht verfügbar. Bitte den Text manuell eingeben.';
            } finally {
              if (nextButton) nextButton.disabled = false;
            }
          }
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
        activeCollector?.();
        updateSpeakingCoach(part, textarea.value);
      };
      recognition.onend = () => { finalText = textarea.value ? `${textarea.value} ` : finalText; };
      try { recognition.start(); } catch {}
    }
    recording = true;
    recordStartedAt = Date.now();
    const timer = document.getElementById('record-time');
    const tickRecordTime = () => {
      if (!timer) return;
      const seconds = Math.max(0, Math.floor((Date.now() - recordStartedAt) / 1000));
      timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    };
    tickRecordTime();
    recordTimer = setInterval(tickRecordTime, 1000);
    button.classList.add('active');
    button.textContent = '■';
    title.textContent = 'Aufnahme läuft';
    status.textContent = 'Sprechen Sie jetzt. Drücken Sie zum Beenden erneut auf den Knopf.';
  };
  activeRecorderCleanup = stop;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Audio konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
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
  if (part.type === 'speak-intro' || part.type === 'speak-cards') {
    const total = speakingTurns(part).length;
    return { current: state.speakTurn + 1, total, percent: Math.round(((state.speakTurn + 1) / total) * 100) };
  }
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
  if (part.type === 'speak-intro' || part.type === 'speak-cards') return state.speakTurn > 0 && state.mode === 'practice';
  return !!part.items && state.idx > 0 && !(state.mode === 'exam' && section.id === 'hoeren');
}

function nextLabel(section, part) {
  if (part.type === 'speak-intro' || part.type === 'speak-cards') {
    return state.speakTurn + 1 < speakingTurns(part).length ? 'Nächste Gesprächsrunde →' : (state.part + 1 < section.parts.length ? 'Nächster Teil →' : 'Mündliche Prüfung abschließen →');
  }
  if (part.items && state.idx + 1 < part.items.length) return 'Weiter →';
  if (state.part + 1 < section.parts.length) return 'Nächster Teil →';
  if (state.mode === 'exam' && section.id === 'lesen') return 'Weiter zu Schreiben →';
  return 'Abschnitt abschließen →';
}

function answeredInPart(part) {
  if (part.type === 'speak-intro' || part.type === 'speak-cards') return speakingTurns(part).filter((_, index) => state.answers[`${part.id}:turn:${index}`]).length;
  if (part.items) return part.items.filter((item) => state.answers[item.id] !== undefined).length;
  if (part.fields) return part.fields.filter((field) => state.answers[field.id]).length;
  return state.answers[part.id] ? 1 : 0;
}

function partNavigator(part) {
  if (part.type === 'speak-intro' || part.type === 'speak-cards') return `<div class="part-nav">${speakingTurns(part).map((_, index) => `<span class="${index === state.speakTurn ? 'now' : state.answers[`${part.id}:turn:${index}`] ? 'done' : ''}">${index + 1}</span>`).join('')}</div>`;
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
  if (previous && !previous.disabled) previous.onclick = () => { collect?.(); if (part.type === 'speak-intro' || part.type === 'speak-cards') state.speakTurn--; else state.idx--; persistSession(); renderPart(); };
  document.getElementById('leave-session').onclick = () => {
    if (state.mode === 'practice') { clearSession(); renderSetup(); return; }
    submitExamEarly();
  };
  document.getElementById('next').onclick = async () => {
    collect?.();
    cleanupRecorder();
    if (part.type === 'speak-intro' || part.type === 'speak-cards') {
      if (state.speakTurn + 1 < speakingTurns(part).length) {
        state.speakTurn++;
        persistSession();
        renderPart();
        return;
      }
      if (state.part + 1 >= section.parts.length && !(await confirmSectionCompletion(section))) return;
      await gradeAi(section, part, true);
      nextPart(section);
      return;
    }
    if (part.items && state.idx + 1 < part.items.length) {
      state.idx++;
      persistSession();
      renderPart();
      return;
    }
    if (state.part + 1 >= section.parts.length && !(await confirmSectionCompletion(section))) return;
    if (section.aiGraded && part.type === 'free-write') await gradeAi(section, part, true);
    nextPart(section);
  };
}

async function submitExamEarly() {
  if (!state.active || state.mode !== 'exam') return;
  const confirmed = await showConfirm({
    title: 'Prüfung vorzeitig abgeben?',
    message: 'Ihre bisherigen Antworten werden ausgewertet. Alle leeren Aufgaben erhalten 0 Punkte und die Prüfung kann danach nicht fortgesetzt werden.',
    confirmLabel: 'Prüfung abgeben',
    cancelLabel: 'Weiterarbeiten',
    tone: 'danger',
  });
  if (!confirmed) return;
  activeCollector?.();
  state.aborted = true;
  results();
}

async function confirmSectionCompletion(section) {
  if (state.mode !== 'exam') return true;
  const missing = section.parts.reduce((sum, task) => {
    if (task.items) return sum + task.items.filter((item) => state.answers[item.id] === undefined || state.answers[item.id] === '').length;
    if (task.fields) return sum + task.fields.filter((field) => !state.answers[field.id]).length;
    if (task.type === 'speak-intro' || task.type === 'speak-cards') return sum + speakingTurns(task).filter((_, index) => !state.answers[`${task.id}:turn:${index}`]).length;
    return sum + (!state.answers[task.id] ? 1 : 0);
  }, 0);
  if (missing) return showConfirm({
    title: `${missing} ${missing === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} noch leer`,
    message: `Möchten Sie ${section.title} trotzdem abschließen? Leere Antworten erhalten 0 Punkte. Danach können Sie nicht zu diesem Abschnitt zurückkehren.`,
    confirmLabel: 'Trotzdem abschließen',
    cancelLabel: 'Antworten prüfen',
    tone: 'warning',
  });
  return showConfirm({
    title: `${section.title} abschließen?`,
    message: 'Alle Aufgaben in diesem Abschnitt sind bearbeitet. Nach dem Abschluss können Sie nicht mehr zurückkehren.',
    confirmLabel: 'Abschnitt abschließen',
    cancelLabel: 'Noch einmal prüfen',
  });
}

// ---------- scoring ----------
function labelChoice(item, part, value) {
  if (part.type === 'audio-fill') return value || '—';
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
    const ok = item.answer !== undefined && answer !== undefined && (part.type === 'audio-fill' ? textAnswerCorrect(answer, item.answer) : answer === item.answer);
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
  const isSpeaking = part.type === 'speak-intro' || part.type === 'speak-cards';
  const answer = isSpeaking
    ? speakingTurns(part).map((turn, index) => `${turn.role}: ${turn.prompt}\nTeilnehmer/in: ${state.answers[`${part.id}:turn:${index}`] || '—'}`).join('\n\n')
    : state.answers[part.id] || '';
  let result = null;
  if (supa && answer.length >= 4) {
    try {
      const { data } = await supa.functions.invoke('practice-ai-evaluate', {
        body: { action: isWrite ? 'evaluate-writing' : 'evaluate-speaking', [isWrite ? 'text' : 'transcript']: answer, language: 'de', level: EXAM_LEVEL, nativeLocale: 'de-DE', prompt: part.instructions, examMaxPoints: maxPointsForPart(part), examRubric: officialRubricPrompt(part) },
      });
      result = data && !data.error ? (data.evaluation || data) : null;
    } catch { result = null; }
  }
  const maxPoints = part.rubric?.maxPoints || section.maxPoints;
  const points = officialProductivePoints(result, answer, part, maxPoints);
  const previous = state.scores[section.id] || { pts: 0, max: section.maxPoints };
  state.scores[section.id] = { pts: Math.min(section.maxPoints, (previous.pts || 0) + points), max: section.maxPoints };
  state.ai[part.id] = result;
  state.graded[gradeKey] = true;
  const breakdown = Array.isArray(result?.officialBreakdown)
    ? result.officialBreakdown.map((entry) => `${entry.criterion}: ${entry.points}/${entry.maxPoints}`).join(' · ')
    : '';
  state.review.push({ sectionId: section.id, sec: section.title, part: part.title, q: part.instructions, your: answer || '—', correct: '', ok: points >= maxPoints * .6, explain: `${points} / ${maxPoints} Punkte${breakdown ? ` · ${breakdown}` : ''} · ${result?.summary || result?.nextStep || (answer ? 'Vorläufige regelbasierte Bewertung; für eine vollständige KI-Auswertung bitte anmelden.' : 'Keine Antwort abgegeben.')}` });
}

function officialRubricPrompt(part) {
  if (part.type === 'free-write') return `${part.instructions}\nLeitpunkte: ${(part.leitpunkte || []).join(' | ')}. Bewerten Sie wie Start Deutsch ${EXAM_NUMBER}: Inhaltspunkte, kommunikative Gestaltung, Anrede, Schluss und passende Textsorte.`;
  if (part.type === 'speak-intro') return `${part.instructions} Bewerten Sie getrennt: Vorstellung, Buchstabieren und Zahlenangabe. Je Leistung: voll erfüllt und verständlich, teilweise erfüllt oder nicht erfüllt.`;
  return `${part.instructions} Bewerten Sie jede dokumentierte Frage bzw. Bitte und jede Antwort bzw. Reaktion getrennt. Volle Punktzahl nur bei erfüllter und verständlicher Aufgabe, halbe Punktzahl bei teilweise erfüllter Aufgabe, sonst null.`;
}

function maxPointsForPart(part) { return Number(part.rubric?.maxPoints || (part.type === 'free-write' ? 10 : 0)); }

function officialProductivePoints(result, answer, part, maxPoints) {
  const official = Number(result?.officialPoints);
  if (Number.isFinite(official)) return Math.max(0, Math.min(maxPoints, official));
  const overall = Number(result?.overall);
  if (Number.isFinite(overall)) {
    if (part.type === 'free-write') {
      const task = Number(result?.criteria?.taskCompletion ?? overall);
      const communication = Number(result?.criteria?.communication ?? overall);
      const content = task >= 80 ? 9 : task >= 35 ? 4.5 : 0;
      const design = communication >= 75 ? 1 : communication >= 35 ? .5 : 0;
      return content + design;
    }
    return overall >= 75 ? maxPoints : overall >= 35 ? maxPoints / 2 : 0;
  }
  if (part.type === 'free-write') {
    const words = wordCount(answer);
    const hasGreeting = /\b(hallo|liebe[rn]?|sehr geehrte|guten tag)\b/i.test(answer);
    const hasClosing = /\b(grüße|gruß|tschüss|bis bald|danke)\b/i.test(answer);
    const content = words >= (part.minWords || 30) ? 9 : words >= 8 ? 4.5 : 0;
    return content + (hasGreeting && hasClosing ? 1 : hasGreeting || hasClosing ? .5 : 0);
  }
  const turns = speakingTurns(part);
  const weights = part.type === 'speak-intro' ? [1, 1, 1] : [2, 1, 2, 1];
  return turns.reduce((score, _, index) => {
    const words = wordCount(state.answers[`${part.id}:turn:${index}`] || '');
    return score + (words >= 4 ? weights[index] : words >= 1 ? weights[index] / 2 : 0);
  }, 0);
}

function scoreForm(section) {
  if (!section || state.formScored) return;
  const form = section.parts.find((part) => part.type === 'form-fill');
  if (!form) return;
  let correct = 0;
  form.fields.forEach((field) => {
    const ok = formAnswerMatches(state.answers[field.id], field.expected);
    if (ok) correct++;
    state.review.push({ sectionId: section.id, sec: section.title, part: form.title, q: field.label, your: state.answers[field.id] || '—', correct: field.expected, ok, explain: '' });
  });
  const previous = state.scores[section.id] || { pts: 0, max: section.maxPoints };
  state.scores[section.id] = { pts: Math.min(section.maxPoints, (previous.pts || 0) + Math.round((correct / Math.max(1, form.fields.length)) * 5)), max: section.maxPoints };
  state.formScored = true;
}

function formAnswerMatches(answer, expected) {
  const actual = norm(answer);
  const target = norm(expected);
  if (!actual || !target) return false;
  if (/\d/.test(target)) return actual === target;
  if (actual === target) return true;
  return target.length >= 5 && editDistance(actual, target) <= 1;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

function includedSections() {
  if (state.mode === 'practice' && state.practiceSection !== 'all') return exam.sections.filter((section) => section.id === state.practiceSection);
  return exam.sections;
}

async function gradePending(sections, updateStage = async () => {}) {
  await updateStage(0);
  for (const section of sections) if (section.id === 'hoeren' || section.id === 'lesen') scoreAuto(section);
  await updateStage(1);
  const writing = sections.find((section) => section.id === 'schreiben');
  if (writing) {
    scoreForm(writing);
    for (const part of writing.parts) if (part.type === 'free-write') await gradeAi(writing, part, false);
  }
  await updateStage(2);
  const speaking = sections.find((section) => section.id === 'sprechen');
  if (speaking) for (const part of speaking.parts) if (['speak-intro', 'speak-cards'].includes(part.type)) await gradeAi(speaking, part, false);
  await updateStage(3);
  await updateStage(4);
}

// ---------- results ----------
function loading(message) {
  app.innerHTML = `<section class="paper-card loading-card"><div class="spinner"></div><h3>${esc(message)}</h3><p class="muted small">Einen Moment bitte.</p></section>`;
}

function renderResultProcessing() {
  const locale = uiLocaleMeta();
  const stages = Array.isArray(tx('stages')) ? tx('stages') : examI18n.text.en.stages;
  app.innerHTML = `
    <section class="paper-card result-processing localized-copy" dir="${locale.dir}" lang="${locale.code}">
      <div class="processing-orbit" aria-hidden="true"><i></i><span>DX</span></div>
      <span class="eyebrow">DUVELA EXAM · Deutsch ${EXAM_LEVEL}</span>
      <h2>${esc(tx('processing'))}</h2>
      <p class="lead">${esc(tx('processingLead'))}</p>
      <ol class="processing-stages">${stages.map((stage, index) => `<li data-stage="${index}"><span>${index + 1}</span><div><b>${esc(stage)}</b><i></i></div></li>`).join('')}</ol>
      <p class="processing-wait">${esc(tx('wait'))}</p>
    </section>`;
  let previous = -1;
  return async (activeIndex) => {
    const items = [...document.querySelectorAll('.processing-stages li')];
    items.forEach((item, index) => {
      item.classList.toggle('done', index < activeIndex);
      item.classList.toggle('active', index === activeIndex);
    });
    if (activeIndex > previous) await new Promise((resolve) => setTimeout(resolve, activeIndex === 0 ? 180 : 360));
    previous = activeIndex;
  };
}

async function results() {
  if (!state.active && app.querySelector('.result-wrap')) return;
  state.active = false;
  state.finishedAt = Date.now();
  document.body.classList.remove('exam-active');
  const exit = document.exitFullscreen?.();
  exit?.catch?.(() => {});
  stopTimer();
  cleanupRecorder();
  document.onkeydown = null;
  activeCollector?.();
  clearSession();
  const sections = includedSections();
  const updateProcessingStage = renderResultProcessing();
  await gradePending(sections, updateProcessingStage);
  const rows = sections.map((section) => {
    const score = state.scores[section.id] || { pts: 0, max: section.maxPoints };
    return { id: section.id, title: section.title, pts: score.pts || 0, max: score.max || section.maxPoints, pct: Math.round(((score.pts || 0) / Math.max(1, score.max || section.maxPoints)) * 100) };
  });
  const points = rows.reduce((sum, row) => sum + row.pts, 0);
  const maxPoints = rows.reduce((sum, row) => sum + row.max, 0);
  const percent = Math.round((points / Math.max(1, maxPoints)) * 100);
  const isFull = sections.length === exam.sections.length;
  const passed = isFull && !state.aborted && points >= 36;
  const predicate = state.aborted ? 'Vorzeitig beendet' : isFull ? resultPredicate(points) : 'Training abgeschlossen';
  const sectionScores = rows.reduce((result, row) => { result[row.id] = { pts: row.pts, max: row.max, pct: row.pct }; return result; }, {});
  const previousAttempt = readExamHistory().find((entry) => entry.level === EXAM_LEVEL && entry.mode === 'exam');
  const saved = state.mode === 'exam' && isFull ? await saveAttempt(percent, passed, sectionScores) : false;
  const durationMinutes = Math.max(1, Math.round((Date.now() - state.startTime) / 60000));
  const localSaved = state.mode === 'exam' && isFull ? saveLocalAttempt({ level: EXAM_LEVEL, mode: state.mode, testId: exam.id, percent, points, passed, durationMinutes, sectionScores }) : false;
  const statusLabel = state.aborted ? 'ABGEBROCHEN' : isFull ? (passed ? 'BESTANDEN' : 'NOCH NICHT BESTANDEN') : 'ABGESCHLOSSEN';
  const weakest = rows.reduce((lowest, row) => !lowest || row.pct < lowest.pct ? row : lowest, null);
  const strongest = rows.reduce((highest, row) => !highest || row.pct > highest.pct ? row : highest, null);
  const delta = previousAttempt ? percent - Number(previousAttempt.percent || 0) : null;
  const focusRows = [...rows].sort((a, b) => a.pct - b.pct).slice(0, 2);
  const reportDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.finishedAt));
  const integrity = state.integrity || { focusLeaves: 0, reconnects: 0, reloads: 0 };

  app.innerHTML = `
    <div class="result-wrap">
      <section class="report-heading print-only"><div><b>DUVELA</b><strong>EXAM</strong></div><span>Ergebnisbericht · Deutsch ${EXAM_LEVEL}</span></section>
      <section class="result-card result-hero ${passed ? 'passed' : ''}">
        ${passed ? '<div class="result-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' : ''}
        <div><span class="eyebrow">${state.mode === 'exam' ? 'Prüfungsergebnis' : 'Trainingsergebnis'} · ${esc(exam.title)}</span><span class="result-status ${isFull && !passed ? 'fail' : ''}">${statusLabel}</span><h2 style="margin-top:14px">${esc(predicate)}</h2><p class="lead">${isFull ? `Sie haben ${points} von 60 Punkten erreicht. Zum Bestehen benötigen Sie mindestens 36 Punkte.` : `Sie haben ${points} von ${maxPoints} Punkten in diesem Training erreicht.`}</p><p class="small muted">Bearbeitungszeit: ${durationMinutes} Min.${saved || localSaved ? ' · Ergebnis gespeichert' : ''}</p></div>
        <div class="score-ring" style="--score:${percent}"><div><b>${points} / ${maxPoints}</b><small>${percent}%</small></div></div>
      </section>
      <section class="result-summary">
        <article><small>STÄRKSTE FERTIGKEIT</small><b>${esc(strongest?.title || '—')}</b><span>${strongest?.pct ?? 0}%</span></article>
        <article><small>ENTWICKLUNG</small><b>${delta == null ? 'Erste vollständige Prüfung' : delta > 0 ? `+${delta}% verbessert` : delta === 0 ? 'Ergebnis gehalten' : `${Math.abs(delta)}% unter dem letzten Ergebnis`}</b><span>${previousAttempt ? 'gegenüber der letzten Prüfung' : 'Ausgangspunkt gespeichert'}</span></article>
        <article><small>PRÜFUNGSBEREITSCHAFT</small><b>${passed ? `${EXAM_LEVEL}-Ziel erreicht` : percent >= 50 ? 'Fast am Ziel' : 'Weiter gezielt trainieren'}</b><span>${passed ? 'mindestens 36 / 60' : `${Math.max(0, 36 - points)} Punkte fehlen bis 36 / 60`}</span></article>
      </section>
      <section class="paper-card report-data">
        <div><small>TEILNEHMER/IN</small><b>${esc(state.candidateName || 'Trainingsteilnehmer/in')}</b></div>
        <div><small>TEILNEHMERNUMMER</small><b>${esc(state.candidateNumber || '—')}</b></div>
        <div><small>BERICHTSNUMMER</small><b>${esc(state.reportId || '—')}</b></div>
        <div><small>DATUM</small><b>${esc(reportDate)}</b></div>
      </section>
      <section class="paper-card question-card"><span class="eyebrow">Leistungsprofil</span><h2>Ergebnis nach Fertigkeit</h2><div class="score-grid">${rows.map(scoreBox).join('')}</div></section>
      <section class="paper-card question-card result-guidance"><span class="eyebrow">Nächster Schwerpunkt</span><h2>${esc(weakest?.title || 'Weiterlernen')}</h2><p class="lead">${esc(resultRecommendation(weakest?.id, weakest?.pct || 0))}</p>${state.mode === 'exam' ? `<div class="integrity-strip"><span><small>NEUSTARTS</small><b>${integrity.reloads}</b></span><span><small>FENSTER VERLASSEN</small><b>${integrity.focusLeaves}</b></span><span><small>VERBINDUNG WIEDERHERGESTELLT</small><b>${integrity.reconnects}</b></span></div>` : ''}</section>
      <section class="paper-card question-card improvement-plan"><span class="eyebrow">Ihr 7-Tage-Plan</span><h2>Die nächsten zwei Schritte</h2><div>${focusRows.map((row, index) => `<article><i>${index + 1}</i><span><b>${esc(row.title)}</b><small>${esc(resultRecommendation(row.id, row.pct))}</small></span><strong>${row.pct}%</strong></article>`).join('')}</div></section>
      <section class="paper-card question-card report-table-wrap"><span class="eyebrow">Punkteübersicht</span><table class="report-table"><thead><tr><th>Fertigkeit</th><th>Punkte</th><th>Maximum</th><th>Ergebnis</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.title)}</td><td>${row.pts}</td><td>${row.max}</td><td>${row.pct}%</td></tr>`).join('')}</tbody><tfoot><tr><th>Gesamt</th><th>${points}</th><th>${maxPoints}</th><th>${percent}%</th></tr></tfoot></table></section>
      <section class="paper-card question-card"><span class="eyebrow">Auswertung</span><h2>Antworten und Erklärungen</h2><p class="muted">Nutzen Sie die Hinweise, um Ihren nächsten Trainingsschwerpunkt zu wählen.</p><div class="review-list">${reviewHtml(sections)}</div></section>
      <div class="result-actions no-print"><button class="button primary" id="download-report">PDF speichern / drucken</button><button class="button secondary" id="share-result">Ergebnis kopieren</button><button class="button secondary" id="again">Neuen Modelltest starten</button><button class="button secondary" id="home">Zum Lernbereich</button></div>
      <footer class="report-footer print-only"><span>DUVELA EXAM · ${esc(state.reportId)}</span><span>Übungsauswertung · kein offizielles Zertifikat</span></footer>
      <p class="small muted">Der DUVELA-Ergebnisbericht ist eine Übungsauswertung und kein offizielles Sprachzertifikat.</p>
    </div>`;
  document.getElementById('download-report').onclick = printResultReport;
  document.getElementById('share-result').onclick = () => shareResult(points, maxPoints, percent, passed);
  document.getElementById('again').onclick = renderSetup;
  document.getElementById('home').onclick = () => { location.href = './app.html?role=learner#study'; };
}

async function shareResult(points, maxPoints, percent, passed) {
  const message = `DUVELA EXAM Deutsch ${EXAM_LEVEL}: ${points}/${maxPoints} Punkte (${percent}%) – ${passed ? 'bestanden' : 'weiter im Training'}.`;
  try {
    await navigator.clipboard.writeText(message);
    showExamNotice('Ergebnis wurde kopiert.');
  } catch {
    showExamNotice(message);
  }
}

function createReportId() {
  return `DX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function printResultReport() {
  const oldTitle = document.title;
  document.title = `DUVELA_${EXAM_LEVEL}_Ergebnis_${state.candidateNumber || state.reportId}`;
  window.print();
  setTimeout(() => { document.title = oldTitle; }, 500);
}

function resultRecommendation(sectionId, percent) {
  const level = percent < 40 ? `Beginnen Sie mit kurzen, klaren ${EXAM_LEVEL}-Aufgaben und wiederholen Sie sie täglich.` : 'Festigen Sie diesen Bereich mit einem weiteren Modelltest und prüfen Sie danach Ihre Fehler.';
  const advice = {
    hoeren: 'Trainieren Sie Uhrzeiten, Zahlen und kurze Ansagen. Hören Sie zuerst auf Schlüsselwörter und erst danach auf Details.',
    lesen: 'Markieren Sie Namen, Zeiten, Orte und Negationen. Vergleichen Sie anschließend jede Aussage direkt mit dem Text.',
    schreiben: 'Üben Sie Formularfelder und kurze Mitteilungen mit Anrede, drei Leitpunkten und Schlussformel.',
    sprechen: EXAM_LEVEL === 'A2' ? 'Üben Sie vollständige Sätze, Rückfragen, Vorschläge, Reaktionen und gemeinsame Entscheidungen laut.' : 'Antworten Sie in vollständigen, einfachen Sätzen und üben Sie Fragen, Bitten, Buchstabieren und Zahlen laut.',
  };
  return `${advice[sectionId] || 'Wiederholen Sie die Aufgaben, bei denen Sie Punkte verloren haben.'} ${level}`;
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
