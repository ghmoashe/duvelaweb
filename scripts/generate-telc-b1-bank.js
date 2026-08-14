'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const audioRoot = './web/audio/exam-b1';
const labels = 'abcdefghijklmno'.split('');

const profiles = [
  {
    title: 'Modelltest 1 – Zusammenleben und Stadt', city: 'Leipzig', person: 'Nora', event: 'Nachbarschaftsfest', eventObject: 'das Nachbarschaftsfest', date: 'Samstag, 21. September', time: '14 Uhr', place: 'Innenhof des Bürgerhauses', cost: 'kostenlos', deadline: '15. September', contact: 'Frau Berger', transport: 'Straßenbahnlinie 4', transportDative: 'der Straßenbahnlinie 4', food: 'Kuchen und internationale Salate', weatherPlan: 'großer Saal im Bürgerhaus',
    articleTitle: 'Eine Bibliothek wird zum Treffpunkt',
    article: 'Die Stadtteilbibliothek im Leipziger Westen war früher vor allem ein ruhiger Ort zum Ausleihen von Büchern. Seit einem Umbau vor zwei Jahren hat sich das deutlich verändert. Neben neuen Arbeitsplätzen gibt es jetzt ein kleines Café, einen Raum für Lerngruppen und kostenlose Veranstaltungen. Besonders beliebt ist die wöchentliche Sprechstunde, in der Ehrenamtliche bei digitalen Formularen helfen. Bibliotheksleiterin Nora Klein erklärt, dass die Besucherzahlen seit dem Umbau um fast vierzig Prozent gestiegen sind. Manche Stammgäste hatten zuerst Sorge, dass es zu laut werden könnte. Deshalb gibt es weiterhin einen besonders ruhigen Lesesaal im ersten Stock. Die Stadt finanziert die Grundkosten, zusätzliche Angebote werden durch einen Förderverein ermöglicht. Im kommenden Jahr soll außerdem ein kleiner Garten hinter dem Gebäude entstehen.',
    articleQuestions: [
      ['Was hat sich nach dem Umbau verändert?', ['Die Bibliothek verleiht keine Bücher mehr.', 'Es gibt zusätzliche Lern- und Begegnungsangebote.', 'Nur Vereinsmitglieder dürfen das Café besuchen.'], 1],
      ['Wobei helfen Ehrenamtliche?', ['bei digitalen Formularen', 'bei der Gartenarbeit', 'bei der Buchhaltung der Stadt'], 0],
      ['Wie entwickelten sich die Besucherzahlen?', ['Sie sanken leicht.', 'Sie blieben gleich.', 'Sie stiegen deutlich.'], 2],
      ['Warum gibt es einen Lesesaal im ersten Stock?', ['Dort dürfen Kinder spielen.', 'Dort kann man besonders ruhig arbeiten.', 'Dort finden alle Veranstaltungen statt.'], 1],
      ['Was ist für das kommende Jahr geplant?', ['ein Garten', 'ein Kino', 'eine zweite Bibliothek'], 0],
    ],
    writing: {
      input: 'Ihre Freundin Lara möchte in Ihre Stadt ziehen und hat Sie um Rat gebeten. Antworten Sie auf ihre E-Mail.',
      points: ['welcher Stadtteil geeignet ist', 'wie man eine Wohnung sucht', 'welche Verkehrsmittel praktisch sind', 'wobei Sie persönlich helfen können'],
      sample: 'Liebe Lara, ich freue mich sehr, dass du nach Leipzig ziehen möchtest. Für dich wäre der Westen besonders geeignet, weil es dort viele Cafés, Parks und gute Einkaufsmöglichkeiten gibt. Wohnungen findest du am besten über regionale Internetportale und Wohnungsgenossenschaften. Ich empfehle dir außerdem, schnell einen Besichtigungstermin zu vereinbaren. Im Alltag sind Straßenbahn und Fahrrad sehr praktisch, ein Auto brauchst du kaum. Wenn du möchtest, kann ich passende Anzeigen sammeln und dich zu zwei Besichtigungen begleiten. Ich kenne dort außerdem eine freundliche Maklerin, die uns beraten könnte. Am ersten Wochenende helfe ich dir natürlich auch beim Umzug. Schreib mir bitte, wann du ungefähr kommen willst. Viele Grüße, Nora',
    },
    opinion: ['Innenstädte sollten weitgehend autofrei werden.', 'Ein vollständiges Autoverbot benachteiligt viele Menschen.'],
    plan: ['Termin und Dauer', 'Ort und Räume', 'Essen und Getränke', 'Aufgaben verteilen'],
  },
  {
    title: 'Modelltest 2 – Arbeit und Weiterbildung', city: 'Dortmund', person: 'Emre', event: 'Tag der offenen Tür im Bildungszentrum', eventObject: 'den Tag der offenen Tür im Bildungszentrum', date: 'Freitag, 11. Oktober', time: '16 Uhr', place: 'Bildungszentrum Nord', cost: 'drei Euro für Material', deadline: '7. Oktober', contact: 'Herr Yilmaz', transport: 'Buslinie 52', transportDative: 'der Buslinie 52', food: 'Kaffee, Tee und belegte Brötchen', weatherPlan: 'alle Angebote finden im Gebäude statt',
    articleTitle: 'Vier Tage arbeiten, fünf Tage Leistung?',
    article: 'Ein mittelständisches Unternehmen in Dortmund testet seit sechs Monaten eine Vier-Tage-Woche. Die Beschäftigten arbeiten von Montag bis Donnerstag jeweils etwas länger, haben dafür aber freitags frei. Die Geschäftsführung wollte herausfinden, ob kürzere Arbeitswochen die Zufriedenheit erhöhen, ohne dass die Leistung sinkt. Nach der ersten Auswertung erledigen die Teams ungefähr genauso viele Aufträge wie vorher. Gleichzeitig ist die Zahl der Krankheitstage zurückgegangen. Nicht alle Abteilungen können jedoch am gleichen Modell teilnehmen: Der Kundendienst muss auch freitags erreichbar sein und arbeitet deshalb mit wechselnden freien Tagen. Einige Beschäftigte finden die längeren Arbeitstage anstrengend, die Mehrheit möchte den Versuch trotzdem fortsetzen. Über eine dauerhafte Einführung entscheidet die Firma erst am Jahresende.',
    articleQuestions: [
      ['Seit wann läuft der Versuch?', ['seit sechs Monaten', 'seit einem Jahr', 'seit vier Wochen'], 0],
      ['Was wollte die Firma prüfen?', ['ob neue Büros nötig sind', 'ob weniger Arbeitstage ohne Leistungsverlust möglich sind', 'ob alle Beschäftigten freitags arbeiten wollen'], 1],
      ['Was geschah mit den Krankheitstagen?', ['Sie nahmen ab.', 'Sie nahmen zu.', 'Sie wurden nicht untersucht.'], 0],
      ['Warum gilt im Kundendienst eine andere Regel?', ['Er ist auch freitags erreichbar.', 'Dort arbeitet niemand am Donnerstag.', 'Die Abteilung liegt in einer anderen Stadt.'], 0],
      ['Wann fällt die endgültige Entscheidung?', ['sofort', 'im nächsten Monat', 'am Jahresende'], 2],
    ],
    writing: {
      input: 'Ihr Kollege Jan hat Sie nach einem passenden Weiterbildungskurs gefragt. Schreiben Sie ihm eine E-Mail.',
      points: ['welchen Kurs Sie empfehlen', 'warum der Kurs nützlich ist', 'wann und wie der Kurs stattfindet', 'ob Sie gemeinsam teilnehmen möchten'],
      sample: 'Hallo Jan, du hast mich nach einer Weiterbildung gefragt. Ich kann dir den Kurs „Digitale Kommunikation im Beruf“ im Bildungszentrum Nord empfehlen. Dort lernt man, professionelle E-Mails zu schreiben, Online-Besprechungen zu moderieren und Aufgaben im Team besser zu organisieren. Der Kurs findet ab 4. November sechs Wochen lang immer montags und mittwochs von 18 bis 20 Uhr statt. Man kann vor Ort oder online teilnehmen. Die Teilnahme kostet 120 Euro; vielleicht übernimmt unsere Firma einen Teil davon. Ich möchte den Kurs ebenfalls besuchen. Wenn du Interesse hast, könnten wir uns diese Woche gemeinsam anmelden. Sag mir bitte bis Donnerstag Bescheid. Viele Grüße, Emre',
    },
    opinion: ['Homeoffice verbessert die Vereinbarkeit von Beruf und Privatleben.', 'Im Büro funktioniert Zusammenarbeit zuverlässiger als zu Hause.'],
    plan: ['Thema und Referierende', 'Termin und Zeitplan', 'Technik und Raum', 'Einladung der Kolleginnen und Kollegen'],
  },
  {
    title: 'Modelltest 3 – Reisen und Mobilität', city: 'Freiburg', person: 'Sofia', event: 'Informationsabend für eine Gruppenreise', eventObject: 'den Informationsabend für eine Gruppenreise', date: 'Dienstag, 6. Mai', time: '18:30 Uhr', place: 'Reisezentrum am Hauptbahnhof', cost: 'fünf Euro Eintritt', deadline: '30. April', contact: 'Frau Keller', transport: 'Regionalzug R7', transportDative: 'dem Regionalzug R7', food: 'Getränke und kleine Snacks', weatherPlan: 'der Termin findet unabhängig vom Wetter statt',
    articleTitle: 'Mit dem Nachtzug durch Europa',
    article: 'Nachtzüge werden in Europa wieder beliebter. Viele Reisende möchten lange Strecken zurücklegen, ohne dafür zu fliegen. Wer abends einsteigt, erreicht sein Ziel am nächsten Morgen und spart häufig eine Hotelübernachtung. Die Bahnunternehmen haben deshalb neue Verbindungen eingerichtet und moderne Schlafwagen bestellt. Trotzdem gibt es noch Schwierigkeiten. Fahrkarten für Reisen durch mehrere Länder sind nicht immer auf einer einzigen Internetseite erhältlich, und in Ferienzeiten sind günstige Plätze schnell ausgebucht. Sofia Mendes nutzt Nachtzüge regelmäßig. Sie empfiehlt, früh zu reservieren und für längere Fahrten ein Liege- oder Schlafabteil zu wählen. Ein Sitzplatz ist zwar billiger, aber deutlich unbequemer. Umweltverbände begrüßen den Ausbau, fordern jedoch bessere internationale Buchungssysteme und mehr barrierefreie Wagen.',
    articleQuestions: [
      ['Warum wählen viele Menschen den Nachtzug?', ['Sie möchten nicht fliegen.', 'Sie reisen nur innerhalb einer Stadt.', 'Sie dürfen tagsüber nicht fahren.'], 0],
      ['Was kann man bei einer Nachtfahrt sparen?', ['eine Fahrkarte', 'eine Hotelübernachtung', 'den Reisepass'], 1],
      ['Welches Problem nennt der Text?', ['Es gibt keine Schlafwagen.', 'Züge fahren nur im Winter.', 'Internationale Buchungen sind oft kompliziert.'], 2],
      ['Was empfiehlt Sofia für lange Fahrten?', ['früh reservieren und ein Abteil wählen', 'erst am Bahnhof bezahlen', 'immer nur einen Sitzplatz buchen'], 0],
      ['Was fordern Umweltverbände?', ['weniger Verbindungen', 'bessere Buchung und Barrierefreiheit', 'höhere Preise'], 1],
    ],
    writing: {
      input: 'Ihr Freund Daniel plant seine erste längere Zugreise durch Deutschland. Antworten Sie auf seine Nachricht.',
      points: ['welche Strecke interessant ist', 'wie und wann er buchen sollte', 'was er mitnehmen sollte', 'ob Sie ihn auf einem Teil der Reise begleiten'],
      sample: 'Lieber Daniel, für deine erste Zugreise empfehle ich dir die Strecke von Freiburg über Heidelberg nach Hamburg. So siehst du sowohl kleinere historische Städte als auch den Norden. Buche die Fahrkarten möglichst vier bis sechs Wochen vorher über die Bahn-App, denn dann findest du meistens günstige Sparpreise. Für lange Fahrten solltest du Wasser, etwas zu essen, Kopfhörer und eine leichte Jacke mitnehmen. Reserviere am besten auch einen Sitzplatz, damit die Fahrt entspannt bleibt. Ich könnte dich am zweiten Wochenende von Heidelberg bis Köln begleiten, weil ich dort Freunde besuchen möchte. Wenn der Termin für dich passt, planen wir die Übernachtungen gemeinsam. Liebe Grüße, Sofia',
    },
    opinion: ['Flugreisen sollten aus Klimagründen deutlich teurer werden.', 'Mobilität darf nicht zu einem Luxus für wenige Menschen werden.'],
    plan: ['Reiseziel und Route', 'Verkehrsmittel', 'Unterkunft und Budget', 'Programm vor Ort'],
  },
  {
    title: 'Modelltest 4 – Gesundheit und Umwelt', city: 'Hannover', person: 'Mila', event: 'Gesundheits- und Umwelttag', eventObject: 'den Gesundheits- und Umwelttag', date: 'Sonntag, 18. August', time: '10 Uhr', place: 'Stadtpark am See', cost: 'kostenlos', deadline: '10. August', contact: 'Herr Baumann', transport: 'U-Bahnlinie 6', transportDative: 'der U-Bahnlinie 6', food: 'vegetarische Suppe und Obst', weatherPlan: 'Sporthalle der Gesamtschule',
    articleTitle: 'Gemeinsam gärtnern und gesund bleiben',
    article: 'In Hannover nutzen immer mehr Bewohnerinnen und Bewohner gemeinschaftliche Gärten. Auf früher ungenutzten Flächen bauen sie Gemüse, Kräuter und Blumen an. Eine Untersuchung der örtlichen Hochschule zeigt, dass die Projekte nicht nur der Umwelt helfen. Viele Teilnehmende bewegen sich regelmäßiger, lernen ihre Nachbarschaft kennen und fühlen sich weniger allein. Besonders ältere Menschen schätzen die festen Treffen. Allerdings brauchen die Gruppen verlässliche Regeln: Werkzeuge müssen gepflegt, Wasser sparsam verwendet und Aufgaben fair verteilt werden. Die Stadt stellt einige Flächen kostenlos zur Verfügung, übernimmt aber nicht alle Kosten. Saatgut und Geräte finanzieren die Gruppen durch kleine Mitgliedsbeiträge und Feste. Im nächsten Frühjahr soll ein barrierefreier Garten entstehen, damit auch Menschen mit eingeschränkter Mobilität bequem mitarbeiten können.',
    articleQuestions: [
      ['Wo entstehen die Gärten?', ['auf ungenutzten Flächen', 'nur auf privaten Balkonen', 'in Schulgebäuden'], 0],
      ['Welche Wirkung nennt die Untersuchung?', ['Die Menschen arbeiten länger.', 'Teilnehmende bewegen sich mehr und haben Kontakte.', 'Die Lebensmittelpreise steigen.'], 1],
      ['Was ist für die Zusammenarbeit wichtig?', ['teure Maschinen', 'verlässliche Regeln', 'tägliche Kontrollen der Stadt'], 1],
      ['Wie werden Saatgut und Geräte bezahlt?', ['nur durch die Hochschule', 'durch Beiträge und Feste', 'ausschließlich durch Supermärkte'], 1],
      ['Was soll im nächsten Frühjahr entstehen?', ['ein barrierefreier Garten', 'ein Parkplatz', 'ein Krankenhaus'], 0],
    ],
    writing: {
      input: 'Ihre Nachbarin Paula möchte gesünder leben und bittet Sie um Ideen. Schreiben Sie ihr eine E-Mail.',
      points: ['welche Bewegung Sie empfehlen', 'wie man gesünder essen kann', 'wie sie motiviert bleiben kann', 'welche Aktivität Sie gemeinsam machen können'],
      sample: 'Liebe Paula, es ist eine gute Idee, mehr für deine Gesundheit zu tun. Du musst nicht sofort ein anstrengendes Programm beginnen. Versuche zunächst, jeden Tag eine halbe Stunde zügig spazieren zu gehen oder mit dem Fahrrad zur Arbeit zu fahren. Beim Essen helfen feste Pläne: Koche am Wochenende zwei gesunde Gerichte vor und nimm Obst statt Süßigkeiten mit. Setze dir kleine Ziele und notiere deine Fortschritte, dann bleibt die Motivation länger erhalten. Wir könnten dienstags gemeinsam zum Schwimmkurs gehen und sonntags eine längere Runde im Park machen. Wenn du möchtest, melde ich uns gleich für einen Probemonat an. Liebe Grüße, Mila',
    },
    opinion: ['Gesunde Lebensmittel sollten staatlich günstiger gemacht werden.', 'Menschen entscheiden selbst, wofür sie ihr Geld ausgeben.'],
    plan: ['Aktivitäten und Stationen', 'Helferinnen und Helfer', 'Material und Sicherheit', 'Werbung und Anmeldung'],
  },
  {
    title: 'Modelltest 5 – Medien und Engagement', city: 'Bremen', person: 'David', event: 'Medienworkshop für Vereine', eventObject: 'den Medienworkshop für Vereine', date: 'Mittwoch, 27. November', time: '17 Uhr', place: 'Kulturzentrum Hafen', cost: 'zehn Euro pro Person', deadline: '20. November', contact: 'Frau Özdemir', transport: 'Buslinie 24', transportDative: 'der Buslinie 24', food: 'Wasser und belegte Brote', weatherPlan: 'der Workshop findet vollständig drinnen statt',
    articleTitle: 'Eine App verbindet freiwillige Helfer',
    article: 'Ein Bremer Verein hat eine App entwickelt, über die Nachbarschaftsprojekte kurzfristig freiwillige Helferinnen und Helfer finden können. Organisationen stellen dort kleine Aufgaben ein, zum Beispiel Lebensmittel sortieren, ältere Menschen zu Terminen begleiten oder bei einem Stadtfest aufbauen. Interessierte sehen sofort, wie viel Zeit benötigt wird und welche Kenntnisse nötig sind. Seit dem Start vor acht Monaten haben sich mehr als zweitausend Personen registriert. Datenschutz war bei der Entwicklung besonders wichtig: Die vollständigen Kontaktdaten werden erst nach einer bestätigten Anmeldung sichtbar. Der Verein betont, dass die App persönliche Beratung nicht ersetzen soll. Wer unsicher ist, kann weiterhin telefonisch einen passenden Einsatz suchen. Demnächst soll die Anwendung auch in einfacher Sprache angeboten werden, damit noch mehr Menschen teilnehmen können.',
    articleQuestions: [
      ['Wozu dient die App?', ['Sie verkauft Eintrittskarten.', 'Sie vermittelt kurze freiwillige Einsätze.', 'Sie ersetzt alle Vereine.'], 1],
      ['Welche Information sehen Interessierte?', ['Zeitaufwand und nötige Kenntnisse', 'private Adressen aller Mitglieder', 'die Gehälter der Mitarbeitenden'], 0],
      ['Wie viele Menschen haben sich registriert?', ['etwa zweihundert', 'mehr als zweitausend', 'genau achttausend'], 1],
      ['Wann werden vollständige Kontaktdaten sichtbar?', ['sofort für alle', 'nach einer bestätigten Anmeldung', 'erst nach einem Jahr'], 1],
      ['Welche Erweiterung ist geplant?', ['eine Version in einfacher Sprache', 'ein kostenpflichtiger Nachrichtendienst', 'eine gedruckte Tageszeitung'], 0],
    ],
    writing: {
      input: 'Ihr Verein möchte mehr Menschen über soziale Medien erreichen. Schreiben Sie an die Vereinsleiterin Frau Özdemir.',
      points: ['welche Plattform geeignet ist', 'welche Inhalte veröffentlicht werden sollten', 'wer die Beiträge erstellen kann', 'welche Regeln zum Datenschutz wichtig sind'],
      sample: 'Sehr geehrte Frau Özdemir, ich habe überlegt, wie unser Verein online mehr Menschen erreichen kann. Für uns wäre Instagram geeignet, weil dort viele jüngere Familien aus der Stadt aktiv sind. Wir könnten jede Woche kurze Berichte über Projekte, Termine und Möglichkeiten zur Mitarbeit veröffentlichen. Fotos sollten freundlich und authentisch sein. Ich kann gemeinsam mit David einen Redaktionsplan erstellen und die ersten Beiträge vorbereiten. Wichtig ist, dass Personen auf Bildern vorher schriftlich zustimmen und dass wir keine privaten Telefonnummern veröffentlichen. Außerdem sollten zwei Verantwortliche jeden Beitrag vor der Veröffentlichung prüfen. Gern stelle ich den Vorschlag bei der nächsten Sitzung vor. Mit freundlichen Grüßen, Mila Schneider',
    },
    opinion: ['Soziale Netzwerke stärken gesellschaftliches Engagement.', 'Online-Aktivität ersetzt keine echten Begegnungen.'],
    plan: ['Zielgruppe und Plattform', 'Themen und Formate', 'Aufgaben und Zeitplan', 'Datenschutz und Moderation'],
  },
];

