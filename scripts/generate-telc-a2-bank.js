'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const audioRoot = './web/audio/exam-a2';
const tests = [
  {
    title: 'Modelltest 1 – Alltag und Termine',
    h1: [
      ['Guten Tag, hier ist die Praxis Dr. König. Ihr Termin am Mittwoch muss leider ausfallen. Wir können Ihnen stattdessen Donnerstag um sechzehn Uhr dreißig anbieten. Bitte rufen Sie kurz zurück.','Wann ist der neue Termin?',['Mittwoch, 16:30 Uhr','Donnerstag, 16:30 Uhr','Donnerstag, 17:30 Uhr'],1],
      ['Hallo Frau Aydin, Ihr Fahrrad ist fertig. Die Reparatur kostet achtundvierzig Euro. Sie können es heute bis achtzehn Uhr oder morgen ab neun Uhr abholen.','Wie viel kostet die Reparatur?',['38 Euro','48 Euro','58 Euro'],1],
      ['Hi Lukas, wir treffen uns nicht vor dem Kino, sondern direkt im Café gegenüber. Ich bin gegen Viertel nach sieben da.','Wo treffen sich die Personen?',['vor dem Kino','im Kino','im Café gegenüber'],2],
      ['Guten Morgen, der Computerkurs beginnt erst nächste Woche. Der erste Termin ist am zwölften September in Raum zweihundertvier.','Wann beginnt der Kurs?',['diese Woche','am 12. September','am 20. September'],1],
      ['Hier ist der Paketdienst. Wir konnten Sie nicht erreichen. Ihr Paket liegt ab morgen in der Postfiliale am Markt und bleibt dort sieben Tage.','Wo kann man das Paket abholen?',['beim Nachbarn','in der Postfiliale','im Paketauto'],1]
    ],
    h2: [
      ['Und nun zum Wetter: Am Vormittag bleibt es trocken. Ab vierzehn Uhr gibt es starke Regenschauer, am Abend wird es wieder freundlicher.','Wann regnet es?',['am Vormittag','am Nachmittag','erst in der Nacht'],1],
      ['Wegen einer technischen Störung fährt die U-Bahn-Linie drei heute nur bis Rathaus. Fahrgäste zum Hauptbahnhof nehmen bitte den Bus Nummer acht.','Wie kommt man zum Hauptbahnhof?',['mit der U-Bahn 3','mit dem Bus 8','mit der Straßenbahn 8'],1],
      ['In unserer Mittagssendung sprechen wir heute über gesundes Essen im Büro. Danach können Hörerinnen und Hörer anrufen und Fragen stellen.','Worum geht es in der Sendung?',['Sport im Büro','gesundes Essen','neue Arbeitsplätze'],1],
      ['Das Stadtmuseum lädt am Sonntag zum Familientag ein. Kinder bis zwölf Jahre zahlen keinen Eintritt. Erwachsene zahlen sechs Euro.','Wer hat freien Eintritt?',['alle Besucher','Kinder bis zwölf','Erwachsene ab sechzig'],1],
      ['Achtung Autofahrer: Auf der A fünf zwischen Nordkreuz und Flughafen gibt es nach einem Unfall zehn Kilometer Stau. Bitte fahren Sie über die Bundesstraße.','Was wird empfohlen?',['über die Bundesstraße fahren','am Flughafen warten','die A fünf schneller fahren'],0]
    ],
    h3: [
      ['Mara: Für das Sommerfest brauchen wir noch Hilfe. Jonas, kannst du die Getränke kaufen? Jonas: Ja, das mache ich nach der Arbeit.','Was übernimmt Jonas?',['Getränke kaufen','Musik organisieren','Tische aufstellen'],0],
      ['Mara: Lea, kümmerst du dich um die Musik? Lea: Gern, ich bringe meine Lautsprecher und eine Playlist mit.','Was übernimmt Lea?',['Salate machen','Musik organisieren','Einladungen schreiben'],1],
      ['Mara: Ben, wir brauchen noch sechs Tische. Ben: Ich frage den Nachbarn, er kann sie mit seinem Wagen bringen.','Was übernimmt Ben?',['Tische organisieren','Kuchen backen','Fotos machen'],0],
      ['Mara: Sofia, könntest du zwei Salate machen? Sofia: Natürlich, einen Kartoffelsalat und einen grünen Salat.','Was übernimmt Sofia?',['Getränke kaufen','Salate machen','Gäste abholen'],1],
      ['Mara: Und wer fotografiert? Amir: Ich nehme meine Kamera mit und schicke später allen die Bilder.','Was übernimmt Amir?',['Musik organisieren','Fotos machen','Tische bringen'],1]
    ],
    l1: { text:'BÜRGERHAUS WEST – Erdgeschoss: Anmeldung, Fundbüro, Café. 1. Stock: Sprachberatung, Computerkurse, Raum 101–108. 2. Stock: Musikschule, Familienberatung, Raum 201–206. Öffnungszeiten: Mo–Fr 8–18 Uhr, Samstag 9–13 Uhr.', items:[
      ['Sie möchten sich für einen Kurs anmelden.',['Erdgeschoss','1. Stock','2. Stock'],0],
      ['Sie suchen die Sprachberatung.',['Erdgeschoss','1. Stock','2. Stock'],1],
      ['Ihr Kind möchte Klavier lernen.',['Erdgeschoss','1. Stock','2. Stock'],2],
      ['Sie haben Ihre Tasche verloren.',['Erdgeschoss','1. Stock','2. Stock'],0],
      ['Sie brauchen Hilfe bei einem Familienproblem.',['Erdgeschoss','1. Stock','2. Stock'],2]
    ]},
    l2: { text:'Nachbarschaftsgarten am Park: Seit März bauen Bewohnerinnen und Bewohner gemeinsam Gemüse und Kräuter an. Wer mitmachen möchte, kommt samstags um zehn Uhr zum Gartentor. Werkzeug ist vorhanden, nur Handschuhe sollte man selbst mitbringen. Die Ernte wird unter allen Helfenden geteilt. Einmal im Monat gibt es außerdem ein gemeinsames Frühstück.', items:[
      ['Das Gartenprojekt gibt es seit März.',true],['Man arbeitet jeden Sonntag im Garten.',false],['Werkzeug muss jeder selbst kaufen.',false],['Die Helfenden teilen das Gemüse.',true],['Jeden Monat frühstückt die Gruppe zusammen.',true]
    ]},
    ads:[['a','Kochstudio Löffel: schnelle Gerichte für Berufstätige, dienstags 19 Uhr.'],['b','RadFit: Fahrradwerkstatt und Reparaturkurs am Samstag.'],['c','City-Sprachen: Deutsch am Abend, Niveau A2, kleine Gruppen.'],['d','Tierfreunde: Ehrenamtliche Hilfe im Tierheim gesucht.'],['e','Tanzraum: Salsa für Anfänger, freitags ab 20 Uhr.'],['f','Computerhilfe zu Hause – Einrichtung, Internet und Drucker.'],['g','Familienausflug mit dem Schiff, Sonntag 10 Uhr.'],['h','Wohnungsbörse: Zimmer und Wohnungen in der Region.']],
    situations:[['Sie arbeiten tagsüber und suchen einen Deutschkurs.','c'],['Ihr Drucker funktioniert nicht.','f'],['Sie möchten lernen, Ihr Fahrrad selbst zu reparieren.','b'],['Sie möchten am Wochenende etwas mit Kindern unternehmen.','g'],['Sie suchen eine kleine Wohnung.','h']],
    form:{instructions:'Ihr Bekannter Karim Mansour möchte Mitglied im Sportverein Aktiv werden. Er wurde am 14. Mai 1994 in Alexandria geboren, wohnt in der Lindenstraße 8 in Bremen und spielt gern Volleyball.',fields:[['Familienname','Mansour'],['Vorname','Karim'],['Geburtsdatum','14.05.1994'],['Wohnort','Bremen'],['Sportart','Volleyball']]},
    write:{instructions:'Ihre Freundin Nina feiert am Samstag Geburtstag und hat Sie eingeladen. Antworten Sie ihr. Wählen Sie drei der vier Punkte und schreiben Sie etwa 40 Wörter.',points:['für die Einladung danken','sagen, ob Sie kommen','nach einem Geschenk fragen','jemanden mitbringen'],sample:'Liebe Nina, vielen Dank für deine Einladung. Ich komme am Samstag sehr gern zu deiner Feier. Was wünschst du dir zum Geburtstag? Darf ich meine Freundin Sara mitbringen? Wir können auch einen Salat vorbereiten. Viele Grüße, Anna'},
    speak:{topic:'Freizeit planen',cards:['Wann haben Sie Zeit?','Was möchten Sie machen?','Wo treffen wir uns?','Wie kommen wir dorthin?']}
  },
  {
    title:'Modelltest 2 – Wohnen und Nachbarschaft',
    h1:[
      ['Hallo Frau Berger, der Hausmeister kommt morgen zwischen zehn und zwölf Uhr wegen Ihrer Heizung. Bitte stellen Sie sicher, dass jemand zu Hause ist.','Wann kommt der Hausmeister?',['heute 10–12 Uhr','morgen 10–12 Uhr','morgen 12–14 Uhr'],1],
      ['Guten Tag, Sie interessieren sich für die Wohnung in der Gartenstraße. Die Besichtigung ist am Freitag um siebzehn Uhr. Treffen ist vor Haus Nummer neun.','Wo ist der Treffpunkt?',['vor Haus 9','in Wohnung 17','im Garten'],0],
      ['Hallo David, ich leihe dir gern meine Bohrmaschine. Hol sie bitte heute Abend bei mir im dritten Stock ab.','Was kann David ausleihen?',['eine Leiter','eine Bohrmaschine','einen Werkzeugkasten'],1],
      ['Hier ist Möbelhaus Kern. Ihr Schrank wird nicht am Montag, sondern am Dienstagvormittag geliefert. Die Montage dauert ungefähr eine Stunde.','Wann kommt der Schrank?',['Montagvormittag','Dienstagvormittag','Dienstagnachmittag'],1],
      ['Liebe Mieter, wegen Arbeiten am Wasserrohr gibt es am Donnerstag von acht bis elf Uhr kein warmes Wasser.','Was gibt es am Donnerstag nicht?',['Strom','kaltes Wasser','warmes Wasser'],2]
    ],
    h2:[
      ['Die Stadt eröffnet heute einen neuen Wertstoffhof im Norden. Geöffnet ist montags bis samstags von acht bis siebzehn Uhr.','Wann ist der Wertstoffhof geöffnet?',['nur am Wochenende','Montag bis Samstag','jeden Tag'],1],
      ['Wegen des Straßenfests dürfen Autos morgen nicht in der Rosenstraße parken. Bitte nutzen Sie das Parkhaus am Bahnhof.','Wo soll man parken?',['in der Rosenstraße','am Rathaus','im Parkhaus am Bahnhof'],2],
      ['Unsere heutige Sendung zeigt, wie man im Haushalt Energie spart. Experten erklären, welche Geräte besonders viel Strom brauchen.','Was ist das Thema?',['Energie sparen','neue Haushaltsgeräte kaufen','Wohnungen mieten'],0],
      ['Im Stadtteilzentrum findet am Mittwoch ein kostenloser Tauschabend statt. Bringen Sie Kleidung mit, die Sie nicht mehr tragen.','Was wird getauscht?',['Bücher','Kleidung','Möbel'],1],
      ['Die Müllabfuhr kommt wegen des Feiertags einen Tag später. Stellen Sie die Tonnen bitte erst am Donnerstagabend heraus.','Wann sollen die Tonnen heraus?',['Mittwochabend','Donnerstagabend','Freitagmorgen'],1]
    ],
    h3:[
      ['Eva: Beim Umzug brauchen wir Aufgaben. Tom, kannst du den Transporter fahren? Tom: Ja, ich hole ihn morgens ab.','Was macht Tom?',['Kartons packen','Transporter fahren','Essen kochen'],1],
      ['Eva: Leni, packst du bitte die Bücher ein? Leni: Klar, ich bringe auch stabile Kartons mit.','Was macht Leni?',['Bücher einpacken','Möbel tragen','Fenster putzen'],0],
      ['Eva: Paul, kannst du die Lampen abmontieren? Paul: Ja, ich bringe Werkzeug mit.','Was macht Paul?',['Lampen abmontieren','Transporter fahren','Adresse ändern'],0],
      ['Eva: Sara, könntest du für alle etwas kochen? Sara: Ich mache eine große Suppe.','Was macht Sara?',['Kartons kaufen','Essen vorbereiten','Wohnung streichen'],1],
      ['Eva: Ali, wir müssen noch die alte Wohnung reinigen. Ali: Ich komme am Sonntag mit Putzmitteln.','Was macht Ali?',['alte Wohnung reinigen','Möbel verkaufen','Schlüssel abholen'],0]
    ],
    l1:{text:'WOHNSERVICE MITTE – Schalter A: Mietverträge und Kündigungen. Schalter B: Reparaturen und Schäden. Schalter C: Schlüssel und Hausordnung. Beratung ohne Termin: Dienstag und Donnerstag 9–12 Uhr. Telefonisch: Mo–Fr 8–16 Uhr.',items:[
      ['Ihr Fenster ist kaputt.',['Schalter A','Schalter B','Schalter C'],1],['Sie möchten Ihre Wohnung kündigen.',['Schalter A','Schalter B','Schalter C'],0],['Sie haben den Hausschlüssel verloren.',['Schalter A','Schalter B','Schalter C'],2],['Sie haben eine Frage zur Hausordnung.',['Schalter A','Schalter B','Schalter C'],2],['Sie möchten einen Mietvertrag unterschreiben.',['Schalter A','Schalter B','Schalter C'],0]
    ]},
    l2:{text:'In unserem Haus gibt es seit einem Jahr eine Nachbarschaftshilfe. Ältere Bewohner bekommen Unterstützung beim Einkaufen, junge Familien können Werkzeuge oder Kinderkleidung ausleihen. Die Hilfe kostet nichts. Wer etwas anbieten oder suchen möchte, schreibt eine Nachricht auf die Tafel im Eingangsbereich. Jeden ersten Montag im Monat trifft sich die Gruppe im Hof.',items:[
      ['Die Nachbarschaftshilfe besteht seit einem Jahr.',true],['Nur ältere Menschen dürfen teilnehmen.',false],['Das Angebot ist kostenlos.',true],['Nachrichten stehen im Keller.',false],['Die Gruppe trifft sich monatlich.',true]
    ]},
    ads:[['a','Helle Zwei-Zimmer-Wohnung, Balkon, Nähe Zentrum, 780 Euro warm.'],['b','Malerbetrieb Bunt – Zimmer streichen, schnell und sauber.'],['c','Umzugshelfer am Wochenende, auch mit Transporter.'],['d','Gartenmöbel günstig abzugeben, nur Selbstabholung.'],['e','Reinigungskraft sucht Arbeit in Privathaushalten.'],['f','Mieterverein: Beratung zu Vertrag, Miete und Nebenkosten.'],['g','WG-Zimmer für Studierende, 350 Euro, Internet inklusive.'],['h','Schlüsseldienst Tag und Nacht, in 30 Minuten vor Ort.']],
    situations:[['Sie haben sich ausgesperrt.','h'],['Sie möchten ein Zimmer in Ihrer Wohnung neu anstreichen lassen.','b'],['Sie studieren und suchen ein günstiges Zimmer.','g'],['Sie verstehen Ihre Nebenkostenabrechnung nicht.','f'],['Sie brauchen Hilfe beim Wohnungswechsel.','c']],
    form:{instructions:'Ihre Freundin Marta Nowak sucht eine neue Wohnung. Sie wurde am 3. Februar 1988 geboren, arbeitet als Köchin, wohnt aktuell in der Parkstraße 21 in Essen und möchte eine Zwei-Zimmer-Wohnung.',fields:[['Familienname','Nowak'],['Vorname','Marta'],['Geburtsdatum','03.02.1988'],['Beruf','Köchin'],['Zimmerzahl','2']]},
    write:{instructions:'In Ihrer Wohnung funktioniert die Heizung nicht. Schreiben Sie an die Hausverwaltung. Wählen Sie drei der vier Punkte und schreiben Sie etwa 40 Wörter.',points:['Problem beschreiben','seit wann','um Reparatur bitten','möglicher Termin'],sample:'Sehr geehrte Damen und Herren, seit gestern funktioniert die Heizung in meiner Wohnung nicht. Es ist besonders nachts sehr kalt. Bitte schicken Sie möglichst schnell einen Techniker. Am Donnerstag bin ich ab 14 Uhr zu Hause. Bitte bestätigen Sie mir den Termin kurz per E-Mail. Vielen Dank. Mit freundlichen Grüßen, Marta Nowak'},
    speak:{topic:'Eine Wohnung gemeinsam einrichten',cards:['Welches Zimmer zuerst?','Welche Möbel brauchen wir?','Wo kaufen wir ein?','Wie viel darf es kosten?']}
  },
  {
    title:'Modelltest 3 – Arbeit und Lernen',
    h1:[
      ['Guten Morgen Herr Lee, Ihr Vorstellungsgespräch ist am Montag um neun Uhr dreißig im Büro von Frau Stein, Zimmer vierzehn.','Wann ist das Gespräch?',['Montag 9:30 Uhr','Montag 14:00 Uhr','Dienstag 9:30 Uhr'],0],
      ['Hallo Jana, ich übernehme morgen deine Frühschicht. Kannst du dafür am Freitag von vierzehn bis zwanzig Uhr arbeiten?','Wann soll Jana arbeiten?',['morgen früh','Freitag 14–20 Uhr','Freitag 8–14 Uhr'],1],
      ['Hier ist die Volkshochschule. Der Excelkurs findet ab nächster Woche nicht in Raum drei, sondern im Computerraum sieben statt.','Wo findet der Kurs statt?',['Raum 3','Raum 7','Raum 17'],1],
      ['Guten Tag, Ihre Bewerbung ist angekommen. Bitte senden Sie uns noch bis Donnerstag eine Kopie Ihres Abschlusszeugnisses.','Was fehlt noch?',['ein Foto','der Lebenslauf','eine Zeugniskopie'],2],
      ['Hallo Mehmet, die Teamsitzung beginnt heute eine halbe Stunde später, also erst um elf Uhr.','Wann beginnt die Sitzung?',['10:00 Uhr','10:30 Uhr','11:00 Uhr'],2]
    ],
    h2:[
      ['Die Bibliothek bietet ab Oktober längere Öffnungszeiten. Unter der Woche können Studierende bis zweiundzwanzig Uhr lernen.','Was ändert sich?',['Die Bibliothek öffnet später.','Sie schließt später.','Sie bleibt sonntags geschlossen.'],1],
      ['Heute fällt der Kurs Deutsch im Beruf wegen Krankheit aus. Der nächste Unterricht ist regulär am Donnerstag.','Wann ist der nächste Unterricht?',['heute','am Mittwoch','am Donnerstag'],2],
      ['Bei der Ausbildungsmesse am Samstag stellen dreißig Betriebe ihre Berufe vor. Der Eintritt ist frei.','Was kostet der Eintritt?',['nichts','fünf Euro','dreißig Euro'],0],
      ['Unsere Radioserie erklärt diese Woche, wie man Konflikte am Arbeitsplatz ruhig und fair löst.','Worum geht es?',['neue Arbeitsverträge','Konflikte bei der Arbeit','Arbeit im Ausland'],1],
      ['Das Jobcenter ist heute wegen einer Fortbildung nur telefonisch erreichbar. Persönliche Termine finden nicht statt.','Wie erreicht man das Jobcenter heute?',['persönlich','nur telefonisch','gar nicht'],1]
    ],
    h3:[
      ['Chef: Für die Präsentation brauchen wir Hilfe. Lina, bereitest du die Folien vor? Lina: Ja, bis Mittwoch sind sie fertig.','Was macht Lina?',['Folien vorbereiten','Raum reservieren','Kunden anrufen'],0],
      ['Chef: Ben, reservierst du bitte den großen Besprechungsraum? Ben: Ich kümmere mich sofort darum.','Was macht Ben?',['Kaffee bestellen','Raum reservieren','Folien drucken'],1],
      ['Chef: Aylin, kannst du die Kundinnen und Kunden einladen? Aylin: Ja, ich schicke heute die E-Mails.','Was macht Aylin?',['Einladungen senden','Technik prüfen','Protokoll schreiben'],0],
      ['Chef: Noah, prüfst du Beamer und Mikrofon? Noah: Natürlich, morgen früh.','Was macht Noah?',['Raum reservieren','Technik prüfen','Gäste empfangen'],1],
      ['Chef: Mia, schreibst du während des Treffens das Protokoll? Mia: Ja, danach verteile ich es an alle.','Was macht Mia?',['Protokoll schreiben','Folien vorbereiten','Kunden anrufen'],0]
    ],
    l1:{text:'BILDUNGSZENTRUM – Büro 01: Anmeldung und Bezahlung. Raum 12: Sprachkurse. Raum 18: Bewerbungstraining. Computerraum 21: EDV-Kurse. Lernberatung: Mittwoch 14–18 Uhr in Büro 05.',items:[
      ['Sie möchten Ihren Kurs bezahlen.',['Büro 01','Raum 18','Büro 05'],0],['Sie brauchen Hilfe mit einer Bewerbung.',['Raum 12','Raum 18','Raum 21'],1],['Sie lernen den Umgang mit Tabellenprogrammen.',['Raum 12','Raum 18','Raum 21'],2],['Sie möchten sich zum Lernen beraten lassen.',['Büro 01','Büro 05','Raum 12'],1],['Sie besuchen einen Deutschkurs.',['Raum 12','Raum 18','Raum 21'],0]
    ]},
    l2:{text:'Die Firma Nordlicht testet seit sechs Monaten einen flexiblen Arbeitstag. Beschäftigte können zwischen sieben und zehn Uhr beginnen. Die tägliche Arbeitszeit bleibt gleich. Viele Mitarbeitende fahren nun außerhalb der Hauptverkehrszeit und sind zufriedener. Besprechungen finden jedoch weiterhin zwischen zehn und fünfzehn Uhr statt, damit alle teilnehmen können.',items:[
      ['Das Modell läuft seit einem halben Jahr.',true],['Alle müssen um sieben Uhr beginnen.',false],['Die Arbeitszeit pro Tag wurde kürzer.',false],['Viele vermeiden den Berufsverkehr.',true],['Besprechungen können jederzeit stattfinden.',false]
    ]},
    ads:[['a','Onlinekurs: Sicher präsentieren vor Gruppen.'],['b','Deutsch für Pflegeberufe, Niveau A2/B1.'],['c','Nebenjob im Café, samstags und sonntags.'],['d','Bewerbungsfotos professionell und günstig.'],['e','Mathematik-Nachhilfe für Ausbildung und Schule.'],['f','Laptop-Reparatur innerhalb von 24 Stunden.'],['g','Ausbildung als Verkäufer/in – Start September.'],['h','Coaching für Vorstellungsgespräche.']],
    situations:[['Sie möchten ein Bewerbungsgespräch üben.','h'],['Sie suchen Wochenendarbeit.','c'],['Sie möchten eine Berufsausbildung im Handel machen.','g'],['Sie arbeiten im Krankenhaus und brauchen Fachdeutsch.','b'],['Ihr Computer ist kaputt und Sie brauchen ihn morgen.','f']],
    form:{instructions:'Ihr Freund Diego Ruiz möchte einen Abendkurs besuchen. Er wurde am 27. November 1997 in Madrid geboren, arbeitet als Elektriker, wohnt in der Hauptstraße 44 in Mainz und interessiert sich für den Excelkurs.',fields:[['Familienname','Ruiz'],['Vorname','Diego'],['Geburtsdatum','27.11.1997'],['Beruf','Elektriker'],['Kurs','Excel']]},
    write:{instructions:'Sie können morgen nicht zur Arbeit kommen. Schreiben Sie Ihrer Chefin. Wählen Sie drei der vier Punkte und schreiben Sie etwa 40 Wörter.',points:['Grund nennen','Dauer der Abwesenheit','wichtige Aufgabe erwähnen','Vertretung vorschlagen'],sample:'Liebe Frau Stein, ich bin leider krank und kann morgen nicht zur Arbeit kommen. Wahrscheinlich bleibe ich zwei Tage zu Hause. Die Kundenliste liegt auf meinem Schreibtisch. Vielleicht kann Ben meinen Termin übernehmen. Ich melde mich morgen noch einmal. Viele Grüße, Diego Ruiz'},
    speak:{topic:'Gemeinsam einen Kurs auswählen',cards:['Was möchten wir lernen?','Wann haben wir Zeit?','Online oder vor Ort?','Wie viel darf der Kurs kosten?']}
  },
  {
    title:'Modelltest 4 – Reisen und Freizeit',
    h1:[
      ['Guten Tag, Ihre Zugverbindung nach Hamburg hat sich geändert. Sie fahren um acht Uhr zwölf von Gleis sechs und steigen in Hannover um.','Von welchem Gleis fährt der Zug?',['Gleis 6','Gleis 8','Gleis 12'],0],
      ['Hallo, hier ist Hotel Seeblick. Ihr Zimmer ist ab fünfzehn Uhr bereit. Das Frühstück wird von sieben bis zehn Uhr angeboten.','Ab wann ist das Zimmer bereit?',['7 Uhr','10 Uhr','15 Uhr'],2],
      ['Hi Emma, die Radtour beginnt nicht am Bahnhof, sondern am Parkplatz beim Schwimmbad. Wir starten um halb zehn.','Wo startet die Radtour?',['am Bahnhof','beim Schwimmbad','am Sportplatz'],1],
      ['Guten Tag, der Rückflug am Sonntag wurde auf neunzehn Uhr fünfundvierzig verschoben. Der Check-in öffnet zwei Stunden vorher.','Wann fliegt das Flugzeug?',['17:45 Uhr','19:15 Uhr','19:45 Uhr'],2],
      ['Hallo Frau Novak, für die Stadtführung am Samstag sind noch zwei Plätze frei. Treffpunkt ist um elf Uhr vor dem alten Rathaus.','Was ist noch verfügbar?',['zwei Plätze','elf Plätze','keine Plätze'],0]
    ],
    h2:[
      ['Wegen starken Windes fahren heute keine Schiffe zur Insel. Bereits gekaufte Tickets gelten auch morgen.','Warum fahren keine Schiffe?',['wegen Regen','wegen Wind','wegen Nebel'],1],
      ['Im Freizeitpark ist heute Familientag. Ab drei Kindern zahlt nur ein Erwachsener Eintritt.','Was ist heute besonders?',['Kinder haben frei.','Familien zahlen weniger.','Der Park schließt früher.'],1],
      ['Das Open-Air-Konzert wird wegen des Wetters in die Stadthalle verlegt. Beginn bleibt um zwanzig Uhr.','Was ändert sich?',['der Ort','die Uhrzeit','die Musikgruppe'],0],
      ['Unser Reisetipp der Woche ist Leipzig: Wir stellen Museen, Parks und günstige Restaurants für ein Wochenende vor.','Welche Stadt wird vorgestellt?',['Leipzig','Dresden','Berlin'],0],
      ['Auf Wanderweg vier ist eine Brücke gesperrt. Bitte folgen Sie ab dem See der gelben Umleitung.','Was sollen Wanderer tun?',['am See warten','der gelben Umleitung folgen','Weg vier weitergehen'],1]
    ],
    h3:[
      ['Nora: Für den Wochenendtrip buche ich die Unterkunft. Erik: Gut, such bitte etwas nahe am Zentrum.','Was macht Nora?',['Unterkunft buchen','Tickets kaufen','Programm planen'],0],
      ['Nora: Erik, kannst du die Zugtickets kaufen? Erik: Ja, heute Abend online.','Was macht Erik?',['Restaurant suchen','Zugtickets kaufen','Koffer packen'],1],
      ['Nora: Mei, erstellst du ein Programm für Samstag? Mei: Gern, ich suche zwei Museen und einen Park aus.','Was macht Mei?',['Programm planen','Unterkunft buchen','Fahrplan prüfen'],0],
      ['Nora: Samir, reservierst du ein Restaurant für Samstagabend? Samir: Ja, am liebsten regional.','Was macht Samir?',['Restaurant reservieren','Tickets kaufen','Wetter prüfen'],0],
      ['Nora: Klara, schaust du nach dem Wetter und schreibst uns, was wir einpacken sollen? Klara: Mache ich.','Was macht Klara?',['Koffer tragen','Wetter prüfen','Fotos machen'],1]
    ],
    l1:{text:'TOURIST-INFORMATION – Schalter 1: Stadtführungen und Museen. Schalter 2: Bus- und Bahntickets. Schalter 3: Hotels und Ferienwohnungen. Fahrradverleih im Hof. Geöffnet täglich 9–18 Uhr, sonntags 10–15 Uhr.',items:[
      ['Sie möchten eine Stadtführung buchen.',['Schalter 1','Schalter 2','Schalter 3'],0],['Sie brauchen eine Fahrkarte.',['Schalter 1','Schalter 2','Schalter 3'],1],['Sie suchen ein Hotelzimmer.',['Schalter 1','Schalter 2','Schalter 3'],2],['Sie möchten ein Fahrrad mieten.',['im Hof','Schalter 2','Schalter 3'],0],['Sie brauchen Informationen über Museen.',['Schalter 1','Schalter 2','im Hof'],0]
    ]},
    l2:{text:'Seit diesem Sommer bietet die Stadt kostenlose Kulturabende im Park an. Jeden Donnerstag gibt es Musik, Theater oder Filme. Besucher bringen Decken und Getränke selbst mit. Bei starkem Regen fällt die Veranstaltung aus; aktuelle Informationen stehen ab vierzehn Uhr auf der Internetseite. Die Veranstaltungen beginnen um neunzehn Uhr und enden spätestens um zweiundzwanzig Uhr.',items:[
      ['Die Kulturabende kosten keinen Eintritt.',true],['Sie finden jeden Freitag statt.',false],['Getränke kann man dort kostenlos bekommen.',false],['Bei starkem Regen gibt es keine Veranstaltung.',true],['Das Programm endet spätestens um 22 Uhr.',true]
    ]},
    ads:[['a','Ferienwohnung am See, vier Personen, Küche und Balkon.'],['b','Günstige Bahntickets für Gruppen ab sechs Personen.'],['c','Wanderverein: leichte Touren jeden Sonntag.'],['d','Sprachreise nach Wien mit Deutschkurs am Vormittag.'],['e','Fotokurs unterwegs – bessere Urlaubsbilder machen.'],['f','Campingplatz im Wald, Hunde willkommen.'],['g','Mitfahrgelegenheit Berlin–Prag am Freitag.'],['h','Kofferreparatur und Reisegepäck-Service.']],
    situations:[['Sie möchten im Urlaub Deutsch lernen.','d'],['Ihre Familie mit vier Personen sucht eine Unterkunft.','a'],['Sie möchten mit Ihrem Hund zelten.','f'],['Sie wollen am Sonntag nicht allein wandern.','c'],['Ihr Reisekoffer ist kaputt.','h']],
    form:{instructions:'Ihre Bekannte Hana Kim möchte eine Reise buchen. Sie wurde am 9. August 1992 in Seoul geboren, wohnt in der Goethestraße 17 in Bonn, reist mit einer Person und möchte vom 12. bis 18. Oktober nach Wien fahren.',fields:[['Familienname','Kim'],['Vorname','Hana'],['Geburtsdatum','09.08.1992'],['Reiseziel','Wien'],['Personenzahl','1']]},
    write:{instructions:'Sie haben in einem Hotel übernachtet und etwas vergessen. Schreiben Sie dem Hotel. Wählen Sie drei der vier Punkte und schreiben Sie etwa 40 Wörter.',points:['Aufenthaltsdatum','Gegenstand beschreiben','Fundort vermuten','um Zusendung bitten'],sample:'Sehr geehrte Damen und Herren, ich war vom 12. bis 14. Oktober in Ihrem Hotel. Leider habe ich eine blaue Jacke vergessen. Sie liegt vielleicht im Schrank von Zimmer 24. Können Sie mir die Jacke bitte zuschicken? Meine Adresse finden Sie in der letzten Buchung. Die Kosten übernehme ich. Mit freundlichen Grüßen, Hana Kim'},
    speak:{topic:'Einen Wochenendausflug planen',cards:['Wohin fahren wir?','Wie reisen wir?','Was machen wir dort?','Was müssen wir mitnehmen?']}
  },
  {
    title:'Modelltest 5 – Gesundheit und Familie',
    h1:[
      ['Guten Tag Frau Silva, Ihre Blutwerte sind da. Bitte kommen Sie am Dienstag um acht Uhr nüchtern in die Praxis. Sie dürfen vorher nur Wasser trinken.','Was darf Frau Silva vorher trinken?',['Kaffee','Tee','Wasser'],2],
      ['Hallo Papa, der Elternabend beginnt heute schon um achtzehn Uhr im Musikraum. Bitte bring auch den unterschriebenen Zettel mit.','Was soll der Vater mitbringen?',['einen Zettel','ein Instrument','Getränke'],0],
      ['Hier ist die Apotheke am Markt. Ihr Medikament ist heute Nachmittag ab sechzehn Uhr verfügbar. Wir haben bis neunzehn Uhr geöffnet.','Ab wann ist das Medikament da?',['16 Uhr','17 Uhr','19 Uhr'],0],
      ['Hallo Elena, ich kann die Kinder am Donnerstag von der Schule abholen. Am Freitag musst du es bitte selbst machen.','Wann kann die Person helfen?',['am Mittwoch','am Donnerstag','am Freitag'],1],
      ['Guten Tag, Ihr Termin zur Zahnreinigung dauert ungefähr fünfundvierzig Minuten. Bitte kommen Sie zehn Minuten früher.','Wie lange dauert die Behandlung?',['10 Minuten','35 Minuten','45 Minuten'],2]
    ],
    h2:[
      ['Die Krankenkasse bietet am Samstag einen kostenlosen Kurs zum gesunden Schlaf an. Eine Anmeldung ist online erforderlich.','Was muss man tun?',['online anmelden','eine Gebühr zahlen','Schlafkleidung mitbringen'],0],
      ['Wegen vieler Grippefälle gelten im Krankenhaus neue Besuchszeiten: täglich nur von fünfzehn bis siebzehn Uhr.','Wann darf man besuchen?',['vormittags','15–17 Uhr','nach 18 Uhr'],1],
      ['In unserer Gesundheitssendung erklärt eine Ärztin heute, wie regelmäßige Bewegung Rückenschmerzen verhindern kann.','Worum geht es?',['gesunde Ernährung','Bewegung gegen Rückenschmerzen','Medikamente'],1],
      ['Das Familienbad bleibt am Montag wegen Reinigung geschlossen. Der Schwimmkurs beginnt deshalb erst am Mittwoch.','Wann beginnt der Schwimmkurs?',['Montag','Dienstag','Mittwoch'],2],
      ['Bitte beachten Sie: Für die Kinderbetreuung in den Ferien sind nur noch Plätze in der zweiten Augustwoche frei.','Wann gibt es noch Plätze?',['erste Juliwoche','erste Augustwoche','zweite Augustwoche'],2]
    ],
    h3:[
      ['Mutter: Für Omas Geburtstag backe ich den Kuchen. Luis: Gut, ich kaufe die Zutaten.','Was macht die Mutter?',['Kuchen backen','Zutaten kaufen','Gäste anrufen'],0],
      ['Mutter: Luis, kaufst du bitte Mehl, Eier und Obst? Luis: Ja, nach der Schule.','Was macht Luis?',['Tisch dekorieren','Zutaten kaufen','Fotos sammeln'],1],
      ['Mutter: Zoe, kannst du die Verwandten anrufen? Zoe: Natürlich, ich frage auch, wer kommen kann.','Was macht Zoe?',['Gäste anrufen','Kuchen backen','Musik auswählen'],0],
      ['Mutter: David, dekorierst du den Tisch? David: Ja, ich bringe Blumen und Kerzen mit.','Was macht David?',['Geschenk holen','Tisch dekorieren','Essen kochen'],1],
      ['Mutter: Amina, stellst du eine Liste mit Omas Lieblingsliedern zusammen? Amina: Sehr gern.','Was macht Amina?',['Musik auswählen','Gäste abholen','Fotos machen'],0]
    ],
    l1:{text:'GESUNDHEITSZENTRUM – Erdgeschoss: Anmeldung, Apotheke, Labor. 1. Stock: Hausarzt, Kinderarzt, Zimmer 101–110. 2. Stock: Zahnarzt, Physiotherapie, Ernährungsberatung. Notdienst: Eingang an der Rückseite, täglich bis 22 Uhr.',items:[
      ['Sie müssen Blut abgeben.',['Erdgeschoss','1. Stock','2. Stock'],0],['Ihr Kind ist krank.',['Erdgeschoss','1. Stock','2. Stock'],1],['Sie brauchen Hilfe bei Rückenschmerzen.',['Erdgeschoss','1. Stock','2. Stock'],2],['Sie möchten ein Medikament kaufen.',['Erdgeschoss','1. Stock','2. Stock'],0],['Sie möchten über gesunde Ernährung sprechen.',['Erdgeschoss','1. Stock','2. Stock'],2]
    ]},
    l2:{text:'Die Grundschule Sonnenweg hat vor einem Jahr einen bewegten Schulweg gestartet. Kinder treffen sich morgens an festen Punkten und gehen gemeinsam mit Erwachsenen zur Schule. So bewegen sie sich mehr und es gibt weniger Autos vor dem Gebäude. Eltern können sich für einzelne Wochentage als Begleitung anmelden. Bei sehr schlechtem Wetter fällt der gemeinsame Weg aus.',items:[
      ['Das Projekt begann vor einem Jahr.',true],['Die Kinder fahren gemeinsam mit dem Bus.',false],['Vor der Schule gibt es jetzt weniger Autos.',true],['Eltern müssen jeden Tag helfen.',false],['Bei sehr schlechtem Wetter findet das Projekt nicht statt.',true]
    ]},
    ads:[['a','Babysitterin mit Erfahrung, abends und am Wochenende.'],['b','Rückenkurs für Anfänger, Krankenkasse zahlt.'],['c','Familienberatung kostenlos und vertraulich.'],['d','Kinderfahrrad, guter Zustand, günstig zu verkaufen.'],['e','Gesundes Kochen für die ganze Familie.'],['f','Pflegedienst unterstützt ältere Menschen zu Hause.'],['g','Zahnarztpraxis mit Abendsprechstunde.'],['h','Sportgruppe für Eltern mit kleinen Kindern.']],
    situations:[['Sie brauchen Betreuung für Ihr Kind am Samstagabend.','a'],['Ihre Mutter benötigt täglich Hilfe zu Hause.','f'],['Sie arbeiten lange und suchen einen späten Zahnarzttermin.','g'],['Sie möchten etwas gegen Rückenschmerzen tun.','b'],['Sie haben Probleme in der Familie und möchten darüber sprechen.','c']],
    form:{instructions:'Ihr Bekannter Paulo Costa möchte an einem Gesundheitskurs teilnehmen. Er wurde am 21. Juni 1985 in Porto geboren, wohnt in der Waldstraße 6 in Köln, arbeitet als Fahrer und interessiert sich für den Rückenkurs am Mittwoch.',fields:[['Familienname','Costa'],['Vorname','Paulo'],['Geburtsdatum','21.06.1985'],['Beruf','Fahrer'],['Kurs','Rückenkurs']]},
    write:{instructions:'Ihr Kind ist krank und kann morgen nicht zur Schule kommen. Schreiben Sie der Lehrerin. Wählen Sie drei der vier Punkte und schreiben Sie etwa 40 Wörter.',points:['Grund nennen','voraussichtliche Dauer','nach Aufgaben fragen','um Rückmeldung bitten'],sample:'Liebe Frau Berger, meine Tochter Lina hat Fieber und kann morgen nicht zur Schule kommen. Wahrscheinlich bleibt sie bis Mittwoch zu Hause. Können Sie mir bitte die Hausaufgaben schicken? Geben Sie mir kurz Bescheid, wenn es neue Informationen gibt. Vielen Dank und viele Grüße, Paulo Costa'},
    speak:{topic:'Ein Familienfest organisieren',cards:['Wann feiern wir?','Wo findet das Fest statt?','Was essen und trinken wir?','Wer übernimmt welche Aufgabe?']}
  }
];

