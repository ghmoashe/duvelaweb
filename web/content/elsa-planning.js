// Generated from vela academy hub/shared/planning-scenarios.ts; change it there.
(function (global) {
  const PLANNING_TASK = 'Planen Sie gemeinsam, was Sie tun möchten.';
  const PLANNING_SCENARIOS = [
      {
          id: 'kurs-abschluss',
          title: 'Abschlussfest im Deutschkurs',
          situation: 'Ihr Deutschkurs endet bald. Die Gruppe möchte zum Schluss zusammen feiern und hat Sie beide gebeten, das Fest vorzubereiten.',
          notes: ['Wann und wo?', 'Wer bringt was zu essen mit?', 'Getränke und Geschirr?', 'Musik oder Spiele?', 'Geschenk für die Lehrerin?'],
      },
      {
          id: 'kollegin-rente',
          title: 'Abschied für eine Kollegin',
          situation: 'Eine Kollegin geht nach vielen Jahren in Rente. Sie beide sollen für die Abteilung eine kleine Feier organisieren.',
          notes: ['Termin im Büro oder im Restaurant?', 'Wer wird eingeladen?', 'Geld sammeln?', 'Welches Geschenk?', 'Wer sagt ein paar Worte?'],
      },
      {
          id: 'hoffest',
          title: 'Hoffest mit den Nachbarn',
          situation: 'In Ihrem Haus wohnen viele neue Familien. Damit sich alle kennenlernen, möchten Sie zusammen ein Hoffest machen.',
          notes: ['Welcher Tag?', 'Wie informieren wir die Nachbarn?', 'Essen: Grillen oder Buffet?', 'Tische und Stühle?', 'Was machen wir bei Regen?'],
      },
      {
          id: 'krankenbesuch',
          title: 'Ein Freund im Krankenhaus',
          situation: 'Ein guter Freund von Ihnen liegt nach einer Operation zwei Wochen im Krankenhaus. Sie möchten ihn besuchen und ihm helfen.',
          notes: ['Wann besuchen wir ihn?', 'Wie kommen wir dorthin?', 'Was bringen wir mit?', 'Wer kümmert sich um die Post?', 'Wer holt ihn später ab?'],
      },
      {
          id: 'nachbarin-hilfe',
          title: 'Hilfe für die Nachbarin',
          situation: 'Ihre ältere Nachbarin hat sich den Fuß gebrochen und kann drei Wochen nicht aus dem Haus gehen. Sie möchten ihr helfen.',
          notes: ['Wer kauft ein?', 'Wie oft schauen wir vorbei?', 'Wer geht mit dem Hund?', 'Arzttermine?', 'Wer ist am Wochenende da?'],
      },
      {
          id: 'schulfest',
          title: 'Stand beim Schulfest',
          situation: 'An der Schule Ihrer Kinder gibt es bald ein Sommerfest. Ihre Klasse soll einen Stand machen, und Sie beide übernehmen die Planung.',
          notes: ['Was verkaufen wir?', 'Wer backt oder kocht?', 'Preise?', 'Wer steht wann am Stand?', 'Was machen wir mit dem Geld?'],
      },
      {
          id: 'internationales-essen',
          title: 'Internationaler Kochabend',
          situation: 'Sie möchten mit Freunden aus verschiedenen Ländern einen Abend lang zusammen kochen und essen.',
          notes: ['Bei wem?', 'Welche Gerichte?', 'Wer kauft ein?', 'Kosten teilen?', 'Wer räumt auf?'],
      },
      {
          id: 'fahrradtour',
          title: 'Fahrradtour mit Freunden',
          situation: 'Das Wetter soll am Wochenende schön werden. Sie möchten mit ein paar Freunden eine Fahrradtour machen.',
          notes: ['Welche Strecke?', 'Treffpunkt und Uhrzeit?', 'Fahrräder für alle?', 'Essen unterwegs?', 'Plan bei schlechtem Wetter?'],
      },
      {
          id: 'besuch-verwandte',
          title: 'Besuch aus dem Ausland',
          situation: 'Verwandte aus Ihrem Heimatland kommen für eine Woche zu Besuch. Sie möchten zusammen mit einem Freund das Programm planen.',
          notes: ['Abholung am Flughafen?', 'Wo schlafen die Gäste?', 'Was zeigen wir ihnen?', 'Essen gehen oder selbst kochen?', 'Fahrkarten?'],
      },
      {
          id: 'flohmarkt',
          title: 'Stand auf dem Flohmarkt',
          situation: 'Sie haben beide viele Sachen zu Hause, die Sie nicht mehr brauchen, und möchten zusammen auf dem Flohmarkt verkaufen.',
          notes: ['Welcher Flohmarkt und wann?', 'Anmeldung und Standgebühr?', 'Was verkaufen wir?', 'Wie transportieren wir alles?', 'Was passiert mit dem Rest?'],
      },
      {
          id: 'babyparty',
          title: 'Überraschung für werdende Eltern',
          situation: 'Ein befreundetes Paar bekommt bald ein Baby. Sie möchten ihm mit anderen Freunden eine Überraschung machen.',
          notes: ['Wann und wo?', 'Wen laden wir ein?', 'Wie bleibt es geheim?', 'Kuchen und Getränke?', 'Ein gemeinsames Geschenk?'],
      },
      {
          id: 'ausflug-kollegen',
          title: 'Betriebsausflug',
          situation: 'Ihre Firma bezahlt einmal im Jahr einen Ausflug. Sie beide sollen einen Vorschlag für das Team machen.',
          notes: ['Wohin?', 'Wann haben alle Zeit?', 'Wie kommen wir hin?', 'Was kostet es?', 'Mittagessen?'],
      },
  ];
  const PLANNING_STEPS = [
      { title: 'Gespräch beginnen', phrases: ['Hast du kurz Zeit? Wir müssen … organisieren.', 'Schön, dass wir das zusammen machen.'] },
      { title: 'Nach Ideen fragen', phrases: ['Hast du schon eine Idee?', 'Was meinst du, wann passt es am besten?'] },
      { title: 'Vorschläge machen', phrases: ['Wie wäre es mit …?', 'Wir könnten vielleicht …', 'Was hältst du von …?'] },
      { title: 'Zustimmen', phrases: ['Das klingt gut.', 'Gute Idee, so machen wir es.', 'Damit bin ich einverstanden.'] },
      { title: 'Ablehnen und Alternative nennen', phrases: ['Das passt mir leider nicht, weil … Wie wäre es mit …?', 'Ich bin nicht sicher, ob das klappt. Lieber …'] },
      { title: 'Kompromiss finden', phrases: ['Dann machen wir es doch so: …', 'In Ordnung, aber dann …'] },
      { title: 'Zum nächsten Punkt gehen', phrases: ['Und was ist mit …?', 'Kommen wir zum nächsten Punkt.', 'Was fehlt noch?'] },
      { title: 'Gespräch beenden', phrases: ['Also: … Haben wir jetzt alles?', 'Prima, dann ist alles geklärt.'] },
  ];
  function pickPlanningScenario() {
      return PLANNING_SCENARIOS[Math.floor(Math.random() * PLANNING_SCENARIOS.length)];
  }
  /** Learner turns of a planning-only run: one per note (every scenario has five), and one to close the plan. */
  const PLANNING_TURNS = 6;
  // What ELSA is told for this part. `fullDialog` is the planning-only run; in a whole
  // exam the part has two answers, so she keeps it to the most important notes.
  function planningPartInstruction(scenario, fullDialog) {
      const notes = scenario.notes.join(' ');
      const pace = fullDialog
          ? 'Sprecht alle Punkte nacheinander durch, immer nur EINEN Punkt pro Antwort.'
          : 'Für diesen Teil gibt es nur zwei Antworten: Besprecht die zwei wichtigsten Punkte.';
      return ` (GESPRÄCHSPARTNERIN: In diesem Teil ist ELSA keine Prüferin, sondern die Partnerin des Kandidaten und sagt „du“. ` +
          `Der Kandidat sieht eine Karte. Thema: „${scenario.title}“. Situation: ${scenario.situation} Aufgabe: ${PLANNING_TASK} Notizen: ${notes} ` +
          `Sage zu Beginn in ein bis zwei Sätzen, was ihr zusammen planen sollt, und bitte um eine erste Idee. ${pace} ` +
          'Reagiere kurz auf seinen Vorschlag, dann mache selbst einen kurzen Vorschlag oder gehe zum nächsten Punkt. ' +
          'Lehne genau einen Vorschlag höflich mit Grund ab, damit ihr einen Kompromiss finden müsst. ' +
          'Stelle keine Prüfungsfragen wie „Warum denken Sie das?“. Am Ende fasse den gemeinsamen Plan in einem Satz zusammen.)';
  }
  // For the final score: the scorer only sees the transcript.
  function planningScoreNote(scenario) {
      return `[Hinweis für die Bewertung: Planungsaufgabe „${scenario.title}“ mit den Notizen: ${scenario.notes.join(' ')} ` +
          'Bewerte im Teil „Gemeinsam etwas planen“, welche Notizen wirklich besprochen wurden, ob der Kandidat selbst Vorschläge gemacht, ' +
          'auf Vorschläge reagiert, einen Kompromiss gesucht und das Gespräch abgeschlossen hat.]\n';
  }
  global.DuvelaElsaPlanning = { PLANNING_SCENARIOS, PLANNING_STEPS, PLANNING_TASK, PLANNING_TURNS, pickPlanningScenario, planningPartInstruction, planningScoreNote };
})(window);