function rotatedChoice(options, correctIndex, shift) {
  const amount = shift % options.length;
  const rotated = options.slice(amount).concat(options.slice(0, amount));
  return { options: rotated, answer: rotated.indexOf(options[correctIndex]) };
}

function listeningOne(profile, n) {
  const rows = [
    [`Ich wohne seit drei Jahren in ${profile.city}. Am Anfang kannte ich kaum jemanden. Seit ich bei einem Projekt im Stadtteil mitmache, treffe ich regelmäßig Menschen aus der Nachbarschaft und fühle mich hier wirklich zu Hause.`, `Die sprechende Person hat in ${profile.city} durch ein Projekt neue Kontakte gefunden.`, true],
    [`Mein Arbeitsweg durch ${profile.city} dauert normalerweise zwanzig Minuten. Heute nehme ich jedoch nicht die ${profile.transport}, weil es eine Umleitung gibt. Ich fahre mit dem Fahrrad und bin wahrscheinlich sogar etwas früher im Büro.`, `Die sprechende Person benutzt heute ${profile.transport}.`, false],
    [`Für einen Kurs in ${profile.city} musste ich zunächst selbst bezahlen. Nach dem erfolgreichen Abschluss hat mein Arbeitgeber aber die Hälfte der Kursgebühr übernommen. Darüber habe ich mich sehr gefreut.`, `Der Arbeitgeber bezahlte einen Teil des Kurses in ${profile.city}.`, true],
    [`${profile.person} bestellt nur selten im Internet. Kleidung probiert ${profile.person} lieber im Geschäft an, und bei technischen Geräten ist eine persönliche Beratung wichtiger als der niedrigste Preis.`, `${profile.person} kauft technische Geräte am liebsten online.`, false],
    [`Am Wochenende wollte ich eigentlich ausruhen. Dann hat mich ${profile.person} gefragt, ob ich beim ${profile.event} helfen kann. Jetzt übernehme ich zwei Stunden am Informationsstand und freue mich schon darauf.`, `Die sprechende Person hilft am Wochenende beim ${profile.event}.`, true],
  ];
  return rows.map((row, index) => ({ id: `b1m${n}-h1-${index + 1}`, transcript: row[0], statement: row[1], answer: row[2], explain: row[2] ? 'Die Aussage entspricht dem Hörtext.' : 'Ein wichtiges Detail ist im Hörtext anders.', points: 5, audio: `${audioRoot}/mt${n}/b1m${n}-h1-${index + 1}.mp3` }));
}