function item(id, values, index, fill = false) {
  const [transcript, question, options, answer] = values;
  return { id, transcript, question, ...(fill ? { answer:options[answer] } : { options, answer }), explain: `Richtig: ${options[answer]}.`, audio: `${audioRoot}/mt${index}/${id}.mp3` };
}

function makeTest(source, index) {
  const n = index + 1;
  const id = `mt${n}`;
  const hearingPart = (key, title, plays) => ({ id:key, title, type:key === 'h1' ? 'audio-fill' : 'audio-choice', plays, instructions:key === 'h1' ? 'Sie hören fünf Mitteilungen. Ergänzen Sie die Information. Sie hören jeden Text zweimal.' : key === 'h2' ? 'Sie hören fünf Informationen aus dem Radio. Kreuzen Sie an: a, b oder c. Sie hören jeden Text einmal.' : 'Sie hören Gespräche zu einer gemeinsamen Planung. Ordnen Sie die Aufgaben zu. Sie hören jeden Text zweimal.', items:source[key].map((entry, i) => item(`a2m${n}-${key}-${i + 1}`, entry, n, key === 'h1')) });
  const readTextId = `a2m${n}-l1-text`;
  const articleId = `a2m${n}-l2-text`;
  const labels = source.ads.map(([label]) => label).concat('x');
  return {
    id,
    title: source.title,
    visualPanel: n,
    topic: source.speak.topic,
    sections: [
      { id:'hoeren', title:'Hören', durationMin:20, maxPoints:15, instructions:'Sie hören 15 Aufgaben in drei Teilen.', parts:[hearingPart('h1','Teil 1 – Telefonnotizen',2),hearingPart('h2','Teil 2 – Informationen im Radio',1),hearingPart('h3','Teil 3 – Gespräch zuordnen',2)] },
      { id:'lesen', title:'Lesen', durationMin:30, maxPoints:15, instructions:'Lesen Sie Informationen, einen längeren Text und Anzeigen.', parts:[
        { id:'l1', title:'Teil 1 – Informationen finden', type:'read-choice', instructions:'Lesen Sie die Aufgaben und die Information. Kreuzen Sie an: a, b oder c.', texts:[{id:readTextId,label:'Information',body:source.l1.text}], items:source.l1.items.map((entry,i)=>({id:`a2m${n}-l1-${i+1}`,textRef:readTextId,question:entry[0],options:entry[1],answer:entry[2],explain:`Richtig: ${entry[1][entry[2]]}.`})) },
        { id:'l2', title:'Teil 2 – Text verstehen', type:'read-truefalse', instructions:'Lesen Sie den Text. Sind die Aussagen richtig oder falsch?', texts:[{id:articleId,label:'Artikel',body:source.l2.text}], items:source.l2.items.map((entry,i)=>({id:`a2m${n}-l2-${i+1}`,textRef:articleId,statement:entry[0],answer:entry[1],explain:entry[1]?'Die Aussage steht so im Text.':'Die Aussage widerspricht dem Text.'})) },
        { id:'l3', title:'Teil 3 – Anzeigen zuordnen', type:'read-match', instructions:'Welche Anzeige passt? Für eine Aufgabe kann auch x richtig sein.', ads:source.ads.map(([label,body])=>({id:label,label,body})), items:source.situations.map((entry,i)=>({id:`a2m${n}-l3-${i+1}`,situation:entry[0],options:labels,answer:labels.indexOf(entry[1]),explain:entry[1]==='x'?'Keine Anzeige passt.':`Anzeige ${entry[1]} passt.`})) }
      ]},
      { id:'schreiben', title:'Schreiben', durationMin:20, maxPoints:15, aiGraded:true, instructions:'Bearbeiten Sie beide Aufgaben.', parts:[
        { id:'s1', title:'Teil 1 – Formular', type:'form-fill', instructions:source.form.instructions, fields:source.form.fields.map((entry,i)=>({id:`a2m${n}-f-${i+1}`,label:entry[0],expected:entry[1]})) },
        { id:'s2', title:'Teil 2 – Brief oder E-Mail', type:'free-write', instructions:source.write.instructions, minWords:40, leitpunkte:source.write.points, sample:source.write.sample, rubric:{level:'A2',maxPoints:10,criteria:['Drei Inhaltspunkte verständlich bearbeitet','Passende Anrede und Schluss','Zusammenhängender Text','Etwa 40 Wörter']} }
      ]},
      { id:'sprechen', title:'Sprechen', durationMin:15, maxPoints:15, aiGraded:true, instructions:'Sprechen Sie mit der Prüferin und Ihrer virtuellen Prüfungspartnerin. Es gibt keine Vorbereitungszeit.', parts:[
        { id:'sp1', title:'Teil 1 – Sich vorstellen', type:'speak-intro', instructions:'Stellen Sie sich vor und beantworten Sie eine Nachfrage.', prompts:['Name','Herkunft und Wohnort','Familie','Beruf oder Ausbildung','Sprachen','Freizeit'], rubric:{level:'A2',maxPoints:3,criteria:['Zusammenhängende Vorstellung','Verständliche Aussprache','Passende Antwort auf Nachfrage']} },
        { id:'sp2', title:'Teil 2 – Ein Alltagsgespräch führen', type:'speak-cards', instructions:`Thema „${source.speak.topic}“. Stellen Sie Fragen und reagieren Sie auf Ihre Partnerin.`, cards:source.speak.cards.map((keyword,i)=>({id:`sp2-${i+1}`,keyword,example:keyword})), rubric:{level:'A2',maxPoints:6,criteria:['Passende Fragen','Angemessene Antworten','Verständlichkeit','Interaktion']} },
        { id:'sp3', title:'Teil 3 – Etwas aushandeln', type:'speak-cards', instructions:`Planen Sie gemeinsam: ${source.speak.topic}. Machen Sie Vorschläge, reagieren Sie und einigen Sie sich.`, cards:source.speak.cards.map((keyword,i)=>({id:`sp3-${i+1}`,keyword,example:`Mein Vorschlag zu „${keyword.replace(/\?$/, '')}“: Wir entscheiden gemeinsam. Was meinen Sie?`})), rubric:{level:'A2',maxPoints:6,criteria:['Vorschläge machen','Zustimmen oder widersprechen','Begründung geben','Gemeinsame Entscheidung']} }
      ]}
    ]
  };
}

