(function () {
  function createStudyFeature(ctx) {
    const { $, tr, esc, supa } = ctx;
    const PROGRESS_KEY = 'duvela.study.progress';
    const RESUME_KEY = 'duvela.study.resume';
    const PREFS_KEY = 'duvela.study.preferences';
    const OFFLINE_QUEUE_KEY = 'duvela.study.offlineQueue';
    const EXAM_GOAL_KEY = 'duvela.study.examGoal';
    const DUEL_LIVE_KEY = 'duvela.study.duelLiveMode';
    const DUEL_TEACHER_KEY = 'duvela.study.duelTeacherKit';
    const DUEL_QUESTION_COUNT = 10;
    let studyState = null;
    let aiChatState = null;
    let practicePremium = false;
    let practiceHydrated = false;
    let listeningPlaybackRun = 0;
    let listeningAudio = null;
    let finishListeningPlayback = null;
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
            VOCAB.de.push({
              w: word,
              t: head[4] + ': ' + prefix[2] + ' / ' + prefix[1] + ' ' + head[3],
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

    const SPEECH_LOCALE = { de: 'de-DE', en: 'en-US', es: 'es-ES' };
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

    const READING = {
      de: [
        {
          title: 'Ein Tag in Berlin',
          text: 'Anna wohnt in Berlin. Jeden Morgen trinkt sie Kaffee und fährt mit dem Fahrrad zur Arbeit. Nach der Arbeit trifft sie oft ihre Freunde im Park. Am Wochenende besucht sie ihre Familie in Hamburg.',
          questions: [
            { q: 'Wo wohnt Anna?', opts: ['Berlin', 'Hamburg', 'München', 'Köln'], a: 0 },
            { q: 'Wie fährt sie zur Arbeit?', opts: ['Auto', 'Fahrrad', 'Bus', 'Zu Fuß'], a: 1 },
            { q: 'Wen besucht sie am Wochenende?', opts: ['Freunde', 'Kollegen', 'Familie', 'Niemanden'], a: 2 }
          ]
        }
      ],
      en: [
        {
          title: 'A Day at Work',
          text: 'Tom works in an office downtown. He starts at nine and has lunch with his colleagues at noon. After work, he usually goes to the gym before heading home. On Fridays, he meets friends for dinner.',
          questions: [
            { q: 'Where does Tom work?', opts: ['At home', 'In an office', 'At a school', 'Outdoors'], a: 1 },
            { q: 'What does he do after work?', opts: ['Sleeps', 'Goes to the gym', 'Watches TV', 'Cooks'], a: 1 },
            { q: 'What happens on Fridays?', opts: ['He works late', 'He meets friends', 'He stays home', 'He travels'], a: 1 }
          ]
        }
      ],
      es: [
        {
          title: 'Un día en Madrid',
          text: 'Marta vive en Madrid. Cada mañana toma un café y camina al trabajo. Después del trabajo, estudia inglés dos horas. Los fines de semana visita a sus padres.',
          questions: [
            { q: '¿Dónde vive Marta?', opts: ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'], a: 0 },
            { q: '¿Qué estudia después del trabajo?', opts: ['Francés', 'Inglés', 'Alemán', 'Nada'], a: 1 },
            { q: '¿A quién visita los fines de semana?', opts: ['Amigos', 'Padres', 'Colegas', 'Vecinos'], a: 1 }
          ]
        }
      ]
    };

    const WRITING = {
      de: [
        { prompt: 'Beschreiben Sie Ihren typischen Tag (mindestens 4 Sätze).', checklist: ['Ich benutze Präsens.', 'Ich habe mindestens 4 Sätze.', 'Ich benutze Zeitwörter wie "morgens", "dann", "danach".'] },
        { prompt: 'Schreiben Sie über Ihre Familie.', checklist: ['Ich nenne mindestens 2 Familienmitglieder.', 'Ich benutze "haben" oder "sein".', 'Der Text hat einen Anfang und ein Ende.'] }
      ],
      en: [
        { prompt: 'Describe your typical day (at least 4 sentences).', checklist: ['I used present tense.', 'I wrote at least 4 sentences.', 'I used time words like "then", "after that".'] },
        { prompt: 'Write about your last holiday.', checklist: ['I used past tense.', 'I mentioned where I went.', 'I described one activity.'] }
      ],
      es: [
        { prompt: 'Describe tu día típico (al menos 4 frases).', checklist: ['Usé el presente.', 'Escribí al menos 4 frases.', 'Usé palabras de tiempo como "luego", "después".'] }
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

    const W_QUESTIONS = [
      { q:'___ wohnst du?',opts:['Wo','Wer','Was','Wann'],a:0 }, { q:'___ heißt du?',opts:['Wie','Wo','Warum','Wen'],a:0 },
      { q:'___ kommt heute?',opts:['Wer','Wo','Wie','Wann'],a:0 }, { q:'___ lernst du Deutsch?',opts:['Warum','Wohin','Wem','Wessen'],a:0 }
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
      { id:'ai',icon:'🤖',category:'coach',accent:'purple',premium:true,title:tr('Duvela AI coach','ИИ-тренер Duvela'),desc:tr('Speak, write and get corrections','Общайтесь и получайте исправления') }
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
    function mistakeTopic(item){var text=String(item.prompt||'').toLowerCase();if(item.kind==='pronunciation')return {id:'pronunciation',label:tr('Pronunciation','Произношение'),tool:'speaking'};if(/der|die|das|article|артик/.test(text))return {id:'articles',label:'der / die / das',tool:'articles'};if(/perfekt|gefahren|gelernt|gelesen|gekommen/.test(text))return {id:'perfekt',label:'Perfekt',tool:'perfekt'};if(/wer|wie|wo|warum|wann/.test(text))return {id:'questions',label:tr('Question words','Вопросительные слова'),tool:'wquestion'};if(item.kind==='sentence')return {id:'word-order',label:tr('Word order','Порядок слов'),tool:'sentences'};return {id:'forms',label:tr('Verb forms and grammar','Формы глаголов и грамматика'),tool:'grammar'};}
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
        if (!ok) studyState.lives = Math.max(0, Number(studyState.lives == null ? 3 : studyState.lives) - 1);
        var overlay = $('#studyOverlay'), lives = $('#practiceLives'), combo = $('#practiceCombo');
        if (overlay) { overlay.classList.remove('answer-correct','answer-wrong'); void overlay.offsetWidth; overlay.classList.add(ok ? 'answer-correct' : 'answer-wrong'); }
        if (lives) lives.textContent = '♥'.repeat(studyState.lives) + '♡'.repeat(3-studyState.lives);
        if (combo) combo.textContent = '🔥 ' + studyState.streak;
        var coach=$('#practiceCoach');
        if(coach && studyState.answers.length%5===0){coach.hidden=false;coach.innerHTML='<b>✓ '+esc(tr('Checkpoint','Контрольная точка'))+'</b><p>'+esc(studyState.answers.filter(function(answer){return answer.ok;}).length)+' / '+studyState.answers.length+' '+esc(tr('correct so far. Take a breath and continue.','правильно. Сделайте паузу и продолжайте.'))+'</p>';}
        if(studyState.lives===0&&!studyState.finished)setTimeout(function(){if(studyState&&!studyState.finished)finishTool(tr('No lives left','Жизни закончились'),Math.max(1,studyState.score*2));},500);
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
      try { localStorage.setItem(RESUME_KEY, JSON.stringify(resume)); if(uid()&&navigator.onLine)supa.from('practice_resume').upsert({user_id:uid(),tool_id:resume.tool,language:resume.lang,level:resume.level,current_step:resume.idx,score:resume.score,state:{startedAt:resume.startedAt},client_session_id:resume.clientSessionId,updated_at:new Date().toISOString()}); }
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
        var mistakes = loadMistakes().map(function (m) { return { user_id:uid(),mistake_key:m.lang + '|' + m.prompt,language:m.lang,tool_id:m.kind || 'mcq',topic_id:mistakeTopic(m).id,prompt:m.prompt,options:m.opts || [],correct_index:m.a,review_step:Number(m.reviewStep||0),due_at:new Date(m.dueAt||Date.now()).toISOString(),updated_at:new Date(m.at || Date.now()).toISOString() }; });
        if (mistakes.length) await supa.from('practice_mistakes').upsert(mistakes, { onConflict:'user_id,mistake_key' });
        var words = loadSavedWords().map(function (w) { return { user_id:uid(),language:w.lang,word:w.w,translation:w.t,updated_at:new Date().toISOString() }; });
        if (words.length) await supa.from('practice_saved_words').upsert(words, { onConflict:'user_id,language,word' });
        var queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'), pending=[];
        for (var i=0;i<queue.length;i++) { try { var synced=await supa.rpc('complete_practice_session',queue[i]); if (synced.error) pending.push(queue[i]); } catch (e) { pending.push(queue[i]); } }
        localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(pending));
      } catch (e) { /* offline-first: retry next load */ }
    }
    function queueOfflineSession(payload) { try { var queue=JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)||'[]'); if(!queue.some(function(item){return item.p_client_session_id===payload.p_client_session_id;}))queue.push(payload);localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(queue.slice(-100))); } catch(e){} }
    async function hydratePracticeData() {
      if (!uid() || !navigator.onLine || practiceHydrated) return;
      practiceHydrated=true;
      try {
        var results = await Promise.all([
          supa.from('practice_progress').select('tool_id,sessions,xp,best_score,correct,attempted').eq('user_id',uid()),
          supa.from('practice_mistakes').select('language,prompt,options,correct_index,tool_id,review_step,due_at,updated_at').eq('user_id',uid()).is('mastered_at',null),
          supa.from('practice_saved_words').select('language,word,translation,box,due_at').eq('user_id',uid()),
          supa.from('practice_streaks').select('current_streak,longest_streak,today_sessions,daily_goal').eq('user_id',uid()).maybeSingle(),
          supa.from('practice_sessions').select('tool_id,language,score,total,xp_awarded,completed_at,duration_seconds').eq('user_id',uid()).eq('status','completed').order('completed_at',{ ascending:false }).limit(90),
          supa.from('practice_achievements').select('achievement_id,unlocked_at,metadata').eq('user_id',uid()).order('unlocked_at',{ ascending:false }),
          supa.from('practice_subscriptions').select('status,current_period_end').eq('user_id',uid()).eq('status','active').maybeSingle(),
          supa.from('practice_language_settings').select('language,level,active').eq('user_id',uid()),
          supa.from('practice_resume').select('tool_id,language,level,current_step,score,state,client_session_id,updated_at').eq('user_id',uid()).maybeSingle(),
          supa.from('practice_exam_goals').select('exam_type,exam_date,days_per_week,minutes_per_day,updated_at').eq('user_id',uid()).maybeSingle(),
          supa.from('learner_language_profiles').select('language,current_level,goal_level,is_active,practice_progress,score').eq('user_id',uid())
        ]);
        var progress = loadProgress();
        (results[0].data || []).forEach(function (row) { progress[row.tool_id] = Math.max(Number(progress[row.tool_id] || 0),Number(row.sessions || 0)); });
        progress.serverXp = (results[0].data || []).reduce(function (sum,row) { return sum + Number(row.xp || 0); },0);
        progress.xp = Math.max(Number(progress.xp || 0),progress.serverXp); progress.streak = results[3].data || progress.streak || null;
        progress.sessions = results[4].data || progress.sessions || []; progress.achievements = results[5].data || progress.achievements || [];
        practicePremium = !!(results[6].data && results[6].data.status === 'active'); progress.premiumActive=practicePremium; saveProgress(progress);
        if ((results[7].data || []).length) { var prefs=loadPrefs();prefs.levels=prefs.levels||{};(results[7].data||[]).forEach(function(row){prefs.levels[row.language]=row.level;if(row.active)prefs.practiceLang=row.language;});savePrefs(prefs); }
        if (results[8].data) { var cloud=results[8].data,local=readResume(),cloudAt=new Date(cloud.updated_at||0).getTime(),cloudLevel=normalizePracticeLevel(cloud.level,'A1');if(cloud.language===currentLang()&&cloudLevel===currentPracticeLevel(cloud.language)&&(!local||cloudAt>Number(local.at||0)))localStorage.setItem(RESUME_KEY,JSON.stringify({tool:cloud.tool_id,lang:cloud.language,level:cloudLevel,idx:cloud.current_step||0,score:cloud.score||0,clientSessionId:cloud.client_session_id,startedAt:cloud.state&&cloud.state.startedAt||Date.now(),at:cloudAt})); }
        if(results[9]&&results[9].data){var exam=results[9].data;localStorage.setItem(EXAM_GOAL_KEY,JSON.stringify({exam:exam.exam_type,date:exam.exam_date,daysPerWeek:exam.days_per_week,minutes:exam.minutes_per_day}));}
        if(results[10]&&(results[10].data||[]).length){var languagePrefs=loadPrefs();languagePrefs.levels=languagePrefs.levels||{};languagePrefs.goalLevels=languagePrefs.goalLevels||{};(results[10].data||[]).forEach(function(row){var target=normalizePracticeTarget(row.language);if(!target)return;languagePrefs.levels[target]=String(row.current_level||'A1').toUpperCase();if(row.goal_level)languagePrefs.goalLevels[target]=STUDENT_GOAL.normalize(row.goal_level,languagePrefs.levels[target]||'A1');if(row.is_active){languagePrefs.practiceTarget=target;languagePrefs.practiceLang=target;if(ctx.profile&&row.goal_level)ctx.profile.goal_level=STUDENT_GOAL.normalize(row.goal_level,ctx.profile.goal_level||'A1');}});savePrefs(languagePrefs);}
        if ((results[1].data || []).length) saveMistakes(results[1].data.map(function (row) { return { lang:row.language,prompt:row.prompt,opts:row.options || [],a:row.correct_index,kind:row.tool_id,reviewStep:Number(row.review_step||0),dueAt:new Date(row.due_at||Date.now()).getTime(),at:new Date(row.updated_at).getTime() }; }));
        if ((results[2].data || []).length) localStorage.setItem(SAVED_WORDS_KEY,JSON.stringify(results[2].data.map(function (row) { return { lang:row.language,w:row.word,t:row.translation,box:row.box,dueAt:row.due_at }; })));
        if(ctx.renderWorkspace)ctx.renderWorkspace();
      } catch (e) { /* tables may not be installed yet */ }
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
            audioClip:task._webAudioClip
          });
        });
        Object.keys(LISTEN).forEach(function(code){
          (LISTEN[code]||[]).forEach(function(item){
            var source=(bank.tasks||[]).find(function(task){return (task.speechText||task.transcript)===item.text;});
            if(source){item.level=source._webLevel;item.audioClip=source._webAudioClip;}
          });
        });
      } catch (e) { /* bundled starter bank remains available */ }
    }

    function loadMistakes() {
      try { return JSON.parse(localStorage.getItem(MISTAKE_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveMistakes(list) {
      try { localStorage.setItem(MISTAKE_KEY, JSON.stringify(list.slice(-60))); } catch (e) { /* ignore */ }
    }
    function logMistake(lang, prompt, opts, correctIdx, kind) {
      var list = loadMistakes();
      var key = lang + '|' + prompt;
      list = list.filter(function (m) { return (m.lang + '|' + m.prompt) !== key; });
      var previous=loadMistakes().find(function(m){return (m.lang+'|'+m.prompt)===key;}),step=Math.min(3,Number(previous&&previous.reviewStep||0));
      list.push({ lang:lang,prompt:prompt,opts:opts,a:correctIdx,kind:kind||'mcq',at:Date.now(),reviewStep:step,dueAt:Date.now()+[1,3,7,14][step]*86400000 });
      saveMistakes(list);
    }
    function clearMistake(lang, prompt) {
      var list=loadMistakes().map(function(m){if((m.lang+'|'+m.prompt)!==(lang+'|'+prompt))return m;var next=Math.min(3,Number(m.reviewStep||0)+1);return Object.assign({},m,{reviewStep:next,dueAt:Date.now()+[1,3,7,14][next]*86400000,mastered:next>=3});}).filter(function(m){return !m.mastered;});
      saveMistakes(list);
    }

    function loadSavedWords() {
      try { return JSON.parse(localStorage.getItem(SAVED_WORDS_KEY) || '[]'); } catch (e) { return []; }
    }
    function toggleSavedWord(lang, word, translation) {
      var list = loadSavedWords();
      var key = lang + '|' + word;
      var idx = list.findIndex(function (item) { return (item.lang + '|' + item.w) === key; });
      if (idx >= 0) list.splice(idx, 1);
      else list.push({ lang: lang, w: word, t: translation });
      try { localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
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
    function toolsForTarget(target) {
      if (target === 'chess') return TOOLS.filter(function(tool){return tool.id === 'chess';});
      if (!isSupportedLanguageTarget(target)) {
        var subjectTools = ['ai','liveTeacher','dictionary','history','calendar','achievements','ranking','settings'];
        return TOOLS.filter(function(tool){ return subjectTools.indexOf(tool.id) >= 0; });
      }
      var germanOnly = ['articles','wquestion','perfekt'];
      return TOOLS.filter(function(tool){return tool.id !== 'chess' && (target === 'de' || germanOnly.indexOf(tool.id) < 0);});
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
      const premiumActive = practicePremium || !!p.premiumActive || !!(ctx.profile && (ctx.profile.is_premium || ctx.profile.premium));
      const readiness=skillReadiness(p),weak=weakTopics(),examGoal=loadExamGoal(),daysLeft=examDaysLeft(examGoal);
      var dailyPlan=buildAdaptiveDailyPlan(p,prefs,examGoal);
      const targetData=learnerPracticeTargets(prefs);
      if(!targetData.targets.length){targetData.targets=['de'];targetData.levels.de=normalizePracticeLevel(ctx.profile&&ctx.profile.language_level,'A1');targetData.labels.de='German';}
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
      if(!fullLanguagePractice&&activeTarget!=='chess') {
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
        sourceCard('duvela','ai','sparkles',true,'DUVELA AI','Conversation practice','Practice conversation, pronunciation, and grammar in one place.','Start AI practice'),
        sourceCard('liveTeacher','liveTeacher','video',true,'Practice LIVE with Teacher','Teacher session','Enter a live practice room with a teacher for speaking, questions, and real-time feedback.','Join LIVE'),
        examCard,
        ...(essentialsCard?[essentialsCard]:[]),
        sourceCard('duel','duel','bolt',false,'LIVE Student Duel','10 questions · live matchmaking','Join from Student Hub. Duvela searches a real learner first; if nobody is online, the Bot starts.','Play duel'),
        sourceCard('teacherPractices','teacherPractices','bulb',false,'Teacher practice','From teachers & schools','Practices created by teachers. Higher rated ones rank first.','Open',true),
        grammarCard,
        wordUsageCard
      ].concat(languageTail,[
        sourceCard('mistakes','mistakes','alert',false,'Mistake Center','Mistakes are saved on this device and synced when your account is available.','One place for mistakes from grammar, exams, listening and writing.','Review')
      ]);
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
        return '<button class="study-tile mph-exercise-card ' + (item.premium?'premium-exercise':'regular-exercise') + (item.db?' db-exercise':'') + '" data-study="' + esc(item.webTool) + '" data-mobile-card="' + esc(item.id) + '" data-mobile-target="' + esc(mobileTarget) + '" data-study-category="' + esc(item.premium?'premium':(item.db?'db':'bank')) + '">' +
          '<div class="mph-exercise-top"><span class="mph-exercise-icon">' + bankIcon(item.icon) + '</span>' + (item.premium ? '<span class="mph-premium-badge">&#9826; Premium</span>' : '') + '</div>' +
          '<div class="mph-exercise-copy"><h3>' + esc(item.title) + '</h3><strong>' + esc(item.meta) + '</strong><p>' + esc(item.desc) + '</p></div>' +
          '<span class="mph-exercise-action">' + esc(item.action) + '</span></button>';
      }
      var goalLevel=studentGoalLevelForTarget(activeTarget,'');
      var goalDisplay=goalLevel||tr('Set goal','Укажите цель');
      var score=Math.max(230,Number(done||0)),silverTarget=250,goalPercent=Math.max(4,Math.min(100,Math.round(score/6000*100)));
      var examDate=examGoal.date||'',examDateObj=examDate?new Date(examDate+'T12:00:00'):null,examDays=examDate?daysLeft:null;
      var examName=String(examGoal.exam||'telc-b1').toUpperCase().replace('-',' ');
      var examDateText=examDateObj?examDateObj.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):tr('Not set yet','Пока не указана');
      var examDayText=examDays===null?tr('Set date','Укажите дату'):(examDays+' '+tr('days','дней'));
      function miniLanguage(target){
        var level=targetData.levels[target]||prefs.levels[target]||activeLevel||'A1';
        return '<button type="button" class="'+(target===activeTarget?'active':'')+'" data-practice-target="'+esc(target)+'"><span>'+bankIcon('cards')+'</span><b>'+esc(targetData.labels[target]||targetLabel(target))+'</b><small>'+esc(String(level).toUpperCase())+'</small></button>';
      }
      var languageTargets=targetData.targets.filter(isLanguageTarget);
      if(languageTargets.indexOf('de')<0)languageTargets.unshift('de');
      if(languageTargets.length<2&&languageTargets.indexOf('en')<0)languageTargets.push('en');
      if(languageTargets.length<3&&languageTargets.indexOf('es')<0)languageTargets.push('es');
      languageTargets=languageTargets.slice(0,3);
      function readinessRow(key,label){
        var value=Number(readiness[key]||0);
        return '<button type="button" data-readiness-tool="'+key+'"><span><b>'+esc(label)+'</b><strong>'+value+'%</strong></span><i><em style="width:'+value+'%"></em></i></button>';
      }
      var quickStart=[
        {id:'duel',icon:'bolt',title:'LIVE Duel'},
        {id:'listening',icon:'headphones',title:'Listening Lab'},
        {id:'reading',icon:'book',title:'Reading Lab'},
        {id:'writing',icon:'edit',title:'Writing Lab'}
      ];
      function quickCard(item){
        return '<button class="study-tile practice-quick-card" data-study="'+esc(item.id)+'"><span>'+bankIcon(item.icon)+'</span><b>'+esc(item.title)+'</b></button>';
      }
      return '<section class="mobile-practice-hub practice-library-mobile target-'+esc(activeTarget)+'">' +
        '<div class="practice-language-tabs">'+languageTargets.map(miniLanguage).join('')+'</div>' +
        '<section class="practice-goal-progress"><div class="practice-goal-head"><span>'+bankIcon('path')+'</span><div><small>STUDENT GOAL</small><h2>'+esc(activeLabel+' '+goalDisplay)+'</h2></div><strong>'+goalPercent+'%</strong></div><div class="practice-goal-track"><i style="width:'+goalPercent+'%"></i></div><div class="practice-goal-stats"><span><small>CURRENT</small><b>'+esc(String(activeLevel).toUpperCase())+'</b></span><span><small>GOAL</small><b>'+esc(goalDisplay)+'</b></span><span class="wide"><small>SCORE</small><b>'+score+'</b><em>Bronze</em><i><u style="width:'+Math.min(100,Math.round(score/silverTarget*100))+'%"></u></i><small>RANKING</small><strong>'+score+'/'+silverTarget+' to Silver</strong></span></div><p><span>'+bankIcon('bolt')+'</span>'+esc(goalLevel?tr('Next: finish practice paths to reach ','Следующий шаг: пройти практику до ')+goalLevel:tr('Next: set your Student Goal and create an exam plan.','Следующий шаг: укажите Student Goal и создайте план экзамена.'))+'</p></section>' +
        '<section class="practice-exam-journey"><div class="practice-exam-title"><div><small>EXAM JOURNEY</small><h2>'+esc(examName)+'</h2></div><strong>'+readiness.overall+'%</strong></div><p>'+esc(goalLevel?tr('Exam preparation is tuned to Student Goal ','Подготовка к экзамену настроена под Student Goal ')+goalLevel:tr('Set your Student Goal and exam date to get a personal daily plan.','Укажите Student Goal и дату экзамена, чтобы получить личный план на каждый день.'))+'</p><div class="practice-exam-date"><span>'+bankIcon('file')+'</span><div><small>EXAM DATE</small><b>'+esc(examDateText)+'</b></div><em>'+esc(examDayText)+'</em></div><div class="practice-goal-track exam"><i style="width:'+readiness.overall+'%"></i></div><div class="practice-exam-actions"><button type="button" data-exam-plan="1">'+bankIcon('file')+' '+esc(examDate?tr('Change plan','Изменить план'):tr('Create plan','Создать план'))+'</button><button class="study-tile" type="button" data-study="exam">Exam bank <span>-></span></button></div><div class="practice-skill-readiness">'+readinessRow('reading','Reading')+readinessRow('listening','Listening')+readinessRow('grammar','Grammar')+readinessRow('writing','Writing')+readinessRow('speaking','Speaking')+'</div></section>' +
        '<div class="practice-quick-head"><div><small>QUICK START</small><h2>Core skills</h2></div><span>'+quickStart.length+'</span></div><div class="practice-quick-start">'+quickStart.map(quickCard).join('')+'</div>' +
        '<div class="practice-library-head"><div><small>PRACTICE LIBRARY</small><h2>All exercises</h2></div><span>'+bankItems.length+'</span></div>' +
        '<div class="practice-exercise-bank">' + bankItems.map(exerciseCard).join('') + '</div></section>';
      const premiumOrder=['adaptive','ai','liveTeacher','exam','essentials','duel'];
      const premiumTools=premiumOrder.map(function(id){return targetTools.find(function(tool){return tool.id===id;});}).filter(Boolean);
      const regularTools=targetTools.filter(function(tool){return !tool.premium;});
      function toolCard(tool) {
        var sessions = Number(p[tool.id]) || 0;
        var title=tool.id==='essentials'?(activeTarget==='de'?tr('Deutsch Trainer','Тренажёр немецкого'):targetLabel(activeTarget)+' '+tr('Trainer','тренажёр')):tool.title;
        return '<button class="study-tile mph-card ' + esc(tool.accent || 'purple') + (tool.premium ? ' premium-card' : '') + '" data-study="' + esc(tool.id) + '" data-study-category="' + esc(tool.category || '') + '">' +
          '<div class="mph-card-top"><span class="mph-icon">' + tool.icon + '</span>' + (tool.premium ? '<span class="mph-premium">★ PREMIUM</span>' : sessions ? '<span class="mph-done">✓ ' + sessions + '</span>' : '<span class="mph-new">' + esc(tr('Start', 'Начать')) + '</span>') + '</div>' +
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
        (premiumTools.length?'<div class="practice-section-title premium-title"><div><small>DUVELA PREMIUM</small><h2>★ ' + esc(tr('Premium practice','Премиум-практика')) + '</h2></div><span>' + esc(tr('Personal tools and exams','Персональные инструменты и экзамены')) + '</span></div><div class="study-grid mph-grid premium-grid">' + premiumTools.map(toolCard).join('') + '</div>':'') +
        '<div class="mph-toolbar"><div><small>' + esc(tr('PRACTICE LIBRARY', 'БИБЛИОТЕКА ПРАКТИКИ')) + '</small><h2>' + esc(tr('All practice','Все практики')) + '</h2></div><div class="mph-filters"><button class="active" data-study-filter="all">' + esc(tr('All', 'Все')) + '</button><button data-study-filter="grammar">' + esc(tr('Grammar', 'Грамматика')) + '</button><button data-study-filter="vocabulary">' + esc(tr('Vocabulary', 'Словарь')) + '</button><button data-study-filter="skills">' + esc(tr('Skills', 'Навыки')) + '</button><button data-study-filter="progress">' + esc(tr('Progress', 'Прогресс')) + '</button></div></div>' +
        '<div class="study-grid mph-grid regular-grid">' + regularTools.map(toolCard).join('') + '</div></section>';
    }

    function bindStudyTiles() {
      var tiles = document.querySelectorAll('.study-tile');
      Array.prototype.forEach.call(tiles, function (tile) {
        tile.addEventListener('click', function () {
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
          Array.prototype.forEach.call(document.querySelectorAll('[data-study-filter]'), function (item) { item.classList.toggle('active', item === button); });
          Array.prototype.forEach.call(document.querySelectorAll('.regular-grid [data-study-category]'), function (tile) { tile.hidden = filter !== 'all' && tile.getAttribute('data-study-category') !== filter; });
        });
      });
      var resumeButton = document.querySelector('[data-study-resume]');
      if (resumeButton) resumeButton.addEventListener('click', function () {
        var saved = readResume(); if (!saved) return;
        openStudyTool(saved.tool, saved);
      });
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

    function showPremiumAccess() {
      ensureOverlay();
      $('#studyOverlay').classList.remove('practice-immersive');
      $('#studyOverlay').removeAttribute('data-practice-tool');
      $('#studyOverlay').removeAttribute('data-practice-accent');
      $('#studyOverlayTitle').textContent = '★ Duvela Premium';
      $('#studyOverlayBody').innerHTML = '<div class="premium-paywall"><span>★</span><h2>' + esc(tr('Unlock Premium practice','Откройте Premium-практику')) + '</h2><p>' + esc(tr('Adaptive learning, exam mode, language essentials and AI Coach in one plan.','Адаптивное обучение, экзамены, основы языка и AI Coach в одном тарифе.')) + '</p><div><b>✓ ' + esc(tr('Personal learning path','Персональный маршрут')) + '</b><b>✓ ' + esc(tr('Full exam training','Полная подготовка к экзамену')) + '</b><b>✓ ' + esc(tr('AI speaking coach','Разговорный AI Coach')) + '</b><b>✓ +20% XP</b></div><strong>€9.99 <small>/ ' + esc(tr('month','месяц')) + '</small></strong><button class="btn primary" id="premiumRequest">' + esc(tr('Notify me when payment opens','Сообщить о запуске оплаты')) + '</button><small>' + esc(tr('Payment will be added soon. No charge is made now.','Оплата появится позже. Сейчас списаний нет.')) + '</small></div>';
      $('#studyOverlay').classList.add('open');
      $('#premiumRequest').onclick = async function () { localStorage.setItem('duvela.premium.waitlist','1'); try { await supa.from('notifications').insert({ user_id:uid(),type:'premium_waitlist',title:'Duvela Premium',body:'Premium payment waitlist' }); } catch (e) {} this.textContent = '✓ ' + tr('Saved','Сохранено'); this.disabled = true; };
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
      if (studyState && studyState.searchTimerId) clearInterval(studyState.searchTimerId);
      if (studyState && studyState.challengeChannel) supa.removeChannel(studyState.challengeChannel);
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
      ensureOverlay();
      if (id !== 'ai') aiChatState = null;
      var germanOnly = ['articles','wquestion','perfekt'].indexOf(id) >= 0;
      var sessionLang=germanOnly?'de':((restored&&restored.lang)||currentLang()),sessionLevel=currentPracticeLevel(sessionLang);
      var canRestore=!!(restored&&restored.lang===sessionLang&&normalizePracticeLevel(restored.level,'A1')===sessionLevel);
      studyState = { tool:id,lang:sessionLang,level:sessionLevel,idx:canRestore?(restored.idx||0):0,score:canRestore?(restored.score||0):0,streak:0,lives:3,answers:[],timerEnabled:false,speechRate:1,skillDirect:!!(restored&&restored.skillDirect),progressDirect:!!(restored&&restored.progressDirect),clientSessionId:canRestore&&restored.clientSessionId||sessionId(),startedAt:canRestore&&restored.startedAt||Date.now() };
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
      var showPicker = ['mistakes','ai','articles','wquestion','perfekt'].indexOf(studyState.tool) < 0;
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
        case 'wquestion': return renderSpecialQuiz(W_QUESTIONS, renderToolBody);
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
      if (xp) xp.textContent = '+' + Number(studyState.score || 0) * 5 + ' XP';
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

    function answerExplanation(item) {
      if (item && item.explanation) return item.explanation;
      var prompt=String(item&&item.q||item&&item.noun||'');
      if (/___/.test(prompt)) return tr('The missing form must agree with the noun, person or tense used in the sentence.','Пропущенная форма должна согласовываться с существительным, лицом или временем предложения.');
      if (studyState.tool==='articles') return tr('German noun gender determines whether der, die or das is used. Save this noun together with its article.','Род немецкого существительного определяет артикль der, die или das. Запоминайте существительное сразу вместе с артиклем.');
      if (studyState.tool==='wordusage') return tr('Meaning and surrounding words determine which option fits naturally.','Значение и соседние слова определяют, какой вариант подходит естественно.');
      return tr('Compare the correct option with the complete sentence and repeat it aloud once.','Сравните правильный вариант с полным предложением и один раз произнесите его вслух.');
    }
    function explanationPanel(item,chosen,ok){
      var correct=item.opts[item.a],base=answerExplanation(item),prompt=String(item.q||'');
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
      if (!studyState.data) studyState.data=shuffle(strictBank(VOCAB,studyState.lang,studyState.level));
      var deck = studyState.data;
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var card = deck[studyState.idx];
      var host = $('#studyToolBody');
      var saved = isWordSaved(studyState.lang, card.w);
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div id="flip" style="cursor:pointer;border:1px solid var(--line);border-radius:16px;padding:34px 16px;text-align:center;background:var(--panel-soft);position:relative">' +
          '<button type="button" id="fcStar" aria-label="save" style="position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;cursor:pointer">' + (saved ? '⭐' : '☆') + '</button>' +
          '<div style="font-size:24px;font-weight:900" id="flipFront">' + esc(card.w) + '</div>' +
          '<div style="color:var(--soft);font-weight:700;margin-top:8px" id="flipBack">' + esc(tr('Tap to flip', 'Нажмите, чтобы перевернуть')) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px">' +
          '<button class="btn" id="fcAgain" style="flex:1">' + esc(tr('Repeat', 'Повторить')) + '</button>' +
          '<button class="btn primary" id="fcKnow" style="flex:1">' + esc(tr('I know it', 'Знаю')) + '</button>' +
        '</div>';
      var flipped = false;
      $('#flip').addEventListener('click', function (e) {
        if (e.target && e.target.id === 'fcStar') return;
        flipped = !flipped;
        $('#flipFront').textContent = flipped ? card.t : card.w;
        $('#flipBack').textContent = flipped ? tr('Translation', 'Перевод') : tr('Tap to flip', 'Нажмите, чтобы перевернуть');
      });
      $('#fcStar').addEventListener('click', function (e) {
        e.stopPropagation();
        var nowSaved = toggleSavedWord(studyState.lang, card.w, card.t);
        $('#fcStar').textContent = nowSaved ? '⭐' : '☆';
      });
      $('#fcKnow').addEventListener('click', function () { studyState.score++; studyState.idx++; renderFlashcards(); });
      $('#fcAgain').addEventListener('click', function () { studyState.idx++; renderFlashcards(); });
    }

    // ---- 2. Guess the article ----
    function renderArticles() {
      if (!studyState.data) studyState.data=shuffle(exactLevelItems(ARTICLES,studyState.level)).slice(0,10);
      var deck = studyState.data;
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="text-align:center;font-size:24px;font-weight:900;margin:10px 0">___ ' + esc(item.noun) + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center">' +
        ['der', 'die', 'das'].map(function (art) {
          return '<button class="btn opt-btn" data-art="' + art + '" style="min-width:88px;font-size:16px">' + art + '</button>';
        }).join('') + '</div>' +
        '<div id="artFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = btn.getAttribute('data-art');
          var ok = chosen === item.art;
          feedback(ok,{prompt:'___ '+item.noun,chosen:chosen,correct:item.art+' '+item.noun,explanation:answerExplanation(item)});
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.noun); }
          else logMistake(studyState.lang, item.noun, ['der', 'die', 'das'], ['der', 'die', 'das'].indexOf(item.art), 'article');
          $('#artFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + item.art + ' ' + esc(item.noun) + '</span>';
          $('#artFb').insertAdjacentHTML('beforeend','<p class="answer-explanation">'+esc(answerExplanation(item))+'</p><button class="btn primary answer-continue" id="artContinue">'+esc(tr('Continue','Продолжить'))+' →</button>');
          Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (b) { b.disabled = true; });
          $('#artContinue').onclick=function(){studyState.idx++;persistResume();renderArticles();};
        });
      });
    }

    // ---- 3. Memory match ----
    function renderMemory() {
      var host = $('#studyToolBody');
      if (!studyState.data) {
        var pool=shuffle(strictBank(VOCAB,studyState.lang,studyState.level)).slice(0,6);
        if(!pool.length)return noLevelContent();
        var cards = [];
        pool.forEach(function (item, i) {
          cards.push({ id: i, face: item.w, kind: 'w' });
          cards.push({ id: i, face: item.t, kind: 't' });
        });
        studyState.data = shuffle(cards);
        studyState.matched = {}; studyState.first = null; studyState.moves = 0; studyState.busy = false;
      }
      var deck = studyState.data;
      host.innerHTML =
        '<div style="color:var(--soft);font-weight:800;font-size:12px;margin-bottom:10px">' +
          esc(tr('Moves', 'Ходы')) + ': <b id="memMoves">' + studyState.moves + '</b></div>' +
        '<div id="memGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
        deck.map(function (c, i) {
          var isMatched = studyState.matched[i];
          var isOpen = studyState.first === i;
          var shown = isMatched || isOpen;
          return '<button class="btn mem-cell" data-cell="' + i + '"' + (isMatched ? ' disabled' : '') +
            ' style="min-height:64px;font-size:13px;font-weight:800;' + (isMatched ? 'opacity:.35;' : '') +
            'background:' + (shown ? 'var(--panel-soft)' : 'var(--ink)') + ';color:' + (shown ? 'var(--ink)' : 'transparent') + '">' +
            esc(c.face) + '</button>';
        }).join('') + '</div>';
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

    function renderAdaptivePath() {
      var mistakes = loadMistakes();
      var recommended = mistakes.length ? 'mistakes' : (currentLang() === 'de' ? 'grammar' : 'vocabulary');
      var target = TOOLS.find(function (tool) { return tool.id === recommended; }) || TOOLS[1];
      var progress = loadProgress();
      var host = $('#studyToolBody');
      host.innerHTML = '<div class="adaptive-path"><span class="adaptive-orbit">✦</span><small>' + esc(tr('PERSONAL NEXT STEP', 'ПЕРСОНАЛЬНЫЙ СЛЕДУЮЩИЙ ШАГ')) + '</small><h2>' + esc(target.title) + '</h2><p>' + esc(mistakes.length ? tr('We found topics worth repeating from your recent mistakes.', 'Мы нашли темы, которые стоит повторить по недавним ошибкам.') : tr('Start with a focused activity selected for your language.', 'Начните с практики, подобранной для вашего языка.')) + '</p><div><span>' + mistakes.length + ' ' + esc(tr('mistakes to review', 'ошибок на повторение')) + '</span><span>' + (progress.xp || 0) + ' XP</span></div><button class="btn primary" id="adaptiveStart">' + esc(tr('Start recommended practice', 'Начать рекомендованную практику')) + '</button></div>';
      $('#adaptiveStart').onclick = function () {
        studyState = { tool:recommended,lang:currentLang(),idx:0,score:0 };
        $('#studyOverlayTitle').textContent = target.icon + ' ' + target.title;
        renderTool();
      };
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
      try { var result=await supa.from('profiles').select('id,full_name,avatar_url,score,language_level').order('score',{ascending:false}).limit(20);var rows=result.data||[];host.innerHTML='<div class="ranking-podium">' + rows.slice(0,3).map(function(row,index){return '<article class="place-' + (index+1) + '"><span>' + ['🥇','🥈','🥉'][index] + '</span><b>' + esc(row.full_name||tr('Duvela learner','Ученик Duvela')) + '</b><strong>' + Number(row.score||0) + ' XP</strong></article>';}).join('') + '</div><div class="ranking-list">' + rows.slice(3).map(function(row,index){return '<article class="' + (String(row.id)===String(uid())?'me':'') + '"><b>#' + (index+4) + '</b><span>' + esc(row.full_name||tr('Duvela learner','Ученик Duvela')) + '</span><small>' + esc(row.language_level||'') + '</small><strong>' + Number(row.score||0) + ' XP</strong></article>';}).join('') + '</div>'; } catch(e){host.innerHTML='<div class="empty">'+esc(tr('Ranking is temporarily unavailable.','Рейтинг временно недоступен.'))+'</div>';}
    }

    function renderPracticeSettings() {
      if (!studyState.progressDirect) return renderProgressHub();
      var prefs = loadPrefs();
      $('#studyToolBody').innerHTML = '<div class="practice-settings-list">' + [['sound','🔊',tr('Answer sounds','Звуки ответов')],['reducedMotion','◌',tr('Reduce motion','Уменьшить анимацию')],['largeText','A+',tr('Large text','Крупный текст')],['reminders','🔔',tr('Daily reminder','Ежедневное напоминание')]].map(function (item) { return '<label><span>' + item[1] + '</span><b>' + esc(item[2]) + '</b><input type="checkbox" data-setting="' + item[0] + '"' + (prefs[item[0]] ? ' checked' : '') + '></label>'; }).join('') + '<label><span>⏰</span><b>' + esc(tr('Reminder time','Время напоминания')) + '</b><input type="time" id="practiceReminderTime" value="' + esc(prefs.reminderTime || '18:00') + '"></label><button class="btn" id="practiceResetLocal">' + esc(tr('Clear local practice cache','Очистить локальный кэш практики')) + '</button></div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-setting]'),function (input) { input.onchange = async function () { var next = loadPrefs(), key = input.getAttribute('data-setting'); next[key] = input.checked; savePrefs(next); if (key === 'reminders' && input.checked && window.Notification) await Notification.requestPermission(); schedulePracticeReminder(); if (key === 'reminders' && uid()) supa.from('practice_reminders').upsert({ user_id:uid(),enabled:next.reminders,reminder_time:next.reminderTime,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,updated_at:new Date().toISOString() }); }; });
      $('#practiceReminderTime').onchange = function () { var next=loadPrefs();next.reminderTime=this.value;savePrefs(next);schedulePracticeReminder();if(uid())supa.from('practice_reminders').upsert({user_id:uid(),enabled:next.reminders,reminder_time:next.reminderTime,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,updated_at:new Date().toISOString()}); };
      $('#practiceResetLocal').onclick = async function () { var ok = ctx.confirm ? await ctx.confirm(tr('Clear only local cached progress? Cloud history remains safe.', '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448? \u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f.'), { title: tr('Clear local cache?', '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448?'), confirmLabel: tr('Clear cache', '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c'), cancelLabel: tr('Cancel', '\u041e\u0442\u043c\u0435\u043d\u0430'), tone: 'danger', icon: '!' }) : confirm(tr('Clear only local cached progress? Cloud history remains safe.', '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u044d\u0448? \u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f.')); if (!ok) return; [PROGRESS_KEY,RESUME_KEY,MISTAKE_KEY,SAVED_WORDS_KEY].forEach(function (key) { localStorage.removeItem(key); }); location.reload(); };
    }

    // ---- 4. Grammar quiz ----
    function renderGrammar() {
      if (!studyState.grammarTopic) {
        var level = (loadPrefs().levels || {})[studyState.lang] || 'A1';
        var grammarTopics = [
          { id:'mixed', title:tr('Mixed grammar','\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u0430\u044f \u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u043a\u0430'), icon:'✦', desc:tr('A full grammar bank with mixed forms and everyday patterns.','\u041f\u043e\u043b\u043d\u044b\u0439 \u0431\u0430\u043d\u043a \u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u043a\u0438: \u0444\u043e\u0440\u043c\u044b, \u043f\u0430\u0442\u0442\u0435\u0440\u043d\u044b \u0438 \u0431\u0430\u0437\u043e\u0432\u044b\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430.'), cta:tr('Open academy','\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0430\u043a\u0430\u0434\u0435\u043c\u0438\u044e') },
          { id:'articles', title:tr('Articles','\u0410\u0440\u0442\u0438\u043a\u043b\u0438'), icon:'DE', desc:tr('Train der, die, das with a focused drill.','\u0422\u0440\u0435\u043d\u0438\u0440\u0443\u0439\u0442\u0435 der, die, das \u0432 \u0443\u0437\u043a\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435.'), cta:tr('Train articles','\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0430\u0440\u0442\u0438\u043a\u043b\u0438'), tool:'articles' },
          { id:'verbs', title:tr('Verbs and tenses','\u0413\u043b\u0430\u0433\u043e\u043b\u044b \u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u0430'), icon:'V', desc:tr('Use a focused Perfekt practice set for spoken German.','\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0431\u0430\u043d\u043a Perfekt \u0434\u043b\u044f \u0436\u0438\u0432\u043e\u0439 \u043d\u0435\u043c\u0435\u0446\u043a\u043e\u0439 \u0440\u0435\u0447\u0438.'), cta:tr('Train tenses','\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u0440\u0435\u043c\u0435\u043d\u0430'), tool:'perfekt' },
          { id:'sentences', title:tr('Sentence building','\u041f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439'), icon:'W?', desc:tr('Build word order and question logic step by step.','\u0421\u043e\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0441\u043b\u043e\u0432 \u0438 \u043b\u043e\u0433\u0438\u043a\u0443 \u0432\u043e\u043f\u0440\u043e\u0441\u0430 \u0448\u0430\u0433 \u0437\u0430 \u0448\u0430\u0433\u043e\u043c.'), cta:tr('Build sentences','\u0421\u043e\u0431\u0438\u0440\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f'), tool:'sentences' }
        ];
        var totalBank = strictBank(GRAMMAR,studyState.lang,studyState.level).length;
        $('#studyToolBody').innerHTML =
          '<section class="grammar-hub">' +
            '<div class="grammar-hub-hero">' +
              '<div class="grammar-hub-copy">' +
                '<small>' + esc(tr('GRAMMAR ACTIVE', '\u0413\u0420\u0410\u041c\u041c\u0410\u0422\u0418\u041a\u0410 ACTIVE')) + ' · ' + esc(level) + '</small>' +
                '<h2>' + esc(tr('Grammar academy and practice bank','\u0410\u043a\u0430\u0434\u0435\u043c\u0438\u044f \u0438 \u0431\u0430\u043d\u043a \u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u043a\u0438')) + '</h2>' +
                '<p>' + esc(tr('Choose a clear grammar path: full academy, article practice, tense drills or sentence building.', '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0439 \u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u0443\u0442\u044c: \u043f\u043e\u043b\u043d\u0430\u044f \u0430\u043a\u0430\u0434\u0435\u043c\u0438\u044f, \u0430\u0440\u0442\u0438\u043a\u043b\u0438, \u0432\u0440\u0435\u043c\u0435\u043d\u0430 \u0438\u043b\u0438 \u043a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u043e\u0440 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439.')) + '</p>' +
              '</div>' +
              '<div class="grammar-hub-stats">' +
                '<span><b>' + grammarTopics.length + '</b><small>' + esc(tr('grammar zones','\u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0437\u043e\u043d')) + '</small></span>' +
                '<span><b>' + totalBank + '</b><small>' + esc(tr('tasks in bank','\u0437\u0430\u0434\u0430\u043d\u0438\u0439 \u0432 \u0431\u0430\u043d\u043a\u0435')) + '</small></span>' +
                '<span><b>' + esc(level) + '</b><small>' + esc(tr('active level','\u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c')) + '</small></span>' +
              '</div>' +
            '</div>' +
            '<div class="grammar-bank-note">' +
              '<strong>' + esc(tr('Grammar base','\u0413\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0431\u0430\u0437\u0430')) + '</strong>' +
              '<p>' + esc(tr('Everything is grouped into a clean web hub so learners can quickly see where to start and what each grammar block trains.', '\u0412\u0441\u0451 \u0441\u043e\u0431\u0440\u0430\u043d\u043e \u0432 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0439 web-hub, \u0447\u0442\u043e\u0431\u044b \u0443\u0447\u0435\u043d\u0438\u043a \u0441\u0440\u0430\u0437\u0443 \u0432\u0438\u0434\u0435\u043b, \u0441 \u0447\u0435\u0433\u043e \u043d\u0430\u0447\u0430\u0442\u044c \u0438 \u0447\u0442\u043e \u0438\u043c\u0435\u043d\u043d\u043e \u0442\u0440\u0435\u043d\u0438\u0440\u0443\u0435\u0442 \u043a\u0430\u0436\u0434\u044b\u0439 \u0431\u043b\u043e\u043a.')) + '</p>' +
            '</div>' +
            '<div class="grammar-topic-grid">' + grammarTopics.map(function (item) {
              return '<article class="grammar-topic-card">' +
                '<div class="grammar-topic-top"><i>' + item.icon + '</i><span>' + esc(level) + '</span></div>' +
                '<h3>' + esc(item.title) + '</h3>' +
                '<p>' + esc(item.desc) + '</p>' +
                '<button type="button" data-grammar-entry="' + esc(item.id) + '"' + (item.tool ? ' data-grammar-tool="' + esc(item.tool) + '"' : '') + '>' + esc(item.cta) + ' <em>→</em></button>' +
              '</article>';
            }).join('') + '</div>' +
            '<div class="grammar-bank-strip">' +
              '<b>' + esc(tr('Included drills','\u0412 \u0431\u0430\u043d\u043a \u0432\u0445\u043e\u0434\u044f\u0442')) + '</b>' +
              '<div>' +
                '<span>DE · der / die / das</span>' +
                '<span>V · Perfekt</span>' +
                '<span>W? · ' + esc(tr('Questions','\u0412\u043e\u043f\u0440\u043e\u0441\u044b')) + '</span>' +
                '<span>⇄ · ' + esc(tr('Word order','\u041f\u043e\u0440\u044f\u0434\u043e\u043a \u0441\u043b\u043e\u0432')) + '</span>' +
              '</div>' +
            '</div>' +
          '</section>';
        Array.prototype.forEach.call(document.querySelectorAll('[data-grammar-entry]'), function (button) {
          button.onclick = function () {
            var directTool = button.getAttribute('data-grammar-tool');
            if (directTool) {
              openStudyTool(directTool);
              return;
            }
            studyState.grammarTopic = button.getAttribute('data-grammar-entry');
            studyState.data = null;
            renderGrammar();
          };
        });
        return;
      }
      if (!studyState.data) {
        var source=strictBank(GRAMMAR,studyState.lang,studyState.level);
        if (studyState.grammarTopic === 'articles' && studyState.lang === 'de') source=exactLevelItems(ARTICLES,studyState.level).map(function (item) { return { q:'___ ' + item.noun,opts:['der','die','das'],a:['der','die','das'].indexOf(item.art),level:item.level }; });
        if (studyState.grammarTopic === 'sentences' && studyState.lang === 'de') source=exactLevelItems(W_QUESTIONS,studyState.level);
        studyState.data = shuffle(source);
      }
      if(!studyState.data.length)return noLevelContent();
      quizStep(studyState.data, renderGrammar, function (item) { return item.q; });
    }

    // ---- 5. Word usage ----
    function renderWordUsage() {
      if (!studyState.data) {
        studyState.data=shuffle(strictBank(WORD_USAGE,studyState.lang,studyState.level)).map(function (item) {
          var correctIdx = item.opts.indexOf(item.a);
          return { q: item.s, opts: item.opts, a: correctIdx < 0 ? 0 : correctIdx };
        });
      }
      if(!studyState.data.length)return noLevelContent();
      quizStep(studyState.data, renderWordUsage, function (item) { return item.q; });
    }

    // shared MCQ step for grammar + word usage
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
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.q); }
          else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq');
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
        action: tool === 'writing' ? 'evaluate-writing' : 'evaluate-speaking',
        language: studyState.lang,
        level: (loadPrefs().levels || {})[studyState.lang] || 'A1',
        nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US'
      }, payload || {});
      var response = await supa.functions.invoke('practice-ai-evaluate', { body:body });
      if (response.error || !response.data || !response.data.evaluation) {
        throw new Error(response.error && response.error.message || response.data && response.data.error || tr('AI evaluation is temporarily unavailable.','AI-проверка временно недоступна.'));
      }
      if (uid()) {
        supa.from('practice_ai_evaluations').insert({
          user_id:uid(), tool_id:tool, language:body.language, level:body.level,
          prompt:body.prompt || body.expected || '', answer_text:body.text || body.transcript || '',
          result:response.data.evaluation, model:response.data.model || null
        }).then(function(){},function(){});
      }
      return response.data.evaluation;
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

    async function playListeningAudio(prepared, rate, runId, onPlaying, unlockedAudio) {
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

    function setListeningButtonState(button, state, label) {
      if (!button) return;
      button.dataset.state = state;
      button.innerHTML = '<span class="listening-play-icon" aria-hidden="true">' + (state === 'playing' ? '▮▮' : state === 'loading' ? '•••' : '▶') + '</span><span>' + esc(label) + '</span>';
      var player = button.closest && button.closest('.listening-player');
      if (player) player.classList.toggle('is-playing', state === 'playing');
    }

    function renderListening() {
      if (!studyState.skillDirect) return renderSkillsHub();
      stopListeningPlayback();
      if (!studyState.data) studyState.data=shuffle(strictBank(LISTEN,studyState.lang,studyState.level));
      var deck = studyState.data;
      if(!deck.length)return noLevelContent();
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 3);
      var item = deck[studyState.idx];
      studyState.total = deck.length;
      updatePracticeChrome();
      if (item.audioClip) prepareListeningRecording(item.audioClip).catch(function () { /* Fish is prepared on demand */ });
      var host = $('#studyToolBody');
      host.innerHTML = '<div class="listening-lab">' +
        '<header class="listening-task-head"><div><span>' + esc(tr('STEP 1 · LISTEN', 'ШАГ 1 · СЛУШАЙТЕ')) + '</span><h2>' + esc(tr('Listen to the phrase', 'Прослушайте фразу')) + '</h2><p>' + esc(tr('You can replay it and change the speed before answering.', 'Можно прослушать повторно и изменить скорость перед ответом.')) + '</p></div><b>' + (studyState.idx + 1) + ' / ' + deck.length + '</b></header>' +
        '<section class="listening-player" aria-labelledby="listeningPlayerTitle">' +
          '<div class="listening-player-copy"><span id="listeningPlayerTitle">' + esc(tr('AUDIO', 'АУДИО')) + '</span><strong>' + esc(tr('Ready to play', 'Готово к прослушиванию')) + '</strong></div>' +
          '<div class="listening-wave" aria-hidden="true">' + '<i></i>'.repeat(18) + '</div>' +
          '<button class="listening-play" id="lsPlay" type="button" aria-live="polite"><span class="listening-play-icon" aria-hidden="true">▶</span><span>' + esc(tr('Play audio', 'Прослушать')) + '</span></button>' +
          '<div class="listening-player-meta"><div id="lsAudioStatus" role="status">' + esc(tr('Press play when you are ready.', 'Нажмите «Прослушать», когда будете готовы.')) + '</div><button id="lsRate" type="button" aria-label="' + esc(tr('Playback speed', 'Скорость воспроизведения')) + '">' + Number(studyState.speechRate || 1) + '×</button></div>' +
          '<div class="listening-context"><span>' + esc(tr('CONTEXT HINT', 'ПОДСКАЗКА ПО КОНТЕКСТУ')) + '</span><p>' + esc(item.hint) + '</p></div>' +
        '</section>' +
        '<form class="listening-answer" id="lsForm"><label for="lsInput"><span>' + esc(tr('STEP 2 · WRITE', 'ШАГ 2 · ЗАПИШИТЕ')) + '</span><b>' + esc(tr('Type exactly what you hear', 'Запишите точно то, что услышали')) + '</b></label>' +
          '<input id="lsInput" placeholder="' + esc(tr('Start typing the phrase…', 'Начните вводить фразу…')) + '" autocomplete="off" spellcheck="false">' +
          '<div class="listening-answer-foot"><small>' + esc(tr('Press Enter to check your answer', 'Нажмите Enter, чтобы проверить ответ')) + '</small><button class="btn primary" id="lsCheck" type="submit" disabled>' + esc(tr('Check answer', 'Проверить ответ')) + '</button></div>' +
        '</form><div id="lsFb" class="listening-feedback" aria-live="polite"></div></div>';
      $('#lsInput').addEventListener('input', function () {
        $('#lsCheck').disabled = !this.value.trim();
      });
      $('#lsRate').addEventListener('click', function () {
        var rates = [1, .75, 1.25];
        var current = Number(studyState.speechRate || 1);
        var index = rates.indexOf(current);
        studyState.speechRate = rates[(index + 1) % rates.length];
        this.textContent = studyState.speechRate + '×';
      });
      $('#lsPlay').addEventListener('click', async function () {
        var button = $('#lsPlay');
        var status = $('#lsAudioStatus');
        var rate = Number(studyState.speechRate || 1);
        stopListeningPlayback();
        var runId = listeningPlaybackRun;
        var unlockedAudio = unlockListeningAudio();
        button.disabled = true;
        var preferredPreparation = (item.audioClip
          ? prepareListeningRecording(item.audioClip)
          : prepareListeningFish(item.text, studyState.lang, rate))
          .then(function (value) { return { value: value, error: null }; })
          .catch(function (error) { return { value: null, error: error }; });
        var countdownComplete = await runListeningCountdown(button, status, runId);
        if (!countdownComplete) return;
        try {
          setListeningButtonState(button, 'loading', tr('Loading audio', 'Загрузка аудио'));
          status.textContent = item.audioClip
            ? tr('Loading the original recording…', 'Загружаем оригинальную запись…')
            : tr('Preparing Fish Audio…', 'Готовим Fish Audio…');
          var preparedResult = await preferredPreparation;
          if (preparedResult.error || !preparedResult.value) throw preparedResult.error || new Error('audio unavailable');
          var preferred = preparedResult.value;
          await playListeningAudio(preferred, rate, runId, function () {
            setListeningButtonState(button, 'playing', tr('Playing', 'Воспроизведение'));
            status.textContent = item.audioClip
              ? tr('Original recording', 'Оригинальная запись')
              : 'Fish Audio';
          }, unlockedAudio);
          if (runId === listeningPlaybackRun) {
            button.disabled = false;
            setListeningButtonState(button, 'ready', tr('Play again', 'Прослушать ещё раз'));
            var listeningInput = $('#lsInput');
            if (listeningInput) listeningInput.focus();
          }
        } catch (recordingError) {
          if (runId !== listeningPlaybackRun) return;
          if (item.audioClip) {
            try {
              setListeningButtonState(button, 'loading', tr('Loading audio', 'Загрузка аудио'));
              status.textContent = tr('Recording unavailable. Preparing Fish Audio…', 'Запись недоступна. Готовим Fish Audio…');
              var fish = await prepareListeningFish(item.text, studyState.lang, rate);
              await playListeningAudio(fish, rate, runId, function () {
                setListeningButtonState(button, 'playing', tr('Playing', 'Воспроизведение'));
                status.textContent = 'Fish Audio';
              }, unlockedAudio);
              if (runId === listeningPlaybackRun) {
                button.disabled = false;
                setListeningButtonState(button, 'ready', tr('Play again', 'Прослушать ещё раз'));
                var fishInput = $('#lsInput');
                if (fishInput) fishInput.focus();
              }
              return;
            } catch (fishError) {
              if (runId !== listeningPlaybackRun) return;
            }
          }
          try {
            playListeningBrowserFallback(item.text, studyState.lang, rate, runId, button, status);
            return;
          } catch (fallbackError) {
            // Surface the concrete reason instead of a generic retry prompt —
            // recordingError is the first failure in the chain (clip download
            // or the Fish edge function), which is what actually needs fixing.
            var reason = (recordingError && recordingError.message) || tr('unknown error', 'неизвестная ошибка');
            status.textContent = tr('Audio could not be played: ', 'Аудио не воспроизвелось: ') + reason;
          }
        }
        if (runId === listeningPlaybackRun) {
          button.disabled = false;
          setListeningButtonState(button, 'ready', tr('Try audio again', 'Попробовать ещё раз'));
        }
      });
      function norm(s) { return String(s || '').toLowerCase().replace(/[.,!?¿¡;:"']/g, '').replace(/\s+/g, ' ').trim(); }
      $('#lsForm').addEventListener('submit', function (event) {
        event.preventDefault();
        stopListeningPlayback();
        var val = norm($('#lsInput').value);
        if (!val) return;
        var target = norm(item.text);
        var ok = val === target;
        if (!ok && val.length) {
          var vw = val.split(' '), tw = target.split(' ');
          var hits = vw.filter(function (w) { return tw.indexOf(w) >= 0; }).length;
          ok = hits / tw.length >= 0.8;
        }
        if (ok) studyState.score++;
        feedback(ok, { kind:'listening', prompt:item.hint, answer:val, expected:item.text });
        var feedbackHost = $('#lsFb');
        feedbackHost.className = 'listening-feedback ' + (ok ? 'ok' : 'bad');
        feedbackHost.innerHTML = '<div><span>' + (ok ? '✓' : '!') + '</span><div><b>' + esc(ok ? tr('Correct — you heard it accurately.', 'Верно — вы точно распознали фразу.') : tr('Compare your answer with the original phrase.', 'Сравните свой ответ с исходной фразой.')) + '</b>' +
          (ok ? '' : '<p>' + esc(item.text) + '</p>') + '</div></div><button class="btn primary" id="lsContinue" type="button">' + esc(tr('Continue', 'Продолжить')) + '</button>';
        $('#lsCheck').disabled = true;
        $('#lsInput').disabled = true;
        $('#lsPlay').disabled = true;
        $('#lsRate').disabled = true;
        $('#lsContinue').addEventListener('click', function () { studyState.idx++; renderListening(); });
        $('#lsContinue').focus();
      });
    }

    // ---- 7. Reading lab ----
    function renderReading() {
      if (!studyState.skillDirect) return renderSkillsHub();
      if (!studyState.data) {
        var passages=strictBank(READING,studyState.lang,studyState.level);
        if(!passages.length)return noLevelContent();
        studyState.data={passage:passages[0],qIdx:0,answered:false};
      }
      var d = studyState.data;
      var passage = d.passage;
      var host = $('#studyToolBody');
      if (d.qIdx >= passage.questions.length) {
        return finishTool(studyState.score + ' / ' + passage.questions.length, passage.questions.length * 3);
      }
      var question = passage.questions[d.qIdx];
      host.innerHTML =
        '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--panel-soft);margin-bottom:14px">' +
          '<h3 style="margin:0 0 8px">' + esc(passage.title) + '</h3>' +
          '<p style="line-height:1.6;margin:0">' + esc(passage.text) + '</p>' +
        '</div>' +
        counterHtml(d.qIdx, passage.questions.length) +
        '<div style="font-weight:900;margin-bottom:10px">' + esc(question.q) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        question.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-ropt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="rdFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-ropt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-ropt'));
          var ok = chosen === question.a;
          if (ok) studyState.score++;
          Array.prototype.forEach.call(host.querySelectorAll('[data-ropt]'), function (b) { b.disabled = true; });
          $('#rdFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(question.opts[question.a]) + '</span>';
          $('#rdFb').insertAdjacentHTML('beforeend','<p class="answer-explanation">'+esc(answerExplanation(question))+'</p><button class="btn primary answer-continue" id="readingContinue">'+esc(tr('Continue','Продолжить'))+' →</button>');
          $('#readingContinue').onclick=function(){d.qIdx++;renderReading();};
        });
      });
    }

    // ---- 8. Writing lab (self-check) ----
    function renderWriting() {
      if (!studyState.skillDirect) return renderSkillsHub();
      if (!studyState.data) {
        var picks=shuffle(strictBank(WRITING,studyState.lang,studyState.level));
        if(!picks.length)return noLevelContent();
        studyState.data = picks[0];
        studyState.checked = {};
      }
      var task = studyState.data;
      var host = $('#studyToolBody');
      var checkedCount = Object.keys(studyState.checked).filter(function (k) { return studyState.checked[k]; }).length;
      host.innerHTML =
        '<div style="font-weight:900;margin-bottom:10px">' + esc(task.prompt) + '</div>' +
        '<textarea id="wrText" rows="6" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit" placeholder="' + esc(tr('Write here...', 'Пишите здесь...')) + '">' + esc(studyState.writingDraft||'') + '</textarea>' +
        '<div style="color:var(--soft);font-weight:700;font-size:12px;margin:6px 0 12px" id="wrCount">0 ' + esc(tr('words', 'слов')) + '</div>' +
        '<div style="font-weight:900;margin-bottom:6px">' + esc(tr('Self-check', 'Самопроверка')) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
        task.checklist.map(function (item, i) {
          return '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
            '<input type="checkbox" data-chk="' + i + '"' + (studyState.checked[i] ? ' checked' : '') + '>' +
            '<span>' + esc(item) + '</span></label>';
        }).join('') + '</div>' +
        '<div id="writingEvaluation">'+(studyState.writingEvaluation||'')+'</div><div class="writing-actions"><button class="btn" id="wrEvaluate">✨ '+esc(tr('Evaluate my writing','Проверить мою работу'))+'</button><button class="btn" id="wrSend">📨 '+esc(tr('Send to teacher','Отправить преподавателю'))+'</button><button class="btn primary" id="wrDone"' + (checkedCount < task.checklist.length ? ' disabled' : '') + '>' + esc(tr('Finish', 'Завершить')) + '</button></div>';
      $('#wrText').addEventListener('input', function () {
        studyState.writingDraft=$('#wrText').value;
        var words = $('#wrText').value.trim().split(/\s+/).filter(Boolean).length;
        $('#wrCount').textContent = words + ' ' + tr('words', 'слов');
      });
      $('#wrSend').onclick=function(){submitForTeacher('writing',$('#wrText').value,null);};
      $('#wrEvaluate').onclick=async function(){var text=$('#wrText').value.trim(),words=text.split(/\s+/).filter(Boolean);if(words.length<8)return alert(tr('Write a little more before evaluation.','Напишите немного больше перед проверкой.'));studyState.writingDraft=text;var button=this;button.disabled=true;button.textContent=tr('AI is checking…','AI проверяет…');$('#writingEvaluation').innerHTML='<div class="ai-checking"><i></i><span>'+esc(tr('Checking task completion, grammar, vocabulary and clarity…','Проверяем выполнение задания, грамматику, словарь и ясность…'))+'</span></div>';try{var evaluation=await requestAiEvaluation('writing',{text:text,prompt:task.prompt});studyState.writingEvaluation=evaluationHtml(evaluation);renderWriting();}catch(error){button.disabled=false;button.textContent='✨ '+tr('Evaluate my writing','Проверить мою работу');$('#writingEvaluation').innerHTML='<p class="practice-warning">'+esc(error.message)+'</p>';}};
      Array.prototype.forEach.call(host.querySelectorAll('[data-chk]'), function (chk) {
        chk.addEventListener('change', function () {
          studyState.checked[chk.getAttribute('data-chk')] = chk.checked;
          renderWriting();
        });
      });
      $('#wrDone').addEventListener('click', function () {
        if ($('#wrDone').disabled) return;
        finishTool(tr('Checklist complete', 'Чек-лист выполнен'), 10);
      });
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
      if(section.id==='reading'){var passage=strictBank(READING,studyState.lang,studyState.level)[0];if(!passage)return noLevelContent();deck=passage.questions.map(function(q){return {q:q.q,opts:q.opts,a:q.a,context:passage.text};});}
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
        if (studyState.examType === 'reading') { var passage=strictBank(READING,studyState.lang,studyState.level)[0];if(!passage)return noLevelContent();studyState.data=passage.questions.slice(); }
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
        var kit = duelTeacherKit(), selectedTopic = studyState.duelTopic || kit.topic || 'all', selectedMode = studyState.duelMode || kit.mode || 'students';
        studyState.duelTopic = selectedTopic;studyState.duelMode = selectedMode;
        var duelBankTotal = buildDuelDeck(studyState.lang, studyState.level, selectedTopic).length, joinCode = duelJoinCode(studyState.lang, studyState.level);
        host.innerHTML='<div class="social-challenge duel-search-card"><div class="duel-search-orbit"><span>⚔️</span><i></i><i></i><i></i></div><small>DUVELA LIVE DUEL</small><h2>'+esc(tr('Find an opponent','Найти соперника'))+'</h2><p>'+esc(tr('We search for a live opponent at your level first. If nobody is online, Duvela Bot starts immediately so the LIVE never waits.','Сначала ищем живого соперника вашего уровня. Если онлайн никого нет, Duvela Bot стартует сразу, чтобы LIVE не ждал.'))+'</p><div class="duel-teacher-panel"><div class="duel-panel-head"><div><small>TEACHER CONTROL</small><b>'+esc(tr('Run the room from one screen','Управляйте эфиром с одного экрана'))+'</b></div><strong id="duelJoinCode">'+esc(joinCode)+'</strong></div><div class="duel-control-row"><span>'+esc(tr('Mode','Режим'))+'</span>'+duelModeList().map(function(item){return '<button type="button" data-duel-mode="'+esc(item[0])+'" class="'+(item[0]===selectedMode?'active':'')+'">'+esc(item[1])+'</button>';}).join('')+'</div><div class="duel-control-row"><span>'+esc(tr('Topic','Тема'))+'</span>'+duelTopicList().map(function(item){return '<button type="button" data-duel-topic="'+esc(item[0])+'" class="'+(item[0]===selectedTopic?'active':'')+'">'+esc(item[1])+'</button>';}).join('')+'</div><div class="duel-control-row compact"><span>'+esc(tr('Level','Уровень'))+'</span>'+['A1','A2','B1','B2','C1','C2'].map(function(level){return '<button type="button" data-duel-level="'+level+'" class="'+(level===String(studyState.level||'A1').toUpperCase()?'active':'')+'">'+level+'</button>';}).join('')+'<button type="button" data-duel-topic-random="1">'+esc(tr('Generate lesson','Сгенерировать урок'))+'</button></div></div><div class="duel-search-stats"><span><b>'+DUEL_QUESTION_COUNT+'</b><small>'+esc(tr('questions','вопросов'))+'</small></span><span><b id="duelLobbyLevel">'+esc(studyState.level || 'A1')+'</b><small>'+esc(tr('level','уровень'))+'</small></span><span><b id="duelLobbyBank">'+esc(duelBankTotal)+'</b><small>'+esc(tr('duel bank','банк дуэли'))+'</small></span><span><b>'+esc(String(kit.streak||0))+'</b><small>'+esc(tr('teacher streak','серия учителя'))+'</small></span></div><div class="duel-join-strip"><span>'+esc(tr('Students join','Ученики заходят'))+': <b>vela.cafe</b></span><span>'+esc(tr('Code','Код'))+': <b id="duelJoinCodeInline">'+esc(joinCode)+'</b></span><span>'+esc(duelModeLabel(selectedMode))+' · '+esc(duelTopicLabel(selectedTopic))+'</span></div><div class="social-score duel-search-score"><b id="myChallengeScore">0</b><span>VS</span><b id="opponentScore">—</b></div><div id="challengeMembers" class="duel-status duel-search-status">'+esc(tr('Ready to search','Готово к поиску'))+'</div><div class="duel-search-flow"><span>👥 '+esc(tr('Live opponent','живой соперник'))+'</span><span>🤖 '+esc(tr('Bot fallback','бот если никого нет'))+'</span><span>💬 '+esc(tr('A/B/C/D chat','A/B/C/D в чат'))+'</span><span>🏁 '+esc(tr('Winner screen','экран победителя'))+'</span></div><button class="btn primary" id="socialStart">'+esc(tr('Start LIVE duel','Запустить LIVE-дуэль'))+'</button></div>';
        bindDuelLobbyControls(host);
      } else
      host.innerHTML='<div class="social-challenge"><span>'+(team?'👥':'⚔️')+'</span><small>DUVELA '+(team?'TEAM':'DUEL')+'</small><h2>'+esc(team?tr('Team challenge','Командное задание'):tr('Find an opponent','Найти соперника'))+'</h2><p>'+esc(team?tr('Complete 30 correct answers together this week.','Вместе дайте 30 правильных ответов за неделю.'):tr('First we look for a learner online. If nobody is available, you play immediately against the Duvela Bot.','Сначала ищем ученика онлайн. Если никого нет, вы сразу играете с ботом Duvela.'))+'</p><div class="social-score"><b id="myChallengeScore">0</b><span>'+(team?'TEAM':'VS')+'</span><b id="opponentScore">—</b></div><div id="challengeMembers" class="duel-status">'+esc(team?tr('Team matchmaking is ready','Командный подбор готов'):tr('Ready to search','Готово к поиску'))+'</div><button class="btn primary" id="socialStart">'+esc(team?tr('Join a team','Вступить в команду'):tr('Find opponent','Найти соперника'))+'</button></div>';
      $('#socialStart').onclick=async function(){
        var button=this;if(team)return startLegacyTeam(button);button.disabled=true;
        var seconds=4,status=$('#challengeMembers'),challenge=null,foundOpponent=false;
        button.textContent=tr('Searching online…','Ищем онлайн…');
        status.innerHTML='<span class="duel-search-dot"></span>'+esc(tr('Looking for a live opponent at your level','Ищем живого соперника вашего уровня'))+' · <b id="duelSearchSeconds">'+seconds+'</b>';
        try{
          if(uid()){
            var prefs=loadPrefs(),level=(prefs.levels||{})[studyState.lang]||'A1';
            var waiting=await supa.from('practice_challenges').select('id,created_by,goal').eq('kind','duel').eq('status','waiting').eq('language',studyState.lang).neq('created_by',uid()).order('created_at',{ascending:true}).limit(1).maybeSingle();
            challenge=waiting.data;
            if(challenge){foundOpponent=true;await supa.from('practice_challenges').update({status:'active',starts_at:new Date().toISOString()}).eq('id',challenge.id);}
            else {var created=await supa.from('practice_challenges').insert({kind:'duel',created_by:uid(),language:studyState.lang,level:level,goal:DUEL_QUESTION_COUNT,status:'waiting'}).select().single();if(!created.error)challenge=created.data;}
            if(challenge)await supa.from('practice_challenge_members').upsert({challenge_id:challenge.id,user_id:uid(),score:0,completed:0});
          }
        }catch(e){challenge=null;}
        function launch(bot){
          if(studyState.searchTimerId)clearInterval(studyState.searchTimerId);
          studyState.searchTimerId=null;studyState.challengeId=challenge&&challenge.id||null;studyState.duelBot=bot;
          studyState.duelOpponentName=bot?tr('Duvela Bot','Бот Duvela'):tr('Live opponent','Соперник онлайн');
          var kit=duelTeacherKit();kit.topic=studyState.duelTopic||kit.topic||'all';kit.mode=studyState.duelMode||kit.mode||'students';saveDuelTeacherKit(kit);
          var duelDeck=buildDuelDeck(studyState.lang,studyState.level,kit.topic);
          studyState.duelOpponentScore=0;studyState.tool='duelmatch';studyState.duelTopic=kit.topic;studyState.duelMode=kit.mode;studyState.duelJoinCode=duelJoinCode(studyState.lang,studyState.level);studyState.data=duelDeck.slice(0,DUEL_QUESTION_COUNT);studyState.duelBankTotal=duelDeck.length;studyState.idx=0;studyState.score=0;studyState.total=DUEL_QUESTION_COUNT;studyState.duelPoll=null;studyState.duelPollIndex=-1;
          $('#studyOverlayTitle').textContent='⚔️ '+tr('Learner duel','Дуэль учеников');renderTool();
        }
        if(foundOpponent)return launch(false);
        studyState.searchTimerId=setInterval(async function(){
          seconds--;var counter=$('#duelSearchSeconds');if(counter)counter.textContent=Math.max(0,seconds);
          if(challenge&&uid())try{var members=await supa.from('practice_challenge_members').select('user_id').eq('challenge_id',challenge.id);if((members.data||[]).some(function(row){return row.user_id!==uid();})){foundOpponent=true;launch(false);return;}}catch(e){}
          if(seconds<=0){if(challenge)try{await supa.from('practice_challenges').update({status:'completed'}).eq('id',challenge.id);}catch(e){}launch(true);}
        },1000);
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

    function buildDuelDeck(lang, level, topic) {
      var deck = [];
      strictBank(GRAMMAR, lang, level).forEach(function (item) {
        if (item && item.opts && item.opts.length === 4) deck.push({ q:item.q, opts:item.opts, a:item.a, level:item.level });
      });
      strictBank(WORD_USAGE, lang, level).forEach(function (item) {
        var answer = item && item.opts ? item.opts.indexOf(item.a) : -1;
        if (item && item.opts && item.opts.length === 4) deck.push({ q:item.s, opts:item.opts, a:answer < 0 ? 0 : answer, level:item.level });
      });
      var seen = {};
      deck = shuffle(deck).filter(function (item) {
        var key = item.q + '|' + item.opts.join('|');
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

    function duelTeacherKit() {
      try {
        return Object.assign({ topic:'all',mode:'students',streak:0,lastDay:'',totalLives:0 }, JSON.parse(localStorage.getItem(DUEL_TEACHER_KEY) || '{}'));
      } catch (e) {
        return { topic:'all',mode:'students',streak:0,lastDay:'',totalLives:0 };
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
      return [
        ['all', tr('Mixed lesson','Смешанный урок')],
        ['life', tr('Daily life','Быт / Alltag')],
        ['school', tr('School','Школа')],
        ['work', tr('Work','Работа')],
        ['exam', tr('Exam prep','Экзамен')],
        ['grammar', tr('Grammar','Грамматика')]
      ];
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

    function orderDuelDeckByTopic(deck, topic) {
      if (!topic || topic === 'all') return deck;
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
      return primary.length >= DUEL_QUESTION_COUNT ? primary.concat(secondary) : deck;
    }

    function duelPollSeed(item) {
      var counts = [0,0,0,0], base = String(item && item.q || '');
      for (var i = 0; i < Math.min(9, base.length); i++) counts[(base.charCodeAt(i) + i) % 4]++;
      return counts;
    }

    function duelPollHtml(item) {
      var counts = studyState.duelPoll || [0,0,0,0];
      var total = counts.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      return '<div class="duel-chat-poll" id="duelChatPoll"><div class="duel-poll-head"><div><small>CHAT POLL</small><b>'+esc(tr('Tap votes from LIVE chat','Нажимайте голоса из LIVE-чата'))+'</b></div><strong>'+total+'</strong></div><div class="duel-poll-bars">'+counts.map(function(count,index){var pct=total?Math.round(count/total*100):0;return '<button type="button" data-duel-vote="'+index+'"><span>'+String.fromCharCode(65+index)+'</span><i><em style="width:'+pct+'%"></em></i><strong>'+pct+'%</strong></button>';}).join('')+'</div><div class="duel-poll-actions"><button type="button" data-duel-vote-burst="1">+ '+esc(tr('chat wave','волна чата'))+'</button><button type="button" data-duel-vote-reset="1">'+esc(tr('reset poll','сброс'))+'</button></div></div>';
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

    function bindDuelLobbyControls(host) {
      function refresh() {
        var kit = duelTeacherKit();
        kit.topic = studyState.duelTopic || kit.topic || 'all';
        kit.mode = studyState.duelMode || kit.mode || 'students';
        saveDuelTeacherKit(kit);
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-topic') === studyState.duelTopic); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-mode]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-mode') === studyState.duelMode); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-level]'), function (button) { button.classList.toggle('active', button.getAttribute('data-duel-level') === String(studyState.level || 'A1').toUpperCase()); });
        var bank = buildDuelDeck(studyState.lang, studyState.level, studyState.duelTopic).length, code = duelJoinCode(studyState.lang, studyState.level);
        var levelNode = $('#duelLobbyLevel'), bankNode = $('#duelLobbyBank'), codeNode = $('#duelJoinCode'), inlineCode = $('#duelJoinCodeInline'), strip = host.querySelector('.duel-join-strip span:last-child');
        if (levelNode) levelNode.textContent = studyState.level || 'A1';
        if (bankNode) bankNode.textContent = bank;
        if (codeNode) codeNode.textContent = code;
        if (inlineCode) inlineCode.textContent = code;
        if (strip) strip.textContent = duelModeLabel(studyState.duelMode) + ' · ' + duelTopicLabel(studyState.duelTopic);
      }
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-topic]'), function (button) {
        button.onclick = function () { studyState.duelTopic = button.getAttribute('data-duel-topic') || 'all'; refresh(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-mode]'), function (button) {
        button.onclick = function () { studyState.duelMode = button.getAttribute('data-duel-mode') || 'students'; refresh(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-level]'), function (button) {
        button.onclick = function () { studyState.level = button.getAttribute('data-duel-level') || 'A1'; studyState.data = null; refresh(); };
      });
      var random = host.querySelector('[data-duel-topic-random]');
      if (random) random.onclick = function () {
        var topics = duelTopicList().filter(function (item) { return item[0] !== 'all'; });
        studyState.duelTopic = topics[Math.floor(Math.random() * topics.length)][0];
        refresh();
      };
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
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-vote]'), function (button) {
        button.onclick = function () {
          var index = Number(button.getAttribute('data-duel-vote'));
          if (!studyState.duelPoll) studyState.duelPoll = [0,0,0,0];
          studyState.duelPoll[index] = Number(studyState.duelPoll[index] || 0) + 1;
          updateDuelPoll();
        };
      });
      var burst = host.querySelector('[data-duel-vote-burst]');
      if (burst) burst.onclick = function () {
        if (!studyState.duelPoll) studyState.duelPoll = [0,0,0,0];
        for (var i = 0; i < 8; i++) studyState.duelPoll[Math.floor(Math.random() * 4)]++;
        updateDuelPoll();
      };
      var reset = host.querySelector('[data-duel-vote-reset]');
      if (reset) reset.onclick = function () { studyState.duelPoll = [0,0,0,0]; updateDuelPoll(); };
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
        if(studyState.duelBot)studyState.duelTimerId=setInterval(function(){
          if(!studyState||studyState.tool!=='duelmatch'||studyState.finished)return;
          if(studyState.duelPaused)return;
          if(studyState.duelOpponentScore<DUEL_QUESTION_COUNT&&Math.random()<.72)studyState.duelOpponentScore++;
          updateDuelScoreboard();
        },4200);
      }
      if(studyState.idx>=deck.length)return finishDuelMatch();
      var item=deck[studyState.idx];
      if(studyState.duelPollIndex!==studyState.idx){studyState.duelPoll=[0,0,0,0];studyState.duelPollIndex=studyState.idx;}
      var playerLabel=studyState.duelMode==='teacher'?tr('TEACHER','УЧИТЕЛЬ'):studyState.duelMode==='class'?tr('CLASS','КЛАСС'):tr('YOU','ВЫ');
      var opponentLabel=studyState.duelMode==='teacher'?tr('Students','Ученики'):(studyState.duelBot?tr('Duvela Bot','Бот Duvela'):studyState.duelOpponentName);
      var pauseClass=studyState.duelPaused?' class="active"':'',pauseText=studyState.duelPaused?tr('Resume','Продолжить'):tr('Pause','Пауза');
      host.innerHTML='<div class="duel-live-masthead"><div><small>DUVELA</small><strong>'+esc(tr('LANGUAGE DUEL','\u042f\u0417\u042b\u041a\u041e\u0412\u0410\u042f \u0414\u0423\u042d\u041b\u042c'))+'</strong></div><span><i></i> LIVE</span></div><div class="duel-live-toolbar"><span>'+esc(tr('For TikTok LIVE: capture the vertical game area','\u0414\u043b\u044f TikTok LIVE: \u0437\u0430\u0445\u0432\u0430\u0442\u0438\u0442\u0435 \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u0443\u044e \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0438\u0433\u0440\u044b'))+'</span><button type="button" id="duelLiveToggle" aria-pressed="false"><span aria-hidden="true">&#9679;</span>LIVE 9:16</button></div><div class="duel-teacher-live-panel"><div><small>'+esc(duelModeLabel(studyState.duelMode))+'</small><b>'+esc(duelTopicLabel(studyState.duelTopic))+'</b></div><span>'+esc(tr('Join','Вход'))+' <b>vela.cafe</b> · <strong>'+esc(studyState.duelJoinCode||duelJoinCode(studyState.lang,studyState.level))+'</strong></span><button type="button" data-duel-teacher-action="pause"'+pauseClass+'>'+esc(pauseText)+'</button><button type="button" data-duel-teacher-action="answer">'+esc(tr('Show answer','Ответ'))+'</button><button type="button" data-duel-teacher-action="next">'+esc(tr('Next','Дальше'))+'</button></div><p class="duel-live-audience">'+esc(tr('Choose the answer in chat: A, B, C or D','\u041f\u0438\u0448\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442 \u0432 \u0447\u0430\u0442: A, B, C \u0438\u043b\u0438 D'))+'</p><div class="duel-match-head"><div><span class="duel-avatar me">'+esc((ctx.profile&&ctx.profile.full_name||'D').charAt(0).toUpperCase())+'</span><small>'+esc(playerLabel)+'</small><b id="duelMyLive">'+studyState.score+'</b></div><strong>VS</strong><div><span class="duel-avatar bot">'+(studyState.duelBot?'🤖':'👥')+'</span><small>'+esc(opponentLabel)+'</small><b id="duelOpponentLive">'+studyState.duelOpponentScore+'</b></div></div><div class="duel-question"><small>'+esc(tr('SAME QUESTION FOR BOTH','ОДИНАКОВЫЙ ВОПРОС ДЛЯ ОБОИХ'))+'</small><h2>'+esc(item.q)+'</h2></div>'+duelPollHtml(item)+'<div class="duel-options">'+item.opts.map(function(option,index){return '<button data-duel-answer="'+index+'"><span>'+String.fromCharCode(65+index)+'</span>'+esc(option)+'</button>';}).join('')+'</div><div id="duelAnswerFeedback"></div>';
      bindDuelLiveControls(host);
      var liveTitle = host.querySelector('.duel-live-masthead strong');
      if (liveTitle) liveTitle.insertAdjacentHTML('afterend', '<em class="duel-live-bank">LEVEL ' + esc(studyState.level || 'A1') + ' / BANK ' + esc(studyState.duelBankTotal || deck.length) + ' / Q ' + esc(String(studyState.idx + 1)) + '/' + esc(String(deck.length)) + '</em>');
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-teacher-action]'),function(button){button.onclick=function(){
        var action=button.getAttribute('data-duel-teacher-action');
        if(action==='pause'){studyState.duelPaused=!studyState.duelPaused;button.classList.toggle('active',studyState.duelPaused);button.textContent=studyState.duelPaused?tr('Resume','Продолжить'):tr('Pause','Пауза');}
        if(action==='answer'){var correct=host.querySelector('[data-duel-answer="'+item.a+'"]');if(correct)correct.classList.add('correct');}
        if(action==='next'){studyState.idx++;renderDuelMatch();}
      };});
      Array.prototype.forEach.call(host.querySelectorAll('[data-duel-answer]'),function(button){button.onclick=function(){
        var selected=Number(button.getAttribute('data-duel-answer')),ok=selected===item.a;
        Array.prototype.forEach.call(host.querySelectorAll('[data-duel-answer]'),function(node){node.disabled=true;var value=Number(node.getAttribute('data-duel-answer'));if(value===item.a)node.classList.add('correct');else if(value===selected)node.classList.add('wrong');});
        feedback(ok,{prompt:item.q,chosen:item.opts[selected],correct:item.opts[item.a],explanation:answerExplanation(item)});if(ok)studyState.score++;else logMistake(studyState.lang,item.q,item.opts,item.a,'duel');
        updateDuelScoreboard();if(studyState.challengeId&&uid())supa.from('practice_challenge_members').update({score:studyState.score,completed:studyState.idx+1}).eq('challenge_id',studyState.challengeId).eq('user_id',uid()).then(function(){});
        $('#duelAnswerFeedback').innerHTML='<div class="inline-answer '+(ok?'ok':'bad')+'"><b>'+esc(ok?tr('Point for you!','Очко вам!'):tr('The opponent can get ahead','Соперник может выйти вперёд'))+'</b><p>'+esc(item.opts[item.a])+'</p><button class="btn primary" id="duelContinue">'+esc(studyState.idx+1>=deck.length?tr('Show result','Показать результат'):tr('Next question','Следующий вопрос'))+' →</button></div>';
        $('#duelContinue').onclick=function(){studyState.idx++;renderDuelMatch();};
      };});
    }

    function updateDuelScoreboard(){var mine=$('#duelMyLive'),opponent=$('#duelOpponentLive');if(mine)mine.textContent=studyState.score;if(opponent)opponent.textContent=studyState.duelOpponentScore;}

    async function finishDuelMatch(){
      if(studyState.duelTimerId){clearInterval(studyState.duelTimerId);studyState.duelTimerId=null;}
      var coach = $('#practiceCoach');
      if (coach) { coach.hidden = true; coach.innerHTML = ''; }
      if(!studyState.duelBot&&studyState.challengeId&&uid())try{var members=await supa.from('practice_challenge_members').select('user_id,score').eq('challenge_id',studyState.challengeId);var rival=(members.data||[]).find(function(row){return row.user_id!==uid();});studyState.duelOpponentScore=Number(rival&&rival.score||0);}catch(e){}
      var mine=Number(studyState.score||0),rivalScore=Number(studyState.duelOpponentScore||0),won=mine>rivalScore,tie=mine===rivalScore,xp=won?25:tie?15:10,accuracy=Math.round(mine/Math.max(1,DUEL_QUESTION_COUNT)*100),kit=updateDuelTeacherStreak(),code=studyState.duelJoinCode||duelJoinCode(studyState.lang,studyState.level);
      studyState.finished=true;bumpProgress('duel',xp);if(!uid())awardXp(xp);clearResume();
      $('#studyToolBody').innerHTML='<div class="duel-result '+(won?'win':tie?'tie':'lose')+'"><span>'+(won?'🏆':tie?'🤝':'💪')+'</span><small>DUVELA DUEL · '+esc(duelModeLabel(studyState.duelMode))+'</small><h2>'+esc(won?tr('Victory!','Победа!'):tie?tr('A draw!','Ничья!'):tr('Great fight!','Отличная борьба!'))+'</h2><p>'+esc(won?tr('You were more accurate and earned a duel win.','Вы были точнее и одержали победу в дуэли.'):tie?tr('You finished with the same score.','Вы завершили дуэль с одинаковым счётом.'):tr('Review the mistakes and challenge the rival again.','Повторите ошибки и вызовите соперника снова.'))+'</p><div class="duel-final-score"><b>'+mine+'</b><span>:</span><b>'+rivalScore+'</b></div><div class="duel-result-stats"><span><b>'+accuracy+'%</b><small>'+esc(tr('accuracy','точность'))+'</small></span><span><b>'+esc(String(kit.streak||1))+'</b><small>'+esc(tr('day streak','дней серия'))+'</small></span><span><b>+'+xp+'</b><small>XP</small></span></div><div class="duel-follow-card"><b>'+esc(tr('Follow for the next duel','Подпишись на следующую дуэль'))+'</b><span>'+esc(tr('Join','Вход'))+': vela.cafe · '+esc(tr('Code','Код'))+' '+esc(code)+'</span></div><div class="result-actions"><button class="btn" id="duelReview">'+esc(tr('Review mistakes','Повторить ошибки'))+'</button><button class="btn primary" id="duelAgain">'+esc(tr('New duel','Новая дуэль'))+'</button></div></div>';
      if(studyState.liveMode){$('#studyToolBody').insertAdjacentHTML('afterbegin','<div class="duel-live-toolbar"><button type="button" id="duelLiveToggle" aria-pressed="true"><span aria-hidden="true">&times;</span>'+esc(tr('Exit LIVE','\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 LIVE'))+'</button></div>');bindDuelLiveControls($('#studyToolBody'));}
      $('#duelReview').onclick=function(){openStudyTool('mistakes');};$('#duelAgain').onclick=function(){openStudyTool('duel');};
    }

    // ---- 10. Mistake center ----
    function renderMistakes() {
      if (!studyState.progressDirect) return renderProgressHub();
      if (!studyState.data) {var allMistakes=loadMistakes(),due=allMistakes.filter(function(item){return !item.dueAt||item.dueAt<=Date.now();});studyState.data=shuffle(due.length?due:allMistakes.slice(0,3));}
      var deck = studyState.data;
      var host = $('#studyToolBody');
      if (!deck.length) {
        host.innerHTML = '<div class="empty">' + esc(tr('No mistakes saved. Great job!', 'Ошибок пока нет. Отлично!')) + '</div>';
        return;
      }
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var label = item.kind === 'article' ? ('___ ' + item.prompt) : item.prompt;
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(label) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-mopt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="mistFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-mopt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-mopt'));
          var ok = chosen === item.a;
          if (ok) { studyState.score++; clearMistake(item.lang, item.prompt); }
          Array.prototype.forEach.call(host.querySelectorAll('[data-mopt]'), function (b) { b.disabled = true; });
          $('#mistFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct! Removed from mistakes.', 'Верно! Убрано из ошибок.')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(item.opts[item.a]) + '</span>';
          setTimeout(function () { studyState.idx++; renderMistakes(); }, 900);
        });
      });
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
      { id: 'grammi', name: 'GRAMMI', role: 'grammar', voiceId: '012bc4b9caf1483fa31531c57ef1adbe', crop: 'head', accent: '#2F6BEE', avatar: './web/assets/duvi/friends/grami.png?v=3', tagline: { en: 'Grammar — rules, mistakes and quick fixes', ru: 'Грамматика — правила, ошибки и разбор' } },
      { id: 'nova', name: 'NOVA', role: 'pronunciation', voiceId: 'ce6481245d7b481fa9a76df0e4cbb10a', crop: 'head', accent: '#14B8C4', avatar: './web/assets/duvi/friends/nova.png?v=3', tagline: { en: 'Pronunciation — repeat after me and sound natural', ru: 'Произношение — повторяй за мной и звучи естественно' } },
      { id: 'lina', name: 'LINA', role: 'roleplay', voiceId: 'c103d063793d4262910d6f4b9775f8c3', crop: 'head', accent: '#E5484D', avatar: './web/assets/duvi/friends/lina.png?v=3', tagline: { en: 'Role-play scenarios — restaurant, doctor, interview', ru: 'Ролевые сценарии — ресторан, врач, интервью' } }
    ];

    function aiRoleMeta(role) {
      switch (role) {
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
    function speakAiBrowser(text) {
      try {
        if (!window.speechSynthesis || !text) return;
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = SPEECH_LOCALE[aiChatState.lang] || 'de-DE';
        utterance.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (e) { /* speech synthesis unavailable */ }
    }
    function stopAiVoice() {
      if (aiVoiceAudio) { try { aiVoiceAudio.pause(); } catch (e) {} aiVoiceAudio = null; }
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    }
    // Fish Audio voice per character (edge fn fish-audio-tts), with a graceful
    // fallback to the browser's built-in speech synthesis if it is unavailable.
    async function speakAi(text) {
      var clean = String(text || '').replace(/^✏️\s*/, '').trim();
      if (!clean) return;
      stopAiVoice();
      var partner = aiChatState.partner;
      try {
        // Raw fetch, not supa.functions.invoke — see fetchFishAudioBlob: the
        // invoke path decodes audio/mpeg with .text() and corrupts the MP3.
        var blob = await fetchFishAudioBlob({
          action: 'speak',
          text: clean.slice(0, 1000),
          voiceId: partner && partner.voiceId ? partner.voiceId : ''
        });
        var url = URL.createObjectURL(blob);
        aiVoiceAudio = new Audio(url);
        aiVoiceAudio.onended = aiVoiceAudio.onerror = function () { URL.revokeObjectURL(url); };
        await aiVoiceAudio.play();
      } catch (e) {
        speakAiBrowser(clean); // Fish Audio unavailable (no key/voice) → browser TTS
      }
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

    function renderAiPractice() {
      if (!aiChatState) {
        aiChatState = { started: false, lang: studyState.lang, topic: '', partner: null, voice: true, messages: [], conversationId: null, turns: 0, busy: false, error: null };
      }
      var host = $('#studyToolBody');

      if (!aiChatState.started) {
        host.innerHTML =
          '<div class="ai-partner-head">' + esc(tr('Practice with AI', 'Практика с AI')) + '</div>' +
          '<div class="ai-partner-sub">' + esc(tr('Each partner has its own focus — pick one and start', 'У каждого собеседника своя роль — выбери и начни')) + '</div>' +
          '<div class="ai-partner-list">' +
          AI_PARTNERS.map(function (bot) {
            return '<div class="ai-partner-card">' +
              '<div class="ai-partner-row">' +
                aiAvatarHtml(bot, 'lg', true) +
                '<div class="ai-partner-copy"><div class="ai-partner-name">' + esc(bot.name) + '<span class="ai-partner-role">' + esc(aiRoleMeta(bot.role).label) + '</span></div><div class="ai-partner-tag">' + esc(tr(bot.tagline.en, bot.tagline.ru)) + '</div></div>' +
              '</div>' +
              '<button type="button" class="ai-partner-start" data-partner="' + esc(bot.id) + '">💬 ' + esc(tr('Start', 'Начать')) + '</button>' +
            '</div>';
          }).join('') +
          '</div>';
        Array.prototype.forEach.call(host.querySelectorAll('[data-partner]'), function (btn) {
          btn.addEventListener('click', function () {
            aiChatState.partner = AI_PARTNERS.find(function (b) { return b.id === btn.getAttribute('data-partner'); }) || null;
            aiChatState.topic = tr('a friendly everyday conversation', 'дружеская повседневная беседа');
            aiChatState.started = true;
            renderAiPractice();
            sendAiTurn('__start__');
          });
        });
        return;
      }

      var partnerRole = aiChatState.partner ? aiChatState.partner.role : 'conversation';
      var modePron = partnerRole === 'pronunciation';
      var roleLabel = aiRoleMeta(partnerRole).label;
      host.innerHTML =
        '<div class="ai-chat-head">' +
          aiAvatarHtml(aiChatState.partner, 'md', true) +
          '<div><b>' + esc(aiChatState.partner ? aiChatState.partner.name : tr('AI tutor', 'ИИ-тренер')) + '</b><small>' + esc(tr('online', 'онлайн')) + ' · ' + esc(roleLabel) + '</small></div>' +
          '<button type="button" id="aiVoice" class="ai-voice-toggle' + (aiChatState.voice ? ' on' : '') + '" aria-label="Voice" title="' + esc(tr('Voice on/off', 'Голос вкл/выкл')) + '">' + (aiChatState.voice ? '🔊' : '🔇') + '</button>' +
        '</div>' +
        '<div id="aiChatLog" style="max-height:320px;overflow-y:auto;padding:4px 2px;margin-bottom:10px"></div>' +
        (aiChatState.error ? '<div style="color:#d64545;font-weight:800;margin-bottom:8px">' + esc(aiChatState.error) + '</div>' : '') +
        '<div style="display:flex;gap:8px">' +
          '<input id="aiInput" placeholder="' + esc(modePron ? tr('Read the sentence aloud...', 'Прочитайте предложение вслух...') : tr('Type your answer...', 'Напишите ответ...')) + '" style="flex:1" autocomplete="off">' +
          '<button class="btn" id="aiMic" type="button" aria-label="Voice answer">🎙</button>' +
          '<button class="btn primary" id="aiSend"' + (aiChatState.busy ? ' disabled' : '') + '>' + (aiChatState.busy ? '…' : esc(tr('Send', 'Отпр.'))) + '</button>' +
        '</div>' +
        '<button class="btn" id="aiEnd" style="width:100%;margin-top:10px">' + esc(tr('End session', 'Завершить сессию')) + '</button>';

      var log = $('#aiChatLog');
      log.innerHTML = aiChatState.messages.map(function (m, i) { return aiChatBubble(m.role, m.text, aiChatState.partner, i); }).join('') ||
        '<div class="empty">' + esc(tr('Say hello to start.', 'Поздоровайтесь, чтобы начать.')) + '</div>';
      log.scrollTop = log.scrollHeight;
      Array.prototype.forEach.call(log.querySelectorAll('[data-say]'), function (btn) {
        btn.addEventListener('click', function () { var m = aiChatState.messages[Number(btn.getAttribute('data-say'))]; if (m) speakAi(m.text); });
      });
      $('#aiVoice').addEventListener('click', function () {
        aiChatState.voice = !aiChatState.voice;
        if (!aiChatState.voice) stopAiVoice();
        var b = $('#aiVoice'); b.textContent = aiChatState.voice ? '🔊' : '🔇'; b.classList.toggle('on', aiChatState.voice);
      });

      function send() {
        var input = $('#aiInput');
        var text = input.value.trim();
        if (!text || aiChatState.busy) return;
        input.value = '';
        sendAiTurn(text);
      }
      $('#aiSend').addEventListener('click', send);
      $('#aiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      $('#aiMic').addEventListener('click', function () {
        var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) { aiChatState.error = tr('Voice input is unavailable in this browser.','Голосовой ввод недоступен в этом браузере.'); renderAiPractice(); return; }
        var recognition = new Recognition(), button = $('#aiMic'); recognition.lang = SPEECH_LOCALE[studyState.lang] || 'de-DE'; button.textContent = '●'; button.disabled = true;
        recognition.onresult = function (event) { $('#aiInput').value = event.results[0][0].transcript; };
        recognition.onerror = function () { aiChatState.error = tr('Microphone is unavailable.','Микрофон недоступен.'); };
        recognition.onend = function () { button.textContent = '🎙'; button.disabled = false; };
        recognition.start();
      });
      $('#aiEnd').addEventListener('click', function () {
        stopAiVoice();
        var xp = Math.min(30, aiChatState.turns * 5);
        aiChatState = null;
        finishTool(tr('Session ended', 'Сессия завершена'), xp);
      });
    }

    async function sendAiTurn(text) {
      var isGreeting = text === '__start__';
      if (!isGreeting) aiChatState.messages.push({ role: 'user', text: text });
      aiChatState.busy = true;
      aiChatState.error = null;
      renderAiPractice();
      try {
        var nativeLocale = ctx.isRu ? 'ru-RU' : 'en-US';
        var partner = aiChatState.partner;
        var roleMeta = aiRoleMeta(partner ? partner.role : 'conversation');
        // Map the partner role to a practiceMode the edge function understands
        // (conversation → daily; grammar/pronunciation/roleplay pass through).
        var practiceMode = partner ? ({ grammar: 'grammar', pronunciation: 'pronunciation', roleplay: 'roleplay', conversation: 'daily' }[partner.role] || 'daily') : 'daily';
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
            practiceTopic: aiChatState.topic,
            practiceMode: practiceMode,
            partnerName: partner ? partner.name : undefined,
            partnerPersona: partner ? partner.tagline.en : undefined,
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
        aiChatState.messages.push({ role: 'assistant', text: assistantText });
        if (coach && coach.quickCorrection) {
          aiChatState.messages.push({ role: 'assistant', text: '✏️ ' + coach.quickCorrection });
        }
        if (aiChatState.voice) speakAi(assistantText);
        aiChatState.turns++;
        bumpProgress('ai', 0);
      } catch (e) {
        aiChatState.error = (e && e.message) || tr('Could not reach the AI coach. Try again.', 'Не удалось связаться с ИИ-репетитором. Попробуйте ещё раз.');
      }
      aiChatState.busy = false;
      renderAiPractice();
    }

    async function finishTool(scoreText, xp) {
      var finished = studyState, total = finished.data && finished.data.length ? finished.data.length : Math.max(finished.idx || 0, 1);
      var comboBonus=Math.floor(Number(finished.bestStreak||0)/3)*2;xp=Math.max(0,Number(xp)||0)+comboBonus;
      var duration = Math.max(1, Math.round((Date.now() - (finished.startedAt || Date.now())) / 1000));
      var awarded = false;
      var completionPayload = { p_client_session_id:finished.clientSessionId || sessionId(),p_tool_id:finished.tool,p_language:finished.lang || 'de',p_level:(loadPrefs().levels || {})[finished.lang] || (ctx.profile && ctx.profile.language_level) || null,p_score:Number(finished.score) || 0,p_total:total,p_duration_seconds:duration,p_xp:Math.max(0,Number(xp) || 0),p_state:{ source:'web',skill:SKILL_GROUP[finished.tool] || finished.tool } };
      if (uid() && navigator.onLine) {
        try {
          var result = await supa.rpc('complete_practice_session',completionPayload);
          awarded = !result.error && result.data && result.data.awarded !== false;
          if (!result.error && ctx.profile && awarded) ctx.setProfile(Object.assign({},ctx.profile,{ score:Number(ctx.profile.score || 0) + xp }));
          if (!result.error && result.data) { var local = loadProgress(); local.streak = Object.assign({},local.streak || {},{ current_streak:result.data.streak,today_sessions:result.data.todaySessions }); saveProgress(local); }
          if (result.error) queueOfflineSession(completionPayload);
        } catch (e) { queueOfflineSession(completionPayload); }
      }
      else if (uid()) queueOfflineSession(completionPayload);
      bumpProgress(finished.tool, xp);
      if (!uid()) awardXp(xp);
      clearResume(); syncPracticeData(); finished.finished = true;
      if(finished.challengeId&&uid()){try{await supa.from('practice_challenge_members').update({score:Number(finished.score||0),completed:total}).eq('challenge_id',finished.challengeId).eq('user_id',uid());}catch(e){}}
      var host = $('#studyToolBody');
      var accuracy = total ? Math.min(100,Math.round(Number(finished.score || 0) / total * 100)) : 100;
      host.innerHTML = '<div class="session-result"><div class="result-burst">✓</div><small>' + esc(tr('SESSION COMPLETE','ЗАНЯТИЕ ЗАВЕРШЕНО')) + '</small><h2>' + esc(scoreText) + '</h2><div class="result-stats"><span><b>' + accuracy + '%</b><small>' + esc(tr('Accuracy','Точность')) + '</small></span><span><b>' + Math.max(1,Math.round(duration/60)) + ' min</b><small>' + esc(tr('Time','Время')) + '</small></span><span><b>+' + xp + '</b><small>XP</small></span></div><div class="result-progress"><i style="width:' + accuracy + '%"></i></div><p>' + esc(accuracy >= 80 ? tr('Excellent work. Your next review has been scheduled.','Отличная работа. Следующее повторение уже запланировано.') : tr('Good start. Weak answers were added to your review plan.','Хорошее начало. Слабые ответы добавлены в план повторения.')) + '</p><button class="btn primary" id="studyAgain">' + esc(tr('Practice again','Пройти ещё раз')) + '</button></div>';
      var resultCard=host.querySelector('.session-result');
      if(resultCard&&comboBonus)resultCard.insertAdjacentHTML('afterbegin','<div class="combo-bonus">🔥 +'+comboBonus+' XP '+esc(tr('combo bonus','бонус за серию'))+'</div>');
      if(resultCard) resultCard.insertAdjacentHTML('beforeend','<details class="answer-review"><summary>'+esc(tr('Review every answer','Разобрать все ответы'))+'</summary><div>'+((finished.answers||[]).length?(finished.answers||[]).map(function(answer,index){return '<article class="'+(answer.ok?'ok':'bad')+'"><b>'+(index+1)+'. '+esc(answer.prompt||tr('Practice step','Шаг практики'))+'</b><p>'+esc(tr('Your answer: ','Ваш ответ: ')) + esc(answer.chosen||'—')+'</p><p>'+esc(tr('Correct: ','Правильно: '))+esc(answer.correct|| (answer.ok?answer.chosen:'—'))+'</p>'+(answer.explanation?'<small>'+esc(answer.explanation)+'</small>':'')+'</article>';}).join(''):'<p>'+esc(tr('No answer details for this activity.','Для этой практики нет отдельных ответов.'))+'</p>')+'</div></details><div class="result-actions"><button class="btn" id="reviewMistakes">'+esc(tr('Repeat mistakes','Повторить ошибки'))+'</button><button class="btn" id="tryHarder">'+esc(tr('Try harder','Попробовать сложнее'))+'</button><button class="btn primary" id="nextPractice">'+esc(tr('Next practice','Следующая практика'))+' →</button></div>');
      wireAgain();
      var review=$('#reviewMistakes'),harder=$('#tryHarder'),next=$('#nextPractice');
      if(review)review.onclick=function(){openStudyTool('mistakes');};
      if(harder)harder.onclick=function(){var prefs=loadPrefs(),levels=['A1','A2','B1','B2','C1','C2'],current=(prefs.levels||{})[finished.lang]||'A1',index=levels.indexOf(current);prefs.levels=prefs.levels||{};prefs.levels[finished.lang]=levels[Math.min(levels.length-1,index+1)];savePrefs(prefs);openStudyTool(finished.tool);};
      if(next)next.onclick=function(){var order=['flashcards','grammar','listening','speaking','reading','writing'],current=order.indexOf(finished.tool);openStudyTool(order[(current+1+order.length)%order.length]);};
    }

    return {
      studyToolsHtml: studyToolsHtml,
      bindStudyTiles: bindStudyTiles,
      openStudyTool: openStudyTool
    };
  }

  window.DuvelaAppStudy = { create: createStudyFeature };
})();