function listeningConversation(profile, n) {
  const transcript = `Moderatorin: Guten Abend, ${profile.contact}. Sie organisieren in ${profile.city} ${profile.eventObject}. Wann findet die Veranstaltung statt? ${profile.contact}: Am ${profile.date}. Wir beginnen um ${profile.time}. Moderatorin: Wo treffen sich die Gäste? ${profile.contact}: ${profile.place}. Die Anreise ist am einfachsten mit ${profile.transportDative}. Moderatorin: Muss man Eintritt bezahlen? ${profile.contact}: Der Eintritt ist ${profile.cost}. Eine Anmeldung ist trotzdem nötig, und zwar bis zum ${profile.deadline}. Moderatorin: Wer kann teilnehmen? ${profile.contact}: Erwachsene, Jugendliche und Familien sind willkommen. Kinder unter zwölf Jahren müssen von einer erwachsenen Person begleitet werden. Moderatorin: Was erwartet die Besucher? ${profile.contact}: Es gibt Informationen, praktische Aktionen und ein kleines Kulturprogramm. Für Essen sorgen wir auch: ${profile.food}. Moderatorin: Werden noch Helfer gesucht? ${profile.contact}: Ja, besonders für den Aufbau am Vormittag und das Aufräumen am Abend. Interessierte melden sich direkt bei mir. Moderatorin: Und falls das Wetter schlecht ist? ${profile.contact}: Dann nutzen wir ${profile.weatherPlan}. Die Veranstaltung fällt also nicht aus. Moderatorin: Vielen Dank für die Informationen.`;
  const statements = [
    [`Die Veranstaltung findet am ${profile.date} statt.`, true],
    [`Beginn ist um ${profile.time}.`, true],
    [`Veranstaltungsort ist ${profile.place}.`, true],
    [`Alle Besucher des ${profile.event} müssen mit dem Auto anreisen.`, false],
    [`Der Eintritt für das Angebot in ${profile.city} ist ${profile.cost}.`, true],
    [`Anmeldeschluss ist der ${profile.deadline}.`, true],
    [`Kinder unter zwölf Jahren dürfen beim ${profile.event} immer allein teilnehmen.`, false],
    [`Als Verpflegung gibt es ${profile.food}.`, true],
    [`Für den Aufbau des ${profile.event} werden keine Helfer mehr benötigt.`, false],
    [`Bei schlechtem Wetter wird das Angebot in ${profile.city} abgesagt.`, false],
  ];
  return {
    id: 'h2', title: 'Teil 2 – Ein Gespräch verstehen', type: 'audio-group-truefalse', grouped: true, plays: 2,
    instructions: 'Lesen Sie zuerst alle zehn Aussagen. Hören Sie danach das Gespräch zweimal und markieren Sie richtig oder falsch.',
    transcript, audio: `${audioRoot}/mt${n}/b1m${n}-h2.mp3`,
    items: statements.map((row, index) => ({ id: `b1m${n}-h2-${index + 1}`, statement: row[0], answer: row[1], explain: row[1] ? 'Diese Information wird im Gespräch bestätigt.' : 'Das Gespräch nennt eine andere Information.', points: 2.5 })),
  };
}