const bank = {
  exam:'telc-deutsch-a2', level:'A2',
  note:'Originalinhalte im Format Start Deutsch 2 / telc Deutsch A2. Kein offizielles telc-Prüfungsmaterial.',
  quality:{version:2,reviewed:'2026-08-14',audioScripts:75,visualPanels:5},
  passMark:60, weights:{hoeren:25,lesen:25,schreiben:25,sprechen:25},
  tests:tests.map(makeTest)
};

const bankPath = path.join(root, 'web', 'content', 'telc-a2-exam-bank.json');
fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');

const scripts = ['DUVELA EXAM · TELC DEUTSCH A2 · ELEVENLABS AUDIO SCRIPTS', 'Format: relative MP3 path | German transcript', ''];
for (const test of bank.tests) for (const part of test.sections[0].parts) for (const task of part.items) scripts.push(`${task.audio.replace('./web/audio/exam-a2/','')} | ${task.transcript}`);
const scriptDir = path.join(root, 'web', 'audio', 'exam-a2');
fs.mkdirSync(scriptDir, { recursive:true });
fs.writeFileSync(path.join(scriptDir, 'elevenlabs-scripts.txt'), `${scripts.join('\n')}\n`, 'utf8');
console.log(`[a2] Generated ${bank.tests.length} tests and ${scripts.length - 3} audio scripts.`);
