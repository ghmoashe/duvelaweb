(function () {
  // DUVELA Language Match + Voice Rooms for the browser (mirrors Hub
  // app/native/language-match.tsx, voice-rooms.tsx, voice-room.tsx).
  // Language Match: opt-in table language_partner_profiles (owner-only RLS) +
  // RPC find_language_partners. Voice Rooms: every write goes through the
  // security-definer RPCs; audio is Agora (channel "vr_…"), tokens come from
  // the agora-token function, which decides publish rights server-side.

  const LANGUAGES = ['english', 'german', 'spanish', 'french', 'italian', 'portuguese', 'russian', 'ukrainian', 'turkish', 'arabic', 'persian', 'chinese', 'japanese', 'korean', 'dutch', 'danish', 'finnish', 'swedish', 'norwegian', 'polish', 'czech', 'albanian', 'bosnian', 'bulgarian', 'croatian', 'greek', 'macedonian', 'romanian', 'serbian', 'slovenian', 'hindi', 'urdu', 'vietnamese', 'azerbaijani', 'tajik'];
  const ISO = { english: 'en', german: 'de', spanish: 'es', french: 'fr', italian: 'it', portuguese: 'pt', russian: 'ru', ukrainian: 'uk', turkish: 'tr', arabic: 'ar', persian: 'fa', chinese: 'zh', japanese: 'ja', korean: 'ko', dutch: 'nl', danish: 'da', finnish: 'fi', swedish: 'sv', norwegian: 'no', polish: 'pl', czech: 'cs', albanian: 'sq', bosnian: 'bs', bulgarian: 'bg', croatian: 'hr', greek: 'el', macedonian: 'mk', romanian: 'ro', serbian: 'sr', slovenian: 'sl', hindi: 'hi', urdu: 'ur', vietnamese: 'vi', azerbaijani: 'az', tajik: 'tg' };
  const FLAGS = { arabic: '🇸🇦', albanian: '🇦🇱', azerbaijani: '🇦🇿', bosnian: '🇧🇦', bulgarian: '🇧🇬', chinese: '🇨🇳', croatian: '🇭🇷', czech: '🇨🇿', danish: '🇩🇰', dutch: '🇳🇱', english: '🇬🇧', finnish: '🇫🇮', french: '🇫🇷', german: '🇩🇪', greek: '🇬🇷', hindi: '🇮🇳', italian: '🇮🇹', japanese: '🇯🇵', korean: '🇰🇷', macedonian: '🇲🇰', norwegian: '🇳🇴', persian: '🇮🇷', polish: '🇵🇱', portuguese: '🇵🇹', russian: '🇷🇺', romanian: '🇷🇴', serbian: '🇷🇸', slovenian: '🇸🇮', spanish: '🇪🇸', swedish: '🇸🇪', tajik: '🇹🇯', turkish: '🇹🇷', ukrainian: '🇺🇦', urdu: '🇵🇰', vietnamese: '🇻🇳' };
  const INTERESTS = ['travel', 'music', 'movies', 'books', 'sports', 'food', 'tech', 'games', 'art', 'business', 'science', 'nature'];
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const REPORT_REASONS = ['spam', 'harassment', 'hate', 'inappropriate', 'other'];
  const MAX_LANGUAGES = 6;
  const HEARTBEAT_MS = 30000;
  const AGORA_SDK_SRC = './web/vendor/AgoraRTC_N-4.20.0.js';
  const AGORA_FALLBACK_APP_ID = '7dbbced847dc459ba72f7ee6e2426c11';

  function plural(count, forms) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }
  function formatLevels(from, to) {
    if (from && to && from !== to) return from + '–' + to;
    return from || to || 'A1–C2';
  }

  // Copy: same texts as Hub shared/language-match-copy.ts + voice-rooms-copy.ts.
  const COPY = {
    ru: {
      section: 'Говорите с людьми', sectionSub: 'Живая практика с другими учениками',
      lm: {
        title: 'Language Match', heroTitle: 'Найдите языкового партнёра', heroText: 'Подбор по языку, уровню A1–C2, городу и интересам. Например: немецкий ↔ фарси.',
        signInRequired: 'Войдите в аккаунт, чтобы искать партнёров.', formTitle: 'Профиль языкового партнёра',
        consent: 'Ваше имя, фото и то, что вы укажете здесь, увидят только пользователи Language Match, которые тоже включили профиль. Выключить можно в любой момент — данные удалятся.',
        nativeLabel: 'Я говорю (родной язык)', learningLabel: 'Я изучаю', levelLabel: 'Мой уровень в изучаемом языке', cityToggle: 'Показывать мой город', cityPlaceholder: 'Город',
        interestsLabel: 'Интересы (по желанию)', bioLabel: 'Пара слов о себе (по желанию)', bioPlaceholder: 'Например: ищу партнёра для разговорной практики по вечерам', maxHint: 'До 6 языков',
        submit: 'Показывать меня партнёрам', save: 'Сохранить', cancel: 'Отмена', filterAll: 'Все',
        partnersCount: (n) => n + ' ' + plural(n, ['партнёр', 'партнёра', 'партнёров']),
        speaks: 'Говорит', learns: 'Изучает', perfectMatch: 'Взаимный обмен', sharedInterests: 'Общие интересы', write: 'Написать',
        emptyTitle: 'Пока никого нет', emptyText: 'Партнёров для этого языка пока нет. Загляните позже или выберите «Все».',
        yourProfile: 'Ваш профиль партнёра', edit: 'Изменить', turnOff: 'Выключить', confirmTurnOff: 'Точно выключить? Профиль будет удалён',
        chatFailed: 'Не удалось открыть чат. Попробуйте ещё раз.', loadFailed: 'Не удалось загрузить партнёров.', saveFailed: 'Не удалось сохранить профиль.',
        interests: { travel: 'Путешествия', music: 'Музыка', movies: 'Кино', books: 'Книги', sports: 'Спорт', food: 'Еда', tech: 'Технологии', games: 'Игры', art: 'Искусство', business: 'Бизнес', science: 'Наука', nature: 'Природа' }
      },
      vr: {
        title: 'Voice Rooms', heroTitle: 'Говорите вживую', heroText: 'Голосовые комнаты по языку и уровню. Заходите послушать, поднимайте руку — и говорите.',
        signInRequired: 'Войдите в аккаунт, чтобы заходить в голосовые комнаты.', filterAll: 'Все', createRoom: 'Создать комнату',
        emptyTitle: 'Сейчас комнат нет', emptyText: 'Создайте первую — например, «Deutsch sprechen A2–B1».', join: 'Войти',
        participantsLine: (p, s) => p + ' ' + plural(p, ['участник', 'участника', 'участников']) + ' · ' + s + ' ' + plural(s, ['говорит', 'говорят', 'говорят']),
        roomTypes: { open: 'Открытая', private: 'Приватная', teacher: 'С учителем' }, loadFailed: 'Не удалось загрузить комнаты.',
        createTitle: 'Новая комната', languageLabel: 'Язык', titleLabel: 'Название', titlePlaceholder: 'Например: Deutsch sprechen A2–B1', topicLabel: 'Тема (по желанию)', topicPlaceholder: 'Например: Alltag in Deutschland',
        levelFrom: 'Уровень от', levelTo: 'до', accessLabel: 'Кто может войти', accessOpen: 'Любой ученик', accessPrivate: 'Только по приглашению', create: 'Создать', cancel: 'Отмена',
        titleTooShort: 'Название — от 3 символов.', live: 'LIVE', topic: 'Тема', levelLine: (a, b) => 'Уровень ' + formatLevels(a, b),
        roles: { owner: 'Ведущий', moderator: 'Модератор', speaker: 'Спикер', listener: 'Слушатель' }, listenersTitle: (n) => 'Слушатели (' + n + ')',
        noMessages: 'Сообщений пока нет — напишите первым', mic: 'Микрофон', raiseHand: 'Поднять руку', handRaised: 'Рука поднята', chat: 'Чат', leave: 'Выйти',
        chatTitle: 'Чат комнаты', chatPlaceholder: 'Сообщение…', send: 'Отправить', requestsTitle: 'Хотят говорить', approve: 'Пустить', decline: 'Отклонить', noRequests: 'Пока никто не поднял руку',
        makeModerator: 'Сделать модератором', removeModerator: 'Снять модератора', inviteToStage: 'Пригласить на сцену', moveToListeners: 'Вернуть в слушатели', remove: 'Удалить из комнаты', ban: 'Заблокировать',
        report: 'Пожаловаться', reportTitle: 'Причина жалобы', reportSent: 'Жалоба отправлена. Спасибо!',
        reasons: { spam: 'Спам', harassment: 'Оскорбления', hate: 'Язык вражды', inappropriate: 'Неуместное поведение', other: 'Другое' },
        invite: 'Пригласить', inviteTitle: 'Пригласить в комнату', invitePlaceholder: 'Поиск по имени', invited: 'Приглашение отправлено',
        endRoom: 'Завершить комнату', confirmEnd: 'Завершить комнату для всех?', roomEnded: 'Комната завершена.', removed: 'Вас удалили из комнаты.', unavailable: 'Комната недоступна.',
        audioUnavailable: 'Звук недоступен в этом браузере. Участники и чат работают.', micBlocked: 'Нет доступа к микрофону. Разрешите его в браузере.', connecting: 'Подключаем звук…', you: 'Вы', errorGeneric: 'Что-то пошло не так. Попробуйте ещё раз.',
        back: 'Все комнаты', inRoom: 'Вы в голосовой комнате', returnToRoom: 'Вернуться', tapToHear: 'Нажмите, чтобы включить звук'
      }
    },
    de: {
      section: 'Mit Menschen sprechen', sectionSub: 'Live üben mit anderen Lernenden',
      lm: {
        title: 'Language Match', heroTitle: 'Finde deinen Sprachpartner', heroText: 'Partner nach Sprache, Niveau A1–C2, Stadt und Interessen – z. B. Deutsch ↔ Persisch.',
        signInRequired: 'Melde dich an, um Partner zu finden.', formTitle: 'Dein Sprachpartner-Profil',
        consent: 'Dein Name, dein Foto und deine Angaben hier sehen nur Language-Match-Nutzer, die ihr Profil ebenfalls eingeschaltet haben. Du kannst es jederzeit ausschalten – dann werden die Daten gelöscht.',
        nativeLabel: 'Ich spreche (Muttersprache)', learningLabel: 'Ich lerne', levelLabel: 'Mein Niveau in der Lernsprache', cityToggle: 'Meine Stadt anzeigen', cityPlaceholder: 'Stadt',
        interestsLabel: 'Interessen (optional)', bioLabel: 'Kurz über dich (optional)', bioPlaceholder: 'Zum Beispiel: Suche einen Partner für Gesprächspraxis am Abend', maxHint: 'Bis zu 6 Sprachen',
        submit: 'Mich Partnern zeigen', save: 'Speichern', cancel: 'Abbrechen', filterAll: 'Alle',
        partnersCount: (n) => n + ' Partner',
        speaks: 'Spricht', learns: 'Lernt', perfectMatch: 'Gegenseitiger Austausch', sharedInterests: 'Gemeinsame Interessen', write: 'Schreiben',
        emptyTitle: 'Noch niemand da', emptyText: 'Für diese Sprache gibt es noch keine Partner. Schau später vorbei oder wähle „Alle“.',
        yourProfile: 'Dein Partnerprofil', edit: 'Bearbeiten', turnOff: 'Ausschalten', confirmTurnOff: 'Wirklich ausschalten? Das Profil wird gelöscht',
        chatFailed: 'Chat konnte nicht geöffnet werden. Bitte versuche es erneut.', loadFailed: 'Partner konnten nicht geladen werden.', saveFailed: 'Profil konnte nicht gespeichert werden.',
        interests: { travel: 'Reisen', music: 'Musik', movies: 'Filme', books: 'Bücher', sports: 'Sport', food: 'Essen', tech: 'Technik', games: 'Spiele', art: 'Kunst', business: 'Business', science: 'Wissenschaft', nature: 'Natur' }
      },
      vr: {
        title: 'Voice Rooms', heroTitle: 'Live sprechen', heroText: 'Sprachräume nach Sprache und Niveau. Reinhören, Hand heben – und mitreden.',
        signInRequired: 'Melde dich an, um Sprachräume zu betreten.', filterAll: 'Alle', createRoom: 'Raum erstellen',
        emptyTitle: 'Gerade keine Räume', emptyText: 'Erstelle den ersten – z. B. „Deutsch sprechen A2–B1“.', join: 'Beitreten',
        participantsLine: (p, s) => p + ' Teilnehmer · ' + s + ' ' + (s === 1 ? 'spricht' : 'sprechen'),
        roomTypes: { open: 'Offen', private: 'Privat', teacher: 'Mit Lehrer' }, loadFailed: 'Räume konnten nicht geladen werden.',
        createTitle: 'Neuer Raum', languageLabel: 'Sprache', titleLabel: 'Name', titlePlaceholder: 'Zum Beispiel: Deutsch sprechen A2–B1', topicLabel: 'Thema (optional)', topicPlaceholder: 'Zum Beispiel: Alltag in Deutschland',
        levelFrom: 'Niveau von', levelTo: 'bis', accessLabel: 'Wer darf rein', accessOpen: 'Alle Lernenden', accessPrivate: 'Nur mit Einladung', create: 'Erstellen', cancel: 'Abbrechen',
        titleTooShort: 'Der Name braucht mindestens 3 Zeichen.', live: 'LIVE', topic: 'Thema', levelLine: (a, b) => 'Niveau ' + formatLevels(a, b),
        roles: { owner: 'Host', moderator: 'Moderator', speaker: 'Sprecher', listener: 'Zuhörer' }, listenersTitle: (n) => 'Zuhörer (' + n + ')',
        noMessages: 'Noch keine Nachrichten – schreib die erste', mic: 'Mikrofon', raiseHand: 'Hand heben', handRaised: 'Hand gehoben', chat: 'Chat', leave: 'Verlassen',
        chatTitle: 'Raum-Chat', chatPlaceholder: 'Nachricht…', send: 'Senden', requestsTitle: 'Möchten sprechen', approve: 'Zulassen', decline: 'Ablehnen', noRequests: 'Noch hat niemand die Hand gehoben',
        makeModerator: 'Zum Moderator machen', removeModerator: 'Moderator entfernen', inviteToStage: 'Auf die Bühne holen', moveToListeners: 'Zu den Zuhörern', remove: 'Aus dem Raum entfernen', ban: 'Sperren',
        report: 'Melden', reportTitle: 'Grund der Meldung', reportSent: 'Meldung gesendet. Danke!',
        reasons: { spam: 'Spam', harassment: 'Beleidigungen', hate: 'Hassrede', inappropriate: 'Unangemessenes Verhalten', other: 'Sonstiges' },
        invite: 'Einladen', inviteTitle: 'In den Raum einladen', invitePlaceholder: 'Nach Namen suchen', invited: 'Einladung gesendet',
        endRoom: 'Raum beenden', confirmEnd: 'Raum für alle beenden?', roomEnded: 'Der Raum wurde beendet.', removed: 'Du wurdest aus dem Raum entfernt.', unavailable: 'Dieser Raum ist nicht verfügbar.',
        audioUnavailable: 'Ton ist in diesem Browser nicht verfügbar. Teilnehmer und Chat funktionieren.', micBlocked: 'Kein Zugriff auf das Mikrofon. Erlaube es im Browser.', connecting: 'Ton wird verbunden…', you: 'Du', errorGeneric: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
        back: 'Alle Räume', inRoom: 'Du bist in einem Sprachraum', returnToRoom: 'Zurück', tapToHear: 'Tippen, um den Ton einzuschalten'
      }
    },
    en: {
      section: 'Speak with people', sectionSub: 'Live practice with other learners',
      lm: {
        title: 'Language Match', heroTitle: 'Find your language partner', heroText: 'Partners matched by language, level A1–C2, city and interests — e.g. German ↔ Persian.',
        signInRequired: 'Sign in to find partners.', formTitle: 'Your language partner profile',
        consent: 'Your name, photo and what you enter here are shown only to Language Match users who turned their profile on too. You can turn it off any time — your data is then deleted.',
        nativeLabel: 'I speak (native)', learningLabel: "I'm learning", levelLabel: 'My level in the language I learn', cityToggle: 'Show my city', cityPlaceholder: 'City',
        interestsLabel: 'Interests (optional)', bioLabel: 'A few words about you (optional)', bioPlaceholder: 'For example: looking for evening conversation practice', maxHint: 'Up to 6 languages',
        submit: 'Show me to partners', save: 'Save', cancel: 'Cancel', filterAll: 'All',
        partnersCount: (n) => n + ' ' + (n === 1 ? 'partner' : 'partners'),
        speaks: 'Speaks', learns: 'Learns', perfectMatch: 'Mutual exchange', sharedInterests: 'Shared interests', write: 'Message',
        emptyTitle: 'Nobody here yet', emptyText: 'No partners for this language yet. Check back later or choose "All".',
        yourProfile: 'Your partner profile', edit: 'Edit', turnOff: 'Turn off', confirmTurnOff: 'Turn off for sure? Your profile will be deleted',
        chatFailed: 'Could not open the chat. Please try again.', loadFailed: 'Could not load partners.', saveFailed: 'Could not save your profile.',
        interests: { travel: 'Travel', music: 'Music', movies: 'Movies', books: 'Books', sports: 'Sports', food: 'Food', tech: 'Tech', games: 'Games', art: 'Art', business: 'Business', science: 'Science', nature: 'Nature' }
      },
      vr: {
        title: 'Voice Rooms', heroTitle: 'Speak live', heroText: 'Voice rooms by language and level. Drop in to listen, raise your hand — and talk.',
        signInRequired: 'Sign in to join voice rooms.', filterAll: 'All', createRoom: 'Create room',
        emptyTitle: 'No rooms right now', emptyText: 'Start the first one — e.g. "Deutsch sprechen A2–B1".', join: 'Join',
        participantsLine: (p, s) => p + ' ' + (p === 1 ? 'participant' : 'participants') + ' · ' + s + ' speaking',
        roomTypes: { open: 'Open', private: 'Private', teacher: 'With teacher' }, loadFailed: 'Could not load rooms.',
        createTitle: 'New room', languageLabel: 'Language', titleLabel: 'Name', titlePlaceholder: 'For example: Deutsch sprechen A2–B1', topicLabel: 'Topic (optional)', topicPlaceholder: 'For example: Alltag in Deutschland',
        levelFrom: 'Level from', levelTo: 'to', accessLabel: 'Who can join', accessOpen: 'Any learner', accessPrivate: 'Invite only', create: 'Create', cancel: 'Cancel',
        titleTooShort: 'The name needs at least 3 characters.', live: 'LIVE', topic: 'Topic', levelLine: (a, b) => 'Level ' + formatLevels(a, b),
        roles: { owner: 'Host', moderator: 'Moderator', speaker: 'Speaker', listener: 'Listener' }, listenersTitle: (n) => 'Listeners (' + n + ')',
        noMessages: 'No messages yet — say hi', mic: 'Microphone', raiseHand: 'Raise hand', handRaised: 'Hand raised', chat: 'Chat', leave: 'Leave',
        chatTitle: 'Room chat', chatPlaceholder: 'Message…', send: 'Send', requestsTitle: 'Want to speak', approve: 'Let in', decline: 'Decline', noRequests: 'Nobody has raised a hand yet',
        makeModerator: 'Make moderator', removeModerator: 'Remove moderator', inviteToStage: 'Invite to stage', moveToListeners: 'Move to listeners', remove: 'Remove from room', ban: 'Block',
        report: 'Report', reportTitle: 'Reason for the report', reportSent: 'Report sent. Thank you!',
        reasons: { spam: 'Spam', harassment: 'Harassment', hate: 'Hate speech', inappropriate: 'Inappropriate behaviour', other: 'Other' },
        invite: 'Invite', inviteTitle: 'Invite to the room', invitePlaceholder: 'Search by name', invited: 'Invitation sent',
        endRoom: 'End room', confirmEnd: 'End the room for everyone?', roomEnded: 'The room has ended.', removed: 'You were removed from the room.', unavailable: 'This room is not available.',
        audioUnavailable: 'Audio is not available in this browser. People and chat still work.', micBlocked: 'No microphone access. Allow it in your browser.', connecting: 'Connecting audio…', you: 'You', errorGeneric: 'Something went wrong. Please try again.',
        back: 'All rooms', inRoom: 'You are in a voice room', returnToRoom: 'Return', tapToHear: 'Click to turn on sound'
      }
    }
  };

  function agoraUidForUser(userId) {
    const value = Number.parseInt(String(userId || '').replace(/-/g, '').slice(0, 8), 16);
    return Number.isFinite(value) ? (value >>> 0) || 1 : 1;
  }
  function isOnStage(role) {
    return role === 'owner' || role === 'moderator' || role === 'speaker';
  }
  function errorText(error, fallback) {
    return (error && (error.message || error.error_description)) || fallback;
  }

  function createSocialPractice(ctx) {
    const { $, esc, supa } = ctx;
    const appLang = String((ctx.getAppLang && ctx.getAppLang()) || 'en').toLowerCase();
    const copy = appLang.startsWith('ru') ? COPY.ru : appLang.startsWith('de') ? COPY.de : COPY.en;
    const lmCopy = copy.lm;
    const vrCopy = copy.vr;
    let displayNames = null;
    try { displayNames = new Intl.DisplayNames([appLang], { type: 'language' }); } catch (_) { displayNames = null; }

    function languageName(id) {
      let name = '';
      try { name = displayNames && ISO[id] ? displayNames.of(ISO[id]) : ''; } catch (_) { name = ''; }
      if (!name || name === ISO[id]) name = id.charAt(0).toUpperCase() + id.slice(1);
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    function languageLabel(id) {
      return (FLAGS[id] ? FLAGS[id] + ' ' : '') + languageName(id);
    }
    function avatar(name, url, extraClass) {
      const initials = String(name || 'D').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'D';
      return '<span class="sp-avatar ' + (extraClass || '') + '">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy">' : esc(initials)) + '</span>';
    }
    function profileLanguage() {
      const raw = String(ctx.profile?.language || '').trim().toLowerCase();
      if (LANGUAGES.includes(raw)) return raw;
      const fromIso = Object.keys(ISO).find((id) => ISO[id] === raw);
      return fromIso || null;
    }
    function userId() {
      return ctx.user?.id || null;
    }

    // ── Practice tab cards ───────────────────────────────────────────────────
    function cardsHtml() {
      return '<section class="sp-practice-section"><div class="sp-practice-head"><small>' + esc(copy.sectionSub.toUpperCase()) + '</small><h2>' + esc(copy.section) + '</h2></div>' +
        '<div class="sp-practice-cards">' +
          '<button type="button" class="sp-practice-card lm" data-social-open="partners"><span class="sp-practice-icon">👥</span><span><b>' + esc(lmCopy.title) + '</b><small>' + esc(lmCopy.heroTitle) + '</small></span><strong>→</strong></button>' +
          '<button type="button" class="sp-practice-card vr" data-social-open="voicerooms"><span class="sp-practice-icon">🎙</span><span><b>' + esc(vrCopy.title) + '</b><small>' + esc(vrCopy.heroText) + '</small></span><strong>→</strong></button>' +
        '</div></section>';
    }

    // ══ Language Match ═══════════════════════════════════════════════════════
    const lm = { profile: null, loaded: false, mode: 'loading', partners: [], filter: null, error: null, listLoading: false, confirmingOff: false, form: null, saving: false };

    function lmHost() { return document.getElementById('partnersView'); }

    async function openPartners() {
      const host = lmHost();
      if (!host) return;
      if (!userId()) { lm.mode = 'signedout'; renderPartners(); return; }
      if (!lm.loaded) {
        lm.mode = 'loading';
        renderPartners();
        try {
          const { data, error } = await supa.from('language_partner_profiles')
            .select('enabled,native_languages,learning_languages,level,city,interests,bio')
            .eq('user_id', userId()).maybeSingle();
          if (error) throw error;
          lm.profile = data || null;
          lm.loaded = true;
          lm.mode = data?.enabled ? 'list' : 'form';
          lm.error = null;
        } catch (_) {
          lm.error = lmCopy.loadFailed;
          lm.mode = 'form';
        }
      }
      if (lm.mode === 'form' && !lm.form) startForm();
      renderPartners();
      if (lm.mode === 'list') loadPartners();
    }

    function startForm() {
      // Nothing is preselected: the user decides every field before sharing.
      const p = lm.profile;
      lm.form = {
        native: p ? (p.native_languages || []).slice() : [],
        learning: p ? (p.learning_languages || []).slice() : [],
        level: p?.level || null,
        showCity: Boolean(p?.city),
        city: p?.city || '',
        interests: p ? (p.interests || []).slice() : [],
        bio: p?.bio || ''
      };
    }

    async function loadPartners() {
      if (!lm.profile?.enabled) return;
      lm.listLoading = true;
      lm.error = null;
      renderPartners();
      try {
        const { data, error } = await supa.rpc('find_language_partners', { target_language: lm.filter, max_results: 30 });
        if (error) throw error;
        lm.partners = Array.isArray(data) ? data : [];
      } catch (_) {
        lm.error = lmCopy.loadFailed;
      }
      lm.listLoading = false;
      renderPartners();
    }

    function chip(label, active, attrs) {
      return '<button type="button" class="sp-chip' + (active ? ' active' : '') + '" ' + attrs + '>' + esc(label) + '</button>';
    }

    function renderPartnersForm() {
      const f = lm.form;
      const canSubmit = f.native.length > 0 && f.learning.length > 0 && f.level && !lm.saving;
      return '<form class="sp-card sp-form" data-lm-form>' +
        '<h2>' + esc(lmCopy.formTitle) + '</h2>' +
        '<div class="sp-consent"><span>🛡</span><p>' + esc(lmCopy.consent) + '</p></div>' +
        '<fieldset><legend>' + esc(lmCopy.nativeLabel) + '</legend><p class="sp-hint">' + esc(lmCopy.maxHint) + '</p><div class="sp-chips">' +
          LANGUAGES.map((id) => chip(languageLabel(id), f.native.includes(id), 'data-lm-toggle="native" data-value="' + id + '"')).join('') + '</div></fieldset>' +
        '<fieldset><legend>' + esc(lmCopy.learningLabel) + '</legend><div class="sp-chips">' +
          LANGUAGES.map((id) => chip(languageLabel(id), f.learning.includes(id), 'data-lm-toggle="learning" data-value="' + id + '"')).join('') + '</div></fieldset>' +
        '<fieldset><legend>' + esc(lmCopy.levelLabel) + '</legend><div class="sp-chips sp-levels">' +
          LEVELS.map((level) => chip(level, f.level === level, 'data-lm-level="' + level + '"')).join('') + '</div></fieldset>' +
        '<fieldset><label class="sp-switch"><input type="checkbox" data-lm-showcity' + (f.showCity ? ' checked' : '') + '><span>' + esc(lmCopy.cityToggle) + '</span></label>' +
          (f.showCity ? '<input class="sp-input" data-lm-city maxlength="80" placeholder="' + esc(lmCopy.cityPlaceholder) + '" value="' + esc(f.city) + '">' : '') + '</fieldset>' +
        '<fieldset><legend>' + esc(lmCopy.interestsLabel) + '</legend><div class="sp-chips">' +
          INTERESTS.map((id) => chip(lmCopy.interests[id], f.interests.includes(id), 'data-lm-toggle="interests" data-value="' + id + '"')).join('') + '</div></fieldset>' +
        '<fieldset><legend>' + esc(lmCopy.bioLabel) + '</legend><textarea class="sp-input" data-lm-bio maxlength="140" rows="2" placeholder="' + esc(lmCopy.bioPlaceholder) + '">' + esc(f.bio) + '</textarea></fieldset>' +
        (lm.error ? '<p class="sp-error" role="alert">' + esc(lm.error) + '</p>' : '') +
        '<div class="sp-form-actions">' +
          (lm.profile?.enabled ? '<button type="button" class="sp-btn ghost" data-lm-cancel>' + esc(lmCopy.cancel) + '</button>' : '') +
          '<button type="submit" class="sp-btn primary lm"' + (canSubmit ? '' : ' disabled') + '>' + esc(lm.profile?.enabled ? lmCopy.save : lmCopy.submit) + '</button>' +
        '</div></form>';
    }

    function renderPartnerCard(partner) {
      const mutual = (partner.native_languages || []).some((id) => (lm.profile?.learning_languages || []).includes(id)) &&
        (partner.learning_languages || []).some((id) => (lm.profile?.native_languages || []).includes(id));
      const place = [partner.city, partner.country].filter(Boolean).join(', ');
      return '<article class="sp-card sp-partner">' +
        '<div class="sp-partner-top">' + avatar(partner.full_name, partner.avatar_url) +
          '<div class="sp-partner-name"><b>' + esc(partner.full_name || 'DUVELA') + '</b><small>' + esc([partner.level, place].filter(Boolean).join(' · ')) + '</small></div>' +
          (mutual ? '<span class="sp-badge lm">' + esc(lmCopy.perfectMatch) + '</span>' : '') + '</div>' +
        '<p class="sp-line"><span>' + esc(lmCopy.speaks) + ':</span> ' + esc((partner.native_languages || []).map(languageLabel).join(', ')) + '</p>' +
        '<p class="sp-line"><span>' + esc(lmCopy.learns) + ':</span> ' + esc((partner.learning_languages || []).map(languageLabel).join(', ')) + '</p>' +
        (partner.shared_interests && partner.shared_interests.length ? '<p class="sp-line"><span>' + esc(lmCopy.sharedInterests) + ':</span> ' + esc(partner.shared_interests.map((id) => lmCopy.interests[id] || id).join(', ')) + '</p>' : '') +
        (partner.bio ? '<p class="sp-bio">' + esc(partner.bio) + '</p>' : '') +
        '<button type="button" class="sp-btn primary lm" data-lm-write="' + esc(partner.user_id) + '">💬 ' + esc(lmCopy.write) + '</button>' +
      '</article>';
    }

    function renderPartnersList() {
      const p = lm.profile;
      const filterOptions = Array.from(new Set(p?.learning_languages || []));
      let html = '<section class="sp-hero lm"><span>👥</span><h2>' + esc(lmCopy.heroTitle) + '</h2><p>' + esc(lmCopy.heroText) + '</p></section>';
      if (p) {
        html += '<section class="sp-card sp-myprofile"><div class="sp-row"><b>' + esc(lmCopy.yourProfile) + '</b><button type="button" class="sp-link" data-lm-edit>✎ ' + esc(lmCopy.edit) + '</button></div>' +
          '<p class="sp-line"><span>' + esc(lmCopy.speaks) + ':</span> ' + esc((p.native_languages || []).map(languageLabel).join(', ')) + '</p>' +
          '<p class="sp-line"><span>' + esc(lmCopy.learns) + ':</span> ' + esc((p.learning_languages || []).map(languageLabel).join(', ')) + (p.level ? ' · ' + esc(p.level) : '') + '</p>' +
          (lm.confirmingOff
            ? '<div class="sp-confirm"><p>' + esc(lmCopy.confirmTurnOff) + '</p><div><button type="button" class="sp-btn ghost" data-lm-off-cancel>' + esc(lmCopy.cancel) + '</button><button type="button" class="sp-btn danger" data-lm-off-confirm>' + esc(lmCopy.turnOff) + '</button></div></div>'
            : '<button type="button" class="sp-link danger" data-lm-off>' + esc(lmCopy.turnOff) + '</button>') +
          '</section>';
      }
      html += '<div class="sp-chips sp-filter">' + chip(lmCopy.filterAll, lm.filter === null, 'data-lm-filter=""') +
        filterOptions.map((id) => chip(languageLabel(id), lm.filter === id, 'data-lm-filter="' + id + '"')).join('') + '</div>';
      if (lm.error) html += '<p class="sp-error" role="alert">' + esc(lm.error) + '</p>';
      if (lm.listLoading) html += '<div class="sp-loading"><span class="sp-spinner"></span></div>';
      else if (!lm.partners.length) html += '<div class="sp-card sp-empty"><span>🔎</span><b>' + esc(lmCopy.emptyTitle) + '</b><p>' + esc(lmCopy.emptyText) + '</p></div>';
      else html += '<p class="sp-count">' + esc(lmCopy.partnersCount(lm.partners.length)) + '</p><div class="sp-partner-grid">' + lm.partners.map(renderPartnerCard).join('') + '</div>';
      return html;
    }

    function renderPartners() {
      const host = lmHost();
      if (!host) return;
      let body;
      if (lm.mode === 'signedout') body = '<div class="sp-card sp-empty"><b>' + esc(lmCopy.signInRequired) + '</b></div>';
      else if (lm.mode === 'loading') body = '<div class="sp-loading"><span class="sp-spinner"></span></div>';
      else if (lm.mode === 'form') body = renderPartnersForm();
      else body = renderPartnersList();
      host.innerHTML = '<div class="sp-page sp-lm">' + body + '</div>';
    }

    function toggleIn(list, value, max) {
      if (list.includes(value)) return list.filter((item) => item !== value);
      return list.length >= max ? list : list.concat(value);
    }

    async function saveLanguageProfile() {
      const f = lm.form;
      if (!f || !userId()) return;
      lm.saving = true;
      lm.error = null;
      renderPartners();
      try {
        const payload = {
          user_id: userId(),
          enabled: true,
          native_languages: f.native,
          learning_languages: f.learning,
          level: f.level,
          city: f.showCity ? (f.city.trim() || null) : null,
          interests: f.interests,
          bio: f.bio.trim() || null
        };
        const { data, error } = await supa.from('language_partner_profiles').upsert(payload, { onConflict: 'user_id' })
          .select('enabled,native_languages,learning_languages,level,city,interests,bio').single();
        if (error) throw error;
        lm.profile = data;
        lm.loaded = true;
        lm.mode = 'list';
        lm.form = null;
        lm.filter = null;
      } catch (_) {
        lm.error = lmCopy.saveFailed;
      }
      lm.saving = false;
      renderPartners();
      if (lm.mode === 'list') loadPartners();
    }

    async function turnOffLanguageProfile() {
      if (!userId()) return;
      try {
        const { error } = await supa.from('language_partner_profiles').delete().eq('user_id', userId());
        if (error) throw error;
        lm.profile = null;
        lm.partners = [];
        lm.confirmingOff = false;
        lm.mode = 'form';
        startForm();
      } catch (_) {
        lm.error = lmCopy.saveFailed;
      }
      renderPartners();
    }

    async function writeToPartner(button, partnerId) {
      button.disabled = true;
      try {
        // startChatWith = create_direct_chat + restore + open (web chat helpers).
        ctx.setView('messages');
        await ctx.startChatWith(partnerId);
      } catch (_) {
        lm.error = lmCopy.chatFailed;
        renderPartners();
      }
      button.disabled = false;
    }

    function bindPartners() {
      const host = lmHost();
      if (!host) return;
      host.addEventListener('click', (event) => {
        const f = lm.form;
        const toggle = event.target.closest('[data-lm-toggle]');
        if (toggle && f) {
          const key = toggle.dataset.lmToggle;
          f[key] = toggleIn(f[key], toggle.dataset.value, key === 'interests' ? 10 : MAX_LANGUAGES);
          renderPartners();
          return;
        }
        const level = event.target.closest('[data-lm-level]');
        if (level && f) { f.level = f.level === level.dataset.lmLevel ? null : level.dataset.lmLevel; renderPartners(); return; }
        if (event.target.closest('[data-lm-cancel]')) { lm.form = null; lm.error = null; lm.mode = 'list'; renderPartners(); loadPartners(); return; }
        if (event.target.closest('[data-lm-edit]')) { startForm(); lm.mode = 'form'; lm.error = null; renderPartners(); return; }
        if (event.target.closest('[data-lm-off]')) { lm.confirmingOff = true; renderPartners(); return; }
        if (event.target.closest('[data-lm-off-cancel]')) { lm.confirmingOff = false; renderPartners(); return; }
        if (event.target.closest('[data-lm-off-confirm]')) { turnOffLanguageProfile(); return; }
        const filter = event.target.closest('[data-lm-filter]');
        if (filter) { lm.filter = filter.dataset.lmFilter || null; loadPartners(); return; }
        const write = event.target.closest('[data-lm-write]');
        if (write) writeToPartner(write, write.dataset.lmWrite);
      });
      host.addEventListener('change', (event) => {
        if (event.target.matches('[data-lm-showcity]') && lm.form) { lm.form.showCity = event.target.checked; renderPartners(); }
      });
      host.addEventListener('input', (event) => {
        if (!lm.form) return;
        if (event.target.matches('[data-lm-city]')) lm.form.city = event.target.value;
        if (event.target.matches('[data-lm-bio]')) lm.form.bio = event.target.value;
      });
      host.addEventListener('submit', (event) => {
        if (!event.target.matches('[data-lm-form]')) return;
        event.preventDefault();
        saveLanguageProfile();
      });
    }

    // ══ Voice Rooms: list + create ═══════════════════════════════════════════
    const vr = { rooms: [], filter: null, loading: false, error: null, createOpen: false, create: null, creating: false, listChannel: null };
    function vrHost() { return document.getElementById('voiceRoomsView'); }

    async function loadRooms() {
      vr.loading = true;
      vr.error = null;
      renderVoiceRooms();
      try {
        const { data, error } = await supa.rpc('list_voice_rooms', { p_language: vr.filter });
        if (error) throw error;
        vr.rooms = Array.isArray(data) ? data : [];
      } catch (_) {
        vr.error = vrCopy.loadFailed;
      }
      vr.loading = false;
      renderVoiceRooms();
    }

    function subscribeRoomList() {
      if (vr.listChannel || !supa.channel) return;
      let timer = null;
      const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { if (!room.id && isPanelActive('voicerooms')) loadRooms(); }, 800); };
      vr.listChannel = supa.channel('voice-room-list-' + Math.random().toString(36).slice(2, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_rooms' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_members' }, refresh)
        .subscribe();
    }

    function renderRoomCard(item) {
      const levels = item.level_min || item.level_max ? vrCopy.levelLine(item.level_min, item.level_max) : '';
      return '<article class="sp-card sp-room-card">' +
        '<div class="sp-room-meta"><span>' + esc(languageLabel(item.language)) + '</span>' + (levels ? '<span>· ' + esc(levels) + '</span>' : '') +
          '<span class="sp-badge ' + (item.room_type === 'private' ? 'private' : 'vr') + '">' + (item.room_type === 'private' ? '🔒 ' : '') + esc(vrCopy.roomTypes[item.room_type] || item.room_type) + '</span></div>' +
        '<h3>' + esc(item.title) + '</h3>' + (item.topic ? '<p class="sp-room-topic">' + esc(item.topic) + '</p>' : '') +
        '<div class="sp-room-foot">' + avatar(item.owner_name, item.owner_avatar, 'sm') +
          '<span class="sp-room-people">' + esc(item.owner_name || 'DUVELA') + '<small>' + esc(vrCopy.participantsLine(Number(item.participant_count || 0), Number(item.speaker_count || 0))) + '</small></span>' +
          '<button type="button" class="sp-btn primary vr" data-vr-join="' + esc(item.id) + '">' + esc(vrCopy.join) + '</button></div>' +
      '</article>';
    }

    function renderCreateForm() {
      const c = vr.create;
      return '<form class="sp-card sp-form sp-create" data-vr-create-form><h2>' + esc(vrCopy.createTitle) + '</h2>' +
        '<label class="sp-field"><span>' + esc(vrCopy.languageLabel) + '</span><select class="sp-input" data-vr-c="language">' +
          LANGUAGES.map((id) => '<option value="' + id + '"' + (c.language === id ? ' selected' : '') + '>' + esc(languageLabel(id)) + '</option>').join('') + '</select></label>' +
        '<label class="sp-field"><span>' + esc(vrCopy.titleLabel) + '</span><input class="sp-input" data-vr-c="title" maxlength="80" placeholder="' + esc(vrCopy.titlePlaceholder) + '" value="' + esc(c.title) + '"></label>' +
        '<label class="sp-field"><span>' + esc(vrCopy.topicLabel) + '</span><textarea class="sp-input" data-vr-c="topic" maxlength="280" rows="2" placeholder="' + esc(vrCopy.topicPlaceholder) + '">' + esc(c.topic) + '</textarea></label>' +
        '<div class="sp-field"><span>' + esc(vrCopy.levelFrom) + '</span><div class="sp-chips sp-levels">' + LEVELS.map((level) => chip(level, c.levelMin === level, 'data-vr-level="levelMin" data-value="' + level + '"')).join('') + '</div></div>' +
        '<div class="sp-field"><span>' + esc(vrCopy.levelTo) + '</span><div class="sp-chips sp-levels">' + LEVELS.map((level) => chip(level, c.levelMax === level, 'data-vr-level="levelMax" data-value="' + level + '"')).join('') + '</div></div>' +
        '<div class="sp-field"><span>' + esc(vrCopy.accessLabel) + '</span><div class="sp-access">' +
          '<button type="button" class="sp-access-option' + (c.roomType === 'open' ? ' active' : '') + '" data-vr-type="open">🌐 ' + esc(vrCopy.accessOpen) + '</button>' +
          '<button type="button" class="sp-access-option' + (c.roomType === 'private' ? ' active' : '') + '" data-vr-type="private">🔒 ' + esc(vrCopy.accessPrivate) + '</button></div></div>' +
        (vr.error ? '<p class="sp-error" role="alert">' + esc(vr.error) + '</p>' : '') +
        '<div class="sp-form-actions"><button type="button" class="sp-btn ghost" data-vr-create-cancel>' + esc(vrCopy.cancel) + '</button>' +
          '<button type="submit" class="sp-btn primary vr"' + (vr.creating ? ' disabled' : '') + '>' + esc(vrCopy.create) + '</button></div></form>';
    }

    function renderVoiceRooms() {
      const host = vrHost();
      if (!host) return;
      if (room.id) { renderRoom(); return; }
      if (!userId()) { host.innerHTML = '<div class="sp-page sp-vr"><div class="sp-card sp-empty"><b>' + esc(vrCopy.signInRequired) + '</b></div></div>'; return; }
      const target = profileLanguage();
      let html = '<section class="sp-hero vr"><span>🎙</span><h2>' + esc(vrCopy.heroTitle) + '</h2><p>' + esc(vrCopy.heroText) + '</p>' +
        '<button type="button" class="sp-btn light" data-vr-create>＋ ' + esc(vrCopy.createRoom) + '</button></section>';
      if (vr.createOpen && vr.create) html += renderCreateForm();
      html += '<div class="sp-chips sp-filter">' + chip(vrCopy.filterAll, vr.filter === null, 'data-vr-filter=""') +
        (target ? chip(languageLabel(target), vr.filter === target, 'data-vr-filter="' + target + '"') : '') + '</div>';
      if (vr.error && !vr.createOpen) html += '<p class="sp-error" role="alert">' + esc(vr.error) + '</p>';
      if (vr.loading && !vr.rooms.length) html += '<div class="sp-loading"><span class="sp-spinner"></span></div>';
      else if (!vr.rooms.length) html += '<div class="sp-card sp-empty"><span>🎙</span><b>' + esc(vrCopy.emptyTitle) + '</b><p>' + esc(vrCopy.emptyText) + '</p></div>';
      else html += '<div class="sp-room-grid">' + vr.rooms.map(renderRoomCard).join('') + '</div>';
      host.innerHTML = '<div class="sp-page sp-vr">' + html + '</div>';
    }

    async function createRoom() {
      const c = vr.create;
      if (!c) return;
      if (c.title.trim().length < 3) { vr.error = vrCopy.titleTooShort; renderVoiceRooms(); return; }
      const minIndex = c.levelMin ? LEVELS.indexOf(c.levelMin) : -1;
      const maxIndex = c.levelMax ? LEVELS.indexOf(c.levelMax) : -1;
      const swap = minIndex > maxIndex && maxIndex >= 0;
      vr.creating = true;
      vr.error = null;
      renderVoiceRooms();
      try {
        const { data, error } = await supa.rpc('create_voice_room', {
          p_title: c.title.trim(),
          p_language: c.language,
          p_level_min: swap ? c.levelMax : c.levelMin,
          p_level_max: swap ? c.levelMin : c.levelMax,
          p_topic: c.topic.trim() || null,
          p_room_type: c.roomType
        });
        if (error) throw error;
        vr.createOpen = false;
        vr.create = null;
        vr.creating = false;
        if (data) enterRoom(String(data));
        return;
      } catch (error) {
        vr.error = errorText(error, vrCopy.errorGeneric);
      }
      vr.creating = false;
      renderVoiceRooms();
    }

    // ══ Voice Room: inside a room ════════════════════════════════════════════
    const room = {
      id: null, detail: null, phase: 'idle', closedReason: null, members: [], messages: [], requests: [], role: null,
      joined: false, heartbeat: null, channel: null, notice: null, noticeTimer: null, sheet: null, sheetData: null,
      inviteQuery: '', inviteResults: [], invitedIds: [], chatDraft: ''
    };
    const audio = { client: null, status: 'idle', error: null, isPublisher: false, micEnabled: false, micTrack: null, speakingUids: new Set(), channelName: null, appId: null, tokenRole: 'subscriber', blocked: [] };

    function me() { return room.members.find((member) => member.user_id === userId()) || null; }
    function isModerator() { return room.role === 'owner' || room.role === 'moderator'; }

    function flash(text) {
      room.notice = text;
      clearTimeout(room.noticeTimer);
      room.noticeTimer = setTimeout(() => { if (room.notice === text) { room.notice = null; renderRoom(); } }, 2600);
      renderRoom();
    }

    async function rpc(name, args) {
      const { data, error } = await supa.rpc(name, args);
      if (error) throw error;
      return data;
    }
    async function getRoomDetail() {
      const data = await rpc('get_voice_room', { p_room: room.id });
      return Array.isArray(data) ? data[0] || null : data || null;
    }
    async function refreshMembers() {
      try { room.members = (await rpc('list_voice_room_members', { p_room: room.id })) || []; } catch (_) { /* keep last list */ }
      syncRole();
      renderRoom();
    }
    async function refreshMessages() {
      try { room.messages = (await rpc('list_voice_room_messages', { p_room: room.id, p_limit: 50 })) || []; } catch (_) { /* keep last messages */ }
      renderRoom();
    }
    async function refreshRequests() {
      if (!isModerator()) { room.requests = []; renderRoom(); return; }
      try { room.requests = (await rpc('list_voice_room_requests', { p_room: room.id })) || []; } catch (_) { /* keep last queue */ }
      renderRoom();
    }

    // My role changed on the server: stage ↔ audience, or I'm gone.
    function syncRole() {
      if (room.phase !== 'ready') return;
      const mine = me();
      const next = mine ? mine.role : null;
      if (next === null) {
        if (room.joined && room.members.length) closeForMissingSelf();
        return;
      }
      const previous = room.role;
      if (previous === next) return;
      room.role = next;
      if (!isOnStage(previous) && isOnStage(next)) promoteToSpeaker();
      if (isOnStage(previous) && !isOnStage(next)) demoteToListener();
      refreshRequests();
    }

    async function enterRoom(id) {
      if (room.id && room.id !== id) await leaveRoom(false);
      if (room.id === id && room.phase === 'ready') { showRoomPanel(); return; }
      Object.assign(room, { id, detail: null, phase: 'loading', closedReason: null, members: [], messages: [], requests: [], role: null, joined: false, sheet: null, notice: null, invitedIds: [], chatDraft: '' });
      showRoomPanel();
      renderRoom();
      try {
        const detail = await getRoomDetail();
        if (!detail || detail.status !== 'live') { closeRoom(vrCopy.unavailable); return; }
        const role = await rpc('join_voice_room', { p_room: id });
        if (room.id !== id) { supa.rpc('leave_voice_room', { p_room: id }).then(() => {}, () => {}); return; }
        room.joined = true;
        room.role = role;
        room.detail = Object.assign({}, detail, { my_role: role });
        room.phase = 'ready';
        await Promise.all([refreshMembers(), refreshMessages(), refreshRequests()]);
        subscribeRoom(id);
        clearInterval(room.heartbeat);
        room.heartbeat = setInterval(() => {
          supa.rpc('voice_room_heartbeat', { p_room: id }).then(({ data, error }) => {
            if (!error && data === null && room.joined && room.id === id) closeForMissingSelf();
          }, () => {});
        }, HEARTBEAT_MS);
        renderRoom();
        joinAudio(detail.channel_name, isOnStage(role));
      } catch (error) {
        closeRoom(errorText(error, vrCopy.unavailable));
      }
    }

    function subscribeRoom(id) {
      if (room.channel) { try { supa.removeChannel(room.channel); } catch (_) {} }
      const filter = 'room_id=eq.' + id;
      room.channel = supa.channel('voice-room-' + id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_rooms', filter: 'id=eq.' + id }, () => {
          getRoomDetail().then((next) => {
            if (!next || next.status === 'ended') closeRoom(vrCopy.roomEnded);
            else { room.detail = next; renderRoom(); }
          }, () => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_members', filter }, () => refreshMembers())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_speaking_requests', filter }, () => { refreshRequests(); refreshMembers(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_room_messages', filter }, () => refreshMessages())
        .subscribe();
    }

    function stopRoomSync() {
      clearInterval(room.heartbeat);
      room.heartbeat = null;
      if (room.channel) { try { supa.removeChannel(room.channel); } catch (_) {} room.channel = null; }
    }

    async function closeForMissingSelf() {
      try {
        const detail = await getRoomDetail();
        closeRoom(!detail || detail.status === 'ended' ? vrCopy.roomEnded : vrCopy.removed);
      } catch (_) {
        closeRoom(vrCopy.removed);
      }
    }

    function closeRoom(reason) {
      if (room.phase === 'closed') return;
      room.phase = 'closed';
      room.closedReason = reason;
      room.joined = false;
      room.sheet = null;
      stopRoomSync();
      leaveAudio();
      renderRoom();
      renderMiniBar();
    }

    async function leaveRoom(backToList) {
      const id = room.id;
      const wasJoined = room.joined;
      room.joined = false;
      stopRoomSync();
      leaveAudio();
      if (id && wasJoined) await supa.rpc('leave_voice_room', { p_room: id }).then(() => {}, () => {});
      Object.assign(room, { id: null, detail: null, phase: 'idle', members: [], messages: [], requests: [], role: null, sheet: null });
      renderMiniBar();
      if (backToList !== false) { renderVoiceRooms(); loadRooms(); }
    }

    async function runAction(action, success) {
      try {
        await action();
        if (success) flash(success);
        return true;
      } catch (error) {
        flash(errorText(error, vrCopy.errorGeneric));
        return false;
      }
    }

    // ── audio (Agora Web SDK, same vendor build as live.html) ───────────────
    let agoraLoading = null;
    function loadAgora() {
      if (window.AgoraRTC) return Promise.resolve(window.AgoraRTC);
      if (agoraLoading) return agoraLoading;
      agoraLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = AGORA_SDK_SRC;
        script.onload = () => (window.AgoraRTC ? resolve(window.AgoraRTC) : reject(new Error('Agora SDK missing')));
        script.onerror = () => { agoraLoading = null; reject(new Error('Agora SDK failed to load')); };
        document.head.appendChild(script);
      });
      return agoraLoading;
    }

    async function fetchToken(role) {
      const { data, error } = await supa.functions.invoke('agora-token', { body: { channelName: audio.channelName, role } });
      if (error || !data?.token) throw error || new Error('No token');
      return data;
    }

    async function joinAudio(channelName, asSpeaker) {
      audio.channelName = channelName;
      audio.status = 'joining';
      audio.error = null;
      renderRoom();
      let AgoraRTC;
      try {
        AgoraRTC = await loadAgora();
        if (AgoraRTC.checkSystemRequirements && !AgoraRTC.checkSystemRequirements()) throw new Error('unsupported');
      } catch (_) {
        audio.status = 'unavailable';
        renderRoom();
        return;
      }
      if (room.channel === null || audio.channelName !== channelName) return;
      try {
        const tokenRole = asSpeaker ? 'publisher' : 'subscriber';
        const token = await fetchToken(tokenRole);
        audio.tokenRole = tokenRole;
        audio.appId = token.appId || AGORA_FALLBACK_APP_ID;
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        audio.client = client;
        await client.setClientRole(asSpeaker ? 'host' : 'audience');
        client.on('user-published', async (remoteUser, mediaType) => {
          if (mediaType !== 'audio') return;
          try {
            await client.subscribe(remoteUser, mediaType);
            remoteUser.audioTrack?.play();
          } catch (_) {
            audio.blocked.push(remoteUser);
            renderRoom();
          }
        });
        client.on('token-privilege-will-expire', () => renewToken());
        client.on('token-privilege-did-expire', () => renewToken());
        client.on('connection-state-change', (state, prev, reason) => {
          if (state === 'DISCONNECTED' && reason && reason !== 'LEAVE' && audio.client === client) {
            audio.status = 'error';
            audio.error = 'Audio connection lost (' + reason + ').';
            renderRoom();
          }
        });
        client.enableAudioVolumeIndicator();
        client.on('volume-indicator', (volumes) => {
          const next = new Set((volumes || []).filter((item) => item.level > 5).map((item) => Number(item.uid) || 0));
          if (audio.micEnabled && next.has(0)) next.add(Number(token.uid) || 0);
          const changed = next.size !== audio.speakingUids.size || Array.from(next).some((uid) => !audio.speakingUids.has(uid));
          audio.speakingUids = next;
          if (changed) updateSpeakingRings();
        });
        AgoraRTC.onAutoplayFailed = () => { audio.blocked.push({ resume: true }); renderRoom(); };
        await client.join(audio.appId, channelName, token.token, Number(token.uid) || null);
        if (audio.client !== client) { client.leave().catch(() => {}); return; }
        audio.status = 'joined';
        audio.isPublisher = asSpeaker;
        if (asSpeaker) await publishMic(false);
      } catch (error) {
        audio.status = 'error';
        audio.error = errorText(error, vrCopy.errorGeneric);
      }
      renderRoom();
    }

    async function publishMic(enabled) {
      const client = audio.client;
      if (!client || !window.AgoraRTC) return;
      try {
        if (!audio.micTrack) audio.micTrack = await window.AgoraRTC.createMicrophoneAudioTrack({ AEC: true, AGC: true, ANS: true });
        await audio.micTrack.setEnabled(enabled);
        await client.publish([audio.micTrack]);
        audio.micEnabled = enabled;
      } catch (error) {
        audio.micEnabled = false;
        audio.error = /permission|NotAllowed/i.test(String(error?.name || error?.message || '')) ? vrCopy.micBlocked : errorText(error, vrCopy.errorGeneric);
      }
    }

    async function renewToken() {
      const client = audio.client;
      if (!client) return;
      try {
        const token = await fetchToken(audio.tokenRole);
        await client.renewToken(token.token);
      } catch (_) {
        if (audio.tokenRole === 'publisher') {
          // No longer allowed to speak: drop to audience and keep listening.
          await goAudience();
          try {
            const token = await fetchToken('subscriber');
            await client.renewToken(token.token);
            return;
          } catch (_) { /* not even a listener anymore */ }
        }
        leaveAudio();
        if (room.joined) closeForMissingSelf();
      }
    }

    async function goAudience() {
      const client = audio.client;
      if (audio.micTrack) {
        try { if (client) await client.unpublish([audio.micTrack]); } catch (_) {}
        audio.micTrack.close();
        audio.micTrack = null;
      }
      try { if (client) await client.setClientRole('audience'); } catch (_) {}
      audio.tokenRole = 'subscriber';
      audio.isPublisher = false;
      audio.micEnabled = false;
    }

    async function promoteToSpeaker() {
      const client = audio.client;
      if (!client || audio.status !== 'joined') return;
      try {
        const token = await fetchToken('publisher');
        await client.renewToken(token.token);
        audio.tokenRole = 'publisher';
        await client.setClientRole('host');
        audio.isPublisher = true;
        await publishMic(false);
      } catch (error) {
        audio.error = errorText(error, vrCopy.errorGeneric);
      }
      renderRoom();
    }

    function demoteToListener() {
      goAudience().then(() => renderRoom());
    }

    async function setMicEnabled(enabled) {
      if (!audio.isPublisher) return;
      if (!audio.micTrack) await publishMic(enabled);
      else {
        try { await audio.micTrack.setEnabled(enabled); audio.micEnabled = enabled; } catch (error) { audio.error = errorText(error, vrCopy.errorGeneric); }
      }
      renderRoom();
    }

    function leaveAudio() {
      const client = audio.client;
      audio.client = null;
      if (audio.micTrack) { try { audio.micTrack.close(); } catch (_) {} audio.micTrack = null; }
      if (client) client.leave().catch(() => {});
      Object.assign(audio, { status: 'idle', error: null, isPublisher: false, micEnabled: false, speakingUids: new Set(), channelName: null, tokenRole: 'subscriber', blocked: [] });
    }

    function resumeBlockedAudio() {
      const blocked = audio.blocked;
      audio.blocked = [];
      blocked.forEach((remoteUser) => { try { remoteUser.audioTrack?.play(); } catch (_) {} });
      if (audio.client) audio.client.remoteUsers.forEach((remoteUser) => { try { remoteUser.audioTrack?.play(); } catch (_) {} });
      renderRoom();
    }

    function speakingIds() {
      const ids = new Set();
      room.members.forEach((member) => { if (audio.speakingUids.has(agoraUidForUser(member.user_id))) ids.add(member.user_id); });
      return ids;
    }
    function updateSpeakingRings() {
      const ids = speakingIds();
      document.querySelectorAll('#voiceRoomsView [data-vr-member]').forEach((node) => {
        node.classList.toggle('speaking', ids.has(node.dataset.vrMember));
      });
    }

    // ── room rendering ───────────────────────────────────────────────────────
    function memberName(member) {
      return member.user_id === userId() ? vrCopy.you : (member.full_name || 'DUVELA');
    }

    function memberActions(member) {
      const actions = [];
      if (!member || member.user_id === userId()) return actions;
      const isOwner = room.role === 'owner';
      const canModerate = isOwner || (room.role === 'moderator' && member.role !== 'moderator');
      if (member.role !== 'owner') {
        if (isOwner && member.role !== 'moderator') actions.push(['makeModerator', vrCopy.makeModerator]);
        if (isOwner && member.role === 'moderator') actions.push(['removeModerator', vrCopy.removeModerator]);
        if (canModerate && member.role === 'listener') actions.push(['inviteToStage', vrCopy.inviteToStage]);
        if (canModerate && member.role === 'speaker') actions.push(['moveToListeners', vrCopy.moveToListeners]);
        if (canModerate) { actions.push(['remove', vrCopy.remove, true]); actions.push(['ban', vrCopy.ban, true]); }
      }
      actions.push(['report', vrCopy.report]);
      return actions;
    }

    function renderSheet() {
      if (!room.sheet) return '';
      let title = '';
      let body = '';
      if (room.sheet === 'requests') {
        title = vrCopy.requestsTitle;
        body = room.requests.length
          ? room.requests.map((request) => '<div class="sp-sheet-row">' + avatar(request.full_name, request.avatar_url, 'sm') + '<b>' + esc(request.full_name || 'DUVELA') + '</b>' +
              '<button type="button" class="sp-btn ghost sm" data-vr-decide="' + esc(request.id) + '" data-approve="0">' + esc(vrCopy.decline) + '</button>' +
              '<button type="button" class="sp-btn primary vr sm" data-vr-decide="' + esc(request.id) + '" data-approve="1">' + esc(vrCopy.approve) + '</button></div>').join('')
          : '<p class="sp-muted">' + esc(vrCopy.noRequests) + '</p>';
      } else if (room.sheet === 'member') {
        const member = room.members.find((item) => item.user_id === room.sheetData) || null;
        title = member ? (member.full_name || 'DUVELA') : 'DUVELA';
        body = (member ? '<p class="sp-muted">' + esc(vrCopy.roles[member.role] || member.role) + '</p>' : '') +
          memberActions(member).map((action) => '<button type="button" class="sp-sheet-option' + (action[2] ? ' danger' : '') + '" data-vr-member-action="' + action[0] + '">' + esc(action[1]) + '</button>').join('');
      } else if (room.sheet === 'report') {
        title = vrCopy.reportTitle;
        body = REPORT_REASONS.map((reason) => '<button type="button" class="sp-sheet-option" data-vr-report="' + reason + '">' + esc(vrCopy.reasons[reason]) + '</button>').join('');
      } else if (room.sheet === 'invite') {
        title = vrCopy.inviteTitle;
        body = '<input class="sp-input" data-vr-invite-search placeholder="' + esc(vrCopy.invitePlaceholder) + '" value="' + esc(room.inviteQuery) + '">' +
          '<div class="sp-invite-list">' + room.inviteResults.map((profile) => {
            const invited = room.invitedIds.includes(profile.id);
            return '<div class="sp-sheet-row">' + avatar(profile.full_name, profile.avatar_url, 'sm') + '<b>' + esc(profile.full_name || 'DUVELA') + '</b>' +
              '<button type="button" class="sp-btn ' + (invited ? 'ghost' : 'primary vr') + ' sm" data-vr-invite="' + esc(profile.id) + '"' + (invited ? ' disabled' : '') + '>' + (invited ? '✓' : esc(vrCopy.invite)) + '</button></div>';
          }).join('') + '</div>';
      } else if (room.sheet === 'end') {
        title = vrCopy.confirmEnd;
        body = '<button type="button" class="sp-sheet-option danger" data-vr-end-confirm>' + esc(vrCopy.endRoom) + '</button>';
      } else if (room.sheet === 'chat') {
        title = vrCopy.chatTitle;
        body = '<div class="sp-chat-list" data-vr-chat-list>' + (room.messages.length ? room.messages.map((message) =>
            '<div class="sp-bubble' + (message.user_id === userId() ? ' mine' : '') + '"><small>' + esc(message.user_id === userId() ? vrCopy.you : (message.full_name || 'DUVELA')) + '</small><p>' + esc(message.body) + '</p></div>').join('')
            : '<p class="sp-muted">' + esc(vrCopy.noMessages) + '</p>') + '</div>' +
          '<form class="sp-chat-form" data-vr-chat-form><input class="sp-input" data-vr-chat-input maxlength="500" placeholder="' + esc(vrCopy.chatPlaceholder) + '" value="' + esc(room.chatDraft) + '"><button type="submit" class="sp-btn primary vr">' + esc(vrCopy.send) + '</button></form>';
      }
      return '<div class="sp-sheet-backdrop" data-vr-sheet-close></div><div class="sp-sheet' + (room.sheet === 'chat' ? ' chat' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="sp-sheet-head"><h3>' + esc(title) + '</h3><button type="button" class="sp-icon-btn" data-vr-sheet-close aria-label="' + esc(vrCopy.cancel) + '">×</button></div>' + body + '</div>';
    }

    function renderRoom() {
      const host = vrHost();
      if (!host || !room.id) return;
      // Keep focus + caret in inputs that live inside the sheet across re-renders.
      const active = document.activeElement;
      const focusKey = active && host.contains(active) ? (active.matches('[data-vr-chat-input]') ? '[data-vr-chat-input]' : active.matches('[data-vr-invite-search]') ? '[data-vr-invite-search]' : null) : null;
      const caret = focusKey ? active.selectionStart : null;
      if (room.phase === 'closed') {
        host.innerHTML = '<div class="sp-page sp-vr"><div class="sp-card sp-empty"><span>🔇</span><b>' + esc(room.closedReason || vrCopy.unavailable) + '</b>' +
          '<button type="button" class="sp-btn primary vr" data-vr-back>' + esc(vrCopy.back) + '</button></div></div>';
        return;
      }
      if (room.phase !== 'ready' || !room.detail) {
        host.innerHTML = '<div class="sp-page sp-vr"><div class="sp-loading"><span class="sp-spinner"></span></div></div>';
        return;
      }
      const d = room.detail;
      const mine = me();
      const speakers = room.members.filter((member) => isOnStage(member.role));
      const listeners = room.members.filter((member) => member.role === 'listener');
      const talking = speakingIds();
      const lastMessage = room.messages[room.messages.length - 1] || null;
      const audioHint = audio.status === 'unavailable' ? vrCopy.audioUnavailable : audio.status === 'joining' ? vrCopy.connecting : audio.error;
      const memberTile = (member, big) => '<button type="button" class="sp-member' + (big ? ' big' : '') + (talking.has(member.user_id) ? ' speaking' : '') + '" data-vr-member="' + esc(member.user_id) + '">' +
        '<span class="sp-member-avatar">' + avatar(member.full_name, member.avatar_url, big ? 'lg' : '') + (member.hand_raised ? '<i class="sp-hand">✋</i>' : '') + '</span>' +
        '<b>' + esc(memberName(member)) + '</b>' + (big ? '<small>' + esc(vrCopy.roles[member.role] || member.role) + '</small>' : '') + '</button>';
      host.innerHTML = '<div class="sp-page sp-vr"><section class="sp-card sp-room">' +
        '<header class="sp-room-head"><button type="button" class="sp-icon-btn" data-vr-back aria-label="' + esc(vrCopy.back) + '">←</button>' +
          '<div><h2>' + esc(d.title) + '</h2><p>👥 ' + esc(vrCopy.participantsLine(room.members.length, speakers.length)) + ' · ' + esc(languageLabel(d.language)) + '</p></div>' +
          '<span class="sp-live">' + esc(vrCopy.live) + '</span></header>' +
        (isModerator() ? '<div class="sp-mod-row"><button type="button" class="sp-pill" data-vr-sheet="requests">✋ ' + esc(vrCopy.requestsTitle) + (room.requests.length ? ' <em>' + room.requests.length + '</em>' : '') + '</button>' +
          '<button type="button" class="sp-pill" data-vr-sheet="invite">＋ ' + esc(vrCopy.invite) + '</button>' +
          (room.role === 'owner' ? '<button type="button" class="sp-pill danger" data-vr-sheet="end">■ ' + esc(vrCopy.endRoom) + '</button>' : '') + '</div>' : '') +
        (room.notice ? '<p class="sp-notice" role="status">' + esc(room.notice) + '</p>' : '') +
        (audioHint ? '<p class="sp-audio-hint">' + esc(audioHint) + '</p>' : '') +
        (audio.blocked.length ? '<button type="button" class="sp-btn light sm" data-vr-resume>🔊 ' + esc(vrCopy.tapToHear) + '</button>' : '') +
        (d.topic || d.level_min || d.level_max ? '<div class="sp-topic">' + (d.topic ? '<b>' + esc(vrCopy.topic) + ': ' + esc(d.topic) + '</b>' : '') +
          (d.level_min || d.level_max ? '<span>' + esc(vrCopy.levelLine(d.level_min, d.level_max)) + '</span>' : '') + '</div>' : '') +
        '<div class="sp-stage">' + speakers.map((member) => memberTile(member, true)).join('') + '</div>' +
        (listeners.length ? '<h4 class="sp-section-title">' + esc(vrCopy.listenersTitle(listeners.length)) + '</h4><div class="sp-listeners">' + listeners.map((member) => memberTile(member, false)).join('') + '</div>' : '') +
        '<button type="button" class="sp-last-message" data-vr-sheet="chat">💬 <span>' + esc(lastMessage ? (lastMessage.full_name || 'DUVELA') + ': ' + lastMessage.body : vrCopy.noMessages) + '</span>›</button>' +
        '<nav class="sp-bar">' +
          '<button type="button" class="sp-bar-btn' + (audio.micEnabled ? ' active' : '') + '" data-vr-mic' + (isOnStage(room.role) && audio.isPublisher ? '' : ' disabled') + '><span>' + (audio.micEnabled ? '🎙' : '🔇') + '</span>' + esc(vrCopy.mic) + '</button>' +
          '<button type="button" class="sp-bar-btn' + (mine?.hand_raised ? ' active' : '') + '" data-vr-hand' + (room.role === 'listener' ? '' : ' disabled') + '><span>✋</span>' + esc(mine?.hand_raised ? vrCopy.handRaised : vrCopy.raiseHand) + '</button>' +
          '<button type="button" class="sp-bar-btn" data-vr-sheet="chat"><span>💬</span>' + esc(vrCopy.chat) + '</button>' +
          '<button type="button" class="sp-bar-btn leave" data-vr-leave><span>⎋</span>' + esc(vrCopy.leave) + '</button>' +
        '</nav></section>' + renderSheet() + '</div>';
      const chatList = host.querySelector('[data-vr-chat-list]');
      if (chatList) chatList.scrollTop = chatList.scrollHeight;
      if (focusKey) {
        const input = host.querySelector(focusKey);
        if (input) { input.focus(); if (caret != null) input.setSelectionRange(caret, caret); }
      }
    }

    let inviteTimer = null;
    function searchInvitees() {
      clearTimeout(inviteTimer);
      inviteTimer = setTimeout(async () => {
        try {
          const { data, error } = await supa.rpc('search_chat_profiles', { result_limit: 20, search_text: room.inviteQuery });
          if (error) throw error;
          room.inviteResults = (data || []).filter((profile) => profile.id !== userId());
        } catch (_) { /* keep last results */ }
        if (room.sheet === 'invite') renderRoom();
      }, 250);
    }

    function openSheet(name, data) {
      room.sheet = name;
      room.sheetData = data || null;
      if (name === 'invite') { room.inviteQuery = ''; room.inviteResults = []; searchInvitees(); }
      if (name === 'requests') refreshRequests();
      renderRoom();
      const focusTarget = document.querySelector('#voiceRoomsView .sp-sheet input, #voiceRoomsView .sp-sheet button');
      if (focusTarget) focusTarget.focus();
    }

    async function onMemberAction(action) {
      const targetId = room.sheetData;
      if (action === 'report') { room.sheet = 'report'; renderRoom(); return; }
      room.sheet = null;
      renderRoom();
      await runAction(async () => {
        if (action === 'makeModerator') await rpc('set_voice_room_member_role', { p_room: room.id, p_user: targetId, p_role: 'moderator' });
        if (action === 'removeModerator' || action === 'inviteToStage') await rpc('set_voice_room_member_role', { p_room: room.id, p_user: targetId, p_role: 'speaker' });
        if (action === 'moveToListeners') await rpc('set_voice_room_member_role', { p_room: room.id, p_user: targetId, p_role: 'listener' });
        if (action === 'remove') await rpc('kick_voice_room_member', { p_room: room.id, p_user: targetId, p_ban: false, p_reason: null });
        if (action === 'ban') await rpc('kick_voice_room_member', { p_room: room.id, p_user: targetId, p_ban: true, p_reason: null });
        await refreshMembers();
      });
    }

    function bindVoiceRooms() {
      const host = vrHost();
      if (!host) return;
      host.addEventListener('click', (event) => {
        const t = event.target;
        // list + create
        if (t.closest('[data-vr-create]')) {
          vr.createOpen = !vr.createOpen;
          vr.error = null;
          vr.create = vr.createOpen ? { language: vr.filter || profileLanguage() || 'german', title: '', topic: '', levelMin: null, levelMax: null, roomType: 'open' } : null;
          renderVoiceRooms();
          return;
        }
        if (t.closest('[data-vr-create-cancel]')) { vr.createOpen = false; vr.create = null; vr.error = null; renderVoiceRooms(); return; }
        const levelChip = t.closest('[data-vr-level]');
        if (levelChip && vr.create) { const key = levelChip.dataset.vrLevel; vr.create[key] = vr.create[key] === levelChip.dataset.value ? null : levelChip.dataset.value; renderVoiceRooms(); return; }
        const typeChip = t.closest('[data-vr-type]');
        if (typeChip && vr.create) { vr.create.roomType = typeChip.dataset.vrType; renderVoiceRooms(); return; }
        const filter = t.closest('[data-vr-filter]');
        if (filter) { vr.filter = filter.dataset.vrFilter || null; loadRooms(); return; }
        const join = t.closest('[data-vr-join]');
        if (join) { enterRoom(join.dataset.vrJoin); return; }
        // inside a room
        if (t.closest('[data-vr-back]')) {
          if (room.phase === 'closed') { Object.assign(room, { id: null, phase: 'idle' }); renderMiniBar(); renderVoiceRooms(); loadRooms(); }
          else leaveRoom(true);
          return;
        }
        if (t.closest('[data-vr-leave]')) { leaveRoom(true); return; }
        if (t.closest('[data-vr-resume]')) { resumeBlockedAudio(); return; }
        if (t.closest('[data-vr-sheet-close]')) { room.sheet = null; renderRoom(); return; }
        const sheetButton = t.closest('[data-vr-sheet]');
        if (sheetButton) { openSheet(sheetButton.dataset.vrSheet); return; }
        const memberButton = t.closest('[data-vr-member]');
        if (memberButton) {
          const member = room.members.find((item) => item.user_id === memberButton.dataset.vrMember);
          if (member && memberActions(member).length) openSheet('member', member.user_id);
          return;
        }
        const memberAction = t.closest('[data-vr-member-action]');
        if (memberAction) { onMemberAction(memberAction.dataset.vrMemberAction); return; }
        const report = t.closest('[data-vr-report]');
        if (report) {
          const targetId = room.sheetData;
          room.sheet = null;
          runAction(() => rpc('report_voice_room_user', { p_room: room.id, p_user: targetId, p_reason: report.dataset.vrReport, p_details: null }), vrCopy.reportSent);
          return;
        }
        const decide = t.closest('[data-vr-decide]');
        if (decide) {
          decide.disabled = true;
          runAction(async () => {
            await rpc('decide_speak_request', { p_request: decide.dataset.vrDecide, p_approve: decide.dataset.approve === '1' });
            await Promise.all([refreshRequests(), refreshMembers()]);
          });
          return;
        }
        const invite = t.closest('[data-vr-invite]');
        if (invite) {
          const target = invite.dataset.vrInvite;
          invite.disabled = true;
          runAction(() => rpc('invite_to_voice_room', { p_room: room.id, p_user: target }), vrCopy.invited).then((ok) => {
            if (ok) room.invitedIds.push(target);
            renderRoom();
          });
          return;
        }
        if (t.closest('[data-vr-end-confirm]')) {
          room.sheet = null;
          runAction(async () => {
            await rpc('end_voice_room', { p_room: room.id });
            closeRoom(vrCopy.roomEnded);
          });
          return;
        }
        if (t.closest('[data-vr-mic]')) { setMicEnabled(!audio.micEnabled); return; }
        if (t.closest('[data-vr-hand]')) {
          const raised = Boolean(me()?.hand_raised);
          runAction(async () => {
            await rpc(raised ? 'cancel_speak_request' : 'request_to_speak', { p_room: room.id });
            await refreshMembers();
          });
        }
      });
      host.addEventListener('input', (event) => {
        const t = event.target;
        if (t.matches('[data-vr-c]') && vr.create) vr.create[t.dataset.vrC] = t.value;
        if (t.matches('[data-vr-chat-input]')) room.chatDraft = t.value;
        if (t.matches('[data-vr-invite-search]')) { room.inviteQuery = t.value; searchInvitees(); }
      });
      host.addEventListener('change', (event) => {
        if (event.target.matches('select[data-vr-c]') && vr.create) vr.create[event.target.dataset.vrC] = event.target.value;
      });
      host.addEventListener('submit', (event) => {
        if (event.target.matches('[data-vr-create-form]')) { event.preventDefault(); createRoom(); return; }
        if (event.target.matches('[data-vr-chat-form]')) {
          event.preventDefault();
          const body = room.chatDraft.trim();
          if (!body) return;
          room.chatDraft = '';
          runAction(async () => { await rpc('send_voice_room_message', { p_room: room.id, p_body: body }); await refreshMessages(); });
        }
      });
      host.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && room.sheet) { room.sheet = null; renderRoom(); }
      });
    }

    // While connected to a room and browsing other panels, keep a small bar.
    function renderMiniBar() {
      let bar = document.getElementById('voiceRoomMiniBar');
      const show = Boolean(room.id && room.phase === 'ready' && !isPanelActive('voicerooms'));
      if (!show) { if (bar) bar.remove(); return; }
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'voiceRoomMiniBar';
        bar.className = 'sp-mini-bar';
        bar.addEventListener('click', (event) => {
          if (event.target.closest('[data-vr-mini-leave]')) { leaveRoom(false); return; }
          if (event.target.closest('[data-vr-mini-return]')) showRoomPanel();
        });
        document.body.appendChild(bar);
      }
      bar.innerHTML = '<span>🎙</span><div><small>' + esc(vrCopy.inRoom) + '</small><b>' + esc(room.detail?.title || '') + '</b></div>' +
        '<button type="button" class="sp-btn primary vr sm" data-vr-mini-return>' + esc(vrCopy.returnToRoom) + '</button>' +
        '<button type="button" class="sp-btn ghost sm" data-vr-mini-leave>' + esc(vrCopy.leave) + '</button>';
    }

    // ── panel wiring ─────────────────────────────────────────────────────────
    function isPanelActive(name) {
      return Boolean(document.querySelector('.panel[data-panel="' + name + '"].active'));
    }
    function showRoomPanel() {
      if (!isPanelActive('voicerooms')) ctx.setView('voicerooms');
      renderVoiceRooms();
      renderMiniBar();
    }
    function onPanelShown(name) {
      if (name === 'partners') openPartners();
      if (name === 'voicerooms') {
        subscribeRoomList();
        renderVoiceRooms();
        if (!room.id) loadRooms();
      }
      renderMiniBar();
    }
    function watchPanels() {
      ['partners', 'voicerooms'].forEach((name) => {
        const panel = document.querySelector('.panel[data-panel="' + name + '"]');
        if (!panel) return;
        let wasActive = panel.classList.contains('active');
        new MutationObserver(() => {
          const nowActive = panel.classList.contains('active');
          if (nowActive && !wasActive) onPanelShown(name);
          if (!nowActive && wasActive) renderMiniBar();
          wasActive = nowActive;
        }).observe(panel, { attributes: true, attributeFilter: ['class'] });
        if (wasActive) onPanelShown(name);
      });
      document.addEventListener('click', (event) => {
        const open = event.target.closest('[data-social-open]');
        if (!open) return;
        event.preventDefault();
        ctx.setView(open.dataset.socialOpen);
      });
      window.addEventListener('pagehide', () => {
        if (room.id && room.joined) supa.rpc('leave_voice_room', { p_room: room.id }).then(() => {}, () => {});
        leaveAudio();
      });
    }

    let started = false;
    function start() {
      if (started) return;
      started = true;
      bindPartners();
      bindVoiceRooms();
      watchPanels();
      const requestedRoom = new URLSearchParams(window.location.search).get('voice_room');
      if (requestedRoom && /^[0-9a-f-]{36}$/i.test(requestedRoom)) enterRoom(requestedRoom);
    }

    return { cardsHtml, start, enterRoom, openPartners };
  }

  window.DuvelaAppSocialPractice = { create: createSocialPractice };
})();