function listeningThree(profile, n) {
  const rows = [
    [`Achtung am Hauptbahnhof ${profile.city}: Der Regionalexpress nach Berlin fährt heute nicht von Gleis acht, sondern von Gleis zwölf. Die Abfahrtszeit ändert sich nicht.`, `Der Zug in ${profile.city} fährt heute von Gleis zwölf.`, true],
    [`Das Bürgerbüro ${profile.city} öffnet morgen wegen einer internen Schulung erst um elf Uhr. Bereits vereinbarte Termine am Vormittag werden telefonisch neu vergeben.`, `Das Bürgerbüro ${profile.city} öffnet morgen zur normalen Zeit.`, false],
    [`Und nun das Wetter für ${profile.city}: Am Morgen bleibt es trocken. Gegen Mittag ziehen Wolken auf, ab dem späten Nachmittag muss mit kräftigem Regen gerechnet werden.`, `In ${profile.city} wird am späten Nachmittag Regen erwartet.`, true],
    [`Sie hören eine Nachricht der Praxis ${profile.person}. Ihr Termin wurde von Donnerstag auf Freitag, neun Uhr fünfzehn verschoben. Bitte bestätigen Sie den neuen Termin.`, `Der neue Termin in der Praxis ${profile.person} ist am Donnerstag.`, false],
    [`Im Kulturzentrum ${profile.city} beginnt gleich der Informationsabend zum Thema ${profile.event}. Eintrittskarten gibt es noch an der Abendkasse. Angemeldete zahlen sechs Euro, alle anderen neun Euro.`, `Auch ohne Anmeldung kann man den Informationsabend in ${profile.city} besuchen.`, true],
  ];
  return rows.map((row, index) => ({ id: `b1m${n}-h3-${index + 1}`, transcript: row[0], statement: row[1], answer: row[2], explain: row[2] ? 'Die Aussage stimmt mit der Ansage überein.' : 'Die Ansage enthält ein abweichendes Detail.', points: 5, audio: `${audioRoot}/mt${n}/b1m${n}-h3-${index + 1}.mp3` }));
}

