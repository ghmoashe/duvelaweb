(function () {
  function createStudyFeature(ctx) {
    const { $, tr, esc, supa } = ctx;
    const PROGRESS_KEY = 'duvela.study.progress';
    const RESUME_KEY = 'duvela.study.resume';
    const PREFS_KEY = 'duvela.study.preferences';
    const OFFLINE_QUEUE_KEY = 'duvela.study.offlineQueue';
    const EXAM_GOAL_KEY = 'duvela.study.examGoal';
    const ADAPTIVE_PLAN_KEY = 'duvela.study.adaptivePlan.v1';
    const DUEL_LIVE_KEY = 'duvela.study.duelLiveMode';
    const DUEL_TEACHER_KEY = 'duvela.study.duelTeacherKit';
    // Anti-repeat: remember which questions have been shown by this teacher in
    // the last 24 hours, so viewers who catch two of a teacher's LIVEs in a
    // day don't see the exact same items back-to-back. Keyed by question text
    // (banks don't carry stable ids). Kept per-browser; nothing on the server.
    const DUEL_SHOWN_KEY = 'duvela.study.duelShownRecent';
    const DUEL_SHOWN_TTL_MS = 24 * 3600 * 1000;
    const DUEL_SHOWN_CAP = 300;

    function readRecentShownQuestions() {
      try {
        var list = JSON.parse(localStorage.getItem(DUEL_SHOWN_KEY) || '[]');
        if (!Array.isArray(list)) return [];
        var cutoff = Date.now() - DUEL_SHOWN_TTL_MS;
        return list.filter(function (entry) { return entry && entry.q && entry.ts && entry.ts > cutoff; });
      } catch (e) { return []; }
    }

    function recentShownSet() {
      var set = Object.create(null);
      readRecentShownQuestions().forEach(function (entry) { set[entry.q] = 1; });
      return set;
    }

    function rememberShownQuestions(items) {
      if (!items || !items.length) return;
      var current = readRecentShownQuestions();
      var seen = Object.create(null);
      current.forEach(function (entry) { seen[entry.q] = entry; });
      var now = Date.now();
      items.forEach(function (item) {
        if (!item || !item.q) return;
        seen[item.q] = { q: String(item.q), ts: now };
      });
      var merged = Object.keys(seen).map(function (key) { return seen[key]; });
      merged.sort(function (a, b) { return b.ts - a.ts; });
      if (merged.length > DUEL_SHOWN_CAP) merged = merged.slice(0, DUEL_SHOWN_CAP);
      try { localStorage.setItem(DUEL_SHOWN_KEY, JSON.stringify(merged)); } catch (e) {}
    }
    const DUEL_QUESTION_COUNT = 10;
    let studyState = null;
    let aiChatState = null;
    // Keep Premium features freely available while the product is in test mode.
    // Set to false when subscription access should be enforced again.
    const PREMIUM_TEST_MODE = true;
    let practicePremium = false;
    let practiceHydrated = false;
    let practiceSyncState = navigator.onLine ? 'syncing' : 'offline';
    let listeningPlaybackRun = 0;
    let listeningAudio = null;
    let finishListeningPlayback = null;
    let readingBankState = { status:'idle', tasks:[], counts:{}, error:null };
    const listeningRecordingCache = new Map();
    const listeningFishCache = new Map();
    const LISTENING_SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';

    // ---- content banks (offline, bundled) ----
    const VOCAB = {
      de: [
        { w: 'das Haus', t: 'дом / house' }, { w: 'die Frau', t: 'женщина / woman' },
        { w: 'der Mann', t: 'мужчина / man' }, { w: 'das Buch', t: 'книга / book' },
        { w: 'die Stadt', t: 'город / city' }, { w: 'das Wasser', t: 'вода / water' },
        { w: 'der Freund', t: 'друг / friend' }, { w: 'die Arbeit', t: 'работа / work' },
        { w: 'das Kind', t: 'ребёнок / child' }, { w: 'die Zeit', t: 'время / time' },
        { w: 'der Tag', t: 'день / day' }, { w: 'die Nacht', t: 'ночь / night' },
        { w: 'essen', t: 'есть / to eat' }, { w: 'trinken', t: 'пить / to drink' },
        { w: 'sprechen', t: 'говорить / to speak' }, { w: 'lernen', t: 'учить / to learn' }
      ],
      en: [
        { w: 'house', t: 'дом / das Haus' }, { w: 'woman', t: 'женщина / die Frau' },
        { w: 'friend', t: 'друг / der Freund' }, { w: 'work', t: 'работа / die Arbeit' },
        { w: 'water', t: 'вода / das Wasser' }, { w: 'city', t: 'город / die Stadt' },
        { w: 'to speak', t: 'говорить / sprechen' }, { w: 'to learn', t: 'учить / lernen' },
        { w: 'to need', t: 'нуждаться / brauchen' }, { w: 'enough', t: 'достаточно / genug' },
        { w: 'to improve', t: 'улучшать / verbessern' }, { w: 'meeting', t: 'встреча / das Treffen' }
      ],
      es: [
        { w: 'la casa', t: 'дом / house' }, { w: 'la mujer', t: 'женщина / woman' },
        { w: 'el amigo', t: 'друг / friend' }, { w: 'el trabajo', t: 'работа / work' },
        { w: 'el agua', t: 'вода / water' }, { w: 'la ciudad', t: 'город / city' },
        { w: 'hablar', t: 'говорить / to speak' }, { w: 'aprender', t: 'учить / to learn' },
        { w: 'comer', t: 'есть / to eat' }, { w: 'beber', t: 'пить / to drink' }
      ]
    };

    const DE_VOCAB_HEADS = {
      learning: [
        ['kurs','der','Kurs','course','курс'],['stunde','die','Stunde','lesson','урок'],['plan','der','Plan','plan','план'],['ziel','das','Ziel','goal','цель'],
        ['niveau','das','Niveau','level','уровень'],['wort','das','Wort','word','слово'],['satz','der','Satz','sentence','предложение'],['frage','die','Frage','question','вопрос'],
        ['antwort','die','Antwort','answer','ответ'],['übung','die','Übung','exercise','упражнение'],['test','der','Test','test','тест'],['prüfung','die','Prüfung','exam','экзамен'],
        ['text','der','Text','text','текст'],['dialog','der','Dialog','dialogue','диалог'],['audio','das','Audio','audio','аудио'],['video','das','Video','video','видео'],
        ['artikel','der','Artikel','article','статья'],['thema','das','Thema','topic','тема'],['regel','die','Regel','rule','правило'],['fehler','der','Fehler','mistake','ошибка'],
        ['lösung','die','Lösung','solution','решение'],['erklärung','die','Erklärung','explanation','объяснение'],['aufgabe','die','Aufgabe','task','задание'],['kartei','die','Kartei','card file','картотека'],
        ['liste','die','Liste','list','список'],['bank','die','Bank','bank','банк'],['paket','das','Paket','package','пакет'],['trainer','der','Trainer','trainer','тренажер'],
        ['partner','der','Partner','partner','партнер'],['methode','die','Methode','method','метод']
      ],
      work: [
        ['tag','der','Tag','day','день'],['zeit','die','Zeit','time','время'],['plan','der','Plan','plan','план'],['termin','der','Termin','appointment','термин'],
        ['raum','der','Raum','room','комната'],['gruppe','die','Gruppe','group','группа'],['team','das','Team','team','команда'],['gespräch','das','Gespräch','conversation','разговор'],
        ['frage','die','Frage','question','вопрос'],['antwort','die','Antwort','answer','ответ'],['problem','das','Problem','problem','проблема'],['lösung','die','Lösung','solution','решение'],
        ['aufgabe','die','Aufgabe','task','задание'],['liste','die','Liste','list','список'],['datei','die','Datei','file','файл'],['dokument','das','Dokument','document','документ'],
        ['bericht','der','Bericht','report','отчет'],['formular','das','Formular','form','формуляр'],['antrag','der','Antrag','application','заявление'],['angebot','das','Angebot','offer','предложение'],
        ['preis','der','Preis','price','цена'],['kosten','die','Kosten','costs','расходы'],['budget','das','Budget','budget','бюджет'],['konto','das','Konto','account','счет'],
        ['rechnung','die','Rechnung','invoice','счет'],['vertrag','der','Vertrag','contract','договор'],['service','der','Service','service','сервис'],['system','das','System','system','система'],
        ['portal','das','Portal','portal','портал'],['projekt','das','Projekt','project','проект'],['phase','die','Phase','phase','фаза'],['ziel','das','Ziel','goal','цель'],
        ['qualität','die','Qualität','quality','качество'],['sicherheit','die','Sicherheit','safety','безопасность'],['prozess','der','Prozess','process','процесс']
      ],
      life: [
        ['tag','der','Tag','day','день'],['zeit','die','Zeit','time','время'],['plan','der','Plan','plan','план'],['termin','der','Termin','appointment','термин'],
        ['karte','die','Karte','card','карта'],['raum','der','Raum','room','комната'],['platz','der','Platz','place','место'],['zentrum','das','Zentrum','centre','центр'],
        ['bereich','der','Bereich','area','область'],['gruppe','die','Gruppe','group','группа'],['frage','die','Frage','question','вопрос'],['antwort','die','Antwort','answer','ответ'],
        ['problem','das','Problem','problem','проблема'],['lösung','die','Lösung','solution','решение'],['liste','die','Liste','list','список'],['dokument','das','Dokument','document','документ'],
        ['formular','das','Formular','form','формуляр'],['angebot','das','Angebot','offer','предложение'],['preis','der','Preis','price','цена'],['kosten','die','Kosten','costs','расходы'],
        ['konto','das','Konto','account','счет'],['app','die','App','app','приложение'],['seite','die','Seite','page','страница'],['portal','das','Portal','portal','портал'],
        ['service','der','Service','service','сервис'],['station','die','Station','station','станция'],['linie','die','Linie','line','линия'],['ticket','das','Ticket','ticket','билет'],
        ['nummer','die','Nummer','number','номер'],['adresse','die','Adresse','address','адрес']
      ]
    };
    const DE_VOCAB_PREFIX_GROUPS = [
      ['learning','A1',[['Sprach','language','языковой'],['Lern','learning','учебный'],['Schul','school','школьный'],['Deutsch','German','немецкий'],['Vokabel','vocabulary','словарный']]],
      ['learning','A2',[['Grammatik','grammar','грамматический'],['Aussprache','pronunciation','произносительный'],['Hör','listening','аудирование'],['Lese','reading','читательский'],['Schreib','writing','письменный']]],
      ['learning','B1',[['Prüfungs','exam','экзаменационный'],['Bildungs','education','образовательный'],['Trainings','training','тренировочный'],['Korrektur','correction','коррекционный'],['Wiederholungs','review','повторительный']]],
      ['learning','B2',[['Fachsprach','professional language','профессионально-языковой'],['Kommunikations','communication','коммуникационный'],['Strategie','strategy','стратегический'],['Analyse','analysis','аналитический']]],
      ['learning','C1',[['Akademie','academy','академический'],['Argumentations','argumentation','аргументационный'],['Diskussions','discussion','дискуссионный']]],
      ['learning','C2',[['Abstraktions','abstraction','абстрактный'],['Interpretations','interpretation','интерпретационный'],['Differenzierungs','differentiation','дифференцирующий']]],
      ['work','A2',[['Arbeits','work','рабочий'],['Berufs','job','профессиональный'],['Bewerbungs','application','заявочный'],['Kunden','customer','клиентский'],['Service','service','сервисный']]],
      ['work','B1',[['Projekt','project','проектный'],['Team','team','командный'],['Verkaufs','sales','продажный'],['Finanz','finance','финансовый'],['Vertrags','contract','договорной']]],
      ['work','B2',[['Unternehmens','company','корпоративный'],['Verwaltungs','administration','административный'],['Qualitäts','quality','качественный'],['Sicherheits','security','безопасностный'],['Steuer','tax','налоговый']]],
      ['work','C1',[['Forschungs','research','исследовательский'],['Entwicklungs','development','разработческий'],['Markt','market','рыночный'],['Daten','data','данных']]],
      ['work','C2',[['Transformations','transformation','трансформационный'],['Regulierungs','regulation','регуляторный'],['Investitions','investment','инвестиционный']]],
      ['life','A1',[['Alltags','everyday','повседневный'],['Familien','family','семейный'],['Kinder','children','детский'],['Haus','home','домашний'],['Einkaufs','shopping','покупочный']]],
      ['life','A2',[['Reise','travel','туристический'],['Stadt','city','городской'],['Wohn','housing','жилищный'],['Freizeit','free time','досуговый'],['Sport','sport','спортивный']]],
      ['life','B1',[['Gesundheits','health','медицинский'],['Arzt','doctor','врачебный'],['Verkehrs','traffic','транспортный'],['Wetter','weather','погодный'],['Bank','bank','банковский']]],
      ['life','B2',[['Miet','rent','арендный'],['Versicherungs','insurance','страховой'],['Umwelt','environment','экологический'],['Energie','energy','энергетический'],['Digital','digital','цифровой']]],
      ['life','C1',[['Medien','media','медийный'],['Internet','internet','интернет'],['Kultur','culture','культурный'],['Gesellschafts','society','общественный']]],
      ['life','C2',[['Infrastruktur','infrastructure','инфраструктурный'],['Datenschutz','data protection','защиты данных'],['Nachhaltigkeits','sustainability','устойчивый']]]
    ];
    // Generate a large German level bank from topic heads and practical prefixes.
    function enrichGermanVocabBank() {
      var seen = Object.create(null);
      VOCAB.de.forEach(function (item) {
        if (item && item.w) seen[item.w] = true;
      });
      DE_VOCAB_PREFIX_GROUPS.forEach(function (group) {
        var heads = DE_VOCAB_HEADS[group[0]] || [];
        var level = group[1];
        var prefixes = group[2] || [];
        prefixes.forEach(function (prefix) {
          heads.forEach(function (head) {
            var compound = prefix[0] + head[0];
            compound = compound.charAt(0).toUpperCase() + compound.slice(1);
            var word = head[1] + ' ' + compound;
            if (seen[word]) return;
            seen[word] = true;
            // Translation format matches the hand-written entries above
            // ("дом / house"): russian modifier + root, slash, english
            // modifier + root. Not "root: modifier / modifier root" — that
            // packed two languages *and* a category-style colon into one
            // string and read as four separate concepts.
            VOCAB.de.push({
              w: word,
              t: prefix[2] + ' ' + head[4] + ' / ' + prefix[1] + ' ' + head[3],
              level: level
            });
          });
        });
      });
    }
    enrichGermanVocabBank();

    const ARTICLES = [
      { noun: 'Haus', art: 'das' }, { noun: 'Frau', art: 'die' }, { noun: 'Mann', art: 'der' },
      { noun: 'Buch', art: 'das' }, { noun: 'Stadt', art: 'die' }, { noun: 'Tisch', art: 'der' },
      { noun: 'Wasser', art: 'das' }, { noun: 'Arbeit', art: 'die' }, { noun: 'Tag', art: 'der' },
      { noun: 'Kind', art: 'das' }, { noun: 'Nacht', art: 'die' }, { noun: 'Freund', art: 'der' },
      { noun: 'Auto', art: 'das' }, { noun: 'Zeit', art: 'die' }, { noun: 'Weg', art: 'der' },
      { noun: 'Fenster', art: 'das' }, { noun: 'Straße', art: 'die' }, { noun: 'Apfel', art: 'der' }
    ];

    // Practice-for-LIVE sentence-check bank: four full sentences per row,
    // one is grammatically correct German, three are common traps
    // (wrong verb-second, missing umlaut, wrong Kasus, misplaced ge-).
    // Kept as its own bank because the MCQ shell needs full-sentence
    // options, not one-word choices.
    const SENTENCE_CHECK_DE = {
      de: [
        { level: 'A1', opts: ['Ich bin Student.', 'Ich Student bin.', 'Ich ist Student.', 'Bin ich Student.'], a: 0 },
        { level: 'A1', opts: ['Wir kommen aus Berlin.', 'Wir komme aus Berlin.', 'Wir aus Berlin kommen.', 'Wir kommt aus Berlin.'], a: 0 },
        { level: 'A1', opts: ['Er trinkt einen Kaffee.', 'Er trinkt ein Kaffee.', 'Er trinke einen Kaffee.', 'Er trinken einen Kaffee.'], a: 0 },
        { level: 'A1', opts: ['Das Kind spielt im Garten.', 'Das Kind spielt in Garten.', 'Das Kind spielt in dem Garten drin.', 'Das Kind spielt an dem Garten.'], a: 0 },
        { level: 'A1', opts: ['Heute gehe ich einkaufen.', 'Heute ich gehe einkaufen.', 'Heute ich einkaufen gehe.', 'Heute geht ich einkaufen.'], a: 0 },
        { level: 'A2', opts: ['Gestern habe ich einen Kuchen gebacken.', 'Gestern ich habe einen Kuchen gebacken.', 'Gestern habe ich einen Kuchen backen.', 'Gestern bin ich einen Kuchen gebacken.'], a: 0 },
        { level: 'A2', opts: ['Ich fahre mit dem Bus zur Arbeit.', 'Ich fahre mit den Bus zur Arbeit.', 'Ich fahre mit dem Bus zu die Arbeit.', 'Ich fahre mit der Bus zur Arbeit.'], a: 0 },
        { level: 'A2', opts: ['Kannst du mir bitte helfen?', 'Kannst du mich bitte helfen?', 'Können du mir bitte helfen?', 'Du kannst mir bitte helfen?'], a: 0 },
        { level: 'A2', opts: ['Wir treffen uns um acht Uhr.', 'Wir treffen sich um acht Uhr.', 'Wir uns treffen um acht Uhr.', 'Wir treffen uns am acht Uhr.'], a: 0 },
        { level: 'A2', opts: ['Nach der Arbeit gehe ich nach Hause.', 'Nach die Arbeit gehe ich nach Hause.', 'Nach der Arbeit ich gehe nach Hause.', 'Nach der Arbeit gehe ich zu Hause.'], a: 0 },
        { level: 'B1', opts: ['Wenn ich Zeit hätte, würde ich mehr lesen.', 'Wenn ich hätte Zeit, würde ich mehr lesen.', 'Wenn ich Zeit hatte, würde ich mehr lesen.', 'Wenn ich Zeit hätte, ich würde mehr lesen.'], a: 0 },
        { level: 'B1', opts: ['Obwohl es regnet, gehen wir spazieren.', 'Obwohl es regnet, wir gehen spazieren.', 'Obwohl regnet es, gehen wir spazieren.', 'Obwohl es regnete, gehen wir spazieren.'], a: 0 },
        { level: 'B1', opts: ['Das ist der Mann, dem ich geholfen habe.', 'Das ist der Mann, den ich geholfen habe.', 'Das ist der Mann, der ich geholfen habe.', 'Das ist der Mann, dessen ich geholfen habe.'], a: 0 },
        { level: 'B1', opts: ['Wegen des schlechten Wetters bleiben wir zu Hause.', 'Wegen dem schlechten Wetter bleiben wir zu Hause.', 'Wegen das schlechte Wetter bleiben wir zu Hause.', 'Wegen der schlechten Wetter bleiben wir zu Hause.'], a: 0 },
        { level: 'B2', opts: ['Je früher wir anfangen, desto schneller sind wir fertig.', 'Je früher wir anfangen, desto schneller wir sind fertig.', 'Je früher anfangen wir, desto schneller sind wir fertig.', 'Je früher wir anfangen, um so schneller wir fertig sind.'], a: 0 },
        { level: 'B2', opts: ['Der Vertrag muss bis Freitag unterschrieben werden.', 'Der Vertrag muss bis Freitag unterschreiben werden.', 'Der Vertrag muss bis Freitag unterschrieben werde.', 'Der Vertrag muss bis Freitag unterschrieben wird.'], a: 0 },
        // ── Bank top-up (Sep 2026) — grows the LIVE deck past the ~80-item ceiling
        // so a regular TikTok teacher doesn't drain the pool in a week.
        { level: 'A1', opts: ['Wo wohnst du?', 'Wo du wohnst?', 'Wo wohnen du?', 'Wo wohnt du?'], a: 0 },
        { level: 'A1', opts: ['Ich habe eine Schwester.', 'Ich habe ein Schwester.', 'Ich hat eine Schwester.', 'Ich habe einen Schwester.'], a: 0 },
        { level: 'A1', opts: ['Am Montag arbeite ich lange.', 'Am Montag ich arbeite lange.', 'Am Montag ich lange arbeite.', 'Am Montag arbeit ich lange.'], a: 0 },
        { level: 'A1', opts: ['Meine Freundin heißt Sara.', 'Meine Freundin heißen Sara.', 'Meine Freundin heiße Sara.', 'Mein Freundin heißt Sara.'], a: 0 },
        { level: 'A2', opts: ['Ich habe mir die Zähne geputzt.', 'Ich habe mich die Zähne geputzt.', 'Ich habe mich die Zähne putzt.', 'Ich habe mir die Zähne putze.'], a: 0 },
        { level: 'A2', opts: ['Er hat sich einen neuen Laptop gekauft.', 'Er hat ihn einen neuen Laptop gekauft.', 'Er hat sich ein neues Laptop gekauft.', 'Er hat sich einen neues Laptop gekauft.'], a: 0 },
        { level: 'A2', opts: ['Wir sind letzte Woche nach Wien gefahren.', 'Wir haben letzte Woche nach Wien gefahren.', 'Wir sind letzte Woche zu Wien gefahren.', 'Wir sind letzte Woche in Wien gefahren.'], a: 0 },
        { level: 'A2', opts: ['Ich muss um sieben Uhr aufstehen.', 'Ich muss um sieben Uhr aufsteh.', 'Ich muss um sieben Uhr aufstehe.', 'Ich muss um sieben Uhr steht auf.'], a: 0 },
        { level: 'B1', opts: ['Ich habe keine Lust, heute rauszugehen.', 'Ich habe keine Lust, heute raus zu gehen.', 'Ich habe keine Lust, heute rausgehen.', 'Ich habe kein Lust, heute rauszugehen.'], a: 0 },
        { level: 'B1', opts: ['Trotz der Verspätung erreichten wir das Konzert.', 'Trotz die Verspätung erreichten wir das Konzert.', 'Trotz der Verspätung wir erreichten das Konzert.', 'Trotzdem die Verspätung erreichten wir das Konzert.'], a: 0 },
        { level: 'B1', opts: ['Ich freue mich darauf, dich bald zu sehen.', 'Ich freue mich darauf, dich bald sehen.', 'Ich freue mich dafür, dich bald zu sehen.', 'Ich freue mich darauf, dass dich bald sehen.'], a: 0 },
        { level: 'B1', opts: ['Er behauptet, alles verstanden zu haben.', 'Er behauptet, alles zu verstanden haben.', 'Er behauptet, alles verstanden haben.', 'Er behauptet, dass alles verstanden zu haben.'], a: 0 },
        { level: 'B2', opts: ['Nachdem wir gegessen hatten, gingen wir spazieren.', 'Nachdem wir gegessen hatten, wir gingen spazieren.', 'Nachdem wir hatten gegessen, gingen wir spazieren.', 'Nachdem wir gegessen haben, gingen wir spazieren.'], a: 0 },
        { level: 'B2', opts: ['Die Rechnung ist bereits bezahlt worden.', 'Die Rechnung ist bereits bezahlen worden.', 'Die Rechnung ist bereits bezahlt geworden.', 'Die Rechnung ist bereits worden bezahlt.'], a: 0 },
        { level: 'B2', opts: ['Es ist nicht sicher, ob er kommt.', 'Es ist nicht sicher, ob kommt er.', 'Es ist nicht sicher, wenn er kommt.', 'Es ist nicht sicher, dass ob er kommt.'], a: 0 },
        { level: 'C1', opts: ['Es lohnt sich, geduldig zu bleiben.', 'Es lohnt sich, geduldig bleiben.', 'Es lohnt sich, geduldig zu blieb.', 'Es lohnt geduldig zu bleiben.'], a: 0 },
      ]
    };

    const GRAMMAR = {
      de: [
        { level: 'A1', q: 'Ich ___ Student.', opts: ['bin', 'bist', 'ist', 'sind'], a: 0 },
        { level: 'A1', q: 'Wir ___ aus Berlin.', opts: ['komme', 'kommst', 'kommen', 'kommt'], a: 2 },
        { level: 'A1', q: 'Das ist ___ Buch.', opts: ['ein', 'eine', 'einen', 'einem'], a: 0 },
        { level: 'A1', q: 'Er ___ Deutsch.', opts: ['lerne', 'lernst', 'lernt', 'lernen'], a: 2 },
        { level: 'A1', q: 'Ich gehe ___ Schule.', opts: ['zur', 'zum', 'im', 'am'], a: 0 },
        { level: 'A1', q: 'Sie ___ ein Auto.', opts: ['habe', 'hast', 'hat', 'haben'], a: 2 },
        { level: 'A1', q: '___ du Kaffee?', opts: ['Trinkst', 'Trinkt', 'Trinken', 'Trinke'], a: 0 },
        { level: 'A1', q: 'Meine Mutter ___ Lehrerin.', opts: ['ist', 'sind', 'bist', 'sein'], a: 0 },
        { level: 'A1', q: 'Der Hund ist ___ Garten.', opts: ['im', 'am', 'zur', 'zum'], a: 0 },
        { level: 'A1', q: 'Ich wohne ___ Hamburg.', opts: ['in', 'nach', 'zu', 'bei'], a: 0 },
        { level: 'A2', q: 'Gestern ___ ich lange gearbeitet.', opts: ['habe', 'bin', 'hat', 'seid'], a: 0 },
        { level: 'A2', q: 'Am Sonntag ___ wir nach M\u00fcnchen gefahren.', opts: ['sind', 'haben', 'ist', 'hat'], a: 0 },
        { level: 'A2', q: 'Ich interessiere mich ___ Musik.', opts: ['f\u00fcr', 'mit', 'an', 'bei'], a: 0 },
        { level: 'A2', q: 'Kannst du ___ bitte helfen?', opts: ['mir', 'mich', 'mein', 'ich'], a: 0 },
        { level: 'A2', q: 'Der Film war ___ als das Buch.', opts: ['besser', 'gut', 'am besten', 'gute'], a: 0 },
        { level: 'A2', q: 'Ich habe keine Zeit, ___ ich lernen muss.', opts: ['weil', 'aber', 'oder', 'und'], a: 0 },
        { level: 'A2', q: 'Nach der Arbeit gehe ich ___ Hause.', opts: ['nach', 'zu', 'in', 'bei'], a: 0 },
        { level: 'A2', q: 'Wir treffen uns ___ acht Uhr.', opts: ['um', 'am', 'im', 'zu'], a: 0 },
        { level: 'B1', q: 'Wenn ich mehr Zeit h\u00e4tte, ___ ich mehr lesen.', opts: ['w\u00fcrde', 'werde', 'wurde', 'will'], a: 0 },
        { level: 'B1', q: 'Obwohl es regnet, ___ wir spazieren.', opts: ['gehen', 'geht', 'ging', 'gehe'], a: 0 },
        { level: 'B1', q: 'Ich freue mich darauf, dich ___ sehen.', opts: ['zu', 'um', 'bei', 'an'], a: 0 },
        { level: 'B1', q: 'Das ist der Mann, ___ ich geholfen habe.', opts: ['dem', 'den', 'der', 'dessen'], a: 0 },
        { level: 'B1', q: 'Sie hat gesagt, dass sie morgen ___.', opts: ['kommt', 'kommen', 'kam', 'komme'], a: 0 },
        { level: 'B1', q: 'Ich muss das Formular ___, bevor ich es sende.', opts: ['ausf\u00fcllen', 'f\u00fcllen aus', 'ausgef\u00fcllt', 'f\u00fcllt aus'], a: 0 },
        { level: 'B1', q: 'Wegen ___ Wetters bleiben wir zu Hause.', opts: ['des schlechten', 'dem schlechten', 'der schlechten', 'schlechtes'], a: 0 },
        { level: 'B2', q: 'Je fr\u00fcher wir anfangen, ___ schneller sind wir fertig.', opts: ['desto', 'weil', 'obwohl', 'damit'], a: 0 },
        { level: 'B2', q: 'Es handelt sich ___ ein Missverst\u00e4ndnis.', opts: ['um', 'an', 'mit', 'f\u00fcr'], a: 0 },
        { level: 'B2', q: 'Der Vertrag muss bis Freitag ___ werden.', opts: ['unterschrieben', 'unterschreiben', 'unterschrieb', 'unterschreibt'], a: 0 },
        { level: 'B2', q: 'An deiner Stelle ___ ich den Termin verschieben.', opts: ['w\u00fcrde', 'werde', 'wurde', 'war'], a: 0 },
        { level: 'B2', q: 'Die Entscheidung h\u00e4ngt davon ab, ___ die Kosten sinken.', opts: ['ob', 'wenn', 'weil', 'damit'], a: 0 },
        { level: 'B2', q: 'Trotz ___ Nachfrage bleibt der Preis stabil.', opts: ['hoher', 'hohe', 'hohem', 'hohen'], a: 0 },
        { level: 'C1', q: 'Die These, ___ Bildung soziale Mobilit\u00e4t f\u00f6rdert, ist plausibel.', opts: ['dass', 'ob', 'wenn', 'damit'], a: 0 },
        { level: 'C1', q: 'Kaum hatte er angerufen, ___ die Besprechung.', opts: ['begann', 'beginnt', 'begonnen', 'beginne'], a: 0 },
        { level: 'C1', q: 'Der Vorschlag wurde unter der Bedingung angenommen, ___ alle zustimmen.', opts: ['dass', 'obwohl', 'weil', 'als'], a: 0 },
        { level: 'C1', q: 'Es fehlt nicht an Ideen, ___ an konsequenter Umsetzung.', opts: ['sondern', 'aber', 'oder', 'denn'], a: 0 },
        { level: 'C1', q: 'Die Daten lassen darauf schlie\u00dfen, ___ die Strategie wirkt.', opts: ['dass', 'ob', 'wenn', 'als'], a: 0 },
        { level: 'C2', q: 'H\u00e4tte man fr\u00fcher reagiert, ___ sich der Schaden begrenzen lassen.', opts: ['h\u00e4tte', 'hat', 'wird', 'wurde'], a: 0 },
        { level: 'C2', q: 'Ungeachtet ___ Kritik wurde das Projekt fortgesetzt.', opts: ['massiver', 'massive', 'massivem', 'massiven'], a: 0 },
        { level: 'C2', q: 'Der Bericht legt nahe, dass die Annahmen neu ___ werden m\u00fcssen.', opts: ['bewertet', 'bewerten', 'bewertend', 'bewertete'], a: 0 },
        { level: 'C2', q: 'So sehr ich den Ansatz sch\u00e4tze, ___ er mich nicht ganz.', opts: ['\u00fcberzeugt', '\u00fcberzeugen', '\u00fcberzeugte', '\u00fcberzeugend'], a: 0 },
        { level: 'C2', q: 'Die Kommission behielt sich vor, die Entscheidung sp\u00e4ter zu ___.', opts: ['revidieren', 'revidiert', 'Revision', 'revidierte'], a: 0 },
        // A1 top-up so the duel deck feels fresh past a couple of runs.
        { level: 'A1', q: 'Wie ___ du?', opts: ['hei\u00dft', 'hei\u00dfen', 'hei\u00dfe', 'hei\u00dft du'], a: 0 },
        { level: 'A1', q: 'Ich ___ 25 Jahre alt.', opts: ['bin', 'habe', 'ist', 'hast'], a: 0 },
        { level: 'A1', q: 'Wir ___ ein Haus.', opts: ['haben', 'habt', 'hat', 'habe'], a: 0 },
        { level: 'A1', q: 'Das Kind ___ nicht schlafen.', opts: ['kann', 'kannst', 'k\u00f6nnt', 'k\u00f6nnen'], a: 0 },
        { level: 'A1', q: '___ Uhr ist es?', opts: ['Wie viel', 'Was f\u00fcr', 'Wer', 'Wo'], a: 0 },
        // A2 top-up
        { level: 'A2', q: 'Ich ___ gestern im Kino.', opts: ['war', 'bin', 'ist', 'hatte'], a: 0 },
        { level: 'A2', q: 'Er hat den Schl\u00fcssel ___ Hause vergessen.', opts: ['zu', 'nach', 'in', 'bei'], a: 0 },
        { level: 'A2', q: 'Wenn du kommst, ___ wir zusammen essen.', opts: ['k\u00f6nnen', 'kann', 'k\u00f6nnt', 'kannst'], a: 0 },
        { level: 'A2', q: 'Sie hat mir ___ Blumenstrau\u00df geschenkt.', opts: ['einen', 'ein', 'eine', 'eines'], a: 0 },
        { level: 'A2', q: 'Ich ___ mich auf das Wochenende.', opts: ['freue', 'freuen', 'freust', 'freut'], a: 0 },
        // B1 top-up
        { level: 'B1', q: 'Wenn ich Zeit h\u00e4tte, ___ ich Klavier spielen lernen.', opts: ['w\u00fcrde', 'werde', 'wurde', 'will'], a: 0 },
        { level: 'B1', q: 'Er behauptet, dass er das Buch schon ___ habe.', opts: ['gelesen', 'lese', 'liest', 'las'], a: 0 },
        { level: 'B1', q: 'Trotz des Regens ___ wir spazieren.', opts: ['gingen', 'gehen', 'geht', 'gehe'], a: 0 },
        // B2 top-up
        { level: 'B2', q: 'Ich h\u00e4tte dich angerufen, ___ ich Zeit gehabt h\u00e4tte.', opts: ['wenn', 'als', 'weil', 'obwohl'], a: 0 },
        { level: 'B2', q: 'Es wird empfohlen, den Bericht ___ Freitag einzureichen.', opts: ['bis', 'zu', 'auf', 'in'], a: 0 },
        // C1 top-up
        { level: 'C1', q: 'Kaum war er gegangen, ___ das Meeting weiter.', opts: ['ging', 'geht', 'gegangen', 'gehen'], a: 0 },
        // ── Curated for Practice-for-LIVE (Sep 2026) ──
        // Prepositions (kind → 'prep'): options are exactly four one-word
        // German prepositions so classifyGermanGrammar tags the row cleanly.
        { level: 'A1', q: 'Ich fahre ___ Berlin.', opts: ['nach', 'zu', 'in', 'auf'], a: 0 },
        { level: 'A1', q: 'Wir sitzen ___ dem Tisch.', opts: ['an', 'auf', 'in', 'bei'], a: 0 },
        { level: 'A1', q: 'Das Kind spielt ___ dem Garten.', opts: ['in', 'auf', 'an', 'zu'], a: 0 },
        { level: 'A2', q: 'Ich warte ___ den Bus.', opts: ['auf', 'für', 'an', 'bei'], a: 0 },
        { level: 'A2', q: 'Ich denke oft ___ meine Familie.', opts: ['an', 'auf', 'für', 'bei'], a: 0 },
        { level: 'A2', q: 'Er lebt schon lange ___ seiner Frau.', opts: ['mit', 'bei', 'zu', 'für'], a: 0 },
        { level: 'A2', q: 'Wir fahren morgen ___ dem Auto.', opts: ['mit', 'in', 'auf', 'zu'], a: 0 },
        { level: 'B1', q: 'Er kommt ___ die Party um acht.', opts: ['zu', 'an', 'auf', 'bei'], a: 0 },
        { level: 'B1', q: 'Sie hat Angst ___ Prüfungen.', opts: ['vor', 'auf', 'an', 'bei'], a: 0 },
        { level: 'B1', q: 'Wir freuen uns schon ___ das Wochenende.', opts: ['auf', 'für', 'an', 'zu'], a: 0 },
        // Cases (kind → 'case'): dative / accusative / genitive endings,
        // all four options are inflected articles so classifyGermanGrammar
        // sends them to the "cases" chip and nowhere else.
        { level: 'A2', q: 'Ich helfe ___ Mann.', opts: ['dem', 'den', 'der', 'des'], a: 0 },
        { level: 'A2', q: 'Ich sehe ___ Hund.', opts: ['den', 'dem', 'der', 'des'], a: 0 },
        { level: 'A2', q: 'Ich gebe ___ Frau die Blume.', opts: ['der', 'dem', 'den', 'die'], a: 0 },
        { level: 'A2', q: 'Ich danke ___ Lehrerin.', opts: ['der', 'dem', 'den', 'die'], a: 0 },
        { level: 'B1', q: 'Er antwortet ___ Chef.', opts: ['dem', 'den', 'der', 'des'], a: 0 },
        { level: 'B1', q: 'Ich fahre mit ___ Zug.', opts: ['dem', 'den', 'der', 'des'], a: 0 },
        { level: 'B1', q: 'Wegen ___ Regens bleiben wir zu Hause.', opts: ['des', 'dem', 'den', 'der'], a: 0 },
        { level: 'B2', q: 'Ich erinnere mich an ___ Tag noch gut.', opts: ['den', 'dem', 'der', 'des'], a: 0 },
        { level: 'B2', q: 'Trotz ___ Kälte gehen wir spazieren.', opts: ['der', 'die', 'den', 'dem'], a: 0 },
        // Verb forms (kind → 'verb'): four inflected forms of the same verb
        // (or same tense) so the row is unambiguously a Konjugation row.
        { level: 'A1', q: 'Du ___ sehr schnell.', opts: ['sprichst', 'sprecht', 'spreche', 'sprechen'], a: 0 },
        { level: 'A1', q: 'Ihr ___ nach Hause.', opts: ['geht', 'geh', 'gehe', 'gehen'], a: 0 },
        { level: 'A1', q: 'Sie ___ ein Lied.', opts: ['singt', 'singen', 'singst', 'singe'], a: 0 },
        { level: 'A2', q: 'Gestern ___ ich zu Hause geblieben.', opts: ['bin', 'habe', 'ist', 'hat'], a: 0 },
        { level: 'A2', q: 'Er ___ das Buch schon gelesen.', opts: ['hat', 'ist', 'sind', 'haben'], a: 0 },
        { level: 'A2', q: 'Wir ___ pünktlich angekommen.', opts: ['sind', 'haben', 'ist', 'seid'], a: 0 },
        { level: 'B1', q: 'Wenn er käme, ___ wir zusammen essen.', opts: ['würden', 'werden', 'wurden', 'wollen'], a: 0 },
        { level: 'B1', q: 'Sie ___ mich angerufen, als ich ankam.', opts: ['hatte', 'hat', 'habe', 'ist'], a: 0 },
        { level: 'B2', q: 'Der Brief muss noch ___ werden.', opts: ['geschrieben', 'schreiben', 'schreibt', 'schrieb'], a: 0 },
        // Article-inflection quick fire (kind → 'article' via classifier).
        { level: 'A1', q: 'Ich habe ___ Katze.', opts: ['eine', 'ein', 'einen', 'einem'], a: 0 },
        { level: 'A1', q: 'Das ist ___ Auto meines Vaters.', opts: ['das', 'die', 'der', 'den'], a: 0 },
        { level: 'A2', q: 'Er sucht ___ Job.', opts: ['einen', 'ein', 'eine', 'einer'], a: 0 },
        { level: 'A2', q: 'Wir haben ___ Termin um drei.', opts: ['einen', 'ein', 'eine', 'einem'], a: 0 },
        // ── Bank top-up (Sep 2026). Each row is 4-option German MCQ that
        // classifyGermanGrammar tags into exactly one chip (prep / article /
        // case / verb / mixed) so the Practice-for-LIVE category filters
        // stay clean.
        // Prepositions (kind → 'prep')
        { level: 'A1', q: 'Sie kommt ___ Italien.', opts: ['aus', 'von', 'zu', 'in'], a: 0 },
        { level: 'A1', q: 'Wir treffen uns ___ Bahnhof.', opts: ['am', 'im', 'zu', 'an'], a: 0 },
        { level: 'A1', q: 'Ich gehe ___ Freund.', opts: ['zum', 'zur', 'im', 'am'], a: 0 },
        { level: 'A1', q: 'Der Zug fährt ___ München.', opts: ['nach', 'zu', 'in', 'auf'], a: 0 },
        { level: 'A2', q: 'Ich bin ___ meinem Bruder.', opts: ['bei', 'mit', 'zu', 'an'], a: 0 },
        { level: 'A2', q: 'Wir sprechen ___ die Reise.', opts: ['über', 'auf', 'für', 'mit'], a: 0 },
        { level: 'A2', q: 'Danke ___ die Blumen!', opts: ['für', 'zu', 'an', 'auf'], a: 0 },
        { level: 'A2', q: 'Ich koche ___ meiner Familie.', opts: ['für', 'zu', 'an', 'auf'], a: 0 },
        { level: 'B1', q: 'Sie träumt ___ einer Weltreise.', opts: ['von', 'auf', 'mit', 'in'], a: 0 },
        { level: 'B1', q: 'Er wartet schon ___ zwei Stunden.', opts: ['seit', 'vor', 'für', 'ab'], a: 0 },
        { level: 'B1', q: 'Sie hat sich ___ die Stelle beworben.', opts: ['um', 'auf', 'für', 'an'], a: 0 },
        { level: 'B2', q: 'Der Bericht handelt ___ dem Klimawandel.', opts: ['von', 'über', 'mit', 'an'], a: 0 },
        { level: 'B2', q: 'Die Zahl der Mitglieder ist ___ ein Drittel gestiegen.', opts: ['um', 'auf', 'für', 'an'], a: 0 },
        // Cases (kind → 'case', 4 inflected articles)
        { level: 'A1', q: 'Ich sehe ___ Katze.', opts: ['die', 'der', 'das', 'den'], a: 0 },
        { level: 'A1', q: 'Wo ist ___ Schlüssel?', opts: ['der', 'die', 'das', 'den'], a: 0 },
        { level: 'A2', q: 'Der Lehrer erklärt ___ Schüler die Regel.', opts: ['dem', 'den', 'des', 'der'], a: 0 },
        { level: 'A2', q: 'Ich schenke ___ Tochter ein Buch.', opts: ['der', 'die', 'den', 'des'], a: 0 },
        { level: 'B1', q: 'Wegen ___ Verspätung kamen wir spät.', opts: ['der', 'die', 'den', 'das'], a: 0 },
        { level: 'B1', q: 'Ich helfe ___ Kollegen bei der Aufgabe.', opts: ['dem', 'den', 'der', 'des'], a: 0 },
        { level: 'B2', q: 'Trotz ___ Regens gingen wir raus.', opts: ['des', 'dem', 'den', 'der'], a: 0 },
        { level: 'B2', q: 'Statt ___ Tees nehme ich Kaffee.', opts: ['des', 'dem', 'den', 'der'], a: 0 },
        // Verbs (kind → 'verb', 4 forms of the same verb / tense)
        { level: 'A1', q: 'Was ___ du gerne?', opts: ['isst', 'esst', 'esse', 'essen'], a: 0 },
        { level: 'A1', q: 'Wir ___ einen Kaffee.', opts: ['nehmen', 'nimmt', 'nehme', 'nimmst'], a: 0 },
        { level: 'A1', q: 'Er ___ jeden Tag Sport.', opts: ['macht', 'machen', 'mache', 'machst'], a: 0 },
        { level: 'A1', q: 'Ich ___ nach Hause.', opts: ['fahre', 'fährst', 'fährt', 'fahren'], a: 0 },
        { level: 'A2', q: 'Ich ___ dich gestern gesehen.', opts: ['habe', 'bin', 'hat', 'ist'], a: 0 },
        { level: 'A2', q: 'Sie ___ ihm gestern geholfen.', opts: ['hat', 'ist', 'haben', 'sind'], a: 0 },
        { level: 'A2', q: 'Wir ___ gestern lange geschlafen.', opts: ['haben', 'sind', 'ist', 'hat'], a: 0 },
        { level: 'B1', q: 'Wenn ich es gewusst hätte, ___ ich anders reagiert.', opts: ['hätte', 'wäre', 'würde', 'werde'], a: 0 },
        { level: 'B1', q: 'Er tat so, als ___ er nichts gehört.', opts: ['hätte', 'hat', 'wäre', 'würde'], a: 0 },
        { level: 'B2', q: 'Der Antrag ___ von der Kommission geprüft.', opts: ['wird', 'wurde', 'werden', 'ist'], a: 0 },
        // Articles (kind → 'article')
        { level: 'A1', q: 'Das ist ___ Haus meiner Eltern.', opts: ['das', 'die', 'der', 'den'], a: 0 },
        { level: 'A1', q: 'Ich brauche ___ Stift.', opts: ['einen', 'ein', 'eine', 'einer'], a: 0 },
        { level: 'A2', q: 'Er hat ___ Fahrrad verkauft.', opts: ['das', 'die', 'der', 'den'], a: 0 },
        // Mixed connectives (kind → 'mixed')
        { level: 'A2', q: 'Ich lerne Deutsch, ___ ich in Berlin arbeiten möchte.', opts: ['weil', 'aber', 'oder', 'und'], a: 0 },
        { level: 'B1', q: '___ das Wetter schön ist, machen wir ein Picknick.', opts: ['Wenn', 'Als', 'Ob', 'Damit'], a: 0 },
        { level: 'B1', q: 'Er ist krank, ___ konnte er nicht kommen.', opts: ['deshalb', 'obwohl', 'trotzdem', 'sonst'], a: 0 },
        { level: 'B2', q: 'Ich rufe dich an, ___ ich zu Hause bin.', opts: ['sobald', 'seit', 'bis', 'während'], a: 0 },
        { level: 'B2', q: 'Er studiert, ___ er ein besseres Gehalt bekommt.', opts: ['damit', 'weil', 'obwohl', 'als'], a: 0 },
      ],
      en: [
        { level: 'A1', q: 'She ___ to school every day.', opts: ['go', 'goes', 'going', 'gone'], a: 1 },
        { level: 'A1', q: 'This is ___ interesting book.', opts: ['a', 'an', 'the', '-'], a: 1 },
        { level: 'A1', q: 'I ___ from Spain.', opts: ['am', 'is', 'are', 'be'], a: 0 },
        { level: 'A1', q: 'They ___ my parents.', opts: ['are', 'is', 'am', 'be'], a: 0 },
        { level: 'A1', q: 'We ___ a dog.', opts: ['have', 'has', 'having', 'had'], a: 0 },
        { level: 'A1', q: 'He ___ football on Sundays.', opts: ['play', 'plays', 'playing', 'played'], a: 1 },
        { level: 'A1', q: 'The book is ___ the table.', opts: ['on', 'in', 'at', 'to'], a: 0 },
        { level: 'A1', q: '___ your name?', opts: ["What's", 'Who is', 'Where is', 'How is'], a: 0 },
        { level: 'A1', q: 'I like ___ coffee in the morning.', opts: ['drinking', 'drink', 'drank', 'to drank'], a: 0 },
        { level: 'A1', q: 'She has ___ apple.', opts: ['an', 'a', 'the', '-'], a: 0 },
        { level: 'A2', q: 'I ___ living here since 2020.', opts: ['am', 'have been', 'was', 'be'], a: 1 },
        { level: 'A2', q: 'They ___ finished yet.', opts: ["haven't", "hasn't", "didn't", "isn't"], a: 0 },
        { level: 'A2', q: 'If it rains, we ___ stay home.', opts: ['will', 'would', 'are', 'have'], a: 0 },
        { level: 'A2', q: 'He is good ___ maths.', opts: ['in', 'on', 'at', 'for'], a: 2 },
        { level: 'A2', q: 'She was tired, ___ she went to bed early.', opts: ['so', 'because', 'but', 'or'], a: 0 },
        { level: 'A2', q: 'I have ___ time than you.', opts: ['less', 'fewer', 'lesser', 'more little'], a: 0 },
        { level: 'A2', q: 'She ___ me yesterday.', opts: ['called', 'call', 'calls', 'calling'], a: 0 },
        { level: 'A2', q: 'How ___ books do you have?', opts: ['many', 'much', 'more', 'a lot'], a: 0 },
        { level: 'B1', q: 'If I ___ you, I would apologise.', opts: ['were', 'was', 'am', 'be'], a: 0 },
        { level: 'B1', q: 'By this time next year I ___ graduated.', opts: ['will have', 'will', 'have', 'am'], a: 0 },
        { level: 'B1', q: 'The film ___ by a young director.', opts: ['was made', 'made', 'was making', 'is make'], a: 0 },
        { level: 'B1', q: 'She asked me where I ___.', opts: ['lived', 'live', 'am living', 'do live'], a: 0 },
        { level: 'B1', q: 'You ___ told me earlier.', opts: ['should have', 'should', 'must', 'could'], a: 0 },
        { level: 'B1', q: 'The report, ___ was published today, is critical.', opts: ['which', 'who', 'whom', 'that'], a: 0 },
        { level: 'B2', q: 'Had he known, he ___ acted differently.', opts: ['would have', 'would', 'will have', 'has'], a: 0 },
        { level: 'B2', q: 'Not only ___ late, but she also forgot the tickets.', opts: ['was she', 'she was', 'is she', 'she is'], a: 0 },
        { level: 'B2', q: 'The proposal, ___ merits are clear, needs funding.', opts: ['whose', 'which', 'who', 'that'], a: 0 },
        { level: 'B2', q: 'It is high time we ___ leaving.', opts: ['were', 'are', 'will be', 'have been'], a: 0 },
        { level: 'C1', q: '___ that he had misunderstood, he apologised.', opts: ['Realising', 'Realised', 'Realise', 'To realise'], a: 0 },
        { level: 'C1', q: 'The findings, ___ from a small sample, are tentative.', opts: ['drawn', 'drew', 'drawing', 'to draw'], a: 0 },
        { level: 'C1', q: 'She insisted that the report ___ revised.', opts: ['be', 'is', 'was', 'will be'], a: 0 },
        { level: 'C2', q: 'Rarely ___ such a decisive shift in public opinion.', opts: ['have we seen', 'we have seen', 'did we saw', 'we saw'], a: 0 },
        { level: 'C2', q: 'The theory posits that language ___ thought.', opts: ['shapes', 'shape', 'shaping', 'shaped'], a: 0 },
      ],
      es: [
        { level: 'A1', q: 'Yo ___ español.', opts: ['hablo', 'hablas', 'habla', 'hablan'], a: 0 },
        { level: 'A1', q: 'Nosotros ___ en Madrid.', opts: ['vivo', 'vives', 'vivimos', 'viven'], a: 2 },
        { level: 'A1', q: '___ un libro.', opts: ['Es', 'Está', 'Son', 'Están'], a: 0 },
        { level: 'A1', q: 'Ella ___ profesora.', opts: ['soy', 'eres', 'es', 'son'], a: 2 },
        { level: 'A1', q: 'Yo ___ hambre.', opts: ['tengo', 'tienes', 'tiene', 'tenemos'], a: 0 },
        { level: 'A1', q: '¿De dónde ___?', opts: ['eres', 'soy', 'es', 'somos'], a: 0 },
        { level: 'A1', q: 'Los libros están ___ la mesa.', opts: ['sobre', 'de', 'a', 'con'], a: 0 },
        { level: 'A1', q: 'Ellos ___ mis amigos.', opts: ['son', 'es', 'soy', 'están'], a: 0 },
        { level: 'A2', q: 'Ayer ___ al cine.', opts: ['fui', 'voy', 'iba', 'iré'], a: 0 },
        { level: 'A2', q: 'Hace dos años que ___ español.', opts: ['estudio', 'estudié', 'estudiaba', 'estudiaré'], a: 0 },
        { level: 'A2', q: 'Cuando era pequeño, ___ mucho.', opts: ['jugaba', 'jugué', 'juego', 'jugaría'], a: 0 },
        { level: 'A2', q: 'Ella me ___ un regalo.', opts: ['dio', 'da', 'daba', 'dará'], a: 0 },
        { level: 'A2', q: 'Este libro es ___ que aquel.', opts: ['mejor', 'bueno', 'más bueno', 'el mejor'], a: 0 },
        { level: 'A2', q: 'Voy ___ la playa el sábado.', opts: ['a', 'en', 'por', 'de'], a: 0 },
        { level: 'B1', q: 'Si tuviera tiempo, ___ más.', opts: ['leería', 'leo', 'leí', 'lea'], a: 0 },
        { level: 'B1', q: 'Espero que ___ mañana.', opts: ['vengas', 'vienes', 'venir', 'viniste'], a: 0 },
        { level: 'B1', q: 'Cuando ___ a casa, cenaremos.', opts: ['llegue', 'llego', 'llegaría', 'llegaba'], a: 0 },
        { level: 'B1', q: 'Es importante que ___ la verdad.', opts: ['digas', 'dices', 'diciendo', 'dijiste'], a: 0 },
        { level: 'B1', q: 'La casa ___ construida en 1900.', opts: ['fue', 'era', 'estaba', 'es'], a: 0 },
        { level: 'B2', q: 'Aunque ___ frío, saldremos.', opts: ['haga', 'hace', 'hará', 'hizo'], a: 0 },
        { level: 'B2', q: 'Si hubieras estudiado, ___ aprobado.', opts: ['habrías', 'habrás', 'has', 'habías'], a: 0 },
        { level: 'B2', q: 'Me alegro de que ___ podido venir.', opts: ['hayas', 'has', 'habías', 'habrías'], a: 0 },
        { level: 'B2', q: 'De haberlo sabido, ___ actuado antes.', opts: ['habría', 'había', 'he', 'hubiera'], a: 0 },
        { level: 'C1', q: 'Por más que ___, no llegaremos a tiempo.', opts: ['corras', 'corres', 'correrás', 'corría'], a: 0 },
        { level: 'C1', q: 'Ojalá ___ hecho caso.', opts: ['hubieras', 'hubieses', 'habrías', 'has'], a: 0 },
        { level: 'C1', q: 'Se ruega ___ el reglamento.', opts: ['respetar', 'respetando', 'respetado', 'respeta'], a: 0 },
        { level: 'C2', q: 'Cuanto más ___, mejor lo entenderás.', opts: ['leas', 'lees', 'leerás', 'leyendo'], a: 0 },
        { level: 'C2', q: 'Dudo que ___ estado en Roma alguna vez.', opts: ['haya', 'ha', 'había', 'habría'], a: 0 },
      ],
      sv: [
        { level: 'A1', q: 'Jag ___ svensk.', opts: ['är', 'har', 'blir', 'gör'], a: 0 },
        { level: 'A1', q: 'Vi ___ i Stockholm.', opts: ['bor', 'bo', 'bodde', 'bott'], a: 0 },
        { level: 'A1', q: 'Han ___ en katt.', opts: ['har', 'är', 'gör', 'går'], a: 0 },
        { level: 'A1', q: 'Det är ___ hund.', opts: ['en', 'ett', 'den', 'det'], a: 0 },
        { level: 'A1', q: 'Hon ___ till skolan varje dag.', opts: ['går', 'gå', 'gick', 'gått'], a: 0 },
        { level: 'A1', q: '___ heter du?', opts: ['Vad', 'Vem', 'Hur', 'Var'], a: 0 },
        { level: 'A1', q: 'Jag talar ___ svenska.', opts: ['lite', 'liten', 'litet', 'små'], a: 0 },
        { level: 'A1', q: 'Boken ligger ___ bordet.', opts: ['på', 'i', 'av', 'till'], a: 0 },
        { level: 'A2', q: 'I går ___ jag på bio.', opts: ['var', 'är', 'blev', 'har'], a: 0 },
        { level: 'A2', q: 'Han har ___ i två år.', opts: ['bott', 'bo', 'bor', 'bodde'], a: 0 },
        { level: 'A2', q: 'Jag tycker ___ svensk mat.', opts: ['om', 'på', 'i', 'av'], a: 0 },
        { level: 'A2', q: 'Vi ska resa ___ Norge nästa vecka.', opts: ['till', 'på', 'i', 'av'], a: 0 },
        { level: 'A2', q: 'Det är ___ att lära sig ett nytt språk.', opts: ['viktigt', 'viktig', 'viktiga', 'vikt'], a: 0 },
        { level: 'A2', q: 'Kan du hjälpa ___ med läxan?', opts: ['mig', 'jag', 'min', 'mej'], a: 0 },
        { level: 'B1', q: 'Om jag ___ tid, skulle jag läsa mer.', opts: ['hade', 'har', 'skulle ha', 'hade haft'], a: 0 },
        { level: 'B1', q: 'Han sa att han ___ komma senare.', opts: ['skulle', 'ska', 'skall', 'kunde'], a: 0 },
        { level: 'B1', q: 'Boken som jag läser ___ mycket bra.', opts: ['är', 'har', 'blir', 'gör'], a: 0 },
        { level: 'B1', q: 'Det är viktigt att man ___ på tid.', opts: ['kommer', 'kom', 'kommit', 'komma'], a: 0 },
        { level: 'B1', q: 'Trots att det regnar, ___ vi ut.', opts: ['går', 'gick', 'gått', 'gå'], a: 0 },
        { level: 'B2', q: 'Rapporten ___ av en oberoende expert.', opts: ['skrevs', 'skrev', 'skriver', 'har skrivit'], a: 0 },
        { level: 'B2', q: 'Ju mer man övar, ___ bättre blir man.', opts: ['desto', 'ju', 'så', 'och'], a: 0 },
        { level: 'B2', q: 'Han påstår att han ___ läst hela boken.', opts: ['har', 'hade', 'skulle', 'blev'], a: 0 },
        { level: 'B2', q: 'Om jag hade vetat detta, ___ jag stannat hemma.', opts: ['skulle', 'ska', 'har', 'blev'], a: 0 },
        { level: 'C1', q: 'Beslutet fattades ___ omfattande diskussion.', opts: ['efter', 'före', 'medan', 'sedan'], a: 0 },
        { level: 'C1', q: 'Frågan om ___ regleringen fungerar är fortfarande öppen.', opts: ['huruvida', 'som', 'att', 'om att'], a: 0 },
      ],
    };

    const WORD_USAGE = {
      de: [
        { s: 'Ich ___ einen Kaffee, bitte.', a: 'möchte', opts: ['möchte', 'gehe', 'komme', 'sehe'] },
        { s: 'Am Wochenende ___ ich meine Familie.', a: 'besuche', opts: ['besuche', 'trinke', 'schlafe', 'lese'] },
        { s: 'Der Zug ___ um acht Uhr ab.', a: 'fährt', opts: ['fährt', 'isst', 'liest', 'singt'] },
        { s: 'Kannst du mir bitte ___?', a: 'helfen', opts: ['helfen', 'gehen', 'essen', 'trinken'] }
      ],
      en: [
        { s: 'I would like to ___ my English.', a: 'improve', opts: ['improve', 'drink', 'drive', 'sleep'] },
        { s: 'She ___ a meeting at noon.', a: 'has', opts: ['has', 'eats', 'runs', 'sings'] },
        { s: 'We need to ___ the report today.', a: 'finish', opts: ['finish', 'swim', 'cook', 'dance'] }
      ],
      es: [
        { s: 'Quiero ___ español mejor.', a: 'hablar', opts: ['hablar', 'comer', 'dormir', 'correr'] },
        { s: 'Ella ___ en Madrid.', a: 'vive', opts: ['vive', 'come', 'bebe', 'canta'] }
      ]
    };

    const LISTEN = {
      de: [
        { text: 'Guten Morgen, wie geht es dir?', hint: 'приветствие / greeting' },
        { text: 'Ich hätte gern einen Kaffee.', hint: 'в кафе / at a cafe' },
        { text: 'Wo ist der Bahnhof, bitte?', hint: 'вопрос дороги / directions' },
        { text: 'Das Wetter ist heute sehr schön.', hint: 'погода / weather' }
      ],
      en: [
        { text: 'Could you tell me the way to the station?', hint: 'directions' },
        { text: 'I have been learning English for two years.', hint: 'about yourself' },
        { text: 'What time does the meeting start?', hint: 'at work' }
      ],
      es: [
        { text: 'Buenos días, ¿cómo estás?', hint: 'saludo / greeting' },
        { text: '¿Dónde está la estación, por favor?', hint: 'direcciones / directions' }
      ]
    };

    const SPEECH_LOCALE = { de: 'de-DE', en: 'en-US', es: 'es-ES', fa: 'fa-IR' };
    const SUPPORTED_LANGUAGE_TARGETS = ['de', 'en', 'es'];
    const LANGUAGE_TARGET_ALIASES = {
      de: 'de', deutsch: 'de', german: 'de', germanic: 'de', немецкий: 'de', nemetskij: 'de',
      en: 'en', english: 'en', englisch: 'en', английский: 'en', anglijskij: 'en',
      es: 'es', spanish: 'es', spanisch: 'es', espanol: 'es', español: 'es', испанский: 'es',
      fr: 'fr', french: 'fr', francais: 'fr', français: 'fr', французский: 'fr',
      it: 'it', italian: 'it', итальянский: 'it',
      pt: 'pt', portuguese: 'pt', португальский: 'pt',
      ru: 'ru', russian: 'ru', русский: 'ru',
      ar: 'ar', arabic: 'ar', арабский: 'ar',
      fa: 'fa', persian: 'fa', farsi: 'fa', персидский: 'fa',
      tr: 'tr', turkish: 'tr', турецкий: 'tr',
      nl: 'nl', dutch: 'nl', нидерландский: 'nl',
      pl: 'pl', polish: 'pl', польский: 'pl',
      uk: 'uk', ukrainian: 'uk', украинский: 'uk',
      sv: 'sv', swedish: 'sv', шведский: 'sv',
      no: 'no', norwegian: 'no', норвежский: 'no',
      da: 'da', danish: 'da', датский: 'da',
      fi: 'fi', finnish: 'fi', финский: 'fi',
      el: 'el', greek: 'el', греческий: 'el',
      cs: 'cs', czech: 'cs', чешский: 'cs',
      hu: 'hu', hungarian: 'hu', венгерский: 'hu',
      ro: 'ro', romanian: 'ro', румынский: 'ro',
      zh: 'zh', chinese: 'zh', китайский: 'zh',
      ja: 'ja', japanese: 'ja', японский: 'ja',
      ko: 'ko', korean: 'ko', корейский: 'ko',
      hi: 'hi', hindi: 'hi', хинди: 'hi',
      th: 'th', thai: 'th', тайский: 'th',
      vi: 'vi', vietnamese: 'vi', вьетнамский: 'vi',
      id: 'id', indonesian: 'id', индонезийский: 'id'
    };
    const LANGUAGE_TARGET_LABELS = {
      en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', nl: 'Dutch',
      ru: 'Russian', uk: 'Ukrainian', pl: 'Polish', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
      el: 'Greek', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', tr: 'Turkish', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', hi: 'Hindi', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ar: 'Arabic', he: 'Hebrew', fa: 'Persian'
    };
    const SUBJECT_TARGET_ICONS = {
      math: '➗', physics: '⚛️', chemistry: '🧪', biology: '🧬', logic: '🧩', chess: '♟️',
      programming: '💻', 'web-development': '🌐', 'mobile-development': '📱', 'ui-ux': '🎨',
      figma: '🎨', drawing: '✏️', painting: '🖌️', fitness: '💪', yoga: '🧘',
      cooking: '🍳', communication: '💬', productivity: '⚡'
    };

    const WRITING = {
      de: [
        { id:'de-a1-daily-routine',level:'A1',title:'Mein typischer Tag',prompt:'Beschreiben Sie Ihren typischen Tag.',instructions:'Schreiben Sie mindestens vier kurze Sätze über Ihren Tagesablauf.',minWords:35,maxWords:60,checklist:['Ich benutze Präsens.','Ich habe mindestens 4 Sätze.','Ich benutze Zeitwörter wie „morgens“, „dann“ oder „danach“.'],vocabulary:['morgens','danach','am Abend'] },
        { id:'de-a2-family',level:'A2',title:'Meine Familie',prompt:'Schreiben Sie über Ihre Familie.',instructions:'Beschreiben Sie Ihre Familie, gemeinsame Aktivitäten und eine Person etwas genauer.',minWords:60,maxWords:90,checklist:['Ich nenne mindestens 2 Familienmitglieder.','Ich benutze „haben“ oder „sein“.','Mein Text hat einen Anfang und ein Ende.'],vocabulary:['zusammen','Geschwister','am Wochenende'] }
      ],
      en: [
        { id:'en-a1-daily-routine',level:'A1',title:'My typical day',prompt:'Describe your typical day.',instructions:'Write at least four short sentences about your daily routine.',minWords:35,maxWords:60,checklist:['I use the present tense.','I write at least 4 sentences.','I use time words such as “then” or “after that”.'],vocabulary:['usually','then','in the evening'] },
        { id:'en-a2-holiday',level:'A2',title:'My last holiday',prompt:'Write about your last holiday.',instructions:'Explain where you went, what you did and one memorable moment.',minWords:60,maxWords:90,checklist:['I use the past tense.','I mention where I went.','I describe at least one activity.'],vocabulary:['last year','visited','because'] }
      ],
      es: [
        { id:'es-a1-rutina',level:'A1',title:'Mi día típico',prompt:'Describe tu día típico.',instructions:'Escribe al menos cuatro frases cortas sobre tu rutina diaria.',minWords:35,maxWords:60,checklist:['Uso el presente.','Escribo al menos 4 frases.','Uso palabras como «luego» o «después».'],vocabulary:['por la mañana','después','por la noche'] }
      ]
    };

    const ESSENTIALS = {
      de: [
        { title: 'Begrüßungen', bullets: ['Guten Morgen — good morning', 'Guten Tag — good day', 'Guten Abend — good evening', 'Wie geht es dir? — how are you?'] },
        { title: 'Zahlen 1–10', bullets: ['eins, zwei, drei, vier, fünf', 'sechs, sieben, acht, neun, zehn'] },
        { title: 'Höflichkeit', bullets: ['bitte — please', 'danke — thank you', 'entschuldigung — excuse me', 'gern geschehen — you\'re welcome'] }
      ],
      en: [
        { title: 'Greetings', bullets: ['Good morning', 'Good afternoon', 'Good evening', 'How are you?'] },
        { title: 'Numbers 1–10', bullets: ['one, two, three, four, five', 'six, seven, eight, nine, ten'] },
        { title: 'Politeness', bullets: ['please', 'thank you', 'excuse me', "you're welcome"] }
      ],
      es: [
        { title: 'Saludos', bullets: ['Buenos días', 'Buenas tardes', 'Buenas noches', '¿Cómo estás?'] },
        { title: 'Números 1–10', bullets: ['uno, dos, tres, cuatro, cinco', 'seis, siete, ocho, nueve, diez'] }
      ]
    };

    const MISTAKE_KEY = 'duvela.study.mistakes';
    const SAVED_WORDS_KEY = 'duvela.study.savedWords';
    const FLASHCARD_SESSION_LIMIT = 20;
    const FLASHCARD_SCHEDULER_VERSION = 'duvela-srs-v1';
    let flashcardKeyboardHandler = null;
    const STUDENT_GOAL = window.DuvelaStudentGoal || {
      LEVELS: ['A2','B1','B2','C1'],
      normalize: function(value,fallback){ var raw=String(value||'').trim().toUpperCase(),safeFallback=String(fallback||'').trim().toUpperCase(); return this.LEVELS.indexOf(raw)>=0?raw:(this.LEVELS.indexOf(safeFallback)>=0?safeFallback:'A2'); },
      fromProfile: function(profile,fallback){ return this.normalize(profile&&profile.goal_level,fallback); },
      legacyPatch: function(value){ var level=this.normalize(value,'A2'); return { goal_level:level, learning_goal:level }; }
    };
    const SKILL_GROUP = {
      flashcards:'vocabulary', vocabulary:'vocabulary', memory:'vocabulary', wordusage:'vocabulary',
      grammar:'grammar', articles:'grammar', wquestion:'grammar', perfekt:'grammar',
      listening:'listening', speaking:'speaking', reading:'reading', readingarticles:'reading', writing:'writing',
      exam:'exam', essentials:'grammar', ai:'speaking', mistakes:'review'
    };

    // Reviewed mobile W-question bank. Do not add question types or prompts here without
    // approved curriculum content; each item includes its answer-specific learning note.
    const W_QUESTIONS = [
      { q:'___ wohnst du?', opts:['Wo','Wer','Was','Wann'], a:0, full:'Wo wohnst du?', translation:{ en:'Where do you live?', ru:'Где ты живёшь?', de:'Wo wohnst du?' }, explanation:{ en:'“Wo” asks about a location. “Wohin” asks about a direction, and “Woher” asks about an origin.', ru:'«Wo» спрашивает о местонахождении. «Wohin» — о направлении, а «Woher» — о происхождении.', de:'„Wo“ fragt nach einem Ort. „Wohin“ fragt nach einer Richtung, „Woher“ nach einer Herkunft.' }, example:{ de:'Wo ist der Bahnhof?', en:'Where is the train station?', ru:'Где находится вокзал?' } },
      { q:'___ heißt du?', opts:['Wie','Wo','Warum','Wen'], a:0, full:'Wie heißt du?', translation:{ en:'What is your name?', ru:'Как тебя зовут?', de:'Wie heißt du?' }, explanation:{ en:'“Wie” asks about a name, manner or description.', ru:'«Wie» спрашивает об имени, способе или описании.', de:'„Wie“ fragt nach einem Namen, einer Art oder einer Beschreibung.' }, example:{ de:'Wie geht es dir?', en:'How are you?', ru:'Как ты?' } },
      { q:'___ kommt heute?', opts:['Wer','Wo','Wie','Wann'], a:0, full:'Wer kommt heute?', translation:{ en:'Who is coming today?', ru:'Кто придёт сегодня?', de:'Wer kommt heute?' }, explanation:{ en:'“Wer” asks about a person in the subject position.', ru:'«Wer» спрашивает о человеке, который является подлежащим.', de:'„Wer“ fragt nach einer Person in der Subjektposition.' }, example:{ de:'Wer hilft dir?', en:'Who is helping you?', ru:'Кто тебе помогает?' } },
      { q:'___ lernst du Deutsch?', opts:['Warum','Wohin','Wem','Wessen'], a:0, full:'Warum lernst du Deutsch?', translation:{ en:'Why do you learn German?', ru:'Почему ты учишь немецкий?', de:'Warum lernst du Deutsch?' }, explanation:{ en:'“Warum” asks for a reason. A natural answer often begins with “weil”.', ru:'«Warum» спрашивает о причине. Естественный ответ часто начинается с «weil».', de:'„Warum“ fragt nach einem Grund. Eine natürliche Antwort beginnt oft mit „weil“.' }, example:{ de:'Warum kommst du spät?', en:'Why are you late?', ru:'Почему ты опаздываешь?' } }
    ];
    const PERFEKT = [
      { q:'Ich ___ nach Berlin gefahren.',opts:['bin','habe','ist','hat'],a:0 }, { q:'Wir ___ Deutsch gelernt.',opts:['haben','sind','hat','seid'],a:0 },
      { q:'Sie ___ ein Buch gelesen.',opts:['hat','ist','haben','seid'],a:0 }, { q:'Er ist früh ___.',opts:['gekommen','gekommt','kommen','gekomme'],a:0 }
    ];

    const TOOLS = [
      { id:'speaking',icon:'🎙',category:'skills',accent:'purple',title:tr('Speaking & pronunciation','Говорение и произношение'),desc:tr('Speak aloud and improve every word','Говорите вслух и улучшайте каждое слово') },
      { id:'adaptive',icon:'✦',category:'path',accent:'purple',premium:true,title:tr('Adaptive path','Адаптивный маршрут'),desc:tr('Next practice based on your mistakes','Следующее упражнение по вашим ошибкам') },
      { id:'vocabulary',icon:'Aa',category:'vocabulary',accent:'teal',title:tr('Vocabulary trainer','Словарный тренажёр'),desc:tr('Learn, save and repeat words','Учите, сохраняйте и повторяйте слова') },
      { id:'flashcards',icon:'🔤',category:'vocabulary',accent:'teal',title:tr('Flashcards','Флешкарты'),desc:tr('Learn words with flip cards','Учите слова карточками') },
      { id:'memory',icon:'🃏',category:'vocabulary',accent:'pink',title:tr('Memory match','Мемори'),desc:tr('Match word to translation','Соедините слово и перевод') },
      { id:'wordusage',icon:'✍️',category:'vocabulary',accent:'pink',title:tr('Word usage','Употребление слов'),desc:tr('Pick the word that fits','Подберите подходящее слово') },
      { id:'grammar',icon:'📘',category:'grammar',accent:'blue',title:tr('Grammar academy','Академия грамматики'),desc:tr('Choose the correct form','Выберите правильную форму') },
      { id:'articles',icon:'DE',category:'grammar',accent:'amber',title:tr('Guess the article','Угадай артикль'),desc:tr('German der / die / das','Немецкий der / die / das') },
      { id:'wquestion',icon:'W?',category:'grammar',accent:'amber',title:tr('W-questions','W-вопросы'),desc:tr('Build German questions','Стройте вопросы на немецком') },
      { id:'perfekt',icon:'✓',category:'grammar',accent:'purple',title:tr('German Perfekt','Немецкий Perfekt'),desc:tr('Practice the spoken past tense','Практика прошедшего времени') },
      { id:'listening',icon:'🎧',category:'skills',accent:'teal',title:tr('Listening lab','Аудирование'),desc:tr('Listen, type and check','Слушайте, записывайте и проверяйте') },
      { id:'reading',icon:'📖',category:'skills',accent:'blue',title:tr('Reading lab','Лаборатория чтения'),desc:tr('Read and answer questions','Читайте и отвечайте на вопросы') },
      { id:'readingarticles',icon:'▤',category:'skills',accent:'blue',title:tr('Reading articles','Статьи для чтения'),desc:tr('Longer texts with vocabulary','Тексты и новая лексика') },
      { id:'writing',icon:'📝',category:'skills',accent:'pink',title:tr('Writing lab','Письмо'),desc:tr('Write and self-check','Пишите и проверяйте себя') },
      { id:'essentials',icon:'📗',category:'courses',accent:'teal',premium:true,title:tr('Language essentials','Основы языка'),desc:tr('Short core lessons','Короткие базовые уроки') },
      { id:'exam',icon:'⏱',category:'progress',accent:'amber',premium:true,title:tr('Exam mode','Режим экзамена'),desc:tr('Timed mixed challenge','Смешанный экзамен на время') },
      { id:'mistakes',icon:'!',category:'progress',accent:'red',title:tr('Mistake center','Центр ошибок'),desc:tr('Review everything you missed','Повторите все свои ошибки') },
      { id:'history',icon:'↺',category:'progress',accent:'purple',title:tr('Practice history','История практики'),desc:tr('XP, sessions and completed tools','XP, занятия и завершённые режимы') },
      { id:'dictionary',icon:'🔖',category:'vocabulary',accent:'teal',title:tr('Saved dictionary','Личный словарь'),desc:tr('Saved words and spaced repetition','Слова и интервальное повторение') },
      { id:'calendar',icon:'▦',category:'progress',accent:'blue',title:tr('Activity calendar','Календарь занятий'),desc:tr('Your streak and practice days','Серия и дни практики') },
      { id:'achievements',icon:'🏆',category:'progress',accent:'amber',title:tr('Achievements','Достижения'),desc:tr('Ranks, rewards and milestones','Ранги, награды и цели') },
      { id:'ranking',icon:'🥇',category:'progress',accent:'amber',title:tr('Leaderboard','Таблица лидеров'),desc:tr('Compare XP with other learners','Сравните XP с другими учениками') },
      { id:'settings',icon:'⚙',category:'progress',accent:'purple',title:tr('Practice settings','Настройки практики'),desc:tr('Sound, motion, text and reminders','Звук, анимация, текст и напоминания') },
      { id:'ai',icon:'✦',category:'coach',accent:'purple',premium:true,title:tr('AI Practice','AI-практика'),desc:tr('Choose Sofia, ELSA or another specialist','Выберите Sofia, ELSA или другого специалиста') }
    ];

    TOOLS.splice(14, 0,
      { id:'sentences',icon:'⇄',category:'grammar',accent:'blue',title:tr('Sentence builder','Конструктор предложений'),desc:tr('Put words into the correct order','Соберите слова в правильном порядке') },
      { id:'categories',icon:'▦',category:'vocabulary',accent:'teal',title:tr('Word sorting','Сортировка слов'),desc:tr('Sort vocabulary into categories','Распределите слова по категориям') },
      { id:'scenarios',icon:'☕',category:'skills',accent:'pink',title:tr('Role-play stories','Ролевые ситуации'),desc:tr('Cafe, travel, work and everyday choices','Кафе, путешествия, работа и ежедневные диалоги') },
      { id:'duel',icon:'⚡',category:'progress',accent:'red',premium:false,title:tr('Student LIVE Duel','LIVE-дуэль ученика'),desc:tr('Real learner first, Duvela Bot fallback if nobody is online','Сначала настоящий ученик, если никого нет онлайн — бот Duvela') },
      { id:'team',icon:'👥',category:'progress',accent:'purple',title:tr('Team challenge','Командное задание'),desc:tr('Complete a shared language goal','Выполните общую языковую цель') }
    );
    TOOLS.push(
      { id:'liveTeacher',icon:'▣',category:'coach',accent:'red',premium:true,title:tr('Practice LIVE with Teacher','LIVE-практика с преподавателем'),desc:tr('Speaking, questions and real-time feedback','Говорение, вопросы и обратная связь в реальном времени') },
      { id:'germanAlphabet',icon:'Ää',category:'vocabulary',accent:'teal',title:tr('German alphabet','Немецкий алфавит'),desc:tr('30 letters and 19 letter combinations','30 букв и 19 сочетаний') },
      { id:'persianAlphabet',icon:'الف',category:'vocabulary',accent:'teal',title:tr('Persian alphabet','Персидский алфавит'),desc:tr('32 letters, their shapes and sounds','32 буквы, их формы и звуки') },
      { id:'persianReading',icon:'📖',category:'skills',accent:'blue',title:tr('Reading & letters','Чтение и буквы'),desc:tr('Read words with and without vowel marks, build words from letters','Чтение с огласовками и без, сборка слов из букв') },
      { id:'persianListening',icon:'🎧',category:'skills',accent:'teal',title:tr('Listening','Аудирование'),desc:tr('NOVA says a word: pick it or spell it','NOVA говорит слово: выберите или соберите его') },
      { id:'persianNumbers',icon:'۱۲۳',category:'vocabulary',accent:'purple',title:tr('Numbers, time, money','Числа, время, деньги'),desc:tr('Persian digits, telling the time and prices','Персидские цифры, время и цены') },
      { id:'persianGrammar',icon:'دستور',category:'grammar',accent:'blue',title:tr('Mini grammar','Мини-грамматика'),desc:tr('Short Persian grammar tasks for your level, A1–C1','Короткие задания по персидской грамматике для вашего уровня, A1–C1') },
      { id:'persianWordCards',icon:'🃏',category:'vocabulary',accent:'teal',title:tr('Word cards','Карточки слов'),desc:tr('Read, listen and repeat until you know the word','Читайте, слушайте и повторяйте, пока не запомните') },
      { id:'chess',icon:'♞',category:'chess',accent:'purple',title:'Chess',desc:tr('Play and train focus between lessons','Играйте и тренируйте концентрацию между уроками') }
    );

    // ---- helpers ----
    function loadProgress() {
      try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveProgress(next) {
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    }
    function loadExamGoal() {
      try { return Object.assign({ exam:'telc-b1',date:'',daysPerWeek:5,minutes:20 },JSON.parse(localStorage.getItem(EXAM_GOAL_KEY)||'{}')); }
      catch(e){ return { exam:'telc-b1',date:'',daysPerWeek:5,minutes:20 }; }
    }
    function studentGoalLevel(fallback) {
      return STUDENT_GOAL.fromProfile(ctx.profile, fallback || '');
    }
    function studentGoalLevelForTarget(target, fallback) {
      var normalizedTarget = normalizePracticeTarget(target);
      var prefs = loadPrefs();
      if (prefs.goalLevels && prefs.goalLevels[normalizedTarget]) return STUDENT_GOAL.normalize(prefs.goalLevels[normalizedTarget], fallback || '');
      var profile = ctx.profile || {};
      var learningTargets = Array.isArray(profile.learning_targets) ? profile.learning_targets : [];
      for (var i = 0; i < learningTargets.length; i++) {
        var item = learningTargets[i];
        if (!item || typeof item !== 'object') continue;
        if (item.goalLevels && typeof item.goalLevels === 'object') {
          var keys = Object.keys(item.goalLevels);
          for (var j = 0; j < keys.length; j++) {
            if (normalizePracticeTarget(keys[j]) === normalizedTarget) return STUDENT_GOAL.normalize(item.goalLevels[keys[j]], fallback || '');
          }
        }
        if (item.language && normalizePracticeTarget(item.language) === normalizedTarget && item.goalLevel) return STUDENT_GOAL.normalize(item.goalLevel, fallback || '');
      }
      return studentGoalLevel(fallback);
    }
    function examDaysLeft(goal) { if(!goal.date)return null;return Math.max(0,Math.ceil((new Date(goal.date+'T12:00:00')-Date.now())/86400000)); }
    function skillReadiness(progress) {
      var sessions=progress.sessions||[],groups=['reading','listening','grammar','writing','speaking'],result={};
      groups.forEach(function(group){var rows=sessions.filter(function(row){return (SKILL_GROUP[row.tool_id]||row.tool_id)===group;}).slice(0,12),attempted=rows.reduce(function(sum,row){return sum+Number(row.total||0);},0),correct=rows.reduce(function(sum,row){return sum+Number(row.score||0);},0);result[group]=attempted?Math.round(correct/attempted*100):0;});
      result.overall=Math.round(groups.reduce(function(sum,key){return sum+result[key];},0)/groups.length);return result;
    }
    function mistakeTopic(item){
      var source=String(item&&((item.sourceTool||item.toolId||item.kind)||'')).toLowerCase(),text=String(item&&item.prompt||'').toLowerCase();
      if(source==='article'||source==='articles')return {id:'articles',category:'articles',label:'der / die / das',tool:'articles'};
      if(source==='listening')return {id:'listening',category:'listening',label:tr('Listening','Аудирование'),tool:'listening'};
      if(source==='reading')return {id:'reading',category:'reading',label:tr('Reading','Чтение'),tool:'reading'};
      if(source==='writing')return {id:'writing',category:'writing',label:tr('Writing','Письмо'),tool:'writing'};
      if(source==='pronunciation'||source==='speaking')return {id:'speaking',category:'other',label:tr('Pronunciation','Произношение'),tool:'speaking'};
      if(source==='vocabulary'||source==='wordusage'||source==='flashcards'||source==='memory'||source==='categories')return {id:'vocabulary',category:'vocabulary',label:tr('Vocabulary','Словарный запас'),tool:'wordusage'};
      if(source==='wquestion'||source==='questions')return {id:'questions',category:'grammar',label:tr('Question words','Вопросительные слова'),tool:'wquestion'};
      if(source==='perfekt'||/\b(perfekt|gefahren|gelernt|gelesen|gekommen)\b/.test(text))return {id:'perfekt',category:'grammar',label:'Perfekt',tool:'perfekt'};
      if(source==='sentence'||source==='sentences'||source==='grammar'||source==='persiangrammar')return {id:'grammar',category:'grammar',label:tr('Grammar','Грамматика'),tool:source==='sentences'?'sentences':source==='persiangrammar'?'persianGrammar':'grammar'};
      /* Legacy generic MCQs are intentionally not called grammar without source metadata. */
      return {id:'other',category:'other',label:tr('Other verified practice','Другая проверенная практика'),tool:''};
    }
    function weakTopics(){var grouped={};loadMistakes().forEach(function(item){var topic=mistakeTopic(item);if(!grouped[topic.id])grouped[topic.id]={id:topic.id,label:topic.label,tool:topic.tool,count:0};grouped[topic.id].count++;});return Object.keys(grouped).map(function(key){return grouped[key];}).sort(function(a,b){return b.count-a.count;}).slice(0,4);}
    function bumpProgress(toolId, xp) {
      const p = loadProgress();
      p[toolId] = (p[toolId] || 0) + 1;
      p.xp = (p.xp || 0) + xp;
      saveProgress(p);
    }

    function uid() { return ctx.user && ctx.user.id; }
    function sessionId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'web-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
    function loadPrefs() {
      try { return Object.assign({ sound:true, reducedMotion:false, largeText:false,practiceLang:'',practiceTarget:'',levels:{},reminders:false,reminderTime:'18:00' }, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); }
      catch (e) { return { sound:true, reducedMotion:false, largeText:false,practiceLang:'',practiceTarget:'',levels:{},reminders:false,reminderTime:'18:00' }; }
    }
    function savePrefs(next) {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      document.documentElement.classList.toggle('practice-reduced-motion', !!next.reducedMotion);
      document.documentElement.classList.toggle('practice-large-text', !!next.largeText);
    }
    function schedulePracticeReminder() {
      clearTimeout(window.__duvelaPracticeReminderTimer); var prefs=loadPrefs();
      if (!prefs.reminders || !window.Notification || Notification.permission !== 'granted') return;
      var parts=String(prefs.reminderTime||'18:00').split(':'), now=new Date(), next=new Date(); next.setHours(Number(parts[0])||18,Number(parts[1])||0,0,0); if(next<=now) next.setDate(next.getDate()+1);
      window.__duvelaPracticeReminderTimer=setTimeout(function () { new Notification(tr('Time to practice','Время практики'),{ body:tr('Complete your three short Duvela steps.','Выполните три коротких задания Duvela.'),icon:'./logo.webp' }); schedulePracticeReminder(); },Math.min(2147483647,next-now));
    }
    function feedback(ok, detail) {
      if (studyState) {
        studyState.answers = studyState.answers || [];
        studyState.answers.push(Object.assign({ ok:!!ok, step:Number(studyState.idx || 0), at:Date.now() },detail||{}));
        studyState.streak = ok ? Number(studyState.streak || 0) + 1 : 0;
        studyState.bestStreak = Math.max(Number(studyState.bestStreak || 0),studyState.streak);
        var grammarTopicExercise = studyState.tool === 'grammar' && !!studyState.grammarTopic;
        var spacedReviewExercise = studyState.tool === 'mistakes';
        if (!ok && !grammarTopicExercise && !spacedReviewExercise) studyState.lives = Math.max(0, Number(studyState.lives == null ? 3 : studyState.lives) - 1);
        var overlay = $('#studyOverlay'), lives = $('#practiceLives'), combo = $('#practiceCombo');
        if (overlay) { overlay.classList.remove('answer-correct','answer-wrong'); void overlay.offsetWidth; overlay.classList.add(ok ? 'answer-correct' : 'answer-wrong'); }
        if (lives) lives.textContent = '♥'.repeat(studyState.lives) + '♡'.repeat(3-studyState.lives);
        if (combo) combo.textContent = '🔥 ' + studyState.streak;
        var coach=$('#practiceCoach');
        if(coach && studyState.answers.length%5===0){coach.hidden=false;coach.innerHTML='<b>✓ '+esc(tr('Checkpoint','Контрольная точка'))+'</b><p>'+esc(studyState.answers.filter(function(answer){return answer.ok;}).length)+' / '+studyState.answers.length+' '+esc(tr('correct so far. Take a breath and continue.','правильно. Сделайте паузу и продолжайте.'))+'</p>';}
        if(!grammarTopicExercise&&!spacedReviewExercise&&studyState.lives===0&&!studyState.finished)setTimeout(function(){if(studyState&&!studyState.finished)finishTool(tr('No lives left','Жизни закончились'),Math.max(1,studyState.score*2));},500);
      }
      var prefs = loadPrefs();
      if (!prefs.sound || !window.AudioContext) return;
      try {
        var ac = new AudioContext(), osc = ac.createOscillator(), gain = ac.createGain();
        osc.frequency.value = ok ? 660 : 190; gain.gain.setValueAtTime(.045, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .14);
        osc.connect(gain); gain.connect(ac.destination); osc.start(); osc.stop(ac.currentTime + .15);
      } catch (e) { /* browser may block audio */ }
    }
    function persistResume() {
      if (!studyState || ['history','mistakes'].indexOf(studyState.tool) >= 0) return;
      var resume={ tool:studyState.tool,lang:studyState.lang,level:studyState.level||currentPracticeLevel(studyState.lang),idx:studyState.idx || 0,score:studyState.score || 0,clientSessionId:studyState.clientSessionId,startedAt:studyState.startedAt,at:Date.now() };
      if(studyState.tool==='writing')Object.assign(resume,{writingDraft:studyState.writingDraft||'',writingTaskId:studyState.data&&studyState.data.id||studyState.writingTaskId||'',checked:studyState.checked||{},writingVersions:studyState.writingVersions||[]});
      if(studyState.tool==='flashcards')Object.assign(resume,{flashData:studyState.data||[],flashStats:studyState.flashStats||{},flashFlipped:!!studyState.flashFlipped});
      try { localStorage.setItem(RESUME_KEY, JSON.stringify(resume)); if(uid()&&navigator.onLine)supa.from('practice_resume').upsert({user_id:uid(),tool_id:resume.tool,language:resume.lang,level:resume.level,current_step:resume.idx,score:resume.score,state:{startedAt:resume.startedAt,writingDraft:resume.writingDraft||'',writingTaskId:resume.writingTaskId||'',checked:resume.checked||{},writingVersions:resume.writingVersions||[],flashData:resume.flashData||[],flashStats:resume.flashStats||{},flashFlipped:!!resume.flashFlipped},client_session_id:resume.clientSessionId,updated_at:new Date().toISOString()}); }
      catch (e) { /* ignore */ }
    }
    function clearResume() { localStorage.removeItem(RESUME_KEY); if(uid()&&navigator.onLine)supa.from('practice_resume').delete().eq('user_id',uid()); }
    function readResume() {
      try { var value=JSON.parse(localStorage.getItem(RESUME_KEY)||'null');if(!value||Date.now()-value.at>=7*86400000)return null;value.level=normalizePracticeLevel(value.level,'A1');return value.lang===currentLang()&&value.level===currentPracticeLevel(value.lang)?value:null; }
      catch (e) { return null; }
    }
    async function syncPracticeData() {
      if (!uid() || !navigator.onLine) return;
      try {
        // Mistakes made on the web become their own rows; mistakes that came from the app
        // only get their review schedule updated, so the app's own fields stay intact.
        var localMistakes = loadMistakes();
        var mistakes = localMistakes.filter(function (m) { return !m.hubOrigin; }).map(mistakeRow);
        if (mistakes.length) await supa.from('practice_mistakes').upsert(mistakes, { onConflict:'user_id,item_key' });
        for (var mi = 0; mi < localMistakes.length; mi++) {
          var hubItem = localMistakes[mi];
          if (!hubItem.hubOrigin || !hubItem.remoteKey) continue;
          await supa.from('practice_mistakes').update({ review_step:Number(hubItem.reviewStep||0), due_at:new Date(hubItem.dueAt||Date.now()).toISOString(), review_due_at:hubItem.dueAt?new Date(hubItem.dueAt).toISOString():null, updated_at:new Date().toISOString() }).eq('user_id',uid()).eq('item_key',hubItem.remoteKey);
        }
        var words = loadSavedWords().map(function (w) { return { user_id:uid(),language:w.lang,word:w.w,translation:w.t,box:Number(w.box||1),ease:Number(w.ease||2.5),repetitions:Number(w.reps||0),due_at:w.dueAt||new Date().toISOString(),scheduler_version:w.scheduler||null,last_reviewed_at:w.lastReviewedAt||null,review_history:Array.isArray(w.history)?w.history:[],updated_at:new Date().toISOString() }; });
        if (words.length) await supa.from('practice_saved_words').upsert(words, { onConflict:'user_id,language,word' });
        var queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'), pending=[];
        for (var i=0;i<queue.length;i++) { try { var synced=await supa.rpc('complete_practice_session',queue[i]); if (synced.error) pending.push(queue[i]); } catch (e) { pending.push(queue[i]); } }
        localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(pending));
      } catch (e) { /* offline-first: retry next load */ }
    }
    function queueOfflineSession(payload) { try { var queue=JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)||'[]'); if(!queue.some(function(item){return item.p_client_session_id===payload.p_client_session_id;}))queue.push(payload);localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(queue.slice(-100))); } catch(e){} }
    function mergePracticeRows(localRows,serverRows,keyBuilder) {
      var merged=[],seen={};
      (Array.isArray(serverRows)?serverRows:[]).concat(Array.isArray(localRows)?localRows:[]).forEach(function(row){
        if(!row)return;
        var key=keyBuilder(row);
        if(seen[key])return;
        seen[key]=true;merged.push(row);
      });
      return merged;
    }
    async function hydratePracticeData() {
      if (!uid() || !navigator.onLine || practiceHydrated) return;
      practiceHydrated=true;practiceSyncState='syncing';
      try {
        var results = await Promise.all([
          supa.from('practice_progress').select('tool_id,sessions,xp,best_score,correct,attempted').eq('user_id',uid()),
          supa.from('practice_mistakes').select('item_key,source,target,level,title,prompt,answer_given,correct_answer,explanation,attempts,details,review_step,due_at,updated_at').eq('user_id',uid()),
          supa.from('practice_saved_words').select('language,word,translation,box,ease,repetitions,due_at,scheduler_version,last_reviewed_at,review_history').eq('user_id',uid()),
          supa.from('practice_streaks').select('current_streak,longest_streak,today_sessions,daily_goal').eq('user_id',uid()).maybeSingle(),
          supa.from('practice_sessions').select('tool_id,language,score,total,xp_awarded,completed_at,duration_seconds').eq('user_id',uid()).eq('status','completed').order('completed_at',{ ascending:false }).limit(90),
          supa.from('practice_achievements').select('achievement_id,unlocked_at,metadata').eq('user_id',uid()).order('unlocked_at',{ ascending:false }),
          supa.from('practice_subscriptions').select('status,current_period_end').eq('user_id',uid()).eq('status','active').maybeSingle(),
          supa.from('practice_language_settings').select('language,level,active').eq('user_id',uid()),
          supa.from('practice_resume').select('tool_id,language,level,current_step,score,state,client_session_id,updated_at').eq('user_id',uid()).maybeSingle(),
          supa.from('practice_exam_goals').select('exam_type,exam_date,days_per_week,minutes_per_day,updated_at').eq('user_id',uid()).maybeSingle(),
          supa.from('learner_language_profiles').select('language,current_level,goal_level,is_active,practice_progress,score').eq('user_id',uid()),
          supa.from('adaptive_learning_plans').select('plan_date,language,current_level,target_level,plan_version,signal,route,status,updated_at').eq('user_id',uid()).eq('plan_date',new Date().toISOString().slice(0,10)).order('updated_at',{ascending:false}).limit(1).maybeSingle()
        ]);
        var progress = loadProgress();
        (results[0].data || []).forEach(function (row) { progress[row.tool_id] = Math.max(Number(progress[row.tool_id] || 0),Number(row.sessions || 0)); });
        progress.serverXp = (results[0].data || []).reduce(function (sum,row) { return sum + Number(row.xp || 0); },0);
        progress.xp = Math.max(Number(progress.xp || 0),progress.serverXp); progress.streak = results[3].data || progress.streak || null;
        progress.sessions = mergePracticeRows(progress.sessions,results[4].data,function(row){return [row.tool_id,row.completed_at,row.score,row.total].join('|');}).slice(0,180);
        progress.achievements = mergePracticeRows(progress.achievements,results[5].data,function(row){return row.achievement_id||row.id||JSON.stringify(row);});
        if(!results[6].error)practicePremium = !!(results[6].data && results[6].data.status === 'active');
        progress.premiumActive=practicePremium;
        practiceSyncState=results.some(function(result){return result&&result.error;})?'error':'ready';
        saveProgress(progress);
        if ((results[7].data || []).length) { var prefs=loadPrefs();prefs.levels=prefs.levels||{};(results[7].data||[]).forEach(function(row){prefs.levels[row.language]=row.level;if(row.active)prefs.practiceLang=row.language;});savePrefs(prefs); }
        if (results[8].data) { var cloud=results[8].data,local=readResume(),cloudAt=new Date(cloud.updated_at||0).getTime(),cloudLevel=normalizePracticeLevel(cloud.level,'A1'),cloudState=cloud.state||{};if(cloud.language===currentLang()&&cloudLevel===currentPracticeLevel(cloud.language)&&(!local||cloudAt>Number(local.at||0)))localStorage.setItem(RESUME_KEY,JSON.stringify({tool:cloud.tool_id,lang:cloud.language,level:cloudLevel,idx:cloud.current_step||0,score:cloud.score||0,clientSessionId:cloud.client_session_id,startedAt:cloudState.startedAt||Date.now(),writingDraft:cloudState.writingDraft||'',writingTaskId:cloudState.writingTaskId||'',checked:cloudState.checked||{},writingVersions:cloudState.writingVersions||[],flashData:cloudState.flashData||[],flashStats:cloudState.flashStats||{},flashFlipped:!!cloudState.flashFlipped,at:cloudAt})); }
        if(results[9]&&results[9].data){var exam=results[9].data;localStorage.setItem(EXAM_GOAL_KEY,JSON.stringify({exam:exam.exam_type,date:exam.exam_date,daysPerWeek:exam.days_per_week,minutes:exam.minutes_per_day}));}
        if(results[10]&&(results[10].data||[]).length){var languagePrefs=loadPrefs();languagePrefs.levels=languagePrefs.levels||{};languagePrefs.goalLevels=languagePrefs.goalLevels||{};(results[10].data||[]).forEach(function(row){var target=normalizePracticeTarget(row.language);if(!target)return;languagePrefs.levels[target]=String(row.current_level||'A1').toUpperCase();if(row.goal_level)languagePrefs.goalLevels[target]=STUDENT_GOAL.normalize(row.goal_level,languagePrefs.levels[target]||'A1');if(row.is_active){languagePrefs.practiceTarget=target;languagePrefs.practiceLang=target;if(ctx.profile&&row.goal_level)ctx.profile.goal_level=STUDENT_GOAL.normalize(row.goal_level,ctx.profile.goal_level||'A1');}});savePrefs(languagePrefs);}
        if(results[11]&&results[11].data){var cloudPlan=results[11].data,localPlan=loadAdaptivePlan(),cloudUpdated=new Date(cloudPlan.updated_at||0).getTime(),localUpdated=Number(localPlan&&localPlan.updatedAt||0),route=cloudPlan.route||{};if(!localPlan||cloudUpdated>localUpdated)localStorage.setItem(ADAPTIVE_PLAN_KEY,JSON.stringify({version:Number(cloudPlan.plan_version||1),learnerId:uid(),date:cloudPlan.plan_date,lang:cloudPlan.language,level:cloudPlan.current_level,targetLevel:cloudPlan.target_level,signal:cloudPlan.signal||'',steps:Array.isArray(route.steps)?route.steps:[],stats:route.stats||{},weakTopic:route.weakTopic||null,updatedAt:cloudUpdated,createdAt:cloudUpdated}));}
        if ((results[1].data || []).length) {
          // Server rows first; local mistakes that have not been uploaded yet are kept.
          var serverMistakes = results[1].data.map(mistakeFromRow).filter(Boolean);
          var serverKeys = {};
          serverMistakes.forEach(function (item) { serverKeys[mistakeKey(item)] = true; });
          saveMistakes(serverMistakes.concat(loadMistakes().filter(function (item) { return !serverKeys[mistakeKey(item)]; })));
        }
        if ((results[2].data || []).length) { var localWords=loadSavedWords(), localByKey={};localWords.forEach(function(word){localByKey[word.lang+'|'+word.w]=word;});localStorage.setItem(SAVED_WORDS_KEY,JSON.stringify(results[2].data.map(function (row) { var local=localByKey[row.language+'|'+row.word]||{};return Object.assign({},local,{ lang:row.language,w:row.word,t:row.translation,box:row.box,ease:row.ease,reps:row.repetitions,dueAt:row.due_at,scheduler:row.scheduler_version||local.scheduler,lastReviewedAt:row.last_reviewed_at||local.lastReviewedAt,history:Array.isArray(row.review_history)&&row.review_history.length?row.review_history:local.history }); })) ); }
        if(ctx.renderWorkspace)ctx.renderWorkspace();
      } catch (e) { practiceSyncState='error';if(ctx.renderWorkspace)ctx.renderWorkspace(); }
    }
    async function loadMobileBanks() {
      try {
        var response = await fetch('./web/content/listening-lab-bank.json');
        if (!response.ok) return;
        var bank = await response.json();
        var clipsById = {};
        (bank.clips || []).forEach(function (clip) { clipsById[clip.id] = clip; });
        (bank.tasks || []).forEach(function (task) {
          var lang = task.target === 'german' ? 'de' : task.target === 'spanish' ? 'es' : 'en';
          var text = task.speechText || task.transcript;
          task._webLevel=normalizePracticeLevel(task.level,'A1');
          task._webAudioClip = task.audioClipId ? clipsById[task.audioClipId] || null : null;
          if (text && !(LISTEN[lang] || []).some(function (item) { return item.text === text; })) (LISTEN[lang] || LISTEN.de).push({
            text:text,
            hint:String(task.level || '').toUpperCase() + ' · ' + (task.prompt || ''),
            audioClip:task._webAudioClip,
            id:task.id,
            mode:task.mode || 'dictation',
            prompt:task.prompt || '',
            answer:task.answer || text,
            options:Array.isArray(task.options) ? task.options.slice() : []
          });
        });
        Object.keys(LISTEN).forEach(function(code){
          (LISTEN[code]||[]).forEach(function(item){
            var source=(bank.tasks||[]).find(function(task){return (task.speechText||task.transcript)===item.text;});
            if(source){
              item.level=source._webLevel;
              item.audioClip=source._webAudioClip;
              item.id=source.id;
              item.mode=source.mode || item.mode || 'dictation';
              item.prompt=source.prompt || item.prompt || '';
              item.answer=source.answer || item.answer || item.text;
              item.options=Array.isArray(source.options) ? source.options.slice() : (item.options || []);
            }
          });
        });
      } catch (e) { /* bundled starter bank remains available */ }
    }

    function readingTarget(code) {
      return ({ de:'german', en:'english', es:'spanish', sv:'swedish' })[normalizePracticeTarget(code)] || normalizePracticeTarget(code);
    }
    function readingTaskIsValid(task) {
      return !!(task && task.id && task.target && normalizePracticeLevel(task.level,'') && task.title && task.text &&
        String(task.category || 'reading').toLowerCase() === 'reading' &&
        ['published','active'].indexOf(String(task.status || 'published').toLowerCase()) >= 0 &&
        Array.isArray(task.questions) && task.questions.length && task.questions.every(function(question){
          return question && question.id && question.prompt && question.answer && Array.isArray(question.options) &&
            question.options.length >= 2 && question.options.indexOf(question.answer) >= 0;
        }));
    }
    async function loadReadingBank(force) {
      if (!force && readingBankState.status === 'ready') return readingBankState;
      if (!force && readingBankState.status === 'loading') return readingBankState.promise;
      readingBankState = { status:'loading',tasks:[],counts:{},error:null,promise:null };
      var embedded=window.DuvelaReadingLabBank;
      var source=embedded&&(!force||location.protocol==='file:')?Promise.resolve(embedded):fetch('./web/content/reading-lab-bank.json', { cache:force?'reload':'default' }).then(function(response){
        if (!response.ok) throw new Error('Reading bank HTTP ' + response.status);
        return response.json();
      });
      readingBankState.promise = source.then(function(bank){
        var raw=Array.isArray(bank)?bank:(bank.tasks||[]),invalid=raw.filter(function(task){return !readingTaskIsValid(task);});
        if(invalid.length)throw new Error('Reading bank contains '+invalid.length+' invalid tasks');
        var counts={};raw.forEach(function(task){var target=String(task.target).toLowerCase(),level=normalizePracticeLevel(task.level,'');counts[target]=counts[target]||{};counts[target][level]=(counts[target][level]||0)+1;});
        readingBankState={status:'ready',tasks:raw,counts:counts,error:null,promise:null};
        return readingBankState;
      }).catch(function(error){
        readingBankState={status:'error',tasks:[],counts:{},error:error,promise:null};
        return readingBankState;
      });
      return readingBankState.promise;
    }
    function exactReadingTasks(lang,level) {
      var target=readingTarget(lang),wanted=normalizePracticeLevel(level,'');
      return readingBankState.tasks.filter(function(task){return String(task.target).toLowerCase()===target && normalizePracticeLevel(task.level,'')===wanted;});
    }

    function loadMistakes() {
      try { return JSON.parse(localStorage.getItem(MISTAKE_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveMistakes(list) {
      try { localStorage.setItem(MISTAKE_KEY, JSON.stringify(list.slice(-60))); } catch (e) { /* ignore */ }
    }
    function mistakeKey(item) { return item && (item.key || item.lang+'|'+(item.questionId||item.prompt)); }

    // practice_mistakes is shared with the Hub app: item_key, source (exam, grammar,
    // listening, reading, writing), target (german, english, …), prompt, answers and
    // explanation, plus the web's options and history in details.
    var MISTAKE_TARGETS = { de:'german', en:'english', es:'spanish', fa:'persian' };
    var MISTAKE_LANGS = { german:'de', english:'en', spanish:'es', persian:'fa' };
    function mistakeRow(m) {
      var tool = String(m.sourceTool || m.kind || 'mcq');
      var opts = Array.isArray(m.opts) ? m.opts : [];
      var selected = typeof m.selectedAnswer === 'number' ? opts[m.selectedAnswer] : m.selectedAnswer;
      var dueAt = m.dueAt ? new Date(m.dueAt).toISOString() : null;
      return {
        user_id: uid(),
        item_key: m.remoteKey || 'web:' + mistakeKey(m),
        source: ['listening','reading','writing','exam'].indexOf(tool.toLowerCase()) >= 0 ? tool.toLowerCase() : 'grammar',
        target: MISTAKE_TARGETS[m.lang] || m.lang,
        level: String(m.level || currentPracticeLevel(m.lang) || 'A1').toUpperCase(),
        title: mistakeTopic(m).label,
        topic_id: mistakeTopic(m).id,
        prompt: String(m.prompt || ''),
        answer_given: selected == null ? '' : String(selected),
        correct_answer: opts[m.a] == null ? '' : String(opts[m.a]),
        explanation: String(m.explanation || ''),
        attempts: Math.max(1, Number(m.attemptsIncorrect || 1)),
        review_step: Number(m.reviewStep || 0),
        review_due_at: dueAt,
        due_at: dueAt || new Date().toISOString(),
        details: { web:true, key:mistakeKey(m), lang:m.lang, options:opts, correctIndex:m.a, tool:tool, kind:m.kind || 'mcq', questionId:m.questionId || '', selectedAnswer:m.selectedAnswer, audioClip:m.audioClip || null, audioText:m.audioText || '', history:Array.isArray(m.history) ? m.history.slice(-30) : [] },
        updated_at: new Date(m.at || Date.now()).toISOString()
      };
    }
    function mistakeFromRow(row) {
      var details = row.details || {};
      var common = { remoteKey:row.item_key, level:row.level || '', explanation:row.explanation || '', attemptsIncorrect:Number(row.attempts || 1), reviewStep:Number(row.review_step || 0), dueAt:row.due_at ? new Date(row.due_at).getTime() : Date.now(), at:new Date(row.updated_at || Date.now()).getTime() };
      if (details.web) {
        return Object.assign(common, { key:details.key, lang:details.lang, prompt:row.prompt, opts:Array.isArray(details.options) ? details.options : [], a:details.correctIndex, kind:details.kind || 'mcq', sourceTool:details.tool || row.source, questionId:details.questionId || '', selectedAnswer:details.selectedAnswer, audioClip:details.audioClip || null, audioText:details.audioText || '', history:Array.isArray(details.history) ? details.history : [] });
      }
      // A mistake recorded in the app: review it here as "the right answer or the one you gave".
      var lang = MISTAKE_LANGS[row.target];
      var correct = String(row.correct_answer || '');
      if (!lang || !correct) return null;
      var given = String(row.answer_given || '');
      var opts = given && given !== correct ? [correct, given] : [correct];
      if (opts.length > 1 && String(row.item_key).length % 2) opts.reverse();
      return Object.assign(common, { key:'hub|' + row.item_key, hubOrigin:true, lang:lang, prompt:row.prompt || row.title || '', opts:opts, a:opts.indexOf(correct), kind:row.source, sourceTool:row.source, questionId:row.item_key, selectedAnswer:given, history:[] });
    }
    function logMistake(lang, prompt, opts, correctIdx, kind, details) {
      var now=Date.now(), meta=details||{}, key=lang+'|'+(meta.questionId||prompt), old=loadMistakes(), previous=old.find(function(m){return mistakeKey(m)===key;}), history=(previous&&Array.isArray(previous.history)?previous.history:[]).concat([{at:now,outcome:'incorrect',selectedAnswer:meta.selectedAnswer}]).slice(-30);
      var item={key:key,lang:lang,prompt:prompt,opts:opts,a:correctIdx,kind:kind||'mcq',sourceTool:meta.sourceTool||kind||'mcq',questionId:meta.questionId||'',level:meta.level||currentPracticeLevel(lang),explanation:meta.explanation||'',selectedAnswer:meta.selectedAnswer,audioClip:meta.audioClip||null,audioText:meta.audioText||'',attemptsIncorrect:Number(previous&&previous.attemptsIncorrect||0)+1,lastAttemptAt:now,at:now,reviewStep:0,dueAt:now+86400000,history:history};
      saveMistakes(old.filter(function(m){return mistakeKey(m)!==key;}).concat([item]));
      return item;
    }
    function clearMistake(lang, prompt) {
      var now=Date.now(),target=lang+'|'+prompt,list=loadMistakes().map(function(m){
        if(mistakeKey(m)!==target && (m.lang+'|'+m.prompt)!==target)return m;
        var next=Number(m.reviewStep||0)+1,history=(Array.isArray(m.history)?m.history:[]).concat([{at:now,outcome:'correct'}]).slice(-30);
        return Object.assign({},m,{reviewStep:next,dueAt:next>3?null:now+[1,3,7,14][next]*86400000,lastAttemptAt:now,history:history,mastered:next>3});
      });
      if (uid() && navigator.onLine) {
        list.filter(function (m) { return m.mastered; }).forEach(function (m) {
          supa.from('practice_mistakes').delete().eq('user_id', uid()).eq('item_key', m.remoteKey || 'web:' + mistakeKey(m)).then(function () {}, function () {});
        });
      }
      saveMistakes(list.filter(function(m){return !m.mastered;}));
    }

    function loadSavedWords() {
      try { return JSON.parse(localStorage.getItem(SAVED_WORDS_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveSavedWords(list) {
      try { localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(list)); } catch (e) { /* offline cache is best effort */ }
    }
    function ensureSavedWord(lang, word, translation) {
      var list=loadSavedWords(), key=lang+'|'+word, existing=list.find(function(item){return item.lang+'|'+item.w===key;});
      if(existing) return existing;
      var created={lang:lang,w:word,t:translation,box:1,ease:2.5,reps:0,lapses:0,stability:1,dueAt:new Date().toISOString(),scheduler:FLASHCARD_SCHEDULER_VERSION};
      list.push(created);saveSavedWords(list);return created;
    }
    function flashcardDueAt(card, grade) {
      var now=Date.now(), previous=Math.max(1,Number(card.stability||card.box||1)), next;
      if(grade==='again')next=10/1440;
      else if(grade==='hard')next=Math.max(1,Math.round(previous*1.35));
      else if(grade==='good')next=Math.max(3,Math.round(previous*2));
      else next=Math.max(7,Math.round(previous*3));
      return { days:Math.min(180,next), dueAt:new Date(now+Math.min(180,next)*86400000).toISOString() };
    }
    function recordFlashcardReview(card, grade) {
      var list=loadSavedWords(), key=card.lang+'|'+card.w, index=list.findIndex(function(item){return item.lang+'|'+item.w===key;}), saved=index>=0?list[index]:ensureSavedWord(card.lang,card.w,card.t);
      if(index<0){list=loadSavedWords();index=list.findIndex(function(item){return item.lang+'|'+item.w===key;});saved=list[index];}
      var schedule=flashcardDueAt(saved,grade), history=Array.isArray(saved.history)?saved.history:[];
      saved.box=grade==='again'?1:Math.min(5,Math.max(1,Number(saved.box||1)+(grade==='easy'?2:1)));
      saved.ease=Math.max(1.3,Math.min(3.2,Number(saved.ease||2.5)+({again:-.2,hard:-.1,good:0,easy:.15}[grade]||0)));
      saved.reps=Number(saved.reps||0)+1;saved.lapses=Number(saved.lapses||0)+(grade==='again'?1:0);saved.stability=schedule.days;saved.lastGrade=grade;saved.lastReviewedAt=new Date().toISOString();saved.dueAt=schedule.dueAt;saved.scheduler=FLASHCARD_SCHEDULER_VERSION;
      saved.history=history.concat([{at:saved.lastReviewedAt,grade:grade,dueAt:saved.dueAt}]).slice(-30);
      list[index]=saved;saveSavedWords(list);syncPracticeData();return saved;
    }
    function toggleSavedWord(lang, word, translation) {
      var list = loadSavedWords();
      var key = lang + '|' + word;
      var idx = list.findIndex(function (item) { return (item.lang + '|' + item.w) === key; });
      if (idx >= 0) list.splice(idx, 1);
      else list.push({ lang: lang, w: word, t: translation });
      saveSavedWords(list);
      return idx < 0;
    }
    function isWordSaved(lang, word) {
      return loadSavedWords().some(function (item) { return item.lang === lang && item.w === word; });
    }

    async function awardXp(amount) {
      if (!amount || !ctx.user) return;
      try {
        const current = ctx.profile && typeof ctx.profile.score === 'number' ? ctx.profile.score : 0;
        const next = current + amount;
        const { error } = await supa.from('profiles').update({ score: next }).eq('id', ctx.user.id);
        if (!error && ctx.profile) ctx.setProfile(Object.assign({}, ctx.profile, { score: next }));
      } catch (e) { /* XP is best-effort */ }
    }

    function currentLang() {
      const prefs = loadPrefs();
      const preferred = prefs.practiceTarget || prefs.practiceLang;
      if (preferred) return preferred;
      const targets = learnerPracticeTargets(prefs).targets;
      if (targets.length) return targets[0];
      return studyState && studyState.lang ? studyState.lang : 'de';
    }

    function normalizePracticeLevel(value, fallback) {
      var match=String(value||'').trim().toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
      return match?match[1]:(fallback||'A1');
    }
    function currentPracticeLevel(lang) {
      var prefs=loadPrefs(),code=lang||currentLang();
      return normalizePracticeLevel((prefs.levels||{})[code]||(ctx.profile&&ctx.profile.language_level),'A1');
    }
    function exactLevelItems(items, level) {
      var list=Array.isArray(items)?items:[],wanted=normalizePracticeLevel(level,'A1'),split=Math.ceil(list.length/2);
      return list.map(function(item,index){
        return item&&item.level?item:Object.assign({},item,{level:index<split?'A1':'A2'});
      }).filter(function(item){return normalizePracticeLevel(item.level,'A1')===wanted;});
    }
    function strictBank(bank, lang, level) {
      return exactLevelItems((bank&&bank[lang])||[],level);
    }
    function noLevelContent() {
      var host=$('#studyToolBody');
      if(!host)return;
      host.innerHTML='<div class="empty"><h3>'+esc(tr('No tasks for this exact level yet','Для этого точного уровня заданий пока нет'))+'</h3><p>'+esc(tr('We did not replace them with easier or harder tasks.','Мы не подменяем их заданиями проще или сложнее.'))+'</p><strong>'+esc(String(studyState.lang||'').toUpperCase()+' · '+studyState.level)+'</strong></div>';
    }

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }

    function langPicker() {
      const cur = currentLang();
      const targets = learnerPracticeTargets(loadPrefs()).targets.filter(isSupportedLanguageTarget);
      const options = targets.length ? targets : SUPPORTED_LANGUAGE_TARGETS;
      const opt = (code) => '<option value="' + code + '"' + (code === cur ? ' selected' : '') + '>' + esc(targetLabel(code)) + '</option>';
      return '<label class="practice-language-select"><span>' + esc(tr('Practice language', 'Язык тренировки')) + '</span><select id="studyLang" class="role-select">' +
        options.map(opt).join('') +
        '</select></label>';
    }

    function buildAdaptiveDailyPlan(progress, prefs, goal) {
      var readiness=skillReadiness(progress), mistakes=loadMistakes(), due=mistakes.filter(function(item){return !item.dueAt||item.dueAt<=Date.now();});
      var minutes=Math.max(10,Number(goal&&goal.minutes||20)), count=minutes>=45?4:minutes>=20?3:2;
      var skills=['grammar','vocabulary','reading','listening','writing','speaking'];
      var skillTool={grammar:'grammar',vocabulary:'flashcards',reading:'reading',listening:'listening',writing:'writing',speaking:'speaking'};
      var skillTitle={
        grammar:tr('Repair a grammar gap','Закрыть пробел в грамматике'),vocabulary:tr('Warm-up words','Разминка со словами'),
        reading:tr('Read for meaning','Чтение на понимание'),listening:tr('Train your ear','Тренировка аудирования'),
        writing:tr('Write with feedback','Письмо с обратной связью'),speaking:tr('Speak with AI feedback','Говорение с AI-проверкой')
      };
      var ordered=skills.slice().sort(function(a,b){return Number(readiness[a]||0)-Number(readiness[b]||0);}), plan=[];
      if(due.length)plan.push({tool:'mistakes',title:tr('Review due mistakes','Повторить ошибки по графику'),meta:Math.min(10,due.length)+' '+tr('cards due','карточек на сегодня'),reason:tr('Spaced repetition is due today','Сегодня срок интервального повторения')});
      ordered.forEach(function(skill){
        if(plan.length>=count||plan.some(function(item){return item.tool===skillTool[skill];}))return;
        var score=Number(readiness[skill]||0);
        plan.push({tool:skillTool[skill],title:skillTitle[skill],meta:(plan.length?7:5)+' min · '+skill,reason:score<45?tr('Your lowest readiness skill','Сейчас это самый слабый навык'):tr('Keeps this skill balanced','Поддерживает баланс навыков')});
      });
      if(examDaysLeft(goal)!==null&&examDaysLeft(goal)<=21&&plan.length<count&&!plan.some(function(item){return item.tool==='exam';})) {
        plan.push({tool:'exam',title:tr('Exam checkpoint','Экзаменационная проверка'),meta:'10 min · '+String(goal.exam||'exam').toUpperCase(),reason:tr('Your exam date is getting closer','Дата экзамена приближается')});
      }
      return plan.slice(0,count);
    }

    function targetSlug(value) {
      return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '');
    }
    function normalizePracticeTarget(value) {
      var key = targetSlug(value);
      if (!key) return null;
      var compact = key.replace(/-/g, '');
      var aliases = Object.assign({ chess:'chess', math:'math', mathematics:'math', математик:'math', математика:'math' }, LANGUAGE_TARGET_ALIASES);
      return aliases[key] || aliases[compact] || aliases[key.split('-')[0]] || key;
    }
    function isSupportedLanguageTarget(target) {
      return SUPPORTED_LANGUAGE_TARGETS.indexOf(target) >= 0;
    }
    function isLanguageTarget(target) {
      return !!LANGUAGE_TARGET_LABELS[target] || isSupportedLanguageTarget(target);
    }
    function addPracticeTarget(targets, levels, labels, rawValue, level) {
      var target = normalizePracticeTarget(rawValue);
      if (!target || targets.indexOf(target) >= 0) return;
      targets.push(target);
      if (level) levels[target] = normalizePracticeLevel(level, 'A1');
      labels[target] = labels[target] || academyDirectionLabel(rawValue, target);
    }
    function learnerPracticeTargets(prefs) {
      var profile = ctx.profile || {};
      var targets = [], levels = Object.assign({}, prefs.levels || {}), labels = {}, learningTargets = profile.learning_targets;
      if (Array.isArray(learningTargets)) learningTargets.forEach(function(item){
        if (!item || typeof item !== 'object') return;
        var itemLevel = item.level || profile.language_level || 'A1';
        if (item.levels && typeof item.levels === 'object') Object.keys(item.levels).forEach(function(language){
          addPracticeTarget(targets, levels, labels, language, item.levels[language] || itemLevel);
        });
        if (Array.isArray(item.languages)) item.languages.forEach(function(language){
          addPracticeTarget(targets, levels, labels, language, (item.levels && item.levels[language]) || itemLevel);
        });
        if (item.language) addPracticeTarget(targets, levels, labels, item.language, item.level || itemLevel);
        if (Array.isArray(item.subcategories)) item.subcategories.forEach(function(subject){
          addPracticeTarget(targets, levels, labels, subject, item.level || itemLevel);
        });
      });
      if (Array.isArray(profile.learning_languages)) profile.learning_languages.forEach(function(language){
        addPracticeTarget(targets, levels, labels, language, profile.language_level || 'A1');
      });
      if (!targets.length && prefs.practiceTarget) {
        addPracticeTarget(targets, levels, labels, prefs.practiceTarget, (prefs.levels || {})[prefs.practiceTarget] || profile.language_level || 'A1');
      }
      targets.forEach(function(target){ if (!levels[target]) levels[target] = normalizePracticeLevel(profile.language_level, 'A1'); });
      return {targets:targets,levels:levels,labels:labels};
    }
    function academyDirectionLabel(rawValue, target) {
      var data = window.DuvelaOnboardingData || {};
      var wanted = target || normalizePracticeTarget(rawValue);
      var languages = Array.isArray(data.LANGUAGES) ? data.LANGUAGES : [];
      for (var i = 0; i < languages.length; i++) if (normalizePracticeTarget(languages[i]) === wanted) return languages[i];
      var categories = Array.isArray(data.CATEGORIES) ? data.CATEGORIES : [];
      for (var j = 0; j < categories.length; j++) if (normalizePracticeTarget(categories[j].id || categories[j].label) === wanted) return categories[j].label || categories[j].id;
      var subs = data.SUBCATEGORIES || {};
      var keys = Object.keys(subs);
      for (var k = 0; k < keys.length; k++) {
        var rows = Array.isArray(subs[keys[k]]) ? subs[keys[k]] : [];
        for (var m = 0; m < rows.length; m++) if (normalizePracticeTarget(rows[m]) === wanted) return rows[m];
      }
      return LANGUAGE_TARGET_LABELS[wanted] || String(rawValue || wanted || '').replace(/-/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    }
    function targetLabel(target) {
      return academyDirectionLabel(target, target);
    }
    function targetIcon(target) {
      if (isLanguageTarget(target)) return '🌐';
      return SUBJECT_TARGET_ICONS[target] || '🎯';
    }
    var PERSIAN_TOOLS = ['persianAlphabet','persianReading','persianListening','persianNumbers','persianGrammar','persianWordCards'];
    function toolsForTarget(target) {
      if (target === 'chess') return TOOLS.filter(function(tool){return tool.id === 'chess';});
      if (target === 'fa') {
        var persianTools = ['ai','liveTeacher','persianAlphabet','persianReading','persianListening','persianNumbers','persianGrammar','persianWordCards','dictionary','history','calendar','achievements','ranking','settings'];
        return TOOLS.filter(function(tool){ return persianTools.indexOf(tool.id) >= 0; });
      }
      if (!isSupportedLanguageTarget(target)) {
        var subjectTools = ['ai','liveTeacher','dictionary','history','calendar','achievements','ranking','settings'];
        return TOOLS.filter(function(tool){ return subjectTools.indexOf(tool.id) >= 0; });
      }
      var germanOnly = ['articles','wquestion','perfekt','germanAlphabet'];
      return TOOLS.filter(function(tool){return tool.id !== 'chess' && PERSIAN_TOOLS.indexOf(tool.id) < 0 && (target === 'de' || germanOnly.indexOf(tool.id) < 0);});
    }

    // ---- public: tools grid in learner workspace ----
    function studyToolsHtml() {
      const p = loadProgress();
      const prefs = loadPrefs();
      const done = (p.xp || 0);
      const completed = TOOLS.filter(function (tool) { return p[tool.id]; }).length;
      const goal = Math.max(100, Math.ceil((done + 1) / 100) * 100);
      const percent = Math.min(100, Math.round(done / goal * 100));
      const rank = done >= 2000 ? tr('Master','Мастер') : done >= 500 ? tr('Explorer','Исследователь') : done >= 100 ? tr('Rising learner','Растущий ученик') : tr('Starter','Новичок');
      const streak = p.streak && Number(p.streak.current_streak || 0);
      const premiumActive = PREMIUM_TEST_MODE || practicePremium || !!p.premiumActive || !!(ctx.profile && (ctx.profile.is_premium || ctx.profile.premium));
      const readiness=skillReadiness(p),weak=weakTopics(),examGoal=loadExamGoal(),daysLeft=examDaysLeft(examGoal);
      var dailyPlan=buildAdaptiveDailyPlan(p,prefs,examGoal);
      const targetData=learnerPracticeTargets(prefs);
      const activeTarget=targetData.targets.indexOf(prefs.practiceTarget)>=0?prefs.practiceTarget:targetData.targets[0];
      if(!activeTarget) {
        return '<section class="mobile-practice-hub practice-no-target"><div class="practice-home-hero"><div><small>'+esc(tr('PRACTICE','ПРАКТИКА'))+'</small><h2>'+esc(tr('Choose what you study first','Сначала выберите, что вы изучаете'))+'</h2><p>'+esc(tr('Practice is strict: it only shows the directions saved in your learner profile.','Практика работает строго: показывает только направления из профиля ученика.'))+'</p></div><a class="btn primary" href="#profile" data-go="profile">'+esc(tr('Open profile','Открыть профиль'))+'</a></div></section>';
      }
      prefs.levels=Object.assign({},prefs.levels||{},targetData.levels);prefs.practiceTarget=activeTarget;if(isLanguageTarget(activeTarget))prefs.practiceLang=activeTarget;
      savePrefs(prefs);
      const targetTools=toolsForTarget(activeTarget);
      const activeLabel=targetData.labels[activeTarget]||targetLabel(activeTarget),activeLevel=targetData.levels[activeTarget]||prefs.levels[activeTarget]||ctx.profile&&ctx.profile.language_level||'A1';
      const fullLanguagePractice=isSupportedLanguageTarget(activeTarget),languageTarget=isLanguageTarget(activeTarget);
      const targetCompleted=targetTools.filter(function(tool){return p[tool.id];}).length;
      if(activeTarget==='fa') {
        dailyPlan=[
          {tool:'persianAlphabet',title:tr('Persian alphabet','Персидский алфавит'),meta:activeLabel+' · '+activeLevel,reason:tr('Letters, shapes and sounds','Буквы, формы и звуки')},
          {tool:'persianReading',title:tr('Reading & letters','Чтение и буквы'),meta:activeLabel,reason:tr('Read real words','Читайте настоящие слова')},
          {tool:'ai',title:tr('Practise with GRAMMI and NOVA','Практика с GRAMMI и NOVA'),meta:activeLabel,reason:tr('Grammar and pronunciation in Persian','Грамматика и произношение на персидском')}
        ];
      } else if(!fullLanguagePractice&&activeTarget!=='chess') {
        dailyPlan=[
          {tool:'liveTeacher',title:tr('Practice with a teacher','Практика с преподавателем'),meta:activeLabel+' · '+activeLevel,reason:tr('Best for this direction now','Лучший вариант для этого направления сейчас')},
          {tool:'ai',title:tr('Ask Duvela AI coach','Спросить AI-тренера Duvela'),meta:activeLabel,reason:tr('Get explanations and examples','Получить объяснения и примеры')},
          {tool:'dictionary',title:tr('Save key terms','Сохранить важные термины'),meta:tr('Personal notebook','Личный словарь'),reason:tr('Build your own practice base','Соберите свою базу практики')}
        ];
      }
      function levelIndex(level){return Math.max(0,['A1','A2','B1','B2','C1','C2'].indexOf(String(level||'A1').toUpperCase()));}
      function sourceCard(id,webTool,icon,premium,title,meta,desc,action,db){
        return {id:id,webTool:webTool||id,icon:icon,premium:!!premium,db:!!db,title:title,meta:meta,desc:desc,action:action};
      }
      var mobileTarget=activeTarget==='en'?'english':activeTarget==='es'?'spanish':'german';
      var targetName=activeTarget==='en'?'English':activeTarget==='es'?'Spanish':'German';
      var grammarCard=activeTarget==='en'
        ? sourceCard('grammar','grammar','edit',false,'English Grammar Academy','9-level grammar path','Practise the full A1-C2 English grammar system: tenses, voice, modals, clauses, pronouns, and more.','Continue')
        : activeTarget==='es'
          ? sourceCard('grammar','grammar','edit',false,'Spanish Grammar','Spanish grammar','Choose the correct Spanish verb form, article, preposition, or sentence structure.','Continue')
          : sourceCard('grammar','grammar','edit',false,'Grammatik aktiv','A1-B1 grammar academy','A1-B1 German grammar roadmap with native-language explanations and focused exercises.','Continue');
      var examCard=activeTarget==='en'
        ? sourceCard('exam','exam','flask',true,'English Exam Mode','IELTS / speaking / writing','Practice English exam-style questions with a timer, choices, and scoring.','Continue')
        : activeTarget==='es'
          ? sourceCard('exam','exam','flask',true,'Spanish Exam Mode','DELE-style practice','Practice Spanish exam-style grammar and communication questions with scoring.','Continue')
          : sourceCard('exam','exam','flask',true,'Exam Mode','Goethe / telc / DTZ / TestDaF','Exam-style practice for Goethe, telc, or TestDaF with a timer, questions, and scoring.','Open exam mode');
      var essentialsCard=activeTarget==='en'
        ? sourceCard('englishEssentials','essentials','tools',true,'English Trainer','English core skills','Train tenses, articles, word order, conditionals, vocabulary and more.','Start')
        : activeTarget==='de'
          ? sourceCard('germanEssentials','essentials','tools',true,'Deutsch Trainer','German core skills','Train grammar, pronunciation, sentence building, and real conversation patterns.','Start')
          : null;
      var wordUsageCard=sourceCard('wordUsage','wordusage','cards',false,'Word usage cards','Examples and explanations in your native language','Enter a word and get short cards with meaning, examples, and sentence placement in '+targetName+'.','Open');
      var languageTail=activeTarget==='de'
        ? [
            sourceCard('articles','articles','file',false,'Guess Article','Article practice','Practice der, die, and das with German words from your level.','Continue'),
            sourceCard('germanAlphabet','germanAlphabet','file',false,'German Alphabet','30 letters · 19 combinations','Every letter and combination with its sound and examples, read by ELSA — then a quiz.','Start'),
            sourceCard('memory','flashcards','stack',false,'Memory Cards','Vocabulary training','Learn and remember words with interactive cards.','Continue')
          ]
        : [
            sourceCard('memory','flashcards','stack',false,'Memory Cards','Vocabulary training','Match '+targetName+' words with hints in your native language.','Continue')
          ];
      if(activeTarget==='de'&&levelIndex(activeLevel)>=1){
        languageTail.push(sourceCard('wQuestion','wquestion','file',false,'W-questions','Question practice','Build German questions with wer, was, wann, wo, wohin and warum.','Continue'));
        languageTail.push(sourceCard('perfekt','perfekt','book',false,'German Perfekt','Spoken past tense','Practice haben/sein and participle forms for everyday German.','Continue'));
      }
      // telc A1–B2 model tests live inside Exam Mode (renderExam), so they are
      // intentionally not listed as separate cards in the All exercises library.
      const bankItems=[
        sourceCard('adaptive','adaptive','path',true,'Adaptive learning path','Personal daily plan','A personal sequence based on your level, progress, and recurring mistakes.','Open path'),
        sourceCard('duvela','ai','sparkles',true,'AI Practice','Sofia, ELSA and the AI team','Choose a specialist for conversation, pronunciation, grammar, role-play, or exam practice.','Start AI practice'),
        sourceCard('liveTeacher','liveTeacher','video',false,'Practice LIVE with Teacher','Teacher session','Enter a live practice room with a teacher for speaking, questions, and real-time feedback.','View teachers'),
        examCard,
        ...(essentialsCard?[essentialsCard]:[]),
        sourceCard('duel','duel','bolt',false,'LIVE Student Duel','10 questions · live matchmaking','Join from Student Hub. Duvela searches a real learner first; if nobody is online, the Bot starts.','Play duel'),
        sourceCard('listening','listening','headphones',false,'Listening Lab','Audio comprehension','Listen to level-matched prompts and check what you understood.','Start listening'),
        sourceCard('reading','reading','book',false,'Reading Lab','Reading comprehension','Read level-matched texts and answer focused questions.','Start reading'),
        sourceCard('writing','writing','edit',false,'Writing Lab','Guided writing','Write from a prompt, review the result and improve your draft.','Start writing'),
        grammarCard,
        wordUsageCard
      ].concat(languageTail,[
        sourceCard('mistakes','mistakes','alert',false,'Mistake Center','Mistakes are saved on this device and synced when your account is available.','One place for mistakes from grammar, exams, listening and writing.','Review')
      ]);
      var resume=readResume();
      var coreIds=['duel','listening','reading','writing'];
      var libraryItems=bankItems.filter(function(item){return coreIds.indexOf(item.id)<0;});
      var availableItems=libraryItems.filter(function(item){return !item.premium;});
      var premiumItems=libraryItems.filter(function(item){return item.premium;});
      function bankIcon(name){
        var common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
        var icons={
          path:'<svg '+common+'><circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="12" r="2"/><path d="M7 7v4c0 2 1.3 3 3 3h4"/><path d="M7 17v-3"/></svg>',
          sparkles:'<svg '+common+'><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z"/><path d="M19 4l.7 1.6L21 6.3l-1.3.7L19 8.5 18.3 7 17 6.3l1.3-.7L19 4z"/></svg>',
          video:'<svg '+common+'><rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10l5-3v10l-5-3z"/></svg>',
          flask:'<svg '+common+'><path d="M9 3h6"/><path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8a3 3 0 0 0 2.6-4l-5-9V3"/><path d="M8 15h8"/></svg>',
          tools:'<svg '+common+'><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.8 2.8-2-2 2.8-2.8z"/><path d="M4 4l4 4"/><path d="M3 7l3-3"/></svg>',
          bolt:'<svg '+common+'><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
          bulb:'<svg '+common+'><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8 14a6 6 0 1 1 8 0c-1 1-1.4 2-1.5 3h-5c-.1-1-.5-2-1.5-3z"/></svg>',
          headphones:'<svg '+common+'><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="7" rx="2"/><rect x="17" y="13" width="4" height="7" rx="2"/></svg>',
          book:'<svg '+common+'><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H7a3 3 0 0 0-3 3V5.5z"/><path d="M4 19a3 3 0 0 1 3-3h13"/></svg>',
          edit:'<svg '+common+'><path d="M4 20h16"/><path d="M5 15l9.5-9.5 4 4L9 19H5v-4z"/><path d="M13.5 6.5l4 4"/></svg>',
          cards:'<svg '+common+'><rect x="6" y="5" width="12" height="14" rx="2"/><path d="M9 3h8a3 3 0 0 1 3 3v10"/></svg>',
          file:'<svg '+common+'><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
          stack:'<svg '+common+'><path d="M5 8h14"/><rect x="5" y="10" width="14" height="9" rx="2"/><path d="M7 5h10"/></svg>',
          alert:'<svg '+common+'><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>'
        };
        return icons[name] || icons.path;
      }
      function exerciseCard(item){
        var filterMap={adaptive:'adaptive premium',duvela:'adaptive premium',liveTeacher:'live premium',exam:'exam premium',englishEssentials:'grammar premium',germanEssentials:'grammar premium',duel:'live',listening:'adaptive',reading:'adaptive',writing:'writing',teacherPractices:'live',grammar:'grammar',wordUsage:'vocabulary',articles:'grammar',memory:'vocabulary',wQuestion:'grammar',perfekt:'grammar',mistakes:'adaptive'};
        var filters=filterMap[item.id]||(item.premium?'premium':'all');
        var locked=item.premium&&!premiumActive;
        var sessions=Number(p[item.webTool]||p[item.id]||0),inProgress=!!(resume&&resume.tool===item.webTool),status=inProgress?'in-progress':sessions>0?'completed':'new';
        var access=item.premium?'premium':'available';
        return '<button class="study-tile mph-exercise-card ' + (item.premium?'premium-exercise':'regular-exercise') + (locked?' premium-locked':'') + (item.db?' db-exercise':'') + '" data-study="' + esc(item.webTool) + '" data-mobile-card="' + esc(item.id) + '" data-mobile-target="' + esc(mobileTarget) + '" data-study-category="' + esc(filters) + '" data-study-access="'+access+'" data-study-level="'+esc(String(activeLevel).toUpperCase())+'" data-study-status="'+status+'"'+(locked?' data-premium-locked="true" data-premium-feature="'+esc(item.id)+'" data-premium-title="'+esc(item.title)+'" aria-label="'+esc(item.title+' · '+tr('Premium access required','Нужен Premium-доступ'))+'"':'')+'>' +
          '<div class="mph-exercise-top"><span class="mph-exercise-icon">' + bankIcon(item.icon) + '</span></div>' +
          '<div class="mph-exercise-copy"><div class="mph-exercise-heading"><div><h3>' + esc(item.title) + '</h3><strong>' + esc(item.meta) + '</strong></div><span class="mph-access-badge '+access+'">'+(item.premium?(PREMIUM_TEST_MODE?esc(tr('✓ Test access','✓ Тестовый доступ')):(premiumActive?'✓ '+esc(tr('Included','Доступно')):esc('Premium'))):esc(tr('Available','Доступно')))+'</span></div><p>' + esc(item.desc) + '</p></div>' +
          '<span class="mph-exercise-action">' + esc(locked?tr('Explore Premium','Узнать о Premium'):item.action) + ' →</span></button>';
      }
      var goalLevel=studentGoalLevelForTarget(activeTarget,'');
      var goalDisplay=goalLevel||tr('Set goal','Укажите цель');
      var score=Number(done||0),goalPercent=percent;
      var examDate=examGoal.date||'',examDateObj=examDate?new Date(examDate+'T12:00:00'):null,examDays=examDate?daysLeft:null;
      var examName=String(examGoal.exam||'telc-b1').toUpperCase().replace('-',' ');
      var examDateText=examDateObj?examDateObj.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):tr('Not set yet','Пока не указана');
      var examDayText=examDays===null?tr('Set date','Укажите дату'):(examDays+' '+tr('days','дней'));
      function miniLanguage(target){
        var level=targetData.levels[target]||prefs.levels[target]||activeLevel||'A1';
        return '<button type="button" role="tab" aria-selected="'+(target===activeTarget?'true':'false')+'" class="'+(target===activeTarget?'active':'')+'" data-practice-target="'+esc(target)+'"><span>'+bankIcon('cards')+'</span><b>'+esc(targetData.labels[target]||targetLabel(target))+'</b><small>'+esc(String(level).toUpperCase())+'</small></button>';
      }
      var languageTargets=targetData.targets.filter(isLanguageTarget);
      languageTargets=languageTargets.slice(0,6);
      function readinessRow(key,label){
        var value=Number(readiness[key]||0);
        return '<button type="button" data-readiness-tool="'+key+'" aria-label="'+esc(label+' '+value+'%')+'"><span><b>'+esc(label)+'</b><strong>'+value+'%</strong></span><i role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'"><em style="width:'+value+'%"></em></i></button>';
      }
      var quickStart=[
        {id:'duel',icon:'bolt',title:'LIVE Duel'},
        {id:'listening',icon:'headphones',title:'Listening Lab'},
        {id:'reading',icon:'book',title:'Reading Lab'},
        {id:'writing',icon:'edit',title:'Writing Lab'}
      ];
      function quickCard(item){
        var descriptions={duel:tr('Compete live and test your speed.','Соревнуйтесь в LIVE и проверяйте скорость.'),listening:tr('Train comprehension with focused audio.','Тренируйте понимание речи на слух.'),reading:tr('Read level-matched texts and answer.','Читайте тексты своего уровня и отвечайте.'),writing:tr('Write, review and improve each draft.','Пишите, проверяйте и улучшайте текст.')};
        return '<button class="study-tile practice-quick-card" data-study="'+esc(item.id)+'"><span>'+bankIcon(item.icon)+'</span><div><b>'+esc(item.title)+'</b><small>'+esc(descriptions[item.id]||'')+'</small></div><strong>'+esc(tr('Open','Открыть'))+' →</strong></button>';
      }
      var uiLanguage=String(document.documentElement.lang||'en').toLowerCase().split('-')[0];
      var languageNames={en:'English',ru:'Русский',de:'Deutsch',es:'Español',fr:'Français',it:'Italiano',uk:'Українська',ar:'العربية'};
      var explanationLanguage=languageNames[uiLanguage]||uiLanguage.toUpperCase();
      var progressPercent=targetTools.length?Math.round(targetCompleted/targetTools.length*100):0;
      var nextPlan=dailyPlan[0]||{tool:'grammar',title:tr('Continue your practice','Продолжите практику'),reason:tr('Build your next skill step','Сделайте следующий шаг')};
      var resumeTool=resume&&TOOLS.find(function(tool){return tool.id===resume.tool;});
      var practiceSessions=(Array.isArray(p.sessions)?p.sessions:[]).filter(function(session){return session&&session.tool_id;});
      var latestPractice=practiceSessions.slice().sort(function(a,b){return new Date(b.completed_at||b.created_at||0)-new Date(a.completed_at||a.created_at||0);})[0];
      var weakRecommendation=weak&&weak.length?weak[0]:null;
      var recommendation=resume&&resumeTool
        ? {tool:resume.tool,title:tr('Continue ','Продолжить ')+resumeTool.title,reason:tr('Resume from step ','Продолжить с шага ')+(Number(resume.idx||0)+1),label:tr('IN PROGRESS','В ПРОЦЕССЕ')}
        : weakRecommendation
          ? {tool:weakRecommendation.tool,title:tr('Strengthen ','Укрепить ')+weakRecommendation.label,reason:weakRecommendation.count+' '+tr('recent mistakes','недавних ошибок'),label:tr('RECOMMENDED','РЕКОМЕНДУЕМ')}
          : latestPractice
            ? {tool:latestPractice.tool_id,title:tr('Continue recent practice','Продолжить недавнюю практику'),reason:tr('Based on your latest completed activity','На основе последнего выполненного занятия'),label:tr('CONTINUE LEARNING','ПРОДОЛЖИТЬ ОБУЧЕНИЕ')}
            : null;
      var examSessions=(Array.isArray(p.sessions)?p.sessions:[]).filter(function(session){return session&&session.tool_id==='exam';});
      var bestExam=examSessions.reduce(function(best,session){var pct=Number(session.total)>0?Math.round(Number(session.score||0)/Number(session.total)*100):0;return Math.max(best,pct);},0);
      var lastExam=examSessions.slice().sort(function(a,b){return new Date(b.completed_at||0)-new Date(a.completed_at||0);})[0];
      var skillLabels={reading:tr('Reading','Чтение'),listening:tr('Listening','Аудирование'),grammar:tr('Grammar','Грамматика'),writing:tr('Writing','Письмо'),speaking:tr('Speaking','Говорение')};
      var weakestSkill=Object.keys(skillLabels).sort(function(a,b){return Number(readiness[a]||0)-Number(readiness[b]||0);})[0];
      var checkpointDate=new Date();checkpointDate.setDate(checkpointDate.getDate()+7);
      if(examDateObj&&checkpointDate>examDateObj)checkpointDate=examDateObj;
      var checkpointText=checkpointDate.toLocaleDateString(uiLanguage||'en',{month:'short',day:'numeric'});
      var offlineQueue=[];try{offlineQueue=JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)||'[]');}catch(e){}
      var syncState=!navigator.onLine?'offline':practiceSyncState;
      var syncLabel=syncState==='ready'?tr('Progress synced','Прогресс синхронизирован'):syncState==='syncing'?tr('Syncing progress…','Синхронизация прогресса…'):syncState==='offline'?tr('Offline · progress stays on this device','Офлайн · прогресс сохранён на устройстве'):tr('Progress sync needs attention','Ошибка синхронизации прогресса');
      var completedLibraryItems=libraryItems.filter(function(item){return Number(p[item.webTool]||p[item.id]||0)>0;});
      var filters=[['all',tr('All','Все')],['available',tr('Available','Доступные')],['premium','Premium'],['level:'+String(activeLevel).toUpperCase(),tr('Level ','Уровень ')+String(activeLevel).toUpperCase()]];
      if(resume&&libraryItems.some(function(item){return item.webTool===resume.tool;}))filters.push(['in-progress',tr('In Progress','В процессе')]);
      if(completedLibraryItems.length)filters.push(['completed',tr('Completed','Завершённые')]);
      [['adaptive',tr('Adaptive','Адаптивные')],['live','LIVE'],['exam',tr('Exam','Экзамен')],['vocabulary',tr('Vocabulary','Словарь')],['grammar',tr('Grammar','Грамматика')],['writing',tr('Writing','Письмо')]].forEach(function(filter){
        if(libraryItems.some(function(item){var map={adaptive:'adaptive premium',duvela:'adaptive premium',liveTeacher:'live',exam:'exam premium',englishEssentials:'grammar premium',germanEssentials:'grammar premium',grammar:'grammar',wordUsage:'vocabulary',articles:'grammar',memory:'vocabulary',wQuestion:'grammar',perfekt:'grammar',mistakes:'adaptive'};return String(map[item.id]||'').split(/\s+/).indexOf(filter[0])>=0;}))filters.push(filter);
      });
      var recommendationHtml=recommendation
        ? '<section class="practice-recommended"><div><small>'+esc(recommendation.label)+'</small><h2>'+esc(recommendation.title)+'</h2><p>'+esc(recommendation.reason)+'</p></div><button class="study-tile" type="button" data-study="'+esc(recommendation.tool)+'">'+esc(tr('Continue learning','Продолжить обучение'))+' →</button></section>'
        : '<section class="practice-recommended empty"><div><small>'+esc(tr('NEXT EXERCISE','СЛЕДУЮЩЕЕ УПРАЖНЕНИЕ'))+'</small><h2>'+esc(tr('Complete a core skill to unlock a personal recommendation','Выполните основной навык, чтобы получить персональную рекомендацию'))+'</h2><p>'+esc(tr('Recommendations use your real exercise history and saved mistakes.','Рекомендации используют реальную историю занятий и сохранённые ошибки.'))+'</p></div></section>';
      return '<section class="mobile-practice-hub practice-library-mobile practice-desktop-hub target-'+esc(activeTarget)+'">' +
        '<header class="practice-dashboard-header"><div class="practice-dashboard-title"><small>'+esc(tr('PRACTICE HUB','ЦЕНТР ПРАКТИКИ'))+'</small><h2>'+esc(tr('Your learning workspace','Ваше учебное пространство'))+'</h2><p>'+esc(tr('Continue the right practice for your level and goal.','Продолжайте практику для своего уровня и цели.'))+'</p></div><div class="practice-language-tabs" role="tablist" aria-label="'+esc(tr('Practice languages','Языки практики'))+'">'+languageTargets.map(miniLanguage).join('')+'</div><div class="practice-dashboard-metrics"><span><small>'+esc(tr('Language','Язык'))+'</small><b>'+esc(activeLabel)+'</b></span><span><small>'+esc(tr('Explanations','Объяснения'))+'</small><b>'+esc(explanationLanguage)+'</b></span><span><small>'+esc(tr('Current level','Текущий уровень'))+'</small><b>'+esc(String(activeLevel).toUpperCase())+'</b></span><span><small>'+esc(tr('Goal level','Целевой уровень'))+'</small><b>'+esc(goalDisplay)+'</b></span><span><small>'+esc(tr('Score','Баллы'))+'</small><b>'+Number(done||0)+' XP</b></span><span><small>'+esc(tr('Rank','Ранг'))+'</small><b>'+esc(rank)+'</b></span><span class="progress"><small>'+esc(tr('Progress','Прогресс'))+'</small><b>'+progressPercent+'%</b><i role="progressbar" aria-label="'+esc(tr('Learning progress','Прогресс обучения'))+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progressPercent+'"><em style="width:'+progressPercent+'%"></em></i></span></div><div class="practice-sync-state '+esc(syncState)+'" role="status" aria-live="polite"><span></span><b>'+esc(syncLabel)+'</b>'+(offlineQueue.length?'<small>'+offlineQueue.length+' '+esc(tr('sessions waiting to sync','занятий ожидают синхронизации'))+'</small>':'')+(syncState==='error'?'<button type="button" data-practice-sync-retry>'+esc(tr('Retry','Повторить'))+'</button>':'')+'</div></header>' +
        '<div class="practice-desktop-shell"><main class="practice-desktop-main">' +
          recommendationHtml +
          '<div class="practice-quick-head"><div><small>'+esc(tr('CORE SKILLS','ОСНОВНЫЕ НАВЫКИ'))+'</small><h2>'+esc(tr('Train what matters','Тренируйте главное'))+'</h2></div><span>'+quickStart.length+'</span></div><div class="practice-quick-start">'+quickStart.map(quickCard).join('')+'</div>' +
          '<div class="practice-library-head"><div><small>'+esc(tr('EXERCISE LIBRARY','БИБЛИОТЕКА УПРАЖНЕНИЙ'))+'</small><h2>'+esc(tr('Find your next exercise','Найдите следующее упражнение'))+'</h2></div><span data-library-count>'+libraryItems.length+'</span></div><div class="practice-library-filters" role="group" aria-label="'+esc(tr('Exercise filters','Фильтры упражнений'))+'">'+filters.map(function(filter,index){return '<button type="button" class="'+(index===0?'active':'')+'" aria-pressed="'+(index===0?'true':'false')+'" data-study-filter="'+filter[0]+'">'+esc(filter[1])+'</button>';}).join('')+'</div>' +
          '<section class="practice-library-section available" data-library-section><div class="practice-library-subhead"><div><small>'+esc(tr('AVAILABLE NOW','ДОСТУПНО СЕЙЧАС'))+'</small><h3>'+esc(tr('Available exercises','Доступные упражнения'))+'</h3></div><span>'+availableItems.length+'</span></div><div class="practice-exercise-bank">'+availableItems.map(exerciseCard).join('')+'</div></section>' +
          '<section class="practice-library-section premium" data-library-section><div class="practice-library-subhead"><div><small>'+esc(PREMIUM_TEST_MODE?tr('TEST ACCESS','ТЕСТОВЫЙ ДОСТУП'):'DUVELA PREMIUM')+'</small><h3>'+esc(tr('Premium learning tools','Инструменты Premium'))+'</h3></div><span>'+premiumItems.length+'</span></div><div class="practice-exercise-bank">'+premiumItems.map(exerciseCard).join('')+'</div><div class="practice-premium-summary"><div><span>★</span><div><b>'+esc(examName)+' · '+readiness.overall+'%</b><small>'+esc(examDate?examDateText:tr('Create an exam plan when you are ready.','Создайте план экзамена, когда будете готовы.'))+'</small></div></div><button type="button" data-exam-plan="1">'+esc(examDate?tr('Change exam plan','Изменить план экзамена'):tr('Create exam plan','Создать план экзамена'))+' →</button><div class="practice-exam-history compact"><span><small>'+esc(tr('ATTEMPTS','ПОПЫТКИ'))+'</small><b>'+examSessions.length+'</b></span><span><small>'+esc(tr('BEST RESULT','ЛУЧШИЙ РЕЗУЛЬТАТ'))+'</small><b>'+(examSessions.length?bestExam+'%':'—')+'</b></span></div></div></section>' +
          '<section class="practice-teacher-library"><div class="practice-library-head"><div><small>'+esc(tr('FROM YOUR TEACHERS','ОТ ПРЕПОДАВАТЕЛЕЙ'))+'</small><h2>'+esc(tr('Teacher practices','Практики преподавателей'))+'</h2></div></div><p class="practice-teacher-intro">'+esc(tr('Only published exercises matching your current language and exact CEFR level appear here.','Здесь показываются только опубликованные задания для выбранного языка и точного уровня CEFR.'))+'</p>'+(ctx.practicesHtml?ctx.practicesHtml():'')+'</section>' +
        '</main><aside class="practice-desktop-sidebar">' +
          '<section class="practice-goal-progress"><div class="practice-goal-head"><span>'+bankIcon('path')+'</span><div><small>'+esc(tr('STUDENT GOAL','ЦЕЛЬ УЧЕНИКА'))+'</small><h2>'+esc(activeLabel+' '+goalDisplay)+'</h2></div><strong>'+goalPercent+'%</strong></div><div class="practice-goal-track"><i style="width:'+goalPercent+'%"></i></div><div class="practice-goal-stats"><span><small>'+esc(tr('CURRENT','СЕЙЧАС'))+'</small><b>'+esc(String(activeLevel).toUpperCase())+'</b></span><span><small>'+esc(tr('GOAL','ЦЕЛЬ'))+'</small><b>'+esc(goalDisplay)+'</b></span><span><small>'+esc(tr('SCORE','БАЛЛЫ'))+'</small><b>'+Number(done||0)+'</b></span><span><small>'+esc(tr('RANK','РАНГ'))+'</small><b>'+esc(rank)+'</b></span></div></section>' +
          (resume&&resumeTool?'<section class="practice-side-card practice-resume-card"><small>'+esc(tr('CONTINUE PRACTICE','ПРОДОЛЖИТЬ ЗАНЯТИЕ'))+'</small><span>'+bankIcon('path')+'</span><h3>'+esc(resumeTool.title)+'</h3><p>'+esc(String(resume.level||activeLevel).toUpperCase())+' · '+esc(tr('Step','Шаг'))+' '+(Number(resume.idx||0)+1)+' · '+esc(tr('Score','Счёт'))+' '+Number(resume.score||0)+'</p><button type="button" data-study-resume>'+esc(tr('Continue where I stopped','Продолжить с места остановки'))+' →</button></section>':'') +
          '<section class="practice-side-card"><small>'+esc(tr('QUICK ACTIONS','БЫСТРЫЕ ДЕЙСТВИЯ'))+'</small><div class="practice-side-actions"><button class="study-tile" data-study="mistakes">'+bankIcon('alert')+'<span><b>'+esc(tr('Mistake Center','Центр ошибок'))+'</b><small>'+loadMistakes().length+' '+esc(tr('saved','сохранено'))+'</small></span></button><button class="study-tile" data-study="history">'+bankIcon('file')+'<span><b>'+esc(tr('Practice history','История практики'))+'</b><small>'+esc(tr('Sessions and XP','Занятия и XP'))+'</small></span></button></div></section>' +
          '<section class="practice-side-card practice-live-card"><small>'+esc(tr('LEARN WITH SUPPORT','УЧИТЕСЬ С ПОДДЕРЖКОЙ'))+'</small><h3>'+esc(tr('Need live feedback?','Нужна живая обратная связь?'))+'</h3><p>'+esc(tr('Teacher sessions are booked separately from the Premium subscription.','Занятия с преподавателем бронируются отдельно от подписки Premium.'))+'</p><button class="study-tile primary" data-study="liveTeacher">'+esc(tr('View teachers','Посмотреть преподавателей'))+'</button><button class="study-tile" data-study="duel">'+esc(tr('Open LIVE Duel','Открыть LIVE Duel'))+'</button></section>' +        '</aside></div></section>';
      const premiumOrder=['adaptive','ai','liveTeacher','exam','essentials','duel'];
      const premiumTools=premiumOrder.map(function(id){return targetTools.find(function(tool){return tool.id===id;});}).filter(Boolean);
      const regularTools=targetTools.filter(function(tool){return !tool.premium;});
      function toolCard(tool) {
        var sessions = Number(p[tool.id]) || 0;
        var title=tool.id==='essentials'?(activeTarget==='de'?tr('Deutsch Trainer','Тренажёр немецкого'):targetLabel(activeTarget)+' '+tr('Trainer','тренажёр')):tool.title;
        return '<button class="study-tile mph-card ' + esc(tool.accent || 'purple') + (tool.premium ? ' premium-card' : '') + '" data-study="' + esc(tool.id) + '" data-study-category="' + esc(tool.category || '') + '">' +
          '<div class="mph-card-top"><span class="mph-icon">' + tool.icon + '</span>' + (tool.premium ? '<span class="mph-premium">'+esc(PREMIUM_TEST_MODE?tr('★ TEST ACCESS','★ ТЕСТОВЫЙ ДОСТУП'):'★ PREMIUM')+'</span>' : sessions ? '<span class="mph-done">✓ ' + sessions + '</span>' : '<span class="mph-new">' + esc(tr('Start', 'Начать')) + '</span>') + '</div>' +
          '<div class="mph-card-copy"><h3>' + esc(title) + '</h3><p>' + esc(tool.desc) + '</p></div><span class="mph-open">' + esc(tool.id==='liveTeacher'?tr('Join LIVE','Войти в LIVE'):tool.id==='duel'?tr('Find a rival','Найти соперника'):tr('Open practice', 'Открыть практику')) + ' →</span></button>';
      }
      return '<section class="mobile-practice-hub target-'+esc(activeTarget)+' '+(fullLanguagePractice?'full-language-practice':'subject-practice')+'">' +
        '<div class="practice-top-actions"><div class="practice-quick-settings" aria-label="Practice settings"><button type="button" data-practice-pref="sound" aria-pressed="' + prefs.sound + '">🔊 ' + esc(tr('Sound','Звук')) + '</button><button type="button" data-practice-pref="reducedMotion" aria-pressed="' + prefs.reducedMotion + '">◌ ' + esc(tr('Less motion','Меньше движения')) + '</button><button type="button" data-practice-pref="largeText" aria-pressed="' + prefs.largeText + '">A+ ' + esc(tr('Large text','Крупный текст')) + '</button></div>' +
        '<div class="practice-rank-strip practice-rank-strip-top"><span>⚡ <b>' + done + '</b> XP</span><span>🔥 <b>' + (streak || 0) + '</b> ' + esc(tr('day streak','дней подряд')) + '</span><span>🏅 <b>' + esc(rank) + '</b></span><span>🎯 <b>' + Number(p.streak && p.streak.today_sessions || 0) + '/' + Number(p.streak && p.streak.daily_goal || 1) + '</b> ' + esc(tr('today','сегодня')) + '</span></div></div>' +
        '<div class="practice-home-hero"><div><small>'+esc(tr('PRACTICE TODAY','ПРАКТИКА СЕГОДНЯ'))+'</small><h2>'+esc(activeLabel)+'</h2><p>'+esc(languageTarget?tr('Training follows the exact language and level saved in your learner profile.','Тренировка идёт строго по языку и уровню из профиля ученика.'):tr('Training follows the exact Academy direction saved in your learner profile.','Тренировка идёт строго по направлению Academy из профиля ученика.'))+'</p></div></div>' +
        '<div class="practice-target-switcher" role="tablist" aria-label="'+esc(tr('Your practice subjects','Ваши направления практики'))+'">'+targetData.targets.map(function(target){var level=targetData.levels[target]||prefs.levels[target]||ctx.profile&&ctx.profile.language_level||'A1';return '<button type="button" role="tab" aria-selected="'+(target===activeTarget)+'" class="'+(target===activeTarget?'active':'')+'" data-practice-target="'+esc(target)+'"><span>'+targetIcon(target)+'</span><b>'+esc(targetData.labels[target]||targetLabel(target))+'<small>'+esc(String(level).toUpperCase())+'</small></b><em>→</em></button>';}).join('')+'</div>' +
        '<div class="practice-daily adaptive-daily"><div class="practice-daily-head"><div><small>' + esc(tr('PLAN FOR TODAY','ПЛАН НА СЕГОДНЯ')) + '</small><h2>' + esc(tr('Do these steps first','Сначала выполните эти шаги')) + '</h2></div><b>' + Math.min(dailyPlan.length,Number(p.streak && p.streak.today_sessions || 0)) + '/'+dailyPlan.length+'</b></div><div class="practice-daily-list">'+dailyPlan.map(function(item,index){return '<button data-study="'+esc(item.tool)+'"><i>'+(index+1)+'</i><span><b>'+esc(item.title)+'</b><small>'+esc(item.meta)+'</small><u>'+esc(item.reason)+'</u></span><em>→</em></button>';}).join('')+'</div></div>' +
        '<div class="mph-goal"><div class="mph-goal-head"><span class="mph-goal-icon">⚑</span><div><small>' + esc(tr('Student Goal', 'Цель ученика')) + '</small><h2>' + esc(goalLevel?(tr('Reach ', 'Дойти до ') + goalLevel):tr('Choose your target level', 'Выберите целевой уровень')) + '</h2></div><strong>' + percent + '%</strong></div><div class="mph-track"><i style="width:' + percent + '%"></i></div><div class="mph-goal-meta"><span>' + esc(activeLabel) + ' · ' + esc(String(activeLevel).toUpperCase()) + ' → ' + esc(goalDisplay) + '</span><span>' + targetCompleted + ' / ' + targetTools.length + ' ' + esc(tr('activities', 'практик')) + '</span></div></div>' +
        (fullLanguagePractice?'<section class="exam-journey"><div class="exam-journey-main"><small>'+esc(tr('EXAM JOURNEY','ПУТЬ К ЭКЗАМЕНУ'))+'</small><div><h2>'+esc(examGoal.exam.toUpperCase().replace('-',' '))+'</h2><strong>'+readiness.overall+'%</strong></div><p>'+esc(daysLeft===null?(goalLevel?tr('Create an exam plan for Student Goal ','Создайте план экзамена под Student Goal ')+goalLevel:tr('Set Student Goal and exam date for a personal daily plan.','Укажите Student Goal и дату экзамена для личного плана.')):daysLeft+' '+tr('days until the exam','дней до экзамена'))+'</p><div class="exam-readiness-track"><i style="width:'+readiness.overall+'%"></i></div><button type="button" class="btn" data-exam-plan="1">'+esc(daysLeft===null?tr('Create my plan','Создать мой план'):tr('Change plan','Изменить план'))+'</button></div><div class="skill-readiness">'+[['reading','Reading'],['listening','Listening'],['grammar','Grammar'],['writing','Writing'],['speaking','Speaking']].map(function(item){return '<button type="button" data-readiness-tool="'+item[0]+'"><span><b>'+item[1]+'</b><strong>'+readiness[item[0]]+'%</strong></span><i><em style="width:'+readiness[item[0]]+'%"></em></i></button>';}).join('')+'</div></section>'+
        '<section class="weak-map"><div class="weak-map-head"><div><small>'+esc(tr('SMART REVIEW','УМНОЕ ПОВТОРЕНИЕ'))+'</small><h2>'+esc(tr('Topics needing attention','Темы, которым нужно внимание'))+'</h2></div><span>'+loadMistakes().filter(function(item){return !item.dueAt||item.dueAt<=Date.now();}).length+' '+esc(tr('due today','на сегодня'))+'</span></div><div class="weak-topic-grid">'+(weak.length?weak.map(function(item){var mastery=Math.max(12,100-item.count*14);return '<button type="button" data-weak-tool="'+item.tool+'"><span><b>'+esc(item.label)+'</b><small>'+item.count+' '+esc(tr('errors','ошибок'))+'</small></span><strong>'+mastery+'%</strong><i><em style="width:'+mastery+'%"></em></i></button>';}).join(''):'<div class="weak-empty">✓ '+esc(tr('No weak patterns yet. Complete a practice to build your map.','Слабых тем пока нет. Пройдите практику, чтобы построить карту.'))+'</div>')+'</div></section>':'<section class="subject-practice-note"><span>'+targetIcon(activeTarget)+'</span><div><small>'+esc(tr('ACADEMY DIRECTION','НАПРАВЛЕНИЕ ACADEMY'))+'</small><h2>'+esc(activeLabel)+'</h2><p>'+esc(tr('Built-in language drills are hidden for this direction. Use teacher practices, LIVE practice and AI support until a dedicated task bank is added.','Языковые тренажёры скрыты для этого направления. Используйте практики преподавателей, LIVE и AI, пока не добавлен отдельный банк заданий.'))+'</p></div></section>')+
        (premiumTools.length?'<div class="practice-section-title premium-title"><div><small>' + esc(PREMIUM_TEST_MODE?tr('TEST ACCESS','ТЕСТОВЫЙ ДОСТУП'):'DUVELA PREMIUM') + '</small><h2>★ ' + esc(tr('Premium practice','Премиум-практика')) + '</h2></div><span>' + esc(PREMIUM_TEST_MODE?tr('Available during testing','Доступно в тестовом режиме'):tr('Personal tools and exams','Персональные инструменты и экзамены')) + '</span></div><div class="study-grid mph-grid premium-grid">' + premiumTools.map(toolCard).join('') + '</div>':'') +
        '<div class="mph-toolbar"><div><small>' + esc(tr('PRACTICE LIBRARY', 'БИБЛИОТЕКА ПРАКТИКИ')) + '</small><h2>' + esc(tr('All practice','Все практики')) + '</h2></div><div class="mph-filters"><button class="active" data-study-filter="all">' + esc(tr('All', 'Все')) + '</button><button data-study-filter="grammar">' + esc(tr('Grammar', 'Грамматика')) + '</button><button data-study-filter="vocabulary">' + esc(tr('Vocabulary', 'Словарь')) + '</button><button data-study-filter="skills">' + esc(tr('Skills', 'Навыки')) + '</button><button data-study-filter="progress">' + esc(tr('Progress', 'Прогресс')) + '</button></div></div>' +
        '<div class="study-grid mph-grid regular-grid">' + regularTools.map(toolCard).join('') + '</div></section>';
    }

    function bindStudyTiles() {
      var tiles = document.querySelectorAll('.study-tile');
      Array.prototype.forEach.call(tiles, function (tile) {
        tile.addEventListener('click', function () {
          if(tile.getAttribute('data-premium-locked')==='true'){showPremiumAccess(tile.getAttribute('data-premium-feature'),tile.getAttribute('data-premium-title'));return;}
          var tool=tile.getAttribute('data-study');
          if(tool==='teacherPractice'||tool==='teacherPractices'){
            var catalog=document.querySelector('.practice-db-catalog');
            if(catalog){
              catalog.hidden=false;
              catalog.scrollIntoView({block:'start',behavior:'smooth'});
            } else {
              var actions=document.querySelector('#workspaceActions');
              if(actions){
                actions.classList.add('show-practice-db');
                var head=actions.querySelector('.practice-teacher-head');
                if(head)head.scrollIntoView({block:'start',behavior:'smooth'});
              }
            }
            return;
          }
          if(tool==='liveTeacher'){location.hash='live';return;}
          if(tool==='chess'){if(ctx.openChess)ctx.openChess();return;}
          openStudyTool(tool);
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-practice-target]'),function(button){
        button.addEventListener('click',async function(){
          var target=button.getAttribute('data-practice-target'),prefs=loadPrefs();prefs.practiceTarget=target;
          if(target!=='chess'){prefs.practiceLang=target;if(uid()){await supa.from('practice_language_settings').update({active:false}).eq('user_id',uid());await supa.from('practice_language_settings').upsert({user_id:uid(),language:target,level:(prefs.levels||{})[target]||'A1',active:true,updated_at:new Date().toISOString()});}}
          savePrefs(prefs);var panel=document.querySelector('[data-panel="workspace"]');if(panel&&ctx.renderWorkspace)ctx.renderWorkspace();else location.reload();
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('.practice-daily [data-study]'), function (tile) { tile.addEventListener('click',function () { openStudyTool(tile.getAttribute('data-study')); }); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-weak-tool],[data-readiness-tool]'),function(button){button.onclick=function(){var tool=button.getAttribute('data-weak-tool')||button.getAttribute('data-readiness-tool');openStudyTool(tool);};});
      var examPlanButton=document.querySelector('[data-exam-plan]');if(examPlanButton)examPlanButton.onclick=function(){openExamPlanner();};
      var languageSelect = $('#practiceLanguage'), levelSelect = $('#practiceLevel');
      if (languageSelect) languageSelect.onchange = async function () { var prefs = loadPrefs(); prefs.practiceLang = languageSelect.value; savePrefs(prefs); if(uid()){await supa.from('practice_language_settings').update({active:false}).eq('user_id',uid());await supa.from('practice_language_settings').upsert({user_id:uid(),language:prefs.practiceLang,level:(prefs.levels||{})[prefs.practiceLang]||'A1',active:true,updated_at:new Date().toISOString()});} var panel = document.querySelector('[data-panel="workspace"]'); if (panel) ctx.renderWorkspace ? ctx.renderWorkspace() : location.reload(); };
      if (levelSelect) levelSelect.onchange = function () { var prefs = loadPrefs(); prefs.levels = prefs.levels || {}; prefs.levels[prefs.practiceLang] = levelSelect.value; savePrefs(prefs); if(uid())supa.from('practice_language_settings').upsert({user_id:uid(),language:prefs.practiceLang,level:levelSelect.value,active:true,updated_at:new Date().toISOString()}); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-study-filter]'), function (button) {
        button.addEventListener('click', function () {
          var filter = button.getAttribute('data-study-filter');
          Array.prototype.forEach.call(document.querySelectorAll('[data-study-filter]'), function (item) { var active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active)); });
          var visible=0;
          Array.prototype.forEach.call(document.querySelectorAll('.practice-exercise-bank [data-study-category],.regular-grid [data-study-category]'), function (tile) {
            var categories=String(tile.getAttribute('data-study-category')||'').split(/\s+/),matches=true;
            if(filter==='available'||filter==='premium')matches=tile.getAttribute('data-study-access')===filter;
            else if(filter==='in-progress'||filter==='completed')matches=tile.getAttribute('data-study-status')===filter;
            else if(filter.indexOf('level:')===0)matches=tile.getAttribute('data-study-level')===filter.slice(6);
            else if(filter!=='all')matches=categories.indexOf(filter)>=0;
            tile.hidden = !matches;
            if(!tile.hidden)visible++;
          });
          Array.prototype.forEach.call(document.querySelectorAll('[data-library-section]'),function(section){section.hidden=!section.querySelector('.mph-exercise-card:not([hidden])');});
          var counter=document.querySelector('[data-library-count]');if(counter)counter.textContent=String(visible);
        });
      });
      var resumeButton = document.querySelector('[data-study-resume]');
      if (resumeButton) resumeButton.addEventListener('click', function () {
        var saved = readResume(); if (!saved) return;
        openStudyTool(saved.tool, saved);
      });
      var syncRetry=document.querySelector('[data-practice-sync-retry]');
      if(syncRetry)syncRetry.addEventListener('click',function(){practiceHydrated=false;practiceSyncState=navigator.onLine?'syncing':'offline';if(ctx.renderWorkspace)ctx.renderWorkspace();hydratePracticeData();});
      Array.prototype.forEach.call(document.querySelectorAll('[data-practice-pref]'), function (button) {
        button.addEventListener('click', function () {
          var prefs = loadPrefs(), key = button.getAttribute('data-practice-pref'); prefs[key] = !prefs[key]; savePrefs(prefs);
          button.setAttribute('aria-pressed', String(!!prefs[key]));
        });
      });
      savePrefs(loadPrefs());
      schedulePracticeReminder();
      syncPracticeData();
      hydratePracticeData();
      loadMobileBanks();
      loadReadingBank(false);
      if (!window.__duvelaPracticeUnloadBound) { window.__duvelaPracticeUnloadBound = true; window.addEventListener('beforeunload',function (event) { if (studyState && !studyState.finished && (studyState.dirty || Number(studyState.idx || 0)>0)) { persistResume(); event.preventDefault(); event.returnValue = ''; } }); }
      if (!window.__duvelaPracticeOnlineBound) { window.__duvelaPracticeOnlineBound=true; window.addEventListener('online',syncPracticeData); }
    }

    function openExamPlanner(){
      ensureOverlay();var goal=loadExamGoal();studyState={tool:'examplan',lang:currentLang(),idx:0,score:0,lives:3,answers:[],startedAt:Date.now(),clientSessionId:sessionId(),examGoal:goal};
      $('#studyOverlayTitle').textContent='🎯 '+tr('Exam plan','План к экзамену');$('#studyOverlayKicker').textContent=tr('PERSONAL JOURNEY','ПЕРСОНАЛЬНЫЙ МАРШРУТ');$('#studyOverlay').setAttribute('data-practice-tool','examplan');$('#studyOverlay').setAttribute('data-practice-accent','purple');$('#studyOverlay').classList.add('open','practice-immersive');renderTool();
    }

    function renderExamPlanner(){
      var goal=studyState.examGoal||loadExamGoal(),days=examDaysLeft(goal),host=$('#studyToolBody');
      host.innerHTML='<div class="exam-plan-form"><div class="exam-plan-hero"><span>🎯</span><div><small>'+esc(tr('YOUR EXAM GOAL','ВАША ЦЕЛЬ'))+'</small><h2>'+esc(tr('Build a realistic plan','Составьте реалистичный план'))+'</h2><p>'+esc(tr('Duvela adapts the daily steps to your Student Goal, exam, available time and weak skills.','Duvela подстроит ежедневные шаги под Student Goal, экзамен, доступное время и слабые навыки.'))+'</p></div></div><div class="exam-plan-fields"><label><span>'+esc(tr('Student Goal','Цель ученика'))+'</span><select id="examStudentGoal">'+STUDENT_GOAL.LEVELS.map(function(value){return '<option'+(value===studentGoalLevel('A2')?' selected':'')+'>'+value+'</option>';}).join('')+'</select></label><label><span>'+esc(tr('Exam','Экзамен'))+'</span><select id="examGoalType"><option value="telc-b1">TELC B1</option><option value="telc-b2">TELC B2</option><option value="goethe-b1">Goethe B1</option><option value="dtz">DTZ</option><option value="testdaf">TestDaF</option></select></label><label><span>'+esc(tr('Exam date','Дата экзамена'))+'</span><input id="examGoalDate" type="date" value="'+esc(goal.date||'')+'"></label><label><span>'+esc(tr('Days per week','Дней в неделю'))+'</span><select id="examGoalDays">'+[2,3,4,5,6,7].map(function(value){return '<option'+(value===Number(goal.daysPerWeek)?' selected':'')+'>'+value+'</option>';}).join('')+'</select></label><label><span>'+esc(tr('Minutes per day','Минут в день'))+'</span><select id="examGoalMinutes">'+[10,15,20,30,45,60].map(function(value){return '<option'+(value===Number(goal.minutes)?' selected':'')+'>'+value+'</option>';}).join('')+'</select></label></div><div class="exam-plan-preview"><b>'+esc(days===null?tr('Choose your date','Выберите дату'):days+' '+tr('days available','дней в запасе'))+'</b><span>'+esc(tr('Practice → Review → Understand → Repeat','Практика → разбор → понимание → повторение'))+'</span></div><button class="btn primary" id="saveExamGoal">'+esc(tr('Create my plan','Создать мой план'))+'</button></div>';
      $('#examGoalType').value=goal.exam;$('#saveExamGoal').onclick=async function(){var next={exam:$('#examGoalType').value,date:$('#examGoalDate').value,daysPerWeek:Number($('#examGoalDays').value),minutes:Number($('#examGoalMinutes').value),studentGoal:STUDENT_GOAL.normalize($('#examStudentGoal').value,'A2')};if(!next.date)return alert(tr('Choose the exam date.','Выберите дату экзамена.'));localStorage.setItem(EXAM_GOAL_KEY,JSON.stringify(next));if(ctx.profile)ctx.profile.goal_level=next.studentGoal;var profileGoalPatch=Object.assign(STUDENT_GOAL.legacyPatch(next.studentGoal),{updated_at:new Date().toISOString()});if(uid())try{await supa.from('learner_language_profiles').update({is_active:false,updated_at:profileGoalPatch.updated_at}).eq('user_id',uid());await Promise.all([supa.from('practice_exam_goals').upsert({user_id:uid(),exam_type:next.exam,exam_date:next.date,days_per_week:next.daysPerWeek,minutes_per_day:next.minutes,updated_at:new Date().toISOString()}),supa.from('profiles').update(profileGoalPatch).eq('id',uid()),supa.from('learner_language_profiles').upsert({user_id:uid(),language:currentLang(),current_level:currentPracticeLevel(currentLang()),goal_level:next.studentGoal,is_active:true,updated_at:new Date().toISOString()},{onConflict:'user_id,language'})]);}catch(e){}closeStudy();if(ctx.renderWorkspace)ctx.renderWorkspace();else location.reload();};
    }

    function showPremiumAccess(featureId, featureTitle) {
      if (PREMIUM_TEST_MODE) { openStudyTool(featureId==='duvela'?'ai':featureId); return; }
      ensureOverlay();
      $('#studyOverlay').classList.remove('practice-immersive');
      $('#studyOverlay').removeAttribute('data-practice-tool');
      $('#studyOverlay').removeAttribute('data-practice-accent');
      var benefits={adaptive:tr('Builds a daily route from your level, history and recurring mistakes.','Создаёт ежедневный маршрут по вашему уровню, истории и повторяющимся ошибкам.'),duvela:tr('Adds focused practice with Sofia, ELSA and the DUVELA AI team.','Добавляет целевую практику с Sofia, ELSA и командой DUVELA AI.'),exam:tr('Unlocks full exam training, mock tests and result tracking.','Открывает полную подготовку к экзаменам, пробные тесты и отслеживание результатов.'),englishEssentials:tr('Unlocks the complete English core-skills trainer.','Открывает полный тренажёр основных навыков английского.'),germanEssentials:tr('Unlocks the complete German core-skills trainer.','Открывает полный тренажёр основных навыков немецкого.')};
      var title=featureTitle||tr('Premium practice','Premium-практика'),benefit=benefits[featureId]||tr('Adds personal tools and exam preparation to your practice plan.','Добавляет персональные инструменты и подготовку к экзаменам в ваш план.');
      $('#studyOverlayTitle').textContent = '★ '+title;
      $('#studyOverlayBody').innerHTML = '<div class="premium-paywall feature-specific"><span>★</span><small>'+esc(tr('PREMIUM FEATURE','ФУНКЦИЯ PREMIUM'))+'</small><h2>' + esc(title) + '</h2><p>' + esc(benefit) + '</p><div><b>✓ ' + esc(tr('Personal learning path','Персональный маршрут')) + '</b><b>✓ ' + esc(tr('Full exam training','Полная подготовка к экзамену')) + '</b><b>✓ ' + esc(tr('AI practice team','Команда AI-тренеров')) + '</b></div><strong>€9.99 <small>/ ' + esc(tr('month','месяц')) + '</small></strong><p class="premium-availability">'+esc(tr('Online checkout is not available yet. Join the launch list without payment.','Онлайн-оплата пока недоступна. Присоединитесь к списку запуска без оплаты.'))+'</p><button class="btn primary" id="premiumRequest">' + esc(tr('Join Premium launch list','В список запуска Premium')) + '</button><button class="premium-back" type="button" id="premiumBack">← '+esc(tr('Back to exercises','Назад к упражнениям'))+'</button></div>';
      $('#studyOverlay').classList.add('open');
      $('#premiumRequest').onclick = async function () { localStorage.setItem('duvela.premium.waitlist','1'); try { await supa.from('notifications').insert({ user_id:uid(),type:'premium_waitlist',title:'Duvela Premium',body:'Premium payment waitlist' }); } catch (e) {} this.textContent = '✓ ' + tr('Saved','Сохранено'); this.disabled = true; };
      $('#premiumBack').onclick=closeStudy;
    }

    // ---- overlay plumbing ----
    function ensureOverlay() {
      var overlay = $('#studyOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.id = 'studyOverlay';
      overlay.innerHTML =
        '<div class="overlay-card" style="width:min(640px,100%)">' +
          '<div class="overlay-head"><h2 id="studyOverlayTitle">Study</h2>' +
          '<button type="button" id="studyClose" aria-label="Close">✕</button></div>' +
          '<div class="overlay-body" id="studyOverlayBody"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.overlay-head').innerHTML =
        '<button type="button" id="studyClose" class="practice-back" aria-label="Back">←</button>' +
        '<div class="practice-head-copy"><small id="studyOverlayKicker">DUVELA PRACTICE</small><h2 id="studyOverlayTitle">Study</h2></div>' +
        '<div class="practice-session-xp" id="studySessionXp">+0 XP</div>';
      overlay.querySelector('#studyClose').addEventListener('click', closeStudy);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeStudy(); });
      overlay.addEventListener('input', function () { if (studyState) studyState.dirty = true; });
      if (!window.__duvelaDuelLiveKeysBound) {
        window.__duvelaDuelLiveKeysBound = true;
        window.addEventListener('keydown', handleDuelLiveKeydown);
      }
      return overlay;
    }
    async function closeStudy() {
      if (studyState && !studyState.finished && (studyState.dirty || Number(studyState.idx || 0) > 0)) {
        var confirmed = ctx.confirm ? await ctx.confirm(tr('Your progress is saved. Close this practice?', '\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d. \u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0443?'), {
          title: tr('Close practice?', '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0443?'),
          confirmLabel: tr('Close', '\u0417\u0430\u043a\u0440\u044b\u0442\u044c'),
          cancelLabel: tr('Keep practicing', '\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c'),
          icon: '*'
        }) : confirm(tr('Your progress is saved. Close this practice?', '\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d. \u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0443?'));
        if (!confirmed) return;
      }
      var overlay = $('#studyOverlay');
      if (overlay) overlay.classList.remove('open', 'practice-live-mode');
      if (studyState && studyState.examTimerId) clearInterval(studyState.examTimerId);
      if (studyState && studyState.timerId) clearInterval(studyState.timerId);
      if (studyState && studyState.duelTimerId) clearInterval(studyState.duelTimerId);
      if (studyState && studyState.duelClockId) clearInterval(studyState.duelClockId);
      if (studyState && studyState.nextDuelTimer) clearInterval(studyState.nextDuelTimer);
      if (studyState && studyState.searchTimerId) clearInterval(studyState.searchTimerId);
      if (studyState && studyState.writingSaveTimer) clearTimeout(studyState.writingSaveTimer);
      if (studyState && studyState.challengeChannel) supa.removeChannel(studyState.challengeChannel);
      // Keep the lobby/running room so a reopen (or a student already holding
      // the code) does not mint a new join code. Only detach the realtime channel.
      if (studyState && studyState.duelRoomChannel && duelRoomApi()) {
        duelRoomApi().unsubscribe(studyState.duelRoomChannel);
      }
      stopDuelChatIngest();
      stopAiVoiceConversation();
      persistResume();
      studyState = null;
      aiChatState = null;
      stopListeningPlayback();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function openStudyTool(id, restored) {
      if (id === 'telcA1') { location.href = './telc-exam.html'; return; }
      if (id === 'telcA2') { location.href = './telc-a2-exam.html'; return; }
      if (id === 'telcB1') { location.href = './telc-b1-exam.html'; return; }
      if (id === 'telcB2') { location.href = './telc-b2-exam.html'; return; }
      var tool = TOOLS.find(function (t) { return t.id === id; });
      if (!tool) return;
      if(id==='writing'&&!restored){var writingResume=readResume();if(writingResume&&writingResume.tool==='writing')restored=writingResume;}
      var premiumAllowed=PREMIUM_TEST_MODE||practicePremium||!!loadProgress().premiumActive||!!(ctx.profile&&(ctx.profile.is_premium||ctx.profile.premium));
      if(tool.premium&&!premiumAllowed){showPremiumAccess(tool.id,tool.title);return;}
      if (studyState && studyState.duelRoomChannel && duelRoomApi()) {
        duelRoomApi().unsubscribe(studyState.duelRoomChannel);
        studyState.duelRoomChannel = null;
      }
      stopDuelChatIngest();
      ensureOverlay();
      if (id !== 'ai') aiChatState = null;
      var germanOnly = ['articles','wquestion','perfekt','germanAlphabet'].indexOf(id) >= 0;
      var persianOnly = PERSIAN_TOOLS.indexOf(id) >= 0;
      var sessionLang=germanOnly?'de':persianOnly?'fa':((restored&&restored.lang)||currentLang()),sessionLevel=currentPracticeLevel(sessionLang);
      var canRestore=!!(restored&&restored.lang===sessionLang&&normalizePracticeLevel(restored.level,'A1')===sessionLevel);
      studyState = { tool:id,lang:sessionLang,level:sessionLevel,idx:canRestore?(restored.idx||0):0,score:canRestore?(restored.score||0):0,streak:0,lives:3,answers:[],timerEnabled:false,speechRate:1,skillDirect:id==='listening'||id==='reading'||id==='writing'||!!(restored&&restored.skillDirect),progressDirect:id==='mistakes'||!!(restored&&restored.progressDirect),adaptivePlanStepId:restored&&restored.adaptivePlanStepId||'',clientSessionId:canRestore&&restored.clientSessionId||sessionId(),startedAt:canRestore&&restored.startedAt||Date.now(),writingDraft:canRestore&&restored.writingDraft||'',writingTaskId:canRestore&&restored.writingTaskId||'',checked:canRestore&&restored.checked||{},writingVersions:canRestore&&restored.writingVersions||[],data:id==='flashcards'&&canRestore&&Array.isArray(restored.flashData)?restored.flashData:null,flashStats:id==='flashcards'&&canRestore?restored.flashStats||null:null,flashFlipped:id==='flashcards'&&canRestore&&!!restored.flashFlipped };
      $('#studyOverlayTitle').textContent = tool.icon + ' ' + tool.title;
      $('#studyOverlayKicker').textContent = String(tool.category || 'practice').toUpperCase() + ' · ' + studyState.level;
      $('#studyOverlay').setAttribute('data-practice-tool', id);
      $('#studyOverlay').setAttribute('data-practice-accent', tool.accent || 'purple');
      $('#studyOverlay').classList.remove('practice-live-mode');
      $('#studyOverlay').classList.add('open', 'practice-immersive');
      renderTool();
    }

    function renderTool() {
      var body = $('#studyOverlayBody');
      if (studyState.tool === 'adaptive') {
        body.innerHTML = '<div id="studyToolBody" class="practice-workspace adaptive-workspace"></div>';
        renderToolBody();
        return;
      }
      var showPicker = ['mistakes','ai','articles','wquestion','perfekt','germanAlphabet'].concat(PERSIAN_TOOLS).indexOf(studyState.tool) < 0;
      var pickerRow = showPicker ? '<div class="practice-language-row">' + langPicker() + '</div>' : '';
      var tool = TOOLS.find(function (item) { return item.id === studyState.tool; }) || (studyState.tool==='examplan'?{icon:'🎯',title:tr('Exam plan','План к экзамену'),desc:tr('A personal route to exam day','Персональный маршрут до экзамена')}:{icon:'⚔️',title:tr('Learner duel','Дуэль учеников'),desc:tr('Answer faster and more accurately','Отвечайте быстрее и точнее')});
      body.innerHTML = '<div class="practice-stage-intro"><span>' + (tool.icon || '✦') + '</span><div><small>' + esc(tr('TRAINING MODE','ТРЕНИРОВОЧНЫЙ РЕЖИМ')) + '</small><h3>' + esc(tool.title || '') + '</h3><p>' + esc(tool.desc || '') + '</p></div></div>' +
        '<div class="practice-session-line"><div><i id="practiceSessionBar"></i></div><span id="practiceSessionStep">1 / 10</span></div>' +
        '<div class="practice-gamebar"><div class="practice-status"><span id="practiceLives">♥♥♥</span><span id="practiceCombo">🔥 0</span></div><details class="practice-tools"><summary>⚙ '+esc(tr('Help and options','Помощь и настройки'))+'</summary><div><button type="button" data-practice-help="hint">💡 ' + esc(tr('Hint','Подсказка')) + '</button><button type="button" data-practice-help="explain">? ' + esc(tr('Explain','Объяснить')) + '</button><button type="button" data-practice-help="speed">🔊 1×</button><button type="button" data-practice-help="timer">⏱ ' + esc(tr('No timer','Без таймера')) + '</button></div></details></div><div id="practiceCoach" class="practice-coach" hidden></div>' +
        pickerRow + '<div id="studyToolBody" class="practice-workspace"></div>';
      var sel = $('#studyLang');
      if (sel) sel.addEventListener('change', function () {
        studyState.lang=sel.value;studyState.level=currentPracticeLevel(sel.value);studyState.idx=0;studyState.score=0;studyState.data=null;clearResume();renderToolBody();
      });
      Array.prototype.forEach.call(body.querySelectorAll('[data-practice-help]'), function (button) { button.onclick = function () { handlePracticeHelp(button); }; });
      renderToolBody();
    }

    function renderToolBody() {
      updatePracticeChrome();
      switch (studyState.tool) {
        case 'flashcards': return renderFlashcards();
        case 'vocabulary': return renderFlashcards();
        case 'adaptive': return renderAdaptivePath();
        case 'articles': return renderArticles();
        case 'memory': return renderMemory();
        case 'grammar': return renderGrammar();
        case 'wquestion': return renderWQuestions();
        case 'perfekt': return renderSpecialQuiz(PERFEKT, renderToolBody);
        case 'wordusage': return renderWordUsage();
        case 'listening': return renderListening();
        case 'speaking': return renderSpeaking();
        case 'reading': return renderReading();
        case 'readingarticles': return renderReading();
        case 'writing': return renderWriting();
        case 'sentences': return renderSentenceBuilder();
        case 'categories': return renderCategories();
        case 'scenarios': return renderScenarios();
        case 'duel': return renderSocialChallenge('duel');
        case 'duelmatch': return renderDuelMatch();
        case 'examplan': return renderExamPlanner();
        case 'team': return renderSocialChallenge('team');
        case 'exam': return renderExam();
        case 'mistakes': return renderMistakes();
        case 'history': return renderPracticeHistory();
        case 'dictionary': return renderDictionary();
        case 'calendar': return renderActivityCalendar();
        case 'achievements': return renderAchievements();
        case 'ranking': return renderPracticeRanking();
        case 'settings': return renderPracticeSettings();
        case 'essentials': return renderEssentials();
        case 'germanAlphabet': return window.DuvelaPracticeExtras.renderAlphabet($('#studyToolBody'), 'german', practiceExtrasOptions());
        case 'persianAlphabet': return window.DuvelaPracticeExtras.renderAlphabet($('#studyToolBody'), 'persian', practiceExtrasOptions());
        case 'persianReading': return window.DuvelaPracticeExtras.renderPersianReading($('#studyToolBody'), practiceExtrasOptions());
        case 'persianListening': return window.DuvelaPracticeExtras.renderPersianListening($('#studyToolBody'), practiceExtrasOptions());
        case 'persianNumbers': return window.DuvelaPracticeExtras.renderPersianNumbers($('#studyToolBody'), practiceExtrasOptions());
        case 'persianGrammar': return window.DuvelaPracticeExtras.renderPersianGrammar($('#studyToolBody'), Object.assign(practiceExtrasOptions(), {
          level: currentPracticeLevel('fa'),
          onMistake: function (task, answer, level) {
            logMistake('fa', task.prompt + '\n' + task.sentence, task.options, task.options.indexOf(task.answer), 'mcq', { sourceTool:'persianGrammar', questionId:'persian-grammar:' + task.id, level:level, explanation:task.explanation, selectedAnswer:answer });
          }
        }));
        case 'persianWordCards': return window.DuvelaPracticeExtras.renderPersianWordCards($('#studyToolBody'), Object.assign(practiceExtrasOptions(), {
          isSaved: function (word) { return isWordSaved('fa', word); },
          saveWord: function (word, translation) { if (!isWordSaved('fa', word)) { toggleSavedWord('fa', word, translation); syncPracticeData(); } }
        }));
        case 'ai': return renderAiPractice();
      }
    }

    function updatePracticeChrome() {
      if (!studyState) return;
      var step = Math.max(0, Number(studyState.idx || 0));
      var total = Math.max(1, Number(studyState.total || 10));
      var percent = Math.min(100, Math.round(Math.min(total, step + 1) / total * 100));
      var bar = $('#practiceSessionBar'), label = $('#practiceSessionStep'), xp = $('#studySessionXp');
      if (bar) bar.style.width = percent + '%';
      if (label) label.textContent = Math.min(total, step + 1) + ' / ' + total;
      if (xp) xp.textContent = studyState.tool === 'listening'
        ? tr('XP after finish', 'XP после завершения')
        : '+' + Number(studyState.score || 0) * 5 + ' XP';
    }

    function handlePracticeHelp(button) {
      var action = button.getAttribute('data-practice-help'), coach = $('#practiceCoach');
      if (action === 'speed') {
        studyState.speechRate = studyState.speechRate === .5 ? .75 : studyState.speechRate === .75 ? 1 : studyState.speechRate === 1 ? .5 : .5;
        button.textContent = '🔊 ' + studyState.speechRate + '×'; return;
      }
      if (action === 'timer') {
        studyState.timerEnabled = !studyState.timerEnabled;
        button.textContent = studyState.timerEnabled ? '⏱ 60s' : '⏱ ' + tr('No timer','Без таймера');
        if (studyState.timerId) clearInterval(studyState.timerId);
        if (studyState.timerEnabled) { studyState.timeLeft=60; studyState.timerId=setInterval(function(){ studyState.timeLeft--;button.textContent='⏱ '+studyState.timeLeft+'s';if(studyState.timeLeft<=0){clearInterval(studyState.timerId);finishTool(tr('Time is up','Время вышло'),Math.max(2,studyState.score*2));}},1000); }
        return;
      }
      if (!coach) return;
      coach.hidden = false;
      coach.innerHTML = action === 'hint'
        ? '<b>💡 ' + esc(tr('Hint','Подсказка')) + '</b><p>' + esc(tr('Look for familiar words, endings and the sentence context. One option can usually be eliminated first.','Найдите знакомые слова, окончания и контекст предложения. Сначала исключите один явно неверный вариант.')) + '</p>'
        : '<b>🧠 ' + esc(tr('Why?','Почему?')) + '</b><p>' + esc(tr('The correct answer follows the grammar form and meaning required by this context. After answering, the exact solution is added to your review list.','Правильный ответ соответствует грамматической форме и смыслу этого контекста. После ответа точное решение добавляется в повторение.')) + '</p>';
    }

    /* One answer adapter for Academy, Article, W-question, Word Usage and review records.
       It accepts the source schemas already present in DUVELA but never treats a missing
       answer as a correct one. */
    function resolveExerciseAnswer(item) {
      var question=item||{},rawChoices=Array.isArray(question.opts)?question.opts:Array.isArray(question.options)?question.options:Array.isArray(question.choices)?question.choices:[];
      var choices=rawChoices.map(function(choice,index){
        if(choice&&typeof choice==='object')return {index:index,id:String(choice.id||choice.optionId||choice.value||''),label:String(choice.label||choice.text||choice.value||'')};
        return {index:index,id:String(choice),label:String(choice)};
      });
      var indexFields=['a','correctIndex','correct_index','answerIndex'],index=-1;
      for(var i=0;i<indexFields.length;i++){var value=question[indexFields[i]];if(Number.isInteger(value)&&value>=0&&value<choices.length){index=value;break;}}
      var answerFields=['correctAnswer','correct_answer','sourceAnswer','answer','correctOptionId','correct_option_id'];
      var answerValue='';
      if(index<0)for(var j=0;j<answerFields.length;j++){var candidate=question[answerFields[j]];if(candidate!==undefined&&candidate!==null&&candidate!==''){answerValue=String(candidate);var found=choices.find(function(choice){return choice.id===answerValue||choice.label===answerValue;});if(found){index=found.index;break;}}}
      if(index<0&&(String(question.sourceTool||question.kind||'').toLowerCase()==='article'||String(question.sourceTool||question.kind||'').toLowerCase()==='articles')){
        var source=mobileArticleBank().find(function(row){return String(row.id||'')===String(question.questionId||'')||String(row.noun||'').toLocaleLowerCase()===String(question.prompt||question.noun||'').toLocaleLowerCase();});
        if(source){var article=String(source.article||source.art||''),articleChoice=choices.find(function(choice){return choice.id===article||choice.label===article;});if(articleChoice){index=articleChoice.index;answerValue=article;}}
      }
      if(index<0)return {valid:false,index:-1,value:'',reason:'missing-or-unmatched-answer',choices:choices};
      return {valid:true,index:index,value:choices[index].label,choiceId:choices[index].id,choices:choices};
    }
    function answerExplanation(item) {
      var resolved=resolveExerciseAnswer(item),correct=resolved.valid?resolved.value:'';
      // Grammar feedback belongs to the exact source exercise. If an imported label is
      // ever out of sync, show only the verified answer instead of a misleading rule.
      if (item && item.sourceId && item.explanation && correct && item.explanation.indexOf(correct) >= 0) return item.explanation;
      if (item && item.sourceId && correct) return tr('The correct form in this sentence is “' + correct + '”.', 'В этом предложении правильная форма — «' + correct + '».');
      if (item && item.explanation) return item.explanation;
      var prompt=String(item&&item.q||item&&item.noun||'');
      if (/___/.test(prompt)) return tr('The missing form must agree with the noun, person or tense used in the sentence.','Пропущенная форма должна согласовываться с существительным, лицом или временем предложения.');
      if (studyState.tool==='articles') return tr('German noun gender determines whether der, die or das is used. Save this noun together with its article.','Род немецкого существительного определяет артикль der, die или das. Запоминайте существительное сразу вместе с артиклем.');
      if (studyState.tool==='wordusage') return tr('Meaning and surrounding words determine which option fits naturally.','Значение и соседние слова определяют, какой вариант подходит естественно.');
      return tr('Compare the correct option with the complete sentence and repeat it aloud once.','Сравните правильный вариант с полным предложением и один раз произнесите его вслух.');
    }
    function explanationPanel(item,chosen,ok){
      var resolved=resolveExerciseAnswer(item),correct=resolved.valid?resolved.value:tr('Answer unavailable','Ответ недоступен'),base=answerExplanation(item),prompt=String(item.q||'');
      var rule=/___/.test(prompt)?tr('The form must match the person, tense and sentence meaning.','Форма должна соответствовать лицу, времени и смыслу предложения.'):tr('Use the complete sentence to identify the intended meaning.','Используйте полное предложение, чтобы определить нужный смысл.');
      var tip=studyState.lang==='de'?tr('Read the complete German sentence aloud with the correct option.','Прочитайте полное немецкое предложение вслух с правильным вариантом.'):tr('Say the corrected sentence aloud once.','Один раз произнесите исправленное предложение вслух.');
      return '<div class="why-panel '+(ok?'ok':'bad')+'"><header><span>'+(ok?'✓':'!')+'</span><div><small>'+esc(ok?tr('CORRECT','ВЕРНО'):tr('LET’S UNDERSTAND','РАЗБЕРЁМ ОШИБКУ'))+'</small><b>'+esc(ok?tr('You recognised the pattern','Вы распознали правило'):tr('You chose ','Вы выбрали ')+chosen)+'</b></div></header>'+(!ok?'<article><small>'+esc(tr('WHY IT DOES NOT FIT','ПОЧЕМУ НЕ ПОДХОДИТ'))+'</small><p>'+esc(tr('This option does not match the form or meaning required in this exact sentence.','Этот вариант не соответствует форме или смыслу, который нужен именно в этом предложении.'))+'</p></article>':'')+'<article><small>'+esc(tr('WHY THIS IS CORRECT','ПОЧЕМУ ЭТО ВЕРНО'))+'</small><p><b>'+esc(correct)+'</b> — '+esc(base)+'</p></article><article><small>'+esc(tr('RULE','ПРАВИЛО'))+'</small><p>'+esc(rule)+'</p></article><article class="why-tip"><small>'+esc(tr('MEMORY TIP','КАК ЗАПОМНИТЬ'))+'</small><p>'+esc(tip)+'</p></article></div>';
    }

    async function submitForTeacher(type,text,blob) {
      if(!uid()) return alert(tr('Sign in to send work to a teacher.','Войдите, чтобы отправить работу преподавателю.'));
      try {
        var assignment=await supa.from('practice_assignments').select('id,teacher_id').eq('student_id',uid()).order('created_at',{ascending:false}).limit(1).maybeSingle(),mediaUrl=null;
        if(blob){var file=new File([blob],'speaking-'+Date.now()+'.webm',{type:blob.type||'audio/webm'});mediaUrl=await ctx.uploadToBucket('posts',file);}
        var result=await supa.from('practice_submissions').insert({student_id:uid(),teacher_id:assignment.data&&assignment.data.teacher_id||null,assignment_id:assignment.data&&assignment.data.id||null,tool_id:studyState.tool,submission_type:type,content_text:text||null,media_url:mediaUrl,status:'submitted'});
        if(result.error)throw result.error;alert(tr('Sent to your teacher.','Отправлено преподавателю.'));
      } catch(error){alert(error.message||tr('Could not send the work.','Не удалось отправить работу.'));}
    }

    function counterHtml(idx, total) {
      return '<div style="color:var(--soft);font-weight:800;font-size:12px;margin:4px 0 12px">' +
        (idx + 1) + ' / ' + total + '</div>';
    }

    function finishHtml(scoreText) {
      return '<div style="text-align:center;padding:14px 0">' +
        '<h2 style="margin:0 0 4px">' + esc(tr('Done!', 'Готово!')) + '</h2>' +
        '<p style="font-weight:900;font-size:26px;margin:6px 0">' + scoreText + '</p>' +
        '<p style="color:var(--teal);font-weight:900">+' + '{xp}' + ' XP</p>' +
        '<button class="btn primary" id="studyAgain" style="margin-top:12px">' + esc(tr('Again', 'Ещё раз')) + '</button>' +
        '</div>';
    }
    function wireAgain() {
      var again = $('#studyAgain');
      if (again) again.addEventListener('click', function () {
        studyState.idx = 0; studyState.score = 0; studyState.data = null; studyState.finished = false; studyState.clientSessionId = sessionId(); studyState.startedAt = Date.now(); renderToolBody();
      });
    }

    // ---- 1. Flashcards ----
    function renderFlashcards() {
      if (studyState.tool === 'vocabulary') {
        var savedWords = loadSavedWords(studyState.lang);
        var dueNow = savedWords.filter(function (word) { return !word.dueAt || new Date(word.dueAt).getTime() <= Date.now(); }).length;
        var bankWords = strictBank(VOCAB, studyState.lang, studyState.level).length;
        var vocabModes = [
          { tool:'flashcards', icon:'🔤', title:tr('Flashcards','\u0424\u043b\u0435\u0448\u043a\u0430\u0440\u0442\u044b'), desc:tr('Flip words, save them and repeat the difficult ones.','\u041f\u0435\u0440\u0435\u0432\u043e\u0440\u0430\u0447\u0438\u0432\u0430\u0439\u0442\u0435 \u0441\u043b\u043e\u0432\u0430, \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0439\u0442\u0435 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0439\u0442\u0435 \u0441\u043b\u043e\u0436\u043d\u044b\u0435.') },
          { tool:'memory', icon:'🃏', title:tr('Memory match','\u041c\u0435\u043c\u043e\u0440\u0438'), desc:tr('Match word and translation in a quick visual drill.','\u0421\u043e\u0435\u0434\u0438\u043d\u044f\u0439\u0442\u0435 \u0441\u043b\u043e\u0432\u043e \u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0434 \u0432 \u0431\u044b\u0441\u0442\u0440\u043e\u043c \u0432\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435.') },
          { tool:'wordusage', icon:'✍️', title:tr('Word usage','\u0423\u043f\u043e\u0442\u0440\u0435\u0431\u043b\u0435\u043d\u0438\u0435 \u0441\u043b\u043e\u0432'), desc:tr('Choose the word that fits the sentence naturally.','\u0412\u044b\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u0441\u043b\u043e\u0432\u043e, \u043a\u043e\u0442\u043e\u0440\u043e\u0435 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u043a \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044e.') },
          { tool:'categories', icon:'▦', title:tr('Word sorting','\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430 \u0441\u043b\u043e\u0432'), desc:tr('Group vocabulary by meaning and topic.','\u0421\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u043b\u043e\u0432\u0430 \u043f\u043e \u0442\u0435\u043c\u0430\u043c \u0438 \u0441\u043c\u044b\u0441\u043b\u0443.') },
          { tool:'dictionary', icon:'🔖', title:tr('Saved dictionary','\u041b\u0438\u0447\u043d\u044b\u0439 \u0441\u043b\u043e\u0432\u0430\u0440\u044c'), desc:tr('Open your saved word bank and spaced repetition queue.','\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u0432\u043e\u0439 \u0431\u0430\u043d\u043a \u0441\u043b\u043e\u0432 \u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043d\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u0435.') }
        ];
        $('#studyToolBody').innerHTML =
          '<section class="vocab-hub">' +
            '<div class="vocab-hub-hero">' +
              '<div class="vocab-hub-copy">' +
                '<small>' + esc(tr('WORD BANK ACTIVE', '\u0421\u041b\u041e\u0412\u0410\u0420\u041d\u042b\u0419 \u0411\u0410\u041d\u041a ACTIVE')) + ' · ' + esc(studyState.level) + '</small>' +
                '<h2>' + esc(tr('Vocabulary bank and training modes','\u0411\u0430\u043d\u043a \u0441\u043b\u043e\u0432 \u0438 \u0440\u0435\u0436\u0438\u043c\u044b \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438')) + '</h2>' +
                '<p>' + esc(tr('Use one clear vocabulary hub for learning, matching, sentence usage and saved-word review.', '\u0417\u0434\u0435\u0441\u044c \u043e\u0434\u0438\u043d \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0439 hub \u0434\u043b\u044f \u0438\u0437\u0443\u0447\u0435\u043d\u0438\u044f \u0441\u043b\u043e\u0432, \u043c\u0435\u043c\u043e\u0440\u0438, \u0443\u043f\u043e\u0442\u0440\u0435\u0431\u043b\u0435\u043d\u0438\u044f \u0432 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f\u0445 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u0441\u043b\u043e\u0432.')) + '</p>' +
              '</div>' +
              '<div class="vocab-hub-stats">' +
                '<span><b>' + bankWords.toLocaleString() + '</b><small>' + esc(tr('level words','\u0441\u043b\u043e\u0432 \u0443\u0440\u043e\u0432\u043d\u044f')) + '</small></span>' +
                '<span><b>' + vocabModes.length + '</b><small>' + esc(tr('word modes','\u0440\u0435\u0436\u0438\u043c\u043e\u0432 \u0441\u043b\u043e\u0432')) + '</small></span>' +
                '<span><b>' + savedWords.length + '</b><small>' + esc(tr('saved words','\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u0441\u043b\u043e\u0432')) + '</small></span>' +
                '<span><b>' + dueNow + '</b><small>' + esc(tr('ready to review','\u0433\u043e\u0442\u043e\u0432\u043e \u043a \u043f\u043e\u0432\u0442\u043e\u0440\u0443')) + '</small></span>' +
              '</div>' +
            '</div>' +
            '<div class="vocab-bank-note"><strong>' + esc(tr('Word base','\u0421\u043b\u043e\u0432\u0430\u0440\u043d\u0430\u044f \u0431\u0430\u0437\u0430')) + '</strong><p>' + esc(tr('The learner sees one clean entry point instead of scattered vocabulary tools. Each card opens a specific training mode.', '\u0423 \u0443\u0447\u0435\u043d\u0438\u043a\u0430 \u043e\u0434\u043d\u0430 \u0447\u0438\u0441\u0442\u0430\u044f \u0442\u043e\u0447\u043a\u0430 \u0432\u0445\u043e\u0434\u0430 \u0432\u043c\u0435\u0441\u0442\u043e \u0440\u0430\u0437\u0431\u0440\u043e\u0441\u0430\u043d\u043d\u044b\u0445 \u0440\u0435\u0436\u0438\u043c\u043e\u0432. \u041a\u0430\u0436\u0434\u0430\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u0441\u0432\u043e\u0439 \u0442\u0438\u043f \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438.')) + '</p></div>' +
            '<div class="vocab-topic-grid">' + vocabModes.map(function (item) {
              return '<article class="vocab-topic-card">' +
                '<div class="vocab-topic-top"><i>' + item.icon + '</i><span>' + esc(studyState.level) + '</span></div>' +
                '<h3>' + esc(item.title) + '</h3>' +
                '<p>' + esc(item.desc) + '</p>' +
                '<button type="button" data-vocab-tool="' + esc(item.tool) + '">' + esc(tr('Open mode','\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0440\u0435\u0436\u0438\u043c')) + ' <em>→</em></button>' +
              '</article>';
            }).join('') + '</div>' +
          '</section>';
        Array.prototype.forEach.call(document.querySelectorAll('[data-vocab-tool]'), function (button) {
          button.onclick = function () { openStudyTool(button.getAttribute('data-vocab-tool')); };
        });
        return;
      }
      if (flashcardKeyboardHandler) { document.removeEventListener('keydown', flashcardKeyboardHandler); flashcardKeyboardHandler=null; }
      if (!studyState.data) {
        var source=studyState.lang==='de' ? mobileArticleBank().filter(function(item){return normalizePracticeLevel(item.level,'')===studyState.level;}).map(function(item){return {id:'mobile-'+item.id,lang:'de',w:String(item.article||item.art||'')+' '+String(item.noun||''),t:String(item.hint||''),source:'mobile'};}) : strictBank(VOCAB,studyState.lang,studyState.level).map(function(item,index){return {id:'vocab-'+index,lang:studyState.lang,w:item.w,t:item.t,source:'vocab'};});
        var known={}, saved=loadSavedWords().filter(function(item){return item.lang===studyState.lang;});
        saved.forEach(function(item){known[item.w]=true;});
        var now=Date.now(), due=saved.filter(function(item){return !item.dueAt||new Date(item.dueAt).getTime()<=now;}).map(function(item){return Object.assign({id:'saved-'+item.w,source:'saved'},item);});
        var newCards=shuffle(source.filter(function(item){return !known[item.w];}));
        var sessionNew=Math.min(newCards.length,Math.max(0,FLASHCARD_SESSION_LIMIT-due.length));
        studyState.data=due.slice(0,FLASHCARD_SESSION_LIMIT).concat(newCards.slice(0,sessionNew));
        studyState.flashStats={bank:source.length,saved:saved.length,due:due.length,newCards:sessionNew,learning:saved.filter(function(item){return Number(item.reps||0)>0&&Number(item.box||1)<3;}).length,review:saved.filter(function(item){return Number(item.box||1)>=3;}).length,reviewed:0};
      }
      var deck = studyState.data, stats=studyState.flashStats || {};
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool((stats.reviewed||deck.length)+' '+tr('cards reviewed','карточек повторено'), Math.min(10,Math.max(2,stats.reviewed||deck.length)));
      var card = deck[studyState.idx], host = $('#studyToolBody', false), saved = isWordSaved(studyState.lang, card.w), flipped=!!studyState.flashFlipped;
      host.innerHTML = '<section class="flashcard-srs"><header><div><small>DUVELA · '+esc(targetLabel(studyState.lang).toUpperCase())+' · '+esc(studyState.level)+'</small><h2>'+esc(tr('Flashcards','Флешкарты'))+'</h2><p>'+esc(tr('Smart review session','Сессия умного повторения'))+'</p></div><span>'+esc(studyState.idx+1)+' / '+esc(deck.length)+'</span></header><div class="flashcard-stats"><span><b>'+Number(stats.bank||0).toLocaleString()+'</b><small>'+esc(tr('word bank','банк слов'))+'</small></span><span><b>'+deck.length+'</b><small>'+esc(tr('session','сессия'))+'</small></span><span><b>'+Number(stats.due||0)+'</b><small>'+esc(tr('due today','на сегодня'))+'</small></span><span><b>'+Number(stats.newCards||0)+'</b><small>'+esc(tr('new','новые'))+'</small></span><span><b>'+Number(stats.learning||0)+'</b><small>'+esc(tr('learning','в изучении'))+'</small></span><span><b>'+Number(stats.review||0)+'</b><small>'+esc(tr('review','повтор'))+'</small></span></div><div class="flashcard-face '+(flipped?'flipped':'')+'" id="flip" role="button" tabindex="0" aria-pressed="'+flipped+'"><i>'+esc(flipped?tr('ANSWER','ОТВЕТ'):tr('WORD','СЛОВО'))+'</i><strong>'+esc(flipped?card.t:card.w)+'</strong><small>'+esc(flipped?tr('Choose how well you remembered it.','Выберите, насколько хорошо вы вспомнили слово.'):tr('Tap or press Space to reveal meaning.','Нажмите карточку или Space, чтобы открыть перевод.'))+'</small><button type="button" id="fcStar" aria-label="'+esc(saved?tr('Remove saved word','Убрать сохранённое слово'):tr('Save word','Сохранить слово'))+'">'+(saved?'★':'☆')+'</button></div><div class="flashcard-grades" aria-label="'+esc(tr('Recall grade','Оценка воспоминания'))+'">'+[['again','1',tr('Again','Снова')],['hard','2',tr('Hard','Сложно')],['good','3',tr('Good','Хорошо')],['easy','4',tr('Easy','Легко')]].map(function(item){return '<button type="button" data-flash-grade="'+item[0]+'" '+(!flipped?'disabled':'')+'><kbd>'+item[1]+'</kbd>'+esc(item[2])+'</button>';}).join('')+'</div><p class="flashcard-note">'+esc(tr('Your grade schedules the next review. It is self-reported recall, not an objectively checked answer.','Ваша оценка планирует следующее повторение. Это самооценка, а не автоматически проверенный ответ.'))+'</p></section>';
      function flipCard(){studyState.flashFlipped=!studyState.flashFlipped;renderFlashcards();}
      $('#flip').onclick=function(event){if(event.target&&event.target.id==='fcStar')return;flipCard();};
      $('#flip').onkeydown=function(event){if(event.key==='Enter'){event.preventDefault();flipCard();}};
      $('#fcStar').onclick=function(event){event.stopPropagation();var nowSaved=toggleSavedWord(studyState.lang,card.w,card.t);this.textContent=nowSaved?'★':'☆';this.setAttribute('aria-label',nowSaved?tr('Remove saved word','Убрать сохранённое слово'):tr('Save word','Сохранить слово'));};
      Array.prototype.forEach.call(host.querySelectorAll('[data-flash-grade]'),function(button){button.onclick=function(){var grade=button.getAttribute('data-flash-grade'), recorded=recordFlashcardReview(card,grade);studyState.flashStats.reviewed++;if(grade==='good'||grade==='easy')studyState.score++;studyState.flashFlipped=false;studyState.idx++;persistResume();renderFlashcards();void recorded;};});
      flashcardKeyboardHandler=function(event){var tag=String((event.target&&event.target.tagName)||'').toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select'||event.metaKey||event.ctrlKey||event.altKey)return;if(event.key===' '){event.preventDefault();flipCard();return;}var grade={1:'again',2:'hard',3:'good',4:'easy'}[event.key];if(grade&&studyState.flashFlipped){var button=host.querySelector('[data-flash-grade="'+grade+'"]');if(button)button.click();}};
      document.addEventListener('keydown',flashcardKeyboardHandler);
    }

    // ---- 2. Guess the article ----
    function mobileArticleBank() {
      return window.DuvelaMobileArticleBank && Array.isArray(window.DuvelaMobileArticleBank.exercises) ? window.DuvelaMobileArticleBank.exercises : [];
    }
    function renderArticles() {
      if (!studyState.data) {
        var mode=studyState.articleMode || 'classic', mobile = mobileArticleBank().filter(function (item) { return normalizePracticeLevel(item.level,'') === studyState.level; });
        if (mode === 'mistakes') {
          studyState.data=shuffle(loadMistakes().filter(function(item){return item.kind==='article';}).map(function(item){return { noun:item.prompt,art:(item.opts||[])[item.a],hint:'',level:studyState.level }; })).slice(0,10);
          if (!studyState.data.length) { studyState.articleMode='classic'; studyState.data=null; }
        }
        if (!studyState.data) studyState.data=shuffle(mobile.length ? mobile : exactLevelItems(ARTICLES,studyState.level)).slice(0,10).map(function(item){return { id:item.id||item.noun,noun:item.noun,art:item.art||item.article,hint:item.hint||'',level:item.level||studyState.level };});
        studyState.total=studyState.data.length;
      }
      var deck = studyState.data;
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      var mode=studyState.articleMode || 'classic';
      if(mode==='speed'&&!studyState.articleSpeedDeadline)studyState.articleSpeedDeadline=Date.now()+45000;
      var seconds=mode==='speed'?Math.max(0,Math.ceil((studyState.articleSpeedDeadline-Date.now())/1000)):0, saved=isWordSaved('de',item.art+' '+item.noun);
      host.innerHTML = '<section class="article-exercise"><header><div><small>DUVELA · GERMAN ' + esc(studyState.level) + '</small><h2>' + esc(tr('Guess the article','Угадайте артикль')) + '</h2></div><b>'+(studyState.idx+1)+' / '+deck.length+'</b></header><nav class="article-modes"><button type="button" class="'+(mode==='classic'?'active':'')+'" data-article-mode="classic">'+esc(tr('Classic','Классика'))+'</button><button type="button" class="'+(mode==='speed'?'active':'')+'" data-article-mode="speed">'+esc(tr('Speed challenge','Скоростной режим'))+'</button><button type="button" class="'+(mode==='mistakes'?'active':'')+'" data-article-mode="mistakes">'+esc(tr('Mistake review','Повтор ошибок'))+'</button>'+(mode==='speed'?'<span>'+seconds+'s</span>':'')+'</nav><i><em style="width:'+Math.round((studyState.idx+1)/deck.length*100)+'%"></em></i><main><small>'+esc(tr('CHOOSE THE ARTICLE','ВЫБЕРИТЕ АРТИКЛЬ'))+'</small><h3>___ '+esc(item.noun)+'</h3>'+(item.hint?'<p>'+esc(item.hint)+'</p>':'')+'<div>'+['der', 'die', 'das'].map(function (art) { return '<button type="button" data-art="'+art+'">'+art+'</button>'; }).join('')+'</div><section id="artFb" aria-live="polite"></section></main></section>';
      if(mode==='speed'){clearTimeout(studyState.articleSpeedTimer);if(seconds<=0){logMistake(studyState.lang,item.noun,['der','die','das'],['der','die','das'].indexOf(item.art),'article');studyState.idx++;studyState.articleSpeedDeadline=null;return renderArticles();}studyState.articleSpeedTimer=setTimeout(function(){renderArticles();},1000);}
      Array.prototype.forEach.call(host.querySelectorAll('[data-article-mode]'),function(button){button.onclick=function(){clearTimeout(studyState.articleSpeedTimer);studyState.articleSpeedDeadline=null;studyState.articleMode=button.getAttribute('data-article-mode');studyState.data=null;studyState.idx=0;studyState.score=0;renderArticles();};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = btn.getAttribute('data-art');
          clearTimeout(studyState.articleSpeedTimer);
          var ok = chosen === item.art;
          feedback(ok,{prompt:'___ '+item.noun,chosen:chosen,correct:item.art+' '+item.noun,explanation:answerExplanation(item)});
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.id||item.noun); }
          else logMistake(studyState.lang, item.noun, ['der', 'die', 'das'], ['der', 'die', 'das'].indexOf(item.art), 'article',{sourceTool:'articles',questionId:item.id||item.noun,level:item.level||studyState.level,explanation:answerExplanation(item),selectedAnswer:chosen});
          var gender=item.art==='der'?tr('masculine','мужской род'):item.art==='die'?tr('feminine','женский род'):tr('neuter','средний род');
          $('#artFb').innerHTML = '<div class="article-feedback '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('Correct!','Верно!'):tr('Correct answer: ','Правильный ответ: ')+item.art+' '+item.noun)+'</b><p>'+esc(gender)+(item.hint?' · '+esc(item.hint):'')+'</p><small>'+esc(tr('Learn every German noun together with its article.','Запоминайте каждое немецкое существительное вместе с артиклем.'))+'</small></div><div class="article-feedback-actions"><button type="button" data-article-save>'+esc(saved?tr('Saved','Сохранено'):tr('Save to Flashcards','Сохранить во Flashcards'))+'</button><button type="button" class="article-continue" id="artContinue">'+esc(tr('Continue','Продолжить'))+' →</button></div>';
          Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (b) { b.disabled = true;b.classList.toggle('correct',b.getAttribute('data-art')===item.art);b.classList.toggle('wrong',b.getAttribute('data-art')===chosen&&!ok); });
          var save=host.querySelector('[data-article-save]');if(save)save.onclick=function(){if(!isWordSaved('de',item.art+' '+item.noun))toggleSavedWord('de',item.art+' '+item.noun,item.hint||'');save.disabled=true;save.textContent=tr('Saved','Сохранено');};
          $('#artContinue').onclick=function(){studyState.idx++;studyState.articleSpeedDeadline=null;persistResume();renderArticles();};
        });
      });
    }

    // ---- 3. Memory match ----
    // German Memory Cards use the same current article deck as Academy Hub Mobile.
    // Other language targets keep their existing vocabulary source.
    function mobileMemoryPairs() {
      var bank=window.DuvelaMobileArticleBank;
      var level=normalizePracticeLevel(studyState.level,'A1');
      var exercises=bank&&Array.isArray(bank.exercises)?bank.exercises:[];
      return exercises.filter(function(item){return normalizePracticeLevel(item.level,'A1')===level;}).map(function(item){
        return { w:String(item.article||item.art||'')+' '+String(item.noun||''), t:String(item.hint||''), sourceId:item.id };
      }).filter(function(item){return item.w.trim()&&item.t.trim();});
    }
    function memoryPool() {
      var mobile=studyState.lang==='de'?mobileMemoryPairs():[];
      return mobile.length?mobile:strictBank(VOCAB,studyState.lang,studyState.level);
    }
    function renderMemory() {
      var host = $('#studyToolBody');
      if (!studyState.data) {
        var pool=memoryPool();
        if(!pool.length)return noLevelContent();
        var offset=(Number(studyState.memoryDeckIndex)||0)*6%pool.length;
        pool=shuffle(Array.from({length:Math.min(6,pool.length)},function(_item,index){return pool[(offset+index)%pool.length];}));
        var cards = [];
        pool.forEach(function (item, i) {
          cards.push({ id: i, face: item.w, kind: 'w' });
          cards.push({ id: i, face: item.t, kind: 't' });
        });
        studyState.data = shuffle(cards);
        studyState.matched = {}; studyState.first = null; studyState.moves = 0; studyState.busy = false;
      }
      var deck = studyState.data, pairs=Math.round(deck.length/2), mobileSource=studyState.lang==='de'&&mobileMemoryPairs().length;
      host.innerHTML =
        '<section class="memory-match"><header><div><small>'+esc(mobileSource?tr('ACADEMY HUB MOBILE DECK','КОЛОДА ACADEMY HUB MOBILE'):tr('MEMORY MATCH','МЕМОРИ'))+'</small><h2>'+esc(tr('Match each word with its meaning','Соедините слово с переводом'))+'</h2></div><span>'+pairs+' '+esc(tr('pairs','пар'))+'</span></header><div class="memory-match-meta">'+esc(tr('Moves', 'Ходы')) + ': <b id="memMoves">' + studyState.moves + '</b></div>' +
        '<div id="memGrid" class="memory-match-grid">' +
        deck.map(function (c, i) {
          var isMatched = studyState.matched[i];
          var isOpen = studyState.first === i;
          var shown = isMatched || isOpen;
          return '<button class="btn mem-cell'+(shown?' revealed':'')+(isMatched?' matched':'')+'" data-cell="' + i + '"' + (isMatched ? ' disabled' : '') +
            ' aria-label="'+esc(tr('Memory card','Карточка мемори'))+'"><span>'+esc(shown?c.face:'?')+'</span></button>';
        }).join('') + '</div></section>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-cell]'), function (btn) {
        btn.addEventListener('click', function () {
          if (studyState.busy) return;
          var i = Number(btn.getAttribute('data-cell'));
          if (studyState.matched[i] || studyState.first === i) return;
          if (studyState.first === null) { studyState.first = i; renderMemory(); return; }
          studyState.moves++;
          var a = deck[studyState.first], b = deck[i];
          if (a.id === b.id && a.kind !== b.kind) {
            studyState.matched[studyState.first] = true; studyState.matched[i] = true;
            studyState.first = null;
            renderMemory();
            if (Object.keys(studyState.matched).length >= deck.length) {
              setTimeout(function () { finishTool(tr('All matched', 'Все пары') + ' · ' + studyState.moves + ' ' + tr('moves', 'ходов'), 12); }, 300);
            }
          } else {
            studyState.busy = true;
            var firstIdx = studyState.first; studyState.first = i; renderMemory();
            setTimeout(function () {
              studyState.first = null; studyState.busy = false; renderMemory();
            }, 750);
            void firstIdx;
          }
        });
      });
    }

    // Keep the web plan aligned with Academy Hub: recommendations are based on the
    // learner's actual recorded mistakes, review dates and practice progress.
    // The plan only points to existing web trainers; it never invents a lesson.
    function adaptiveSourceKind(mistake) {
      var source = String(mistake.sourceTool || mistake.kind || '').toLowerCase();
      if (/listen/.test(source)) return 'listening';
      if (/read/.test(source)) return 'reading';
      if (/writ/.test(source)) return 'writing';
      if (/exam/.test(source)) return 'exam';
      if (/wordusage|vocab|flashcard|memory|categor/.test(source)) return 'vocabulary';
      if (/article|wquestion|perfekt|grammar|sentence/.test(source)) return 'grammar';
      return 'grammar';
    }
    function adaptiveFoundationKind(score, lang) {
      if (score < 90) return lang === 'de' ? 'grammar' : 'vocabulary';
      if (score < 180) return 'listening';
      if (score < 300) return 'writing';
      return 'exam';
    }
    function adaptiveDueAt(value) { var numeric=Number(value); return Number.isFinite(numeric) ? numeric : new Date(value || 0).getTime(); }
    function adaptiveSupports(kind) {
      return ({ grammar:['essentials','writing'], vocabulary:['writing','ai'], listening:['reading','vocabulary'], reading:['vocabulary','writing'], writing:['grammar','vocabulary'], exam:['listening','grammar'], mistakes:['grammar','reading'], ai:['listening','vocabulary'], essentials:['writing','vocabulary'] }[kind] || ['vocabulary','grammar']);
    }
    function adaptiveStep(kind, reason) {
      var map = {
        mistakes:{ icon:'!', minutes:6 }, grammar:{ icon:'📘', minutes:10 }, vocabulary:{ icon:'Aa', minutes:7 },
        listening:{ icon:'🎧', minutes:8 }, reading:{ icon:'📖', minutes:9 }, writing:{ icon:'📝', minutes:12 },
        ai:{ icon:'✦', minutes:8 }, exam:{ icon:'⏱', minutes:15 }, essentials:{ icon:'📗', minutes:8 }
      };
      var tool = TOOLS.find(function (item) { return item.id === kind; });
      return tool ? { activityId:kind, tool:kind, icon:map[kind].icon, minutes:map[kind].minutes, reason:reason, title:tool.title, description:tool.desc } : null;
    }
    function buildAdaptivePlan(lang, level, progress, allMistakes) {
      var mistakes = allMistakes.filter(function (item) { return !item.lang || item.lang === lang; });
      var now = Date.now();
      var due = mistakes.filter(function (item) { return !item.dueAt || adaptiveDueAt(item.dueAt) <= now; });
      var repeated = mistakes.filter(function (item) { return Number(item.attemptsIncorrect || 1) > 1; });
      var weights = {};
      var topics = {};
      mistakes.forEach(function (item) {
        var kind = adaptiveSourceKind(item);
        var weight = 2 + (!item.dueAt || adaptiveDueAt(item.dueAt) <= now ? 5 : 0) + Math.max(0, Number(item.attemptsIncorrect || 1) - 1) * 3;
        var topic = mistakeTopic(item);
        weights[kind] = (weights[kind] || 0) + weight;
        if (topic.tool && TOOLS.some(function (tool) { return tool.id === topic.tool; })) {
          topics[topic.id] = topics[topic.id] || { id:topic.id, label:topic.label, tool:topic.tool, score:0 };
          topics[topic.id].score += weight;
        }
      });
      var ranked = Object.keys(weights).sort(function (a, b) { return weights[b] - weights[a]; });
      var focus = ranked[0] || adaptiveFoundationKind(Number(progress.xp || 0), lang);
      var topicRank = Object.keys(topics).map(function (key) { return topics[key]; }).sort(function (a, b) { return b.score - a.score; });
      var weakTopic = topicRank[0] || null;
      var candidates = [];
      if (mistakes.length) candidates.push(adaptiveStep('mistakes', 'review'));
      var focusStep = adaptiveStep(weakTopic ? weakTopic.tool : focus, mistakes.length ? 'review' : 'foundation');
      if (focusStep && weakTopic) { focusStep.topicId = weakTopic.id; focusStep.topicLabel = weakTopic.label; focusStep.reasonText = tr('Recommended because you recently missed questions on ', 'Рекомендуется: недавно были ошибки по теме ') + weakTopic.label + '.'; }
      candidates.push(focusStep);
      adaptiveSupports(focus).forEach(function (kind) { candidates.push(adaptiveStep(kind, 'practice')); });
      candidates.push(adaptiveStep(Number(progress.xp || 0) >= 180 || /^(B1|B2|C1|C2)$/.test(level) ? 'exam' : 'ai', 'test'));
      ['grammar','vocabulary','listening','reading','writing','ai','exam'].forEach(function (kind) { candidates.push(adaptiveStep(kind, 'practice')); });
      var seen = {};
      var steps = candidates.filter(function (step) { if (!step || seen[step.tool]) return false; seen[step.tool] = true; return true; }).slice(0, 4);
      return { due:due.length, focus:focus, mistakes:mistakes.length, repeated:repeated.length, steps:steps, weakTopic:weakTopic, signature:[lang,level,mistakes.map(function (item) { return mistakeKey(item) + ':' + item.attemptsIncorrect + ':' + item.dueAt; }).sort().join(',')].join('|') };
    }
    function adaptiveToday() { return new Date().toISOString().slice(0, 10); }
    function loadAdaptivePlan() { try { return JSON.parse(localStorage.getItem(ADAPTIVE_PLAN_KEY) || 'null'); } catch (e) { return null; } }
    function saveAdaptivePlan(plan) { try { localStorage.setItem(ADAPTIVE_PLAN_KEY, JSON.stringify(plan)); } catch (e) {} void syncAdaptivePlan(plan); }
    async function syncAdaptivePlan(plan) {
      if (!uid() || !navigator.onLine || !plan || plan.learnerId !== uid()) return;
      try {
        await supa.from('adaptive_learning_plans').upsert({
          user_id:uid(), plan_date:plan.date, language:plan.lang, current_level:plan.level,
          target_level:plan.targetLevel, plan_version:plan.version, signal:plan.signal || '',
          route:{ steps:plan.steps || [], stats:plan.stats || {}, weakTopic:plan.weakTopic || null },
          status:(plan.steps || []).every(function (step) { return step.status === 'completed'; }) ? 'completed' : 'active',
          updated_at:new Date().toISOString()
        }, { onConflict:'user_id,plan_date,language' });
      } catch (e) { /* local route remains available offline and retries on the next update */ }
    }
    function resolveAdaptivePlan(lang, level, targetLevel, generated) {
      var saved = loadAdaptivePlan(), hasInProgress = saved && Array.isArray(saved.steps) && saved.steps.some(function (step) { return step.status === 'in-progress'; });
      var reusable = saved && saved.version === 1 && saved.date === adaptiveToday() && saved.learnerId === (uid() || 'local') && saved.lang === lang && saved.level === level && saved.targetLevel === targetLevel && (saved.signal === generated.signature || hasInProgress);
      if (reusable) return saved;
      var minutes = 0, steps = generated.steps.filter(function (step) {
        if (minutes && minutes + step.minutes > 40) return false;
        minutes += step.minutes; return true;
      }).map(function (step, index) { return Object.assign({ id:'adaptive-' + adaptiveToday() + '-' + index, status:'not-started' }, step); });
      // Progress made today (here or in the Academy Hub app) carries over by activityId.
      var earlier = saved && saved.date === adaptiveToday() && saved.lang === lang && Array.isArray(saved.steps) ? saved.steps : [];
      steps.forEach(function (step) { var before = earlier.find(function (item) { return (item.activityId || item.tool) === step.activityId; }); if (before && before.status !== 'current') step.status = before.status; });
      var currentStep = steps.find(function (step) { return step.status === 'in-progress'; }) || steps.find(function (step) { return step.status !== 'completed'; });
      if (currentStep && currentStep.status === 'not-started') currentStep.status = 'current';
      var plan = { version:1, learnerId:uid() || 'local', date:adaptiveToday(), lang:lang, level:level, targetLevel:targetLevel, signal:generated.signature, createdAt:Date.now(), updatedAt:Date.now(), steps:steps, stats:{ due:generated.due, mistakes:generated.mistakes, repeated:generated.repeated }, weakTopic:generated.weakTopic };
      saveAdaptivePlan(plan); return plan;
    }
    function markAdaptivePlanStep(stepId, status) {
      var plan = loadAdaptivePlan(); if (!plan || !Array.isArray(plan.steps)) return;
      var changed = false;
      plan.steps.forEach(function (step) { if (step.id === stepId) { step.status = status; changed = true; } });
      if (changed && status === 'completed') {
        var next = plan.steps.find(function (step) { return step.status === 'not-started' || step.status === 'current'; });
        if (next) next.status = 'current';
      }
      plan.updatedAt = Date.now(); saveAdaptivePlan(plan);
    }
    function renderAdaptivePath() {
      var lang = currentLang();
      var level = currentPracticeLevel(lang);
      var progress = loadProgress();
      var targetLevel = studentGoalLevelForTarget(lang, level);
      var generated = buildAdaptivePlan(lang, level, progress, loadMistakes());
      var plan = resolveAdaptivePlan(lang, level, targetLevel, generated);
      var totalMinutes = plan.steps.reduce(function (total, step) { return total + step.minutes; }, 0);
      var focus = plan.steps.find(function (step) { return step.status === 'current' || step.status === 'in-progress'; }) || plan.steps[0];
      var reasonCopy = {
        foundation:tr('Foundation for your current progress','Основа для вашего текущего прогресса'),
        review:tr('Based on your recorded mistakes','На основе сохранённых ошибок'),
        practice:tr('Supports the focus skill','Закрепляет ключевой навык'),
        test:tr('Checks what you can use independently','Проверяет самостоятельное применение')
      };
      var host = $('#studyToolBody');
      host.innerHTML = '<section class="adaptive-path" aria-label="' + esc(tr('Adaptive learning path','Адаптивный маршрут')) + '">' +
        '<header class="adaptive-path-head"><div><small>' + esc(tr('DUVELA / PERSONAL LEARNING','DUVELA / ПЕРСОНАЛЬНОЕ ОБУЧЕНИЕ')) + '</small><h2>' + esc(tr('Your Learning Path','Ваш учебный маршрут')) + '</h2><p>' + esc(String(lang).toUpperCase() + ' · ' + String(level).toUpperCase() + ' → ' + String(targetLevel).toUpperCase()) + '</p></div><span>' + esc(tr('Today','Сегодня')) + '</span></header>' +
        '<div class="adaptive-summary"><div><small>✦ ' + esc(tr('TODAY’S MISSION','ЗАДАЧА НА СЕГОДНЯ')) + '</small><h3>' + esc(focus ? focus.title : tr('Practice','Практика')) + '</h3><p>' + esc(focus && focus.reasonText ? focus.reasonText : focus ? reasonCopy[focus.reason] : '') + '</p></div><b>◷ ' + esc(String(totalMinutes)) + ' ' + esc(tr('min','мин')) + '</b><dl><div><dt>' + plan.steps.filter(function (step) { return step.status === 'completed'; }).length + '/' + plan.steps.length + '</dt><dd>' + esc(tr('completed','завершено')) + '</dd></div><div><dt>' + plan.stats.due + '</dt><dd>' + esc(tr('due now','сейчас')) + '</dd></div><div><dt>' + plan.stats.repeated + '</dt><dd>' + esc(tr('repeated','повторных')) + '</dd></div></dl></div>' +
        '<div class="adaptive-route-head"><div><small>' + esc(tr('TODAY’S LEARNING ROUTE','МАРШРУТ НА СЕГОДНЯ')) + '</small><h3>' + esc(tr('Continue with the current step','Продолжите с текущего шага')) + '</h3></div><span>' + plan.steps.length + ' ' + esc(tr('steps','шага')) + '</span></div>' +
        '<ol class="adaptive-step-list">' + plan.steps.map(function (step, index) { var current=step.status==='current'||step.status==='in-progress', completed=step.status==='completed', statusLabel=completed?tr('Completed','Завершено'):current?(step.status==='in-progress'?tr('In progress','В процессе'):tr('Current','Текущий')):tr('Next','Далее'); return '<li class="' + (current ? 'is-next ' : '') + (completed ? 'is-complete' : '') + '"><span class="adaptive-step-index">' + (completed ? '✓' : index + 1) + '</span><span class="adaptive-step-icon">' + esc(step.icon) + '</span><div><small>' + esc(step.reasonText || reasonCopy[step.reason]) + '</small><h4>' + esc(step.title) + (step.topicLabel ? ' · ' + esc(step.topicLabel) : '') + '</h4><p>' + esc(step.description) + '</p></div><button type="button" data-adaptive-tool="' + esc(step.tool) + '" data-adaptive-step="' + esc(step.id) + '"' + (completed ? ' disabled' : '') + '>' + esc(completed ? statusLabel : current ? (step.status==='in-progress'?tr('Continue','Продолжить'):tr('Start lesson','Начать урок')) : tr('Open','Открыть')) + (completed ? '' : ' <em>→</em>') + '</button><b>' + esc(statusLabel) + ' · ' + step.minutes + ' ' + esc(tr('min','мин')) + '</b></li>'; }).join('') + '</ol>' +
        (!plan.stats.mistakes ? '<aside class="adaptive-empty">✦ ' + esc(tr('No recorded mistakes yet. This is a transparent level-based starter route.','Пока нет сохранённых ошибок. Это прозрачный стартовый маршрут для вашего уровня.')) + '</aside>' : '') +
        '</section>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-adaptive-tool]'), function (button) {
        button.onclick = function () { var stepId=button.getAttribute('data-adaptive-step'); markAdaptivePlanStep(stepId, 'in-progress'); openStudyTool(button.getAttribute('data-adaptive-tool'), { lang:lang, level:level, adaptivePlanStepId:stepId }); };
      });
    }

    function renderProgressHub() {
      var progress = loadProgress(), sessions = progress.sessions || [], mistakes = loadMistakes();
      var progressModes = [
        { tool:'exam', icon:'⏱', title:tr('Exam mode','Режим экзамена'), desc:tr('Timed mixed practice and full mock exam.','Смешанная практика на время и полный пробный экзамен.') },
        { tool:'mistakes', icon:'!', title:tr('Mistake center','Центр ошибок'), desc:tr('Review weak topics and return to exact problem areas.','Повторяйте слабые темы и возвращайтесь в точные проблемные места.') },
        { tool:'history', icon:'↺', title:tr('Practice history','История практики'), desc:tr('See completed tools, XP and recent sessions.','Смотрите завершённые режимы, XP и недавние занятия.') },
        { tool:'calendar', icon:'▦', title:tr('Activity calendar','Календарь занятий'), desc:tr('Track streaks and recent activity by day.','Следите за серией и активностью по дням.') },
        { tool:'achievements', icon:'🏆', title:tr('Achievements','Достижения'), desc:tr('View unlocked milestones and learning rewards.','Смотрите открытые достижения и учебные награды.') },
        { tool:'ranking', icon:'🥇', title:tr('Leaderboard','Таблица лидеров'), desc:tr('Compare XP and ranking with other learners.','Сравнивайте XP и своё место с другими учениками.') },
        { tool:'settings', icon:'⚙', title:tr('Practice settings','Настройки практики'), desc:tr('Control reminders, sounds and accessibility options.','Управляйте напоминаниями, звуками и настройками удобства.') }
      ];
      $('#studyToolBody').innerHTML =
        '<section class="progress-hub">' +
          '<div class="progress-hub-hero">' +
            '<div class="progress-hub-copy">' +
              '<small>' + esc(tr('PROGRESS ACTIVE', 'PROGRESS ACTIVE')) + '</small>' +
              '<h2>' + esc(tr('Exam and progress hub','Хаб экзамена и прогресса')) + '</h2>' +
              '<p>' + esc(tr('All exam, review and progress tools are collected in one clean hub for faster navigation and a clearer learner journey.','Все инструменты экзамена, повторения и прогресса собраны в одном понятном хабе для быстрой навигации и ясного пути ученика.')) + '</p>' +
            '</div>' +
            '<div class="progress-hub-stats">' +
              '<span><b>' + Number(progress.xp || 0) + '</b><small>XP</small></span>' +
              '<span><b>' + mistakes.length + '</b><small>' + esc(tr('mistakes','ошибок')) + '</small></span>' +
              '<span><b>' + sessions.length + '</b><small>' + esc(tr('sessions','занятий')) + '</small></span>' +
            '</div>' +
          '</div>' +
          '<div class="progress-bank-note"><strong>' + esc(tr('Progress base','База прогресса')) + '</strong><p>' + esc(tr('Instead of opening each report separately, learners get one structured space for exam prep, review, stats and personal settings.','Вместо отдельных экранов ученик получает одну структурированную зону для подготовки к экзамену, повторения, статистики и личных настроек.')) + '</p></div>' +
          '<div class="progress-topic-grid">' + progressModes.map(function (item) {
            return '<article class="progress-topic-card">' +
              '<div class="progress-topic-top"><i>' + item.icon + '</i><span>' + esc(item.tool === 'mistakes' ? String(mistakes.length) : item.tool === 'history' ? String(sessions.length) : item.tool === 'ranking' ? 'XP' : tr('Open','Открыть')) + '</span></div>' +
              '<h3>' + esc(item.title) + '</h3>' +
              '<p>' + esc(item.desc) + '</p>' +
              '<button type="button" data-progress-tool="' + esc(item.tool) + '">' + esc(tr('Open section','Открыть раздел')) + ' <em>→</em></button>' +
            '</article>';
          }).join('') + '</div>' +
        '</section>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-progress-tool]'), function (button) {
        button.onclick = function () { openStudyTool(button.getAttribute('data-progress-tool'), { lang:studyState.lang, level:studyState.level, progressDirect:true }); };
      });
    }

    // W-questions retains the reviewed mobile starter bank. Its one counter, attempts,
    // mistakes and completion still use the shared practice services below.
    function renderWQuestions() {
      if (!studyState.data) studyState.data = shuffle(W_QUESTIONS.map(function (item) { return Object.assign({}, item, { opts:item.opts.slice() }); }));
      var deck = studyState.data;
      if (!deck.length) return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx], host = $('#studyToolBody');
      var selected = Number.isInteger(studyState.wQuestionSelected) ? studyState.wQuestionSelected : null;
      var checked = !!studyState.wQuestionChecked;
      var lang = String(document.documentElement.lang || '').toLowerCase().slice(0,2);
      var locale = ctx.isRu ? 'ru' : lang === 'de' ? 'de' : 'en';
      var answer = item.opts[item.a];
      var feedbackHtml = '';
      if (checked) {
        var ok = selected === item.a;
        feedbackHtml = '<section class="w-question-feedback" aria-live="polite"><div class="' + (ok ? 'ok' : 'bad') + '"><b>' + esc(ok ? tr('Correct!','Верно!') : tr('Correct answer: ','Правильный ответ: ') + answer) + '</b><p class="w-question-full">' + esc(item.full) + '</p><p>' + esc(item.translation[locale] || item.translation.en) + '</p><hr><p>' + esc(item.explanation[locale] || item.explanation.en) + '</p><p><b>' + esc(tr('Example: ','Пример: ')) + '</b>' + esc(item.example.de) + '<br><small>' + esc(item.example[locale] || item.example.en) + '</small></p></div></section>';
      }
      host.innerHTML = '<section class="w-question-trainer"><header><div><small>DUVELA · GERMAN ' + esc(studyState.level) + '</small><h2>W-Questions</h2><p>' + esc(tr('Choose the question word that fits.','Выберите подходящее вопросительное слово.')) + '</p></div><b>' + (studyState.idx + 1) + ' / ' + deck.length + '</b></header><i aria-hidden="true"><em style="width:' + Math.round((studyState.idx + 1) / deck.length * 100) + '%"></em></i><main><small>' + esc(tr('CHOOSE THE QUESTION WORD','ВЫБЕРИТЕ ВОПРОСИТЕЛЬНОЕ СЛОВО')) + '</small><h3>' + esc(item.q) + '</h3><div class="w-question-options">' + item.opts.map(function (option, index) { var state = checked ? (index === item.a ? 'correct' : index === selected ? 'wrong' : '') : selected === index ? 'selected' : ''; return '<button type="button" data-w-option="' + index + '" class="' + state + '"' + (checked ? ' disabled' : '') + '>' + esc(option) + '</button>'; }).join('') + '</div>' + feedbackHtml + '<footer class="w-question-footer">'+(checked ? '<button type="button" class="w-question-continue" data-w-continue>' + esc(tr('Continue','Продолжить')) + ' →</button>' : '<button type="button" class="w-question-check" data-w-check' + (selected === null ? ' disabled' : '') + '>' + esc(tr('Check answer','Проверить ответ')) + '</button>') + '<button type="button" class="w-question-exit" data-w-exit>' + esc(tr('Exit practice','Выйти из практики')) + '</button></footer></main></section>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-w-option]'), function (button) { button.onclick = function () { studyState.wQuestionSelected = Number(button.getAttribute('data-w-option')); renderWQuestions(); }; });
      var check = host.querySelector('[data-w-check]');
      if (check) check.onclick = function () {
        var chosen = studyState.wQuestionSelected, ok = chosen === item.a;
        studyState.wQuestionChecked = true;
        feedback(ok, { prompt:item.q, chosen:item.opts[chosen], correct:answer, explanation:item.explanation[locale] || item.explanation.en });
        if (ok) { studyState.score++; clearMistake(studyState.lang, 'wquestion:'+item.q); }
        else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq',{sourceTool:'wquestion',questionId:'wquestion:'+item.q,level:studyState.level,explanation:item.explanation[locale] || item.explanation.en,selectedAnswer:item.opts[chosen]});
        renderWQuestions();
      };
      var continueButton = host.querySelector('[data-w-continue]');
      if (continueButton) continueButton.onclick = function () { studyState.idx++; studyState.wQuestionSelected = null; studyState.wQuestionChecked = false; persistResume(); renderWQuestions(); };
      var exit = host.querySelector('[data-w-exit]');
      if (exit) exit.onclick = function () { closeStudy(); };
    }

    function renderSpecialQuiz(source, rerender) {
      if (!studyState.data) studyState.data = shuffle(source);
      quizStep(studyState.data, rerender, function (item) { return item.q; });
    }

    function renderPracticeHistory() {
      if (!studyState.progressDirect) return renderProgressHub();
      var progress = loadProgress();
      var recentSessions = progress.sessions || [];
      var rows = TOOLS.filter(function (tool) { return Number(progress[tool.id]) > 0; }).sort(function (a,b) { return Number(progress[b.id]) - Number(progress[a.id]); });
      $('#studyToolBody').innerHTML = '<div class="practice-history-summary"><span><b>' + (progress.xp || 0) + '</b>XP</span><span><b>' + Math.max(recentSessions.length,rows.reduce(function (sum,tool) { return sum + Number(progress[tool.id] || 0); },0)) + '</b>' + esc(tr('Sessions', 'Занятий')) + '</span><span><b>' + loadMistakes().length + '</b>' + esc(tr('Mistakes', 'Ошибок')) + '</span></div><div class="practice-history-list">' + (rows.length ? rows.map(function (tool) { return '<button data-history-tool="' + esc(tool.id) + '"><span>' + tool.icon + '</span><div><b>' + esc(tool.title) + '</b><small>' + Number(progress[tool.id]) + ' ' + esc(tr('completed sessions', 'завершённых занятий')) + '</small></div><strong>→</strong></button>'; }).join('') : '<div class="empty">' + esc(tr('Complete your first practice and it will appear here.', 'Завершите первую практику — она появится здесь.')) + '</div>') + '</div>' + (recentSessions.length ? '<h3>' + esc(tr('Recent activity','Недавняя активность')) + '</h3><div class="recent-session-list">' + recentSessions.slice(0,10).map(function (session) { return '<article><div><b>' + esc((TOOLS.find(function(t){return t.id===session.tool_id;})||{}).title || session.tool_id) + '</b><small>' + new Date(session.completed_at).toLocaleString() + '</small></div><span>' + Number(session.score||0) + '/' + Number(session.total||0) + '</span><strong>+' + Number(session.xp_awarded||0) + ' XP</strong></article>'; }).join('') + '</div>' : '');
      Array.prototype.forEach.call(document.querySelectorAll('[data-history-tool]'), function (button) { button.onclick = function () { openStudyTool(button.getAttribute('data-history-tool')); }; });
    }

    function renderDictionary() {
      var words = loadSavedWords().filter(function (word) { return word.lang === studyState.lang; });
      var now = Date.now();
      $('#studyToolBody').innerHTML = '<div class="dictionary-toolbar"><input id="dictionarySearch" placeholder="' + esc(tr('Search saved words…','Поиск сохранённых слов…')) + '"><span>' + words.length + ' ' + esc(tr('words','слов')) + '</span></div><div class="dictionary-list">' + (words.length ? words.map(function (word,index) { var due = !word.dueAt || new Date(word.dueAt).getTime() <= now; return '<article data-dictionary-row="' + index + '"><div><b>' + esc(word.w) + '</b><p>' + esc(word.t || '') + '</p></div><span class="' + (due ? 'due' : '') + '">' + (due ? esc(tr('Due now','Повторить')) : esc(tr('Box ','Коробка ')) + Number(word.box || 1)) + '</span><button data-word-review="' + index + '">✓</button><button data-word-delete="' + index + '">×</button></article>'; }).join('') : '<div class="empty">' + esc(tr('Save words from flashcards and they will appear here.','Сохраняйте слова во флешкартах — они появятся здесь.')) + '</div>') + '</div>';
      $('#dictionarySearch').oninput = function () { var query = this.value.trim().toLowerCase(); Array.prototype.forEach.call(document.querySelectorAll('[data-dictionary-row]'),function (row) { row.hidden = query && row.textContent.toLowerCase().indexOf(query) < 0; }); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-word-review]'),function (button) { button.onclick = function () { var all = loadSavedWords(), target = words[Number(button.getAttribute('data-word-review'))], found = all.find(function (item) { return item.lang === target.lang && item.w === target.w; }); if (found) { found.box = Math.min(5,Number(found.box || 1) + 1); found.dueAt = new Date(Date.now() + Math.pow(2,found.box) * 86400000).toISOString(); localStorage.setItem(SAVED_WORDS_KEY,JSON.stringify(all)); syncPracticeData(); renderDictionary(); } }; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-word-delete]'),function (button) { button.onclick = function () { var target = words[Number(button.getAttribute('data-word-delete'))], all = loadSavedWords().filter(function (item) { return !(item.lang === target.lang && item.w === target.w); }); localStorage.setItem(SAVED_WORDS_KEY,JSON.stringify(all)); if (uid()) supa.from('practice_saved_words').delete().eq('user_id',uid()).eq('language',target.lang).eq('word',target.w); renderDictionary(); }; });
    }

    function renderActivityCalendar() {
      if (!studyState.progressDirect) return renderProgressHub();
      var progress = loadProgress(), sessions = progress.sessions || [], active = {};
      sessions.forEach(function (session) { if (session.completed_at) active[String(session.completed_at).slice(0,10)] = (active[String(session.completed_at).slice(0,10)] || 0) + 1; });
      var days = [], today = new Date(); for (var i=34;i>=0;i--) { var date = new Date(today); date.setDate(today.getDate()-i); var key = date.toISOString().slice(0,10); days.push('<div class="calendar-day ' + (active[key] ? 'active level-' + Math.min(3,active[key]) : '') + '" title="' + key + '"><b>' + date.getDate() + '</b><small>' + (active[key] || '') + '</small></div>'); }
      var week=[];for(var w=6;w>=0;w--){var wd=new Date(today);wd.setDate(today.getDate()-w);var wk=wd.toISOString().slice(0,10),count=active[wk]||0;week.push({label:wd.toLocaleDateString(undefined,{weekday:'short'}),count:count});}var weekTotal=week.reduce(function(sum,item){return sum+item.count;},0);
      $('#studyToolBody').innerHTML = '<div class="calendar-summary"><span>🔥 <b>' + Number(progress.streak && progress.streak.current_streak || 0) + '</b><small>' + esc(tr('Current streak','Текущая серия')) + '</small></span><span>🏆 <b>' + Number(progress.streak && progress.streak.longest_streak || 0) + '</b><small>' + esc(tr('Best streak','Лучшая серия')) + '</small></span><span>✓ <b>' + sessions.length + '</b><small>' + esc(tr('Sessions','Занятий')) + '</small></span></div><div class="weekly-report"><div><small>'+esc(tr('THIS WEEK','ЭТА НЕДЕЛЯ'))+'</small><h3>'+weekTotal+' '+esc(tr('sessions completed','занятий выполнено'))+'</h3></div><div class="weekly-bars">'+week.map(function(item){return '<span><i style="height:'+Math.max(6,Math.min(100,item.count*24))+'%"></i><small>'+esc(item.label)+'</small></span>';}).join('')+'</div></div><div class="activity-calendar">' + days.join('') + '</div>';
    }

    function renderAchievements() {
      if (!studyState.progressDirect) return renderProgressHub();
      var progress = loadProgress(), unlocked = new Set((progress.achievements || []).map(function (row) { return row.achievement_id; }));
      var definitions = [{id:'first-step',icon:'🌱',title:tr('First step','Первый шаг'),ok:Number(progress.xp||0)>0},{id:'streak-3',icon:'🔥',title:tr('Three-day streak','Серия 3 дня'),ok:unlocked.has('streak-3')},{id:'practice-10',icon:'⚡',title:tr('Ten practices','10 практик'),ok:unlocked.has('practice-10')},{id:'xp-500',icon:'🏅',title:'500 XP',ok:unlocked.has('xp-500')},{id:'polyglot',icon:'🌍',title:tr('Polyglot','Полиглот'),ok:Object.keys(progress).filter(function (key) { return ['de','en','es'].indexOf(key)>=0; }).length>1},{id:'perfect',icon:'💎',title:tr('Perfect session','Идеальное занятие'),ok:(progress.sessions||[]).some(function (s) { return s.total && s.score>=s.total; })}];
      $('#studyToolBody').innerHTML = '<div class="achievement-hero"><span>🏆</span><div><small>' + esc(tr('YOUR COLLECTION','ВАША КОЛЛЕКЦИЯ')) + '</small><h2>' + definitions.filter(function (item) { return item.ok; }).length + '/' + definitions.length + '</h2></div></div><div class="achievement-grid">' + definitions.map(function (item) { return '<article class="' + (item.ok ? 'unlocked' : 'locked') + '"><span>' + item.icon + '</span><b>' + esc(item.title) + '</b><small>' + (item.ok ? '✓ ' + esc(tr('Unlocked','Получено')) : '🔒 ' + esc(tr('Keep learning','Продолжайте учиться'))) + '</small></article>'; }).join('') + '</div>';
    }

    async function renderPracticeRanking() {
      if (!studyState.progressDirect) return renderProgressHub();
      var host=$('#studyToolBody');host.innerHTML='<div class="practice-skeleton"><i></i><i></i><i></i><i></i></div>';
      try { var result=await window.DuvelaWebConfig.rankingProfiles(supa, 'id,full_name,avatar_url,score,language_level').order('score',{ascending:false}).limit(20);var rows=result.data||[];host.innerHTML='<div class="ranking-podium">' + rows.slice(0,3).map(function(row,index){return '<article class="place-' + (index+1) + '"><span>' + ['🥇','🥈','🥉'][index] + '</span><b>' + esc(row.full_name||tr('Duvela learner','Ученик Duvela')) + '</b><strong>' + Number(row.score||0) + ' XP</strong></article>';}).join('') + '</div><div class="ranking-list">' + rows.slice(3).map(function(row,index){return '<article class="' + (String(row.id)===String(uid())?'me':'') + '"><b>#' + (index+4) + '</b><span>' + esc(row.full_name||tr('Duvela learner','Ученик Duvela')) + '</span><small>' + esc(row.language_level||'') + '</small><strong>' + Number(row.score||0) + ' XP</strong></article>';}).join('') + '</div>'; } catch(e){host.innerHTML='<div class="empty">'+esc(tr('Ranking is temporarily unavailable.','Рейтинг временно недоступен.'))+'</div>';}
    }

    function renderPracticeSettings() {
      if (!studyState.progressDirect) return renderProgressHub();
      var prefs = loadPrefs();
      $('#studyToolBody').innerHTML = '<div class="practice-settings-list">' + [['sound','🔊',tr('Answer sounds','Звуки ответов')],['reducedMotion','◌',tr('Reduce motion','Уменьшить анимацию')],['largeText','A+',tr('Large text','Крупный текст')],['reminders','🔔',tr('Daily reminder','Ежедневное напоминание')]].map(function (item) { return '<label><span>' + item[1] + '</span><b>' + esc(item[2]) + '</b><input type="checkbox" data-setting="' + item[0] + '"' + (prefs[item[0]] ? ' checked' : '') + '></label>'; }).join('') + '<label><span>⏰</span><b>' + esc(tr('Reminder time','Время напоминания')) + '</b><input type="time" id="practiceReminderTime" value="' + esc(prefs.reminderTime || '18:00') + '"></label><button class="btn" id="practiceResetLocal">' + esc(tr('Clear local practice cache','Очистить локальный кэш практики')) + '</button></div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-setting]'),function (input) { input.onchange = async function () { var next = loadPrefs(), key = input.getAttribute('data-setting'); next[key] = input.checked; savePrefs(next); if (key === 'reminders' && input.checked && window.Notification) await Notification.requestPermission(); schedulePracticeReminder(); if (key === 'reminders' && uid()) supa.from('practice_reminders').upsert({ user_id:uid(),enabled:next.reminders,reminder_time:next.reminderTime,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,updated_at:new Date().toISOString() }); }; });
      $('#practiceReminderTime').onchange = function () { var next=loadPrefs();next.reminderTime=this.value;savePrefs(next);schedulePracticeReminder();if(uid())supa.from('practice_reminders').upsert({user_id:uid(),enabled:next.reminders,reminder_time:next.reminderTime,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,updated_at:new Date().toISOString()}); };
      $('#practiceResetLocal').onclick = async function () { var ok = ctx.confirm ? await ctx.confirm(tr('Clear only local cached progress? Cloud history remains safe.', '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448? \u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f.'), { title: tr('Clear local cache?', '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448?'), confirmLabel: tr('Clear cache', '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c'), cancelLabel: tr('Cancel', '\u041e\u0442\u043c\u0435\u043d\u0430'), tone: 'danger', icon: '!' }) : confirm(tr('Clear only local cached progress? Cloud history remains safe.', '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448? \u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f.')); if (!ok) return; [PROGRESS_KEY,RESUME_KEY,MISTAKE_KEY,SAVED_WORDS_KEY].forEach(function (key) { localStorage.removeItem(key); }); location.reload(); };
    }

    // ---- 4. Grammar Aktiv: generated from the Duvela Academy Hub Mobile source ----
    function mobileGrammarBank() {
      return window.DuvelaGermanGrammarMobileBank && Array.isArray(window.DuvelaGermanGrammarMobileBank.topics) ? window.DuvelaGermanGrammarMobileBank : null;
    }
    function grammarLocaleValue(topic, key) {
      if (ctx.isRu && topic[key + 'Ru']) return topic[key + 'Ru'];
      var locale = String(document.documentElement.lang || '').toLowerCase();
      if (locale.indexOf('tr') === 0 && topic[key + 'Tr']) return topic[key + 'Tr'];
      if (locale.indexOf('de') === 0 && topic[key + 'De']) return topic[key + 'De'];
      return topic[key + 'En'] || topic[key + 'De'] || topic[key + 'Ru'] || '';
    }
    function grammarAcademyTopics(level) {
      var bank = mobileGrammarBank();
      return studyState.lang === 'de' && bank ? bank.topics.filter(function (topic) { return topic.level === level; }) : [];
    }
    function grammarAcademyPool(topicId) {
      var topic = grammarAcademyTopics(studyState.level).find(function (item) { return item.id === topicId; });
      if (!topic) return strictBank(GRAMMAR, studyState.lang, studyState.level);
      return topic.exercises.map(function (item) {
        var answerIndex = item.options.indexOf(item.answer);
        return { q:(item.prompt ? item.prompt + ' ' : '') + item.sentence, opts:item.options, a:answerIndex < 0 ? 0 : answerIndex, explanation:grammarLocaleValue(item, 'feedback'), sourceAnswer:item.answer, sourceId:item.id };
      });
    }
    function grammarTopicExamples(topic) {
      if (Array.isArray(topic.examples) && topic.examples.length) return topic.examples;
      return String(topic.example || '').split(/(?<=[.!?])\s+/).filter(Boolean);
    }
    var GRAMMAR_TOPIC_MASTERY_THRESHOLD = 80;
    function grammarTopicProgress(topic) {
      var progress = loadProgress(), rows = progress.grammarTopicProgress || {}, row = rows[topic.id] || {};
      var answered = row.answered || {}, answeredCount = Object.keys(answered).length;
      var attempts = Number(row.attempts || 0), correct = Number(row.correct || 0);
      return { answered:answeredCount, total:topic.exercises.length, attempts:attempts, correct:correct, accuracy:attempts ? Math.round(correct / attempts * 100) : null, lastStudied:row.lastStudied || null };
    }
    function recordGrammarTopicAnswer(item, ok) {
      if (!studyState || studyState.tool !== 'grammar' || !studyState.grammarTopic || !item.sourceId) return;
      var progress = loadProgress(), rows = progress.grammarTopicProgress || {}, row = rows[studyState.grammarTopic] || { answered:{}, attempts:0, correct:0 };
      row.answered = row.answered || {}; row.answered[item.sourceId] = true;
      row.attempts = Number(row.attempts || 0) + 1;
      if (ok) row.correct = Number(row.correct || 0) + 1;
      row.lastStudied = Date.now(); rows[studyState.grammarTopic] = row; progress.grammarTopicProgress = rows; saveProgress(progress);
    }
    function grammarTopicStatus(topic) {
      var progress = grammarTopicProgress(topic);
      if (!progress.answered) return 'not-started';
      if (progress.answered < progress.total) return 'in-progress';
      return progress.accuracy !== null && progress.accuracy >= GRAMMAR_TOPIC_MASTERY_THRESHOLD ? 'mastered' : 'completed';
    }
    function grammarTopicMistakes(topic) {
      var prompts = {};
      (topic.exercises || []).forEach(function (exercise) { prompts[(exercise.prompt ? exercise.prompt + ' ' : '') + exercise.sentence] = true; });
      return loadMistakes().filter(function (mistake) { return mistake.lang === 'de' && prompts[mistake.prompt]; });
    }
    function renderGrammar() {
      var grammarChrome = $('#studyOverlayBody'), stageIntro = grammarChrome && grammarChrome.querySelector('.practice-stage-intro'), sessionLine = grammarChrome && grammarChrome.querySelector('.practice-session-line'), gamebar = grammarChrome && grammarChrome.querySelector('.practice-gamebar');
      var grammarOverlay = $('#studyOverlay');
      if (grammarOverlay) grammarOverlay.setAttribute('data-grammar-phase', !studyState.grammarTopic ? 'library' : studyState.grammarPhase === 'practice' ? 'practice' : 'lesson');
      if (stageIntro) stageIntro.hidden = true;
      if (sessionLine) sessionLine.hidden = !studyState.grammarTopic || studyState.grammarPhase !== 'practice';
      if (gamebar) gamebar.hidden = !studyState.grammarTopic || studyState.grammarPhase !== 'practice';
      var bank = mobileGrammarBank();
      if (studyState.lang !== 'de' || !bank) { $('#studyToolBody').innerHTML = '<div class="empty"><b>' + esc(tr('Grammar Aktiv is available for German.','Grammatik aktiv доступна для немецкого.')) + '</b></div>'; return; }
      var topics = grammarAcademyTopics(studyState.level);
      if (!topics.length) return noLevelContent();
      if (!studyState.grammarTopic) return renderGrammarLibrary(topics);
      var topic = topics.find(function (item) { return item.id === studyState.grammarTopic; });
      if (!topic) { studyState.grammarTopic = null; studyState.grammarPhase = ''; return renderGrammar(); }
      if (studyState.grammarPhase !== 'practice') return renderGrammarLesson(topic);
      if (!studyState.data) studyState.data = shuffle(grammarAcademyPool(topic.id));
      if (!studyState.data.length) return noLevelContent();
      renderGrammarExercise(studyState.data, topic);
    }
    function renderGrammarLibrary(topics) {
      var totalExercises = topics.reduce(function (sum, topic) { return sum + topic.exercises.length; }, 0);
      var progressRows = topics.map(function (topic) { return grammarTopicProgress(topic); });
      var completed = topics.filter(function (topic) { return ['completed','mastered'].indexOf(grammarTopicStatus(topic)) >= 0; }).length;
      var current = topics.find(function (topic) { return grammarTopicStatus(topic) === 'in-progress'; }) || topics.find(function (topic) { return grammarTopicStatus(topic) === 'not-started'; });
      var currentIndex = current ? topics.indexOf(current) : topics.length - 1;
      var next = topics[currentIndex + 1] || null;
      var categories = topics.map(function (topic) { return topic.unit; }).filter(function (value, index, list) { return list.indexOf(value) === index; });
      var mistakes = topics.reduce(function (sum, topic) { return sum + grammarTopicMistakes(topic).length; }, 0);
      var host = $('#studyToolBody');
      host.innerHTML = '<section class="grammar-academy" data-grammar-view="library">' +
        '<header class="grammar-academy-header"><div><small>DUVELA / GRAMMAR ACADEMY</small><h2>Grammatik aktiv</h2><p>German · ' + esc(studyState.level) + ' · ' + esc(tr('Learn, practise and review.','Изучайте, практикуйтесь и повторяйте.')) + '</p></div><span class="grammar-level-chip">' + esc(studyState.level) + '</span></header>' +
        '<div class="grammar-summary"><article><small>' + esc(tr('Topics','Темы')) + '</small><b>' + topics.length + '</b></article><article><small>' + esc(tr('Exercises','Упражнения')) + '</small><b>' + totalExercises + '</b></article><article><small>' + esc(tr('Completed','Завершено')) + '</small><b>' + (completed ? completed : '—') + '</b></article></div>' +
        '<div class="grammar-layout"><main>' +
          '<section class="grammar-learning-path"><small>' + esc(tr('LEARNING PATH','УЧЕБНЫЙ МАРШРУТ')) + '</small><h3>' + esc(current ? tr('Your next grammar topic','Ваша следующая тема') : tr('Your A2 path is complete','Ваш путь A2 завершён')) + '</h3>' + (current ? '<p><b>' + esc(current.title) + '</b> · ' + esc(current.focus) + '</p><button type="button" data-grammar-entry="' + esc(current.id) + '">' + esc(grammarTopicStatus(current) === 'in-progress' ? tr('Continue learning','Продолжить обучение') : tr('Start learning','Начать обучение')) + ' →</button>' : '<p>' + esc(tr('Practise any topic again to strengthen your German.','Повторите любую тему, чтобы закрепить немецкий.')) + '</p>') + (next ? '<span>' + esc(tr('Next','Далее')) + ': ' + esc(next.title) + '</span>' : '') + '</section>' +
          '<section class="grammar-library-head"><div><small>' + esc(tr('GRAMMAR TOPICS','ТЕМЫ ГРАММАТИКИ')) + '</small><h3>' + esc(tr('A2 topic library','Библиотека тем A2')) + '</h3></div><span data-grammar-count>' + topics.length + '</span></section>' +
          '<div class="grammar-filters"><input type="search" data-grammar-search placeholder="' + esc(tr('Search grammar topics…','Поиск тем грамматики…')) + '"><select data-grammar-category><option value="all">' + esc(tr('All categories','Все категории')) + '</option>' + categories.map(function (category) { return '<option value="' + esc(category) + '">' + esc(category) + '</option>'; }).join('') + '</select><select data-grammar-status><option value="all">' + esc(tr('All progress','Весь прогресс')) + '</option><option value="not-started">' + esc(tr('Not started','Не начато')) + '</option><option value="in-progress">' + esc(tr('In progress','В процессе')) + '</option><option value="completed">' + esc(tr('Completed','Завершено')) + '</option></select></div>' +
          '<div class="grammar-topic-list">' + topics.map(function (topic) { return grammarTopicCard(topic); }).join('') + '</div>' +
        '</main><aside class="grammar-context-rail">' +
          '<section class="grammar-rail-card"><small>' + esc(tr('LEARNING PROGRESS','ПРОГРЕСС ОБУЧЕНИЯ')) + '</small><h3>' + completed + ' / ' + topics.length + '</h3><p>' + esc(tr('Topics completed with recorded answers.','Темы, завершённые по сохранённым ответам.')) + '</p><i><em style="width:' + Math.round(completed / topics.length * 100) + '%"></em></i></section>' +
          '<section class="grammar-rail-card"><small>' + esc(tr('MISTAKE REVIEW','ПОВТОР ОШИБОК')) + '</small><h3>' + (mistakes || '—') + '</h3><p>' + esc(mistakes ? tr('Recorded grammar mistakes are ready to retry.','Сохранённые ошибки по грамматике готовы к повторению.') : tr('No recorded A2 grammar mistakes yet.','Сохранённых ошибок по грамматике A2 пока нет.')) + '</p>' + (mistakes ? '<button type="button" data-grammar-mistakes>' + esc(tr('Review mistakes','Повторить ошибки')) + ' →</button>' : '') + '</section>' +
          '<section class="grammar-rail-card grammar-level-switch"><small>' + esc(tr('CEFR LEVEL','УРОВЕНЬ CEFR')) + '</small><div>' + ((mobileGrammarBank() || {}).levels || []).map(function (level) { return '<button type="button" class="' + (level === studyState.level ? 'active' : '') + '" data-grammar-level="' + level + '">' + level + '</button>'; }).join('') + '</div></section>' +
        '</aside></div></section>';
      wireGrammarLibrary(host);
    }
    function grammarTopicCard(topic) {
      var progress = grammarTopicProgress(topic), status = grammarTopicStatus(topic), mistakes = grammarTopicMistakes(topic).length;
      var statusText = status === 'not-started' ? tr('Not started','Не начато') : status === 'in-progress' ? tr('In progress','В процессе') : status === 'mastered' ? tr('Mastered','Освоено') : tr('Completed','Завершено');
      var action = status === 'not-started' ? tr('Start learning','Начать обучение') : status === 'in-progress' ? tr('Continue','Продолжить') : mistakes ? tr('Review mistakes','Повторить ошибки') : tr('Practice again','Практиковаться снова');
      return '<article class="grammar-topic-row" data-grammar-topic data-category="' + esc(topic.unit) + '" data-status="' + status + '"><span class="grammar-topic-icon">▤</span><div class="grammar-topic-copy"><h4>' + esc(topic.title) + '</h4><p>' + esc(topic.focus) + '</p><small>' + esc(topic.unit) + ' · ' + topic.exercises.length + ' ' + esc(tr('exercises','упражнений')) + '</small></div><div class="grammar-topic-progress"><b>' + (progress.answered ? progress.answered + '/' + progress.total : '—') + '</b><small>' + esc(statusText) + '</small>' + (progress.answered ? '<i><em style="width:' + Math.round(progress.answered / progress.total * 100) + '%"></em></i>' : '') + '</div><button type="button" data-grammar-entry="' + esc(topic.id) + '">' + esc(action) + ' →</button></article>';
    }
    function wireGrammarLibrary(host) {
      function openTopic(id) { studyState.grammarTopic = id; studyState.grammarPhase = 'learn'; studyState.data = null; renderGrammar(); }
      Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-entry]'), function (button) { button.onclick = function () { openTopic(button.getAttribute('data-grammar-entry')); }; });
      var search = host.querySelector('[data-grammar-search]'), category = host.querySelector('[data-grammar-category]'), status = host.querySelector('[data-grammar-status]');
      function filter() { var query = String(search.value || '').toLowerCase(), visible = 0; Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-topic]'), function (row) { var match = (!query || row.textContent.toLowerCase().indexOf(query) >= 0) && (category.value === 'all' || row.getAttribute('data-category') === category.value) && (status.value === 'all' || row.getAttribute('data-status') === status.value || (status.value === 'completed' && row.getAttribute('data-status') === 'mastered')); row.hidden = !match; if (match) visible++; }); var count = host.querySelector('[data-grammar-count]'); if (count) count.textContent = visible; }
      search.oninput = filter; category.onchange = filter; status.onchange = filter;
      Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-level]'), function (button) { button.onclick = function () { studyState.level = button.getAttribute('data-grammar-level'); studyState.grammarTopic = null; studyState.grammarPhase = ''; studyState.data = null; renderGrammar(); }; });
      var review = host.querySelector('[data-grammar-mistakes]'); if (review) review.onclick = function () { var topic = grammarAcademyTopics(studyState.level).find(function (item) { return grammarTopicMistakes(item).length; }); if (topic) openTopic(topic.id); };
    }
    function grammarLessonTabs(active) {
      return [['learn',tr('Learn','Правило')],['examples',tr('Examples','Примеры')],['practice',tr('Practice','Практика')],['review',tr('Review','Повторение')]].map(function (item, index) { return '<button type="button" class="' + (active === item[0] ? 'active' : '') + '" aria-selected="' + (active === item[0]) + '" data-grammar-tab="' + item[0] + '">' + (index + 1) + '. ' + esc(item[1]) + '</button>'; }).join('');
    }
    function grammarExampleHtml(example) {
      var escaped = esc(example);
      escaped = escaped.replace(/\b(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)\b/g, '<mark class="grammar-aux">$1</mark>');
      return escaped.replace(/\b(ge[\wäöüß]+|[\wäöüß]+t)\b(?=[.!?]?$)/, '<mark class="grammar-participle">$1</mark>');
    }
    function grammarLearnHtml(topic) {
      var tips = Array.isArray(topic.tips) ? topic.tips : [];
      return '<section class="grammar-lesson-panel"><h3>' + esc(tr('Understand the rule','Разберитесь с правилом')) + '</h3><p class="grammar-rule">' + esc(grammarLocaleValue(topic, 'rule')) + '</p>' + (topic.pattern ? '<div class="grammar-structure"><small>' + esc(tr('Sentence structure','Структура предложения')) + '</small><p>' + esc(topic.pattern) + '</p></div>' : '') + (tips.length ? '<section class="grammar-tip-list"><h4>' + esc(tr('Key points','Главное')) + '</h4><ul>' + tips.map(function (tip) { return '<li>' + esc(tip) + '</li>'; }).join('') + '</ul></section>' : '') + '<button type="button" class="grammar-next-step" data-grammar-tab="examples">' + esc(tr('See examples','Посмотреть примеры')) + ' →</button></section>';
    }
    function grammarExamplesHtml(topic) {
      var examples = grammarTopicExamples(topic);
      return '<section class="grammar-lesson-panel"><h3>' + esc(tr('Examples in context','Примеры в контексте')) + '</h3><p>' + esc(tr('The auxiliary verb is green; the Partizip II is violet.','Вспомогательный глагол выделен зелёным, Partizip II — фиолетовым.')) + '</p><div class="grammar-example-list">' + examples.map(function (example) { return '<article><p>' + grammarExampleHtml(example) + '</p><small>' + esc(topic.focus) + '</small></article>'; }).join('') + '</div><button type="button" class="grammar-next-step" data-grammar-tab="practice">' + esc(tr('Go to practice','Перейти к практике')) + ' →</button></section>';
    }
    function grammarPracticeHtml(topic, progress, mistakes) {
      var action = progress.answered ? tr('Continue practice','Продолжить практику') : tr('Start practice','Начать практику');
      return '<section class="grammar-lesson-panel grammar-practice-panel"><small>' + esc(tr('PRACTICE','ПРАКТИКА')) + '</small><h3>' + topic.exercises.length + ' ' + esc(tr('available exercises','доступных упражнений')) + '</h3><p>' + esc(tr('Questions open one at a time and keep the original answer validation and feedback.','Вопросы открываются по одному с исходной проверкой ответов и объяснениями.')) + '</p><div class="grammar-practice-actions"><button type="button" class="grammar-start" data-grammar-practice>' + esc(action) + ' →</button>' + (mistakes.length ? '<button type="button" class="grammar-secondary" data-grammar-tab="review">' + esc(tr('Review mistakes','Повторить ошибки')) + ' · ' + mistakes.length + '</button>' : '') + '</div>' + (progress.answered ? '<p class="grammar-practice-meta">' + progress.answered + '/' + progress.total + ' · ' + progress.accuracy + '% ' + esc(tr('accuracy from recorded attempts','точность по сохранённым попыткам')) + '</p>' : '') + '</section>';
    }
    function grammarReviewHtml(topic, progress, mistakes) {
      var answered = loadProgress().grammarTopicProgress && loadProgress().grammarTopicProgress[topic.id] && loadProgress().grammarTopicProgress[topic.id].answered || {};
      var completed = topic.exercises.filter(function (exercise) { return answered[exercise.id]; });
      return '<section class="grammar-lesson-panel grammar-review-panel"><h3>' + esc(tr('Review recorded work','Разбор сохранённой работы')) + '</h3><div class="grammar-review-summary"><span><b>' + completed.length + '</b><small>' + esc(tr('completed','выполнено')) + '</small></span><span><b>' + (mistakes.length || '—') + '</b><small>' + esc(tr('mistakes to review','ошибок для повтора')) + '</small></span><span><b>' + (progress.accuracy === null ? '—' : progress.accuracy + '%') + '</b><small>' + esc(tr('recorded accuracy','сохранённая точность')) + '</small></span></div>' + (mistakes.length ? '<div class="grammar-mistake-list">' + mistakes.map(function (mistake) { return '<article><b>' + esc(mistake.prompt) + '</b><p>' + esc(tr('Correct answer: ','Правильный ответ: ')) + esc((mistake.opts || [])[mistake.a] || '') + '</p></article>'; }).join('') + '</div><button type="button" class="grammar-start" data-grammar-practice>' + esc(tr('Retry this topic','Повторить тему')) + ' →</button>' : (completed.length ? '<p>' + esc(tr('No unresolved mistakes are recorded for this topic.','Для этой темы нет неразобранных сохранённых ошибок.')) + '</p><button type="button" class="grammar-secondary" data-grammar-practice>' + esc(tr('Practice again','Практиковаться снова')) + '</button>' : '<p>' + esc(tr('Complete an exercise to build your review here.','Выполните упражнение — здесь появится разбор.')) + '</p>')) + '</section>';
    }
    function renderGrammarLesson(topic) {
      var progress = grammarTopicProgress(topic), mistakes = grammarTopicMistakes(topic), host = $('#studyToolBody'), tab = studyState.grammarLessonTab || 'learn';
      var panel = tab === 'examples' ? grammarExamplesHtml(topic) : tab === 'practice' ? grammarPracticeHtml(topic, progress, mistakes) : tab === 'review' ? grammarReviewHtml(topic, progress, mistakes) : grammarLearnHtml(topic);
      host.innerHTML = '<section class="grammar-detail"><button type="button" class="grammar-back" data-grammar-back>← ' + esc(tr('Grammar library','Библиотека грамматики')) + '</button><header><small>GRAMMATIK AKTIV · ' + esc(topic.level) + ' · ' + esc(topic.unit) + '</small><h2>' + esc(topic.title) + '</h2><p>' + esc(topic.focus) + '</p><div class="grammar-stage-tabs" role="tablist">' + grammarLessonTabs(tab) + '</div></header><div class="grammar-detail-grid"><main>' + panel + '</main><aside><section><small>' + esc(tr('TOPIC PROGRESS','ПРОГРЕСС ТЕМЫ')) + '</small><b>' + (progress.answered ? progress.answered + '/' + progress.total : '—') + '</b><p>' + esc(progress.attempts ? progress.accuracy + '% ' + tr('accuracy across recorded attempts.','точность по сохранённым попыткам.') : tr('Start practice to record progress.','Начните практику, чтобы сохранить прогресс.')) + '</p></section>' + (mistakes.length ? '<section><small>' + esc(tr('MISTAKES','ОШИБКИ')) + '</small><b>' + mistakes.length + '</b><p>' + esc(tr('Real mistakes saved in Mistake Center.','Реальные ошибки сохранены в Центре ошибок.')) + '</p><button type="button" class="grammar-secondary" data-grammar-tab="review">' + esc(tr('Review','Повторить')) + '</button></section>' : '') + '<section><small>' + esc(tr('NEXT ACTION','СЛЕДУЮЩЕЕ ДЕЙСТВИЕ')) + '</small><p>' + esc(tab === 'practice' ? tr('Start the original question set.','Запустите исходный набор вопросов.') : tr('Continue through the lesson stages.','Продолжайте по этапам урока.')) + '</p></section><section><small>XP</small><p>' + esc(tr('XP is awarded by the existing practice service when a session is completed.','XP начисляет существующий сервис практики после завершения сессии.')) + '</p></section></aside></div></section>';
      host.querySelector('[data-grammar-back]').onclick = function () { studyState.grammarTopic = null; studyState.grammarPhase = ''; studyState.grammarLessonTab = 'learn'; renderGrammar(); };
      Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-tab]'), function (button) { button.onclick = function () { studyState.grammarLessonTab = button.getAttribute('data-grammar-tab'); renderGrammarLesson(topic); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-practice]'), function (button) { button.onclick = function () { if (!topic.exercises.length) return; studyState.grammarPhase = 'practice'; studyState.data = null; studyState.idx = 0; studyState.score = 0; renderGrammar(); }; });
    }

    // ---- 5. Word usage: card-led learning, aligned with Academy Hub Mobile ----
    var MOBILE_WORD_USAGE_EXAMPLES = {
      weil:[['Ich bleibe zu Hause, weil ich krank bin.','Я остаюсь дома, потому что болен.'],['Wir nehmen ein Taxi, weil es schon sehr spät ist.','Мы берём такси, потому что уже поздно.'],['Er lernt jeden Abend, weil er die Prüfung bestehen will.','Он учится каждый вечер, потому что хочет сдать экзамен.']],
      doch:[['Komm doch kurz mit.','Пойдём же ненадолго со мной.'],['Das ist doch nicht so schwer.','Это ведь не так сложно.'],['Er sagte Nein, doch am Ende hat er zugestimmt.','Он сказал «нет», но в конце согласился.']],
      während:[['Während ich koche, hört meine Schwester Musik.','Пока я готовлю, моя сестра слушает музыку.'],['Was machst du, während du auf den Bus wartest?','Что ты делаешь, пока ждёшь автобус?'],['Bitte sprechen Sie nicht während der Prüfung.','Пожалуйста, не разговаривайте во время экзамена.']],
      'sich freuen':[['Ich freue mich auf das Wochenende.','Я радуюсь предстоящим выходным.'],['Freust du dich auf die Reise?','Ты радуешься поездке?'],['Wir freuen uns über deine Hilfe.','Мы рады твоей помощи.']]
    };
    function wordUsageCards(word) {
      var key=String(word||'').trim().toLowerCase(), known=MOBILE_WORD_USAGE_EXAMPLES[key];
      if (known) return known.map(function(row,index){ return { title:index===0?tr('Everyday example','Повседневный пример'):index===1?tr('Question or reply','Вопрос или ответ'):tr('Another context','Другой контекст'), sentence:row[0], translation:ctx.isRu?row[1]:row[1] }; });
      return [
        {title:tr('Everyday context','Повседневный контекст'),sentence:'Ich benutze „'+word+'“ in einem einfachen Alltagssatz.',translation:tr('A simple everyday sentence using “'+word+'”.','Простая повседневная фраза со словом «'+word+'».')},
        {title:tr('In a question','В вопросе'),sentence:'Wann klingt „'+word+'“ in einer Frage natürlich?',translation:tr('Notice how “'+word+'” can appear in a question.','Обратите внимание, как «'+word+'» может стоять в вопросе.')},
        {title:tr('In a short message','В коротком сообщении'),sentence:'Sie hat „'+word+'“ in eine kurze Nachricht geschrieben.',translation:tr('A short-message context for “'+word+'”.','Контекст короткого сообщения со словом «'+word+'».')}
      ];
    }
    // This entry mirrors the reviewed mobile starter copy. Other searched words keep
    // their examples, but do not receive fabricated linguistic metadata.
    var VERIFIED_WORD_USAGE_DETAILS = {
      'während': {
        meaningRu:'пока · во время', meaningEn:'while · during',
        categoryRu:'союз · предлог', categoryEn:'conjunction · preposition',
        constructions:['während + Nebensatz','während + Genitiv'],
        grammarRu:'Как союз während вводит придаточное: глагол стоит в конце. Перед существительным während работает как предлог; в учебной норме используется Genitiv.',
        grammarEn:'As a conjunction, während starts a subordinate clause, so the finite verb goes to the end. Before a noun it works as a preposition; formal standard German uses the genitive.',
        mistakesRu:'Не смешивайте структуру придаточного с предложной группой: Während ich lerne …, но während der Prüfung …',
        mistakesEn:'Do not mix the clause pattern with the prepositional phrase: Während ich lerne …, but während der Prüfung …'
      }
    };
    function wordUsageDetail(word) { return VERIFIED_WORD_USAGE_DETAILS[String(word||'').trim().toLowerCase()] || null; }
    function renderWordUsageStudio(state) {
      var host=$('#studyToolBody'), detail=wordUsageDetail(state.word), tab=state.tab || 'examples', saved=isWordSaved(studyState.lang,state.word), mistakes=loadMistakes().filter(function(item){return String(item.prompt||'').toLowerCase().indexOf(String(state.word).toLowerCase())>=0;});
      var title=state.word, meaning=detail ? (ctx.isRu?detail.meaningRu:detail.meaningEn) : '', category=detail ? (ctx.isRu?detail.categoryRu:detail.categoryEn) : '';
      function exampleCard(card,index){var shown=!!state.revealed[index];return '<article class="word-studio-example"><header><span>'+esc(tr('Example ','Пример '))+(index+1)+'</span><button type="button" data-word-speak="'+index+'" aria-label="'+esc(tr('Listen','Слушать'))+'">◖ '+esc(tr('Listen','Слушать'))+'</button></header><p>'+highlightWordUsage(card.sentence,state.word)+'</p>'+(shown?'<div>'+esc(card.translation)+'</div>':'<button type="button" data-word-reveal="'+index+'">'+esc(tr('Show translation','Показать перевод'))+'</button>')+'</article>';}
      var content=tab==='grammar' ? (detail?'<section class="word-studio-section"><h3>'+esc(tr('Grammar and use','Грамматика и употребление'))+'</h3><p>'+esc(ctx.isRu?detail.grammarRu:detail.grammarEn)+'</p><h4>'+esc(tr('Common constructions','Частые конструкции'))+'</h4><div class="word-studio-chips">'+detail.constructions.map(function(item){return '<span>'+esc(item)+'</span>';}).join('')+'</div><h4>'+esc(tr('Common mistake','Частая ошибка'))+'</h4><p>'+esc(ctx.isRu?detail.mistakesRu:detail.mistakesEn)+'</p></section>':'<section class="word-studio-section"><h3>'+esc(tr('No reviewed grammar note is available for this word yet.','Для этого слова пока нет проверенного грамматического комментария.'))+'</h3><p>'+esc(tr('Use the contextual examples and quick practice; the studio does not invent lexical metadata.','Используйте примеры и быструю практику: студия не выдумывает лексические метаданные.'))+'</p></section>') : tab==='practice' ? '<section class="word-studio-section"><h3>'+esc(tr('Quick Practice','Быстрая практика'))+'</h3><p>'+esc(tr('Open the existing Word Usage question set. Its answer validation, mistakes, XP and progress stay unchanged.','Откройте существующий набор Word Usage. Проверка ответов, ошибки, XP и прогресс не меняются.'))+'</p><button type="button" class="word-studio-primary" data-word-practice>'+esc(tr('Practice this word','Практиковать это слово'))+' →</button>'+(mistakes.length?'<p class="word-studio-mistakes">'+mistakes.length+' '+esc(tr('recorded mistakes are available in Mistake Center.','сохранённых ошибок доступны в Центре ошибок.'))+'</p>':'')+'</section>' : '<section class="word-studio-examples">'+state.cards.map(exampleCard).join('')+'</section>';
      host.innerHTML='<section class="word-studio"><button type="button" class="word-studio-back" data-word-back>← '+esc(tr('Search another word','Выбрать другое слово'))+'</button><header><div><small>DUVELA / VOCABULARY STUDIO</small><h2>'+esc(title)+'</h2>'+(detail?'<p>'+esc(category)+'</p>':'')+'</div><div><button type="button" class="word-studio-save '+(saved?'saved':'')+'" data-word-save>'+esc(saved?tr('Saved to Flashcards','Сохранено во Flashcards'):tr('Add to Flashcards','Добавить во Flashcards'))+'</button></div></header>'+(meaning?'<section class="word-studio-meaning"><small>'+esc(tr('MEANING','ЗНАЧЕНИЕ'))+'</small><b>'+esc(meaning)+'</b><span>'+esc(category)+'</span></section>':'')+'<nav class="word-studio-tabs"><button type="button" class="'+(tab==='examples'?'active':'')+'" data-word-tab="examples">'+esc(tr('Examples','Примеры'))+'</button><button type="button" class="'+(tab==='grammar'?'active':'')+'" data-word-tab="grammar">'+esc(tr('Grammar','Грамматика'))+'</button><button type="button" class="'+(tab==='practice'?'active':'')+'" data-word-tab="practice">'+esc(tr('Practice','Практика'))+'</button></nav>'+content+'</section>';
      host.querySelector('[data-word-back]').onclick=function(){state.cards=[];state.word='';state.revealed={};state.rated={};renderWordUsageCards();};
      host.querySelector('[data-word-save]').onclick=function(){toggleSavedWord(studyState.lang,state.word,meaning||state.word);renderWordUsageStudio(state);};
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-tab]'),function(button){button.onclick=function(){state.tab=button.getAttribute('data-word-tab');renderWordUsageStudio(state);};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-reveal]'),function(button){button.onclick=function(){state.revealed[button.getAttribute('data-word-reveal')]=true;renderWordUsageStudio(state);};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-speak]'),function(button){button.onclick=function(){var card=state.cards[Number(button.getAttribute('data-word-speak'))];if(!card||!window.speechSynthesis)return;var utterance=new SpeechSynthesisUtterance(card.sentence);utterance.lang='de-DE';speechSynthesis.cancel();speechSynthesis.speak(utterance);};});
      var practice=host.querySelector('[data-word-practice]');if(practice)practice.onclick=function(){studyState.wordUsageMode='practice';studyState.data=null;studyState.idx=0;studyState.score=0;renderWordUsage();};
    }
    function renderWordUsageCards() {
      var host=$('#studyToolBody'), state=studyState.wordUsageCards || {word:'',cards:[],revealed:{},rated:{}};
      studyState.wordUsageCards=state;
      if (state.cards.length) return renderWordUsageStudio(state);
      var starters=['weil','doch','während','sich freuen','schon','eigentlich'];
      function cardHtml(card,index){var revealed=!!state.revealed[index],rating=state.rated[index]||'';return '<article class="word-card"><header><span>'+(index+1)+'</span><b>'+esc(card.title)+'</b><button type="button" data-word-speak="'+index+'" aria-label="'+esc(tr('Listen','Слушать'))+'">◖</button></header><p>'+highlightWordUsage(card.sentence,state.word)+'</p>'+(revealed?'<div class="word-card-translation">'+esc(card.translation)+'</div><div class="word-card-rating"><button type="button" data-word-rate="repeat" data-word-index="'+index+'" class="'+(rating==='repeat'?'active':'')+'">↻ '+esc(tr('Repeat','Повторить'))+'</button><button type="button" data-word-rate="understood" data-word-index="'+index+'" class="'+(rating==='understood'?'active':'')+'">✓ '+esc(tr('Got it','Понял'))+'</button></div>':'<button type="button" class="word-card-reveal" data-word-reveal="'+index+'">'+esc(tr('Show translation','Показать перевод'))+'</button>')+'</article>';}
      host.innerHTML='<section class="word-usage-cards"><header><div><small>DUVELA / VOCABULARY</small><h2>'+esc(tr('How to use a word','Как использовать слово'))+'</h2><p>'+esc(tr('Meaning, context and sentence placement.','Смысл, контекст и позиция слова в предложении.'))+'</p></div><span>'+esc(studyState.level)+'</span></header><section class="word-search"><label>'+esc(tr('Word or phrase','Слово или фраза'))+'</label><div><input type="search" data-word-input value="'+esc(state.word)+'" placeholder="'+esc(tr('For example: weil, sich freuen','Например: weil, sich freuen'))+'"><button type="button" data-word-generate>'+esc(tr('Show examples','Показать примеры'))+' →</button></div><p>'+esc(tr('Single words and short phrases work best.','Лучше всего работают отдельные слова и короткие фразы.'))+'</p><nav>'+starters.map(function(word){return '<button type="button" data-word-starter="'+word+'">'+esc(word)+'</button>';}).join('')+'</nav></section>'+(state.cards.length?'<section class="word-results"><header><div><small>'+esc(state.word.toUpperCase())+'</small><h3>'+esc(tr('Usage cards','Карточки употребления'))+'</h3></div><span>'+Object.keys(state.rated).length+'/'+state.cards.length+'</span></header><div class="word-rule"><b>'+esc(tr('Quick rule','Короткое правило'))+'</b><p>'+esc(tr('Look at the word inside complete sentences before you use it yourself.','Сначала посмотрите на слово в готовых предложениях, затем используйте его сами.'))+'</p></div><div class="word-card-list">'+state.cards.map(cardHtml).join('')+'</div>'+(Object.keys(state.rated).length===state.cards.length?'<button type="button" class="word-practice-link" data-word-practice>'+esc(tr('Open quick practice','Открыть быструю практику'))+' →</button>':'')+'</section>':'<section class="word-empty"><b>'+esc(tr('Start with a word','Начните со слова'))+'</b><p>'+esc(tr('Enter a word to receive short cards with examples and a translation.','Введите слово, чтобы получить короткие карточки с примерами и переводом.'))+'</p></section>')+'<button type="button" class="word-practice-secondary" data-word-practice>'+esc(tr('Quick exercise','Быстрое упражнение'))+' →</button></section>';
      function generate(word){word=String(word||'').trim();if(!word)return;state.word=word;state.cards=wordUsageCards(word);state.revealed={};state.rated={};renderWordUsageCards();}
      host.querySelector('[data-word-generate]').onclick=function(){generate(host.querySelector('[data-word-input]').value);};host.querySelector('[data-word-input]').onkeydown=function(event){if(event.key==='Enter'){event.preventDefault();generate(this.value);}};
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-starter]'),function(button){button.onclick=function(){generate(button.getAttribute('data-word-starter'));};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-reveal]'),function(button){button.onclick=function(){state.revealed[button.getAttribute('data-word-reveal')]=true;renderWordUsageCards();};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-rate]'),function(button){button.onclick=function(){state.rated[button.getAttribute('data-word-index')]=button.getAttribute('data-word-rate');renderWordUsageCards();};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-speak]'),function(button){button.onclick=function(){var card=state.cards[Number(button.getAttribute('data-word-speak'))];if(!card||!window.speechSynthesis)return;var utterance=new SpeechSynthesisUtterance(card.sentence);utterance.lang='de-DE';speechSynthesis.cancel();speechSynthesis.speak(utterance);};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-word-practice]'),function(button){button.onclick=function(){studyState.wordUsageMode='practice';studyState.data=null;studyState.idx=0;studyState.score=0;renderWordUsage();};});
    }
    function highlightWordUsage(sentence,word){var safe=esc(sentence),needle=esc(String(word||'').trim());return needle?safe.split(needle).join('<mark>'+needle+'</mark>'):safe;}
    function renderWordUsage() {
      if (!studyState.wordUsageMode) return renderWordUsageCards();
      if (!studyState.data) {
        studyState.data=shuffle(strictBank(WORD_USAGE,studyState.lang,studyState.level)).map(function (item) {
          var correctIdx = item.opts.indexOf(item.a);
          return { q: item.s, opts: item.opts, a: correctIdx < 0 ? 0 : correctIdx };
        });
      }
      if(!studyState.data.length)return noLevelContent();
      quizStep(studyState.data, renderWordUsage, function (item) { return item.q; });
    }

    function grammarExerciseOptions(item) {
      var correct = item.opts[item.a], options = [correct];
      item.opts.forEach(function (option) { if (option !== correct && options.length < 4) options.push(option); });
      return shuffle(options);
    }
    function renderGrammarExercise(deck, topic) {
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx], options = grammarExerciseOptions(item), correctIndex = options.indexOf(item.opts[item.a]), host = $('#studyToolBody');
      host.innerHTML = '<section class="grammar-exercise" aria-label="' + esc(tr('Grammar exercise','Упражнение по грамматике')) + '">' +
        '<header><div><small>DUVELA · GERMAN ' + esc(studyState.level) + '</small><h2>' + esc(topic.title) + '</h2></div><b>' + (studyState.idx + 1) + ' / ' + deck.length + '</b></header>' +
        '<i class="grammar-exercise-track"><em style="width:' + Math.round((studyState.idx + 1) / deck.length * 100) + '%"></em></i>' +
        '<main><small>' + esc(tr('CHOOSE THE CORRECT ANSWER','ВЫБЕРИТЕ ПРАВИЛЬНЫЙ ОТВЕТ')) + '</small><h3>' + esc(item.q) + '</h3><div class="grammar-exercise-options">' + options.map(function (option, index) { return '<button type="button" data-grammar-option="' + index + '">' + esc(option) + '</button>'; }).join('') + '</div><div class="grammar-exercise-feedback" aria-live="polite"></div></main></section>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-option]'), function (button) {
        button.onclick = function () {
          var chosen = Number(button.getAttribute('data-grammar-option')), ok = chosen === correctIndex, explanation = answerExplanation(item);
          feedback(ok,{prompt:item.q,chosen:options[chosen],correct:options[correctIndex],explanation:explanation});
          recordGrammarTopicAnswer(item, ok);
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.q); } else logMistake(studyState.lang, item.q, options, correctIndex, 'mcq',{sourceTool:'grammar',questionId:item.q,level:studyState.level,explanation:explanation,selectedAnswer:options[chosen]});
          Array.prototype.forEach.call(host.querySelectorAll('[data-grammar-option]'), function (option, index) { option.disabled = true; option.classList.toggle('correct', index === correctIndex); option.classList.toggle('wrong', index === chosen && !ok); });
          var panel = host.querySelector('.grammar-exercise-feedback');
          panel.innerHTML = '<div class="grammar-answer-feedback ' + (ok ? 'ok' : 'bad') + '"><b>' + esc(ok ? tr('Correct','Верно') : tr('Correct answer: ','Правильный ответ: ') + options[correctIndex]) + '</b><p>' + esc(explanation) + '</p></div><button type="button" class="grammar-exercise-continue" data-grammar-continue>' + esc(tr('Continue','Продолжить')) + ' →</button>';
          host.querySelector('[data-grammar-continue]').onclick = function () { studyState.idx++; persistResume(); renderGrammar(); };
        };
      });
    }

    // shared MCQ step for word usage and legacy grammar sessions
    function quizStep(deck, rerender, promptOf) {
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(promptOf(item)) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-opt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="quizFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-opt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-opt'));
          var ok = chosen === item.a;
          feedback(ok,{prompt:item.q,chosen:item.opts[chosen],correct:item.opts[item.a],explanation:answerExplanation(item)});
          recordGrammarTopicAnswer(item, ok);
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.q); }
          else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq',{sourceTool:studyState.tool==='wordusage'?'wordusage':'grammar',questionId:item.q,level:studyState.level,explanation:answerExplanation(item),selectedAnswer:item.opts[chosen]});
          Array.prototype.forEach.call(host.querySelectorAll('[data-opt]'), function (b, i) {
            b.disabled = true;
            if (i === item.a) b.style.background = 'rgba(37,178,150,.16)';
            else if (i === chosen) b.style.background = 'rgba(214,69,69,.14)';
          });
          $('#quizFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(item.opts[item.a]) + '</span>';
          $('#quizFb').insertAdjacentHTML('beforeend',explanationPanel(item,item.opts[chosen],ok));
          $('#quizFb').insertAdjacentHTML('beforeend','<button class="btn primary answer-continue" id="quizContinue">'+esc(tr('Continue','Продолжить'))+' →</button>');
          $('#quizContinue').onclick=function(){studyState.idx++;persistResume();rerender();};
        });
      });
    }

    function similarity(expected, actual) {
      var clean = function (value) { return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zа-яёäöüß0-9 ]/gi, ' ').trim().split(/\s+/).filter(Boolean); };
      var target = clean(expected), heard = clean(actual), matched = target.filter(function (word) { return heard.indexOf(word) >= 0; });
      return { percent:target.length ? Math.round(matched.length / target.length * 100) : 0, words:target.map(function (word) { return { word:word, ok:heard.indexOf(word) >= 0 }; }) };
    }

    async function requestAiEvaluation(tool, payload) {
      var body = Object.assign({
        action: tool === 'writing' ? 'evaluate_writing' : 'evaluate-speaking',
        language: studyState.lang,
        level: (loadPrefs().levels || {})[studyState.lang] || 'A1',
        nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US'
      }, payload || {});
      var response = await supa.functions.invoke(tool === 'writing' ? 'openai-assistant' : 'practice-ai-evaluate', { body:body });
      if (response.error || !response.data || !response.data.evaluation) {
        throw new Error(response.error && response.error.message || response.data && response.data.error || tr('AI evaluation is temporarily unavailable.','AI-проверка временно недоступна.'));
      }
      if (uid()) {
        var stored=await supa.from('practice_ai_evaluations').insert({
          user_id:uid(), tool_id:tool, language:body.language, level:body.level,
          prompt:body.prompt || body.expected || '', answer_text:body.text || body.transcript || '',
          result:response.data.evaluation, model:response.data.model || null
        });
        response.data.evaluation._savedToAccount=!stored.error;
      }
      return response.data.evaluation;
    }

    function writingTextHash(value) {
      var hash=2166136261,text=String(value||'').trim().replace(/\s+/g,' ');
      for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
      return (hash>>>0).toString(36);
    }

    function evaluationHtml(result, pronunciation) {
      var criteria = result.criteria || {};
      var rows = pronunciation === undefined
        ? [[tr('Task completion','Выполнение задания'),criteria.taskCompletion],[tr('Communication','Коммуникация'),criteria.communication],[tr('Grammar','Грамматика'),criteria.grammar],[tr('Vocabulary','Словарь'),criteria.vocabulary]]
        : [[tr('Speech match','Совпадение речи'),pronunciation],[tr('Task completion','Выполнение задания'),criteria.taskCompletion],[tr('Grammar','Грамматика'),criteria.grammar],[tr('Fluency','Беглость'),criteria.fluency],[tr('Vocabulary','Словарь'),criteria.vocabulary]];
      return '<div class="writing-evaluation ai-evaluation"><header><span>✨</span><div><small>'+esc(tr('AI EVALUATION','AI-ПРОВЕРКА'))+'</small><h3>'+Number(result.overall || 0)+' / 100</h3></div></header><p class="ai-summary">'+esc(result.summary || '')+'</p><div>'+rows.map(function(row){var score=Math.max(0,Math.min(100,Number(row[1]||0)));return '<span><small>'+esc(row[0])+'</small><b>'+score+'%</b><i><em style="width:'+score+'%"></em></i></span>';}).join('')+'</div>'+
        ((result.strengths||[]).length?'<article class="ai-strengths"><b>'+esc(tr('What already works','Что уже получается'))+'</b><ul>'+result.strengths.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul></article>':'')+
        ((result.corrections||[]).length?'<article class="ai-corrections"><b>'+esc(tr('Corrections with explanation','Исправления с объяснением'))+'</b>'+result.corrections.map(function(item){return '<p><del>'+esc(item.original)+'</del><br><strong>'+esc(item.corrected)+'</strong><small>'+esc(item.explanation)+'</small></p>';}).join('')+'</article>':'')+
        (result.improvedVersion?'<article><b>'+esc(tr('Improved version','Улучшенная версия'))+'</b><p>'+esc(result.improvedVersion)+'</p></article>':'')+
        '<article><b>'+esc(tr('Next improvement','Следующее улучшение'))+'</b><p>'+esc(result.nextStep || '')+'</p></article></div>';
    }

    function renderSkillsHub() {
      var skillModes = [
        { tool:'listening', icon:'🎧', title:tr('Listening lab','Аудирование'), desc:tr('Listen, type and check what you hear.','Слушайте, записывайте и проверяйте услышанное.') },
        { tool:'reading', icon:'📖', title:tr('Reading lab','Чтение'), desc:tr('Read a short text and answer focused questions.','Читайте короткий текст и отвечайте на точные вопросы.') },
        { tool:'writing', icon:'📝', title:tr('Writing lab','Письмо'), desc:tr('Write, self-check and get AI feedback.','Пишите, проходите самопроверку и получайте AI-оценку.') },
        { tool:'speaking', icon:'🎙', title:tr('Speaking practice','Разговорная практика'), desc:tr('Speak aloud and train pronunciation with evaluation.','Говорите вслух и тренируйте произношение с проверкой.') }
      ];
      $('#studyToolBody').innerHTML =
        '<section class="skills-hub">' +
          '<div class="skills-hub-hero">' +
            '<div class="skills-hub-copy">' +
              '<small>' + esc(tr('SKILLS ACTIVE', 'SKILLS ACTIVE')) + ' · ' + esc(studyState.level) + '</small>' +
              '<h2>' + esc(tr('Language skills hub','Хаб языковых навыков')) + '</h2>' +
              '<p>' + esc(tr('Open one clear hub for listening, reading, writing and speaking instead of separate disconnected screens.','Откройте один понятный хаб для listening, reading, writing и speaking вместо разрозненных экранов.')) + '</p>' +
            '</div>' +
            '<div class="skills-hub-stats">' +
              '<span><b>' + skillModes.length + '</b><small>' + esc(tr('skill modes','режимов навыков')) + '</small></span>' +
              '<span><b>' + esc(studyState.level) + '</b><small>' + esc(tr('active level','активный уровень')) + '</small></span>' +
              '<span><b>' + esc(studyState.lang.toUpperCase()) + '</b><small>' + esc(tr('practice language','язык практики')) + '</small></span>' +
            '</div>' +
          '</div>' +
          '<div class="skills-bank-note"><strong>' + esc(tr('Skill base','База навыков')) + '</strong><p>' + esc(tr('Each card opens a specific skill flow with the same visual language and clearer navigation for learners.','Каждая карточка открывает отдельный навык в едином стиле и с более понятной навигацией для ученика.')) + '</p></div>' +
          '<div class="skills-topic-grid">' + skillModes.map(function (item) {
            return '<article class="skills-topic-card">' +
              '<div class="skills-topic-top"><i>' + item.icon + '</i><span>' + esc(studyState.level) + '</span></div>' +
              '<h3>' + esc(item.title) + '</h3>' +
              '<p>' + esc(item.desc) + '</p>' +
              '<button type="button" data-skill-tool="' + esc(item.tool) + '">' + esc(tr('Open skill','Открыть навык')) + ' <em>→</em></button>' +
            '</article>';
          }).join('') + '</div>' +
        '</section>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-skill-tool]'), function (button) {
        button.onclick = function () { openStudyTool(button.getAttribute('data-skill-tool'), { lang:studyState.lang, level:studyState.level, skillDirect:true }); };
      });
    }

    function renderSpeaking() {
      if (!studyState.skillDirect) return renderSkillsHub();
      if(!studyState.speakingMode){
        $('#studyToolBody').innerHTML='<div class="speaking-mode-head"><span>🎙</span><div><small>'+esc(tr('AI SPEAKING PRACTICE','РАЗГОВОРНАЯ ПРАКТИКА'))+'</small><h2>'+esc(tr('Choose a real exam situation','Выберите ситуацию настоящего экзамена'))+'</h2></div></div><div class="speaking-modes">'+[['intro','1','3 min',tr('Introduce yourself or share an experience','Расскажите о себе или своём опыте')],['discuss','2','6 min',tr('Discuss a topic and support your opinion','Обсудите тему и обоснуйте мнение')],['plan','3','5 min',tr('Plan something together','Спланируйте что-нибудь вместе')]].map(function(item){return '<button data-speaking-mode="'+item[0]+'"><i>'+item[1]+'</i><span><b>'+esc(item[3])+'</b><small>'+item[2]+'</small></span><em>→</em></button>';}).join('')+'</div>';
        Array.prototype.forEach.call(document.querySelectorAll('[data-speaking-mode]'),function(button){button.onclick=function(){studyState.speakingMode=button.getAttribute('data-speaking-mode');studyState.data=null;renderSpeaking();};});return;
      }
      if (!studyState.data) studyState.data=shuffle(strictBank(LISTEN,studyState.lang,studyState.level).map(function(item){return item.text;}));
      var deck = studyState.data;
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 4);
      var phrase = deck[studyState.idx], host = $('#studyToolBody');
      var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div class="speaking-card"><small>' + esc(tr('SAY THIS PHRASE','ПРОИЗНЕСИТЕ ФРАЗУ')) + '</small><h2>' + esc(phrase) + '</h2><div class="voice-wave" id="voiceWave" hidden><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button class="btn" id="spListen">🔊 ' + esc(tr('Listen','Слушать')) + '</button><button class="btn primary" id="spRecord">🎙 ' + esc(tr('Start speaking','Начать говорить')) + '</button><div id="spResult" aria-live="polite"></div></div>';
      $('#spListen').onclick = function () { var utterance = new SpeechSynthesisUtterance(phrase); utterance.lang = SPEECH_LOCALE[studyState.lang] || 'de-DE'; utterance.rate=studyState.speechRate||.9; speechSynthesis.cancel(); speechSynthesis.speak(utterance); };
      $('#spRecord').onclick = async function () {
        if (!Recognition) { $('#spResult').innerHTML = '<p class="practice-warning">' + esc(tr('Speech recognition is not supported in this browser. Try Chrome or Edge.','Распознавание речи не поддерживается. Используйте Chrome или Edge.')) + '</p>'; return; }
        var button = $('#spRecord'), recognition = new Recognition(),recorder=null,stream=null,chunks=[]; recognition.lang = SPEECH_LOCALE[studyState.lang] || 'de-DE'; recognition.interimResults = false; recognition.maxAlternatives = 1;
        try{if(navigator.mediaDevices&&window.MediaRecorder){stream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(stream);recorder.ondataavailable=function(event){if(event.data&&event.data.size)chunks.push(event.data);};recorder.onstop=function(){studyState.lastAudioBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});stream.getTracks().forEach(function(track){track.stop();});};recorder.start();}}catch(e){stream=null;}
        button.disabled = true; button.textContent = '● ' + tr('Listening…','Слушаю…');$('#voiceWave').hidden=false;
        recognition.onresult = async function (event) {
          var heard = event.results[0][0].transcript, result = similarity(phrase, heard), ok = result.percent >= 70;
          feedback(ok); if (ok) studyState.score++; else logMistake(studyState.lang, phrase, [], null, 'pronunciation');
          studyState.lastTranscript=heard;$('#voiceWave').hidden=true;
          $('#spResult').innerHTML = '<p><b>' + esc(tr('I heard: ','Я услышал: ')) + '</b>' + esc(heard) + '</p><div class="pronunciation-score"><strong>' + result.percent + '%</strong><span>' + result.words.map(function (item) { return '<i class="' + (item.ok ? 'ok' : 'miss') + '">' + esc(item.word) + '</i>'; }).join(' ') + '</span></div><div class="ai-checking"><i></i><span>'+esc(tr('AI examiner is checking grammar, vocabulary and task completion…','AI-экзаменатор проверяет грамматику, словарь и выполнение задания…'))+'</span></div>';
          try {
            var evaluation=await requestAiEvaluation('speaking',{transcript:heard,expected:phrase,prompt:phrase});
            if(!studyState||studyState.lastTranscript!==heard)return;
            $('#spResult').insertAdjacentHTML('beforeend',evaluationHtml(evaluation,result.percent));
          } catch(error) {
            $('#spResult').insertAdjacentHTML('beforeend','<p class="practice-warning">'+esc(error.message)+'</p>');
          }
          $('#spResult').insertAdjacentHTML('beforeend','<div class="ai-result-actions"><button class="btn" id="sendSpeaking">📨 '+esc(tr('Send to teacher','Отправить преподавателю'))+'</button><button class="btn primary" id="speakingNext">'+esc(tr('Next task','Следующее задание'))+' →</button></div>');
          $('#sendSpeaking').onclick=function(){submitForTeacher('speaking',heard,studyState.lastAudioBlob||null);};
          $('#speakingNext').onclick=function(){studyState.idx++;persistResume();renderSpeaking();};
        };
        recognition.onerror = function () { button.disabled = false; button.textContent = '🎙 ' + tr('Try again','Повторить'); $('#voiceWave').hidden=true;$('#spResult').textContent = tr('Microphone permission or speech service is unavailable.','Нет доступа к микрофону или сервису речи.'); };
        recognition.onend = function () { button.disabled = false;if(recorder&&recorder.state!=='inactive')recorder.stop();else if(stream)stream.getTracks().forEach(function(track){track.stop();}); };
        recognition.start();
      };
    }

    // ---- 6. Listening lab (Supabase recording -> Fish Audio fallback) ----
    function waitForListeningStep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function stopListeningPlayback() {
      listeningPlaybackRun++;
      if (finishListeningPlayback) {
        var finish = finishListeningPlayback;
        finishListeningPlayback = null;
        finish();
      }
      if (listeningAudio) {
        try { listeningAudio.pause(); } catch (e) { /* already stopped */ }
        listeningAudio = null;
      }
    }

    var practiceClipAudio = null;
    function playPracticeClip(path, text, voiceId, languageCode) {
      try { if (practiceClipAudio) practiceClipAudio.pause(); } catch (e) { /* already stopped */ }
      function browserVoice() {
        try {
          if (!window.speechSynthesis || !text) return;
          var utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = languageCode || 'de-DE';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        } catch (e) { /* speech synthesis unavailable */ }
      }
      function fishVoice() {
        fetchFishAudioBlob({ action: 'speak', text: String(text || '').slice(0, 400), voiceId: voiceId || '' })
          .then(function (blob) {
            var url = URL.createObjectURL(blob);
            practiceClipAudio = new Audio(url);
            practiceClipAudio.onended = function () { URL.revokeObjectURL(url); };
            return practiceClipAudio.play();
          })
          .catch(browserVoice);
      }
      var url = listeningStorageUrl(path);
      if (!url) return fishVoice();
      practiceClipAudio = new Audio(url);
      practiceClipAudio.play().catch(fishVoice);
    }

    // Shared helpers for the screens in app-feature-practice-extras.js.
    function practiceExtrasOptions() {
      return {
        esc: esc,
        tr: tr,
        isRu: !!ctx.isRu,
        playClip: playPracticeClip,
        finish: function (correct, total, label) {
          studyState.score = correct;
          studyState.data = new Array(total);
          finishTool(label + ': ' + correct + ' / ' + total, correct >= Math.ceil(total / 2) ? 8 : 2);
        }
      };
    }

    function listeningStorageUrl(path) {
      var base = String(window.DuvelaWebConfig && window.DuvelaWebConfig.supabaseUrl || '').replace(/\/+$/, '');
      var cleanPath = String(path || '').replace(/^\/+/, '');
      if (!base || !cleanPath) return '';
      var encodedPath = cleanPath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      return base + '/storage/v1/object/public/exams/' + encodedPath;
    }

    async function prepareListeningRecording(clip) {
      // The manifest stores listening-lab clips under `storagePath` (the exact
      // exams-bucket key) and the few reused exam clips under `file`. Accept
      // either so every recorded clip resolves — otherwise 356 of 360 clips
      // fall through to Fish/device voice even though the recording exists.
      var clipPath = clip && (clip.storagePath || clip.file);
      var source = listeningStorageUrl(clipPath);
      if (!source) throw new Error('recording unavailable');
      if (listeningRecordingCache.has(source)) return listeningRecordingCache.get(source);
      var preparation = (async function () {
        var response = await fetch(source, { cache: 'force-cache' });
        if (!response.ok) throw new Error('recording download failed');
        var blob = await response.blob();
        if (!blob.size) throw new Error('recording is empty');
        return {
          source: URL.createObjectURL(blob),
          startMs: Math.max(0, Number(clip.startMs || 0)),
          endMs: Math.max(0, Number(clip.endMs || 0))
        };
      })();
      listeningRecordingCache.set(source, preparation);
      try {
        return await preparation;
      } catch (error) {
        listeningRecordingCache.delete(source);
        throw error;
      }
    }

    // Fetch Fish Audio and keep the bytes BINARY.
    //
    // supa.functions.invoke must not be used for audio: supabase-js decodes
    // the response by Content-Type and only treats application/octet-stream
    // (or /pdf) as a Blob — everything else, audio/mpeg included, is read with
    // .text(). That turned the MP3 into a mojibake string, so the <audio>
    // element could not decode it and both the listening lab and the AI
    // partners silently fell back to the robotic device voice. Fetch the URL
    // directly and read response.blob().
    async function fetchFishAudioBlob(body) {
      var config = window.DuvelaWebConfig || {};
      var base = String(config.supabaseUrl || '').replace(/\/+$/, '');
      if (!base) throw new Error('Supabase is not configured.');
      var session = await supa.auth.getSession();
      var accessToken = session && session.data && session.data.session
        ? session.data.session.access_token
        : '';
      if (!accessToken) throw new Error('Sign in to use Fish Audio.');
      var response = await fetch(base + '/functions/v1/fish-audio-tts', {
        method: 'POST',
        headers: {
          apikey: config.supabaseAnonKey || '',
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        var message = '';
        try {
          var payload = await response.clone().json();
          message = payload && typeof payload.error === 'string' ? payload.error : '';
        } catch (jsonError) {
          try { message = (await response.clone().text()).trim(); } catch (textError) { message = ''; }
        }
        throw new Error((message || 'Fish Audio failed') + ' (' + response.status + ')');
      }
      var blob = await response.blob();
      if (!blob.size) throw new Error('Fish Audio returned empty audio');
      return blob;
    }

    async function prepareListeningFish(text, lang, rate) {
      var clean = String(text || '').trim();
      if (!clean) throw new Error('speech text unavailable');
      var cacheKey = [lang, rate, clean].join('|');
      if (listeningFishCache.has(cacheKey)) return listeningFishCache.get(cacheKey);
      var preparation = (async function () {
        var blob = await fetchFishAudioBlob({
          action: 'speak',
          text: clean.slice(0, 1000),
          languageCode: lang,
          rate: rate
        });
        return { source: URL.createObjectURL(blob), startMs: 0, endMs: 0 };
      })();
      listeningFishCache.set(cacheKey, preparation);
      try {
        return await preparation;
      } catch (error) {
        listeningFishCache.delete(cacheKey);
        throw error;
      }
    }

    function waitForListeningAudio(audio, runId) {
      if (audio.readyState >= 2) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () { cleanup(); reject(new Error('audio load timeout')); }, 20000);
        function cleanup() {
          clearTimeout(timeout);
          audio.removeEventListener('canplay', ready);
          audio.removeEventListener('error', failed);
        }
        function ready() {
          cleanup();
          if (runId !== listeningPlaybackRun) reject(new Error('playback cancelled'));
          else resolve();
        }
        function failed() { cleanup(); reject(new Error('audio playback failed')); }
        audio.addEventListener('canplay', ready, { once: true });
        audio.addEventListener('error', failed, { once: true });
      });
    }

    function unlockListeningAudio() {
      var audio = new Audio(LISTENING_SILENCE);
      audio.preload = 'auto';
      listeningAudio = audio;
      // Reusing an element first played directly inside the click keeps the
      // post-countdown playback allowed on stricter mobile browsers.
      audio.play().catch(function () { /* later play() still reports a useful error */ });
      return audio;
    }

    async function playListeningAudio(prepared, rate, runId, onPlaying, onProgress, unlockedAudio) {
      var audio = unlockedAudio || new Audio();
      try { audio.pause(); } catch (e) { /* not started yet */ }
      audio.preload = 'auto';
      audio.playbackRate = rate;
      audio.src = prepared.source;
      listeningAudio = audio;
      audio.load();
      await waitForListeningAudio(audio, runId);
      if (runId !== listeningPlaybackRun) throw new Error('playback cancelled');
      if (prepared.startMs) audio.currentTime = prepared.startMs / 1000;
      await audio.play();
      onPlaying();
      var completion = new Promise(function (resolve, reject) {
        var settled = false;
        function finish(error) {
          if (settled) return;
          settled = true;
          audio.removeEventListener('ended', ended);
          audio.removeEventListener('error', failed);
          audio.removeEventListener('timeupdate', checkSegmentEnd);
          if (finishListeningPlayback === cancelled) finishListeningPlayback = null;
          if (error) reject(error); else resolve();
        }
        function ended() { finish(); }
        function failed() { finish(new Error('audio playback failed')); }
        function checkSegmentEnd() {
          var startSeconds = Number(prepared.startMs || 0) / 1000;
          var segmentDuration = prepared.endMs
            ? Math.max(0, Number(prepared.endMs) / 1000 - startSeconds)
            : Math.max(0, Number(audio.duration || 0) - startSeconds);
          var elapsed = Math.max(0, Number(audio.currentTime || 0) - startSeconds);
          if (onProgress) onProgress(elapsed, segmentDuration);
          if (prepared.endMs && audio.currentTime * 1000 >= prepared.endMs) {
            audio.pause();
            finish();
          }
        }
        function cancelled() { finish(); }
        finishListeningPlayback = cancelled;
        audio.addEventListener('ended', ended);
        audio.addEventListener('error', failed);
        audio.addEventListener('timeupdate', checkSegmentEnd);
      });
      await completion;
      if (listeningAudio === audio) listeningAudio = null;
    }

    async function runListeningCountdown(button, status, runId) {
      status.textContent = tr('Preparing audio…', 'Готовим аудио…');
      for (var value = 3; value >= 1; value--) {
        if (runId !== listeningPlaybackRun) return false;
        button.textContent = String(value);
        await waitForListeningStep(1000);
      }
      return runId === listeningPlaybackRun;
    }

    function playListeningBrowserFallback(text, lang, rate, runId, button, status) {
      if (!window.speechSynthesis) throw new Error('speech fallback unavailable');
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LOCALE[lang] || 'de-DE';
      utterance.rate = rate;
      utterance.onstart = function () {
        if (runId !== listeningPlaybackRun) return;
        setListeningButtonState(button, 'playing', tr('Playing', 'Воспроизведение'));
        status.textContent = tr('Device voice is being used.', 'Используется голос устройства.');
      };
      utterance.onend = utterance.onerror = function () {
        if (runId !== listeningPlaybackRun) return;
        button.disabled = false;
        setListeningButtonState(button, 'ready', tr('Play again', 'Прослушать ещё раз'));
        var input = $('#lsInput');
        if (input) input.focus();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    async function playMistakeAudio(item, button) {
      stopListeningPlayback();
      var runId = listeningPlaybackRun;
      button.disabled = true;
      try {
        var prepared = null;
        if (item.audioClip) { try { prepared = await prepareListeningRecording(item.audioClip); } catch (e) { prepared = null; } }
        if (!prepared && item.audioText) prepared = await prepareListeningFish(item.audioText, item.lang, 1);
        if (!prepared) throw new Error('audio unavailable');
        await playListeningAudio(prepared, 1, runId, function () {});
      } catch (error) {
        if (runId === listeningPlaybackRun && item.audioText && window.speechSynthesis) {
          var utterance = new SpeechSynthesisUtterance(item.audioText);
          utterance.lang = SPEECH_LOCALE[item.lang] || 'de-DE';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        button.disabled = false;
      }
    }

    function setListeningButtonState(button, state, label) {
      if (!button) return;
      button.dataset.state = state;
      button.setAttribute('aria-pressed', state === 'playing' ? 'true' : 'false');
      button.innerHTML = '<span class="listening-play-icon" aria-hidden="true">' + (state === 'playing' ? 'Ⅱ' : state === 'loading' ? '•••' : '▶') + '</span><span>' + esc(label) + '</span>';
      var player = button.closest && button.closest('.listening-player');
      if (player) player.classList.toggle('is-playing', state === 'playing');
    }

    function normalizeListeningAnswer(value, ignorePunctuation) {
      var normalized = String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
      return ignorePunctuation === false ? normalized : normalized.replace(/[\p{P}]/gu, '').replace(/\s+/gu, ' ').trim();
    }

    function listeningAnswerDiff(actual, expected) {
      var actualWords = String(actual || '').trim().split(/\s+/u).filter(Boolean);
      var expectedWords = String(expected || '').trim().split(/\s+/u).filter(Boolean);
      var rows = Array.from({ length: actualWords.length + 1 }, function () { return Array(expectedWords.length + 1).fill(0); });
      for (var i = actualWords.length - 1; i >= 0; i--) {
        for (var j = expectedWords.length - 1; j >= 0; j--) {
          rows[i][j] = normalizeListeningAnswer(actualWords[i]) === normalizeListeningAnswer(expectedWords[j])
            ? rows[i + 1][j + 1] + 1
            : Math.max(rows[i + 1][j], rows[i][j + 1]);
        }
      }
      var ai = 0, ei = 0, parts = [], missing = 0, extra = 0;
      while (ai < actualWords.length && ei < expectedWords.length) {
        if (normalizeListeningAnswer(actualWords[ai]) === normalizeListeningAnswer(expectedWords[ei])) {
          parts.push('<mark class="match">' + esc(actualWords[ai]) + '</mark>'); ai++; ei++;
        } else if (rows[ai + 1][ei] >= rows[ai][ei + 1]) {
          parts.push('<mark class="extra">' + esc(actualWords[ai]) + '</mark>'); extra++; ai++;
        } else { missing++; ei++; }
      }
      while (ai < actualWords.length) { parts.push('<mark class="extra">' + esc(actualWords[ai++]) + '</mark>'); extra++; }
      missing += expectedWords.length - ei;
      return { html:parts.join(' '), missing:missing, extra:extra };
    }

    function listeningMode(item) {
      if (item && (item.mode === 'choice' || item.mode === 'understand')) return item.mode === 'understand' ? 'understand' : 'choose';
      return 'type';
    }

    function listeningModeLabel(mode) {
      if (mode === 'choose') return tr('Listen & Choose', 'Слушайте и выбирайте');
      if (mode === 'understand') return tr('Listen & Understand', 'Слушайте и понимайте');
      return tr('Listen & Type', 'Слушайте и пишите');
    }

    function safeListeningHint(item) {
      var hint = String(item && item.hint || '').trim();
      var answer = String(item && (item.answer || item.text) || '').trim();
      if (!hint || normalizeListeningAnswer(hint) === normalizeListeningAnswer(answer)) {
        return tr('Listen for the key words and the sentence ending.', 'Обратите внимание на ключевые слова и окончание фразы.');
      }
      return hint;
    }

    function formatListeningTime(seconds) {
      var safe = Math.max(0, Number(seconds || 0));
      return Math.floor(safe / 60) + ':' + String(Math.floor(safe % 60)).padStart(2, '0');
    }

    function renderListening() {
      if (!studyState.skillDirect) return renderSkillsHub();
      stopListeningPlayback();
      if (!studyState.data) studyState.data = shuffle(strictBank(LISTEN, studyState.lang, studyState.level));
      var deck = studyState.data;
      if (!deck.length) return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 3);
      var item = deck[studyState.idx], mode = listeningMode(item);
      var listeningKicker = $('#studyOverlayKicker');
      if (listeningKicker) listeningKicker.textContent = 'LISTENING · ' + String(studyState.lang || '').toUpperCase() + ' ' + studyState.level;
      var expectedAnswer = String(item.answer || item.text || '').trim();
      var attemptKey = item.id || String(studyState.idx);
      studyState.listeningAttempts = studyState.listeningAttempts || {};
      var attemptState = studyState.listeningAttempts[attemptKey] || { used:0, max:3 };
      studyState.listeningAttempts[attemptKey] = attemptState;
      studyState.total = deck.length;
      updatePracticeChrome();
      if (item.audioClip) prepareListeningRecording(item.audioClip).catch(function () {});
      var host = $('#studyToolBody');
      var answerControl = mode === 'type'
        ? '<label class="listening-answer-label" for="lsInput"><span>' + esc(tr('YOUR ANSWER', 'ВАШ ОТВЕТ')) + '</span><b>' + esc(item.prompt || tr('Type exactly what you hear', 'Запишите точно то, что услышали')) + '</b></label><textarea id="lsInput" rows="2" placeholder="' + esc(tr('Start typing…', 'Начните вводить…')) + '" autocomplete="off" spellcheck="false"></textarea>'
        : '<fieldset class="listening-options"><legend>' + esc(item.prompt || tr('Choose the best answer', 'Выберите лучший ответ')) + '</legend>' + (item.options || []).map(function (option, optionIndex) { return '<label><input type="radio" name="listening-answer" value="' + esc(option) + '"><span><i>' + String.fromCharCode(65 + optionIndex) + '</i>' + esc(option) + '</span></label>'; }).join('') + '</fieldset>';
      host.innerHTML = '<div class="listening-lab"><header class="listening-task-head"><div><span>' + esc(listeningModeLabel(mode)) + '</span><h2>' + esc(mode === 'type' ? tr('Listen to the phrase', 'Прослушайте фразу') : (item.prompt || tr('Listen and choose', 'Прослушайте и выберите'))) + '</h2><p>' + esc(tr('Play, replay or slow the audio before answering.', 'Слушайте повторно или замедлите аудио перед ответом.')) + '</p></div><div class="listening-attempts"><b>' + esc(tr('Attempts', 'Попытки')) + '</b><span id="lsAttempts">' + (attemptState.max - attemptState.used) + ' / ' + attemptState.max + '</span></div></header>' +
        '<section class="listening-player" aria-labelledby="listeningPlayerTitle"><div class="listening-player-copy"><span id="listeningPlayerTitle">' + esc(tr('AUDIO', 'АУДИО')) + '</span><strong>' + esc(tr('Ready to play', 'Готово к прослушиванию')) + '</strong></div><div class="listening-progress" aria-hidden="true"><i id="lsAudioProgress"></i></div><time id="lsAudioTime">0:00</time><div class="listening-player-actions"><button class="listening-play" id="lsPlay" type="button" aria-live="polite" aria-pressed="false"><span class="listening-play-icon" aria-hidden="true">▶</span><span>' + esc(tr('Play', 'Слушать')) + '</span></button><button class="listening-icon-button" id="lsReplay" type="button" aria-label="' + esc(tr('Replay audio', 'Воспроизвести заново')) + '" title="' + esc(tr('Replay audio', 'Воспроизвести заново')) + '">↻</button><label class="listening-rate"><span>' + esc(tr('Speed', 'Скорость')) + '</span><select id="lsRate" aria-label="' + esc(tr('Playback speed', 'Скорость воспроизведения')) + '"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label></div><div class="listening-player-meta"><div id="lsAudioStatus" role="status">' + esc(tr('Press play when you are ready.', 'Нажмите «Слушать», когда будете готовы.')) + '</div></div></section>' +
        '<form class="listening-answer" id="lsForm">' + answerControl + '<div class="listening-answer-foot"><button class="listening-hint-button" id="lsHint" type="button" aria-expanded="false">⌁ ' + esc(tr('Show hint', 'Показать подсказку')) + '</button><small>' + esc(tr('Enter checks a typed answer', 'Enter проверяет введённый ответ')) + '</small><button class="btn primary" id="lsCheck" type="submit" disabled>' + esc(tr('Check answer', 'Проверить ответ')) + '</button></div><div class="listening-context" id="lsHintPanel" hidden><span>' + esc(tr('CONTEXT HINT', 'ПОДСКАЗКА ПО КОНТЕКСТУ')) + '</span><p>' + esc(safeListeningHint(item)) + '</p></div></form><div id="lsFb" class="listening-feedback" aria-live="polite"></div></div>';
      var input = $('#lsInput');
      var choices = Array.prototype.slice.call(host.querySelectorAll('input[name="listening-answer"]'));
      function clearInlineFeedback() { $('#lsFb').className='listening-feedback'; $('#lsFb').innerHTML=''; }
      if (input) input.addEventListener('input', function () { $('#lsCheck').disabled=!this.value.trim(); clearInlineFeedback(); });
      choices.forEach(function (choice) { choice.addEventListener('change', function () { $('#lsCheck').disabled=false; clearInlineFeedback(); }); });
      var rateSelect = $('#lsRate');
      rateSelect.value = String(Number(studyState.speechRate || 1));
      rateSelect.addEventListener('change', function () { studyState.speechRate=Number(this.value||1); if(listeningAudio)listeningAudio.playbackRate=studyState.speechRate; });
      $('#lsHint').addEventListener('click', function () { var panel=$('#lsHintPanel');panel.hidden=!panel.hidden;this.setAttribute('aria-expanded',panel.hidden?'false':'true');this.textContent=panel.hidden?'⌁ '+tr('Show hint','Показать подсказку'):'⌁ '+tr('Hide hint','Скрыть подсказку'); });
      function updateAudioProgress(elapsed,duration){var progress=$('#lsAudioProgress'),time=$('#lsAudioTime');if(progress)progress.style.width=(duration?Math.min(100,elapsed/duration*100):0)+'%';if(time)time.textContent=formatListeningTime(elapsed)+(duration?' / '+formatListeningTime(duration):'');}
      async function beginListeningPlayback(){
        var button=$('#lsPlay'),replay=$('#lsReplay'),status=$('#lsAudioStatus'),rate=Number(studyState.speechRate||1);
        stopListeningPlayback();
        var runId=listeningPlaybackRun,unlockedAudio=unlockListeningAudio();
        button.disabled=true;replay.disabled=true;
        var preferredPreparation=(item.audioClip ? prepareListeningRecording(item.audioClip) : prepareListeningFish(item.text, studyState.lang, rate)).then(function(value){return{value:value,error:null};}).catch(function(error){return{value:null,error:error};});
        var countdownComplete=await runListeningCountdown(button,status,runId);if(!countdownComplete)return;
        try{
          setListeningButtonState(button,'loading',tr('Loading','Загрузка'));status.textContent=item.audioClip?tr('Loading the original recording…','Загружаем оригинальную запись…'):tr('Preparing Fish Audio…','Готовим Fish Audio…');
          var preparedResult=await preferredPreparation;if(preparedResult.error||!preparedResult.value)throw(preparedResult.error||new Error('audio unavailable'));
          await playListeningAudio(preparedResult.value,rate,runId,function(){button.disabled=false;replay.disabled=false;setListeningButtonState(button,'playing',tr('Pause','Пауза'));status.textContent=item.audioClip?tr('Original recording','Оригинальная запись'):'Fish Audio';},updateAudioProgress,unlockedAudio);
          if(runId===listeningPlaybackRun){button.disabled=false;replay.disabled=false;setListeningButtonState(button,'ready',tr('Play again','Прослушать ещё раз'));if(input)input.focus();}
        }catch(recordingError){
          if(runId!==listeningPlaybackRun)return;
          if(item.audioClip){try{setListeningButtonState(button,'loading',tr('Loading','Загрузка'));status.textContent=tr('Recording unavailable. Preparing Fish Audio…','Запись недоступна. Готовим Fish Audio…');var fish=await prepareListeningFish(item.text,studyState.lang,rate);await playListeningAudio(fish,rate,runId,function(){button.disabled=false;replay.disabled=false;setListeningButtonState(button,'playing',tr('Pause','Пауза'));status.textContent='Fish Audio';},updateAudioProgress,unlockedAudio);if(runId===listeningPlaybackRun){button.disabled=false;replay.disabled=false;setListeningButtonState(button,'ready',tr('Play again','Прослушать ещё раз'));if(input)input.focus();}return;}catch(fishError){if(runId!==listeningPlaybackRun)return;}}
          try{button.disabled=false;replay.disabled=false;playListeningBrowserFallback(item.text,studyState.lang,rate,runId,button,status);return;}catch(fallbackError){var reason=(recordingError&&recordingError.message)||tr('unknown error','неизвестная ошибка');status.textContent=tr('Audio could not be played: ','Аудио не воспроизвелось: ')+reason;}
        }
        if(runId===listeningPlaybackRun){button.disabled=false;replay.disabled=false;setListeningButtonState(button,'ready',tr('Try again','Попробовать ещё раз'));}
      }
      $('#lsPlay').addEventListener('click',function(){var button=$('#lsPlay'),status=$('#lsAudioStatus');if(listeningAudio&&button.dataset.state==='playing'){listeningAudio.pause();setListeningButtonState(button,'paused',tr('Resume','Продолжить'));status.textContent=tr('Audio paused.','Аудио на паузе.');return;}if(listeningAudio&&button.dataset.state==='paused'){listeningAudio.play().then(function(){setListeningButtonState(button,'playing',tr('Pause','Пауза'));status.textContent=tr('Playing audio…','Аудио воспроизводится…');}).catch(function(){status.textContent=tr('Audio could not resume.','Не удалось продолжить аудио.');});return;}beginListeningPlayback();});
      $('#lsReplay').addEventListener('click',beginListeningPlayback);
      function selectedListeningAnswer(){if(input)return input.value;var checked=host.querySelector('input[name="listening-answer"]:checked');return checked?checked.value:'';}
      $('#lsForm').addEventListener('submit',function(event){
        event.preventDefault();stopListeningPlayback();
        var rawValue=selectedListeningAnswer().trim();if(!rawValue)return;
        var ok=normalizeListeningAnswer(rawValue,true)===normalizeListeningAnswer(expectedAnswer,true);
        attemptState.used++;var remaining=Math.max(0,attemptState.max-attemptState.used);$('#lsAttempts').textContent=remaining+' / '+attemptState.max;
        var feedbackHost=$('#lsFb');
        if(!ok&&remaining>0){var diff=listeningAnswerDiff(rawValue,expectedAnswer);feedbackHost.className='listening-feedback bad retry';feedbackHost.innerHTML='<div><span>!</span><div><b>'+esc(tr('Not quite. Listen once more and try again.','Пока неточно. Прослушайте ещё раз и повторите.'))+'</b>'+(mode==='type'?'<p class="listening-diff">'+diff.html+'</p><small>'+diff.missing+' '+esc(tr('missing','пропущено'))+' · '+diff.extra+' '+esc(tr('extra','лишних'))+'</small>':'')+'</div></div>';$('#lsCheck').textContent=tr('Check again','Проверить ещё раз');if(input){input.focus();input.select();}else{var selected=host.querySelector('input[name="listening-answer"]:checked');if(selected)selected.checked=false;$('#lsCheck').disabled=true;}return;}
        if(ok)studyState.score++;
        feedback(ok,{kind:'listening',prompt:item.prompt||item.hint,chosen:rawValue,correct:expectedAnswer,attemptsUsed:attemptState.used,mode:mode});
        if(ok)clearMistake(studyState.lang,item.prompt||item.hint||expectedAnswer);else logMistake(studyState.lang,item.prompt||item.hint||expectedAnswer,item.options&&item.options.length?item.options:[expectedAnswer],0,'listening',{sourceTool:'listening',audioClip:item.audioClip||null,audioText:item.text||''});
        feedbackHost.className='listening-feedback '+(ok?'ok':'bad');feedbackHost.innerHTML='<div><span>'+(ok?'✓':'!')+'</span><div><b>'+esc(ok?tr('Correct — you heard it accurately.','Верно — вы точно распознали фразу.'):tr('Review the answer before continuing.','Разберите ответ перед продолжением.'))+'</b>'+(!ok?'<p><strong>'+esc(tr('Expected: ','Правильный ответ: '))+'</strong>'+esc(expectedAnswer)+'</p>':'')+'</div></div><button class="btn primary" id="lsContinue" type="button">'+esc(tr('Continue','Продолжить'))+'</button>';
        $('#lsCheck').disabled=true;if(input)input.disabled=true;choices.forEach(function(choice){choice.disabled=true;});$('#lsPlay').disabled=true;$('#lsReplay').disabled=true;$('#lsRate').disabled=true;$('#lsHint').disabled=true;persistResume();
        $('#lsContinue').addEventListener('click',function(){studyState.idx++;persistResume();renderListening();});$('#lsContinue').focus();
      });
    }

    // ---- 7. Reading lab ----
    function renderReading() {
      if (!studyState.skillDirect) return renderSkillsHub();
      var host = $('#studyToolBody');
      if (readingBankState.status === 'idle') {
        readingLoadingState(host);
        loadReadingBank(false).then(function(){ if(studyState&&studyState.tool==='reading')renderReading(); });
        return;
      }
      if (readingBankState.status === 'loading') return readingLoadingState(host);
      if (readingBankState.status === 'error') return readingUnavailableState(host,'error');
      if (!studyState.data) {
        var passages=exactReadingTasks(studyState.lang,studyState.level);
        if(!passages.length)return readingUnavailableState(host,'empty');
        var passageIndex=Math.abs(String(studyState.clientSessionId||'').split('').reduce(function(sum,char){return sum+char.charCodeAt(0);},0))%passages.length;
        studyState.data={passage:passages[passageIndex],qIdx:0,answered:false,attempts:0,poolCount:passages.length};
        studyState.startedAt=Date.now();
      }
      var d = studyState.data, passage = d.passage, total=passage.questions.length;
      if (d.qIdx >= total) return finishTool(studyState.score + ' / ' + total, total * 3);
      var question = passage.questions[d.qIdx],selected=d.selectedAnswer||'';
      var levels=(readingBankState.counts[readingTarget(studyState.lang)]||{}),availableLevels=['A1','A2','B1','B2','C1','C2'].filter(function(level){return Number(levels[level]||0)>0;});
      host.innerHTML =
        '<section class="reading-lab-shell">' +
          '<header class="reading-lab-header"><div><small>DUVELA · '+esc(tr('READING PRACTICE','ПРАКТИКА ЧТЕНИЯ'))+'</small><h2>📖 '+esc(tr('Reading Lab','Лаборатория чтения'))+'</h2></div><div class="reading-lab-meta"><label><span>'+esc(tr('Language','Язык'))+'</span><select id="readingLanguage">'+readingLanguageOptions(studyState.lang)+'</select></label><label><span>'+esc(tr('Level','Уровень'))+'</span><select id="readingLevel">'+availableLevels.map(function(level){return '<option'+(level===studyState.level?' selected':'')+'>'+level+'</option>';}).join('')+'</select></label></div></header>' +
          '<div class="reading-progress" aria-label="'+esc(tr('Exercise progress','Прогресс упражнения'))+'"><div><b>'+esc(tr('Question','Вопрос'))+' '+(d.qIdx+1)+' / '+total+'</b><span>'+esc(studyState.score+' '+tr('correct','правильно')+' · '+Number(d.attempts||0)+' '+tr('attempts','попыток'))+'</span></div><i><span style="width:'+Math.round(d.qIdx/total*100)+'%"></span></i></div>' +
          '<div class="reading-workspace"><article class="reading-passage"><div class="reading-panel-label">'+esc(tr('READING TEXT','ТЕКСТ ДЛЯ ЧТЕНИЯ'))+' · '+esc(String(passage.genre||tr('passage','текст')).toUpperCase())+'</div><h3>'+esc(passage.title)+'</h3><div class="reading-copy">'+esc(passage.text).replace(/\n/g,'<br>')+'</div><footer>'+d.poolCount+' '+esc(tr('verified texts at this exact level','проверенных текстов этого уровня'))+'</footer></article>' +
          '<section class="reading-question"><div class="reading-panel-label">'+esc(tr('QUESTION','ВОПРОС'))+' '+(d.qIdx+1)+'</div><h3>'+esc(question.prompt)+'</h3><form id="readingAnswerForm"><div class="reading-options">'+question.options.map(function(option,index){return '<label><input type="radio" name="readingAnswer" value="'+index+'"'+(selected===option?' checked':'')+'><span>'+esc(option)+'</span></label>';}).join('')+'</div><button class="btn primary" id="readingSubmit" type="submit" disabled>'+esc(tr('Submit answer','Проверить ответ'))+'</button></form><div id="readingFeedback" class="reading-feedback" aria-live="polite"></div></section></div>'+
        '</section>';
      if(!d.hasRendered){var overlayBody=$('#studyOverlayBody');if(overlayBody)overlayBody.scrollTop=0;d.hasRendered=true;}
      bindReadingSelectors(host);
      var form=$('#readingAnswerForm'),submit=$('#readingSubmit');
      form.addEventListener('change',function(){var checked=form.querySelector('input[name="readingAnswer"]:checked');submit.disabled=!checked;d.selectedAnswer=checked?question.options[Number(checked.value)]:'';});
      form.addEventListener('submit',function(event){
        event.preventDefault();var checked=form.querySelector('input[name="readingAnswer"]:checked');if(!checked)return;
        var chosen=question.options[Number(checked.value)],ok=chosen===question.answer;d.attempts=Number(d.attempts||0)+1;if(ok)studyState.score++;
        studyState.answers.push({ok:ok,prompt:question.prompt,chosen:chosen,correct:question.answer,explanation:question.evidence,attemptsUsed:1});
        if(ok)clearMistake(studyState.lang,question.prompt);else logMistake(studyState.lang,question.prompt,question.options,question.options.indexOf(question.answer),'reading');
        Array.prototype.forEach.call(form.querySelectorAll('input'),function(input){input.disabled=true;});submit.disabled=true;
        var feedbackHost=$('#readingFeedback');feedbackHost.className='reading-feedback '+(ok?'ok':'bad');feedbackHost.innerHTML='<div><b>'+(ok?'✓ '+esc(tr('Correct','Верно')):'! '+esc(tr('Not quite','Неверно')))+'</b>'+(!ok?'<p>'+esc(tr('Correct answer: ','Правильный ответ: '))+esc(question.answer)+'</p>':'')+'<small>'+esc(question.evidence||'')+'</small></div><button class="btn primary" id="readingNext" type="button">'+esc(d.qIdx+1>=total?tr('See results','Посмотреть результат'):tr('Next question','Следующий вопрос'))+' →</button>';
        d.answered=true;persistResume();$('#readingNext').onclick=function(){d.qIdx++;d.answered=false;d.selectedAnswer='';renderReading();};$('#readingNext').focus();
      });
    }

    function readingLanguageOptions(current) {
      var counts=readingBankState.counts||{},map={english:'en',german:'de',spanish:'es',swedish:'sv'};
      return Object.keys(counts).filter(function(target){return Object.keys(counts[target]||{}).some(function(level){return counts[target][level]>0;});}).map(function(target){var code=map[target]||target;return '<option value="'+esc(code)+'"'+(code===normalizePracticeTarget(current)?' selected':'')+'>'+esc(targetLabel(code))+'</option>';}).join('');
    }
    function bindReadingSelectors(host) {
      var language=host.querySelector('#readingLanguage'),level=host.querySelector('#readingLevel');
      if(language)language.onchange=function(){studyState.lang=language.value;studyState.level=currentPracticeLevel(language.value);var levels=readingBankState.counts[readingTarget(language.value)]||{};if(!levels[studyState.level])studyState.level=Object.keys(levels)[0]||studyState.level;studyState.data=null;studyState.score=0;studyState.answers=[];clearResume();renderReading();};
      if(level)level.onchange=function(){studyState.level=normalizePracticeLevel(level.value,'A1');var prefs=loadPrefs();prefs.levels=prefs.levels||{};prefs.levels[studyState.lang]=studyState.level;savePrefs(prefs);studyState.data=null;studyState.score=0;studyState.answers=[];studyState.clientSessionId=sessionId();clearResume();renderReading();};
    }
    function readingLoadingState(host) {
      host.innerHTML='<div class="reading-state reading-loading" role="status"><span class="reading-spinner"></span><h2>'+esc(tr('Loading reading exercises…','Загружаем упражнения для чтения…'))+'</h2><p>'+esc(tr('Checking the exact language and CEFR level.','Проверяем точное совпадение языка и уровня CEFR.'))+'</p></div>';
    }
    function readingUnavailableState(host,kind) {
      var target=readingTarget(studyState.lang),counts=readingBankState.counts[target]||{},alternatives=['A1','A2','B1','B2','C1','C2'].filter(function(level){return level!==studyState.level&&Number(counts[level]||0)>0;});
      var isError=kind==='error',message=isError?tr('Reading exercises could not be loaded.','Не удалось загрузить упражнения для чтения.'):tr('No '+studyState.level+' reading exercises are available yet.','Упражнения по чтению уровня '+studyState.level+' пока недоступны.');
      host.innerHTML='<div class="reading-state '+(isError?'reading-error':'reading-empty')+'"><span>'+(isError?'!':'📖')+'</span><small>'+esc(isError?tr('LOADING ERROR','ОШИБКА ЗАГРУЗКИ'):tr('CONTENT UNAVAILABLE','МАТЕРИАЛ НЕДОСТУПЕН'))+'</small><h2>'+esc(message)+'</h2><p>'+esc(isError?tr('The content bank did not respond. Your session was not started.','Банк материалов не ответил. Сессия не была запущена.'):tr('No matching published exercise was returned for this language and exact level.','Для этого языка и точного уровня нет опубликованных упражнений.'))+'</p><div class="reading-state-actions"><button class="btn primary" id="readingRetry">'+esc(tr('Retry','Повторить'))+'</button>'+(alternatives.length?'<label><span>'+esc(tr('Change level','Изменить уровень'))+'</span><select id="readingAlternative"><option value="">—</option>'+alternatives.map(function(level){return '<option>'+level+' · '+counts[level]+'</option>';}).join('')+'</select></label>':'')+'<button class="btn" id="readingBack">← '+esc(tr('Back to Practice','Назад к практике'))+'</button></div></div>';
      $('#readingRetry').onclick=function(){studyState.data=null;loadReadingBank(true).then(function(){if(studyState&&studyState.tool==='reading')renderReading();});readingLoadingState(host);};
      var alternative=$('#readingAlternative');if(alternative)alternative.onchange=function(){if(!alternative.value)return;studyState.level=normalizePracticeLevel(alternative.value,'A1');studyState.data=null;studyState.score=0;studyState.answers=[];renderReading();};
      $('#readingBack').onclick=closeStudy;
    }

    // ---- 8. Writing Studio ----
    function writingEvaluationHtml(result) {
      if(!result)return '';
      var criteria=result.criteria||{},rows=[[tr('Task completion','Выполнение задания'),criteria.taskCompletion],[tr('Grammar','Грамматика'),criteria.grammar],[tr('Vocabulary','Словарь'),criteria.vocabulary],[tr('Structure','Структура'),criteria.structure]];
      return '<section class="writing-evaluation ai-evaluation"><header><span>✨</span><div><small>'+esc(tr('AUTOMATED FORMATIVE FEEDBACK','АВТОМАТИЧЕСКАЯ УЧЕБНАЯ ОБРАТНАЯ СВЯЗЬ'))+'</small><h3>'+Number(result.overall||0)+' / 100</h3></div><em>'+esc(result._savedToAccount?tr('Saved to account','Сохранено в аккаунте'):tr('Result not saved to account','Результат не сохранён в аккаунте'))+'</em></header><p class="ai-summary">'+esc(result.summary||'')+'</p><div>'+rows.map(function(row){var score=Math.max(0,Math.min(100,Number(row[1]||0)));return '<span><small>'+esc(row[0])+'</small><b>'+score+'%</b><i><em style="width:'+score+'%"></em></i></span>';}).join('')+'</div>'+((result.strengths||[]).length?'<article class="ai-strengths"><b>'+esc(tr('What already works','Что уже получается'))+'</b><ul>'+result.strengths.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul></article>':'')+((result.corrections||[]).length?'<article class="ai-corrections"><b>'+esc(tr('Corrections with explanations','Исправления с объяснениями'))+'</b>'+result.corrections.map(function(item,index){var rejected=studyState.writingRejected&&studyState.writingRejected[index];return '<div class="writing-correction '+(rejected?'rejected':'')+'"><p><del>'+esc(item.original)+'</del><strong>'+esc(item.corrected)+'</strong><small>'+esc(item.explanation)+'</small></p><div><button type="button" data-writing-accept="'+index+'">'+esc(tr('Accept','Принять'))+'</button><button type="button" data-writing-reject="'+index+'">'+esc(rejected?tr('Rejected','Отклонено'):tr('Reject','Отклонить'))+'</button></div></div>';}).join('')+'</article>':'')+(result.improvedVersion?'<details class="writing-improved"><summary>'+esc(tr('Suggested improved version','Предлагаемый улучшенный вариант'))+'</summary><p>'+esc(result.improvedVersion)+'</p></details>':'')+'<article><b>'+esc(tr('Next improvement','Следующее улучшение'))+'</b><p>'+esc(result.nextStep||'')+'</p></article><p class="writing-ai-note">'+esc(tr('AI feedback supports practice and is not an official exam or certification result.','AI-обратная связь помогает в обучении и не является официальным результатом экзамена или сертификации.'))+'</p></section>';
    }

    function scheduleWritingSave(status) {
      if(!studyState)return;
      var resume={tool:'writing',lang:studyState.lang,level:studyState.level,idx:0,score:0,clientSessionId:studyState.clientSessionId,startedAt:studyState.startedAt,writingDraft:studyState.writingDraft||'',writingTaskId:studyState.data&&studyState.data.id||'',checked:studyState.checked||{},writingVersions:studyState.writingVersions||[],at:Date.now()};
      try{localStorage.setItem(RESUME_KEY,JSON.stringify(resume));if(status){status.className='writing-save-status local';status.textContent=tr('Saved locally','Сохранено локально');}}catch(error){if(status){status.className='writing-save-status failed';status.textContent=tr('Local save failed','Ошибка локального сохранения');}return;}
      clearTimeout(studyState.writingSaveTimer);
      if(!uid()||!navigator.onLine)return;
      studyState.writingSaveTimer=setTimeout(async function(){if(!studyState||studyState.tool!=='writing')return;if(status){status.className='writing-save-status saving';status.textContent=tr('Saving to account…','Сохраняем в аккаунт…');}var result=await supa.from('practice_resume').upsert({user_id:uid(),tool_id:'writing',language:resume.lang,level:resume.level,current_step:0,score:0,state:{startedAt:resume.startedAt,writingDraft:resume.writingDraft,writingTaskId:resume.writingTaskId,checked:resume.checked,writingVersions:resume.writingVersions},client_session_id:resume.clientSessionId,updated_at:new Date().toISOString()});if(!status)return;if(result.error){status.className='writing-save-status failed';status.textContent=tr('Account save failed','Не удалось сохранить в аккаунт');}else{status.className='writing-save-status account';status.textContent=tr('Saved to account','Сохранено в аккаунте');}},800);
    }

    async function loadWritingStudioData() {
      var history=$('#writingHistoryList'),teacher=$('#writingTeacherSelect'),teacherNote=$('#writingTeacherNote');
      if(!history||!teacher)return;
      if(!uid()){history.innerHTML='<p>'+esc(tr('Sign in to view account history. Local draft recovery remains available.','Войдите, чтобы увидеть историю аккаунта. Локальное восстановление черновика остаётся доступным.'))+'</p>';teacherNote.textContent=tr('Sign in to share work with an authorized teacher.','Войдите, чтобы поделиться работой с авторизованным преподавателем.');return;}
      var results=await Promise.all([supa.from('practice_ai_evaluations').select('id,prompt,answer_text,result,created_at').eq('user_id',uid()).eq('tool_id','writing').order('created_at',{ascending:false}).limit(8),supa.from('practice_submissions').select('id,teacher_id,content_text,status,score,feedback,created_at,reviewed_at').eq('student_id',uid()).eq('tool_id','writing').order('created_at',{ascending:false}).limit(8),supa.from('practice_assignments').select('id,teacher_id,status,created_at').eq('student_id',uid()).order('created_at',{ascending:false}).limit(20)]);
      var evaluations=results[0].data||[],submissions=results[1].data||[],assignments=(results[2].data||[]).filter(function(row){return row.teacher_id;});
      var ids=assignments.map(function(row){return row.teacher_id;}).filter(function(id,index,list){return list.indexOf(id)===index;}),names={};
      if(ids.length){var profiles=await supa.from('profiles').select('id,full_name').in('id',ids);(profiles.data||[]).forEach(function(row){names[row.id]=row.full_name;});}
      teacher.innerHTML='<option value="">'+esc(tr('Choose teacher','Выберите преподавателя'))+'</option>'+assignments.map(function(row){return '<option value="'+esc(row.id)+'" data-teacher-id="'+esc(row.teacher_id)+'">'+esc(names[row.teacher_id]||tr('Connected teacher','Связанный преподаватель'))+'</option>';}).join('');
      teacher.disabled=!assignments.length;teacherNote.textContent=assignments.length?tr('Only teachers connected through an assignment are available.','Доступны только преподаватели, связанные через назначенное задание.'):tr('No eligible connected teacher is available yet.','Подходящий связанный преподаватель пока недоступен.');
      var rows=evaluations.map(function(row){return {kind:tr('AI feedback','AI-обратная связь'),text:row.answer_text,status:tr('Evaluated','Проверено'),date:row.created_at,feedback:row.result&&row.result.summary};}).concat(submissions.map(function(row){return {kind:tr('Teacher review','Проверка преподавателя'),text:row.content_text,status:row.status,date:row.created_at,feedback:row.feedback};})).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
      history.innerHTML=rows.length?rows.map(function(row){return '<article><div><b>'+esc(row.kind)+'</b><time>'+esc(new Date(row.date).toLocaleDateString())+'</time></div><p>'+esc(String(row.text||'').slice(0,180))+'</p><small>'+esc(row.status)+(row.feedback?' · '+esc(row.feedback):'')+'</small></article>';}).join(''):'<p>'+esc(tr('No stored writing attempts yet.','Сохранённых письменных работ пока нет.'))+'</p>';
    }

    async function sendWritingToTeacher(task,text) {
      var select=$('#writingTeacherSelect'),status=$('#writingTeacherStatus'),option=select&&select.options[select.selectedIndex];
      if(!uid()){status.textContent=tr('Sign in before sharing.','Войдите перед отправкой.');return;}
      if(!select||!select.value||!option){status.textContent=tr('Choose an eligible teacher first.','Сначала выберите доступного преподавателя.');return;}
      var confirmed=ctx.confirm?await ctx.confirm(tr('Share this writing and its task with the selected teacher?','Отправить этот текст и задание выбранному преподавателю?'),{title:tr('Send for teacher review','Отправить на проверку'),confirmLabel:tr('Send','Отправить'),cancelLabel:tr('Cancel','Отмена'),icon:'✉'}):confirm(tr('Send this writing to the selected teacher?','Отправить этот текст выбранному преподавателю?'));
      if(!confirmed)return;status.textContent=tr('Sending…','Отправляем…');var result=await supa.from('practice_submissions').insert({student_id:uid(),teacher_id:option.getAttribute('data-teacher-id'),assignment_id:select.value,tool_id:'writing',submission_type:'writing',content_text:text,status:'submitted'}).select('id,status,created_at').single();
      if(result.error){status.textContent=tr('Send failed: ','Ошибка отправки: ')+result.error.message;return;}status.textContent=tr('Delivered to the teacher for review.','Доставлено преподавателю на проверку.');loadWritingStudioData();
    }

    function renderWriting() {
      if (!studyState.data) {
        var picks=strictBank(WRITING,studyState.lang,studyState.level),restoredId=studyState.writingTaskId;
        if(!picks.length)return noLevelContent();
        studyState.data=picks.find(function(item){return item.id===restoredId;})||picks[0];
        studyState.checked=studyState.checked||{};studyState.writingVersions=studyState.writingVersions||[];
      }
      var task=studyState.data,host=$('#studyToolBody'),text=studyState.writingDraft||'',words=text.trim()?text.trim().split(/\s+/).length:0,checkedCount=Object.keys(studyState.checked).filter(function(k){return studyState.checked[k];}).length,evaluatedCurrent=studyState.writingEvaluation&&studyState.writingEvaluationHash===writingTextHash(text);
      host.innerHTML='<section class="writing-studio"><header class="writing-studio-toolbar"><div><small>DUVELA · '+esc(targetLabel(studyState.lang).toUpperCase())+' '+esc(studyState.level)+'</small><h2>'+esc(tr('Writing Studio','Студия письма'))+'</h2><p>'+esc(task.title)+'</p></div><div><span>'+esc(tr('Task','Задание'))+' 1 / '+strictBank(WRITING,studyState.lang,studyState.level).length+'</span><button type="button" id="writingFullscreen" aria-label="'+esc(tr('Fullscreen editor','Полноэкранный редактор'))+'">⛶</button></div></header><div class="writing-studio-grid"><main class="writing-editor-panel"><section class="writing-task-card"><small>'+esc(tr('WRITING TASK','ПИСЬМЕННОЕ ЗАДАНИЕ'))+'</small><h3>'+esc(task.prompt)+'</h3><p>'+esc(task.instructions||'')+'</p><div><span>'+task.minWords+'–'+task.maxWords+' '+esc(tr('recommended words','рекомендуемых слов'))+'</span>'+(task.vocabulary||[]).map(function(word){return '<em>'+esc(word)+'</em>';}).join('')+'</div></section><label class="writing-editor"><span>'+esc(tr('Your text','Ваш текст'))+'</span><textarea id="wrText" rows="12" spellcheck="true" placeholder="'+esc(tr('Start writing in the target language…','Начните писать на изучаемом языке…'))+'">'+esc(text)+'</textarea></label><div class="writing-editor-meta"><span id="wrCount">'+words+' '+esc(tr('words','слов'))+' · '+task.minWords+'–'+task.maxWords+'</span><span id="writingSaveStatus" class="writing-save-status local">'+esc(text?tr('Saved locally','Сохранено локально'):tr('New local draft','Новый локальный черновик'))+'</span></div><div id="writingEvaluation">'+writingEvaluationHtml(studyState.writingEvaluation)+'</div><div class="writing-actions"><button class="btn primary" id="wrEvaluate" '+(!text.trim()?'disabled':'')+'>✨ '+esc(studyState.writingEvaluation?tr('Re-evaluate revision','Проверить новую версию'):tr('Evaluate my writing','Проверить мою работу'))+'</button><button class="btn" id="wrTryAgain">↻ '+esc(tr('Save version & revise','Сохранить версию и исправить'))+'</button><button class="btn" id="wrDone" '+(!evaluatedCurrent?'disabled':'')+'>'+esc(tr('Finish session','Завершить занятие'))+'</button></div></main><aside class="writing-support-panel"><details open><summary>'+esc(tr('Self-check','Самопроверка'))+' <b>'+checkedCount+'/'+task.checklist.length+'</b></summary><p>'+esc(tr('This checklist is your own review, not proof of correctness.','Этот чек-лист — ваша самопроверка, а не подтверждение правильности.'))+'</p>'+task.checklist.map(function(item,index){return '<label><input type="checkbox" data-chk="'+index+'" '+(studyState.checked[index]?'checked':'')+'><span>'+esc(item)+'</span></label>';}).join('')+'</details><details open><summary>'+esc(tr('Writing tip','Совет по письму'))+'</summary><p>'+esc(tr('Use clear sentences, connect ideas and reread the task before evaluation.','Используйте ясные предложения, связывайте мысли и перечитайте задание перед проверкой.'))+'</p></details><details class="writing-teacher-card"><summary>'+esc(tr('Teacher review','Проверка преподавателя'))+'</summary><select id="writingTeacherSelect" disabled><option>'+esc(tr('Loading eligible teachers…','Загружаем доступных преподавателей…'))+'</option></select><p id="writingTeacherNote"></p><button type="button" class="btn" id="wrSend">✉ '+esc(tr('Send selected work','Отправить выбранную работу'))+'</button><small id="writingTeacherStatus" role="status"></small></details><details><summary>'+esc(tr('My Writing History','Моя история письма'))+'</summary><div id="writingHistoryList" class="writing-history"><p>'+esc(tr('Loading stored attempts…','Загружаем сохранённые работы…'))+'</p></div></details></aside></div></section>';
      var input=$('#wrText'),saveStatus=$('#writingSaveStatus');
      input.addEventListener('input',function(){studyState.writingDraft=input.value;studyState.dirty=true;var count=input.value.trim()?input.value.trim().split(/\s+/).length:0;$('#wrCount').textContent=count+' '+tr('words','слов')+' · '+task.minWords+'–'+task.maxWords;$('#wrEvaluate').disabled=count<1;$('#wrDone').disabled=!(studyState.writingEvaluation&&studyState.writingEvaluationHash===writingTextHash(input.value));scheduleWritingSave(saveStatus);});
      $('#writingFullscreen').onclick=function(){$('#studyOverlay').classList.toggle('writing-fullscreen');input.focus();};
      Array.prototype.forEach.call(host.querySelectorAll('[data-chk]'),function(chk){chk.onchange=function(){studyState.checked[chk.getAttribute('data-chk')]=chk.checked;scheduleWritingSave(saveStatus);renderWriting();};});
      $('#wrTryAgain').onclick=function(){if(studyState.writingDraft&&studyState.writingVersions.indexOf(studyState.writingDraft)<0)studyState.writingVersions.push(studyState.writingDraft);scheduleWritingSave(saveStatus);input.focus();};
      $('#wrEvaluate').onclick=async function(){var value=input.value.trim(),count=value?value.split(/\s+/).length:0;if(count<8){$('#writingEvaluation').innerHTML='<p class="practice-warning">'+esc(tr('Write at least eight words so the feedback has enough context.','Напишите не менее восьми слов, чтобы для обратной связи было достаточно контекста.'))+'</p>';input.focus();return;}var button=this;button.disabled=true;button.textContent=tr('AI is checking…','AI проверяет…');$('#writingEvaluation').innerHTML='<div class="ai-checking"><i></i><span>'+esc(tr('Checking task completion, grammar, vocabulary and structure…','Проверяем выполнение задания, грамматику, словарь и структуру…'))+'</span></div>';try{var evaluation=await requestAiEvaluation('writing',{text:value,prompt:task.prompt+' '+(task.instructions||'')});studyState.writingDraft=value;studyState.writingEvaluation=evaluation;studyState.writingEvaluationHash=writingTextHash(value);studyState.clientSessionId='writing-'+task.id+'-'+studyState.writingEvaluationHash;scheduleWritingSave(saveStatus);renderWriting();}catch(error){button.disabled=false;button.textContent='✨ '+tr('Retry evaluation','Повторить проверку');$('#writingEvaluation').innerHTML='<div class="practice-warning"><b>'+esc(tr('AI evaluation failed','AI-проверка не выполнена'))+'</b><p>'+esc(error.message)+'</p></div>';}};
      Array.prototype.forEach.call(host.querySelectorAll('[data-writing-accept]'),function(button){button.onclick=function(){var item=studyState.writingEvaluation.corrections[Number(button.getAttribute('data-writing-accept'))];if(!item||studyState.writingDraft.indexOf(item.original)<0)return;studyState.writingVersions.push(studyState.writingDraft);studyState.writingDraft=studyState.writingDraft.replace(item.original,item.corrected);scheduleWritingSave(saveStatus);renderWriting();};});
      Array.prototype.forEach.call(host.querySelectorAll('[data-writing-reject]'),function(button){button.onclick=function(){studyState.writingRejected=studyState.writingRejected||{};studyState.writingRejected[button.getAttribute('data-writing-reject')]=true;renderWriting();};});
      $('#wrSend').onclick=function(){var value=$('#wrText').value.trim();if(!value){input.focus();return;}sendWritingToTeacher(task,value);};
      $('#wrDone').onclick=function(){if(this.disabled)return;finishTool(tr('Writing reviewed','Работа проверена'),10);};
      loadWritingStudioData();
    }

    // ---- 9. Exam mode (timed mixed quiz) ----
    function buildExamDeck(lang, level) {
      var deck = [];
      strictBank(GRAMMAR,lang,level).forEach(function (g) { deck.push({ q:g.q,opts:g.opts,a:g.a,level:g.level }); });
      strictBank(WORD_USAGE,lang,level).forEach(function (w) {
        var ci = w.opts.indexOf(w.a);
        deck.push({ q: w.s, opts: w.opts, a: ci < 0 ? 0 : ci });
      });
      if (lang === 'de') {
        shuffle(exactLevelItems(ARTICLES,level)).slice(0,6).forEach(function (ar) {
          deck.push({ q: '___ ' + ar.noun, opts: ['der', 'die', 'das'], a: ['der', 'die', 'das'].indexOf(ar.art) });
        });
      }
      return shuffle(deck);
    }
    function mockBlueprint() {
      return [
        {id:'reading',icon:'📖',title:'Reading',minutes:15},
        {id:'listening',icon:'🎧',title:'Listening',minutes:15},
        {id:'grammar',icon:'✎',title:'Language',minutes:15},
        {id:'writing',icon:'📝',title:'Writing',minutes:20},
        {id:'speaking',icon:'🎙',title:'Speaking',minutes:10}
      ];
    }
    function startFullMock() {
      studyState.mock={sections:mockBlueprint(),index:0,scores:{},startedAt:Date.now(),answers:{},evaluations:{}};
      studyState.data=null;studyState.idx=0;studyState.score=0;renderMockSection();
    }
    function renderMockSection() {
      var mock=studyState.mock, section=mock.sections[mock.index], host=$('#studyToolBody');
      if(!section)return finishFullMock();
      if(studyState.examTimerId){clearInterval(studyState.examTimerId);studyState.examTimerId=null;}
      studyState.examEndAt=Date.now()+section.minutes*60000;
      studyState.examTimerId=setInterval(function(){var el=$('#mockTimer');if(!el)return;var left=Math.max(0,Math.round((studyState.examEndAt-Date.now())/1000));el.textContent=(left/60|0)+':'+String(left%60).padStart(2,'0');if(!left)completeMockSection();},500);
      var nav='<div class="mock-progress">'+mock.sections.map(function(item,index){return '<span class="'+(index<mock.index?'done':index===mock.index?'active':'')+'"><i>'+item.icon+'</i><b>'+esc(item.title)+'</b></span>';}).join('')+'</div>';
      var header='<div class="mock-section-head"><div><small>'+esc(tr('FULL MOCK EXAM','ПОЛНЫЙ ПРОБНЫЙ ЭКЗАМЕН'))+'</small><h2>'+section.icon+' '+esc(section.title)+'</h2></div><strong id="mockTimer">'+section.minutes+':00</strong></div>';
      if(section.id==='writing'){
        var writing=strictBank(WRITING,studyState.lang,studyState.level)[0];
        if(!writing)return noLevelContent();
        host.innerHTML=nav+header+'<div class="mock-task"><b>'+esc(writing.prompt)+'</b><p>'+esc(tr('Write a complete answer. AI evaluation is included in the section result.','Напишите полный ответ. AI-проверка войдёт в результат секции.'))+'</p><textarea id="mockWriting" rows="10" placeholder="'+esc(tr('Your answer…','Ваш ответ…'))+'">'+esc(mock.answers.writing||'')+'</textarea><div class="mock-actions"><button class="btn primary" id="mockSectionDone">'+esc(tr('Submit section','Сдать секцию'))+' →</button></div></div>';
        $('#mockSectionDone').onclick=function(){mock.answers.writing=$('#mockWriting').value.trim();completeMockSection();};return;
      }
      if(section.id==='speaking'){
        host.innerHTML=nav+header+'<div class="mock-task mock-speaking"><span>🎙</span><h3>'+esc(tr('Speak for 60–90 seconds about your learning goals and explain why they matter.','Говорите 60–90 секунд о своих учебных целях и объясните, почему они важны.'))+'</h3><p>'+esc(tr('Use the microphone or type the recognized transcript if speech recognition is unavailable.','Используйте микрофон или введите распознанный текст, если распознавание недоступно.'))+'</p><textarea id="mockSpeaking" rows="7" placeholder="'+esc(tr('Recognized speech…','Распознанная речь…'))+'">'+esc(mock.answers.speaking||'')+'</textarea><div class="mock-actions"><button class="btn" id="mockRecord">🎙 '+esc(tr('Record answer','Записать ответ'))+'</button><button class="btn primary" id="mockSectionDone">'+esc(tr('Submit section','Сдать секцию'))+' →</button></div></div>';
        $('#mockRecord').onclick=function(){var Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return alert(tr('Speech recognition is unavailable. Type your answer instead.','Распознавание речи недоступно. Введите ответ текстом.'));var recognition=new Recognition();recognition.lang=SPEECH_LOCALE[studyState.lang]||'de-DE';recognition.interimResults=false;this.disabled=true;this.textContent=tr('Listening…','Слушаю…');recognition.onresult=function(event){$('#mockSpeaking').value=event.results[0][0].transcript;};recognition.onend=function(){var button=$('#mockRecord');if(button){button.disabled=false;button.textContent='🎙 '+tr('Record again','Записать снова');}};recognition.start();};
        $('#mockSectionDone').onclick=function(){mock.answers.speaking=$('#mockSpeaking').value.trim();completeMockSection();};return;
      }
      var deck;
      if(section.id==='reading'){var passage=exactReadingTasks(studyState.lang,studyState.level)[0];if(!passage)return noLevelContent();deck=passage.questions.map(function(q){return {q:q.prompt,opts:q.options,a:q.options.indexOf(q.answer),context:passage.text};});}
      else if(section.id==='listening'){deck=(LISTEN[studyState.lang]||LISTEN.de).slice(0,5).map(function(item){var opts=shuffle([item.text,item.text.split(' ').reverse().join(' '),item.hint,'—']);return {q:tr('Listen and choose the sentence','Прослушайте и выберите предложение'),opts:opts,a:opts.indexOf(item.text),speechText:item.text};});}
      else deck=buildExamDeck(studyState.lang,studyState.level).slice(0,10);
      if(!deck.length)return noLevelContent();
      mock.deck=deck;mock.question=0;mock.correct=0;renderMockQuestion(nav,header);
    }
    function renderMockQuestion(nav,header) {
      var mock=studyState.mock,section=mock.sections[mock.index],item=mock.deck[mock.question],host=$('#studyToolBody');
      if(!item)return completeMockSection();
      host.innerHTML=nav+header+'<div class="mock-question"><small>'+(mock.question+1)+' / '+mock.deck.length+'</small>'+(item.context?'<p class="mock-reading-text">'+esc(item.context)+'</p>':'')+'<h3>'+esc(item.q)+'</h3>'+(item.speechText?'<button class="btn" id="mockListen">🔊 '+esc(tr('Play audio','Прослушать'))+'</button>':'')+'<div class="mock-options">'+item.opts.map(function(option,index){return '<button data-mock-option="'+index+'">'+esc(option)+'</button>';}).join('')+'</div></div>';
      if(item.speechText)$('#mockListen').onclick=function(){var u=new SpeechSynthesisUtterance(item.speechText);u.lang=SPEECH_LOCALE[studyState.lang]||'de-DE';speechSynthesis.cancel();speechSynthesis.speak(u);};
      Array.prototype.forEach.call(host.querySelectorAll('[data-mock-option]'),function(button){button.onclick=function(){if(Number(button.getAttribute('data-mock-option'))===item.a)mock.correct++;mock.question++;renderMockQuestion(nav,header);};});
    }
    async function completeMockSection() {
      var mock=studyState.mock;if(!mock||mock.completing)return;mock.completing=true;
      if(studyState.examTimerId){clearInterval(studyState.examTimerId);studyState.examTimerId=null;}
      var section=mock.sections[mock.index],host=$('#studyToolBody');
      if(section.id==='writing'||section.id==='speaking'){
        var text=mock.answers[section.id]||'',writingTask=strictBank(WRITING,studyState.lang,studyState.level)[0],prompt=section.id==='writing'&&writingTask?writingTask.prompt:tr('Explain your learning goals and why they matter.','Объясните свои учебные цели и почему они важны.');
        host.innerHTML='<div class="ai-checking exam-ai-checking"><i></i><span>'+esc(tr('AI examiner is scoring this section…','AI-экзаменатор оценивает секцию…'))+'</span></div>';
        try{var evaluation=await requestAiEvaluation(section.id,{text:text,transcript:text,prompt:prompt,expected:prompt});mock.evaluations[section.id]=evaluation;mock.scores[section.id]=Number(evaluation.overall||0);}catch(error){mock.scores[section.id]=0;mock.evaluations[section.id]={summary:error.message,nextStep:tr('Repeat this section when AI evaluation is available.','Повторите секцию, когда AI-проверка будет доступна.')};}
      } else mock.scores[section.id]=Math.round((mock.correct||0)/Math.max(1,(mock.deck||[]).length)*100);
      mock.index++;mock.completing=false;renderMockSection();
    }
    function finishFullMock() {
      var mock=studyState.mock,scores=mock.scores,keys=mock.sections.map(function(item){return item.id;}),overall=Math.round(keys.reduce(function(sum,key){return sum+Number(scores[key]||0);},0)/keys.length),passed=overall>=60,duration=Math.round((Date.now()-mock.startedAt)/1000);
      if(uid())supa.from('practice_mock_exams').insert({user_id:uid(),exam_type:(loadExamGoal().exam||'duvela-mock'),language:studyState.lang,level:(loadPrefs().levels||{})[studyState.lang]||'A1',section_scores:scores,overall:overall,passed:passed,duration_seconds:duration}).then(function(){},function(){});
      bumpProgress('exam',Math.max(10,Math.round(overall/5)));clearResume();
      $('#studyToolBody').innerHTML='<div class="mock-result '+(passed?'passed':'retry')+'"><span>'+(passed?'🏆':'🎯')+'</span><small>'+esc(tr('MOCK EXAM RESULT','РЕЗУЛЬТАТ ПРОБНОГО ЭКЗАМЕНА'))+'</small><h2>'+overall+' / 100</h2><p>'+esc(passed?tr('Pass level reached. Keep strengthening the lowest section.','Проходной уровень достигнут. Продолжайте укреплять слабейшую секцию.'):tr('Not at pass level yet — now you know exactly what to train.','До проходного уровня пока не хватает — теперь понятно, что тренировать.'))+'</p><div class="mock-score-grid">'+mock.sections.map(function(section){return '<button data-result-tool="'+section.id+'"><span>'+section.icon+'</span><b>'+esc(section.title)+'</b><strong>'+Number(scores[section.id]||0)+'%</strong></button>';}).join('')+'</div><div class="mock-result-actions"><button class="btn" id="mockReview">'+esc(tr('Train weakest skill','Тренировать слабый навык'))+'</button><button class="btn primary" id="mockAgain">'+esc(tr('Take another mock','Пройти ещё раз'))+'</button></div></div>';
      $('#mockAgain').onclick=startFullMock;$('#mockReview').onclick=function(){var weakest=keys.sort(function(a,b){return Number(scores[a]||0)-Number(scores[b]||0);})[0];openStudyTool(weakest==='grammar'?'grammar':weakest);};
      Array.prototype.forEach.call(document.querySelectorAll('[data-result-tool]'),function(button){button.onclick=function(){var tool=button.getAttribute('data-result-tool');openStudyTool(tool==='grammar'?'grammar':tool);};});
    }
    function renderExam() {
      // Exam Mode shows only the exams we have (telc A1–B2). No progress hub,
      // no generic skill modules — just the four model tests.
      if (!studyState.examType) {
        $('#studyToolBody').innerHTML = '<div class="exam-hub-head"><span>⏱</span><div><small>PRÜFUNG</small><h2>' + esc(tr('Choose an exam','Выберите экзамен')) + '</h2><p>telc Deutsch · A1 · A2 · B1 · B2</p></div></div>'+[['A1','telc-exam.html','Start Deutsch 1'],['A2','telc-a2-exam.html','Start Deutsch 2'],['B1','telc-b1-exam.html','Zertifikat Deutsch B1'],['B2','telc-b2-exam.html','telc Deutsch B2']].map(function(item){return '<button data-telc-launch="'+item[1]+'" style="width:100%;text-align:left;margin:0 0 10px;padding:14px 16px;border:0;border-radius:16px;background:linear-gradient(135deg,#7138ed,#a536ef);color:#fff;cursor:pointer"><span style="font-size:11px;letter-spacing:.5px;opacity:.85;font-weight:800">ECHTE PRÜFUNG · '+item[0]+'</span><br><b style="font-size:16px">telc Deutsch '+item[0]+' – Modelltest</b><br><small style="opacity:.85">'+item[2]+' · Hören · Lesen · Schreiben · Sprechen →</small></button>';}).join('');
        Array.prototype.forEach.call(document.querySelectorAll('[data-telc-launch]'),function(button){button.onclick=function(){location.href='./'+button.getAttribute('data-telc-launch');};});
        return;
      }
      if (!studyState.data) {
        if (studyState.examType === 'reading') { var passage=exactReadingTasks(studyState.lang,studyState.level)[0];if(!passage)return noLevelContent();studyState.data=passage.questions.map(function(q){return {q:q.prompt,opts:q.options,a:q.options.indexOf(q.answer),evidence:q.evidence};}); }
        else if (studyState.examType === 'listening') { studyState.data=(LISTEN[studyState.lang]||LISTEN.de).slice(0,6).map(function (item) { return { q:tr('Listen and choose the correct sentence','Прослушайте и выберите правильное предложение'),speechText:item.text,opts:shuffle([item.text,item.text.split(' ').reverse().join(' '),item.hint,'—']),answerText:item.text }; }).map(function (item) { item.a=item.opts.indexOf(item.answerText);return item; }); }
        else studyState.data=buildExamDeck(studyState.lang,studyState.level);
        if(!studyState.data.length)return noLevelContent();
        studyState.examEndAt = Date.now() + 90000;
        studyState.examTimerId = setInterval(examTick, 500);
      }
      examStep();
    }
    function examTick() {
      var el = $('#examTimer');
      if (!el || !studyState) return;
      var left = Math.max(0, Math.round((studyState.examEndAt - Date.now()) / 1000));
      el.textContent = (left / 60 | 0) + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) {
        clearInterval(studyState.examTimerId);
        studyState.examTimerId = null;
        studyState.idx = studyState.data.length;
        examStep();
      }
    }
    function examStep() {
      var deck = studyState.data;
      var host = $('#studyToolBody');
      if (studyState.idx >= deck.length) {
        if (studyState.examTimerId) { clearInterval(studyState.examTimerId); studyState.examTimerId = null; }
        return finishTool(studyState.score + ' / ' + deck.length, studyState.score * 3);
      }
      var item = deck[studyState.idx];
      var left = Math.max(0, Math.round((studyState.examEndAt - Date.now()) / 1000));
      host.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px">' +
          '<span style="color:var(--soft);font-weight:800;font-size:12px">' + (studyState.idx + 1) + ' / ' + deck.length + '</span>' +
          '<span id="examTimer" style="font-weight:900;color:var(--teal)">' + (left / 60 | 0) + ':' + String(left % 60).padStart(2, '0') + '</span>' +
        '</div>' +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(item.q) + '</div>' +
        (item.speechText ? '<button class="btn primary" id="examListen" style="width:100%;margin-bottom:12px">🔊 ' + esc(tr('Play audio','Прослушать')) + '</button>' : '') +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-eopt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>';
      if (item.speechText) $('#examListen').onclick = function () { var utterance=new SpeechSynthesisUtterance(item.speechText);utterance.lang=SPEECH_LOCALE[studyState.lang]||'de-DE';speechSynthesis.cancel();speechSynthesis.speak(utterance); };
      Array.prototype.forEach.call(host.querySelectorAll('[data-eopt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-eopt'));
          if (chosen === item.a) studyState.score++;
          else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq');
          studyState.idx++;
          examStep();
        });
      });
    }

    function renderSentenceBuilder() {
      var bank = studyState.lang === 'de' ? ['Ich lerne heute Deutsch','Wir trinken Kaffee zusammen','Wo wohnst du jetzt'] : studyState.lang === 'es' ? ['Yo estudio español hoy','Nosotros bebemos café juntos','Dónde vives ahora'] : ['I study English today','We drink coffee together','Where do you live now'];
      if (!studyState.data) studyState.data = shuffle(bank).map(function(sentence){return {sentence:sentence,words:shuffle(sentence.split(' '))};});
      var deck=studyState.data;if(studyState.idx>=deck.length)return finishTool(studyState.score+' / '+deck.length,12);var item=deck[studyState.idx],chosen=[];studyState.total=deck.length;
      $('#studyToolBody').innerHTML=counterHtml(studyState.idx,deck.length)+'<div class="sentence-drop" id="sentenceDrop"><span>'+esc(tr('Tap words in the correct order','Нажимайте слова в правильном порядке'))+'</span></div><div class="sentence-bank">'+item.words.map(function(word,i){return '<button data-word="'+i+'">'+esc(word)+'</button>';}).join('')+'</div><button class="btn primary" id="sentenceCheck" disabled>'+esc(tr('Check sentence','Проверить предложение'))+'</button>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-word]'),function(button){button.onclick=function(){chosen.push(button.textContent);button.disabled=true;$('#sentenceDrop').innerHTML=chosen.map(function(word){return '<b>'+esc(word)+'</b>';}).join(' ');$('#sentenceCheck').disabled=chosen.length!==item.words.length;};});
      $('#sentenceCheck').onclick=function(){var ok=chosen.join(' ')===item.sentence;feedback(ok,{prompt:tr('Build the sentence','Соберите предложение'),chosen:chosen.join(' '),correct:item.sentence,explanation:tr('Word order keeps the subject, verb and the remaining information in a natural sequence.','Порядок слов сохраняет естественную последовательность: подлежащее, глагол и остальная информация.')});if(ok)studyState.score++;else logMistake(studyState.lang,item.sentence,item.words,0,'sentence');this.disabled=true;$('#sentenceDrop').insertAdjacentHTML('afterend','<div class="inline-answer '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('Perfect order','Правильный порядок'):tr('Correct sentence','Правильное предложение'))+'</b><p>'+esc(item.sentence)+'</p><button class="btn primary" id="sentenceContinue">'+esc(tr('Continue','Продолжить'))+' →</button></div>');$('#sentenceContinue').onclick=function(){studyState.idx++;renderSentenceBuilder();};};
    }

    function renderCategories() {
      var groups={Food:['coffee','bread','apple'],People:['teacher','friend','student'],Places:['school','station','cafe']};
      if (!studyState.data) studyState.data=shuffle(Object.keys(groups).reduce(function(all,key){return all.concat(groups[key].map(function(word){return {word:word,group:key};}));},[]));
      var deck=studyState.data;if(studyState.idx>=deck.length)return finishTool(studyState.score+' / '+deck.length,18);var item=deck[studyState.idx];studyState.total=deck.length;
      $('#studyToolBody').innerHTML=counterHtml(studyState.idx,deck.length)+'<div class="category-word">'+esc(item.word)+'</div><p class="category-instruction">'+esc(tr('Choose its category','Выберите категорию'))+'</p><div class="category-zones">'+Object.keys(groups).map(function(group){return '<button data-category="'+group+'"><span>'+(group==='Food'?'🍎':group==='People'?'👤':'📍')+'</span><b>'+esc(group)+'</b></button>';}).join('')+'</div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-category]'),function(button){button.onclick=function(){var chosen=button.getAttribute('data-category'),ok=chosen===item.group;feedback(ok,{prompt:item.word,chosen:chosen,correct:item.group,explanation:tr('This word belongs to the shown meaning group.','Это слово относится к указанной смысловой группе.')});if(ok)studyState.score++;Array.prototype.forEach.call(document.querySelectorAll('[data-category]'),function(node){node.disabled=true;});document.querySelector('.category-zones').insertAdjacentHTML('afterend','<div class="inline-answer '+(ok?'ok':'bad')+'"><b>'+esc(item.word+' → '+item.group)+'</b><button class="btn primary" id="categoryContinue">'+esc(tr('Continue','Продолжить'))+' →</button></div>');$('#categoryContinue').onclick=function(){studyState.idx++;renderCategories();};};});
    }

    function renderScenarios() {
      var scenes=[{icon:'☕',place:tr('At the cafe','В кафе'),line:tr('The waiter asks what you would like.','Официант спрашивает, что вы хотите.'),opts:[tr('I would like a coffee, please.','Я хотел бы кофе, пожалуйста.'),tr('The station is blue.','Вокзал синий.'),tr('Yesterday tomorrow.','Вчера завтра.')],a:0},{icon:'✈️',place:tr('At the airport','В аэропорту'),line:tr('You need to find your gate. What do you ask?','Вам нужно найти выход. Что вы спросите?'),opts:[tr('Where is gate twelve?','Где выход двенадцать?'),tr('I eat a ticket.','Я ем билет.'),tr('Close the coffee.','Закройте кофе.')],a:0},{icon:'💼',place:tr('At work','На работе'),line:tr('Introduce yourself to a new colleague.','Представьтесь новому коллеге.'),opts:[tr('Hello, my name is… Nice to meet you.','Здравствуйте, меня зовут… Приятно познакомиться.'),tr('Give me the airport.','Дайте мне аэропорт.'),tr('No sentence.','Нет предложения.')],a:0}];
      if(!studyState.data)studyState.data=scenes;var deck=studyState.data;if(studyState.idx>=deck.length)return finishTool(studyState.score+' / '+deck.length,15);var scene=deck[studyState.idx];studyState.total=deck.length;
      $('#studyToolBody').innerHTML='<div class="scenario-scene"><span>'+scene.icon+'</span><small>'+esc(tr('ROLE PLAY','РОЛЕВАЯ ИГРА'))+'</small><h2>'+esc(scene.place)+'</h2><p>'+esc(scene.line)+'</p></div><div class="scenario-options">'+scene.opts.map(function(option,i){return '<button data-scene-answer="'+i+'">'+esc(option)+'</button>';}).join('')+'</div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-scene-answer]'),function(button){button.onclick=function(){var chosen=Number(button.getAttribute('data-scene-answer')),ok=chosen===scene.a;feedback(ok,{prompt:scene.line,chosen:scene.opts[chosen],correct:scene.opts[scene.a],explanation:tr('This response is polite, meaningful and appropriate for the situation.','Этот ответ вежливый, понятный и подходит к ситуации.')});if(ok)studyState.score++;Array.prototype.forEach.call(document.querySelectorAll('[data-scene-answer]'),function(node){node.disabled=true;});document.querySelector('.scenario-options').insertAdjacentHTML('afterend','<div class="inline-answer '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('The conversation continues','Разговор продолжается'):tr('A better response','Лучший ответ'))+'</b><p>'+esc(scene.opts[scene.a])+'</p><button class="btn primary" id="scenarioContinue">'+esc(tr('Continue story','Продолжить историю'))+' →</button></div>');$('#scenarioContinue').onclick=function(){studyState.idx++;renderScenarios();};};});
    }

    async function renderSocialChallenge(mode) {
      var host=$('#studyToolBody'),team=mode==='team';
      if(!team){
        var overlayTitle = $('#studyOverlayTitle');
        if (overlayTitle) overlayTitle.textContent = tr('DUVELA LIVE Duel — Game Setup', 'DUVELA LIVE Duel — Настройка игры');
        var kit = duelTeacherKit(), selectedTopic = studyState.duelTopic || kit.topic || 'all', selectedMode = studyState.duelMode || kit.mode || 'students';
        studyState.duelTopic = selectedTopic;studyState.duelMode = selectedMode;
        studyState.duelLevels = normalizeDuelLevels(studyState.duelLevels || kit.levels || kit.level || studyState.level, studyState.level);
        studyState.duelQuestionCount = studyState.duelQuestionCount || kit.questions || 10;
        studyState.duelQuestionSeconds = studyState.duelQuestionSeconds || kit.seconds || 15;
        studyState.duelSource = studyState.duelSource || kit.source || 'bank';
        studyState.duelPracticeId = studyState.duelPracticeId || kit.practiceId || '';
        studyState.duelAutopilot = studyState.duelAutopilot != null ? !!studyState.duelAutopilot : !!kit.autopilot;
        // Quick-Start: the landing button set window.__duvelaDuelQuickStart.
        // If the teacher has run at least one previous duel (kit.lastDay set)
        // we skip the settings panel entirely and jump straight into
        // startLiveDuel with the saved preset. From landing tap to Q1 is <2s.
        if (window.__duvelaDuelQuickStart && kit.lastDay) {
          window.__duvelaDuelQuickStart = false;
          host.innerHTML = '<div class="duel-quickstart-splash"><span>⚡</span><b>' + esc(tr('Starting your last preset…','Запускаем последний пресет…')) + '</b><small>' + esc(duelModeLabel(selectedMode) + ' · ' + duelTopicLabel(selectedTopic) + ' · ' + duelLevelLabel() + ' · ' + duelQuestionCount() + '×' + duelQuestionSeconds() + 's') + '</small></div>';
          void startLiveDuel(null);
          return;
        }
        // Consume any dangling quick-start flag so the next visit renders the
        // lobby normally.
        window.__duvelaDuelQuickStart = false;
        var duelBankTotal = buildDuelDeck(studyState.lang, studyState.duelLevels, selectedTopic).length;
        var joinCode = studyState.duelJoinCode || '••••';
        host.innerHTML='<div class="social-challenge duel-search-card duel-teacher-lobby">'
          +'<header class="duel-lobby-hero"><div class="duel-search-orbit"><span>⚔️</span></div><div class="duel-lobby-hero-copy"><small>'+esc(tr('DUVELA LIVE ARENA','DUVELA LIVE ARENA'))+'</small><h2>'+esc(tr('Room Setup','Настройка комнаты'))+'</h2></div><div class="duel-code-chip"><strong id="duelJoinCode">'+esc(joinCode)+'</strong><button type="button" class="duel-copy-btn" data-duel-copy="code">'+esc(tr('Copy','Копировать'))+'</button></div><nav class="duel-workspace-tabs" role="tablist"><button type="button" class="active" data-duel-tab="setup" role="tab">'+esc(tr('Game Setup','Настройка игры'))+'</button><button type="button" data-duel-tab="deck" role="tab">'+esc(tr('Question Deck','Колода вопросов'))+'</button><button type="button" data-duel-tab="lobby" role="tab">'+esc(tr('Player Lobby','Лобби игроков'))+'</button></nav></header>'
          +'<div class="duel-teacher-panel"><div class="duel-panel-head"><div><small>'+esc(tr('TEACHER CONTROL','УПРАВЛЕНИЕ УЧИТЕЛЯ'))+'</small><b>'+esc(tr('Room settings','Настройки комнаты'))+'</b></div></div><div class="duel-setup-section-title">'+esc(tr('Game mode · Language and CEFR','Режим · язык и CEFR'))+'</div>'
          +'<div class="duel-control-row duel-mode-row"><span>'+esc(tr('Mode','Режим'))+'</span>'+duelModeList().map(function(item){return '<button type="button" data-duel-mode="'+esc(item[0])+'" class="'+(item[0]===selectedMode?'active':'')+'">'+esc(item[1])+'</button>';}).join('')+'</div>'
          +'<div class="duel-setup-section-title">'+esc(tr('Topic and question deck','Тема и колода вопросов'))+'</div>'
          +'<div class="duel-control-row duel-topic-groups"><span>'+esc(tr('Topic','Тема'))+'</span>'+duelTopicGroups().map(function(group){return '<button type="button" data-duel-topic-group="'+esc(group[0])+'" class="duel-topic-group-tab '+(group[0]===duelActiveTopicGroup()?'active':'')+'">'+esc(group[1])+'</button>';}).join('')+'</div>'
          +'<div class="duel-control-row duel-topic-chips" data-active-group="'+esc(duelActiveTopicGroup())+'"><span></span>'+duelTopicList().map(function(item){var g=duelTopicGroupOf(item[0]);return '<button type="button" data-duel-topic="'+esc(item[0])+'" data-topic-group="'+esc(g)+'" class="'+(item[0]===selectedTopic?'active':'')+'"'+(g===duelActiveTopicGroup()?'':' hidden')+'>'+esc(item[1])+'</button>';}).join('')+'</div>'
          +'<div class="duel-control-row duel-level-row"><span>'+esc(tr('CEFR level','Уровень CEFR'))+'</span>'+['A1','A2','B1','B2','C1','C2'].map(function(level){return '<button type="button" data-duel-level="'+level+'" class="'+(studyState.duelLevels.indexOf(level)>=0?'active':'')+'">'+level+'</button>';}).join('')+'</div>'
          +'<div class="duel-control-row duel-rules-row"><span>'+esc(tr('Questions','Вопросы'))+'</span>'+[5,10,15].map(function(count){return '<button type="button" data-duel-count="'+count+'" class="'+(count===duelQuestionCount()?'active':'')+'">'+count+'</button>';}).join('')+'</div>'
          +'<div class="duel-control-row duel-rules-row"><span>'+esc(tr('Timer','Таймер'))+'</span>'+[10,15,20].map(function(seconds){return '<button type="button" data-duel-seconds="'+seconds+'" class="'+(seconds===duelQuestionSeconds()?'active':'')+'">'+seconds+'s</button>';}).join('')+'<button type="button" data-duel-autopilot="1" class="duel-autopilot-toggle '+(studyState.duelAutopilot?'active':'')+'" title="'+esc(tr('Hands-off: auto-reveal on timeout, auto-advance after 3s. Teacher can still tap Pause / Next.','Без рук: сам показывает ответ по таймеру и переходит через 3 с. Пауза / Дальше — всегда работают.'))+'">'+esc(studyState.duelAutopilot?tr('Auto-pilot: ON','Автопилот: ВКЛ'):tr('Auto-pilot','Автопилот'))+'</button></div>'
          +'<div class="duel-control-row duel-source-row"><span>'+esc(tr('Question source','Источник вопросов'))+'</span>'+[['bank',tr('Question Bank','Банк вопросов')],['mine',tr('My Deck','Моя колода')],['ai',tr('AI','AI')]].map(function(item){return '<button type="button" data-duel-source="'+item[0]+'" class="'+(item[0]===duelSource()?'active':'')+'">'+esc(item[1])+'</button>';}).join('')+'</div>'
          +'<div class="duel-control-row" id="duelPackRow"'+(duelSource()==='mine'?'':' hidden')+'><span>'+esc(tr('Pack','Набор'))+'</span><select id="duelPackSelect" class="duel-pack-select"><option value="">'+esc(tr('Loading packs…','Загрузка наборов…'))+'</option></select></div><div class="duel-scoring-note">'+esc(tr('Scoring is verified by the room server after each answer.','Очки подтверждаются сервером комнаты после каждого ответа.'))+'</div></div>'
          +'<div class="duel-deck-toolbar"><b>'+esc(tr('Question Deck','Колода вопросов'))+'</b><div class="duel-deck-actions"><button type="button" class="duel-copy-btn" data-duel-generate="1">'+esc(tr('Generate questions','Сгенерировать вопросы'))+'</button><button type="button" class="duel-copy-btn" data-duel-preview>'+esc(tr('Preview and edit','Просмотреть и изменить'))+'</button></div></div><div id="duelDeckPreview" class="duel-deck-preview" hidden></div>'
          +'<aside class="duel-lobby-side"><div class="duel-lobby-share"><img id="duelLobbyQr" alt="QR" width="88" height="88" hidden><div><div class="duel-lobby-url" id="duelLobbyUrl">'+esc(tr('Opening room…','Открываем комнату…'))+'</div><div class="duel-lobby-share-actions"><button type="button" class="duel-copy-btn" data-duel-copy="url">'+esc(tr('Copy link','Скопировать ссылку'))+'</button></div></div></div>'
          +'<div class="duel-search-stats"><span><b id="duelLobbyCount">'+esc(String(duelQuestionCount()))+'</b><small>'+esc(tr('questions','вопросов'))+'</small></span><span><b id="duelLobbyLevel">'+esc(duelLevelLabel())+'</b><small>'+esc(tr('levels','уровни'))+'</small></span><span><b id="duelLobbyBank">'+esc(duelBankTotal)+'</b><small>'+esc(tr('duel bank','банк дуэли'))+'</small></span><span><b>'+esc(String(kit.streak||0))+'</b><small>'+esc(tr('teacher streak','серия учителя'))+'</small></span></div>'
          +'<span hidden id="duelJoinCodeInline">'+esc(joinCode)+'</span><span hidden id="duelLobbyModeLabel">'+esc(duelModeLabel(selectedMode))+' · '+esc(duelTopicLabel(selectedTopic))+'</span>'
          +'<div class="duel-readiness" id="duelReadiness"><b>'+esc(tr('Launch readiness','Готовность к запуску'))+'</b><span data-readiness="room">○ '+esc(tr('Room configured','Комната настроена'))+'</span><span data-readiness="deck">○ '+esc(tr('Valid question deck','Колода вопросов готова'))+'</span><span data-readiness="players">○ '+esc(tr('Required participants connected','Участники подключены'))+'</span></div><div id="duelLobbyRoster" class="duel-lobby-roster"></div><div id="challengeMembers" class="duel-status duel-search-status">'+esc(tr('Opening the room…','Открываем комнату…'))+'</div>'
          +'<button class="btn primary" id="socialStart">'+esc(tr('Start LIVE duel','Запустить LIVE-дуэль'))+'</button></aside></div>';
        bindDuelLobbyControls(host);
        bindDuelWorkspaceTabs(host);
        void loadTeacherDuelPacks(host);
        void ensureDuelLobbyRoom();
      } else
      host.innerHTML='<div class="social-challenge"><span>'+(team?'👥':'⚔️')+'</span><small>DUVELA '+(team?'TEAM':'DUEL')+'</small><h2>'+esc(team?tr('Team challenge','Командное задание'):tr('Find an opponent','Найти соперника'))+'</h2><p>'+esc(team?tr('Complete 30 correct answers together this week.','Вместе дайте 30 правильных ответов за неделю.'):tr('First we look for a learner online. If nobody is available, you play immediately against the Duvela Bot.','Сначала ищем ученика онлайн. Если никого нет, вы сразу играете с ботом Duvela.'))+'</p><div class="social-score"><b id="myChallengeScore">0</b><span>'+(team?'TEAM':'VS')+'</span><b id="opponentScore">—</b></div><div id="challengeMembers" class="duel-status">'+esc(team?tr('Team matchmaking is ready','Командный подбор готов'):tr('Ready to search','Готово к поиску'))+'</div><button class="btn primary" id="socialStart">'+esc(team?tr('Join a team','Вступить в команду'):tr('Find opponent','Найти соперника'))+'</button></div>';
      $('#socialStart').onclick=function(){
        var button=this;
        if(team)return startLegacyTeam(button);
        button.disabled=true;
        void startLiveDuel(button);
      };
    }

    async function startLegacyTeam(button){
      button.disabled=true;button.textContent=tr('Joining…','Подключаем…');
      try{
        var prefs=loadPrefs(),level=(prefs.levels||{})[studyState.lang]||'A1';
        var waiting=await supa.from('practice_challenges').select('id,created_by,goal').eq('kind','team').eq('status','waiting').eq('language',studyState.lang).order('created_at',{ascending:true}).limit(1).maybeSingle(),challenge=waiting.data;
        if(!challenge){var created=await supa.from('practice_challenges').insert({kind:'team',created_by:uid(),language:studyState.lang,level:level,goal:30,status:'waiting'}).select().single();if(created.error)throw created.error;challenge=created.data;}
        await supa.from('practice_challenge_members').upsert({challenge_id:challenge.id,user_id:uid(),score:0,completed:0});studyState.challengeId=challenge.id;
        async function refresh(){var members=await supa.from('practice_challenge_members').select('user_id,score').eq('challenge_id',challenge.id),list=members.data||[],mine=list.find(function(row){return row.user_id===uid();});var my=$('#myChallengeScore'),all=$('#opponentScore'),label=$('#challengeMembers');if(my)my.textContent=Number(mine&&mine.score||0);if(all)all.textContent=list.reduce(function(sum,row){return sum+Number(row.score||0);},0);if(label)label.textContent=list.length+' '+tr('participants online','участников онлайн');}
        await refresh();studyState.challengeChannel=supa.channel('practice-challenge-'+challenge.id).on('postgres_changes',{event:'*',schema:'public',table:'practice_challenge_members',filter:'challenge_id=eq.'+challenge.id},refresh).subscribe();button.disabled=false;button.textContent=tr('Start team practice','Начать командную практику');button.onclick=function(){studyState.tool='grammar';studyState.data=null;studyState.idx=0;renderTool();};
      }catch(error){button.disabled=false;button.textContent=tr('Try again','Повторить');alert(error.message||tr('Team service is unavailable.','Командный сервис недоступен.'));}
    }

    function normalizeDuelLevels(value, fallback) {
      var allowed = { A1:true, A2:true, B1:true, B2:true, C1:true, C2:true };
      var raw = Array.isArray(value) ? value : String(value || '').split(/[,\s/+]+/);
      var levels = [];
      raw.forEach(function (item) {
        var level = normalizePracticeLevel(item, '');
        if (allowed[level] && levels.indexOf(level) < 0) levels.push(level);
      });
      if (!levels.length) levels.push(normalizePracticeLevel(fallback || (studyState && studyState.level) || 'A1', 'A1'));
      return levels.slice(0, 2);
    }

    function duelSelectedLevels() {
      return normalizeDuelLevels(studyState && studyState.duelLevels, studyState && studyState.level);
    }

    function duelLevelLabel() {
      return duelSelectedLevels().join(' + ');
    }

    // Classify a grammar item into one of the practice-for-LIVE categories
    // so the teacher can filter the deck to "only articles" / "only
    // prepositions" / "only cases" / "only verbs". Regex-based on the
    // options because the entry itself has no `kind`, and the shape of
    // the answers is a reliable signal (der/die/das = article,
    // dem/den/dessen after a preposition = case, etc.).
    var GERMAN_PREPS = /^(an|auf|in|bei|mit|nach|zu|zum|zur|im|am|beim|von|für|über|unter|ohne|um|aus|gegen|durch|hinter|neben|vor|zwischen|nach)$/i;
    var GERMAN_ARTICLES = /^(der|die|das|dem|den|des|ein|eine|einen|einem|einer|eines|keine?|keinen|keinem|meiner?|meinen?|meinem)$/i;
    var GERMAN_CASES = /^(der|die|das|dem|den|des|dessen|deren|denen|einer|eines|einem|einen)$/i;
    var GERMAN_VERB_ENDINGS = /^(bin|bist|ist|sind|seid|habe|hast|hat|haben|habt|komme|kommst|kommt|kommen|lerne|lernst|lernt|lernen|gehe|gehst|geht|gehen|trinke|trinkst|trinkt|trinken|esse|isst|essen|weiß|weißt|wissen|werde|werden|wurde|wurden|worden|geworden|gemacht|gearbeitet|gesehen|gelesen)$/i;
    function classifyGermanGrammar(opts) {
      if (!Array.isArray(opts) || opts.length !== 4) return 'mixed';
      var trimmed = opts.map(function (option) { return String(option || '').trim(); });
      var articleHits = trimmed.filter(function (option) { return GERMAN_ARTICLES.test(option); }).length;
      var caseHits = trimmed.filter(function (option) { return GERMAN_CASES.test(option); }).length;
      var prepHits = trimmed.filter(function (option) { return GERMAN_PREPS.test(option); }).length;
      var verbHits = trimmed.filter(function (option) { return GERMAN_VERB_ENDINGS.test(option); }).length;
      if (prepHits >= 3) return 'prep';
      if (caseHits >= 3 && !prepHits) return 'case';
      if (articleHits >= 3) return 'article';
      if (verbHits >= 3) return 'verb';
      return 'mixed';
    }

    function buildDuelDeck(lang, level, topic) {
      var levels = normalizeDuelLevels(level, studyState && studyState.level);
      var deck = [];
      levels.forEach(function (selectedLevel) {
        strictBank(GRAMMAR, lang, selectedLevel).forEach(function (item) {
          if (!item || !item.opts || item.opts.length !== 4) return;
          var kind = lang === 'de' ? classifyGermanGrammar(item.opts) : 'mixed';
          deck.push({ q:item.q, opts:item.opts, a:item.a, level:item.level, kind:kind });
        });
        strictBank(WORD_USAGE, lang, selectedLevel).forEach(function (item) {
          var answer = item && item.opts ? item.opts.indexOf(item.a) : -1;
          if (!item || !item.opts || item.opts.length !== 4 || answer < 0) return;
          var kind = lang === 'de' ? classifyGermanGrammar(item.opts) : 'mixed';
          deck.push({ q:item.s, opts:item.opts, a:answer, level:item.level, kind:kind });
        });
        if (lang === 'de') {
          exactLevelItems(ARTICLES, selectedLevel).forEach(function (item) {
            var opts = ['der', 'die', 'das', tr('no article', 'без артикля')];
            deck.push({
              q:tr('Article: ___ ' + item.noun, 'Артикль: ___ ' + item.noun),
              opts:opts,
              a:opts.indexOf(item.art),
              level:item.level,
              kind:'article'
            });
          });
          // Sentence-check drill: four full sentences, one grammatically
          // correct, three plausible traps (wrong word order, missing
          // umlaut, dropped verb second, wrong case). Runs in the same
          // MCQ shell — the prompt tells the learner what to look for.
          strictBank(SENTENCE_CHECK_DE, 'de', selectedLevel).forEach(function (item) {
            deck.push({
              q:tr('Which sentence is correct?','Какое предложение верно?'),
              opts:item.opts,
              a:item.a,
              level:item.level,
              kind:'sentence'
            });
          });
        }
        // Vocab-translation entries used to land here as "Что значит X?"
        // items, but tester screenshots showed nonsense compounds like
        // "die Familienantwort" (the enricher was generating rows the
        // learner has never heard of). Practice for LIVE now stays on
        // real grammar drills only.
      });
      var seen = {};
      deck = shuffle(deck).filter(function (item) {
        var key = item.q + '|' + item.opts.join('|');
        if (!(item.a >= 0) || item.a >= item.opts.length) return false;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      return topic ? orderDuelDeckByTopic(deck, topic) : deck;
    }

    function duelTodayKey() {
      var now = new Date();
      return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    function duelJoinCode(lang, level) {
      var seed = String(lang || 'de') + '|' + String(level || 'A1') + '|' + duelTodayKey();
      var hash = 0;
      for (var i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) >>> 0;
      return 'DUEL' + String(100 + (hash % 900));
    }

    function duelJoinUrl(code) {
      var api = duelRoomApi();
      if (api && typeof api.joinUrl === 'function' && code) return api.joinUrl(code);
      // A local origin is useful for the teacher's own browser, but it must
      // never be presented as an external invitation or encoded into a QR.
      if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return '';
      var origin = window.location.origin;
      var path = window.location.pathname || '/app.html';
      return origin + path + '?duel=' + encodeURIComponent(code || '') + '#duel';
    }

    function duelQrSrc(url) {
      if (!url) return '';
      return 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=' + encodeURIComponent(url);
    }

    function duelQuestionCount() {
      var n = Number((studyState && studyState.duelQuestionCount) || 10);
      return n === 5 || n === 15 ? n : 10;
    }

    function duelQuestionSeconds() {
      var n = Number((studyState && studyState.duelQuestionSeconds) || 15);
      return n === 10 || n === 20 ? n : 15;
    }

    function duelSource() {
      var source = studyState && studyState.duelSource;
      return source === 'mine' || source === 'ai' ? source : 'bank';
    }

    function generateTargetName(lang) {
      var map = { de:'german', en:'english', es:'spanish', fr:'french', it:'italian', ru:'russian' };
      return map[String(lang || 'de').toLowerCase()] || String(lang || 'german');
    }

    function practiceItemToDuel(item) {
      if (!item) return null;
      var opts = Array.isArray(item.options) ? item.options.map(function (opt) { return String(opt || '').trim(); }).filter(Boolean).slice(0, 4) : [];
      if (opts.length < 2) return null;
      var raw = item.answer;
      var idx = Number(raw);
      if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) {
        idx = opts.findIndex(function (opt) { return String(opt) === String(raw); });
      }
      if (idx < 0) idx = 0;
      return { q: String(item.prompt || '').trim(), opts: opts, a: idx, explanation: item.explanation || '' };
    }

    function currentDuelDeck() {
      var count = duelQuestionCount();
      var full;
      if (duelSource() === 'ai') {
        full = Array.isArray(studyState.duelGeneratedDeck) ? studyState.duelGeneratedDeck.slice() : [];
      } else if (duelSource() === 'mine') {
        full = Array.isArray(studyState.duelPracticeDeck) ? studyState.duelPracticeDeck.slice() : [];
      } else {
        var topic = studyState.duelTopic || 'all';
        full = buildDuelDeck(studyState.lang, duelSelectedLevels(), topic);
      }
      if (Array.isArray(studyState.duelEditedDeck) && studyState.duelEditedDeck.length) {
        full = studyState.duelEditedDeck.slice();
      }
      studyState.duelBankTotal = full.length;
      // Anti-repeat: prefer questions the teacher hasn't shown in the last
      // 24h. Fall back to the full deck only if we can't fill count items
      // without repeats (small bank / narrow topic). Order is preserved so
      // the topic/level ranking upstream still wins.
      var recent = recentShownSet();
      var fresh = full.filter(function (item) { return item && !recent[String(item.q || '')]; });
      var deck = fresh.length >= count ? fresh : fresh.concat(full.filter(function (item) { return item && recent[String(item.q || '')]; }));
      return deck.slice(0, count);
    }

    function duelAnsweredCount() {
      var ids = (studyState && studyState.duelAnsweredIds) || {};
      return Object.keys(ids).length;
    }

    function updateDuelAnsweredMeta() {
      var node = $('#duelAnsweredMeta');
      if (!node || !studyState) return;
      var answered = duelAnsweredCount();
      var total = ((studyState.duelRoomPlayers) || []).length;
      var pollTotal = (studyState.duelPoll || []).reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      if (!answered) answered = pollTotal;
      node.innerHTML = '<b>' + answered + ' / ' + total + '</b> ' + esc(tr('answered','ответили'));
    }

    function duelSecondsLeft() {
      if (!studyState) return duelQuestionSeconds();
      var limit = duelQuestionSeconds();
      if (studyState.duelPaused && studyState.duelFrozenLeft != null) return Math.max(0, Math.ceil(studyState.duelFrozenLeft));
      var started = studyState.duelQuestionStartedAt ? new Date(studyState.duelQuestionStartedAt).getTime() : 0;
      if (!started) return limit;
      return Math.max(0, Math.ceil(limit - (Date.now() - started) / 1000));
    }

    function stopDuelClock() {
      if (studyState && studyState.duelClockId) {
        clearInterval(studyState.duelClockId);
        studyState.duelClockId = null;
      }
    }

    function tickDuelClock() {
      if (!studyState || studyState.tool !== 'duelmatch' || studyState.finished) {
        stopDuelClock();
        return;
      }
      var left = duelSecondsLeft();
      var node = $('#duelQuestionTimer');
      if (node) {
        node.textContent = String(left);
        node.classList.toggle('urgent', left <= 5 && !studyState.duelRevealed);
        node.classList.toggle('done', !!studyState.duelRevealed || left <= 0);
      }
      if (!studyState.duelPaused && !studyState.duelRevealed && left <= 0) {
        void teacherReveal();
      }
    }

    function startDuelClock() {
      stopDuelClock();
      tickDuelClock();
      if (!studyState) return;
      studyState.duelClockId = setInterval(tickDuelClock, 200);
    }

    function applyTally(result) {
      if (!studyState) return;
      if (Array.isArray(result)) {
        studyState.duelPoll = result;
        return;
      }
      studyState.duelPoll = (result && result.counts) || [0, 0, 0, 0];
      studyState.duelAnsweredIds = (result && result.answeredIds) || {};
    }

    function playerDuelXp(player, rank) {
      var correct = Number(player && player.correct_count || 0);
      var xp = 8 + correct * 2;
      if (rank === 0) xp += 20;
      else if (rank === 1) xp += 12;
      else if (rank === 2) xp += 6;
      return xp;
    }

    function applyDuelCodeToLobby(code) {
      if (!code || !studyState) return;
      studyState.duelJoinCode = code;
      var url = duelJoinUrl(code);
      var codeNode = $('#duelJoinCode');
      var inline = $('#duelJoinCodeInline');
      var urlNode = $('#duelLobbyUrl');
      var qr = $('#duelLobbyQr');
      var copyLink = document.querySelector('[data-duel-copy="url"]');
      if (codeNode) codeNode.textContent = code;
      if (inline) inline.textContent = code;
      if (urlNode) {
        urlNode.textContent = url
          ? url.replace(/^https?:\/\//, '')
          : tr('External invitation unavailable — configure a public HTTPS URL.', 'Внешнее приглашение недоступно — укажите публичный HTTPS-адрес.');
        urlNode.classList.toggle('is-unavailable', !url);
      }
      if (qr) {
        qr.src = duelQrSrc(url);
        qr.hidden = !url;
        qr.alt = url ? 'QR invitation' : '';
      }
      if (copyLink) {
        copyLink.disabled = !url;
        copyLink.title = url ? '' : tr('Configure a public HTTPS URL first.', 'Сначала укажите публичный HTTPS-адрес.');
      }
    }

    function copyDuelValue(kind, button) {
      var code = studyState && studyState.duelJoinCode;
      if (!code) return;
      var value = kind === 'url' ? duelJoinUrl(code) : code;
      if (kind === 'url' && !value) {
        if (button) button.textContent = tr('HTTPS URL required', 'Нужен HTTPS-адрес');
        return;
      }
      var done = function () {
        if (!button) return;
        var previous = button.textContent;
        button.textContent = tr('Copied','Скопировано');
        setTimeout(function () { if (button) button.textContent = previous; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(function () {
          window.prompt(tr('Copy this','Скопируйте'), value);
        });
      } else {
        window.prompt(tr('Copy this','Скопируйте'), value);
      }
    }

    function queueDuelRoom(task) {
      if (!studyState) return Promise.resolve();
      studyState.duelRoomQueue = (studyState.duelRoomQueue || Promise.resolve()).then(task).catch(function (error) {
        console.warn('Duel room update failed.', error);
        var status = $('#challengeMembers');
        if (status) status.textContent = (error && error.message) || tr('Could not open the room. Sign in to host.','Не удалось открыть комнату. Войдите, чтобы вести эфир.');
      });
      return studyState.duelRoomQueue;
    }

    function lobbySettingsPatch() {
      var deck = currentDuelDeck();
      return {
        deck: deck,
        target: studyState.lang || 'de',
        level: duelLevelLabel(),
        topic: studyState.duelTopic || 'all',
        mode: studyState.duelMode || 'teacher',
        total_questions: deck.length,
        question_seconds: duelQuestionSeconds()
      };
    }

    function attachDuelRoom(room) {
      if (!studyState || !room) return;
      var api = duelRoomApi();
      studyState.duelRoomId = room.id;
      applyDuelCodeToLobby(room.join_code);
      if (studyState.duelRoomChannel && api) api.unsubscribe(studyState.duelRoomChannel);
      studyState.duelRoomChannel = api ? api.subscribe(room.id, {
        onVote: function (vote) {
          if (!studyState || studyState.duelRoomId !== room.id) return;
          if (Number(vote.question_index) !== studyState.idx) return;
          if (!studyState.duelPoll) studyState.duelPoll = [0, 0, 0, 0];
          var option = Number(vote.option_index);
          if (option >= 0 && option < 4) studyState.duelPoll[option] += 1;
          if (vote.player_id) {
            studyState.duelAnsweredIds = studyState.duelAnsweredIds || {};
            studyState.duelAnsweredIds[vote.player_id] = true;
          }
          updateDuelPoll();
          updateDuelAnsweredMeta();
          renderDuelRoster();
        },
        onPlayer: function () {
          if (!studyState || studyState.duelRoomId !== room.id) return;
          void refreshDuelRoomPlayers();
        }
      }) : null;
    }

    async function ensureDuelLobbyRoom() {
      if (!studyState) return null;
      var api = duelRoomApi();
      if (!api || !uid()) {
        var status = $('#challengeMembers');
        if (status) status.textContent = tr('Sign in to get a live join code.','Войдите, чтобы получить живой код.');
        return null;
      }
      return queueDuelRoom(async function () {
        if (!studyState) return null;
        var options = lobbySettingsPatch();
        var room = await api.ensureLobbyRoom(options);
        attachDuelRoom(room);
        var latest = lobbySettingsPatch();
        if (latest.topic !== options.topic || latest.level !== options.level || latest.mode !== options.mode || latest.target !== options.target) {
          room = await api.setRoomState(room.id, {
            deck: latest.deck,
            total_questions: latest.total_questions,
            level: latest.level,
            topic: latest.topic,
            duel_mode: latest.mode,
            target: latest.target
          }) || room;
        }
        await refreshDuelRoomPlayers();
        void startDuelChatIngest();
        return room;
      });
    }

    function stopDuelChatIngest() {
      var api = duelRoomApi();
      if (studyState && studyState.duelChatChannel && api) {
        api.unsubscribe(studyState.duelChatChannel);
        studyState.duelChatChannel = null;
      }
    }

    async function startDuelChatIngest() {
      var api = duelRoomApi();
      if (!api || !studyState || !studyState.duelRoomId) return;
      stopDuelChatIngest();
      var seen = {};
      try {
        var live = await api.findActiveLiveSession();
        if (live && live.id) {
          await api.setRoomState(studyState.duelRoomId, { session_id: live.id });
          studyState.duelChatChannel = api.subscribeLiveChat(live.id, function (msg) {
            if (!studyState || !studyState.duelRoomId) return;
            var option = api.parseChatVote(msg && msg.message);
            if (option < 0) return;
            var key = String(msg.sender_id || msg.sender_name || '') + ':' + studyState.idx;
            if (seen[key]) return;
            seen[key] = true;
            void api.ingestChatVote(studyState.duelRoomId, {
              userId: msg.sender_id || null,
              displayName: msg.sender_name || 'Chat',
              optionIndex: option
            });
          });
        }
      } catch (error) { /* chat ingest is optional when no LIVE session */ }
    }

    function duelStartRequirements() {
      var deck = currentDuelDeck();
      var validDeck = Array.isArray(deck) && deck.length >= duelQuestionCount() && deck.every(function (item) {
        return item && String(item.q || '').trim() && Array.isArray(item.opts) && item.opts.length === 4
          && Number.isInteger(Number(item.a)) && Number(item.a) >= 0 && Number(item.a) < 4;
      });
      var roomReady = !!(uid() && studyState && studyState.duelRoomId);
      var players = (studyState.duelRoomPlayers || []).filter(function (player) { return player && player.origin !== 'chat'; });
      var playersReady = studyState.duelMode !== 'teacher' || players.length >= 1;
      var reviewReady = duelSource() !== 'ai' || studyState.duelAiReviewed === true;
      var reason = !roomReady ? tr('Opening the room…', 'Открываем комнату…')
        : !validDeck ? tr('Select or generate a valid question deck.', 'Выберите или создайте корректную колоду.')
        : !reviewReady ? tr('Review the AI deck before starting.', 'Проверьте AI-колоду перед запуском.')
        : !playersReady ? tr('Waiting for at least one student.', 'Нужен хотя бы один ученик.')
        : tr('Ready to start.', 'Можно начинать.');
      return { ok: roomReady && validDeck && reviewReady && playersReady, reason: reason, room: roomReady, deck: validDeck, review: reviewReady, players: playersReady };
    }

    function updateDuelReadiness(result) {
      var root = document.getElementById('duelReadiness');
      if (!root || !result) return;
      [['room', result.room], ['deck', result.deck && result.review], ['players', result.players]].forEach(function (entry) {
        var node = root.querySelector('[data-readiness="' + entry[0] + '"]');
        if (!node) return;
        node.classList.toggle('ready', !!entry[1]);
        var label = node.textContent.replace(/^[✓○]\s*/, '');
        if (entry[0] === 'players') {
          label = studyState.duelMode === 'teacher'
            ? tr('Required participants connected', 'Участники подключены')
            : tr('Participants not required for Bot mode', 'Для режима с ботом участники не нужны');
        }
        node.textContent = (entry[1] ? '✓ ' : '○ ') + label;
      });
    }

    function updateDuelStartButton() {
      var button = document.getElementById('socialStart');
      if (!button || !studyState || studyState.tool !== 'duel') return;
      var result = duelStartRequirements();
      button.disabled = !result.ok;
      button.title = result.ok ? '' : result.reason;
      updateDuelReadiness(result);
      var status = document.getElementById('challengeMembers');
      if (status) {
        status.textContent = studyState.duelMode === 'teacher'
          ? (result.ok ? tr('Waiting for students to join with the code…', 'Ждём учеников по коду…') : result.reason)
          : (result.ok ? tr('Room is ready to start.', 'Комната готова к запуску.') : result.reason);
      }
    }

    function renderDuelDeckPreview(host, toggle) {
      var preview = host && host.querySelector('#duelDeckPreview');
      if (!preview) return;
      if (!Array.isArray(studyState.duelEditedDeck)) { try { var stored = JSON.parse(localStorage.getItem('duvela.duel.editedDeck') || 'null'); if (stored && stored.lang === studyState.lang && stored.topic === studyState.duelTopic && Array.isArray(stored.deck)) studyState.duelEditedDeck = stored.deck; } catch (e) {} }
      var deck = currentDuelDeck();
      if (toggle) preview.hidden = !preview.hidden;
      if (preview.hidden) return;
      var validCount = deck.filter(function (item) { return item && String(item.q || '').trim() && Array.isArray(item.opts) && item.opts.length >= 2 && item.opts.every(function (option) { return String(option || '').trim(); }) && Number.isInteger(Number(item.a)) && Number(item.a) >= 0 && Number(item.a) < item.opts.length; }).length;
      var required = duelQuestionCount();
      preview.innerHTML = '<div class="duel-preview-head"><div><b>' + esc(tr('Question deck preview', 'Предпросмотр колоды')) + '</b><small class="duel-preview-validation ' + (validCount >= required ? 'ready' : '') + '">' + esc(validCount + '/' + required + ' ' + tr('valid questions', 'валидных вопросов')) + '</small></div><div class="duel-preview-head-actions"><button type="button" class="duel-copy-btn" data-duel-add>' + esc(tr('Add question', 'Добавить вопрос')) + '</button><button type="button" class="duel-copy-btn" data-duel-save>' + esc(tr('Save deck', 'Сохранить колоду')) + '</button>' + (duelSource() === 'ai' ? '<button type="button" class="duel-copy-btn" data-duel-confirm>' + esc(studyState.duelAiReviewed ? tr('Reviewed', 'Проверено') : tr('Confirm deck', 'Подтвердить колоду')) + '</button>' : '') + '</div></div>' +
        '<ol class="duel-preview-list">' + deck.map(function (item, index) {
          return '<li><div class="duel-preview-question"><span>' + (index + 1) + '</span><textarea data-duel-edit-q="' + index + '" rows="2">' + esc(item.q || '') + '</textarea><button type="button" class="duel-preview-delete" data-duel-delete="' + index + '" aria-label="' + esc(tr('Delete question', 'Удалить вопрос')) + '">×</button></div>' +
            '<div class="duel-preview-options">' + (item.opts || []).map(function (option, optionIndex) {
              return '<label class="' + (optionIndex === Number(item.a) ? 'correct' : '') + '"><input type="radio" name="duel-preview-' + index + '" data-duel-edit-a="' + index + '" value="' + optionIndex + '" ' + (optionIndex === Number(item.a) ? 'checked' : '') + '><input class="duel-preview-option" data-duel-edit-opt="' + index + '" data-option-index="' + optionIndex + '" value="' + esc(option) + '"></label>';
            }).join('') + '</div><label class="duel-preview-explanation">' + esc(tr('Explanation', 'Объяснение')) + '<input data-duel-edit-explanation="' + index + '" value="' + esc(item.explanation || '') + '"></label><small class="duel-preview-meta">' + esc((item.level || duelLevelLabel()) + ' · ' + tr('Correct answer is highlighted', 'Правильный ответ отмечен')) + '</small></li>';
        }).join('') + '</ol>';
      var add = preview.querySelector('[data-duel-add]');
      if (add) add.onclick = function () { var next = currentDuelDeck().map(function (item) { return Object.assign({}, item, { opts: (item.opts || []).slice() }); }); next.push({ q: '', opts: ['', '', '', ''], a: 0, explanation: '', level: duelLevelLabel(), lang: studyState.lang }); studyState.duelEditedDeck = next; renderDuelDeckPreview(host, false); updateDuelStartButton(); };
      var save = preview.querySelector('[data-duel-save]');
      if (save) save.onclick = function () { try { localStorage.setItem('duvela.duel.editedDeck', JSON.stringify({ lang: studyState.lang, level: duelLevelLabel(), topic: studyState.duelTopic, deck: currentDuelDeck() })); save.textContent = tr('Saved', 'Сохранено'); } catch (e) {} };
      Array.prototype.forEach.call(preview.querySelectorAll('[data-duel-delete]'), function (button) { button.onclick = function () { var index = Number(button.getAttribute('data-duel-delete')); var next = currentDuelDeck().filter(function (_, i) { return i !== index; }); studyState.duelEditedDeck = next; renderDuelDeckPreview(host, false); updateDuelStartButton(); }; });
      Array.prototype.forEach.call(preview.querySelectorAll('[data-duel-edit-q]'), function (input) {
        input.onchange = function () {
          var index = Number(input.getAttribute('data-duel-edit-q'));
          var next = currentDuelDeck().map(function (item) { return Object.assign({}, item, { opts: (item.opts || []).slice() }); });
          if (next[index]) { next[index].q = input.value.trim(); studyState.duelEditedDeck = next; updateDuelStartButton(); }
        };
      });
      var confirm = preview.querySelector('[data-duel-confirm]');
      if (confirm) confirm.onclick = function () { studyState.duelAiReviewed = true; confirm.textContent = tr('Reviewed', 'Проверено'); updateDuelStartButton(); };
      Array.prototype.forEach.call(preview.querySelectorAll('[data-duel-edit-a]'), function (input) {
        input.onchange = function () {
          var index = Number(input.getAttribute('data-duel-edit-a'));
          var next = currentDuelDeck().map(function (item) { return Object.assign({}, item, { opts: (item.opts || []).slice() }); });
          if (next[index]) { next[index].a = Number(input.value); studyState.duelEditedDeck = next; updateDuelStartButton(); renderDuelDeckPreview(host, false); }
        };
      });
      Array.prototype.forEach.call(preview.querySelectorAll('[data-duel-edit-opt]'), function (input) {
        input.onchange = function () {
          var index = Number(input.getAttribute('data-duel-edit-opt'));
          var optionIndex = Number(input.getAttribute('data-option-index'));
          var next = currentDuelDeck().map(function (item) { return Object.assign({}, item, { opts: (item.opts || []).slice() }); });
          if (next[index] && next[index].opts[optionIndex] != null) { next[index].opts[optionIndex] = input.value.trim(); studyState.duelEditedDeck = next; updateDuelStartButton(); }
        };
      });
      Array.prototype.forEach.call(preview.querySelectorAll('[data-duel-edit-explanation]'), function (input) {
        input.onchange = function () {
          var index = Number(input.getAttribute('data-duel-edit-explanation'));
          var next = currentDuelDeck().map(function (item) { return Object.assign({}, item, { opts: (item.opts || []).slice() }); });
          if (next[index]) { next[index].explanation = input.value.trim(); studyState.duelEditedDeck = next; }
        };
      });
    }

    async function startLiveDuel(button) {
      if (!studyState) return;
      var readiness = duelStartRequirements();
      if (!readiness.ok) {
        updateDuelStartButton();
        return;
      }
      var kit = duelTeacherKit();
      kit.topic = studyState.duelTopic || kit.topic || 'all';
      kit.mode = studyState.duelMode || kit.mode || 'students';
      studyState.duelLevels = normalizeDuelLevels(studyState.duelLevels || kit.levels || studyState.level, studyState.level);
      kit.questions = duelQuestionCount();
      kit.seconds = duelQuestionSeconds();
      kit.source = duelSource();
      kit.levels = duelSelectedLevels();
      kit.autopilot = !!studyState.duelAutopilot;
      saveDuelTeacherKit(kit);
      var deck = currentDuelDeck();
      // Persist the qids so the next LIVE the same day doesn't repeat them.
      rememberShownQuestions(deck);
      studyState.duelTopic = kit.topic;
      studyState.duelMode = kit.mode;
      studyState.duelBot = kit.mode !== 'teacher';
      studyState.duelOpponentName = studyState.duelBot ? tr('Duvela Bot','Бот Duvela') : tr('Students','Ученики');
      studyState.duelOpponentScore = 0;
      studyState.duelClassScore = 0;
      studyState.duelClassScoredIndex = -1;
      studyState.duelBotScoredIndex = -1;
      studyState.duelBotFallbackActive = false;
      studyState.duelTeacherAnsweredIndex = -1;
      studyState.duelRevealed = false;
      studyState.duelPaused = false;
      studyState.duelStartedAt = null;
      studyState.data = deck;
      studyState.idx = 0;
      studyState.score = 0;
      studyState.total = deck.length || duelQuestionCount();
      studyState.duelPoll = [0, 0, 0, 0];
      studyState.duelPollIndex = 0;
      studyState.duelAnsweredIds = {};
      studyState.duelQuestionStartedAt = new Date().toISOString();
      studyState.duelFrozenLeft = null;
      studyState.tool = 'duelmatch';
      try {
        if (!studyState.duelRoomId) await ensureDuelLobbyRoom();
        var api = duelRoomApi();
        if (api && studyState.duelRoomId) {
          await api.setRoomState(studyState.duelRoomId, {
            deck: deck,
            total_questions: deck.length,
            question_seconds: duelQuestionSeconds(),
            level: duelLevelLabel(),
            topic: kit.topic,
            duel_mode: kit.mode,
            reveal_answer: false
          });
          var started = await api.showQuestion(studyState.duelRoomId, 0);
          if (started && started.question_started_at) studyState.duelQuestionStartedAt = started.question_started_at;
          // Fire-and-forget: notify the teacher's followers with the join
          // code. Failure is invisible on purpose — a push glitch must not
          // block the duel from actually starting.
          if (uid() && studyState.duelJoinCode) {
            void supa.functions.invoke('notify-duel-start', {
              body: {
                teacherId: uid(),
                joinCode: studyState.duelJoinCode,
                target: studyState.lang || 'de',
                level: duelLevelLabel()
              }
            }).catch(function () {});
          }
        }
      } catch (error) {
        console.warn('Could not start duel room.', error);
      }
      $('#studyOverlayTitle').textContent = '⚡ ' + tr('LIVE Duel','LIVE-дуэль');
      renderTool();
      if (button) button.disabled = false;
    }

    function duelTeacherKit() {
      try {
        return Object.assign({ topic:'all',mode:'students',streak:0,lastDay:'',totalLives:0,questions:10,seconds:15,source:'bank',practiceId:'',levels:[] }, JSON.parse(localStorage.getItem(DUEL_TEACHER_KEY) || '{}'));
      } catch (e) {
        return { topic:'all',mode:'students',streak:0,lastDay:'',totalLives:0,questions:10,seconds:15,source:'bank',practiceId:'',levels:[] };
      }
    }

    function saveDuelTeacherKit(next) {
      try { localStorage.setItem(DUEL_TEACHER_KEY, JSON.stringify(next)); } catch (e) {}
    }

    function updateDuelTeacherStreak() {
      var kit = duelTeacherKit(), today = duelTodayKey();
      if (kit.lastDay !== today) {
        var previous = kit.lastDay ? new Date(kit.lastDay + 'T12:00:00') : null;
        var now = new Date(today + 'T12:00:00');
        kit.streak = previous && Math.round((now - previous) / 86400000) === 1 ? Number(kit.streak || 0) + 1 : 1;
        kit.lastDay = today;
      }
      kit.totalLives = Number(kit.totalLives || 0) + 1;
      saveDuelTeacherKit(kit);
      return kit;
    }

    function duelTopicList() {
      var lang = studyState && studyState.lang;
      var base = [
        ['all', tr('Mixed lesson','Смешанный урок')],
        ['life', tr('Daily life','Быт / Alltag')],
        ['school', tr('School','Школа')],
        ['work', tr('Work','Работа')],
        ['exam', tr('Exam prep','Экзамен')],
        ['grammar', tr('Grammar','Грамматика')]
      ];
      if (lang !== 'de') return base;
      // German gets four extra category chips so a teacher can spin up a
      // focused drill for one Kasus / Präposition / Artikel / Verb form
      // right inside the LIVE deck.
      return base.concat([
        ['article', tr('Articles','Артикль')],
        ['prep', tr('Prepositions','Предлоги')],
        ['case', tr('Cases','Падежи')],
        ['verb', tr('Verb forms','Формы глагола')],
        ['sentence', tr('Correct sentence','Верное предложение')]
      ]);
    }

    // Group the topic chips so the row doesn't stretch to 11 buttons on
    // German. Everyday = mixed + real-life themes; Grammar = the focused
    // drill deck; Exam = telc / DTZ prep. Active group is derived from the
    // currently-selected topic on the first render, then held on
    // studyState.duelTopicGroup so a teacher can browse without clicking a
    // chip.
    var DUEL_TOPIC_GROUP_MEMBERS = {
      everyday: { all:1, life:1, school:1, work:1 },
      grammar:  { grammar:1, article:1, prep:1, case:1, verb:1, sentence:1 },
      exam:     { exam:1 }
    };

    function duelTopicGroups() {
      return [
        ['everyday', tr('Everyday','Быт')],
        ['grammar',  tr('Grammar','Грамматика')],
        ['exam',     tr('Exam','Экзамен')]
      ];
    }

    function duelTopicGroupOf(topic) {
      var groups = Object.keys(DUEL_TOPIC_GROUP_MEMBERS);
      for (var i = 0; i < groups.length; i++) {
        if (DUEL_TOPIC_GROUP_MEMBERS[groups[i]][topic]) return groups[i];
      }
      return 'everyday';
    }

    function duelActiveTopicGroup() {
      var stored = studyState && studyState.duelTopicGroup;
      var groupIds = duelTopicGroups().map(function (row) { return row[0]; });
      if (stored && groupIds.indexOf(stored) >= 0) return stored;
      return duelTopicGroupOf((studyState && studyState.duelTopic) || 'all');
    }

    function duelModeList() {
      return [
        ['students', tr('Students vs Bot','Ученики против бота')],
        ['class', tr('Class vs Bot','Класс против бота')],
        ['teacher', tr('Teacher vs Students','Учитель против учеников')]
      ];
    }

    function duelTopicLabel(topic) {
      var found = duelTopicList().find(function (item) { return item[0] === topic; });
      return found ? found[1] : duelTopicList()[0][1];
    }

    function duelModeLabel(mode) {
      var found = duelModeList().find(function (item) { return item[0] === mode; });
      return found ? found[1] : duelModeList()[0][1];
    }

    // Grammar categories that HARD-filter the deck (only items with a
    // matching `kind` survive). Softer topics keep the fuzzy-match order.
    var HARD_KIND_TOPICS = { article: 1, prep: 1, case: 1, verb: 1, sentence: 1 };

    function orderDuelDeckByTopic(deck, topic) {
      if (!topic || topic === 'all') return deck;
      if (HARD_KIND_TOPICS[topic]) {
        var byKind = deck.filter(function (item) { return item.kind === topic; });
        return byKind.length ? byKind : deck;
      }
      var patterns = {
        life: /kaffee|wasser|haus|stadt|bahnhof|ticket|essen|trinken|famil|freund|morgen|abend|supermarkt|cafe|bitte|gern|heute|schule/i,
        school: /schule|kurs|klasse|lehrer|lernen|lernst|lernt|buch|prüfung|test|frage|antwort|deutsch/i,
        work: /arbeit|büro|chef|kolleg|termin|kunde|projekt|meeting|vertrag|rechnung|bericht|job|service/i,
        exam: /prüfung|test|frage|antwort|richtig|falsch|fehler|regel|grammatik|artikel|perfekt|satz/i,
        grammar: /___|der |die |das |ein |eine |einen |einem |ist |sind |habe |hat |war |werden/i
      };
      var pattern = patterns[topic] || patterns.all;
      if (!pattern) return deck;
      var primary = [], secondary = [];
      deck.forEach(function (item) {
        var text = String(item.q || '') + ' ' + (item.opts || []).join(' ');
        (pattern.test(text) ? primary : secondary).push(item);
      });
      return primary.length >= duelQuestionCount() ? primary.concat(secondary) : deck;
    }

    function duelPollSeed(item) {
      var counts = [0,0,0,0], base = String(item && item.q || '');
      for (var i = 0; i < Math.min(9, base.length); i++) counts[(base.charCodeAt(i) + i) % 4]++;
      return counts;
    }

    function duelPollHtml(item) {
      var counts = studyState.duelPoll || [0,0,0,0];
      var total = counts.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      var pollLabel = studyState && studyState.duelRoomId
        ? tr('Students + stream chat A/B/C/D','Ученики + чат эфира A/B/C/D')
        : tr('Tap votes from LIVE chat','Нажимайте голоса из LIVE-чата');
      // The +N button DOESN'T pull actual chat: it just adds simulated votes so
      // the poll bars look alive during demo streams / practice. Call it that.
      // Real chat integration comes from students joining via the code (auto)
      // or the teacher tapping the A/B/C/D buttons themselves (manual).
      var burstLabel = tr('Simulate poll (demo)','Симуляция голосов (демо)');
      return '<div class="duel-chat-poll" id="duelChatPoll"><div class="duel-poll-head"><div><small>CHAT POLL</small><b>'+esc(pollLabel)+'</b></div><strong>'+total+'</strong></div><div class="duel-poll-bars">'+counts.map(function(count,index){var pct=total?Math.round(count/total*100):0;return '<button type="button" data-duel-vote="'+index+'"><span>'+String.fromCharCode(65+index)+'</span><i><em style="width:'+pct+'%"></em></i><strong>'+pct+'%</strong></button>';}).join('')+'</div><div class="duel-poll-actions"><button type="button" data-duel-vote-burst="1" class="duel-poll-demo" title="'+esc(tr('Adds fake votes so the poll bars look busy during a demo. Real chat integration comes from students joining via the code.','Добавляет фейковые голоса, чтобы график не был пустым во время демо. Настоящие голоса идут через код входа.'))+'">'+esc(burstLabel)+'</button><button type="button" data-duel-vote-reset="1">'+esc(tr('reset poll','сброс'))+'</button></div></div>';
    }

    function updateDuelPoll() {
      var poll = $('#duelChatPoll');
      if (!poll || !studyState) return;
      var counts = studyState.duelPoll || [0,0,0,0], total = counts.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      var totalNode = poll.querySelector('.duel-poll-head strong');
      if (totalNode) totalNode.textContent = total;
      Array.prototype.forEach.call(poll.querySelectorAll('[data-duel-vote]'), function (button, index) {
        var pct = total ? Math.round((counts[index] || 0) / total * 100) : 0;
        var bar = button.querySelector('em'), label = button.querySelector('strong');
        if (bar) bar.style.width = pct + '%';
        if (label) label.textContent = pct + '%';
      });
    }

    async function loadTeacherDuelPacks(host) {
      var select = (host && host.querySelector('#duelPackSelect')) || $('#duelPackSelect');
      if (!select || !uid()) {
        if (select) select.innerHTML = '<option value="">' + esc(tr('Sign in to load packs','Войдите, чтобы загрузить наборы')) + '</option>';
        return;
      }
      try {
        var result = await supa.from('teacher_practices')
          .select('id,title,level,target,format,status')
          .eq('creator_id', uid())
          .eq('format', 'mcq')
          .in('status', ['published', 'draft'])
          .order('updated_at', { ascending: false })
          .limit(40);
        var packs = result.data || [];
        studyState.duelPacks = packs;
        if (!packs.length) {
          select.innerHTML = '<option value="">' + esc(tr('No MCQ packs yet','Пока нет MCQ-наборов')) + '</option>';
          return;
        }
        select.innerHTML = '<option value="">' + esc(tr('Choose a pack','Выберите набор')) + '</option>' + packs.map(function (pack) {
          var selected = String(pack.id) === String(studyState.duelPracticeId || '') ? ' selected' : '';
          return '<option value="' + esc(pack.id) + '"' + selected + '>' + esc(pack.title || 'Practice') + (pack.level ? ' · ' + esc(String(pack.level).toUpperCase()) : '') + '</option>';
        }).join('');
        if (studyState.duelPracticeId) void selectDuelPack(studyState.duelPracticeId, true);
      } catch (error) {
        select.innerHTML = '<option value="">' + esc(tr('Could not load packs','Не удалось загрузить наборы')) + '</option>';
      }
    }

    async function selectDuelPack(practiceId, silent) {
      if (!practiceId || !studyState) return;
      studyState.duelPracticeId = practiceId;
      try {
        var result = await supa.from('teacher_practice_items')
          .select('prompt,options,answer,explanation,type')
          .eq('practice_id', practiceId)
          .order('order_index', { ascending: true });
        var deck = (result.data || []).map(practiceItemToDuel).filter(Boolean);
        if (!deck.length && !silent) {
          var status = $('#challengeMembers');
          if (status) status.textContent = tr('This pack has no MCQ questions.','В наборе нет MCQ-вопросов.');
          return;
        }
        studyState.duelSource = 'mine';
        studyState.duelPracticeDeck = deck;
        var kit = duelTeacherKit();
        kit.source = 'mine';
        kit.practiceId = practiceId;
        saveDuelTeacherKit(kit);
        var bankNode = $('#duelLobbyBank');
        if (bankNode) bankNode.textContent = String(deck.length);
        if (studyState.duelRoomId) {
          queueDuelRoom(function () {
            var api = duelRoomApi();
            if (!api || !studyState.duelRoomId) return null;
            var patch = lobbySettingsPatch();
            return api.setRoomState(studyState.duelRoomId, {
              deck: patch.deck,
              total_questions: patch.total_questions,
              question_seconds: patch.question_seconds,
              topic: patch.topic
            });
          });
        }
      } catch (error) {
        if (!silent) {
          var fail = $('#challengeMembers');
          if (fail) fail.textContent = error.message || tr('Could not open the pack.','Не удалось открыть набор.');
        }
      }
    }

    async function generateDuelDeck(button) {
      if (!studyState) return;
      var status = $('#challengeMembers');
      if (button) {
        button.disabled = true;
        button.textContent = tr('Generating…','Генерируем…');
      }
      if (status) status.textContent = tr('AI is generating a question deck…','AI создаёт колоду вопросов…');
      try {
        var count = duelQuestionCount();
        var response = await supa.functions.invoke('generate-practice', {
          body: {
            mode: 'topic',
            format: 'mcq',
            target: generateTargetName(studyState.lang),
            level: String(duelSelectedLevels().slice(-1)[0] || studyState.level || 'A1').toLowerCase(),
            count: count,
            locale: ctx.isRu ? 'ru' : 'en',
            topic: duelTopicLabel(studyState.duelTopic || 'all')
          }
        });
        if (response.error) throw new Error(response.error.message || tr('Generation failed.','Генерация не удалась.'));
        var payload = response.data || {};
        if (payload.error) throw new Error(payload.error);
        var items = (payload.items || []).map(function (item) {
          var opts = Array.isArray(item.options) ? item.options.slice(0, 4) : [];
          if (!item.prompt || opts.length !== 4) return null;
          var idx = Number(item.correctIndex);
          if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) idx = 0;
          return { q: item.prompt, opts: opts, a: idx, explanation: item.explanation || '' };
        }).filter(Boolean);
        if (!items.length) throw new Error(tr('AI returned no usable questions.','AI не вернул подходящих вопросов.'));
        studyState.duelSource = 'ai';
        studyState.duelAiReviewed = false;
        studyState.duelGeneratedDeck = items;
        var kit = duelTeacherKit();
        kit.source = 'ai';
        saveDuelTeacherKit(kit);
        Array.prototype.forEach.call(document.querySelectorAll('[data-duel-source]'), function (node) {
          node.classList.toggle('active', node.getAttribute('data-duel-source') === 'ai');
        });
        var bankNode = $('#duelLobbyBank');
        if (bankNode) bankNode.textContent = String(items.length);
        if (status) status.textContent = tr('Question deck ready — review it before starting. ','Колода готова — проверьте её перед запуском. ') + items.length + ' ' + tr('questions','вопросов');
        if (studyState.duelRoomId) {
          var patch = lobbySettingsPatch();
          var api = duelRoomApi();
          if (api) await api.setRoomState(studyState.duelRoomId, {
            deck: patch.deck,
            total_questions: patch.total_questions,
            question_seconds: patch.question_seconds,
            topic: patch.topic
          });
        }
      } catch (error) {
        if (status) status.textContent = (error && error.message) || tr('Could not generate the question deck.','Не удалось создать колоду вопросов.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = tr('Generate questions','Сгенерировать вопросы');
        }
      }
    }

    function bindDuelWorkspaceTabs(host) {
      var tabs = host.querySelectorAll('[data-duel-tab]');
      var workspace = host.querySelector('.duel-teacher-lobby') || host;
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-source]'), function (button) {
        button.addEventListener('click', function () {
          var row = host.querySelector('#duelPackRow');
          if (row) { row.hidden = button.getAttribute('data-duel-source') !== 'mine'; row.style.display = row.hidden ? 'none' : ''; }
        });
      });
      function select(tab) {
        var value = tab || 'setup';
        workspace.setAttribute('data-duel-tab-active', value);
        host.setAttribute('data-duel-tab-active', value);
        Array.prototype.forEach.call(tabs, function (button) {
          var active = button.getAttribute('data-duel-tab') === value;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (value === 'deck') {
          var preview = host.querySelector('#duelDeckPreview');
          if (preview) preview.hidden = false;
          renderDuelDeckPreview(host, false);
        }
      }
      Array.prototype.forEach.call(tabs, function (button) {
        button.onclick = function () { select(button.getAttribute('data-duel-tab')); };
      });
      select('setup');
    }

    function bindDuelLobbyControls(host) {
      function refresh() {
        var kit = duelTeacherKit();
        kit.topic = studyState.duelTopic || kit.topic || 'all';
        kit.mode = studyState.duelMode || kit.mode || 'students';
        studyState.duelLevels = normalizeDuelLevels(studyState.duelLevels || kit.levels || studyState.level, studyState.level);
        kit.questions = duelQuestionCount();
        kit.seconds = duelQuestionSeconds();
        kit.source = duelSource();
        kit.practiceId = studyState.duelPracticeId || '';
        kit.levels = duelSelectedLevels();
        saveDuelTeacherKit(kit);
        var activeGroup = duelActiveTopicGroup();
        var chipRow = host.querySelector('.duel-topic-chips');
        if (chipRow) chipRow.setAttribute('data-active-group', activeGroup);
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic-group]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-topic-group') === activeGroup); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic]'), function (button) {
          var chipGroup = button.getAttribute('data-topic-group') || duelTopicGroupOf(button.getAttribute('data-duel-topic'));
          button.hidden = chipGroup !== activeGroup;
          button.classList.toggle('active', button.getAttribute('data-duel-topic') === studyState.duelTopic);
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-mode]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-mode') === studyState.duelMode); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-level]'), function (button) { button.classList.toggle('active', duelSelectedLevels().indexOf(button.getAttribute('data-duel-level')) >= 0); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-count]'), function (button) { button.classList.toggle('active', Number(button.getAttribute('data-duel-count')) === duelQuestionCount()); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-seconds]'), function (button) { button.classList.toggle('active', Number(button.getAttribute('data-duel-seconds')) === duelQuestionSeconds()); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-source]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-source') === duelSource()); });
        var packRow = host.querySelector('#duelPackRow');
        var activeSource = host.querySelector('[data-duel-source].active');
        if (packRow) { packRow.hidden = activeSource ? activeSource.getAttribute('data-duel-source') !== 'mine' : duelSource() !== 'mine'; packRow.style.display = packRow.hidden ? 'none' : ''; }
        var deck = currentDuelDeck();
        var levelNode = $('#duelLobbyLevel'), bankNode = $('#duelLobbyBank'), modeLabel = $('#duelLobbyModeLabel'), countNode = $('#duelLobbyCount');
        if (levelNode) levelNode.textContent = duelLevelLabel();
        if (bankNode) bankNode.textContent = String(studyState.duelBankTotal || deck.length);
        if (countNode) countNode.textContent = String(duelQuestionCount());
        if (modeLabel) modeLabel.textContent = duelModeLabel(studyState.duelMode) + ' · ' + duelTopicLabel(studyState.duelTopic);
        if (studyState.duelJoinCode) applyDuelCodeToLobby(studyState.duelJoinCode);
        if (studyState.duelRoomId) {
          queueDuelRoom(function () {
            var api = duelRoomApi();
            if (!api || !studyState || !studyState.duelRoomId) return null;
            var patch = lobbySettingsPatch();
            return api.setRoomState(studyState.duelRoomId, {
              deck: patch.deck,
              total_questions: patch.total_questions,
              question_seconds: patch.question_seconds,
              level: patch.level,
              topic: patch.topic,
              duel_mode: patch.mode,
              target: patch.target
            });
          });
        }
        updateDuelStartButton();
      }
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic-group]'), function (button) {
        button.onclick = function () {
          studyState.duelTopicGroup = button.getAttribute('data-duel-topic-group') || 'everyday';
          refresh();
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic]'), function (button) {
        button.onclick = function () {
          var topic = button.getAttribute('data-duel-topic') || 'all';
          studyState.duelTopic = topic;
          // Snap the visible group to the one that owns this chip so the
          // teacher's next glance at the row shows what's actually selected.
          studyState.duelTopicGroup = duelTopicGroupOf(topic);
          refresh();
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-mode]'), function (button) {
        button.onclick = function () { studyState.duelMode = button.getAttribute('data-duel-mode') || 'students'; refresh(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-level]'), function (button) {
        button.onclick = function () {
          var level = button.getAttribute('data-duel-level') || 'A1';
          var levels = duelSelectedLevels();
          var existing = levels.indexOf(level);
          if (existing >= 0 && levels.length > 1) levels.splice(existing, 1);
          else if (existing < 0) {
            levels.push(level);
            if (levels.length > 2) levels.shift();
          }
          studyState.duelLevels = levels;
          studyState.level = levels[0] || level;
          studyState.data = null;
          refresh();
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-count]'), function (button) {
        button.onclick = function () { studyState.duelQuestionCount = Number(button.getAttribute('data-duel-count')) || 10; refresh(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-seconds]'), function (button) {
        button.onclick = function () { studyState.duelQuestionSeconds = Number(button.getAttribute('data-duel-seconds')) || 15; refresh(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-source]'), function (button) {
        button.onclick = function () {
          studyState.duelSource = button.getAttribute('data-duel-source') || 'bank';
          if (studyState.duelSource === 'ai') studyState.duelAiReviewed = false;
          var sourcePackRow = host.querySelector('#duelPackRow');
          if (sourcePackRow) { sourcePackRow.hidden = studyState.duelSource !== 'mine'; sourcePackRow.style.display = sourcePackRow.hidden ? 'none' : ''; }
          refresh();
        };
      });
      var autopilot = host.querySelector('[data-duel-autopilot]');
      if (autopilot) autopilot.onclick = function () {
        studyState.duelAutopilot = !studyState.duelAutopilot;
        autopilot.classList.toggle('active', studyState.duelAutopilot);
        autopilot.textContent = studyState.duelAutopilot ? tr('Auto-pilot: ON','Автопилот: ВКЛ') : tr('Auto-pilot','Автопилот');
        // Persist immediately so Quick Start next time inherits the choice.
        var kit = duelTeacherKit();
        kit.autopilot = !!studyState.duelAutopilot;
        saveDuelTeacherKit(kit);
      };
      var generate = host.querySelector('[data-duel-generate]');
      if (generate) generate.onclick = function () { void generateDuelDeck(generate); };
      var packSelect = host.querySelector('#duelPackSelect');
      if (packSelect) packSelect.onchange = function () { void selectDuelPack(packSelect.value, false); };
      var previewButton = host.querySelector('[data-duel-preview]');
      if (previewButton) previewButton.onclick = function () { renderDuelDeckPreview(host, true); };
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-copy]'), function (button) {
        button.onclick = function () { copyDuelValue(button.getAttribute('data-duel-copy'), button); };
      });
      refresh();
    }

    function readDuelLiveMode() {
      try { return localStorage.getItem(DUEL_LIVE_KEY) === '1'; } catch (e) { return false; }
    }

    function setDuelLiveMode(enabled) {
      if (!studyState) return;
      studyState.liveMode = !!enabled;
      var overlay = $('#studyOverlay');
      if (overlay) overlay.classList.toggle('practice-live-mode', studyState.liveMode);
      if (studyState.liveMode && overlay) {
        var body = overlay.querySelector('.overlay-body');
        if (body) body.scrollTop = 0;
      }
      try { localStorage.setItem(DUEL_LIVE_KEY, studyState.liveMode ? '1' : '0'); } catch (e) {}
      var button = $('#duelLiveToggle');
      if (button) {
        button.setAttribute('aria-pressed', String(studyState.liveMode));
        button.innerHTML = studyState.liveMode
          ? '<span aria-hidden="true">&times;</span>' + esc(tr('Exit LIVE', '\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 LIVE'))
          : '<span aria-hidden="true">&#9679;</span>LIVE 9:16';
      }
    }

    function bindDuelLiveControls(host) {
      var toggle = $('#duelLiveToggle');
      if (toggle) toggle.onclick = function () { setDuelLiveMode(!studyState.liveMode); };
      setDuelLiveMode(studyState.liveMode == null ? readDuelLiveMode() : studyState.liveMode);
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-answer]'), function (button, index) {
        button.setAttribute('aria-keyshortcuts', String(index + 1));
      });
      // Device votes come from the room. The teacher can still tap A–D here to
      // count TikTok / YouTube comments they are reading off the restream.
      var hasRoom = !!(studyState && studyState.duelRoomId);
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-vote]'), function (button) {
        button.onclick = function () {
          var index = Number(button.getAttribute('data-duel-vote'));
          if (hasRoom && duelRoomApi()) {
            studyState.duelChatTap = Number(studyState.duelChatTap || 0) + 1;
            void duelRoomApi().ingestChatVote(studyState.duelRoomId, {
              displayName: 'Chat ' + studyState.duelChatTap,
              optionIndex: index
            });
            return;
          }
          if (!studyState.duelPoll) studyState.duelPoll = [0,0,0,0];
          studyState.duelPoll[index] = Number(studyState.duelPoll[index] || 0) + 1;
          updateDuelPoll();
        };
      });
      var burst = host.querySelector('[data-duel-vote-burst]');
      if (burst) {
        if (hasRoom) burst.remove();
        else burst.onclick = function () {
          if (!studyState.duelPoll) studyState.duelPoll = [0,0,0,0];
          for (var i = 0; i < 8; i++) studyState.duelPoll[Math.floor(Math.random() * 4)]++;
          updateDuelPoll();
        };
      }
      var reset = host.querySelector('[data-duel-vote-reset]');
      if (reset) reset.onclick = function () { studyState.duelPoll = [0,0,0,0]; updateDuelPoll(); };
    }

    // ── Real duel room (teacher vs class) ──────────────────────────────────
    // The poll bars and the opponent score used to be theatre: the teacher
    // tapped the bars by hand and a timer ticked the "Students" number up.
    // With a room open, both come from live_duel_votes / live_duel_players.

    function duelRoomApi() { return window.DuvelaDuelRoom || null; }

    function liveLeftScore() {
      if (!studyState) return 0;
      return studyState.duelMode === 'class' ? Number(studyState.duelClassScore || 0) : Number(studyState.score || 0);
    }

    function liveRightScore() {
      if (!studyState) return 0;
      return studyState.duelMode === 'teacher' && !duelBotOpponentActive() ? Number(studyState.duelClassScore || 0) : Number(studyState.duelOpponentScore || 0);
    }

    function duelRealPlayersCount() {
      return ((studyState && studyState.duelRoomPlayers) || []).filter(function (player) {
        return player && player.origin !== 'chat';
      }).length;
    }

    function duelBotOpponentActive() {
      if (!studyState) return false;
      return studyState.duelMode !== 'teacher' || studyState.duelBotFallbackActive || duelRealPlayersCount() === 0;
    }

    function duelBotCorrectForItem(item, index) {
      var text = String((item && item.q) || '') + '|' + String(index || 0);
      var hash = 0;
      for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) >>> 0;
      return (hash % 100) < 68;
    }

    function awardBotPointIfNeeded(item) {
      if (!studyState || !duelBotOpponentActive()) return;
      var index = Number(studyState.idx || 0);
      if (studyState.duelBotScoredIndex === index) return;
      if (studyState.duelMode === 'teacher') studyState.duelBotFallbackActive = true;
      studyState.duelBotScoredIndex = index;
      if (duelBotCorrectForItem(item, index)) {
        studyState.duelOpponentScore = Number(studyState.duelOpponentScore || 0) + 1;
      }
      updateDuelScoreboard();
    }

    function lockDuelAnswerButtons(host, item, selected) {
      if (!host || !item) return;
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-answer]'), function (node) {
        node.disabled = true;
        var value = Number(node.getAttribute('data-duel-answer'));
        if (value === Number(item.a)) node.classList.add('correct');
        else if (value === selected) node.classList.add('wrong');
      });
    }

    function awardClassPointIfNeeded() {
      if (!studyState) return;
      var deck = studyState.data || [];
      var index = studyState.idx;
      if (index >= deck.length) index = deck.length - 1;
      if (index < 0 || studyState.duelClassScoredIndex === index) return;
      var item = deck[index];
      if (!item) return;
      var counts = studyState.duelPoll || [0, 0, 0, 0];
      var total = counts.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      if (total > 0 && Number(counts[Number(item.a)] || 0) > total / 2) {
        studyState.duelClassScore = Number(studyState.duelClassScore || 0) + 1;
      }
      studyState.duelClassScoredIndex = index;
      updateDuelScoreboard();
    }

    async function teacherReveal() {
      if (!studyState) return;
      var item = (studyState.data || [])[studyState.idx];
      var host = $('#studyToolBody');
      if (studyState.duelRevealed) {
        lockDuelAnswerButtons(host, item, null);
        return;
      }
      studyState.duelRevealed = true;
      awardClassPointIfNeeded();
      awardBotPointIfNeeded(item);
      lockDuelAnswerButtons(host, item, null);
      var api = duelRoomApi();
      if (api && studyState.duelRoomId) {
        try { await api.revealAnswer(studyState.duelRoomId); } catch (error) { /* reveal is best-effort */ }
      }
      var fx = window.DuvelaDuelFx;
      var revealMajority = false;
      if (item) {
        var revealCounts = studyState.duelPoll || [0, 0, 0, 0];
        var revealTotal = revealCounts.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
        revealMajority = revealTotal > 0 && Number(revealCounts[Number(item.a)] || 0) > revealTotal / 2;
      }
      if (fx && host) {
        fx.confetti(host);
        fx.playRevealSound(revealMajority || studyState.duelMode !== 'class');
      }
      // Adaptive difficulty: after the first 3 questions, look at the class's
      // majority-correct rate and, if two or more levels are on the deck, snap
      // the remaining questions to the harder level (smashing) or the easier
      // one (struggling). One-level decks are left alone.
      if (!studyState.duelCorrectHistory) studyState.duelCorrectHistory = [];
      var alreadyRecorded = studyState.duelCorrectRecordedIndex === studyState.idx;
      if (!alreadyRecorded) {
        studyState.duelCorrectHistory.push(revealMajority);
        studyState.duelCorrectRecordedIndex = studyState.idx;
        if (studyState.duelCorrectHistory.length === 3 && !studyState.duelAdaptiveApplied) {
          applyAdaptiveDifficulty();
        }
      }
      // Auto-pilot: hands-off mode. Once we've shown the answer, wait a short
      // beat for viewers to read the reveal, then advance ourselves. Teacher
      // can still hit Pause / Next at any time — pause cancels the timer, and
      // Next runs immediately if tapped before the timer fires.
      scheduleAutopilotAdvance();
    }

    function applyAdaptiveDifficulty() {
      if (!studyState || studyState.duelAdaptiveApplied) return;
      var levels = duelSelectedLevels();
      if (!Array.isArray(levels) || levels.length < 2) return;
      var history = studyState.duelCorrectHistory || [];
      var correct = history.filter(Boolean).length;
      if (correct === history.length) {
        // All three majority-correct → snap to the harder tier.
        var harder = levels[levels.length - 1];
        adaptRemainingDeck(harder, 'up');
      } else if (correct === 0) {
        // All three majority-wrong → drop to the easier tier.
        adaptRemainingDeck(levels[0], 'down');
      } else {
        // Mixed — leave the deck as-is.
        return;
      }
      studyState.duelAdaptiveApplied = true;
    }

    function adaptRemainingDeck(targetLevel, direction) {
      if (!studyState || !Array.isArray(studyState.data)) return;
      var head = studyState.data.slice(0, studyState.idx + 1);
      var tail = studyState.data.slice(studyState.idx + 1);
      // Items in the bank carry .level; when they don't, keep them (mixed).
      var preferred = tail.filter(function (item) {
        return !item.level || String(item.level) === targetLevel;
      });
      var rest = tail.filter(function (item) {
        return item.level && String(item.level) !== targetLevel;
      });
      var reordered = preferred.concat(rest);
      studyState.data = head.concat(reordered);
      var toast = document.getElementById('studyToolBody');
      if (toast) {
        var notice = document.createElement('div');
        notice.className = 'duel-adaptive-toast ' + (direction === 'up' ? 'up' : 'down');
        notice.textContent = direction === 'up'
          ? tr('Level up! Harder questions ahead.','Уровень выше! Впереди сложнее.')
          : tr('Easing off — next questions are lighter.','Смягчаем — следующие вопросы легче.');
        toast.insertBefore(notice, toast.firstChild);
        setTimeout(function () { if (notice && notice.parentNode) notice.parentNode.removeChild(notice); }, 3000);
      }
    }

    function scheduleAutopilotAdvance() {
      if (!studyState || !studyState.duelAutopilot) return;
      if (studyState.duelPaused) return;
      if (studyState.duelAutopilotTimer) {
        clearTimeout(studyState.duelAutopilotTimer);
      }
      studyState.duelAutopilotTimer = setTimeout(function () {
        studyState.duelAutopilotTimer = null;
        if (!studyState || studyState.tool !== 'duelmatch' || studyState.finished) return;
        if (studyState.duelPaused || !studyState.duelAutopilot) return;
        if (!studyState.duelRevealed) return; // safety: only advance after a reveal
        void teacherAdvance();
      }, 3500);
    }

    function cancelAutopilotAdvance() {
      if (studyState && studyState.duelAutopilotTimer) {
        clearTimeout(studyState.duelAutopilotTimer);
        studyState.duelAutopilotTimer = null;
      }
    }

    async function teacherAdvance() {
      if (!studyState) return;
      if (studyState.duelAdvancing) return;
      studyState.duelAdvancing = true;
      awardClassPointIfNeeded();
      try {
        studyState.idx += 1;
        studyState.duelRevealed = false;
        studyState.duelTeacherAnsweredIndex = -1;
        studyState.duelPoll = [0, 0, 0, 0];
        studyState.duelPollIndex = studyState.idx;
        studyState.duelAnsweredIds = {};
        studyState.duelFrozenLeft = null;
        studyState.duelQuestionStartedAt = new Date().toISOString();
        var api = duelRoomApi();
        var deck = studyState.data || [];
        if (api && studyState.duelRoomId) {
          try {
            if (studyState.idx >= deck.length) await api.finishRoom(studyState.duelRoomId);
            else {
              var started = await api.showQuestion(studyState.duelRoomId, studyState.idx);
              if (started && started.question_started_at) studyState.duelQuestionStartedAt = started.question_started_at;
            }
          } catch (error) { /* room advance is best-effort */ }
        }
        renderDuelMatch();
      } finally {
        if (studyState) studyState.duelAdvancing = false;
      }
    }

    async function refreshDuelRoomPlayers() {
      var api = duelRoomApi();
      if (!api || !studyState || !studyState.duelRoomId) return;
      try {
        var players = await api.fetchPlayers(studyState.duelRoomId, { joinedOnly: true });
        studyState.duelRoomPlayers = players;
        updateDuelScoreboard();
        renderDuelRoster();
        var status = $('#challengeMembers');
        if (status && studyState.tool === 'duel') {
          status.textContent = players.length
            ? (players.length + ' ' + tr('students ready','учеников готовы'))
            : (studyState.duelMode === 'teacher'
              ? tr('Waiting for students…','Ждём учеников…')
              : tr('Room is ready to start.','Комната готова к запуску.'));
        }
        updateDuelStartButton();
        if (uid() && duelRoomApi() && duelRoomApi().fetchQueue) {
          void duelRoomApi().fetchQueue(uid()).then(function (waiters) {
            var host = document.getElementById('duelLobbyRoster');
            if (!host || !waiters || !waiters.length) return;
            var extra = document.getElementById('duelWaitList');
            if (!extra) {
              extra = document.createElement('div');
              extra.id = 'duelWaitList';
              extra.className = 'duel-lobby-roster';
              host.after(extra);
            }
            extra.innerHTML = '<div class="duel-roster-head"><small>' +
              esc(tr('WAITING LIST', 'ОЖИДАНИЕ')) + '</small><strong>' + waiters.length + '</strong></div>' +
              '<ol class="duel-roster-list">' + waiters.map(function (row, index) {
                return '<li><b>' + (index + 1) + '</b><span>' + esc(row.display_name || 'Student') + '</span></li>';
              }).join('') + '</ol>';
          }).catch(function () {});
        }
      } catch (error) { /* roster refresh is best-effort */ }
    }

    function renderDuelRoster() {
      var host = document.getElementById('duelLobbyRoster') || document.getElementById('duelRoster');
      if (!host) return;
      var players = ((studyState && studyState.duelRoomPlayers) || []).filter(function (player) {
        return player.origin !== 'chat';
      });
      var canKick = studyState && studyState.duelRoomId;
      if (!players.length) {
        host.innerHTML = '<div class="duel-roster-empty">' +
          esc(tr('Waiting for students to join with the code…', 'Ждём учеников по коду…')) + '</div>';
        return;
      }
      host.innerHTML = '<div class="duel-roster-head"><small>' +
        esc(tr('IN THE ROOM', 'В КОМНАТЕ')) + '</small><strong>' + players.length + '</strong></div>' +
        '<ol class="duel-roster-list">' + players.slice(0, 12).map(function (player, index) {
          var answered = studyState.tool === 'duelmatch' && studyState.duelAnsweredIds && studyState.duelAnsweredIds[player.id];
          var points = studyState.tool === 'duelmatch' ? Number(player.score || 0) : Number(player.correct_count || 0);
          return '<li class="' + (answered ? 'answered' : '') + '"><b>' + (index + 1) + '</b><span>' + esc(player.display_name || 'Student') +
            '</span><em>' + points + '</em>' +
            (studyState.tool === 'duelmatch' ? '<i class="duel-answered-dot" title="' + (answered ? 'answered' : 'waiting') + '"></i>' : '') +
            (canKick ? '<button type="button" class="duel-kick" data-duel-kick="' + esc(player.id) + '" aria-label="Kick">×</button>' : '') +
            '</li>';
        }).join('') + '</ol>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-kick]'), function (button) {
        button.onclick = function () {
          var playerId = button.getAttribute('data-duel-kick');
          var api = duelRoomApi();
          if (!api || !playerId) return;
          void api.kickPlayer(playerId).then(function () { return refreshDuelRoomPlayers(); }).catch(function () {});
        };
      });
    }

    function closeDuelRoom() {
      var api = duelRoomApi();
      if (!studyState) return;
      if (studyState.duelRoomChannel && api) api.unsubscribe(studyState.duelRoomChannel);
      if (studyState.duelRoomId && api) void api.closeRoom(studyState.duelRoomId).catch(function () {});
      studyState.duelRoomChannel = null;
      studyState.duelRoomId = null;
      studyState.duelRoomPlayers = [];
    }

    function handleDuelLiveKeydown(event) {
      if (!studyState || studyState.tool !== 'duelmatch') return;
      var target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setDuelLiveMode(!studyState.liveMode);
        return;
      }
      var answerIndex = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : 'abcd'.indexOf(event.key.toLowerCase());
      if (answerIndex < 0 || answerIndex > 3) return;
      var answer = document.querySelector('[data-duel-answer="' + answerIndex + '"]:not(:disabled)');
      if (answer) { event.preventDefault(); answer.click(); }
    }

    function renderDuelMatch(){
      var host=$('#studyToolBody'),deck=studyState.data||[];
      if(!studyState.duelStartedAt){
        studyState.duelStartedAt=Date.now();
      }
      if(studyState.idx>=deck.length)return finishDuelMatch();
      var item=deck[studyState.idx];
      if(studyState.duelPollIndex!==studyState.idx){studyState.duelPoll=[0,0,0,0];studyState.duelPollIndex=studyState.idx;studyState.duelAnsweredIds={};}
      if(studyState.duelRoomId&&duelRoomApi()){
        void duelRoomApi().fetchTally(studyState.duelRoomId,studyState.idx).then(function(result){
          if(!studyState||studyState.duelPollIndex!==studyState.idx)return;
          applyTally(result);
          updateDuelPoll();
          updateDuelAnsweredMeta();
          renderDuelRoster();
        }).catch(function(){});
      }
      var playerLabel=studyState.duelMode==='teacher'?tr('TEACHER','УЧИТЕЛЬ'):studyState.duelMode==='class'?tr('CLASS','КЛАСС'):tr('YOU','ВЫ');
      var opponentLabel=studyState.duelMode==='teacher'&&!duelBotOpponentActive()?tr('Class','Класс'):(duelBotOpponentActive()?tr('Duvela Bot','Бот Duvela'):studyState.duelOpponentName);
      var pauseClass=studyState.duelPaused?' class="active"':'',pauseText=studyState.duelPaused?tr('Resume','Продолжить'):tr('Pause','Пауза');
      var answeredCount=duelAnsweredCount()||(studyState.duelPoll||[]).reduce(function(sum,value){return sum+Number(value||0);},0);
      var playerTotal=((studyState.duelRoomPlayers||[]).length);
      host.innerHTML='<div class="duel-live-masthead"><div><small>DUVELA</small><strong>'+esc(tr('LANGUAGE DUEL','\u042f\u0417\u042b\u041a\u041e\u0412\u0410\u042f \u0414\u0423\u042d\u041b\u042c'))+'</strong></div><span id="duelGiftRank" class="duel-gift-rank" hidden></span><span><i></i> LIVE</span></div><div class="duel-live-toolbar"><span>'+esc(tr('For TikTok LIVE: capture the vertical game area','\u0414\u043b\u044f TikTok LIVE: \u0437\u0430\u0445\u0432\u0430\u0442\u0438\u0442\u0435 \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u0443\u044e \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0438\u0433\u0440\u044b'))+'</span><button type="button" id="duelLiveToggle" aria-pressed="false"><span aria-hidden="true">&#9679;</span>LIVE 9:16</button></div><div class="duel-teacher-live-panel"><div><small>'+esc(duelModeLabel(studyState.duelMode))+'</small><b>'+esc(duelTopicLabel(studyState.duelTopic))+'</b></div><span>'+esc(tr('Join','Вход'))+' <b>vela.cafe</b> · <strong>'+esc(studyState.duelJoinCode||'—')+'</strong></span><button type="button" data-duel-teacher-action="pause"'+pauseClass+'>'+esc(pauseText)+'</button><button type="button" data-duel-teacher-action="answer">'+esc(tr('Show answer','Ответ'))+'</button><button type="button" data-duel-teacher-action="next">'+esc(tr('Next','Дальше'))+'</button></div><div class="duel-question-meta"><div class="duel-question-timer" id="duelQuestionTimer">'+duelSecondsLeft()+'</div><div class="duel-answered-meta" id="duelAnsweredMeta"><b>'+answeredCount+' / '+playerTotal+'</b> '+esc(tr('answered','ответили'))+'</div></div><p class="duel-live-audience">'+esc(tr('Students vote on their phones. Join: ','Ученики голосуют с телефонов. Код: '))+esc(studyState.duelJoinCode||'')+'</p><div class="duel-match-head"><div><span class="duel-avatar me">'+esc((ctx.profile&&ctx.profile.full_name||'D').charAt(0).toUpperCase())+'</span><small>'+esc(playerLabel)+'</small><b id="duelMyLive">'+liveLeftScore()+'</b></div><strong>VS</strong><div><span class="duel-avatar bot">'+(studyState.duelMode==='teacher'?'👥':(studyState.duelBot?'🤖':'👥'))+'</span><small>'+esc(opponentLabel)+'</small><b id="duelOpponentLive">'+liveRightScore()+'</b></div></div><div class="duel-question"><small>'+esc(tr('SAME QUESTION FOR BOTH','ОДИНАКОВЫЙ ВОПРОС ДЛЯ ОБОИХ'))+'</small><h2>'+esc(item.q)+'</h2></div>'+duelPollHtml(item)+'<div id="duelRoster" class="duel-roster"></div><div class="duel-options">'+item.opts.map(function(option,index){return '<button data-duel-answer="'+index+'"><span>'+String.fromCharCode(65+index)+'</span>'+esc(option)+'</button>';}).join('')+'</div><div id="duelAnswerFeedback"></div>';
      bindDuelLiveControls(host);
      renderDuelRoster();
      startDuelClock();
      if (window.DuvelaDuelFx && uid()) {
        void window.DuvelaDuelFx.renderGiftRank($('#duelGiftRank'), uid());
      }
      var liveTitle = host.querySelector('.duel-live-masthead strong');
      if (liveTitle) liveTitle.insertAdjacentHTML('afterend', '<em class="duel-live-bank">LEVEL ' + esc(duelLevelLabel()) + ' / BANK ' + esc(studyState.duelBankTotal || deck.length) + ' / Q ' + esc(String(studyState.idx + 1)) + '/' + esc(String(deck.length)) + '</em>');
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-teacher-action]'),function(button){button.onclick=function(){
        var action=button.getAttribute('data-duel-teacher-action');
        if(action==='pause'){
          studyState.duelPaused=!studyState.duelPaused;
          button.classList.toggle('active',studyState.duelPaused);
          button.textContent=studyState.duelPaused?tr('Resume','Продолжить'):tr('Pause','Пауза');
          var api=duelRoomApi();
          if(studyState.duelPaused){
            studyState.duelFrozenLeft=duelSecondsLeft();
            cancelAutopilotAdvance();
            if(api&&studyState.duelRoomId) void api.pauseRoom(studyState.duelRoomId).catch(function(){});
          } else {
            var remaining=Number(studyState.duelFrozenLeft!=null?studyState.duelFrozenLeft:duelQuestionSeconds());
            var startedAt=new Date(Date.now()-(duelQuestionSeconds()-remaining)*1000).toISOString();
            studyState.duelQuestionStartedAt=startedAt;
            studyState.duelFrozenLeft=null;
            if(api&&studyState.duelRoomId) void api.resumeRoom(studyState.duelRoomId,{question_started_at:startedAt}).catch(function(){});
            // Resuming while the answer is already revealed should not leave
            // the deck hanging — restart the autopilot beat if the teacher
            // opted into hands-off.
            if (studyState.duelRevealed) scheduleAutopilotAdvance();
          }
        }
        if(action==='answer') void teacherReveal();
        if(action==='next') void teacherAdvance();
      };});
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-answer]'),function(button){button.onclick=function(){
        if (studyState.duelPaused || studyState.duelRevealed || duelSecondsLeft() <= 0) return;
        if (studyState.duelTeacherAnsweredIndex === studyState.idx) return;
        var selected=Number(button.getAttribute('data-duel-answer')),ok=selected===item.a;
        studyState.duelTeacherAnsweredIndex = studyState.idx;
        lockDuelAnswerButtons(host, item, selected);
        feedback(ok,{prompt:item.q,chosen:item.opts[selected],correct:item.opts[item.a],explanation:answerExplanation(item)});
        if(studyState.duelMode!=='class'&&ok)studyState.score++;
        else if(!ok) logMistake(studyState.lang,item.q,item.opts,item.a,'duel');
        void teacherReveal();
        updateDuelScoreboard();
        $('#duelAnswerFeedback').innerHTML='<div class="inline-answer '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('Point for you!','Очко вам!'):tr('The opponent can get ahead','Соперник может выйти вперёд'))+'</b><p>'+esc(item.opts[item.a])+'</p><button class="btn primary" id="duelContinue">'+esc(studyState.idx+1>=deck.length?tr('Show result','Показать результат'):tr('Next question','Следующий вопрос'))+' →</button></div>';
        $('#duelContinue').onclick=function(){void teacherAdvance();};
      };});
    }

    function updateDuelScoreboard(){
      var mine=$('#duelMyLive'),opponent=$('#duelOpponentLive');
      if(mine)mine.textContent=liveLeftScore();
      if(opponent)opponent.textContent=liveRightScore();
    }

    function stopNextDuelCountdown() {
      if (studyState && studyState.nextDuelTimer) {
        clearInterval(studyState.nextDuelTimer);
        studyState.nextDuelTimer = null;
      }
    }

    function downloadDuelShareCard(players, code, title) {
      var canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      var g = canvas.getContext('2d');
      var bg = g.createLinearGradient(0, 0, 1080, 1350);
      bg.addColorStop(0, '#2b1248');
      bg.addColorStop(0.55, '#171020');
      bg.addColorStop(1, '#0e1c2e');
      g.fillStyle = bg;
      g.fillRect(0, 0, 1080, 1350);
      g.fillStyle = '#d5af68';
      g.font = '700 28px Inter, sans-serif';
      g.fillText('DUVELA LIVE DUEL', 80, 110);
      g.fillStyle = '#fff';
      g.font = '800 64px Inter, sans-serif';
      g.fillText(String(title || 'Winner board').slice(0, 22), 80, 190);
      g.font = '700 28px Inter, sans-serif';
      g.fillStyle = '#c9bfe4';
      g.fillText('vela.cafe  ·  ' + (code || ''), 80, 240);
      (players || []).slice(0, 8).forEach(function (player, index) {
        var y = 330 + index * 110;
        g.fillStyle = index === 0 ? 'rgba(213,175,104,.18)' : 'rgba(255,255,255,.06)';
        g.beginPath();
        if (g.roundRect) g.roundRect(70, y - 70, 940, 96, 24);
        else g.rect(70, y - 70, 940, 96);
        g.fill();
        g.fillStyle = index === 0 ? '#d5af68' : '#fff';
        g.font = '800 36px Inter, sans-serif';
        g.fillText(String(index + 1), 100, y);
        g.fillStyle = '#fff';
        g.font = '700 36px Inter, sans-serif';
        g.fillText(String(player.display_name || 'Student').slice(0, 22), 180, y);
        g.textAlign = 'right';
        g.fillStyle = '#7dffc4';
        g.fillText(String(Number(player.score || 0)), 980, y);
        g.textAlign = 'left';
      });
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'duvela-duel-' + (code || 'result') + '.png';
        link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
      });
    }

    async function finishDuelMatch(){
      if (!studyState || studyState.finished || studyState.finishingDuel) return;
      studyState.finishingDuel = true;
      if(studyState.duelTimerId){clearInterval(studyState.duelTimerId);studyState.duelTimerId=null;}
      stopDuelClock();
      stopNextDuelCountdown();
      cancelAutopilotAdvance();
      var coach = $('#practiceCoach');
      if (coach) { coach.hidden = true; coach.innerHTML = ''; }
      awardClassPointIfNeeded();
      var api = duelRoomApi();
      if (api && studyState.duelRoomId) {
        try { await api.finishRoom(studyState.duelRoomId); } catch (e) {}
        try { studyState.duelRoomPlayers = await api.fetchPlayers(studyState.duelRoomId, { joinedOnly: true }); } catch (e) {}
      }
      var players = (studyState.duelRoomPlayers || []).slice().sort(function (a, b) {
        return Number(b.score || 0) - Number(a.score || 0) || Number(b.correct_count || 0) - Number(a.correct_count || 0);
      });
      var top = players.slice(0, 8);
      var winner = top[0];
      var mine=liveLeftScore(),rivalScore=liveRightScore(),won=mine>rivalScore,tie=mine===rivalScore,xp=won?25:tie?15:10,accuracy=Math.round(mine/Math.max(1,duelQuestionCount())*100),kit=updateDuelTeacherStreak(),code=studyState.duelJoinCode||'';
      studyState.finished=true;studyState.finishingDuel=false;bumpProgress('duel',xp);if(uid())awardXp(xp);clearResume();
      stopDuelChatIngest();
      var podium = top.length
        ? '<ol class="duel-podium">' + top.map(function (player, index) {
            return '<li class="place-' + (index + 1) + '"><b>' + (index + 1) + '</b><span>' + esc(player.display_name || 'Student') +
              '</span><em>' + Number(player.score || 0) + '</em><small>+' + playerDuelXp(player, index) + ' XP</small></li>';
          }).join('') + '</ol>'
        : '';
      var headline = winner
        ? esc(winner.display_name || 'Student') + ' ' + esc(tr('wins!','побеждает!'))
        : esc(won?tr('Victory!','Победа!'):tie?tr('A draw!','Ничья!'):tr('Great fight!','Отличная борьба!'));
      var joinUrl = duelJoinUrl(code);
      var joinRef = (ctx.profile && (ctx.profile.username || ctx.profile.id)) || '';
      var joinDeepUrl = joinUrl + (joinUrl.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(joinRef) + '&bonus=50xp';
      var joinQrUrl = duelQrSrc(joinDeepUrl);
      var teacherHandle = esc(String((ctx.profile && (ctx.profile.full_name || ctx.profile.username)) || 'Duvela teacher'));
      $('#studyToolBody').innerHTML='<div class="duel-result '+(won?'win':tie?'tie':'lose')+'" id="duelResultCard"><span>'+(winner?'🏆':(won?'🏆':tie?'🤝':'💪'))+'</span><small>DUVELA DUEL · '+esc(duelModeLabel(studyState.duelMode))+'</small><h2>'+headline+'</h2><p>'+esc(tr('Speed bonus is in. Top 8 below — next duel in 30s.','Скоростной бонус учтён. Топ-8 ниже — следующая дуэль через 30 с.'))+'</p><div class="duel-final-score"><b>'+mine+'</b><span>:</span><b>'+rivalScore+'</b></div>'+podium+'<div class="duel-result-stats"><span><b>'+accuracy+'%</b><small>'+esc(tr('accuracy','точность'))+'</small></span><span><b>'+esc(String(kit.streak||1))+'</b><small>'+esc(tr('day streak','дней серия'))+'</small></span><span><b>+'+xp+'</b><small>XP</small></span></div><div class="duel-join-cta" id="duelJoinCta"><img class="duel-join-qr" alt="Join Duvela" width="120" height="120" src="'+esc(joinQrUrl)+'"><div class="duel-join-cta-copy"><small>'+esc(tr('CLAIM +50 XP · FOLLOW '+String(ctx.profile && ctx.profile.full_name ? ctx.profile.full_name.toUpperCase() : 'YOUR TEACHER'),'ЗАБЕРИ +50 XP · ПОДПИШИСЬ НА '+String(ctx.profile && ctx.profile.full_name ? ctx.profile.full_name.toUpperCase() : 'УЧИТЕЛЯ')))+'</small><b>'+esc(tr('Scan or open in Duvela','Отсканируй или открой в Duvela'))+'</b><span>'+esc(joinDeepUrl.replace(/^https?:\/\//,''))+'</span><em>'+teacherHandle+'</em></div></div><div class="duel-next-countdown"><small>'+esc(tr('NEXT DUEL','СЛЕДУЮЩАЯ ДУЭЛЬ'))+'</small><b id="duelNextTimer">00:30</b></div><div class="result-actions"><button class="btn" id="duelShareCard">'+esc(tr('Save winner card','Сохранить карточку'))+'</button><button class="btn" id="duelReview">'+esc(tr('Review mistakes','Повторить ошибки'))+'</button><button class="btn primary" id="duelAgain">'+esc(tr('New duel','Новая дуэль'))+' · 30</button></div></div>';
      if(studyState.liveMode){$('#studyToolBody').insertAdjacentHTML('afterbegin','<div class="duel-live-toolbar"><button type="button" id="duelLiveToggle" aria-pressed="true"><span aria-hidden="true">&times;</span>'+esc(tr('Exit LIVE','\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 LIVE'))+'</button></div>');bindDuelLiveControls($('#studyToolBody'));}
      if(window.DuvelaDuelFx){window.DuvelaDuelFx.confetti($('#studyToolBody'));window.DuvelaDuelFx.playRevealSound(true);}
      $('#duelReview').onclick=function(){stopNextDuelCountdown();openStudyTool('mistakes');};
      var share=$('#duelShareCard');
      if(share) share.onclick=function(){downloadDuelShareCard(top, code, winner ? String(winner.display_name || 'Winner') + ' wins' : 'Duel result');};
      var again=$('#duelAgain'), left=30;
      if(again) again.onclick=function(){stopNextDuelCountdown();openStudyTool('duel');};
      studyState.nextDuelLeft=left;
      var timerEl = document.getElementById('duelNextTimer');
      function paintNextTimer(remaining){
        var mm = String(Math.max(0, Math.floor(remaining / 60))).padStart(2, '0');
        var ss = String(Math.max(0, remaining % 60)).padStart(2, '0');
        if (timerEl) timerEl.textContent = mm + ':' + ss;
      }
      paintNextTimer(left);
      studyState.nextDuelTimer=setInterval(function(){
        if(!studyState){return;}
        left-=1;studyState.nextDuelLeft=left;
        paintNextTimer(Math.max(0, left));
        if(again) again.textContent=tr('New duel','Новая дуэль')+' · '+Math.max(0,left);
        if(left<=0){stopNextDuelCountdown();openStudyTool('duel');}
      },1000);
    }

    // ---- 10. Mistake center: same local-first spaced-review record as Academy Hub. ----
    function mistakeIntervalDays(item) { return [1,3,7,14][Math.min(3,Math.max(0,Number(item && item.reviewStep || 0)))] || 1; }
    function mistakeDueLabel(item) { var due=Number(item && item.dueAt || 0),now=Date.now();if(!due||due<=now)return tr('Due now','Повторить сейчас');var days=Math.max(1,Math.ceil((due-now)/86400000));return tr('In '+days+' day'+(days===1?'':'s'),'Через '+days+' '+(days===1?'день':'дня')); }
    function mistakeDate(value) { return value ? new Date(Number(value)).toLocaleDateString(ctx.isRu?'ru-RU':'en-GB') : '—'; }
    function mistakeExplanation(item) { return item.explanation || tr('No explanation was recorded for this earlier attempt.','Для этой ранней попытки объяснение не было сохранено.'); }
    function mistakeCorrectIndex(item) {
      return resolveExerciseAnswer(item).index;
    }
    function mistakeCorrectAnswer(item) {
      var resolved=resolveExerciseAnswer(item),answer=resolved.value;
      if (!resolved.valid) return tr('Correct answer was not recorded for this older item.','Правильный ответ не был сохранён для этой старой записи.');
      return (mistakeTopic(item).id==='articles'?answer+' '+item.prompt:answer);
    }
    function reviewDiagnostic(item, resolved) {
      console.warn('duvela.mistake-review.unavailable',{questionId:item&&item.questionId||null,source:item&&(item.sourceTool||item.kind)||null,reason:resolved&&resolved.reason||'unknown'});
    }
    function reviewIntervalLabel(days) { return tr(days+' day'+(days===1?'':'s'),days+' '+(days===1?'день':days<5?'дня':'дней')); }
    function renderMistakes() {
      var host=$('#studyToolBody'),all=loadMistakes(),now=Date.now(),due=all.filter(function(item){return !item.dueAt||Number(item.dueAt)<=now;}),later=all.filter(function(item){return item.dueAt&&Number(item.dueAt)>now;}),topics=weakTopics();
      if(!studyState.mistakePhase){
        var filter=studyState.mistakeFilter||'all', topicFilter=studyState.mistakeTopicFilter||'',langFilter=studyState.mistakeLangFilter||'',levelFilter=studyState.mistakeLevelFilter||'';
        var shown=all.filter(function(item){var topic=mistakeTopic(item),isDue=!item.dueAt||Number(item.dueAt)<=now,reviewed=(item.history||[]).some(function(h){return h.outcome==='correct';});return (filter==='all'||filter==='due'&&isDue||filter==='scheduled'&&!isDue||filter==='reviewed'&&reviewed)&&(!topicFilter||topic.id===topicFilter)&&(!langFilter||item.lang===langFilter)&&(!levelFilter||item.level===levelFilter);}).sort(function(a,b){return Number(a.dueAt||0)-Number(b.dueAt||0);});
        var filterButton=function(id,label,count){return '<button type="button" class="'+(filter===id?'active':'')+'" data-mistake-filter="'+id+'">'+esc(label)+(count===undefined?'':' <b>'+count+'</b>')+'</button>';};
        var optionList=function(values,selected,empty){return '<option value="">'+esc(empty)+'</option>'+values.map(function(value){return '<option value="'+esc(value)+'"'+(value===selected?' selected':'')+'>'+esc(value)+'</option>';}).join('');};
        var rows=shown.map(function(item){var topic=mistakeTopic(item),key=mistakeKey(item),open=studyState.mistakeExpandedKey===key,wrong=item.selectedAnswer===undefined||item.selectedAnswer===null?tr('Not recorded for this earlier attempt','Не записан для этой ранней попытки'):item.selectedAnswer;return '<article class="mistake-entry '+(open?'open':'')+'"><button type="button" class="mistake-entry-head" data-mistake-expand="'+esc(key)+'"><span><b>'+esc(topic.label)+'</b><small>'+esc((item.sourceTool||item.kind||'mcq')+' · '+String(item.lang||'').toUpperCase()+(item.level?' · '+item.level:''))+'</small><strong>'+esc(item.prompt)+'</strong></span><em>'+esc(mistakeDueLabel(item))+' · '+esc(tr('Step ','Шаг '))+(Number(item.reviewStep||0)+1)+'/4</em></button>'+(open?'<div class="mistake-entry-detail"><dl><div><dt>'+esc(tr('Question ID','ID вопроса'))+'</dt><dd>'+esc(item.questionId||tr('Not recorded','Не записан'))+'</dd></div><div><dt>'+esc(tr('Your answer','Ваш ответ'))+'</dt><dd>'+esc(wrong)+'</dd></div><div><dt>'+esc(tr('Correct answer','Правильный ответ'))+'</dt><dd>'+esc(mistakeCorrectAnswer(item))+'</dd></div><div><dt>'+esc(tr('Incorrect attempts','Неверных попыток'))+'</dt><dd>'+Number(item.attemptsIncorrect||1)+'</dd></div><div><dt>'+esc(tr('Last attempt','Последняя попытка'))+'</dt><dd>'+esc(mistakeDate(item.lastAttemptAt||item.at))+'</dd></div><div><dt>'+esc(tr('Next review','Следующее повторение'))+'</dt><dd>'+esc(mistakeDueLabel(item))+'</dd></div></dl><p><b>'+esc(tr('Explanation','Объяснение'))+':</b> '+esc(mistakeExplanation(item))+'</p><div class="mistake-entry-actions"><button type="button" data-mistake-retry="'+esc(key)+'">'+esc(tr('Retry exact question','Повторить это задание'))+'</button>'+(topic.tool?'<button type="button" data-mistake-topic="'+esc(topic.tool)+'">'+esc(tr('Open learning topic','Открыть тему'))+'</button>':'')+'</div></div>':'')+'</article>';}).join('');
        host.innerHTML='<section class="mistake-center"><header><div><small>DUVELA · REVIEW</small><h2>'+esc(tr('Mistake Center','Центр ошибок'))+'</h2><p>'+esc(tr('Review the exact tasks you missed. Correct answers advance the 1 · 3 · 7 · 14 day schedule.','Повторяйте именно те задания, где была ошибка. Верные ответы продвигают по графику 1 · 3 · 7 · 14 дней.'))+'</p></div><span>'+due.length+' '+esc(tr('due','на сегодня'))+'</span></header><div class="mistake-stats"><article><b>'+due.length+'</b><small>'+esc(tr('Due now','Повторить сейчас'))+'</small></article><article><b>'+later.length+'</b><small>'+esc(tr('Scheduled','Запланировано'))+'</small></article><article><b>'+topics.length+'</b><small>'+esc(tr('Topics','Темы'))+'</small></article></div>'+(all.length?'<section class="mistake-queue"><div><h3>'+esc(tr('Review due mistakes','Повторить ошибки на сегодня'))+'</h3><p>'+esc(tr('The session contains only actual due records and gives XP only for checked correct answers.','Сессия содержит только реальные задания на сегодня; XP начисляется лишь за проверенные верные ответы.'))+'</p></div><button type="button" class="mistake-start" data-mistake-start="due"'+(due.length?'':' disabled')+'>'+esc(tr('Review '+due.length+' now','Повторить сейчас: '+due.length))+' →</button></section><div class="mistake-validation" aria-live="polite">'+(studyState.mistakeValidationError?esc(studyState.mistakeValidationError):'')+'</div><nav class="mistake-filters">'+filterButton('all',tr('All','Все'),all.length)+filterButton('due',tr('Due now','На сегодня'),due.length)+filterButton('scheduled',tr('Scheduled','Запланировано'),later.length)+filterButton('reviewed',tr('Reviewed','Повторенные'))+'<select data-mistake-topic-filter>'+optionList(topics.map(function(t){return t.id;}),topicFilter,tr('All topics','Все темы'))+'</select><select data-mistake-lang-filter>'+optionList(Array.from(new Set(all.map(function(m){return m.lang;}))),langFilter,tr('All languages','Все языки'))+'</select><select data-mistake-level-filter>'+optionList(Array.from(new Set(all.map(function(m){return m.level;}).filter(Boolean))),levelFilter,tr('All levels','Все уровни'))+'</select></nav><section class="mistake-library">'+(rows||'<p class="mistake-empty-filter">'+esc(tr('No mistakes match these filters.','Нет ошибок по выбранным фильтрам.'))+'</p>')+'</section>':'<section class="mistake-empty"><b>✓</b><h3>'+esc(tr('No recorded mistakes','Нет сохранённых ошибок'))+'</h3><p>'+esc(tr('When an answer is incorrect in a supported practice, it will appear here for spaced review.','Когда в поддерживаемой практике будет ошибка, она появится здесь для интервального повторения.'))+'</p></section>')+'</section>';
        Array.prototype.forEach.call(host.querySelectorAll('[data-mistake-filter]'),function(button){button.onclick=function(){studyState.mistakeFilter=button.getAttribute('data-mistake-filter');renderMistakes();};});
        Array.prototype.forEach.call(host.querySelectorAll('[data-mistake-expand]'),function(button){button.onclick=function(){var key=button.getAttribute('data-mistake-expand');studyState.mistakeExpandedKey=studyState.mistakeExpandedKey===key?'':key;renderMistakes();};});
        [['[data-mistake-topic-filter]','mistakeTopicFilter'],['[data-mistake-lang-filter]','mistakeLangFilter'],['[data-mistake-level-filter]','mistakeLevelFilter']].forEach(function(pair){var select=host.querySelector(pair[0]);if(select)select.onchange=function(){studyState[pair[1]]=select.value;renderMistakes();};});
        var start=host.querySelector('[data-mistake-start]');if(start)start.onclick=function(){if(!due.length)return;var candidates=due.slice(0,20),valid=candidates.filter(function(item){var resolved=resolveExerciseAnswer(item);if(!resolved.valid)reviewDiagnostic(item,resolved);return resolved.valid;}),invalid=candidates.length-valid.length;studyState.mistakeValidationError=invalid?tr(invalid+' question could not be validated and was skipped. Its review date was not changed.',invalid+' вопрос(а) не прошли проверку и пропущены. Дата повторения не изменена.'):'';if(!valid.length){renderMistakes();return;}studyState.mistakePhase='review';studyState.data=shuffle(valid);studyState.mistakeSkipped=invalid;studyState.idx=0;studyState.score=0;studyState.mistakeSelected=null;studyState.mistakeChecked=false;renderMistakes();};
        Array.prototype.forEach.call(host.querySelectorAll('[data-mistake-retry]'),function(button){button.onclick=function(){var key=button.getAttribute('data-mistake-retry'),item=all.find(function(m){return mistakeKey(m)===key;}),resolved=resolveExerciseAnswer(item);if(!item||!resolved.valid){if(item)reviewDiagnostic(item,resolved);studyState.mistakeValidationError=tr('This saved question cannot be validated yet. It was not scheduled or rewarded.','Эту сохранённую задачу пока нельзя проверить. Расписание и награда не изменены.');renderMistakes();return;}studyState.mistakePhase='review';studyState.data=[item];studyState.idx=0;studyState.score=0;studyState.mistakeSelected=null;studyState.mistakeChecked=false;renderMistakes();};});
        Array.prototype.forEach.call(host.querySelectorAll('[data-mistake-topic]'),function(button){button.onclick=function(){openStudyTool(button.getAttribute('data-mistake-topic'));};});return;
      }
      var deck=studyState.data||[];
      if(!deck.length){studyState.mistakePhase=null;return renderMistakes();}
      if(studyState.idx>=deck.length)return finishTool(studyState.score+' / '+deck.length,studyState.score*2);
      var item=deck[studyState.idx],correctIndex=mistakeCorrectIndex(item),selected=Number.isInteger(studyState.mistakeSelected)?studyState.mistakeSelected:null,checked=!!studyState.mistakeChecked,ok=checked&&selected===correctIndex,topic=mistakeTopic(item);
      var nextInterval=mistakeIntervalDays({reviewStep:ok?Math.min(3,Number(item.reviewStep||0)+1):0});
      var feedbackHtml=checked?'<section class="mistake-feedback '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('Correct — moved to the next review step.','Верно — задание перенесено на следующий шаг повторения.'):tr('Correct answer: ','Правильный ответ: ')+mistakeCorrectAnswer(item))+'</b>'+(!ok?'<p>'+esc(tr('Your answer: ','Ваш ответ: '))+esc((item.opts||[])[selected]||'—')+'</p>':'')+'<p>'+esc(mistakeExplanation(item))+'</p><p>'+esc(tr('Topic: ','Тема: '))+esc(topic.label)+' · '+esc(tr('Next review: ','Следующее повторение: '))+esc(reviewIntervalLabel(nextInterval))+'</p></section>':'';
      host.innerHTML='<section class="mistake-review"><header><button type="button" data-mistake-back>← '+esc(tr('All mistakes','Все ошибки'))+'</button><span>'+esc(tr('Review ','Повторение '))+(studyState.idx+1)+' / '+deck.length+'</span></header><i aria-hidden="true"><em style="width:'+Math.round((studyState.idx+1)/deck.length*100)+'%"></em></i><main><small>'+esc(topic.label.toUpperCase())+'</small><h2>'+esc(item.prompt)+'</h2>'+(item.audioClip||item.audioText?'<button type="button" class="mistake-listen" data-mistake-listen>🔊 '+esc(tr('Listen','Прослушать'))+'</button>':'')+'<div class="mistake-options">'+(item.opts||[]).map(function(opt,index){var state=checked?(index===correctIndex?'correct':index===selected?'wrong':''):selected===index?'selected':'';return '<button type="button" class="'+state+'" data-mistake-option="'+index+'"'+(checked?' disabled':'')+'>'+esc(opt)+'</button>';}).join('')+'</div>'+feedbackHtml+'<footer>'+(checked?'<button type="button" class="mistake-next" data-mistake-next>'+esc(tr('Continue','Продолжить'))+' →</button>':'<button type="button" class="mistake-check" data-mistake-check'+(selected===null||correctIndex<0?' disabled':'')+'>'+esc(tr('Check answer','Проверить ответ'))+'</button>')+'</footer></main></section>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-mistake-option]'),function(button){button.onclick=function(){studyState.mistakeSelected=Number(button.getAttribute('data-mistake-option'));renderMistakes();};});
      var listen=host.querySelector('[data-mistake-listen]');if(listen)listen.onclick=function(){playMistakeAudio(item,listen);};
      var check=host.querySelector('[data-mistake-check]');if(check)check.onclick=function(){if(studyState.mistakeChecked||correctIndex<0)return;var chosen=studyState.mistakeSelected;studyState.mistakeChecked=true;var correct=chosen===correctIndex;feedback(correct,{prompt:item.prompt,chosen:item.opts[chosen],correct:mistakeCorrectAnswer(item)});if(correct){studyState.score++;clearMistake(item.lang,item.questionId||item.prompt);}else logMistake(item.lang,item.prompt,item.opts,correctIndex,item.kind,{sourceTool:item.sourceTool||item.kind,questionId:item.questionId,level:item.level,explanation:item.explanation,selectedAnswer:item.opts[chosen],audioClip:item.audioClip,audioText:item.audioText});syncPracticeData();renderMistakes();};
      var next=host.querySelector('[data-mistake-next]');if(next)next.onclick=function(){studyState.idx++;studyState.mistakeSelected=null;studyState.mistakeChecked=false;renderMistakes();};
      var back=host.querySelector('[data-mistake-back]');if(back)back.onclick=function(){studyState.mistakePhase=null;studyState.data=null;studyState.idx=0;renderMistakes();};
    }

    // ---- 11. Essentials (short lesson cards) ----
    function renderEssentials() {
      if (!studyState.data) studyState.data = ESSENTIALS[studyState.lang] || ESSENTIALS.de;
      var deck = studyState.data;
      if (studyState.idx >= deck.length) return finishTool(tr('All lessons reviewed', 'Все уроки пройдены'), deck.length * 2);
      var lesson = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--panel-soft)">' +
          '<h3 style="margin:0 0 10px">' + esc(lesson.title) + '</h3>' +
          '<ul style="margin:0;padding-left:18px;line-height:1.7">' +
            lesson.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
          '</ul>' +
        '</div>' +
        '<button class="btn primary" id="essNext" style="width:100%;margin-top:14px">' + esc(tr('Got it, next', 'Понятно, дальше')) + '</button>';
      $('#essNext').addEventListener('click', function () { studyState.idx++; renderEssentials(); });
    }

    // ---- 12. AI practice coach (real LLM via Supabase edge function) ----
    const AI_TOPIC_PRESETS = {
      de: ['Small talk', 'Im Restaurant', 'Beim Arzt', 'Im Büro'],
      en: ['Small talk', 'At a restaurant', 'At the doctor', 'At work'],
      es: ['Charla informal', 'En el restaurante', 'En el médico', 'En el trabajo']
    };

    // AI conversation partners. Sofia is a wide banner photo (crop:'banner' → right
    // portrait half); GRAMMI/NOVA/LINA are the DUVI-friends robot mascots (full-body
    // transparent PNGs, crop:'head' → circle frames the head).
    const AI_PARTNERS = [
      { id: 'sofia', name: 'Sofia', role: 'conversation', voiceId: '1a349d6ebed24d27a97c58318ec75df1', crop: 'banner', accent: '#6D3FE0', avatar: 'https://c.animaapp.com/Do027YtQ/img/chatgpt-image-1-----2026-----11-29-31-1@2x.png', tagline: { en: 'Free conversation — chat naturally about any topic', ru: 'Свободный разговор — беседа на любые темы' } },
      { id: 'elsa', name: 'ELSA', role: 'exam', voiceId: '', crop: 'head', accent: '#A231C9', avatar: './web/assets/duvi/friends/elsa.png?v=3', tagline: { en: 'Exam practice — Goethe, telc, ÖSD and DTZ', ru: 'Экзаменационная практика — Goethe, telc, ÖSD и DTZ' } },
      { id: 'grammi', name: 'GRAMMI', role: 'grammar', voiceId: '012bc4b9caf1483fa31531c57ef1adbe', crop: 'head', accent: '#2F6BEE', avatar: './web/assets/duvi/friends/grami.png?v=3', tagline: { en: 'Grammar — rules, mistakes and quick fixes', ru: 'Грамматика — правила, ошибки и разбор' } },
      { id: 'nova', name: 'NOVA', role: 'pronunciation', voiceId: 'ce6481245d7b481fa9a76df0e4cbb10a', crop: 'head', accent: '#14B8C4', avatar: './web/assets/duvi/friends/nova.png?v=3', tagline: { en: 'Pronunciation — repeat after me and sound natural', ru: 'Произношение — повторяй за мной и звучи естественно' } },
      { id: 'lina', name: 'LINA', role: 'roleplay', voiceId: 'c103d063793d4262910d6f4b9775f8c3', crop: 'head', accent: '#E5484D', avatar: './web/assets/duvi/friends/lina.png?v=3', tagline: { en: 'Role-play scenarios — restaurant, doctor, interview', ru: 'Ролевые сценарии — ресторан, врач, интервью' } }
    ];

    // Fish Audio model supplied for STELLA. The browser sends only this public model
    // identifier to the authenticated edge function; provider credentials stay server-side.
    AI_PARTNERS.push({ id: 'stella', name: 'STELLA', role: 'sentences', voiceId: '4ea79f17c4e74074b5b95556aaf1587e', crop: 'head', accent: '#7B47E6', avatar: './web/assets/duvi/friends/stella-avatar.jpg?v=1', tagline: { en: 'A word card — you build a sentence, I score it', ru: 'Карточка со словом — ты составляешь предложение, я оцениваю' } });

    // Persian learners get only GRAMMI and NOVA, with their Persian voices; STELLA has
    // word banks for German, English and Spanish.
    function aiPartnersForLang(lang) {
      if (lang === 'fa') {
        var persianVoices = { grammi: 'fe5c93fde6f44d65a05aedea38b88837', nova: 'e29dfaf012b9453c9a8d781f8f6696c3' };
        return AI_PARTNERS.filter(function (bot) { return persianVoices[bot.id]; })
          .map(function (bot) { return Object.assign({}, bot, { voiceId: persianVoices[bot.id] }); });
      }
      return AI_PARTNERS.filter(function (bot) { return bot.id !== 'stella' || ['de', 'en', 'es'].indexOf(lang) >= 0; });
    }

    function renderStellaPractice() {
      var lang = aiChatState.lang && ['de', 'en', 'es'].indexOf(aiChatState.lang) >= 0 ? aiChatState.lang : 'de';
      window.DuvelaPracticeExtras.renderStella($('#studyToolBody'), {
        esc: esc,
        tr: tr,
        isRu: !!ctx.isRu,
        lang: lang,
        level: currentPracticeLevel(lang),
        locale: SPEECH_LOCALE[lang] || 'de-DE',
        nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US',
        supa: supa,
        avatarHtml: function () { return aiAvatarHtml(aiChatState.partner, 'sm', false); },
        speak: function (text) { speakAi(text); },
        isSaved: function (word) { return isWordSaved(lang, word); },
        saveWord: function (word, translation) {
          if (isWordSaved(lang, word)) return;
          toggleSavedWord(lang, word, translation);
          syncPracticeData();
        },
        awardXp: function () {},
        onEnd: function (results) {
          stopAiVoice();
          var good = results.filter(function (item) { return item.score >= 70; }).length;
          aiChatState = null;
          studyState.score = good;
          studyState.data = new Array(Math.max(1, results.length));
          finishTool(tr('Sentences with STELLA', 'Предложения со STELLA') + ': ' + good + ' / ' + results.length, Math.min(30, good * 5));
        }
      });
    }

    function aiRoleMeta(role) {
      switch (role) {
        case 'exam': return { label: tr('Exam practice', 'Подготовка к экзамену'), instruction: 'Run structured exam practice with clear timing, criteria and feedback.' };
        case 'sentences': return { label: tr('Sentences', 'Предложения'), instruction: '' };
        case 'grammar': return { label: tr('Grammar', 'Грамматика'), instruction: 'Act as a GRAMMAR coach. Focus on grammar: give short targeted exercises, correct the learner\'s grammar (word order, cases, articles, verb forms) and briefly explain the rule. One step at a time.' };
        case 'pronunciation': return { label: tr('Pronunciation', 'Произношение'), instruction: 'Run a PRONUNCIATION drill. Give ONE short, simple sentence at a time to read aloud, then brief friendly pronunciation feedback and the next short sentence.' };
        case 'roleplay': return { label: tr('Role-play', 'Ролевая игра'), instruction: 'Run a ROLE-PLAY. Pick a realistic everyday scenario (restaurant, doctor, shopping, job interview, etc.) and play the other person. Stay in the scene, keep it interactive, one exchange at a time.' };
        default: return { label: tr('Conversation', 'Разговор'), instruction: 'Have a natural, free CONVERSATION. Ask questions, react to answers, and keep the chat flowing on everyday and interesting topics.' };
      }
    }

    function aiAvatarHtml(partner, size, withDot) {
      if (!partner) return '';
      var crop = partner.crop === 'banner' ? ' crop-banner' : '';
      var style = partner.accent ? ' style="background:' + partner.accent + '1f;border-color:' + partner.accent + '55"' : '';
      return '<span class="ai-partner-avatar sz-' + size + crop + '"' + style + '><img src="' + esc(partner.avatar) + '" alt="">' +
        (withDot ? '<i class="ai-partner-online"></i>' : '') + '</span>';
    }

    var aiVoiceAudio = null;
    var aiVoiceStream = null;
    var aiVoiceContext = null;
    var aiVoiceAnalyser = null;
    var aiVoiceAnimation = 0;
    var aiVoiceRecognition = null;

    function aiVoiceConversationSupported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && aiVoiceInputSupported());
    }
    function updateAiVoiceMeter() {
      if (!aiVoiceAnalyser) return;
      var data = new Uint8Array(aiVoiceAnalyser.fftSize);
      var tick = function () {
        if (!aiVoiceAnalyser) return;
        aiVoiceAnalyser.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i += 1) sum += Math.abs(data[i] - 128);
        var level = Math.min(1, sum / data.length / 24);
        var bars = document.querySelectorAll('#aiVoiceWave i');
        Array.prototype.forEach.call(bars, function (bar, index) {
          var variance = [0.62, 1, 0.76, 0.9, 0.58][index] || 0.7;
          bar.style.transform = 'scaleY(' + (0.18 + level * variance * 1.9) + ')';
        });
        aiVoiceAnimation = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(aiVoiceAnimation);
      tick();
    }
    function setAiVoiceStatus(status) {
      if (!aiChatState) return;
      aiChatState.voiceStatus = status;
      var statusEl = document.getElementById('aiVoiceStatus');
      if (statusEl) statusEl.textContent = status === 'listening' ? tr('Listening…', 'Слушаю…') : status === 'thinking' ? tr('Thinking…', 'Думаю…') : status === 'speaking' ? tr('Speaking…', 'Говорю…') : status === 'muted' ? tr('Microphone muted', 'Микрофон выключен') : tr('Voice ready', 'Голос готов');
    }
    function stopAiRecognition() {
      if (!aiVoiceRecognition) return;
      try { aiVoiceRecognition.onend = null; aiVoiceRecognition.abort(); } catch (e) {}
      aiVoiceRecognition = null;
    }
    function stopAiVoiceConversation() {
      stopAiRecognition();
      cancelAnimationFrame(aiVoiceAnimation);
      aiVoiceAnimation = 0;
      if (aiVoiceStream) { aiVoiceStream.getTracks().forEach(function (track) { track.stop(); }); aiVoiceStream = null; }
      if (aiVoiceContext) { try { aiVoiceContext.close(); } catch (e) {} aiVoiceContext = null; }
      aiVoiceAnalyser = null;
      if (aiChatState) { aiChatState.voiceConversation = false; aiChatState.micMuted = false; }
    }
    function stopAiVoice() {
      if (aiVoiceAudio) { try { aiVoiceAudio.pause(); } catch (e) {} aiVoiceAudio = null; }
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    }
    function speakAiBrowser(text, onEnd) {
      try {
        if (!window.speechSynthesis || !text) { if (onEnd) onEnd(); return; }
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = SPEECH_LOCALE[aiChatState.lang] || 'de-DE';
        utterance.rate = 0.95;
        utterance.onend = utterance.onerror = function () { if (onEnd) onEnd(); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (e) { if (onEnd) onEnd(); }
    }
    // Fish Audio stays server-side: the browser receives only an authenticated audio response.
    async function speakAi(text) {
      var clean = String(text || '').replace(/^✏️\s*/, '').trim();
      if (!clean) return;
      stopAiVoice();
      var partner = aiChatState && aiChatState.partner;
      var resume = function () {
        if (aiChatState && aiChatState.voiceConversation && !aiChatState.micMuted) beginAiRecognition();
      };
      if (aiChatState && aiChatState.voiceConversation && aiChatState.speaker) setAiVoiceStatus('speaking');
      if (!aiChatState || !aiChatState.speaker) { resume(); return; }
      try {
        var blob = await fetchFishAudioBlob({ action: 'speak', text: clean.slice(0, 1000), voiceId: partner && partner.voiceId ? partner.voiceId : '' });
        var url = URL.createObjectURL(blob);
        aiVoiceAudio = new Audio(url);
        aiVoiceAudio.onended = aiVoiceAudio.onerror = function () { URL.revokeObjectURL(url); if (aiVoiceAudio) aiVoiceAudio = null; resume(); };
        await aiVoiceAudio.play();
      } catch (e) {
        speakAiBrowser(clean, resume);
      }
    }
    function beginAiRecognition() {
      if (!aiChatState || !aiChatState.voiceConversation || aiChatState.micMuted || aiChatState.busy || !aiVoiceStream) return;
      var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) { aiChatState.error = tr('Speech recognition is unavailable in this browser. You can continue in text chat.', 'Распознавание речи недоступно в этом браузере. Можно продолжить в текстовом чате.'); renderAiPractice(); return; }
      stopAiRecognition();
      var recognition = new Recognition();
      aiVoiceRecognition = recognition;
      recognition.lang = SPEECH_LOCALE[aiChatState.lang] || 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = false;
      var finalText = '';
      recognition.onstart = function () { setAiVoiceStatus('listening'); };
      recognition.onresult = function (event) {
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i += 1) {
          var phrase = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += phrase + ' ';
          else interim += phrase;
        }
        var input = document.getElementById('aiInput');
        if (input) input.value = (finalText || interim).trim();
        if (finalText.trim()) { try { recognition.stop(); } catch (e) {} }
      };
      recognition.onerror = function (event) {
        if (!aiChatState) return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') aiChatState.error = tr('Microphone permission was denied. You can continue in text chat.', 'Доступ к микрофону отклонён. Можно продолжить в текстовом чате.');
        else if (event.error !== 'aborted' && event.error !== 'no-speech') aiChatState.error = tr('Voice input stopped. Try the microphone again or use text chat.', 'Голосовой ввод остановлен. Повторите попытку или используйте текстовый чат.');
      };
      recognition.onend = function () {
        if (aiVoiceRecognition === recognition) aiVoiceRecognition = null;
        var text = finalText.trim();
        if (text && aiChatState && aiChatState.voiceConversation && !aiChatState.busy) { setAiVoiceStatus('thinking'); sendAiTurn(text); }
        else if (aiChatState && aiChatState.voiceConversation && !aiChatState.micMuted && !aiChatState.busy) setAiVoiceStatus('ready');
      };
      try { recognition.start(); } catch (e) { aiChatState.error = tr('Voice input could not start. Use text chat instead.', 'Не удалось запустить голосовой ввод. Используйте текстовый чат.'); renderAiPractice(); }
    }
    async function startAiVoiceConversation() {
      if (!aiVoiceConversationSupported()) { aiChatState.error = tr('Voice conversation needs a microphone and speech recognition in a secure browser context. Use HTTPS or localhost, then try again.', 'Для голосового разговора нужны микрофон и распознавание речи в защищённом контексте браузера. Используйте HTTPS или localhost и повторите.'); renderAiPractice(); return false; }
      try {
        aiVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          aiVoiceContext = new AudioContext();
          if (aiVoiceContext.state === 'suspended') await aiVoiceContext.resume();
          aiVoiceAnalyser = aiVoiceContext.createAnalyser();
          aiVoiceAnalyser.fftSize = 128;
          aiVoiceContext.createMediaStreamSource(aiVoiceStream).connect(aiVoiceAnalyser);
          updateAiVoiceMeter();
        }
        aiChatState.voiceConversation = true;
        aiChatState.micMuted = false;
        aiChatState.voiceStatus = 'thinking';
        return true;
      } catch (e) {
        var denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        aiChatState.error = denied ? tr('Microphone permission was denied. You can continue in text chat.', 'Доступ к микрофону отклонён. Можно продолжить в текстовом чате.') : tr('No microphone is available. Check your device and try again.', 'Микрофон недоступен. Проверьте устройство и повторите.');
        stopAiVoiceConversation();
        renderAiPractice();
        return false;
      }
    }
    function toggleAiMute() {
      if (!aiChatState || !aiVoiceStream) return;
      aiChatState.micMuted = !aiChatState.micMuted;
      aiVoiceStream.getAudioTracks().forEach(function (track) { track.enabled = !aiChatState.micMuted; });
      if (aiChatState.micMuted) { stopAiRecognition(); setAiVoiceStatus('muted'); }
      else beginAiRecognition();
      renderAiPractice();
    }

    function aiChatBubble(role, text, partner, idx) {
      var mine = role === 'user';
      var bubble = '<div style="max-width:78%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;' +
        (mine
          ? 'background:var(--teal);color:#fff;border-bottom-right-radius:4px'
          : 'background:var(--panel-soft);border:1px solid var(--line);border-bottom-left-radius:4px') +
        '">' + esc(text) + '</div>';
      if (mine) return '<div style="display:flex;justify-content:flex-end;margin-bottom:8px">' + bubble + '</div>';
      var avatar = aiAvatarHtml(partner, 'sm', false);
      var say = '<button type="button" class="ai-bubble-say" data-say="' + idx + '" aria-label="Listen">🔊</button>';
      return '<div style="display:flex;gap:8px;align-items:flex-end;justify-content:flex-start;margin-bottom:8px">' + avatar + bubble + say + '</div>';
    }

    function aiVoiceInputSupported() {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    function aiDurationTurnTarget(duration) {
      return ({ 5: 4, 10: 8, 15: 12 })[Number(duration)] || 8;
    }

    function aiTopicOptions(lang, partner) {
      var base = (AI_TOPIC_PRESETS[lang] || AI_TOPIC_PRESETS.de || []).slice();
      if (partner && partner.role === 'grammar') base = [tr('Articles and cases', 'Артикли и падежи'), tr('Word order', 'Порядок слов'), tr('Verb forms', 'Формы глагола')];
      if (partner && partner.role === 'pronunciation') base = [tr('Everyday phrases', 'Повседневные фразы'), tr('Rhythm and stress', 'Ритм и ударение'), tr('Difficult sounds', 'Сложные звуки')];
      if (partner && partner.role === 'roleplay') base = [tr('At a restaurant', 'В ресторане'), tr('At the doctor', 'У врача'), tr('Job interview', 'Собеседование')];
      return base;
    }

    function renderAiSummary() {
      var state = aiChatState;
      var corrections = state.messages.filter(function (message) { return message.kind === 'correction'; }).map(function (message) { return message.text.replace(/^✏️\\s*/, ''); });
      var exchanges = state.messages.filter(function (message) { return message.role === 'user'; }).length;
      var host = $('#studyToolBody');
      host.innerHTML = '<section class="ai-session-summary"><small>'+esc(tr('SESSION SUMMARY','ИТОГ ЗАНЯТИЯ'))+'</small><h2>'+esc(state.partner.name)+' · '+esc(state.topic)+'</h2><div class="ai-summary-grid"><article><b>'+exchanges+'</b><span>'+esc(tr('Learner messages','Сообщений ученика'))+'</span></article><article><b>'+state.duration+' '+esc(tr('min','мин'))+'</b><span>'+esc(tr('Planned session','План занятия'))+'</span></article><article><b>'+corrections.length+'</b><span>'+esc(tr('Recorded corrections','Сохранённые исправления'))+'</span></article></div>'+(corrections.length?'<div class="ai-summary-corrections"><h3>'+esc(tr('Corrections from this session','Исправления из занятия'))+'</h3>'+corrections.slice(0,4).map(function (item) { return '<p>✏️ '+esc(item)+'</p>'; }).join('')+'</div>':'<p class="ai-summary-empty">'+esc(tr('No correction was recorded in this session.','В этой сессии исправлений пока нет.'))+'</p>')+'<div class="ai-summary-next"><b>'+esc(tr('Suggested next step','Следующий шаг'))+'</b><span>'+esc(state.partner.role==='grammar'?tr('Practise the same point in Grammar Academy.','Повторите эту тему в Grammar Academy.'):tr('Continue a focused practice from your Practice Hub.','Продолжите целевую практику в Practice Hub.'))+'</span></div><p class="ai-summary-note">'+esc(tr('XP is recorded only after the existing practice service confirms completion.','XP начисляется только после подтверждения завершения существующим сервисом практики.'))+'</p><div class="ai-summary-actions"><button type="button" class="btn" id="aiSummaryBack">'+esc(tr('Back to coaches','К выбору коуча'))+'</button><button type="button" class="btn primary" id="aiSummaryFinish">'+esc(tr('Finish session','Завершить занятие'))+'</button></div></section>';
      $('#aiSummaryBack').onclick = function () { stopAiVoice(); aiChatState = { started:false, screen:'coaches', lang:studyState.lang, topic:'', partner:null, mode:'text', duration:10, correction:'gentle', voice:true, speaker:true, voiceConversation:false, micMuted:false, voiceStatus:'ready', messages:[], conversationId:null, turns:0, busy:false, error:null, lastFailedText:null }; renderAiPractice(); };
      $('#aiSummaryFinish').onclick = function () { var xp=Math.min(30, state.turns * 5); studyState.score=state.turns; studyState.data=new Array(Math.max(1,state.turns)); aiChatState=null; finishTool(tr('AI coaching session complete','AI-занятие завершено'),xp); };
    }

    function renderAiPractice() {
      if (!aiChatState) {
        aiChatState = { started:false, screen:'coaches', lang:studyState.lang, topic:'', partner:null, mode:'text', duration:10, correction:'gentle', voice:true, speaker:true, voiceConversation:false, micMuted:false, voiceStatus:'ready', messages:[], conversationId:null, turns:0, busy:false, error:null, lastFailedText:null };
      }
      var host = $('#studyToolBody');
      var level = currentPracticeLevel(aiChatState.lang);

      if (aiChatState.screen === 'coaches') {
        var partners = aiPartnersForLang(aiChatState.lang);
        host.innerHTML = '<section class="ai-academy"><header class="ai-academy-head"><div><small>DUVELA / AI ACADEMY</small><h2>'+esc(tr('Practice with AI','Практика с AI'))+'</h2><p>'+esc(tr('Choose a coach for a focused language session.','Выберите коуча для целевого занятия языком.'))+'</p></div><span>'+esc((aiChatState.lang === 'de' ? 'German' : aiChatState.lang === 'en' ? 'English' : aiChatState.lang === 'es' ? 'Spanish' : 'Persian')+' · '+level)+'</span></header><div class="ai-learning-brief"><small>'+esc(tr('PERSONAL LEARNING','ПЕРСОНАЛЬНОЕ ОБУЧЕНИЕ'))+'</small><strong>'+esc(tr('Practice at your level with a clear goal.','Практикуйтесь на своём уровне с понятной целью.'))+'</strong><p>'+esc(tr('Choose a coach, configure the session, then begin.','Выберите коуча, настройте занятие и начните.'))+'</p></div><h3 class="ai-coach-title">'+esc(tr('Choose your AI coach','Выберите AI-коуча'))+'</h3><div class="ai-coach-grid">'+partners.map(function (bot) { var meta=aiRoleMeta(bot.role); return '<article class="ai-coach-card"><div class="ai-coach-avatar">'+aiAvatarHtml(bot,'xl',true)+'</div><div class="ai-coach-copy"><div><h3>'+esc(bot.name)+'</h3><span style="--coach-accent:'+esc(bot.accent)+'">'+esc(meta.label)+'</span></div><p>'+esc(tr(bot.tagline.en,bot.tagline.ru))+'</p><small>'+esc(bot.id==='elsa'?tr('Structured exam tasks','Структурированные экзаменационные задания'):bot.id==='sofia'?tr('Natural conversation','Естественный разговор'):tr('Focused practice','Целевая практика'))+'</small></div><button type="button" data-ai-coach="'+esc(bot.id)+'">'+esc(bot.id==='elsa'?tr('Prepare for exam','Готовиться к экзамену'):tr('Set up session','Настроить занятие'))+' →</button></article>'; }).join('')+'</div></section>';
        Array.prototype.forEach.call(host.querySelectorAll('[data-ai-coach]'), function (button) { button.onclick=function () { var bot=partners.find(function (item) { return item.id===button.getAttribute('data-ai-coach'); }) || null; if(!bot)return; aiChatState.partner=bot; if(bot.id==='elsa'){ closeStudy(); window.setTimeout(function(){ if(typeof window.DuvelaOpenElsaExam==='function')window.DuvelaOpenElsaExam(); else document.dispatchEvent(new CustomEvent('duvela-open-elsa-exam')); },0); return; } if(bot.id==='stella'){ aiChatState.started=true; renderStellaPractice(); return; } var topics=aiTopicOptions(aiChatState.lang,bot); aiChatState.topic=topics[0]||tr('Everyday conversation','Повседневный разговор'); aiChatState.screen='setup'; renderAiPractice(); }; });
        return;
      }

      if (aiChatState.screen === 'setup') {
        var options=aiTopicOptions(aiChatState.lang,aiChatState.partner);
        var supportsVoice=aiVoiceConversationSupported();
        host.innerHTML = '<section class="ai-session-setup"><header><button type="button" class="ai-back-coaches" id="aiBackCoaches">← '+esc(tr('Coaches','Коучи'))+'</button><div><small>'+esc(tr('SESSION SETUP','НАСТРОЙКА ЗАНЯТИЯ'))+'</small><h2>'+esc(aiChatState.partner.name)+'</h2></div><span>'+esc((aiChatState.lang==='de'?'German':aiChatState.lang==='en'?'English':aiChatState.lang==='es'?'Spanish':'Persian')+' · '+level)+'</span></header><label>'+esc(tr('Practice topic','Тема практики'))+'<select id="aiTopic">'+options.map(function (topic) { return '<option value="'+esc(topic)+'"'+(topic===aiChatState.topic?' selected':'')+'>'+esc(topic)+'</option>'; }).join('')+'</select></label><fieldset><legend>'+esc(tr('Session duration','Длительность занятия'))+'</legend><div class="ai-option-row">'+[5,10,15].map(function (minutes) { return '<button type="button" data-ai-duration="'+minutes+'" class="'+(Number(aiChatState.duration)===minutes?'active':'')+'">'+minutes+' '+esc(tr('min','мин'))+'</button>'; }).join('')+'</div></fieldset><fieldset><legend>'+esc(tr('Interaction mode','Формат общения'))+'</legend><div class="ai-option-row"><button type="button" data-ai-mode="text" class="'+(aiChatState.mode==='text'?'active':'')+'">'+esc(tr('Text chat','Текстовый чат'))+'</button>'+(supportsVoice?'<button type="button" data-ai-mode="voice" class="'+(aiChatState.mode==='voice'?'active':'')+'">'+esc(tr('Voice conversation','Голосовой разговор'))+'</button>':'')+'</div>'+(supportsVoice?'<small>'+esc(tr('Voice conversation uses your microphone, speech recognition and real coach playback. It needs HTTPS or localhost.','Голосовой разговор использует микрофон, распознавание речи и реальное воспроизведение коуча. Нужен HTTPS или localhost.'))+'</small>':'<small>'+esc(tr('Voice input is unavailable in this browser.','Голосовой ввод недоступен в этом браузере.'))+'</small>')+'</fieldset><fieldset><legend>'+esc(tr('Correction style','Стиль исправлений'))+'</legend><div class="ai-option-row">'+[['immediate',tr('Immediately','Сразу')],['gentle',tr('One key correction','Одно ключевое исправление')],['minimal',tr('Minimal','Минимально')]].map(function (entry) { return '<button type="button" data-ai-correction="'+entry[0]+'" class="'+(aiChatState.correction===entry[0]?'active':'')+'">'+esc(entry[1])+'</button>'; }).join('')+'</div></fieldset><button type="button" class="btn primary ai-start-session" id="aiStartSession">'+esc(tr('Start session','Начать занятие'))+' →</button></section>';
        $('#aiBackCoaches').onclick=function(){aiChatState.screen='coaches';renderAiPractice();};
        $('#aiTopic').onchange=function(){aiChatState.topic=this.value;};
        Array.prototype.forEach.call(host.querySelectorAll('[data-ai-duration]'),function(button){button.onclick=function(){aiChatState.duration=Number(button.getAttribute('data-ai-duration'));renderAiPractice();};});
        Array.prototype.forEach.call(host.querySelectorAll('[data-ai-mode]'),function(button){button.onclick=function(){aiChatState.mode=button.getAttribute('data-ai-mode');renderAiPractice();};});
        Array.prototype.forEach.call(host.querySelectorAll('[data-ai-correction]'),function(button){button.onclick=function(){aiChatState.correction=button.getAttribute('data-ai-correction');renderAiPractice();};});
        $('#aiStartSession').onclick=async function(){aiChatState.started=true;aiChatState.screen='chat';aiChatState.startedAt=Date.now();if(aiChatState.mode==='voice'&&!await startAiVoiceConversation()){aiChatState.started=false;aiChatState.screen='setup';return;}renderAiPractice();sendAiTurn('__start__');};
        return;
      }

      if (aiChatState.partner && aiChatState.partner.id === 'stella') return renderStellaPractice();
      var partnerRole=aiChatState.partner?aiChatState.partner.role:'conversation';
      var roleLabel=aiRoleMeta(partnerRole).label;
      var currentTurns=aiChatState.messages.filter(function(message){return message.role==='user';}).length;
      var targetTurns=aiDurationTurnTarget(aiChatState.duration);
      var voicePanel=aiChatState.voiceConversation?'<section class="ai-voice-console"><div class="ai-voice-avatar">'+aiAvatarHtml(aiChatState.partner,'xl',true)+'</div><div class="ai-voice-wave" id="aiVoiceWave" aria-label="'+esc(tr('Microphone activity','Активность микрофона'))+'"><i></i><i></i><i></i><i></i><i></i></div><b id="aiVoiceStatus">'+esc(aiChatState.voiceStatus==='thinking'?tr('Thinking…','Думаю…'):aiChatState.voiceStatus==='speaking'?tr('Speaking…','Говорю…'):aiChatState.voiceStatus==='muted'?tr('Microphone muted','Микрофон выключен'):tr('Listening…','Слушаю…'))+'</b><div class="ai-voice-actions"><button type="button" id="aiMute" aria-pressed="'+(aiChatState.micMuted?'true':'false')+'">'+(aiChatState.micMuted?'🎙✕ '+esc(tr('Unmute','Включить')):'🎙 '+esc(tr('Mute','Выключить')))+'</button><button type="button" id="aiSpeaker" aria-pressed="'+(aiChatState.speaker?'true':'false')+'">'+(aiChatState.speaker?'🔊':'🔇')+' '+esc(tr('Speaker','Динамик'))+'</button><button type="button" id="aiListenAgain">↻ '+esc(tr('Listen','Слушать'))+'</button></div></section>':'';
      host.innerHTML = '<section class="ai-chat-session"><header class="ai-chat-head">'+aiAvatarHtml(aiChatState.partner,'md',true)+'<div><b>'+esc(aiChatState.partner?aiChatState.partner.name:tr('AI tutor','ИИ-тренер'))+'</b><small>'+esc(roleLabel)+' · '+esc(aiChatState.topic)+'</small></div><span>'+currentTurns+' / '+targetTurns+'</span><button type="button" id="aiVoice" class="ai-voice-toggle'+(aiChatState.speaker?' on':'')+'" aria-label="'+esc(tr('Toggle coach voice','Включить или выключить голос коуча'))+'">'+(aiChatState.speaker?'🔊':'🔇')+'</button></header>'+voicePanel+'<div id="aiChatLog" class="ai-chat-log"></div>'+(aiChatState.error?'<div class="ai-chat-error"><span>'+esc(aiChatState.error)+'</span>'+(aiChatState.lastFailedText?'<button type="button" id="aiRetry">'+esc(tr('Retry','Повторить'))+'</button>':'')+'</div>':'')+'<div class="ai-chat-composer"><input id="aiInput" placeholder="'+esc(aiChatState.mode==='voice'?tr('Speak with the microphone or type your answer…','Говорите в микрофон или напишите ответ…'):tr('Type your answer…','Напишите ответ…'))+'" autocomplete="off" '+(aiChatState.busy?'disabled':'')+'>' + '<button class="btn ai-mic-launch" id="aiMic" type="button" aria-label="'+esc(tr('Start voice conversation','Начать голосовой разговор'))+'" title="'+esc(aiVoiceConversationSupported()?tr('Start voice conversation','Начать голосовой разговор'):tr('Voice conversation is unavailable in this browser','Голосовой разговор недоступен в этом браузере'))+'" '+(aiVoiceConversationSupported()?'':'disabled')+'>🎙</button>'+'<button class="btn primary" id="aiSend" '+(aiChatState.busy?'disabled':'')+'>'+esc(aiChatState.busy?tr('Coach is thinking…','Коуч думает…'):tr('Send','Отправить'))+'</button></div><button type="button" class="ai-end-session" id="aiEnd">'+esc(tr('End session','Завершить занятие'))+'</button></section>';
      var log=$('#aiChatLog');
      log.innerHTML=aiChatState.messages.map(function(message,index){return aiChatBubble(message.role,message.text,aiChatState.partner,index);}).join('')+(aiChatState.busy?'<div class="ai-thinking">'+esc(tr('Coach is thinking…','Коуч думает…'))+'</div>':'')||'<div class="ai-empty-state">'+esc(tr('Your coach will open the conversation.','Ваш коуч начнёт разговор.'))+'</div>';
      log.scrollTop=log.scrollHeight;
      Array.prototype.forEach.call(log.querySelectorAll('[data-say]'),function(button){button.onclick=function(){var message=aiChatState.messages[Number(button.getAttribute('data-say'))];if(message)speakAi(message.text);};});
      $('#aiVoice').onclick=function(){aiChatState.speaker=!aiChatState.speaker;if(!aiChatState.speaker)stopAiVoice();renderAiPractice();};
      function send(){var input=$('#aiInput'),text=input.value.trim();if(!text||aiChatState.busy)return;input.value='';sendAiTurn(text);}
      $('#aiSend').onclick=send;
      $('#aiInput').onkeydown=function(event){if(event.key==='Enter')send();};
      if($('#aiRetry'))$('#aiRetry').onclick=function(){sendAiTurn(aiChatState.lastFailedText,true);};
      if($('#aiMic')) $('#aiMic').onclick=async function(){if(aiChatState.voiceConversation){beginAiRecognition();return;}if(await startAiVoiceConversation()){renderAiPractice();beginAiRecognition();}};
      if($('#aiMute')) $('#aiMute').onclick=toggleAiMute;
      if($('#aiSpeaker')) $('#aiSpeaker').onclick=function(){aiChatState.speaker=!aiChatState.speaker;if(!aiChatState.speaker)stopAiVoice();renderAiPractice();};
      if($('#aiListenAgain')) $('#aiListenAgain').onclick=function(){var last=aiChatState.messages.slice().reverse().find(function(message){return message.role==='assistant'&&message.kind!=='correction';});if(last)speakAi(last.text);};
      $('#aiEnd').onclick=function(){stopAiVoice();stopAiVoiceConversation();renderAiSummary();};
    }

    async function sendAiTurn(text, retry) {
      var isGreeting = text === '__start__';
      if (!isGreeting && !retry) aiChatState.messages.push({ role: 'user', text: text });
      aiChatState.busy = true;
      aiChatState.error = null;
      renderAiPractice();
      try {
        var nativeLocale = ctx.isRu ? 'ru-RU' : 'en-US';
        var partner = aiChatState.partner;
        var roleMeta = aiRoleMeta(partner ? partner.role : 'conversation');
        // Map the partner role to a practiceMode the edge function understands
        // (conversation → daily; grammar/pronunciation/roleplay pass through).
        var practiceMode = partner ? ({ grammar: 'grammar', pronunciation: 'pronunciation', roleplay: 'roleplay', conversation: 'conversation' }[partner.role] || 'daily') : 'daily';
        var personaLine = partner ? ('Stay in character as ' + partner.name + ' (' + partner.tagline.en + '). ') : '';
        var greetingInput = 'Let\'s begin. ' + personaLine + roleMeta.instruction + ' Greet me briefly and start.';
        var { data, error } = await supa.functions.invoke('openai-assistant', {
          body: {
            action: 'respond',
            input: isGreeting ? greetingInput : text,
            conversationId: aiChatState.conversationId,
            history: aiChatState.messages.slice(-6).map(function (m) { return { role: m.role, text: m.text }; }),
            locale: SPEECH_LOCALE[aiChatState.lang] || 'de-DE',
            nativeLocale: nativeLocale,
            levelRange: currentPracticeLevel(aiChatState.lang),
            practiceTopic: aiChatState.topic,
            practiceMode: practiceMode,
            lessonGoal: aiChatState.topic,
            lessonTurnIndex: aiChatState.turns,
            lessonTurnTarget: aiDurationTurnTarget(aiChatState.duration),
            difficultyMode: 'balanced',
            difficultyNote: aiChatState.correction === 'immediate' ? 'Correct every material learner error briefly.' : aiChatState.correction === 'minimal' ? 'Correct only if communication is blocked.' : 'Give at most one useful correction per learner turn.',
            partnerName: partner ? partner.name : undefined,
            partnerPersona: partner ? partner.tagline.en : undefined,
            partnerRole: partner ? partner.role : undefined,
            nativeHelp: true
          }
        });
        if (error) throw error;
        var reply = data || {};
        var coach = reply.coach || null;
        var directText = (reply.text || '').trim();
        var assistantText = directText;
        if (!assistantText && coach) {
          var ar = (coach.assistantReply || '').trim();
          var nq = (coach.nextQuestion || '').trim();
          assistantText = ar && nq
            ? (ar.toLowerCase().indexOf(nq.toLowerCase()) >= 0 ? ar : (ar + ' ' + nq).trim())
            : (ar || nq);
        }
        assistantText = assistantText || tr('(no reply)', '(нет ответа)');
        aiChatState.conversationId = reply.conversationId || aiChatState.conversationId;
        aiChatState.lastFailedText = null;
        aiChatState.messages.push({ role: 'assistant', text: assistantText });
        if (coach && coach.quickCorrection) {
          aiChatState.messages.push({ role: 'assistant', kind: 'correction', text: '✏️ ' + coach.quickCorrection });
        }
        if (aiChatState.speaker) speakAi(assistantText);
        aiChatState.turns++;
        bumpProgress('ai', 0);
      } catch (e) {
        aiChatState.lastFailedText = text;
        aiChatState.error = (e && e.message) || tr('Could not reach the AI coach. Try again.', 'Не удалось связаться с ИИ-репетитором. Попробуйте ещё раз.');
      }
      aiChatState.busy = false;
      renderAiPractice();
    }

    async function finishTool(scoreText, xp) {
      var finished = studyState, total = finished.data && finished.data.length ? finished.data.length : (finished.tool==='reading'&&finished.data&&finished.data.passage?finished.data.passage.questions.length:Math.max(finished.idx || 0, 1));
      var comboBonus=finished.tool==='listening'?0:Math.floor(Number(finished.bestStreak||0)/3)*2;xp=Math.max(0,Number(xp)||0)+comboBonus;
      var duration = Math.max(1, Math.round((Date.now() - (finished.startedAt || Date.now())) / 1000));
      var awarded = false, completionConfirmed = !uid();
      var completionPayload = { p_client_session_id:finished.clientSessionId || sessionId(),p_tool_id:finished.tool,p_language:finished.lang || 'de',p_level:(loadPrefs().levels || {})[finished.lang] || (ctx.profile && ctx.profile.language_level) || null,p_score:Number(finished.score) || 0,p_total:total,p_duration_seconds:duration,p_xp:Math.max(0,Number(xp) || 0),p_state:{ source:'web',skill:SKILL_GROUP[finished.tool] || finished.tool } };
      if (uid() && navigator.onLine) {
        try {
          var result = await supa.rpc('complete_practice_session',completionPayload);
          completionConfirmed = !result.error;
          awarded = !result.error && result.data && result.data.awarded !== false;
          if (!result.error && ctx.profile && awarded) ctx.setProfile(Object.assign({},ctx.profile,{ score:Number(ctx.profile.score || 0) + xp }));
          if (!result.error && result.data) { var local = loadProgress(); local.streak = Object.assign({},local.streak || {},{ current_streak:result.data.streak,today_sessions:result.data.todaySessions }); saveProgress(local); }
          if (result.error) queueOfflineSession(completionPayload);
        } catch (e) { queueOfflineSession(completionPayload); }
      }
      else if (uid()) queueOfflineSession(completionPayload);
      // A path step becomes completed only after this activity has reached its normal
      // completion flow (and, for signed-in learners, the backend confirmed it).
      if (finished.adaptivePlanStepId && completionConfirmed) markAdaptivePlanStep(finished.adaptivePlanStepId, 'completed');
      var flashcardSession = finished.tool === 'flashcards';
      var serverAuthoritative = finished.tool === 'listening' || finished.tool === 'reading' || finished.tool === 'writing';
      var locallyCountedXp = serverAuthoritative ? (uid() && awarded ? xp : 0) : xp;
      bumpProgress(finished.tool, locallyCountedXp);
      if (!uid() && !serverAuthoritative) awardXp(xp);
      clearResume(); syncPracticeData(); finished.finished = true;
      if(finished.challengeId&&uid()){try{await supa.from('practice_challenge_members').update({score:Number(finished.score||0),completed:total}).eq('challenge_id',finished.challengeId).eq('user_id',uid());}catch(e){}}
      var host = $('#studyToolBody');
      var accuracy = total ? Math.min(100,Math.round(Number(finished.score || 0) / total * 100)) : 100;
      var listeningAttempts = (finished.answers || []).reduce(function (sum, answer) { return sum + Number(answer.attemptsUsed || 1); }, 0);
      var verifiedXp = !uid() ? '—' : !completionConfirmed ? tr('Pending','Ожидает') : '+' + (awarded ? xp : 0);
      var resultStats = flashcardSession
        ? '<span><b>' + Number(finished.flashStats && finished.flashStats.reviewed || total) + '</b><small>' + esc(tr('Cards reviewed','Карточек повторено')) + '</small></span><span><b>' + Number(finished.flashStats && finished.flashStats.due || 0) + '</b><small>' + esc(tr('Due at start','Было на сегодня')) + '</small></span><span><b>' + Number(finished.flashStats && finished.flashStats.learning || 0) + '</b><small>' + esc(tr('Learning','В изучении')) + '</small></span><span><b>' + esc(verifiedXp) + '</b><small>' + esc(tr('Verified XP','Подтверждённый XP')) + '</small></span>'
        : serverAuthoritative
        ? '<span><b>' + Number(finished.score || 0) + ' / ' + total + '</b><small>' + esc(tr('Correct','Правильно')) + '</small></span><span><b>' + accuracy + '%</b><small>' + esc(tr('Accuracy','Точность')) + '</small></span><span><b>' + listeningAttempts + '</b><small>' + esc(tr('Attempts used','Попыток')) + '</small></span><span><b>' + esc(verifiedXp) + '</b><small>' + esc(tr('Verified XP','Подтверждённый XP')) + '</small></span>'
        : '<span><b>' + accuracy + '%</b><small>' + esc(tr('Accuracy','Точность')) + '</small></span><span><b>' + Math.max(1,Math.round(duration/60)) + ' min</b><small>' + esc(tr('Time','Время')) + '</small></span><span><b>+' + xp + '</b><small>XP</small></span>';
      host.innerHTML = '<div class="session-result"><div class="result-burst">✓</div><small>' + esc(tr('SESSION COMPLETE','ЗАНЯТИЕ ЗАВЕРШЕНО')) + '</small><h2>' + esc(scoreText) + '</h2><div class="result-stats">' + resultStats + '</div><div class="result-progress"><i style="width:' + (flashcardSession ? 100 : accuracy) + '%"></i></div><p>' + esc(flashcardSession ? tr('Your recall grades saved the next review dates.','Ваши оценки сохранили даты следующего повторения.') : accuracy >= 80 ? tr('Excellent work. Your next review has been scheduled.','Отличная работа. Следующее повторение уже запланировано.') : tr('Good start. Weak answers were added to your review plan.','Хорошее начало. Слабые ответы добавлены в план повторения.')) + '</p><button class="btn primary" id="studyAgain">' + esc(tr('Practice again','Пройти ещё раз')) + '</button></div>';
      var resultCard=host.querySelector('.session-result');
      if(resultCard&&comboBonus)resultCard.insertAdjacentHTML('afterbegin','<div class="combo-bonus">🔥 +'+comboBonus+' XP '+esc(tr('combo bonus','бонус за серию'))+'</div>');
      if(resultCard) resultCard.insertAdjacentHTML('beforeend','<details class="answer-review"><summary>'+esc(tr('Review every answer','Разобрать все ответы'))+'</summary><div>'+((finished.answers||[]).length?(finished.answers||[]).map(function(answer,index){return '<article class="'+(answer.ok?'ok':'bad')+'"><b>'+(index+1)+'. '+esc(answer.prompt||tr('Practice step','Шаг практики'))+'</b><p>'+esc(tr('Your answer: ','Ваш ответ: ')) + esc(answer.chosen||'—')+'</p><p>'+esc(tr('Correct: ','Правильно: '))+esc(answer.correct|| (answer.ok?answer.chosen:'—'))+'</p>'+(answer.explanation?'<small>'+esc(answer.explanation)+'</small>':'')+'</article>';}).join(''):'<p>'+esc(tr('No answer details for this activity.','Для этой практики нет отдельных ответов.'))+'</p>')+'</div></details><div class="result-actions"><button class="btn" id="tryHarder">'+esc(tr('Try harder','Попробовать сложнее'))+'</button><button class="btn primary" id="nextPractice">'+esc(tr('Next practice','Следующая практика'))+' →</button></div>');
      wireAgain();
      var harder=$('#tryHarder'),next=$('#nextPractice');
      if(harder)harder.onclick=function(){var prefs=loadPrefs(),levels=['A1','A2','B1','B2','C1','C2'],current=(prefs.levels||{})[finished.lang]||'A1',index=levels.indexOf(current);prefs.levels=prefs.levels||{};prefs.levels[finished.lang]=levels[Math.min(levels.length-1,index+1)];savePrefs(prefs);openStudyTool(finished.tool);};
      if(next)next.onclick=function(){var plan=loadAdaptivePlan(),nextStep=plan&&Array.isArray(plan.steps)&&plan.steps.find(function(step){return step.status==='current'||step.status==='not-started';});if(nextStep){markAdaptivePlanStep(nextStep.id,'in-progress');openStudyTool(nextStep.tool,{lang:finished.lang,level:finished.level,adaptivePlanStepId:nextStep.id});return;}var order=['flashcards','grammar','listening','speaking','reading','writing'],current=order.indexOf(finished.tool);openStudyTool(order[(current+1+order.length)%order.length]);};
    }

    return {
      studyToolsHtml: studyToolsHtml,
      bindStudyTiles: bindStudyTiles,
      openStudyTool: openStudyTool
    };
  }

  window.DuvelaAppStudy = { create: createStudyFeature };
})();





