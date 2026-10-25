(function () {
  // Self-contained ELSA oral/full exam for the web app. Reuses the deployed
  // openai-assistant edge actions (respond / evaluate_exam / generate_exam_module
  // / evaluate_exam_writing). Listening playback uses the browser speech engine.
  // Persian copy for the exam UI (same wording as the Hub's ELSA screen). The
  // shared tr(en, ru) only knows English and Russian, so Farsi is looked up here
  // by the English string and falls back to it when a phrase is missing.
  const FA = {
    'Examiner': 'ممتحن',
    'Mock exam': 'آزمون آزمایشی',
    'Goethe / telc / ÖSD / DTZ — speaking, reading, listening, writing': 'Goethe / telc / ÖSD / DTZ — گفتار، خواندن، شنیدن، نوشتار',
    'Mock oral exam': 'آزمون شفاهی آزمایشی',
    'Pick an exam and level. ELSA runs it part by part and grades you.': 'آزمون و سطح را انتخاب کنید. ELSA آن را بخش‌به‌بخش اجرا و شما را ارزیابی می‌کند.',
    'Exam': 'آزمون',
    'Level': 'سطح',
    'Tap a part to practise just that part with ELSA, or leave none selected for the full sequence.':
      'برای تمرین فقط همان بخش با ELSA روی یک بخش بزنید، یا برای دنباله کامل هیچ‌کدام را انتخاب نکنید.',
    'Prepare a short talk covering these points': 'دربارهٔ این نکات یک صحبت کوتاه آماده کنید',
    'Topic': 'موضوع',
    'Start exam': 'شروع آزمون',
    'Part': 'بخش',
    'Finish & get result': 'پایان و دریافت نتیجه',
    'Type your answer…': 'پاسخ خود را بنویسید…',
    'End early & get result': 'پایان زودهنگام و دریافت نتیجه',
    'Grading your exam…': 'در حال نمره‌دهی آزمون شما…',
    'PASSED': 'قبول',
    'NOT PASSED': 'مردود',
    'Fluency': 'روانی',
    'Accuracy': 'دقت',
    'Vocabulary': 'واژگان',
    'Pronunciation': 'تلفظ',
    'By part': 'بر اساس بخش',
    'Mistakes to fix': 'اشتباهات برای اصلاح',
    'What to improve': 'چه چیزی را بهبود دهید',
    'New exam': 'آزمون جدید',
    'Say a few sentences about each point': 'درباره‌ی هر مورد چند جمله بگویید',
    'Tell one connected story on this topic': 'دربارهٔ این موضوع به‌صورت پیوسته صحبت کنید',
    'The points are hints — speak in one monologue, no need to answer each one separately.':
      'نکته‌ها فقط راهنما هستند — یکجا و پیوسته صحبت کنید؛ لازم نیست به هر نکته جداگانه پاسخ دهید.',
    'ELSA notes': 'یادداشت‌های ELSA',
    'Better: ': 'بهتر است بگویید: ',
  };

  function createElsaExam(ctx) {
    const { supa, esc } = ctx;
    const appLang = function () { return String(ctx.getAppLang ? ctx.getAppLang() : '').toLowerCase(); };
    const isFa = function () { return appLang() === 'fa'; };
    const tr = function (en, ru) { return (isFa() && FA[en]) || ctx.tr(en, ru); };
    // Language ELSA writes feedback, corrections and exam instructions in.
    const nativeLocale = function () { return isFa() ? 'fa-IR' : ctx.isRu ? 'ru-RU' : 'en-US'; };
    // The exam itself is German: keep it left-to-right inside an RTL (Farsi) page.
    const LTR = ' dir="ltr"';

    const BOARD_LABEL = { goethe: 'Goethe-Zertifikat', telc: 'telc Deutsch', oesd: 'ÖSD', dtz: 'DTZ' };
    const BOARDS = ['goethe', 'telc', 'oesd', 'dtz'];
    const LEVELS_BY_BOARD = {
      goethe: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      telc: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      oesd: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      dtz: ['A2', 'B1'],
    };
    // Part summaries per board+level, mirrored from the Hub's shared/ai-practice-exams.ts
    // blueprint (same wording) so the part-picker list and turn count match what ELSA runs.
    // Goethe B1 has 2 extra warm-up parts (self-intro card + picture) bolted onto the real
    // 3-part exam (planen / präsentieren / über die Präsentation sprechen) — see cuesForPart.
    const PART_SUMMARIES = {
      goethe: {
        A1: ['Sich vorstellen', 'Informationen erfragen und geben', 'Bitten und darauf reagieren'],
        A2: ['Fragen zur Person', 'Von sich erzählen', 'Gemeinsam etwas planen'],
        B1: ['Gemeinsam etwas planen', 'Ein Thema präsentieren', 'Über ein Thema sprechen'],
        B2: ['Einen Standpunkt vortragen', 'Diskutieren und argumentieren'],
        C1: ['Freien Vortrag halten', 'Anspruchsvoll diskutieren'],
        C2: ['Vortrag auf C2-Niveau', 'Kontroverse Diskussion'],
      },
      telc: {
        A1: ['Sich vorstellen', 'Informationen erfragen und geben', 'Bitten formulieren'],
        A2: ['Kontaktaufnahme', 'Über ein Thema sprechen', 'Gemeinsam planen'],
        B1: ['Kontaktaufnahme', 'Gespräch über ein Thema', 'Gemeinsam etwas planen'],
        B2: ['Präsentation', 'Diskussion', 'Lösung aushandeln'],
        C1: ['Präsentation', 'Diskussion auf hohem Niveau'],
        C2: ['Anspruchsvoller Vortrag', 'Debatte auf C2-Niveau'],
      },
      oesd: {
        A1: ['Sich vorstellen', 'Über Alltag sprechen', 'Bitten und reagieren'],
        A2: ['Über sich sprechen', 'Ein Thema besprechen', 'Gemeinsam planen'],
        B1: ['Erfahrungen austauschen', 'Präsentation', 'Gemeinsam entscheiden'],
        B2: ['Standpunkt vortragen', 'Diskussion'],
        C1: ['Vortrag', 'Anspruchsvolle Diskussion'],
        C2: ['Anspruchsvoller Vortrag', 'Debatte'],
      },
      dtz: {
        A2: ['Sich vorstellen', 'Ein Foto beschreiben', 'Gemeinsam etwas planen'],
        B1: ['Sich vorstellen', 'Ein Foto beschreiben', 'Gemeinsam etwas planen'],
      },
    };
    function partSummariesForCurrent() {
      return (PART_SUMMARIES[state.board] && PART_SUMMARIES[state.board][state.level]) || [];
    }
    // The real number of parts, read from PART_SUMMARIES rather than guessed from the level —
    // telc B2 has 3 real parts, for instance, unlike every other board's B2.
    function PARTS(board, level) {
      return ((PART_SUMMARIES[board] && PART_SUMMARIES[board][level]) || []).length || 2;
    }

    let state = null;

    function reset() {
      state = {
        board: 'goethe',
        level: 'B1',
        selectedPart: null,
        trainingMode: 'exam',
        micStatus: 'unchecked',
        phase: 'setup',
        messages: [],
        conversationId: null,
        sending: false,
        evaluation: null,
        skills: { sprechen: null },
        runId: 0,
        endedEarly: false,
        voiceConversation: false,
        speakerEnabled: true,
      };
    }

    async function call(body) {
      const { data, error } = await supa.functions.invoke('openai-assistant', { body });
      if (error) throw new Error(error.message || 'Request failed');
      return data || {};
    }

    // Printed cue cards by part index (0-based): DTZ Teil 1 (self-intro keywords), Teil 2
    // (planning bullets), Teil 3 (picture-description sentence starter + guiding questions).
    // Goethe A1 only has the Teil 1 self-intro card.
    const SELF_INTRO_CUES = ['Name?', 'Alter?', 'Land?', 'Wohnort?', 'Sprachen?', 'Beruf?', 'Hobby?'];
    const PICTURE_CUES = ['Auf dem Bild sehe ich …', 'Was machen die Personen?', 'Wie fühlen sich die Personen?', 'Haben Sie das auch schon erlebt?'];
    // Matches the fixed designed planning-card graphic shown on screen for this part (see
    // PLANNING_CARD_IMAGE below) — keep these in sync with that image's text.
    const PLANNING_CUES = ['Wann?', 'Wohin?', 'Mit wem?', 'Wie viel?', 'Was brauchen wir?', 'Nächste Schritte?'];
    // Structure for the free-presentation part — the same three-step shape a real Goethe B1
    // topic card uses (experience → pros/cons → opinion), for whichever topic gets picked.
    const PRESENTATION_CUES = ['Stellen Sie Ihr Thema und die Struktur vor.', 'Berichten Sie von einer persönlichen Erfahrung.', 'Beschreiben Sie die Situation in Ihrem Heimatland.', 'Nennen Sie Vor- und Nachteile und Ihre Meinung.', 'Bedanken Sie sich bei den Zuhörenden.'];
    // Topic pool for the presentation part (only Goethe B1 Teil 4 uses it today), mirrored from
    // the Hub's TOPIC_POOL.B1 in shared/ai-practice-exams.ts.
    const PRESENTATION_TOPIC_POOL = [
      'Brauchen Kinder Mobiltelefone?', 'Sehen Kinder zu viel fern?',
    ];
    function pickPresentationTopic() {
      return PRESENTATION_TOPIC_POOL[Math.floor(Math.random() * PRESENTATION_TOPIC_POOL.length)];
    }
    // Goethe A2 Teil 2 ("Von sich erzählen"): a topic question on top and four Stichpunkte
    // under it; the candidate tells one connected story. Mirrored from the Hub's
    // A2_TALK_TOPICS in shared/ai-practice-exams.ts — one card is picked per attempt.
    const A2_TALK_TOPICS = [
      { topic: 'Wie lernen Sie Deutsch?', cues: ['Wo?', 'Wie oft?', 'Mit wem?', 'Was ist schwer?'] },
      { topic: 'Was machen Sie am Wochenende?', cues: ['Was?', 'Wo?', 'Mit wem?', 'Warum gern?'] },
      { topic: 'Wie feiern Sie Ihren Geburtstag?', cues: ['Wo?', 'Mit wem?', 'Essen und Trinken?', 'Geschenke?'] },
      { topic: 'Wohin reisen Sie gern?', cues: ['Wohin?', 'Wann?', 'Mit wem?', 'Warum?'] },
      { topic: 'Was essen Sie gern?', cues: ['Was?', 'Wann?', 'Wo?', 'Selbst kochen?'] },
      { topic: 'Wie wohnen Sie?', cues: ['Wo?', 'Wie groß?', 'Mit wem?', 'Was gefällt Ihnen?'] },
      { topic: 'Was machen Sie in Ihrer Freizeit?', cues: ['Was?', 'Wie oft?', 'Mit wem?', 'Warum?'] },
      { topic: 'Wie war Ihr letzter Urlaub?', cues: ['Wohin?', 'Wann?', 'Mit wem?', 'Was haben Sie gemacht?'] },
      { topic: 'Wie sieht Ihr Arbeitstag aus?', cues: ['Wann?', 'Wo?', 'Was genau?', 'Was gefällt Ihnen?'] },
      { topic: 'Wie kaufen Sie ein?', cues: ['Wo?', 'Wie oft?', 'Was?', 'Online oder im Geschäft?'] },
    ];
    function pickTalkTopic() {
      return A2_TALK_TOPICS[Math.floor(Math.random() * A2_TALK_TOPICS.length)];
    }
    // The monologue part is Teil 2 (index 1), only on Goethe A2.
    function isTalkTopicPart(partIndex) {
      return partIndex === 1 && state.board === 'goethe' && state.level === 'A2';
    }
    function cuesForPart(partIndex) {
      if (state.board === 'dtz') return [SELF_INTRO_CUES, PICTURE_CUES, PLANNING_CUES][partIndex] || null;
      if (state.board === 'goethe' && state.level === 'A2') {
        return [SELF_INTRO_CUES, state.talkTopic ? state.talkTopic.cues : null, PLANNING_CUES][partIndex] || null;
      }
      if (state.board === 'goethe' && state.level === 'B1') return [PLANNING_CUES, PRESENTATION_CUES, null][partIndex] || null;
      if (state.board === 'goethe' && state.level === 'A1' && partIndex === 0) return SELF_INTRO_CUES;
      return null;
    }
    // Picture description is supported only by DTZ Teil 2 in this simulator.
    // Goethe B1 follows its three official tasks: planning, presentation, discussion.
    function isPictureTaskPart(partIndex) {
      return state.board === 'dtz' && partIndex === 1;
    }
    // Planning is Goethe B1 Teil 1, DTZ Teil 3 and Goethe A2 Teil 3.
    function isPlanningTaskPart(partIndex) {
      if (state.board === 'goethe' && state.level === 'B1') return partIndex === 0;
      if (state.board === 'goethe' && state.level === 'A2') return partIndex === 2;
      return state.board === 'dtz' && partIndex === 2;
    }
    // Goethe B1 Teil 2 is the structured presentation task.
    function isPresentationTaskPart(partIndex) {
      return partIndex === 1 && state.board === 'goethe' && state.level === 'B1';
    }
    // Fixed designed graphic for the planning part (same every attempt, unlike EXAM_PHOTOS),
    // shown above the usual plain text cue card.
    const PLANNING_CARD_IMAGE = './assets/exam-photos/planen.jpg';
    // Bank of everyday-life stock photos, each paired with an objective description of its real
    // content (mirrored from the Hub's app/native/ai-practice-exam.tsx). ELSA never "sees" the
    // photo — the description is fed into her prompt so the final score can check whether the
    // candidate's spoken description actually matched the picture, not just grammar/fluency.
    // bild-06/bild-07 are left out: both have a stock-preview caption baked into the pixels
    // ("Bild 11: Zu Hause – gemeinsam kochen"), which would let a candidate just read it aloud.
    // One is picked at random each time the exam starts (state.photo, set in startExam) and
    // stays the same across that part's exchanges.
    const EXAM_PHOTOS = [
      { src: './assets/exam-photos/bild-01.jpg', description: 'Vier Erwachsene joggen gemeinsam an einem Fluss entlang; im Hintergrund sind der Kölner Dom und eine alte Eisenbahnbrücke zu sehen.' },
      { src: './assets/exam-photos/bild-02.jpg', description: 'Eine Frau kauft mit einem Einkaufswagen in einem Supermarkt Gemüse ein und nimmt gerade eine rote Paprika aus dem Regal.' },
      { src: './assets/exam-photos/bild-03.jpg', description: 'Eine junge Frau führt mit einem Mann im Anzug ein Vorstellungsgespräch in einem Büro und hält dabei ihren Lebenslauf in der Hand.' },
      { src: './assets/exam-photos/bild-04.jpg', description: 'Ein Vater, eine Tochter und eine Mutter kochen gemeinsam in der Küche und bereiten Gemüse und einen Salat zu.' },
      { src: './assets/exam-photos/bild-05.jpg', description: 'Eine Familie mit zwei Kindern kocht gemeinsam in der Küche und bereitet einen großen Salat mit viel frischem Gemüse zu.' },
      { src: './assets/exam-photos/bild-08.jpg', description: 'Eine junge Frau leiht sich in einer Bibliothek Bücher aus, während eine Bibliothekarin sie am Empfang einscannt.' },
      { src: './assets/exam-photos/bild-09.jpg', description: 'Ein Mann gibt an einem Postschalter ein Paket ab, das von der Angestellten entgegengenommen wird.' },
      { src: './assets/exam-photos/bild-10.jpg', description: 'Ein Kellner bringt in einem Café zwei Frauen Kaffee und ein Stück Kuchen an den Tisch.' },
      { src: './assets/exam-photos/bild-11.jpg', description: 'Ein Paar trägt beim Umzug gemeinsam Kartons in eine neue, noch voller Umzugskisten stehende Wohnung.' },
      { src: './assets/exam-photos/bild-12.jpg', description: 'Ein Paar repariert gemeinsam draußen im Park ein Fahrrad.' },
      { src: './assets/exam-photos/bild-13.jpg', description: 'Eine Ärztin bespricht mit einer Patientin in der Praxis Untersuchungsergebnisse anhand einer Grafik.' },
      { src: './assets/exam-photos/bild-14.jpg', description: 'Ein Mann mit Koffer und Rucksack kauft am Fahrkartenautomaten im Bahnhof ein Zugticket.' },
      { src: './assets/exam-photos/bild-15.jpg', description: 'Ein Paar kocht gemeinsam in der Küche: er schneidet Gemüse, sie wäscht Salat.' },
      { src: './assets/exam-photos/bild-16.jpg', description: 'Drei Kolleginnen und Kollegen schauen im Büro gemeinsam auf einen Laptop-Bildschirm.' },
      { src: './assets/exam-photos/bild-17.jpg', description: 'Eine vierköpfige Familie macht mit ihrem Hund ein Picknick im Park.' },
      { src: './assets/exam-photos/bild-18.jpg', description: 'Eine Frau kauft mit einem vollen Einkaufswagen in einem Supermarkt Gemüse ein und nimmt eine rote Paprika aus dem Regal.' },
      { src: './assets/exam-photos/bild-19.jpg', description: 'Eine vierköpfige Familie sitzt gemeinsam am Tisch und isst zu Abend.' },
      { src: './assets/exam-photos/bild-20.jpg', description: 'An einer Bushaltestelle steigt ein Mann in den Bus, während eine Frau wartet.' },
      { src: './assets/exam-photos/bild-21.jpg', description: 'Ein junger Mann lernt an seinem Schreibtisch mit Büchern, einem Notizbuch und einem Laptop.' },
      // bild-22 to bild-32 ported from the Hub native app's richer photo bank (mirrored
      // 2026-10-11) so both apps cover the same range of everyday scenes.
      { src: './assets/exam-photos/bild-22.jpg', description: 'Eine Frau geht mit einem Golden Retriever an der Leine im Park spazieren.' },
      { src: './assets/exam-photos/bild-23.jpg', description: 'Ein Mann brät in der Küche Gemüse in einer Pfanne.' },
      { src: './assets/exam-photos/bild-24.jpg', description: 'Eine Frau putzt mit Gummihandschuhen und einem Reinigungsspray die Küchenarbeitsplatte.' },
      { src: './assets/exam-photos/bild-25.jpg', description: 'Drei Freunde sitzen draußen an einem Café-Tisch und trinken gemeinsam Kaffee.' },
      { src: './assets/exam-photos/bild-26.jpg', description: 'Ein Mann trainiert im Fitnessstudio mit einer Kurzhantel seinen Bizeps.' },
      { src: './assets/exam-photos/bild-27.jpg', description: 'Eine Frau sitzt im Wohnzimmer auf dem Boden und packt einen Koffer für eine Reise.' },
      { src: './assets/exam-photos/bild-28.jpg', description: 'Vier Studierende lernen gemeinsam in der Bibliothek an einem Tisch mit Laptop und Büchern.' },
      { src: './assets/exam-photos/bild-29.jpg', description: 'Ein Paar streicht gemeinsam eine Wand hellgrün; im Zimmer stehen Umzugskartons und eine Leiter.' },
      { src: './assets/exam-photos/bild-30.jpg', description: 'Eine Patientin sitzt auf der Untersuchungsliege und schildert dem Arzt ihre Beschwerden, während er sich auf einem Klemmbrett Notizen macht.' },
      { src: './assets/exam-photos/bild-31.jpg', description: 'Ein Patient sitzt auf der Untersuchungsliege und spricht mit der Ärztin, die seine Angaben auf einem Klemmbrett notiert.' },
      { src: './assets/exam-photos/bild-32.jpg', description: 'Eine Apothekerin reicht einer Kundin über den Tresen eine Medikamentenschachtel, im Hintergrund sind Regale voller Arzneimittel zu sehen.' },
    ];
    // Avoid repeating a photo the candidate just had — keep a short rolling history (up to a
    // third of the bank) and resample until we land outside it. Ported from the Hub native app
    // after a tester reported the same picture coming back 2-3 times in a row with the old
    // pure-Math.random() pick (this file never got that fix).
    const recentExamPhotoIndexes = [];
    function pickExamPhoto() {
      const avoidCount = Math.min(EXAM_PHOTOS.length - 1, Math.ceil(EXAM_PHOTOS.length / 3));
      let index = Math.floor(Math.random() * EXAM_PHOTOS.length);
      let attempts = 0;
      while (recentExamPhotoIndexes.includes(index) && attempts < 20) {
        index = Math.floor(Math.random() * EXAM_PHOTOS.length);
        attempts += 1;
      }
      recentExamPhotoIndexes.push(index);
      if (recentExamPhotoIndexes.length > avoidCount) {
        recentExamPhotoIndexes.shift();
      }
      return EXAM_PHOTOS[index];
    }

    // Indices this attempt actually runs: every part in sequence, or just the one the
    // learner picked on the setup screen (state.selectedPart, 0-based).
    function activePartIndices() {
      if (state.selectedPart != null) return [state.selectedPart];
      const total = PARTS(state.board, state.level);
      return Array.from({ length: total }, function (_, i) { return i; });
    }

    function topic() {
      const indices = activePartIndices();
      let cueLines = '';
      indices.forEach(function (i) {
        const cues = cuesForPart(i);
        if (!cues) return;
        if (isPictureTaskPart(i)) {
          // A real photo is shown on screen — say a plain, natural instruction instead of
          // reading the sentence-starter and guiding questions out loud as a list. ELSA can't
          // see the photo either, so tell her what it actually shows, only to judge at the end
          // whether the candidate's description matched it — never reveal it upfront.
          const photoLine = state.photo
            ? ' Das Foto, das der Kandidat in diesem Teil sieht, zeigt tatsächlich: ' + state.photo.description +
              ' Nutze das ausschließlich, um am Ende zu beurteilen, ob die Beschreibung des Kandidaten zum Foto passt — verrate ihm nicht, was auf dem Foto ist.'
            : '';
          cueLines += ' In Teil ' + (i + 1) + ' sieht der Kandidat ein Foto auf dem Bildschirm. Sage zu Beginn dieses Teils nur eine kurze, natürliche Aufforderung wie „Bitte beschreiben Sie das Bild, das Sie sehen, und erzählen Sie von eigenen Erfahrungen dazu." — lies die folgenden Punkte NICHT als Liste vor, nutze sie nur als Grundlage für deine Nachfrage am Ende, falls der Kandidat etwas davon nicht von selbst erwähnt: ' + cues.join(' ') + photoLine;
        } else if (isTalkTopicPart(i) && state.talkTopic) {
          // A monologue part: the candidate tells one connected story about the topic; the
          // Stichpunkte only suggest what to cover, they are not separate questions.
          cueLines += ' In Teil ' + (i + 1) + ' sieht der Kandidat eine Themenkarte mit der Frage „' + state.talkTopic.topic + '" und diesen Stichpunkten: ' + cues.join(' ') +
            ' Bitte ihn zu Beginn dieses Teils, zu GENAU dieser Frage zusammenhängend und frei zu erzählen — als EIN Monolog, nicht Punkt für Punkt; er muss nicht jeden Punkt einzeln beantworten. Unterbrich ihn nicht. Erst wenn er fertig ist: eine kurze Rückfrage zu einem Punkt, den er nicht erwähnt hat.';
        } else if (isPresentationTaskPart(i) && state.topic) {
          // The card shows one fixed topic for this attempt — ELSA must present on exactly
          // that topic, not invent or pick a different one.
          cueLines += ' In Teil ' + (i + 1) + ' sieht der Kandidat eine Themenkarte mit dem Thema „' + state.topic + '" und diesen Punkten: ' + cues.join(' ') +
            ' Sprich in diesem Teil ausschließlich über GENAU dieses Thema — nicht über ein anderes — und gehe dabei zu Beginn kurz auf alle Punkte ein.';
        } else {
          cueLines += ' In Teil ' + (i + 1) + ' sieht der Kandidat eine Stichwortkarte mit genau diesen Punkten: ' + cues.join(' ') +
            ' Lade ihn zu Beginn dieses Teils zu allen Punkten ein und hake am Ende nach, falls einer fehlt, damit er ausführlich antwortet.';
        }
      });
      const summaries = partSummariesForCurrent();
      const focusLine = state.selectedPart != null
        ? ' Führe NUR Teil ' + (state.selectedPart + 1) + (summaries[state.selectedPart] ? ' (' + summaries[state.selectedPart] + ')' : '') +
          ' durch, mit einer realistischen Nachfrage danach, und beende die Prüfung dann.'
        : ' Führe die Prüfung realistisch Teil für Teil durch und stelle eine Nachfrage pro Teil.';
      return BOARD_LABEL[state.board] + ' ' + state.level + ' — mündliche Prüfung (Sprechen).' + focusLine + cueLines;
    }

    function lessonParams(turnIndex) {
      return {
        practiceMode: 'examiner',
        practiceTopic: topic(),
        partnerName: 'ELSA',
        partnerRole: 'examiner',
        locale: 'de-DE',
        nativeLocale: nativeLocale(),
        levelRange: state.level,
        nativeHelp: false,
        lessonTemplate: BOARD_LABEL[state.board] + ' ' + state.level,
        lessonGoal: state.selectedPart != null
          ? (state.trainingMode==='practice' ? 'Conduct only Teil ' + (state.selectedPart + 1) + ' of the ' + BOARD_LABEL[state.board] + ' ' + state.level + ' oral exam. After each learner response, provide at most one brief learning correction.' : 'Conduct only Teil ' + (state.selectedPart + 1) + ' of the ' + BOARD_LABEL[state.board] + ' ' + state.level + ' oral exam. Do not give hints or corrections during responses.')
          : 'Conduct the ' + BOARD_LABEL[state.board] + ' ' + state.level + ' oral exam part by part. Do not give hints or corrections during assessed responses.',
        lessonTurnIndex: turnIndex,
        lessonTurnTarget: activePartIndices().length * 2,
      };
    }

    // ---- overlay ----
    function ensureOverlay() {
      let overlay = document.getElementById('elsaExamOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'elsaExamOverlay';
      overlay.className = 'overlay';
      overlay.innerHTML =
        '<div class="overlay-card elsa-exam-overlay-card" style="width:min(820px,100%);max-height:88vh;display:flex;flex-direction:column">' +
        '<div class="overlay-head"><h2 id="elsaExamTitle">ELSA · ' + esc(tr('Examiner', 'Экзаменатор')) + '</h2>' +
        '<button type="button" id="elsaExamClose" aria-label="Close">✕</button></div>' +
        '<div class="overlay-body" id="elsaExamBody" style="overflow:auto"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#elsaExamClose').addEventListener('click', close);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      return overlay;
    }
    function close() {
      const overlay = document.getElementById('elsaExamOverlay');
      if (overlay) overlay.classList.remove('open');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    function open() {
      reset();
      ensureOverlay();
      document.getElementById('elsaExamOverlay').classList.add('open');
      renderSetup();
    }

    function body() { return document.getElementById('elsaExamBody'); }

    // ---- setup ----
    function voiceRecognition() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
    function startVoiceInput(input, button) {
      const Recognition = voiceRecognition();
      if (!Recognition || !input) return;
      let recognition;
      try { recognition = new Recognition(); } catch (error) { return; }
      let finalText = '';
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = false;
      button.disabled = true;
      button.setAttribute('aria-pressed', 'true');
      button.textContent = '■';
      recognition.onresult = function (event) {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const phrase = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += phrase + ' ';
          else interim += phrase;
        }
        input.value = (finalText || interim).trim();
      };
      recognition.onerror = function () {
        button.title = tr('Voice input could not start. Type your answer instead.', 'Не удалось включить голосовой ввод. Введите ответ текстом.');
      };
      recognition.onend = function () {
        button.disabled = false;
        button.setAttribute('aria-pressed', 'false');
        button.textContent = '🎙';
      };
      try { recognition.start(); } catch (error) { recognition.onend(); }
    }

    function microphoneCheck() {
      var Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Recognition){state.micStatus='unsupported';renderSetup();return;}
      try {
        var recognition=new Recognition();
        state.micStatus='checking';renderSetup();
        recognition.lang='de-DE';
        recognition.onstart=function(){state.micStatus='ready';renderSetup();try{recognition.stop();}catch(error){}};
        recognition.onerror=function(event){state.micStatus=event && event.error==='not-allowed'?'denied':'unavailable';renderSetup();};
        recognition.onend=function(){if(state.micStatus==='checking'){state.micStatus='unavailable';renderSetup();}};
        recognition.start();
      } catch(error) { state.micStatus='unavailable';renderSetup(); }
    }

    function expectedExamMinutes() { return activePartIndices().length * (state.trainingMode==='exam'?4:3); }

    function renderSetup() {
      state.phase='setup';
      const boardBtns=BOARDS.map(function(board){return '<button type="button" class="elsa-choice '+(state.board===board?'active':'')+'" data-board="'+board+'">'+esc(BOARD_LABEL[board])+'</button>';}).join('');
      const levelBtns=LEVELS_BY_BOARD[state.board].map(function(level){return '<button type="button" class="elsa-level '+(state.level===level?'active':'')+'" data-level="'+level+'">'+level+'</button>';}).join('');
      const partRows=partSummariesForCurrent().map(function(summary,index){var active=state.selectedPart===index;return '<button type="button" class="elsa-part '+(active?'active':'')+'" data-part="'+index+'"><span>Teil '+(index+1)+'</span><b>'+esc(summary)+'</b>'+(active?'<i>✓</i>':'')+'</button>';}).join('');
      const micText={unchecked:tr(voiceRecognition()?'Voice input is available during the session.':'Text practice selected',voiceRecognition()?'Голосовой ввод доступен во время занятия.':'Выбрана текстовая практика'),checking:tr('Checking microphone permission…','Проверяем доступ к микрофону…'),ready:tr('Microphone access confirmed for voice input.','Доступ к микрофону подтверждён для голосового ввода.'),denied:tr('Microphone permission was denied. Continue with text practice.','Доступ к микрофону отклонён. Продолжайте текстовую практику.'),unsupported:tr('Voice input is unavailable in this browser.','Голосовой ввод недоступен в этом браузере.'),unavailable:tr('Microphone is unavailable. Continue with text practice.','Микрофон недоступен. Продолжайте текстовую практику.')};
      const single=state.trainingMode==='practice';
      body().innerHTML='<section class="elsa-setup"><header><div><small>DUVELA · ELSA EXAMINER</small><h2>'+esc(tr('Speaking exam practice','Практика устного экзамена'))+'</h2><p>'+esc(tr('A structured AI practice simulation, not an official certification.','Структурированная AI-симуляция, не официальная сертификация.'))+'</p></div><span>'+esc(tr('AI practice','AI-практика'))+'</span></header><div class="elsa-setup-grid"><div class="elsa-setup-main"><section><h3>1. '+esc(tr('Choose your exam','Выберите экзамен'))+'</h3><div class="elsa-choice-grid">'+boardBtns+'</div></section><section><h3>2. '+esc(tr('Choose level','Выберите уровень'))+'</h3><div class="elsa-level-row">'+levelBtns+'</div>'+(state.board==='dtz'?'<p class="elsa-helper">'+esc(tr('DTZ assesses the A2–B1 range.','DTZ оценивает диапазон A2–B1.'))+'</p>':'')+'</section><section><h3>3. '+esc(tr('Training mode','Режим тренировки'))+'</h3><div class="elsa-mode-row"><button type="button" data-mode="exam" class="'+(state.trainingMode==='exam'?'active':'')+'"><b>'+esc(tr('Full exam simulation','Полная симуляция экзамена'))+'</b><small>'+esc(tr('No hints while you respond. Feedback comes after the session.','Без подсказок во время ответа. Разбор — после занятия.'))+'</small></button><button type="button" data-mode="practice" class="'+(single?'active':'')+'"><b>'+esc(tr('Practise one part','Отработать одну часть'))+'</b><small>'+esc(tr('Choose a part and receive learning feedback.','Выберите часть и получите учебную обратную связь.'))+'</small></button></div></section>'+(single?'<section><h3>4. '+esc(tr('Choose exam part','Выберите часть экзамена'))+'</h3><div class="elsa-part-list">'+partRows+'</div></section>':'<section class="elsa-sequence"><b>'+esc(tr('Full sequence','Полная последовательность'))+'</b><span>'+partSummariesForCurrent().map(function(summary,index){return 'Teil '+(index+1)+' · '+summary;}).join('  •  ')+'</span></section>')+'</div><aside class="elsa-setup-side"><section class="elsa-mic"><small>'+esc(tr('VOICE INPUT','ГОЛОСОВОЙ ВВОД'))+'</small><b>'+esc(micText[state.micStatus])+'</b><p>'+esc(tr('This simulator currently evaluates the submitted transcript. It does not rate pronunciation without recorded audio evidence.','Симулятор оценивает отправленный текст. Произношение не оценивается без записанного аудио.'))+'</p><button type="button" id="elsaMicCheck" '+(state.micStatus==='checking'?'disabled':'')+'>'+esc(state.micStatus==='ready'?tr('Check again','Проверить снова'):tr('Check microphone','Проверить микрофон'))+'</button></section><section class="elsa-preview"><small>'+esc(tr('SELECTED SESSION','ВЫБРАННОЕ ЗАНЯТИЕ'))+'</small><b>'+esc(BOARD_LABEL[state.board])+' · '+state.level+'</b><span>'+esc(single?(partSummariesForCurrent()[state.selectedPart]||tr('Select one part','Выберите одну часть')):tr('Full exam sequence','Полная последовательность экзамена'))+'</span><span>'+expectedExamMinutes()+' '+esc(tr('min estimated','мин ориентировочно'))+'</span></section></aside></div><footer><span>'+esc(tr('AI feedback is a practice estimate, not an official exam result.','AI-обратная связь — учебная оценка, не официальный экзаменационный результат.'))+'</span><button type="button" class="btn primary" id="elsaStart" '+(single&&state.selectedPart==null?'disabled':'')+'>'+esc(single?tr('Start part practice','Начать практику части'):tr('Start full exam','Начать полный экзамен'))+' →</button></footer></section>';
      Array.prototype.forEach.call(body().querySelectorAll('[data-board]'),function(button){button.onclick=function(){state.board=button.getAttribute('data-board');if(LEVELS_BY_BOARD[state.board].indexOf(state.level)<0)state.level=LEVELS_BY_BOARD[state.board][0];state.selectedPart=null;renderSetup();};});
      Array.prototype.forEach.call(body().querySelectorAll('[data-level]'),function(button){button.onclick=function(){state.level=button.getAttribute('data-level');state.selectedPart=null;renderSetup();};});
      Array.prototype.forEach.call(body().querySelectorAll('[data-mode]'),function(button){button.onclick=function(){state.trainingMode=button.getAttribute('data-mode');if(state.trainingMode==='practice'&&state.selectedPart==null)state.selectedPart=0;if(state.trainingMode==='exam')state.selectedPart=null;renderSetup();};});
      Array.prototype.forEach.call(body().querySelectorAll('[data-part]'),function(button){button.onclick=function(){state.selectedPart=Number(button.getAttribute('data-part'));renderSetup();};});
      body().querySelector('#elsaMicCheck').onclick=microphoneCheck;
      body().querySelector('#elsaStart').onclick=startExam;
    }

    // ---- speaking ----
    async function startExam() {
      state.phase = 'exam';
      state.messages = [];
      state.conversationId = null;
      state.evaluation = null;
      state.skills = { sprechen: null };
      state.endedEarly = false;
      state.runId += 1;
      state.photo = pickExamPhoto();
      state.topic = pickPresentationTopic();
      state.talkTopic = pickTalkTopic();
      renderExam();
      await sendTurn('Guten Tag, ich bin bereit für die Prüfung.', true);
    }

    function answersGiven() { return state.messages.filter(function (m) { return m.role === 'user'; }).length; }

    async function sendTurn(text, isKickoff) {
      if (!isKickoff) state.messages.push({ role: 'user', text: text });
      const runId = state.runId;
      state.sending = true;
      renderExam();
      try {
        const reply = await call(Object.assign({
          action: 'respond',
          input: text,
          conversationId: state.conversationId,
          history: state.messages.slice(-6).map(function (m) { return { role: m.role, text: m.text }; }),
        }, lessonParams(isKickoff ? 0 : answersGiven())));
        if (runId !== state.runId) return;
        state.conversationId = reply.conversationId || state.conversationId;
        const coach = reply.coach || {};
        const correction = String(coach.quickCorrection || '').trim();
        const better = String(coach.betterVersion || '').trim();
        const lastAnswer = state.messages[state.messages.length - 1];
        if (state.trainingMode==='practice' && !isKickoff && lastAnswer && lastAnswer.role === 'user' && (correction || better)) {
          lastAnswer.notes = { correction: correction, better: better };
        }
        var assistantReply = reply.text || '(…)';
        state.messages.push({ role: 'assistant', text: assistantReply });
        if (state.voiceConversation && state.speakerEnabled) speak(assistantReply);
      } catch (e) {
        state.error = e.message;
      }
      state.sending = false;
      renderExam();
    }

    function renderExam() {
      state.phase = 'exam';
      // Absolute part indices (into cuesForPart/isPictureTaskPart/partSummaries) this attempt
      // runs, in order — every part, or just the one Teil the learner selected.
      const indices = activePartIndices();
      const total = indices.length;
      const part = Math.min(total, Math.floor(answersGiven() / 2) + 1);
      const done = answersGiven() >= total * 2 - 1;
      function cueHtmlFor(cues, partIndex) {
        if (!cues) return '';
        const presenting = isPresentationTaskPart(partIndex);
        const talking = isTalkTopicPart(partIndex) && state.talkTopic;
        const hint = talking
          ? tr('Tell one connected story on this topic', 'Расскажите связно на эту тему')
          : presenting
            ? tr('Prepare a short talk covering these points', 'Подготовьте короткое выступление по этим пунктам')
            : tr('Say a few sentences about each point', 'Расскажите о каждом пункте подробнее');
        const cardTopic = talking ? state.talkTopic.topic : presenting ? state.topic : '';
        const topicHtml = cardTopic
          ? '<div style="font-size:15px;font-weight:900;color:var(--ink);margin-bottom:6px">' + esc(tr('Topic', 'Тема')) + ': ' + esc(cardTopic) + '</div>'
          : '';
        const subHtml = talking
          ? '<div style="font-size:12px;font-weight:600;color:var(--soft);margin-bottom:6px">' +
            esc(tr('The points are hints — speak in one monologue, no need to answer each one separately.', 'Пункты — подсказка: говорите одним рассказом, не нужно отвечать на каждый отдельно.')) + '</div>'
          : '';
        return '<div style="max-width:70%;margin:0 0 10px;padding:10px 16px 4px;border-radius:14px;background:var(--panel-soft);border:1px solid var(--line)">' +
          '<div style="font-size:12px;font-weight:800;color:var(--teal);margin-bottom:4px">' + esc(hint) + '</div>' + topicHtml + subHtml +
          cues.map(function (c, i) { return '<div style="text-align:center;padding:9px 0;font-size:16px;font-weight:900;' + (i ? 'border-top:1px solid currentColor' : '') + '">' + esc(c) + '</div>'; }).join('') + '</div>';
      }
      // ELSA's written correction of an answer, shown under it and never spoken.
      function notesHtml(m) {
        if (m.role !== 'user' || !m.notes) return '';
        return '<div style="max-width:82%;margin:-2px 0 10px auto;padding:8px 12px;border-radius:12px;background:var(--panel-soft);border:1px solid var(--line);border-left:3px solid #6D3DF5;line-height:1.45">' +
          '<div style="font-size:11px;font-weight:900;color:#6D3DF5;text-transform:uppercase;margin-bottom:2px">' + esc(tr('ELSA notes', 'Заметки ELSA')) + '</div>' +
          (m.notes.correction ? '<div style="font-weight:600">' + esc(m.notes.correction) + '</div>' : '') +
          (m.notes.better
            ? '<div style="font-weight:600"><b style="color:#2FA36B">' + esc(tr('Better: ', 'Лучше сказать: ')) + '</b>' + esc(m.notes.better) + '</div>'
            : '') +
          '</div>';
      }
      let assistantOrdinal = -1;
      const log = state.messages.map(function (m) {
        // Each part opens with two ELSA turns (prompt, then follow-up); the opening one is
        // every other assistant message. Show that part's photo/cue card right under it.
        let cueHtml = '';
        if (m.role === 'assistant') {
          assistantOrdinal += 1;
          if (assistantOrdinal % 2 === 0) {
            const partIndex = indices[assistantOrdinal / 2];
            const photoSrc = isPictureTaskPart(partIndex) && state.photo
              ? state.photo.src
              : isPlanningTaskPart(partIndex)
                ? PLANNING_CARD_IMAGE
                : null;
            const photoHtml = photoSrc
              ? '<img src="' + esc(photoSrc) + '" alt="" style="display:block;max-width:70%;width:260px;aspect-ratio:4/3;object-fit:contain;border-radius:14px;margin:0 0 10px;background:var(--panel-soft)">'
              : '';
            cueHtml = photoHtml + cueHtmlFor(cuesForPart(partIndex), partIndex);
          }
        }
        return '<div style="display:flex;justify-content:' + (m.role === 'user' ? 'flex-end' : 'flex-start') + ';margin-bottom:8px">' +
          '<div style="max-width:82%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;' +
          (m.role === 'user' ? 'background:var(--teal);color:#fff' : 'background:var(--panel-soft);border:1px solid var(--line)') + '">' + esc(m.text) + '</div></div>' +
          notesHtml(m) + cueHtml;
      }).join('') + (state.sending ? '<div style="color:var(--soft);font-weight:700">…</div>' : '');
      const activeIndex = indices[Math.min(indices.length - 1, Math.floor(answersGiven() / 2))];
      const activeMedia = isPictureTaskPart(activeIndex) && state.photo
        ? '<img src="' + esc(state.photo.src) + '" alt="" class="elsa-task-photo">'
        : isPlanningTaskPart(activeIndex) ? '<img src="' + esc(PLANNING_CARD_IMAGE) + '" alt="" class="elsa-task-photo">' : '';
      const activeTitle = partSummariesForCurrent()[activeIndex] || tr('Speaking task', 'Устное задание');
      body().classList.add('elsa-active-body');
      body().innerHTML = '<section class="elsa-active-exam"><aside class="elsa-task-panel"><small>DUVELA · ELSA EXAMINER</small><div class="elsa-task-head"><h3>' + esc(BOARD_LABEL[state.board]) + ' · ' + state.level + '</h3><span>' + esc(tr('Part', 'Часть')) + ' ' + part + '/' + total + '</span></div><h2>' + esc(activeTitle) + '</h2>' + activeMedia + '<div class="elsa-task-instructions">' + cueHtmlFor(cuesForPart(activeIndex), activeIndex) + '</div><p>' + esc(state.trainingMode==='exam' ? tr('Exam mode: ELSA gives no hints or grammar corrections while you answer.','Экзаменационный режим: ELSA не даёт подсказок и исправлений во время ответа.') : tr('Practice mode: learning feedback is shown after your answer.','Режим практики: учебная обратная связь показывается после ответа.')) + '</p></aside><section class="elsa-dialog-panel"><header><div><b>ELSA · ' + esc(tr('Examiner', 'Экзаменатор')) + '</b><small>' + esc(state.trainingMode==='exam'?tr('Exam simulation','Симуляция экзамена'):tr('Part practice','Практика части')) + '</small></div><span>' + esc(tr('Text-based practice','Текстовая практика')) + '</span></header><div id="elsaLog"' + LTR + ' class="elsa-dialog-log">' + log + '</div>' + (state.error ? '<div class="elsa-dialog-error">' + esc(state.error) + '</div>' : '') + (done ? '<button class="btn primary" id="elsaFinish">🏁 ' + esc(tr('View feedback', 'Посмотреть разбор')) + '</button>' : '') + '<div class="elsa-dialog-composer"><input id="elsaInput"' + LTR + ' class="search" placeholder="' + esc(tr('Type your answer…', 'Напишите ответ…')) + '">' + (voiceRecognition() ? '<button type="button" class="elsa-voice-input" id="elsaVoice" aria-label="' + esc(tr('Speak your answer', 'Продиктовать ответ')) + '" aria-pressed="' + (state.voiceConversation ? 'true' : 'false') + '" title="' + esc(tr('Speak your answer', 'Продиктовать ответ')) + '">🎙</button><button type="button" class="elsa-speaker-toggle" id="elsaSpeaker" aria-label="' + esc(tr('Toggle ELSA voice', 'Включить или выключить голос ELSA')) + '">' + (state.speakerEnabled ? '🔊' : '🔇') + '</button>' : '') + '<button class="btn primary" id="elsaSend">➤</button></div><button class="elsa-end-session" id="elsaEndEarly">' + esc(tr('End session', 'Завершить сессию')) + '</button></section></section>';
      const logEl = document.getElementById('elsaLog'); if (logEl) logEl.scrollTop = logEl.scrollHeight;
      const input = document.getElementById('elsaInput');
      const send = function () { const v = input.value.trim(); if (v && !state.sending) { input.value = ''; void sendTurn(v, false); } };
      const voiceButton = document.getElementById('elsaVoice');
      if (voiceButton) voiceButton.addEventListener('click', function () { state.voiceConversation = true; startVoiceInput(input, voiceButton); });
      var speakerButton = document.getElementById('elsaSpeaker');
      if (speakerButton) speakerButton.addEventListener('click', function () { state.speakerEnabled = !state.speakerEnabled; if (!state.speakerEnabled && window.speechSynthesis) window.speechSynthesis.cancel(); renderExam(); });
      document.getElementById('elsaSend').addEventListener('click', send);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      if (document.getElementById('elsaFinish')) document.getElementById('elsaFinish').addEventListener('click', finishExam);
      document.getElementById('elsaEndEarly').addEventListener('click', function () { if (!confirm(tr('End this session and view partial practice feedback?', 'Завершить сессию и посмотреть частичный разбор?'))) return; state.endedEarly = true; state.runId += 1; state.sending = false; finishExam(); });
    }

    async function finishExam() {
      state.phase = 'scoring';
      renderScoring(tr('Grading your exam…', 'Оцениваю экзамен…'));
      // Let the scorer check whether the picture-description turn actually matched the photo —
      // it never saw the image either, only this note (see handleExamEvaluation on the server).
      const photoNote = activePartIndices().some(isPictureTaskPart) && state.photo
        ? '[Hinweis für die Bewertung: Das gezeigte Foto zeigt tatsächlich: ' + state.photo.description + ']\n'
        : '';
      const transcript = photoNote + state.messages.map(function (m) { return (m.role === 'assistant' ? 'ELSA' : 'Lernender') + ': ' + m.text; }).join('\n');
      try {
        const result = await call({ action: 'evaluate_exam', board: state.board, level: state.level, transcript: transcript, nativeLocale: nativeLocale(), locale: 'de-DE' });
        state.evaluation = result;
        state.skills.sprechen = result.score.overall;
        renderResult();
      } catch (e) {
        state.error = e.message;
        renderExam();
      }
    }

    function renderScoring(msg) {
      body().innerHTML = '<div style="text-align:center;padding:40px 0"><div style="font-size:32px">⏳</div><p style="font-weight:800;margin-top:10px">' + esc(msg) + '</p></div>';
    }

    function speak(text) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/^[AB]:\s?/gm, ''));
      u.lang = 'de-DE'; u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }

    // ---- result ----
    function renderResult() {
      state.phase = 'result';
      const ev = state.evaluation || { score: { overall: 0, fluency: 0, accuracy: 0, vocabulary: 0, pronunciation: 0 }, passed: false, band: state.level, finalFeedback: '', improve: [], parts: [], mistakes: [] };
      const bar = function (label, val) {
        return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:110px;font-weight:800;font-size:13px">' + esc(label) + '</span>' +
          '<div style="flex:1;height:9px;border-radius:999px;background:var(--panel-soft);overflow:hidden"><i style="display:block;height:100%;width:' + (val || 0) + '%;background:var(--teal)"></i></div>' +
          '<b style="width:28px;text-align:right">' + (val == null ? '—' : val) + '</b></div>';
      };
      let html = '<div style="text-align:center;margin-bottom:14px">' +
        '<span style="display:inline-block;padding:6px 18px;border-radius:999px;color:#fff;font-weight:900;letter-spacing:1px;background:' + (state.endedEarly ? '#7947EA' : ev.passed ? '#2FA36B' : '#D94F72') + '">' + (state.endedEarly ? esc(tr('PARTIAL PRACTICE FEEDBACK', 'ЧАСТИЧНЫЙ РАЗБОР ПРАКТИКИ')) : ev.passed ? esc(tr('UNOFFICIAL AI ESTIMATE', 'НЕОФИЦИАЛЬНАЯ ОЦЕНКА AI')) : esc(tr('UNOFFICIAL AI ESTIMATE', 'НЕОФИЦИАЛЬНАЯ ОЦЕНКА AI'))) + '</span>' +
        '<div style="font-size:40px;font-weight:900;margin-top:10px">' + ev.score.overall + '/100</div>' +
        '<div style="color:var(--soft);font-weight:700">' + esc(BOARD_LABEL[state.board]) + ' ' + state.level + ' · ' + esc(ev.band) + '</div></div>';
      html += '<div class="card" style="margin-bottom:12px">' + bar(tr('Fluency', 'Беглость'), ev.score.fluency) + bar(tr('Accuracy', 'Точность'), ev.score.accuracy) +
        bar(tr('Vocabulary', 'Лексика'), ev.score.vocabulary) + '</div><p style="color:var(--soft);font-size:12px;margin:0 0 12px">' + esc(tr('Pronunciation is not scored because this text simulation has no recorded audio evidence.','Произношение не оценивается: у текстовой симуляции нет записанного аудио.')) + '</p>';
      if (ev.parts && ev.parts.length) {
        html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('By part', 'По частям')) + '</b>' +
          ev.parts.map(function (p) { return '<div style="display:flex;justify-content:space-between;margin-top:8px"><span>' + esc(p.label) + '</span><b>' + p.score + '/100</b></div>' + (p.feedback ? '<small style="color:var(--soft)">' + esc(p.feedback) + '</small>' : ''); }).join('') + '</div>';
      }
      if (ev.mistakes && ev.mistakes.length) {
        html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('Mistakes to fix', 'Ошибки для разбора')) + '</b>' +
          ev.mistakes.map(function (mk) { return '<div style="margin-top:10px"><div' + LTR + ' style="color:#d64545;text-decoration:line-through">' + esc(mk.wrong) + '</div><div' + LTR + ' style="color:#2FA36B;font-weight:800">' + esc(mk.correction) + '</div>' + (mk.note ? '<small style="color:var(--soft)">' + esc(mk.note) + '</small>' : '') + '</div>'; }).join('') + '</div>';
      }
      if (ev.finalFeedback) html += '<div class="card" style="margin-bottom:12px">' + esc(ev.finalFeedback) + '</div>';
      if (ev.improve && ev.improve.length) html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('What to improve', 'Что улучшить')) + '</b>' + ev.improve.map(function (t) { return '<div style="margin-top:6px">• ' + esc(t) + '</div>'; }).join('') + '</div>';
      html += '<button class="btn primary" id="elsaAgain" style="width:100%">' + esc(tr('New exam', 'Новый экзамен')) + '</button>';
      body().innerHTML = html;
      document.getElementById('elsaAgain').addEventListener('click', renderSetup);
    }

    function elsaExamCardHtml() {
      return '';
    }
    function bindElsaExamCard() {}

    document.addEventListener('duvela-open-elsa-exam', open);
    window.DuvelaOpenElsaExam = open;

    return { open: open, elsaExamCardHtml: elsaExamCardHtml, bindElsaExamCard: bindElsaExamCard };
  }

  window.DuvelaElsaExam = { create: createElsaExam };
})();