function readingHeadings(profile, n) {
  const topics = [
    ['Gemeinsam statt allein', `In ${profile.city} treffen sich jeden Mittwoch Menschen, die neu in der Stadt sind. Sie kochen zusammen, tauschen praktische Tipps aus und planen kleine Ausflüge. Das Angebot begann als privater Stammtisch. Inzwischen unterstützt auch das Stadtteilzentrum die Gruppe mit einem kostenlosen Raum.`],
    ['Lernen im eigenen Tempo', `Eine neue Online-Plattform aus ${profile.city} bietet kurze Kurse, die man flexibel am Abend oder am Wochenende bearbeiten kann. Nach jeder Einheit gibt es eine praktische Aufgabe und eine persönliche Rückmeldung. Besonders Berufstätige nutzen das Angebot, weil sie keine festen Unterrichtszeiten einhalten müssen.`],
    ['Reparieren schützt Umwelt und Geldbeutel', `Im monatlichen Reparaturcafé von ${profile.city} helfen Fachleute ehrenamtlich dabei, kaputte Haushaltsgeräte, Fahrräder und Kleidung wieder nutzbar zu machen. Ersatzteile müssen selbst bezahlt werden, die Beratung ist kostenlos. Viele Gegenstände können dadurch weiterverwendet werden.`],
    ['Mehr Platz für Fahrräder', `Die Stadt ${profile.city} baut an drei Bahnhöfen sichere Fahrradstationen. Pendler können dort Räder trocken abstellen und kleine Reparaturen erledigen lassen. Die ersten hundert Nutzer erhalten ein vergünstigtes Jahresticket.`],
    ['Kultur für jedes Budget', `Mehrere Theater in ${profile.city} führen einmal im Monat ein neues Preismodell ein. Besucher entscheiden innerhalb eines festgelegten Rahmens selbst, wie viel sie bezahlen. Damit sollen auch Menschen mit geringem Einkommen regelmäßig Vorstellungen besuchen können.`],
  ];
  const headings = topics.flatMap(([heading], index) => [heading, `${index + 1}. Alternative: Angebot nur für Fachleute`]);
  const ads = headings.map((body, index) => ({ label: labels[index], body }));
  const options = ads.map((entry) => entry.label);
  return { id: 'l1', title: 'Teil 1 – Überschriften zuordnen', type: 'read-match', matchLabel: 'Überschrift', instructions: 'Lesen Sie fünf kurze Texte und ordnen Sie jedem Text die passende Überschrift zu. Jede Überschrift darf nur einmal benutzt werden.', ads, items: topics.map((row, index) => ({ id: `b1m${n}-l1-${index + 1}`, situation: row[1], options, answer: index * 2, explain: `Passend ist „${row[0]}“.`, points: 5 })) };
}

