(function attachDuviAssistant(global) {
  'use strict';

  const ASSET_ROOT = '/web/assets/duvi/';
  const WELCOME_KEY = 'duvela.duvi.welcome.v1';
  const VOICE_KEY = 'duvela.duvi.voice.v1';
  const RTL = new Set(['ar', 'fa']);

  // ── AI backend (Supabase edge function duvi-chat) ──────────────────────────
  const cfg = () => (typeof window !== 'undefined' && window.DuvelaWebConfig) || null;
  function chatEndpoint() {
    const url = cfg()?.supabaseUrl || 'https://ohtkryanqcnwghcnipsr.supabase.co';
    return url.replace(/\/+$/, '') + '/functions/v1/duvi-chat';
  }
  function anonKey() {
    return cfg()?.supabaseAnonKey || '';
  }
  async function accessToken() {
    try {
      const client = cfg()?.createSupabaseClient?.();
      const { data } = await client.auth.getSession();
      return data?.session?.access_token || null;
    } catch { return null; }
  }

  // BCP-47 tags for Web Speech (STT/TTS), keyed by our locale bases.
  const SPEECH_LANG = {
    en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT',
    nl: 'nl-NL', sv: 'sv-SE', no: 'nb-NO', pl: 'pl-PL', cs: 'cs-CZ', sq: 'sq-AL',
    tr: 'tr-TR', ru: 'ru-RU', uk: 'uk-UA', kk: 'kk-KZ', az: 'az-AZ', uz: 'uz-UZ',
    tg: 'tg-TJ', fa: 'fa-IR', ar: 'ar-SA', vi: 'vi-VN', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR'
  };

  // Chat-UI strings. Falls back to English for locales not listed here; the AI
  // itself always answers in the user's language regardless.
  const UI = {
    en: { placeholder: 'Ask DUVI…', send: 'Send', listen: 'Speak', stop: 'Stop', thinking: 'DUVI is thinking…', voiceOn: 'Voice on', voiceOff: 'Voice off', chatError: "I couldn't reach the assistant. Check your connection and try again.", micDenied: 'Microphone access is blocked. Allow it in browser settings.', you: 'You' },
    ru: { placeholder: 'Спросите DUVI…', send: 'Отправить', listen: 'Голос', stop: 'Стоп', thinking: 'DUVI думает…', voiceOn: 'Озвучка вкл', voiceOff: 'Озвучка выкл', chatError: 'Не удалось связаться с ассистентом. Проверьте интернет и попробуйте снова.', micDenied: 'Доступ к микрофону запрещён. Разрешите его в настройках браузера.', you: 'Вы' },
    de: { placeholder: 'Frag DUVI…', send: 'Senden', listen: 'Sprechen', stop: 'Stopp', thinking: 'DUVI denkt nach…', voiceOn: 'Stimme an', voiceOff: 'Stimme aus', chatError: 'Der Assistent ist nicht erreichbar. Prüfe die Verbindung und versuche es erneut.', micDenied: 'Mikrofonzugriff ist blockiert. Erlaube ihn in den Browsereinstellungen.', you: 'Du' },
    es: { placeholder: 'Pregunta a DUVI…', send: 'Enviar', listen: 'Hablar', stop: 'Detener', thinking: 'DUVI está pensando…', voiceOn: 'Voz activada', voiceOff: 'Voz desactivada', chatError: 'No pude contactar con el asistente. Revisa tu conexión e inténtalo de nuevo.', micDenied: 'El acceso al micrófono está bloqueado. Permítelo en el navegador.', you: 'Tú' },
    fr: { placeholder: 'Demandez à DUVI…', send: 'Envoyer', listen: 'Parler', stop: 'Arrêter', thinking: 'DUVI réfléchit…', voiceOn: 'Voix activée', voiceOff: 'Voix désactivée', chatError: "Impossible de joindre l'assistant. Vérifiez la connexion et réessayez.", micDenied: "L'accès au micro est bloqué. Autorisez-le dans le navigateur.", you: 'Vous' },
    uk: { placeholder: 'Запитайте DUVI…', send: 'Надіслати', listen: 'Голос', stop: 'Стоп', thinking: 'DUVI думає…', voiceOn: 'Озвучення увімк', voiceOff: 'Озвучення вимк', chatError: 'Не вдалося зв’язатися з асистентом. Перевірте інтернет і спробуйте знову.', micDenied: 'Доступ до мікрофона заблоковано. Дозвольте його в налаштуваннях браузера.', you: 'Ви' },
    tr: { placeholder: "DUVI'ye sor…", send: 'Gönder', listen: 'Konuş', stop: 'Durdur', thinking: 'DUVI düşünüyor…', voiceOn: 'Ses açık', voiceOff: 'Ses kapalı', chatError: 'Asistana ulaşılamadı. Bağlantını kontrol edip tekrar dene.', micDenied: 'Mikrofon erişimi engelli. Tarayıcı ayarlarından izin ver.', you: 'Sen' },
    ar: { placeholder: 'اسأل DUVI…', send: 'إرسال', listen: 'تحدث', stop: 'إيقاف', thinking: 'DUVI يفكر…', voiceOn: 'الصوت مفعّل', voiceOff: 'الصوت متوقف', chatError: 'تعذّر الوصول إلى المساعد. تحقق من الاتصال وحاول مجدداً.', micDenied: 'الوصول إلى الميكروفون محظور. اسمح به من إعدادات المتصفح.', you: 'أنت' },
    zh: { placeholder: '问问 DUVI…', send: '发送', listen: '说话', stop: '停止', thinking: 'DUVI 正在思考…', voiceOn: '语音开', voiceOff: '语音关', chatError: '无法连接助手。请检查网络后重试。', micDenied: '麦克风访问被阻止。请在浏览器设置中允许。', you: '你' }
  };
  function ui(key) {
    const loc = currentLocale();
    return UI[loc]?.[key] || UI.en[key] || key;
  }
  const COPY = {
    en: { hello: "Hello! I'm DUVI. I'll help you find your way, understand errors and prepare for lessons.", question: 'What do you need help with?', start: 'Getting started', classroom: 'Classroom', problem: 'Fix a problem', startText: 'Start with your profile, choose the languages you learn, then open Home to see suitable lessons and people.', classroomText: 'Before joining, check the camera and microphone. During class, use Raise hand when you want to speak.', problemText: 'Check your internet and browser permissions first. When DUVI notices a specific problem, you will see the next action here.', offline: 'The internet connection was lost. Keep this page open; Duvela will reconnect when the network returns.', locationError: 'Location is optional. Allow it in browser settings, or enter your city manually and continue.', micError: 'The microphone could not start. Allow microphone access in device settings, then try again.', handRaised: '{name} raised a hand. Open Participants to give them the floor.', teacherFloor: 'The teacher gave you the floor. Turn on your microphone when you are ready.', gotIt: 'Got it', close: 'Close DUVI' },
    de: { hello: 'Hallo! Ich bin DUVI. Ich helfe dir bei der Orientierung, bei Fehlern und bei der Vorbereitung auf den Unterricht.', question: 'Wobei brauchst du Hilfe?', start: 'Erste Schritte', classroom: 'Klassenraum', problem: 'Problem lösen', startText: 'Vervollständige zuerst dein Profil, wähle deine Lernsprachen und öffne dann Start für passende Lektionen und Kontakte.', classroomText: 'Prüfe vor dem Beitritt Kamera und Mikrofon. Nutze im Unterricht Hand heben, wenn du sprechen möchtest.', problemText: 'Prüfe zuerst Internet und Browserberechtigungen. Bei einem konkreten Problem zeigt DUVI hier den nächsten Schritt.', offline: 'Die Internetverbindung wurde unterbrochen. Lass die Seite geöffnet; Duvela verbindet sich automatisch neu.', locationError: 'Der Standort ist optional. Erlaube ihn in den Browsereinstellungen oder gib deine Stadt manuell ein.', micError: 'Das Mikrofon konnte nicht gestartet werden. Erlaube den Zugriff in den Geräteeinstellungen und versuche es erneut.', handRaised: '{name} hat die Hand gehoben. Öffne Teilnehmer, um das Wort zu erteilen.', teacherFloor: 'Die Lehrkraft hat dir das Wort erteilt. Schalte dein Mikrofon ein, wenn du bereit bist.', gotIt: 'Verstanden', close: 'DUVI schließen' },
    es: { hello: '¡Hola! Soy DUVI. Te ayudaré a orientarte, entender errores y prepararte para las clases.', question: '¿Con qué necesitas ayuda?', start: 'Primeros pasos', classroom: 'Aula', problem: 'Resolver problema', startText: 'Completa tu perfil, elige los idiomas que estudias y abre Inicio para ver clases y personas adecuadas.', classroomText: 'Antes de entrar, revisa la cámara y el micrófono. Usa Levantar la mano cuando quieras hablar.', problemText: 'Comprueba primero Internet y los permisos del navegador. DUVI mostrará aquí el siguiente paso para cada problema.', offline: 'Se perdió la conexión. Mantén la página abierta; Duvela se reconectará cuando vuelva Internet.', locationError: 'La ubicación es opcional. Permítela en el navegador o escribe tu ciudad manualmente.', micError: 'No se pudo iniciar el micrófono. Permite el acceso en los ajustes del dispositivo e inténtalo de nuevo.', handRaised: '{name} levantó la mano. Abre Participantes para darle la palabra.', teacherFloor: 'El profesor te dio la palabra. Activa el micrófono cuando estés listo.', gotIt: 'Entendido', close: 'Cerrar DUVI' },
    fr: { hello: "Bonjour ! Je suis DUVI. Je vous aide à vous orienter, comprendre les erreurs et préparer vos cours.", question: "De quoi avez-vous besoin ?", start: 'Bien démarrer', classroom: 'Classe', problem: 'Résoudre un problème', startText: "Complétez votre profil, choisissez les langues étudiées, puis ouvrez l'accueil pour voir les cours adaptés.", classroomText: "Avant d'entrer, vérifiez la caméra et le micro. Utilisez Lever la main lorsque vous voulez parler.", problemText: "Vérifiez d'abord Internet et les autorisations du navigateur. DUVI affichera ici l'étape suivante.", offline: 'Connexion Internet perdue. Gardez cette page ouverte ; Duvela se reconnectera automatiquement.', locationError: "La localisation est facultative. Autorisez-la dans le navigateur ou saisissez votre ville manuellement.", micError: "Le micro n'a pas pu démarrer. Autorisez son accès dans les réglages, puis réessayez.", handRaised: '{name} a levé la main. Ouvrez Participants pour lui donner la parole.', teacherFloor: 'Le professeur vous donne la parole. Activez votre micro lorsque vous êtes prêt.', gotIt: "D'accord", close: 'Fermer DUVI' },
    it: { hello: 'Ciao! Sono DUVI. Ti aiuto a orientarti, capire gli errori e prepararti alle lezioni.', question: 'Di cosa hai bisogno?', start: 'Primi passi', classroom: 'Aula', problem: 'Risolvi un problema', startText: 'Completa il profilo, scegli le lingue che studi e apri Home per vedere lezioni e persone adatte.', classroomText: 'Prima di entrare controlla videocamera e microfono. Usa Alza la mano quando vuoi parlare.', problemText: 'Controlla prima Internet e i permessi del browser. DUVI mostrerà qui il passaggio successivo.', offline: 'Connessione Internet persa. Lascia aperta la pagina; Duvela si riconnetterà automaticamente.', locationError: 'La posizione è facoltativa. Consentila nel browser oppure inserisci manualmente la città.', micError: "Impossibile avviare il microfono. Consenti l'accesso nelle impostazioni e riprova.", handRaised: '{name} ha alzato la mano. Apri Partecipanti per dargli la parola.', teacherFloor: "L'insegnante ti ha dato la parola. Attiva il microfono quando sei pronto.", gotIt: 'Capito', close: 'Chiudi DUVI' },
    pt: { hello: 'Olá! Sou o DUVI. Vou ajudar na navegação, nos erros e na preparação para as aulas.', question: 'Em que precisa de ajuda?', start: 'Primeiros passos', classroom: 'Sala de aula', problem: 'Resolver problema', startText: 'Complete o perfil, escolha os idiomas que estuda e abra Início para ver aulas e pessoas adequadas.', classroomText: 'Antes de entrar, verifique a câmara e o microfone. Use Levantar a mão quando quiser falar.', problemText: 'Verifique primeiro a Internet e as permissões do navegador. O DUVI mostrará aqui o próximo passo.', offline: 'A ligação à Internet foi perdida. Mantenha a página aberta; o Duvela voltará a ligar automaticamente.', locationError: 'A localização é opcional. Autorize-a no navegador ou introduza a cidade manualmente.', micError: 'Não foi possível iniciar o microfone. Autorize o acesso nas definições e tente novamente.', handRaised: '{name} levantou a mão. Abra Participantes para lhe dar a palavra.', teacherFloor: 'O professor deu-lhe a palavra. Ligue o microfone quando estiver pronto.', gotIt: 'Entendi', close: 'Fechar DUVI' },
    nl: { hello: 'Hallo! Ik ben DUVI. Ik help je met navigatie, fouten en de voorbereiding op lessen.', question: 'Waarmee kan ik helpen?', start: 'Aan de slag', classroom: 'Klaslokaal', problem: 'Probleem oplossen', startText: 'Vul je profiel in, kies de talen die je leert en open Home voor passende lessen en mensen.', classroomText: 'Controleer camera en microfoon voordat je deelneemt. Gebruik Hand opsteken als je wilt spreken.', problemText: 'Controleer eerst internet en browserrechten. DUVI toont hier de volgende stap bij een specifiek probleem.', offline: 'De internetverbinding is verbroken. Laat de pagina open; Duvela maakt automatisch opnieuw verbinding.', locationError: 'Locatie is optioneel. Sta deze toe in de browser of vul je stad handmatig in.', micError: 'De microfoon kon niet starten. Sta toegang toe in de apparaatinstellingen en probeer opnieuw.', handRaised: '{name} heeft een hand opgestoken. Open Deelnemers om het woord te geven.', teacherFloor: 'De docent geeft jou het woord. Zet je microfoon aan wanneer je klaar bent.', gotIt: 'Begrepen', close: 'DUVI sluiten' },
    sv: { hello: 'Hej! Jag är DUVI. Jag hjälper dig att hitta rätt, förstå fel och förbereda lektioner.', question: 'Vad behöver du hjälp med?', start: 'Kom igång', classroom: 'Klassrum', problem: 'Lös ett problem', startText: 'Fyll i din profil, välj språken du lär dig och öppna Hem för lämpliga lektioner och personer.', classroomText: 'Kontrollera kamera och mikrofon innan du går in. Använd Räck upp handen när du vill tala.', problemText: 'Kontrollera först internet och webbläsarbehörigheter. DUVI visar nästa steg här.', offline: 'Internetanslutningen bröts. Låt sidan vara öppen; Duvela återansluter automatiskt.', locationError: 'Plats är valfritt. Tillåt den i webbläsaren eller ange din stad manuellt.', micError: 'Mikrofonen kunde inte starta. Tillåt åtkomst i enhetens inställningar och försök igen.', handRaised: '{name} räckte upp handen. Öppna Deltagare för att ge ordet.', teacherFloor: 'Läraren gav dig ordet. Slå på mikrofonen när du är redo.', gotIt: 'Förstått', close: 'Stäng DUVI' },
    no: { hello: 'Hei! Jeg er DUVI. Jeg hjelper deg med navigasjon, feil og forberedelse til timene.', question: 'Hva trenger du hjelp med?', start: 'Kom i gang', classroom: 'Klasserom', problem: 'Løs et problem', startText: 'Fyll ut profilen, velg språkene du lærer og åpne Hjem for passende timer og personer.', classroomText: 'Sjekk kamera og mikrofon før du går inn. Bruk Rekk opp hånden når du vil snakke.', problemText: 'Sjekk først internett og nettlesertillatelser. DUVI viser neste trinn her.', offline: 'Internettforbindelsen ble brutt. La siden stå åpen; Duvela kobler til igjen automatisk.', locationError: 'Posisjon er valgfritt. Tillat den i nettleseren eller skriv inn byen manuelt.', micError: 'Mikrofonen kunne ikke starte. Tillat tilgang i innstillingene og prøv igjen.', handRaised: '{name} rakte opp hånden. Åpne Deltakere for å gi ordet.', teacherFloor: 'Læreren ga deg ordet. Slå på mikrofonen når du er klar.', gotIt: 'Forstått', close: 'Lukk DUVI' },
    pl: { hello: 'Cześć! Jestem DUVI. Pomogę w nawigacji, błędach i przygotowaniu do lekcji.', question: 'W czym mogę pomóc?', start: 'Pierwsze kroki', classroom: 'Klasa', problem: 'Rozwiąż problem', startText: 'Uzupełnij profil, wybierz języki, których się uczysz, i otwórz stronę główną, aby zobaczyć dopasowane lekcje.', classroomText: 'Przed wejściem sprawdź kamerę i mikrofon. Użyj Podnieś rękę, gdy chcesz zabrać głos.', problemText: 'Najpierw sprawdź Internet i uprawnienia przeglądarki. DUVI pokaże tutaj następny krok.', offline: 'Utracono połączenie z Internetem. Zostaw stronę otwartą; Duvela połączy się ponownie.', locationError: 'Lokalizacja jest opcjonalna. Zezwól na nią w przeglądarce lub wpisz miasto ręcznie.', micError: 'Nie udało się uruchomić mikrofonu. Zezwól na dostęp w ustawieniach i spróbuj ponownie.', handRaised: '{name} podniósł rękę. Otwórz Uczestników, aby udzielić głosu.', teacherFloor: 'Nauczyciel udzielił Ci głosu. Włącz mikrofon, gdy będziesz gotowy.', gotIt: 'Rozumiem', close: 'Zamknij DUVI' },
    cs: { hello: 'Ahoj! Jsem DUVI. Pomohu s orientací, chybami a přípravou na lekce.', question: 'S čím potřebujete pomoci?', start: 'Začínáme', classroom: 'Učebna', problem: 'Vyřešit problém', startText: 'Doplňte profil, vyberte jazyky, které se učíte, a otevřete Domů pro vhodné lekce a lidi.', classroomText: 'Před vstupem zkontrolujte kameru a mikrofon. Chcete-li mluvit, použijte Zvednout ruku.', problemText: 'Nejprve zkontrolujte internet a oprávnění prohlížeče. DUVI zde ukáže další krok.', offline: 'Připojení k internetu bylo přerušeno. Nechte stránku otevřenou; Duvela se znovu připojí.', locationError: 'Poloha je volitelná. Povolte ji v prohlížeči nebo zadejte město ručně.', micError: 'Mikrofon se nepodařilo spustit. Povolte přístup v nastavení zařízení a zkuste to znovu.', handRaised: '{name} zvedl ruku. Otevřete Účastníky a udělte slovo.', teacherFloor: 'Učitel vám udělil slovo. Až budete připraveni, zapněte mikrofon.', gotIt: 'Rozumím', close: 'Zavřít DUVI' },
    sq: { hello: 'Përshëndetje! Jam DUVI. Të ndihmoj me orientimin, gabimet dhe përgatitjen për mësim.', question: 'Me çfarë të ndihmoj?', start: 'Hapat e parë', classroom: 'Klasa', problem: 'Zgjidh problem', startText: 'Plotëso profilin, zgjidh gjuhët që mëson dhe hap Ballinën për mësime e njerëz të përshtatshëm.', classroomText: 'Para hyrjes kontrollo kamerën dhe mikrofonin. Përdor Ngrije dorën kur dëshiron të flasësh.', problemText: 'Kontrollo fillimisht internetin dhe lejet e shfletuesit. DUVI do të tregojë hapin tjetër këtu.', offline: 'Lidhja me internetin u ndërpre. Mbaje faqen hapur; Duvela do të rilidhet automatikisht.', locationError: 'Vendndodhja është opsionale. Lejoje në shfletues ose shkruaj qytetin manualisht.', micError: 'Mikrofoni nuk u nis. Lejo qasjen në cilësimet e pajisjes dhe provo përsëri.', handRaised: '{name} ngriti dorën. Hap Pjesëmarrësit për t’i dhënë fjalën.', teacherFloor: 'Mësuesi të dha fjalën. Ndize mikrofonin kur të jesh gati.', gotIt: 'Në rregull', close: 'Mbyll DUVI' },
    tr: { hello: 'Merhaba! Ben DUVI. Gezinme, hatalar ve ders hazırlığında sana yardımcı olurum.', question: 'Neye ihtiyacın var?', start: 'Başlangıç', classroom: 'Sınıf', problem: 'Sorunu çöz', startText: 'Profilini tamamla, öğrendiğin dilleri seç ve uygun dersleri görmek için Ana Sayfayı aç.', classroomText: 'Girmeden önce kamera ve mikrofonu kontrol et. Konuşmak istediğinde El kaldır düğmesini kullan.', problemText: 'Önce interneti ve tarayıcı izinlerini kontrol et. DUVI sonraki adımı burada gösterecek.', offline: 'İnternet bağlantısı kesildi. Sayfayı açık tut; Duvela bağlantı gelince yeniden bağlanır.', locationError: 'Konum isteğe bağlıdır. Tarayıcıda izin ver veya şehrini elle yaz.', micError: 'Mikrofon başlatılamadı. Cihaz ayarlarından erişime izin verip tekrar dene.', handRaised: '{name} el kaldırdı. Söz vermek için Katılımcıları aç.', teacherFloor: 'Öğretmen sana söz verdi. Hazır olduğunda mikrofonunu aç.', gotIt: 'Anladım', close: 'DUVI’yi kapat' },
    ru: { hello: 'Привет! Я DUVI. Помогу разобраться в приложении, объясню ошибки и подготовлю к уроку.', question: 'С чем помочь?', start: 'Начало работы', classroom: 'Classroom', problem: 'Решить проблему', startText: 'Сначала заполните профиль и выберите изучаемые языки. Затем откройте Главную, чтобы увидеть подходящие уроки и людей.', classroomText: 'Перед входом проверьте камеру и микрофон. На уроке нажмите «Поднять руку», когда хотите говорить.', problemText: 'Сначала проверьте интернет и разрешения браузера. Если DUVI заметит конкретную проблему, следующий шаг появится здесь.', offline: 'Интернет-соединение пропало. Оставьте страницу открытой: Duvela подключится снова, когда сеть вернётся.', locationError: 'Геолокация необязательна. Разрешите её в настройках браузера или введите город вручную.', micError: 'Не удалось включить микрофон. Разрешите доступ в настройках устройства и попробуйте снова.', handRaised: '{name} поднял(а) руку. Откройте «Участники», чтобы дать слово.', teacherFloor: 'Учитель дал вам слово. Включите микрофон, когда будете готовы.', gotIt: 'Понятно', close: 'Закрыть DUVI' },
    uk: { hello: 'Привіт! Я DUVI. Допоможу зорієнтуватися, поясню помилки та підготую до уроку.', question: 'З чим допомогти?', start: 'Початок роботи', classroom: 'Клас', problem: 'Вирішити проблему', startText: 'Заповніть профіль, виберіть мови навчання та відкрийте Головну, щоб побачити відповідні уроки й людей.', classroomText: 'Перед входом перевірте камеру й мікрофон. На уроці натисніть «Підняти руку», коли хочете говорити.', problemText: 'Спочатку перевірте інтернет і дозволи браузера. DUVI покаже тут наступний крок.', offline: 'Інтернет-з’єднання втрачено. Залиште сторінку відкритою; Duvela підключиться знову.', locationError: 'Геолокація необов’язкова. Дозвольте її в браузері або введіть місто вручну.', micError: 'Не вдалося запустити мікрофон. Дозвольте доступ у налаштуваннях і повторіть спробу.', handRaised: '{name} підняв(ла) руку. Відкрийте «Учасники», щоб надати слово.', teacherFloor: 'Учитель надав вам слово. Увімкніть мікрофон, коли будете готові.', gotIt: 'Зрозуміло', close: 'Закрити DUVI' },
    kk: { hello: 'Сәлем! Мен DUVI. Қолданбаны түсінуге, қателерді шешуге және сабаққа дайындалуға көмектесемін.', question: 'Қандай көмек керек?', start: 'Жұмысты бастау', classroom: 'Сынып', problem: 'Мәселені шешу', startText: 'Профильді толтырып, үйренетін тілдерді таңдаңыз. Содан кейін лайықты сабақтарды көру үшін Басты бетті ашыңыз.', classroomText: 'Кіру алдында камера мен микрофонды тексеріңіз. Сөйлегіңіз келсе, Қол көтеру түймесін басыңыз.', problemText: 'Алдымен интернет пен браузер рұқсаттарын тексеріңіз. DUVI келесі қадамды осында көрсетеді.', offline: 'Интернет байланысы үзілді. Бетті ашық қалдырыңыз; желі келгенде Duvela қайта қосылады.', locationError: 'Орналасқан жер міндетті емес. Браузерде рұқсат беріңіз немесе қаланы қолмен енгізіңіз.', micError: 'Микрофон іске қосылмады. Құрылғы баптауларында рұқсат беріп, қайталап көріңіз.', handRaised: '{name} қол көтерді. Сөз беру үшін Қатысушыларды ашыңыз.', teacherFloor: 'Мұғалім сізге сөз берді. Дайын болғанда микрофонды қосыңыз.', gotIt: 'Түсінікті', close: 'DUVI жабу' },
    az: { hello: 'Salam! Mən DUVI. Tətbiqdə istiqamət, xətalar və dərsə hazırlıqda kömək edəcəyəm.', question: 'Nə ilə kömək edim?', start: 'İlk addımlar', classroom: 'Sinif', problem: 'Problemi həll et', startText: 'Profili doldurun, öyrəndiyiniz dilləri seçin və uyğun dərslər üçün Ana səhifəni açın.', classroomText: 'Daxil olmadan əvvəl kamera və mikrofonu yoxlayın. Danışmaq istəyəndə Əl qaldır düyməsini basın.', problemText: 'Əvvəlcə interneti və brauzer icazələrini yoxlayın. DUVI növbəti addımı burada göstərəcək.', offline: 'İnternet bağlantısı kəsildi. Səhifəni açıq saxlayın; Duvela avtomatik yenidən qoşulacaq.', locationError: 'Məkan seçimi məcburi deyil. Brauzerdə icazə verin və ya şəhəri əl ilə yazın.', micError: 'Mikrofon başlatılmadı. Cihaz ayarlarında icazə verib yenidən sınayın.', handRaised: '{name} əl qaldırdı. Söz vermək üçün İştirakçıları açın.', teacherFloor: 'Müəllim sizə söz verdi. Hazır olanda mikrofonu yandırın.', gotIt: 'Aydındır', close: 'DUVI-ni bağla' },
    uz: { hello: 'Salom! Men DUVI. Ilovadan foydalanish, xatolar va darsga tayyorgarlikda yordam beraman.', question: 'Qanday yordam kerak?', start: 'Boshlash', classroom: 'Sinf', problem: 'Muammoni hal qilish', startText: 'Profilni to‘ldiring, o‘rganayotgan tillarni tanlang va mos darslar uchun Bosh sahifani oching.', classroomText: 'Kirishdan oldin kamera va mikrofonni tekshiring. Gapirmoqchi bo‘lsangiz, Qo‘l ko‘tarish tugmasini bosing.', problemText: 'Avval internet va brauzer ruxsatlarini tekshiring. DUVI keyingi qadamni shu yerda ko‘rsatadi.', offline: 'Internet uzildi. Sahifani ochiq qoldiring; tarmoq qaytsa, Duvela qayta ulanadi.', locationError: 'Joylashuv ixtiyoriy. Brauzerda ruxsat bering yoki shaharni qo‘lda kiriting.', micError: 'Mikrofon ishga tushmadi. Qurilma sozlamalarida ruxsat berib, yana urinib ko‘ring.', handRaised: '{name} qo‘l ko‘tardi. So‘z berish uchun Ishtirokchilarni oching.', teacherFloor: 'O‘qituvchi sizga so‘z berdi. Tayyor bo‘lganda mikrofonni yoqing.', gotIt: 'Tushunarli', close: 'DUVI-ni yopish' },
    tg: { hello: 'Салом! Ман DUVI ҳастам. Барои истифодаи барнома, хатогиҳо ва омодагӣ ба дарс кумак мекунам.', question: 'Чӣ гуна кумак лозим?', start: 'Оғози кор', classroom: 'Синф', problem: 'Ҳалли мушкил', startText: 'Профилро пур кунед, забонҳои омӯзиширо интихоб кунед ва барои дарсҳои мувофиқ Саҳифаи асосиро кушоед.', classroomText: 'Пеш аз воридшавӣ камера ва микрофонро санҷед. Барои сухан гуфтан Даст бардоштанро пахш кунед.', problemText: 'Аввал интернет ва иҷозатҳои браузерро санҷед. DUVI қадами навбатиро дар ин ҷо нишон медиҳад.', offline: 'Пайвасти интернет қатъ шуд. Саҳифаро кушода монед; Duvela дубора пайваст мешавад.', locationError: 'Ҷойгиршавӣ ҳатмӣ нест. Дар браузер иҷозат диҳед ё шаҳрро дастӣ ворид кунед.', micError: 'Микрофон фаъол нашуд. Дар танзимоти дастгоҳ иҷозат дода, боз кӯшиш кунед.', handRaised: '{name} даст бардошт. Барои додани сухан Иштирокчиёнро кушоед.', teacherFloor: 'Муаллим ба шумо сухан дод. Вақте омодаед, микрофонро фаъол кунед.', gotIt: 'Фаҳмо', close: 'Пӯшидани DUVI' },
    fa: { hello: 'سلام! من DUVI هستم. در کار با برنامه، خطاها و آمادگی برای کلاس به شما کمک می‌کنم.', question: 'چه کمکی لازم دارید؟', start: 'شروع کار', classroom: 'کلاس', problem: 'حل مشکل', startText: 'نمایه را کامل کنید، زبان‌های موردنظر را انتخاب کنید و برای دیدن درس‌های مناسب به خانه بروید.', classroomText: 'پیش از ورود دوربین و میکروفون را بررسی کنید. برای صحبت کردن گزینه بالا بردن دست را بزنید.', problemText: 'ابتدا اینترنت و مجوزهای مرورگر را بررسی کنید. DUVI مرحله بعد را اینجا نشان می‌دهد.', offline: 'اتصال اینترنت قطع شد. صفحه را باز نگه دارید؛ Duvela دوباره متصل می‌شود.', locationError: 'مکان اختیاری است. در مرورگر اجازه دهید یا شهر را دستی وارد کنید.', micError: 'میکروفون فعال نشد. در تنظیمات دستگاه اجازه دسترسی بدهید و دوباره تلاش کنید.', handRaised: '{name} دست خود را بالا برد. برای دادن نوبت، شرکت‌کنندگان را باز کنید.', teacherFloor: 'معلم نوبت صحبت را به شما داد. وقتی آماده‌اید میکروفون را روشن کنید.', gotIt: 'متوجه شدم', close: 'بستن DUVI' },
    ar: { hello: 'مرحباً! أنا DUVI. سأساعدك في استخدام التطبيق وفهم الأخطاء والاستعداد للدروس.', question: 'كيف يمكنني مساعدتك؟', start: 'البدء', classroom: 'الفصل', problem: 'حل مشكلة', startText: 'أكمل ملفك واختر اللغات التي تتعلمها، ثم افتح الرئيسية لرؤية الدروس المناسبة.', classroomText: 'تحقق من الكاميرا والميكروفون قبل الدخول. استخدم رفع اليد عندما تريد التحدث.', problemText: 'تحقق أولاً من الإنترنت وأذونات المتصفح. سيعرض DUVI الخطوة التالية هنا.', offline: 'انقطع اتصال الإنترنت. اترك الصفحة مفتوحة؛ سيعيد Duvela الاتصال تلقائياً.', locationError: 'الموقع اختياري. اسمح به في المتصفح أو أدخل مدينتك يدوياً.', micError: 'تعذر تشغيل الميكروفون. اسمح بالوصول من إعدادات الجهاز ثم حاول مجدداً.', handRaised: 'رفع {name} يده. افتح المشاركين لإعطائه دور الكلام.', teacherFloor: 'أعطاك المعلم دور الكلام. شغّل الميكروفون عندما تكون مستعداً.', gotIt: 'فهمت', close: 'إغلاق DUVI' },
    vi: { hello: 'Xin chào! Tôi là DUVI. Tôi sẽ giúp bạn sử dụng ứng dụng, hiểu lỗi và chuẩn bị cho lớp học.', question: 'Bạn cần trợ giúp gì?', start: 'Bắt đầu', classroom: 'Lớp học', problem: 'Khắc phục sự cố', startText: 'Hoàn thiện hồ sơ, chọn ngôn ngữ đang học rồi mở Trang chủ để xem các lớp phù hợp.', classroomText: 'Trước khi vào, hãy kiểm tra camera và micrô. Dùng Giơ tay khi bạn muốn nói.', problemText: 'Trước tiên hãy kiểm tra Internet và quyền của trình duyệt. DUVI sẽ hiển thị bước tiếp theo tại đây.', offline: 'Mất kết nối Internet. Hãy giữ trang mở; Duvela sẽ tự kết nối lại.', locationError: 'Vị trí là tùy chọn. Cho phép trong trình duyệt hoặc nhập thành phố thủ công.', micError: 'Không thể bật micrô. Hãy cấp quyền trong cài đặt thiết bị rồi thử lại.', handRaised: '{name} đã giơ tay. Mở Người tham gia để mời phát biểu.', teacherFloor: 'Giáo viên đã mời bạn phát biểu. Bật micrô khi bạn sẵn sàng.', gotIt: 'Đã hiểu', close: 'Đóng DUVI' },
    zh: { hello: '你好！我是 DUVI。我会帮助你使用应用、理解错误并准备课程。', question: '需要什么帮助？', start: '开始使用', classroom: '课堂', problem: '解决问题', startText: '先完善个人资料并选择学习语言，然后打开主页查看合适的课程和用户。', classroomText: '加入前请检查摄像头和麦克风。需要发言时请使用“举手”。', problemText: '请先检查网络和浏览器权限。DUVI 会在这里显示具体问题的下一步操作。', offline: '网络连接已断开。请保持页面打开；网络恢复后 Duvela 会自动重连。', locationError: '位置是可选的。可在浏览器中允许访问，也可以手动输入城市。', micError: '无法启动麦克风。请在设备设置中允许访问，然后重试。', handRaised: '{name} 举手了。请打开“参与者”为其发言。', teacherFloor: '老师请你发言。准备好后请打开麦克风。', gotIt: '知道了', close: '关闭 DUVI' },
    ja: { hello: 'こんにちは！DUVIです。アプリの使い方、エラーの説明、授業の準備をお手伝いします。', question: '何をお手伝いしましょうか？', start: 'はじめに', classroom: '教室', problem: '問題を解決', startText: 'プロフィールを完成し、学ぶ言語を選んでから、ホームで適切なレッスンを確認してください。', classroomText: '参加前にカメラとマイクを確認してください。話したい時は「手を挙げる」を使います。', problemText: 'まずインターネットとブラウザの権限を確認してください。DUVIが次の手順をここに表示します。', offline: 'インターネット接続が切れました。ページを開いたままにすると自動で再接続します。', locationError: '位置情報は任意です。ブラウザで許可するか、市を手動で入力してください。', micError: 'マイクを開始できません。端末の設定でアクセスを許可して再試行してください。', handRaised: '{name}さんが手を挙げました。「参加者」を開いて発言を許可してください。', teacherFloor: '先生があなたを指名しました。準備ができたらマイクをオンにしてください。', gotIt: 'わかりました', close: 'DUVIを閉じる' },
    ko: { hello: '안녕하세요! 저는 DUVI입니다. 앱 사용, 오류 이해, 수업 준비를 도와드릴게요.', question: '무엇을 도와드릴까요?', start: '시작하기', classroom: '교실', problem: '문제 해결', startText: '프로필을 완성하고 학습 언어를 선택한 다음 홈에서 맞춤 수업을 확인하세요.', classroomText: '입장 전에 카메라와 마이크를 확인하세요. 말하고 싶을 때는 손들기를 사용하세요.', problemText: '먼저 인터넷과 브라우저 권한을 확인하세요. DUVI가 다음 단계를 여기에 표시합니다.', offline: '인터넷 연결이 끊겼습니다. 페이지를 열어 두면 Duvela가 자동으로 다시 연결합니다.', locationError: '위치 정보는 선택 사항입니다. 브라우저에서 허용하거나 도시를 직접 입력하세요.', micError: '마이크를 시작할 수 없습니다. 기기 설정에서 접근을 허용하고 다시 시도하세요.', handRaised: '{name}님이 손을 들었습니다. 참가자를 열어 발언 기회를 주세요.', teacherFloor: '선생님이 발언 기회를 주었습니다. 준비되면 마이크를 켜세요.', gotIt: '알겠습니다', close: 'DUVI 닫기' }
  };

  let root = null;
  let panel = null;
  let actions = null;
  let context = 'app';
  let localeProvider = null;
  let attentionTimer = null;
  const actionHandlers = new Map();

  // Chat + voice state
  let thread = null;
  let inputEl = null;
  let sendBtn = null;
  let micBtn = null;
  let voiceBtn = null;
  let form = null;
  const history = [];       // [{ role:'user'|'assistant', content }]
  let streaming = false;
  let recognition = null;
  let listening = false;
  let voiceEnabled = localStorage.getItem(VOICE_KEY) === '1';
  const builtInSelectors = {
    openHome: ['button[data-view="home"]', '[data-go="home"]', 'a[href="#home"]'],
    openManagement: ['button[data-view="management"]', '[data-go="management"]', 'a[href="#management"]'],
    openMessages: ['button[data-view="messages"]', '[data-go="messages"]', 'a[href="#messages"]'],
    openSchedule: ['button[data-view="schedule"]', '[data-go="schedule"]', 'a[href="#schedule"]'],
    openLive: ['button[data-view="live"]', '[data-go="live"]', 'a[href="#live"]'],
    openParticipants: ['#peopleBtn', '[data-panel="people"]'],
    openChat: ['#chatBtn', '#openChat', '[data-panel="chat"]'],
    openMaterials: ['#materialsBtn', '[data-panel="materials"]'],
    toggleMic: ['#micBtn', '#toggleMic', '#previewMic'],
    copyLink: ['#copyRoomLinkBtn', '#copyShare'],
    openProfile: ['button[data-view="profile"]', '[data-go="profile"]', 'a[href="#profile"]']
  };

  function currentLocale() {
    const supplied = typeof localeProvider === 'function' ? localeProvider() : localeProvider;
    const stored = supplied ||
      localStorage.getItem('duvela.web.lang') ||
      localStorage.getItem('duvela.webLang') ||
      navigator.language ||
      'en';
    const normalized = String(stored).toLowerCase().replace('_', '-');
    const base = normalized.split('-')[0];
    return COPY[base] ? base : 'en';
  }

  function text(key) {
    const locale = currentLocale();
    return COPY[locale]?.[key] || COPY.en[key] || key;
  }

  function interpolate(value, data) {
    return String(value || '').replace(/\{(\w+)\}/g, (_, key) => String(data?.[key] || ''));
  }

  // New DUVI mascot (green robot) — one consistent avatar for every state. The
  // CSS crops the tall full-body PNG into the head for the round avatar/launcher.
  const DUVI_AVATAR = ASSET_ROOT + 'friends/DUVI.png?v=3';
  function assetFor(type) {
    return DUVI_AVATAR;
  }

  function actionTarget(action) {
    const selectors = builtInSelectors[action] || [];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function actionLabel(action) {
    const target = actionTarget(action);
    const fallback = {
      start: text('start'),
      classroom: text('classroom'),
      problem: text('problem'),
      openHome: 'Home',
      openManagement: 'Management',
      openMessages: 'Messages',
      openSchedule: 'Schedule',
      openLive: 'Live',
      openParticipants: 'Participants',
      openChat: 'Chat',
      openMaterials: 'Materials',
      toggleMic: 'Microphone',
      copyLink: 'Copy link',
      openProfile: 'Profile',
      dismiss: text('gotIt')
    };
    const label = target?.textContent?.replace(/\s+/g, ' ').trim();
    return label || fallback[action] || action;
  }

  function currentView() {
    return String(global.location?.hash || '#home').replace(/^#/, '') || 'home';
  }

  function currentRole() {
    const searchRole = new URLSearchParams(global.location?.search || '').get('role');
    return searchRole || localStorage.getItem('duvela.webRole') || 'learner';
  }

  function defaultActions(type) {
    if (type === 'home' || type === 'welcome') {
      if (context === 'classroom') return ['openParticipants', 'openChat', 'openMaterials'];
      if (context === 'app') {
        const role = currentRole();
        const view = currentView();
        if (view === 'messages') return ['openMessages', 'openProfile', 'problem'];
        if (view === 'schedule') return ['openSchedule', 'openMessages', 'openProfile'];
        if (view === 'management') return ['openManagement', 'openMessages', 'openProfile'];
        if (view === 'live') return ['openLive', 'openMessages', 'openProfile'];
        if (role === 'teacher' || role === 'organizer' || role === 'organization' || role === 'admin') {
          return ['openManagement', 'openMessages', 'openProfile'];
        }
        return ['openSchedule', 'openMessages', 'openProfile'];
      }
      return ['start', 'classroom', 'problem'];
    }
    if (type === 'handRaised') return ['openParticipants', 'openChat', 'dismiss'];
    if (type === 'teacherFloor' || type === 'micError') return ['toggleMic', 'dismiss'];
    if (type === 'locationError') return ['openProfile', 'dismiss'];
    if (type === 'offline' || type === 'error') return ['dismiss'];
    return ['dismiss'];
  }

  function performAction(action, payload = {}) {
    const handler = actionHandlers.get(action);
    if (handler) {
      handler(payload);
      return true;
    }
    const target = actionTarget(action);
    if (!target) return false;
    target.click();
    return true;
  }

  function setActions(type, payload = {}) {
    actions.replaceChildren();
    const items = (Array.isArray(payload.actions) && payload.actions.length ? payload.actions : defaultActions(type))
      .map((item) => {
        if (typeof item === 'string') return { action: item, label: actionLabel(item) };
        return {
          action: item.action || 'dismiss',
          label: item.label || actionLabel(item.action || 'dismiss'),
          keepOpen: Boolean(item.keepOpen)
        };
      });
    items.forEach(({ action, label, keepOpen }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.duviAction = action;
      button.textContent = label;
      button.addEventListener('click', () => {
        if (action === 'dismiss') {
          hide();
          return;
        }
        const handled = performAction(action, payload);
        if (!handled) show(action, payload);
        if (!keepOpen) hide();
      });
      actions.append(button);
    });
  }

  // ── Thread rendering ───────────────────────────────────────────────────────
  function scrollThread() {
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function appendBubble(who, textContent, avatarType) {
    const row = document.createElement('div');
    row.className = 'duvi-msg duvi-msg-' + who;
    if (who === 'bot') {
      const img = document.createElement('img');
      img.className = 'duvi-msg-avatar';
      img.alt = '';
      img.src = assetFor(avatarType || 'home');
      row.append(img);
    }
    const bubble = document.createElement('p');
    bubble.className = 'duvi-bubble';
    bubble.textContent = textContent || '';
    row.append(bubble);
    thread.append(row);
    scrollThread();
    return bubble;
  }

  function setBubbleAvatar(bubble, type) {
    const img = bubble?.parentElement?.querySelector('.duvi-msg-avatar');
    if (img) img.src = assetFor(type);
  }

  function openPanel() {
    if (!root) mount();
    root.dir = RTL.has(currentLocale()) ? 'rtl' : 'ltr';
    panel.hidden = false;
    root.classList.add('duvi-attention');
    clearTimeout(attentionTimer);
    attentionTimer = setTimeout(() => root?.classList.remove('duvi-attention'), 1300);
  }

  // Scripted (non-AI) messages: greetings, errors, classroom events.
  function show(type = 'home', data = {}) {
    openPanel();
    const knownType = type === 'welcome' ? 'hello' : type;
    const body = data.message || text(
      knownType === 'home'
        ? (context === 'classroom' ? 'classroomText' : 'hello')
        : knownType === 'error'
          ? 'problemText'
          : knownType
    );
    appendBubble('bot', interpolate(body, data), type);
    setActions(type, data);
    if (inputEl) inputEl.focus({ preventScroll: true });
  }

  function hide() {
    if (panel) panel.hidden = true;
  }

  function setContext(nextContext) {
    context = nextContext || context;
    return global.DuvelaDUVI;
  }

  function setLocale(nextLocale) {
    localeProvider = nextLocale || localeProvider;
    if (root) root.dir = RTL.has(currentLocale()) ? 'rtl' : 'ltr';
    return global.DuvelaDUVI;
  }

  function registerAction(action, handler) {
    if (!action) return global.DuvelaDUVI;
    if (typeof handler === 'function') actionHandlers.set(action, handler);
    else actionHandlers.delete(action);
    return global.DuvelaDUVI;
  }

  function mount(options = {}) {
    context = options.context || context;
    localeProvider = options.locale || localeProvider;
    if (options.handlers && typeof options.handlers === 'object') {
      Object.entries(options.handlers).forEach(([action, handler]) => registerAction(action, handler));
    }
    if (root) return global.DuvelaDUVI;

    root = document.createElement('aside');
    root.className = 'duvi-assistant';
    root.dir = RTL.has(currentLocale()) ? 'rtl' : 'ltr';
    root.innerHTML =
      '<section class="duvi-panel" hidden>' +
        '<div class="duvi-panel-head">' +
          '<strong>DUVI</strong>' +
          '<span class="duvi-head-btns">' +
            '<button class="duvi-voice" type="button" aria-pressed="false"></button>' +
            '<button class="duvi-close" type="button" aria-label="' + text('close') + '">×</button>' +
          '</span>' +
        '</div>' +
        '<div class="duvi-thread" aria-live="polite"></div>' +
        '<div class="duvi-actions"></div>' +
        '<form class="duvi-input">' +
          '<button class="duvi-mic" type="button" aria-label="' + ui('listen') + '" title="' + ui('listen') + '">🎤</button>' +
          '<input class="duvi-text" type="text" autocomplete="off" enterkeyhint="send" placeholder="' + ui('placeholder') + '">' +
          '<button class="duvi-send" type="submit" aria-label="' + ui('send') + '" title="' + ui('send') + '">➤</button>' +
        '</form>' +
      '</section>' +
      '<button class="duvi-launcher" type="button" aria-label="DUVI" title="DUVI"><img alt="" src="' + DUVI_AVATAR + '"></button>';
    document.body.append(root);
    panel = root.querySelector('.duvi-panel');
    thread = root.querySelector('.duvi-thread');
    actions = root.querySelector('.duvi-actions');
    inputEl = root.querySelector('.duvi-text');
    sendBtn = root.querySelector('.duvi-send');
    micBtn = root.querySelector('.duvi-mic');
    voiceBtn = root.querySelector('.duvi-voice');
    form = root.querySelector('.duvi-input');

    root.querySelector('.duvi-close').addEventListener('click', hide);
    root.querySelector('.duvi-launcher').addEventListener('click', () => {
      if (panel.hidden) {
        openPanel();
        if (!thread.childElementCount) show('home');
        inputEl.focus({ preventScroll: true });
      } else hide();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendChat(inputEl.value);
    });
    micBtn.addEventListener('click', toggleListening);
    voiceBtn.addEventListener('click', () => setVoiceEnabled(!voiceEnabled));
    updateVoiceButton();
    if (!speechSupported()) micBtn.hidden = true;

    global.addEventListener('offline', () => show('offline'));
    global.addEventListener('duvela-language-change', () => {
      root.dir = RTL.has(currentLocale()) ? 'rtl' : 'ltr';
      root.querySelector('.duvi-close').setAttribute('aria-label', text('close'));
      inputEl.placeholder = ui('placeholder');
      updateVoiceButton();
    });

    if (options.autoWelcome !== false && !localStorage.getItem(WELCOME_KEY)) {
      localStorage.setItem(WELCOME_KEY, '1');
      setTimeout(() => show('welcome'), Number(options.welcomeDelay || 1200));
    }
    return global.DuvelaDUVI;
  }

  // ── AI chat ────────────────────────────────────────────────────────────────
  function buildContext() {
    return { app: context, view: currentView(), role: currentRole(), lang: currentLocale() };
  }

  function extractActions(raw) {
    const found = [];
    const clean = String(raw || '').replace(/\[\[action:([a-zA-Z]+)\]\]/g, (_, name) => {
      found.push(name);
      return '';
    }).replace(/[ \t]+\n/g, '\n').trim();
    return { clean, found };
  }

  async function sendChat(rawText) {
    const value = String(rawText || '').trim();
    if (!value || streaming) return;
    openPanel();
    if (listening) stopListening();
    stopSpeaking();
    inputEl.value = '';
    actions.replaceChildren();
    appendBubble('user', value);
    history.push({ role: 'user', content: value });

    streaming = true;
    sendBtn.disabled = true;
    const bubble = appendBubble('bot', '', 'thinking');
    bubble.classList.add('duvi-typing');

    try {
      await streamReply(bubble);
    } catch (err) {
      bubble.classList.remove('duvi-typing');
      bubble.textContent = ui('chatError');
      setBubbleAvatar(bubble, 'error');
    } finally {
      streaming = false;
      sendBtn.disabled = false;
      inputEl.focus({ preventScroll: true });
    }
  }

  async function streamReply(bubble) {
    const token = await accessToken();
    const res = await fetch(chatEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey(),
        Authorization: 'Bearer ' + (token || anonKey())
      },
      body: JSON.stringify({ messages: history.slice(-16), context: buildContext(), locale: currentLocale() })
    });
    if (!res.ok || !res.body) throw new Error('duvi-chat ' + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let acc = '';
    let errored = null;

    const consume = (payload) => {
      let obj;
      try { obj = JSON.parse(payload); } catch { return; }
      if (obj.delta) {
        if (bubble.classList.contains('duvi-typing')) bubble.classList.remove('duvi-typing');
        acc += obj.delta;
        bubble.textContent = extractActions(acc).clean;
        scrollThread();
      } else if (obj.error) {
        errored = obj.error;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data:'));
        if (line) consume(line.slice(5).trim());
      }
    }

    bubble.classList.remove('duvi-typing');
    const { clean, found } = extractActions(acc);

    if (!clean && errored) {
      bubble.textContent = ui('chatError');
      return;
    }
    bubble.textContent = clean || (errored ? ui('chatError') : '');
    setBubbleAvatar(bubble, clean ? 'home' : 'error');
    if (clean) history.push({ role: 'assistant', content: clean });
    scrollThread();

    found.forEach((action) => { performAction(action); });
    if (voiceEnabled && clean) speak(clean);
  }

  // ── Voice: speech-to-text (mic) + text-to-speech (replies) ──────────────────
  function speechLang() {
    return SPEECH_LANG[currentLocale()] || 'en-US';
  }

  function speechSupported() {
    return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function getRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = speechLang();
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      inputEl.value = text.trim();
      const last = event.results[event.results.length - 1];
      if (last && last.isFinal) {
        stopListening();
        sendChat(inputEl.value);
      }
    };
    rec.onerror = (event) => {
      listening = false;
      updateMicButton();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        appendBubble('bot', ui('micDenied'), 'micError');
      }
    };
    rec.onend = () => { listening = false; updateMicButton(); };
    return rec;
  }

  function toggleListening() {
    if (listening) { stopListening(); return; }
    if (!recognition) recognition = getRecognition();
    if (!recognition) return;
    recognition.lang = speechLang();
    stopSpeaking();
    try {
      recognition.start();
      listening = true;
      updateMicButton();
    } catch { /* already started */ }
  }

  function stopListening() {
    listening = false;
    updateMicButton();
    try { recognition?.stop(); } catch { /* noop */ }
  }

  function updateMicButton() {
    if (!micBtn) return;
    micBtn.classList.toggle('duvi-listening', listening);
    micBtn.setAttribute('aria-label', listening ? ui('stop') : ui('listen'));
    micBtn.title = listening ? ui('stop') : ui('listen');
  }

  function pickVoice(lang) {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const base = lang.split('-')[0];
    return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(base)) || null;
  }

  function speak(textContent) {
    if (!window.speechSynthesis) return;
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(textContent);
    utter.lang = speechLang();
    const voice = pickVoice(utter.lang);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }

  function setVoiceEnabled(next) {
    voiceEnabled = Boolean(next);
    localStorage.setItem(VOICE_KEY, voiceEnabled ? '1' : '0');
    if (!voiceEnabled) stopSpeaking();
    updateVoiceButton();
    return global.DuvelaDUVI;
  }

  function updateVoiceButton() {
    if (!voiceBtn) return;
    voiceBtn.textContent = voiceEnabled ? '🔊' : '🔈';
    voiceBtn.setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
    const label = voiceEnabled ? ui('voiceOn') : ui('voiceOff');
    voiceBtn.setAttribute('aria-label', label);
    voiceBtn.title = label;
  }

  global.DuvelaDUVI = { mount, show, hide, setContext, setLocale, registerAction, ask: sendChat, setVoice: setVoiceEnabled };
})(window);