function readingArticle(profile, n) {
  return { id: 'l2', title: 'Teil 2 – Einen Artikel verstehen', type: 'read-choice', instructions: 'Lesen Sie den Artikel und wählen Sie bei jeder Aufgabe a, b oder c.', texts: [{ id: `b1m${n}-article`, label: profile.articleTitle, body: profile.article }], items: profile.articleQuestions.map((row, index) => ({ id: `b1m${n}-l2-${index + 1}`, textRef: `b1m${n}-article`, question: row[0], options: row[1], answer: row[2], explain: 'Die richtige Antwort lässt sich direkt oder sinngemäß im Artikel finden.', points: 5 })) };
}

function readingAds(profile, n) {
  const offers = [
    [`Sprachcafé ${profile.city}: lockere Gespräche auf Deutsch, donnerstags 18 Uhr, kostenlos und ohne Anmeldung.`, `Sie wohnen in ${profile.city} und möchten regelmäßig kostenlos Deutsch sprechen.`],
    [`Fahrradwerkstatt ${profile.city} Mobil: Reparaturen, Sicherheitscheck und Ersatzräder während der Reparatur.`, `Ihr Fahrrad ist in ${profile.city} kaputt und Sie brauchen vorübergehend ein Ersatzrad.`],
    [`Kurszentrum ${profile.city} Aktiv: Rückentraining am Abend, Krankenkassenzuschuss möglich.`, `Sie suchen in ${profile.city} nach der Arbeit einen Gesundheitskurs.`],
    [`Tierschutzverein ${profile.city}: Ehrenamtliche für Spaziergänge mit Hunden am Wochenende gesucht.`, `Sie möchten in ${profile.city} samstags freiwillig mit Tieren arbeiten.`],
    [`Wohnberatung ${profile.city}: kostenlose Prüfung von Mietvertrag und Nebenkostenabrechnung.`, `Sie verstehen Ihre hohe Nebenkostenabrechnung in ${profile.city} nicht.`],
    [`Computerhilfe ${profile.city} 60+: persönliche Unterstützung bei Smartphone, E-Mail und Videotelefonie.`, `${profile.person} möchte einer älteren Person in ${profile.city} einen Smartphone-Kurs empfehlen.`],
    [`Familienzentrum ${profile.city}: Ferienprogramm für Kinder von 7 bis 12 Jahren, inklusive Mittagessen.`, `Sie brauchen in ${profile.city} eine Ferienbetreuung für Ihr zehnjähriges Kind.`],
    [`Reisegruppe Natur ${profile.city}: geführte Wochenendwanderungen, mittleres Tempo, Anreise mit ${profile.transportDative}.`, `Sie möchten ab ${profile.city} ohne Auto an einer organisierten Wanderung teilnehmen.`],
    [`Möbelbörse ${profile.city}: gebrauchte Tische, Schränke und Stühle, Lieferung gegen Aufpreis.`, `Sie suchen in ${profile.city} preiswerte Möbel und benötigen eine Lieferung.`],
    [`Bewerbungswerkstatt ${profile.city}: Lebenslauf-Check und Vorbereitung auf Vorstellungsgespräche.`, `${profile.person} möchte sich in ${profile.city} auf ein Bewerbungsgespräch vorbereiten.`],
    [`Musikschule ${profile.city}: Klavierunterricht nur für Fortgeschrittene, vormittags.`, null],
    [`Gartenservice ${profile.city}: professionelle Gartenpflege ausschließlich für Firmenflächen.`, null],
  ];
  const ads = offers.map((row, index) => ({ label: labels[index], body: row[0] }));
  const options = ads.map((entry) => entry.label).concat('x');
  return { id: 'l3', title: 'Teil 3 – Situationen und Anzeigen', type: 'read-match', matchLabel: 'Anzeige', instructions: 'Finden Sie für jede Situation die passende Anzeige. Wenn nichts passt, wählen Sie x.', ads, items: offers.slice(0, 10).map((row, index) => ({ id: `b1m${n}-l3-${index + 1}`, situation: row[1], options, answer: index, explain: `Anzeige ${labels[index]} erfüllt die wichtigsten Anforderungen.`, points: 2.5 })) };
}

function languageOne(profile, n) {
  const textRef = `b1m${n}-sb1-text`;
  const text = `Hallo ${profile.person}, ich wollte dir schon lange schreiben, ___ in den letzten Wochen war sehr viel los. Seit ich in ${profile.city} ___, habe ich eine neue Stelle und muss mich noch an vieles gewöhnen. Meine Kolleginnen sind freundlich, ___ die Arbeit manchmal anstrengend ist. Besonders gut gefällt mir, ___ wir Aufgaben gemeinsam planen. Nächsten Monat nehme ich an einer Weiterbildung teil, ___ ich sicherer mit neuen Programmen umgehen kann. Der Kurs findet abends statt, ___ kann ich tagsüber normal arbeiten. Ich hoffe, ___ wir uns bald wiedersehen. Hättest du am zweiten Wochenende Zeit, ___ mich zu besuchen? Dann zeige ich dir die Stadt, ___ wir können auch zusammen zum ${profile.event} gehen. Schreib mir bitte, ___ der Termin für dich passt. Viele Grüße`;
  const base = [
    [['aber', 'denn', 'sondern'], 1], [['wohne', 'wohnte', 'gewohnt'], 0], [['obwohl', 'damit', 'während'], 0], [['dass', 'ob', 'wenn'], 0], [['damit', 'trotzdem', 'anstatt'], 0],
    [['deshalb', 'obwohl', 'sondern'], 0], [['dass', 'weil', 'wann'], 0], [['um', 'bei', 'zu'], 2], [['aber', 'oder', 'denn'], 0], [['ob', 'als', 'dass'], 0],
  ];
  return { id: 'sb1', title: 'Sprachbausteine Teil 1 – Grammatik', type: 'read-choice', instructions: 'Lesen Sie die E-Mail und wählen Sie für jede Lücke die passende Lösung.', texts: [{ id: textRef, label: 'E-Mail mit zehn Lücken', body: text }], items: base.map((row, index) => { const choice = rotatedChoice(row[0], row[1], n + index); return { id: `b1m${n}-sb1-${index + 1}`, textRef, question: `Welche Lösung passt in Lücke ${index + 21}?`, options: choice.options, answer: choice.answer, explain: 'Die Lösung passt grammatisch und inhaltlich in den Satz.', points: 1.5 }; }) };
}

function languageTwo(profile, n) {
  const bankWords = ['ANMELDEN', 'BEI', 'DAMIT', 'DESHALB', 'FÜR', 'GERN', 'INFORMATIONEN', 'KÖNNEN', 'MÖCHTE', 'NOCH', 'OB', 'SCHON', 'ÜBER', 'WENN', 'WÜRDE'];
  const answers = ['ÜBER', 'MÖCHTE', 'NOCH', 'OB', 'KÖNNEN', 'FÜR', 'ANMELDEN', 'WENN', 'WÜRDE', 'GERN'];
  const textRef = `b1m${n}-sb2-text`;
  const text = `Sehr geehrte Damen und Herren, auf Ihrer Internetseite habe ich mich ___ ${profile.eventObject} informiert. Ich ___ mit zwei Freunden teilnehmen, habe aber ___ einige Fragen. Können Sie mir sagen, ___ am ${profile.date} noch Plätze frei sind? Außerdem ___ wir erst gegen ${profile.time} ankommen. Ist eine spätere Ankunft möglich? Wir interessieren uns besonders ___ das Programm und möchten uns möglichst bald ___. Bitte teilen Sie mir mit, ___ wir die Gebühr vorab überweisen müssen. Ich ___ mich außerdem über Hinweise zur Anreise mit ${profile.transportDative} freuen. Vielen Dank. Ich höre ___ von Ihnen. Mit freundlichen Grüßen`;
  const ads = bankWords.map((body, index) => ({ label: labels[index], body }));
  const options = ads.map((entry) => entry.label);
  return { id: 'sb2', title: 'Sprachbausteine Teil 2 – Wortschatz', type: 'read-match', matchLabel: 'Wort', instructions: 'Wählen Sie aus der Wortliste die passende Lösung für jede Lücke. Nicht alle Wörter werden gebraucht.', texts: [{ id: textRef, label: 'Anfrage mit zehn Lücken', body: text }], ads, items: answers.map((word, index) => ({ id: `b1m${n}-sb2-${index + 1}`, textRef, situation: `Welche Lösung passt in Lücke ${index + 31}?`, options, answer: bankWords.indexOf(word), explain: `In diese Lücke passt „${word}“.`, points: 1.5 })) };
}

function makeTest(profile, index) {
  const n = index + 1;
  return {
    id: `mt${n}`, title: profile.title, topic: profile.event,
    sections: [
      { id: 'hoeren', title: 'Hören', durationMin: 30, maxPoints: 75, instructions: 'Bearbeiten Sie drei Teile. Teil 1 hören Sie einmal, Teil 2 und Teil 3 zweimal.', parts: [
        { id: 'h1', title: 'Teil 1 – Kurze Meinungen', type: 'audio-truefalse', plays: 1, instructions: 'Hören Sie fünf kurze Texte jeweils einmal und markieren Sie richtig oder falsch.', items: listeningOne(profile, n) },
        listeningConversation(profile, n),
        { id: 'h3', title: 'Teil 3 – Kurze Ansagen', type: 'audio-truefalse', plays: 2, instructions: 'Hören Sie fünf kurze Ansagen jeweils zweimal und markieren Sie richtig oder falsch.', items: listeningThree(profile, n) },
      ] },
      { id: 'lesen', title: 'Lesen und Sprachbausteine', durationMin: 90, maxPoints: 105, instructions: 'Bearbeiten Sie drei Teile Leseverstehen und zwei Teile Sprachbausteine.', parts: [readingHeadings(profile, n), readingArticle(profile, n), readingAds(profile, n), languageOne(profile, n), languageTwo(profile, n)] },
      { id: 'schreiben', title: 'Schreiben', durationMin: 30, maxPoints: 45, aiGraded: true, instructions: 'Schreiben Sie eine informelle oder halbformelle E-Mail und bearbeiten Sie alle vier Leitpunkte.', parts: [
        { id: 's1', title: 'Schriftlicher Ausdruck – E-Mail', type: 'free-write', instructions: `${profile.writing.input} Schreiben Sie etwas zu allen vier Punkten und achten Sie auf Betreff, Anrede, Einleitung und Schluss.`, minWords: 100, leitpunkte: profile.writing.points, sample: profile.writing.sample, rubric: { level: 'B1', maxPoints: 45, criteria: ['Aufgabenbewältigung', 'Kommunikative Gestaltung', 'Formale Richtigkeit'] } },
      ] },
      { id: 'sprechen', title: 'Sprechen', durationMin: 15, maxPoints: 75, aiGraded: true, instructions: 'Sie haben vor der mündlichen Prüfung 20 Minuten Vorbereitungszeit. Sprechen Sie zusammenhängend und reagieren Sie auf Ihre Partnerin.', parts: [
        { id: 'sp1', title: 'Teil 1 – Einander kennenlernen', type: 'speak-intro', instructions: 'Stellen Sie sich vor, fragen Sie nach und antworten Sie auf Nachfragen.', prompts: ['Warum lernen Sie Deutsch und wann benutzen Sie die Sprache?', 'Welche persönlichen oder beruflichen Pläne haben Sie für das nächste Jahr?'], rubric: { level: 'B1', maxPoints: 15, criteria: ['Ausdrucksfähigkeit', 'Aufgabenbewältigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] } },
        { id: 'sp2', title: 'Teil 2 – Über ein Thema sprechen', type: 'speak-cards', instructions: `Diskutieren Sie das Thema „${profile.opinion[0]}“. Fassen Sie Meinungen zusammen, äußern Sie Ihre eigene Ansicht und berichten Sie von Erfahrungen.`, cards: profile.opinion.map((keyword, cardIndex) => ({ id: `sp2-${cardIndex + 1}`, keyword, example: 'Ich verstehe diesen Standpunkt, allerdings bin ich der Meinung, dass …', partner: cardIndex ? profile.opinion[0] : profile.opinion[1] })), rubric: { level: 'B1', maxPoints: 30, criteria: ['Ausdrucksfähigkeit', 'Aufgabenbewältigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] } },
        { id: 'sp3', title: 'Teil 3 – Gemeinsam etwas planen', type: 'speak-cards', instructions: `Planen Sie gemeinsam: ${profile.event}. Machen Sie Vorschläge, begründen Sie, reagieren Sie und einigen Sie sich.`, cards: profile.plan.map((keyword, cardIndex) => ({ id: `sp3-${cardIndex + 1}`, keyword, example: `Mein Vorschlag für ${keyword.toLowerCase()} wäre …, weil …`, partner: 'Das ist möglich, aber ich habe noch einen anderen Vorschlag.' })), rubric: { level: 'B1', maxPoints: 30, criteria: ['Ausdrucksfähigkeit', 'Aufgabenbewältigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] } },
      ] },
    ],
  };
}

const bank = {
  exam: 'telc-deutsch-b1', level: 'B1',
  note: 'Eigenständige DUVELA-Übungsinhalte im Format Zertifikat Deutsch / telc Deutsch B1. Kein offizieller telc-Prüfungssatz.',
  quality: { version: 2, reviewed: '2026-08-14', audioScripts: 55, modelTests: 5, review: 'B1 format, grammar, ambiguity, answer validity and cross-test duplication checked.' },
  passMark: 60,
  passRules: { written: { sections: ['lesen', 'hoeren', 'schreiben'], maxPoints: 225, minPoints: 135 }, oral: { sections: ['sprechen'], maxPoints: 75, minPoints: 45 } },
  weights: { lesen: 105, hoeren: 75, schreiben: 45, sprechen: 75 },
  tests: profiles.map(makeTest),
};

const bankPath = path.join(root, 'web', 'content', 'telc-b1-exam-bank.json');
fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');

const scripts = ['DUVELA EXAM · TELC DEUTSCH B1 · ELEVENLABS AUDIO SCRIPTS', 'Format: relative MP3 path | German transcript', ''];
for (const test of bank.tests) {
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  for (const item of hearing.parts[0].items) scripts.push(`${item.audio.replace(`${audioRoot}/`, '')} | ${item.transcript}`);
  scripts.push(`${hearing.parts[1].audio.replace(`${audioRoot}/`, '')} | ${hearing.parts[1].transcript}`);
  for (const item of hearing.parts[2].items) scripts.push(`${item.audio.replace(`${audioRoot}/`, '')} | ${item.transcript}`);
}
const scriptDir = path.join(root, 'web', 'audio', 'exam-b1');
fs.mkdirSync(scriptDir, { recursive: true });
fs.writeFileSync(path.join(scriptDir, 'elevenlabs-scripts.txt'), `${scripts.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(scriptDir, 'README.md'), '# DUVELA EXAM B1 audio\n\nGenerate the 55 recordings listed in `elevenlabs-scripts.txt` and preserve the exact folder and file names. Until MP3 files are present, the browser uses the German system voice as a fallback.\n', 'utf8');

console.log(`[b1] Generated ${bank.tests.length} tests and ${scripts.length - 3} audio scripts.`);
