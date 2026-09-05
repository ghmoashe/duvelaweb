// Web port of the German Aussprache trainer. Minimal pairs + Fish Audio
// TTS through the fish-audio-tts edge fn. Keeps parity with the mobile
// version on data (same 45-pair bank), Fish playback, category chips,
// pairs/sentences modes, speed toggle, length bar and per-category
// solved-count in localStorage. Mic scoring lives on the mobile screen
// only for now — the browser flow needs its own permission dance.
(function () {
  const CATEGORIES = [
    { id: 'umlaute',            emoji: '🎯', ru: 'Умлауты',              en: 'Umlaute (ä ö ü)' },
    { id: 'lang_kurz',          emoji: '⏱️', ru: 'Долгие / краткие',     en: 'Long vs. short vowels' },
    { id: 'ch',                 emoji: '🌬️', ru: 'ich- vs. ach-Laut',    en: 'ich- vs. ach-Laut' },
    { id: 'r',                  emoji: '🔊', ru: 'Немецкий R',           en: 'German R' },
    { id: 'sch_s_st_sp',        emoji: '🐍', ru: 'sch / s / st / sp',    en: 'sch / s / st / sp' },
    { id: 'auslautverhaertung', emoji: '🎬', ru: 'Оглушение в конце',    en: 'Auslautverhärtung' },
    { id: 'diphthonge',         emoji: '🎵', ru: 'Дифтонги',             en: 'Diphthonge (ei / eu / au)' },
  ];

  // Same 45-pair bank as the mobile trainer, shape flattened to what the
  // web UI needs (text / ipa / example + hint per locale).
  const PAIRS = [
    // umlaute
    { id: 'schon-schoen', cat: 'umlaute', a: { t: 'schon', ipa: '[ʃoːn]', ex: 'Ich bin schon da.' }, b: { t: 'schön', ipa: '[ʃøːn]', ex: 'Das ist schön.' },
      hEn: 'For ö, round your lips like for O but say E inside your mouth.',
      hRu: 'Для ö: губы как на O, а внутри рта говори Э.',
      hAr: 'لنطق ö: قرّب شفتيك كأنك تنطق O، لكن انطق داخل الفم صوت E.' },
    { id: 'fuellen-fahlen', cat: 'umlaute', a: { t: 'fahlen', ipa: '[ˈfaːlən]', ex: 'Die fahlen Farben passen nicht.' }, b: { t: 'fällen', ipa: '[ˈfɛlən]', ex: 'Bäume fällen ist verboten.' },
      hEn: 'For ä, open your mouth as for E but wider.',
      hRu: 'Для ä открывай рот как на Э, но шире.',
      hAr: 'لنطق ä: افتح فمك كما تنطق E، لكن أوسع قليلاً.' },
    { id: 'muede-mode', cat: 'umlaute', a: { t: 'Mode', ipa: '[ˈmoːdə]', ex: 'Die Mode ändert sich.' }, b: { t: 'müde', ipa: '[ˈmyːdə]', ex: 'Ich bin müde.' },
      hEn: 'For ü, whistle position with your lips and say I.',
      hRu: 'Для ü: губы как для свиста, внутри — И.',
      hAr: 'لنطق ü: ضع شفتيك كأنك تصفر، وانطق داخل الفم I.' },
    { id: 'buben-bueben', cat: 'umlaute', a: { t: 'Buben', ipa: '[ˈbuːbn̩]', ex: 'Zwei Buben spielen.' }, b: { t: 'Bühnen', ipa: '[ˈbyːnən]', ex: 'Die Bühnen sind leer.' },
      hEn: 'ü stays close to i — round the lips without changing tongue position.',
      hRu: 'ü ближе к И — округли губы, но язык не двигай.',
      hAr: 'ü قريب من الحرف I — قرّب شفتيك دون تحريك اللسان.' },
    { id: 'ofen-oefen', cat: 'umlaute', a: { t: 'Ofen', ipa: '[ˈoːfn̩]', ex: 'Der Ofen ist warm.' }, b: { t: 'Öfen', ipa: '[ˈøːfn̩]', ex: 'Öfen wärmen das Haus.' },
      hEn: 'Same as schon/schön — round lips, front tongue.',
      hRu: 'То же что schon/schön — губы округлить, язык вперёд.',
      hAr: 'مثل schon/schön — قرّب الشفتين واللسان إلى الأمام.' },
    // lang_kurz
    { id: 'stat-staat', cat: 'lang_kurz', a: { t: 'Stadt', ipa: '[ʃtat]', ex: 'Die Stadt schläft nie.' }, b: { t: 'Staat', ipa: '[ʃtaːt]', ex: 'Der Staat garantiert Schulbildung.' },
      hEn: 'Double letter or -h makes the vowel long. Hold it twice as long.',
      hRu: 'Двойная буква или -h делает гласный долгим — держи вдвое дольше.',
      hAr: 'الحرف المضاعف أو -h يجعل الحرف الصوتي طويلاً — أطِله ضعف المدة.' },
    { id: 'ihn-inn', cat: 'lang_kurz', a: { t: 'ihn', ipa: '[iːn]', ex: 'Ich sehe ihn morgen.' }, b: { t: 'in', ipa: '[ɪn]', ex: 'Ich wohne in Berlin.' },
      hEn: 'ih = long i; single i before consonants = short.',
      hRu: 'ih = долгий И; одна i перед согласной = короткое И.',
      hAr: 'ih = i طويلة؛ حرف i واحد قبل حرف ساكن = i قصيرة.' },
    { id: 'bieten-bitten', cat: 'lang_kurz', a: { t: 'bieten', ipa: '[ˈbiːtn̩]', ex: 'Wir bieten dir Hilfe an.' }, b: { t: 'bitten', ipa: '[ˈbɪtn̩]', ex: 'Wir bitten um Ruhe.' },
      hEn: 'ie is always long; double t after i keeps it short.',
      hRu: 'ie всегда долгое; удвоенное t после i делает короткое.',
      hAr: 'ie تكون دائمًا طويلة؛ وجود tt بعد i يبقيها قصيرة.' },
    { id: 'ofen-offen', cat: 'lang_kurz', a: { t: 'Ofen', ipa: '[ˈoːfn̩]', ex: 'Der Ofen brennt.' }, b: { t: 'offen', ipa: '[ˈɔfn̩]', ex: 'Die Tür ist offen.' },
      hEn: 'Single f = long o; double ff = short.',
      hRu: 'Одна f = долгое о; удвоенная ff = короткое.',
      hAr: 'حرف f واحد = o طويلة؛ ff مضاعفة = o قصيرة.' },
    { id: 'ratten-raten', cat: 'lang_kurz', a: { t: 'raten', ipa: '[ˈraːtn̩]', ex: 'Kannst du mir raten?' }, b: { t: 'Ratten', ipa: '[ˈratn̩]', ex: 'In der U-Bahn sind Ratten.' },
      hEn: 'Same rule again — one t = long a, double t = short.',
      hRu: 'Тот же принцип — одна t = долгое а, удвоенная = короткое.',
      hAr: 'نفس القاعدة — t واحدة = a طويلة، وtt مضاعفة = a قصيرة.' },
    // ch
    { id: 'ich-ach', cat: 'ch', a: { t: 'ich', ipa: '[ɪç]', ex: 'Ich verstehe.' }, b: { t: 'Buch', ipa: '[buːx]', ex: 'Das Buch ist neu.' },
      hEn: 'After e/i/ei/eu → ich-Laut (front, hissing). After a/o/u/au → ach-Laut (back, throaty).',
      hRu: 'После e/i/ei/eu → ich-Laut (шипящий, впереди). После a/o/u/au → ach-Laut (грубый, в глубине).',
      hAr: 'بعد e/i/ei/eu → ich-Laut (خفيف ومصفَّر). بعد a/o/u/au → ach-Laut (من عمق الحلق مثل خ العربية).' },
    { id: 'nicht-nacht', cat: 'ch', a: { t: 'nicht', ipa: '[nɪçt]', ex: 'Ich weiß es nicht.' }, b: { t: 'Nacht', ipa: '[naxt]', ex: 'Gute Nacht.' },
      hEn: 'nicht = light hiss; Nacht = deep throat scrape.',
      hRu: 'nicht = мягкое шипение; Nacht = грубое трение в горле.',
      hAr: 'nicht = صوت خفيف مثل ش المهموسة؛ Nacht = صوت خ عميق من الحلق.' },
    { id: 'moechte-mochten', cat: 'ch', a: { t: 'möchte', ipa: '[ˈmœçtə]', ex: 'Ich möchte Kaffee.' }, b: { t: 'mochten', ipa: '[ˈmɔxtn̩]', ex: 'Sie mochten den Film.' },
      hEn: 'Umlauts push ch to the front — soft ich-Laut.',
      hRu: 'Умлаут «толкает» ch вперёд — мягкий ich-Laut.',
      hAr: 'الأوملاوت يدفع ch إلى الأمام — يصبح ich-Laut ناعمًا.' },
    { id: 'kueche-kuchen', cat: 'ch', a: { t: 'Küche', ipa: '[ˈkʏçə]', ex: 'Die Küche ist sauber.' }, b: { t: 'Kuchen', ipa: '[ˈkuːxn̩]', ex: 'Der Kuchen schmeckt gut.' },
      hEn: 'ü + ch = soft ich-Laut; u + ch = throaty ach-Laut.',
      hRu: 'ü + ch = мягкий ich-Laut; u + ch = грубый ach-Laut.',
      hAr: 'ü + ch = ich-Laut ناعم؛ u + ch = ach-Laut من الحلق.' },
    { id: 'riechen-rauchen', cat: 'ch', a: { t: 'riechen', ipa: '[ˈʁiːçn̩]', ex: 'Ich kann Kaffee riechen.' }, b: { t: 'rauchen', ipa: '[ˈʁaʊxn̩]', ex: 'Hier darf man nicht rauchen.' },
      hEn: 'ie + ch → light hiss; au + ch → back-throat scrape.',
      hRu: 'ie + ch → лёгкое шипение; au + ch → грубое горловое трение.',
      hAr: 'ie + ch → صوت خفيف ناعم؛ au + ch → صوت خ عميق.' },
    // r
    { id: 'rot-tot', cat: 'r', a: { t: 'rot', ipa: '[ʁoːt]', ex: 'Die Ampel ist rot.' }, b: { t: 'tot', ipa: '[toːt]', ex: 'Das Handy ist tot.' },
      hEn: 'German R is uvular — like gargling water at the back of the throat.',
      hRu: 'Немецкий R — увулярный, как булькание в глубине горла.',
      hAr: 'حرف R الألماني حلقي — مثل الغرغرة في مؤخرة الحلق.' },
    { id: 'brot-boot', cat: 'r', a: { t: 'Brot', ipa: '[bʁoːt]', ex: 'Ich esse Brot.' }, b: { t: 'Boot', ipa: '[boːt]', ex: 'Wir kaufen ein Boot.' },
      hEn: 'After a consonant the R is still uvular but often reduced.',
      hRu: 'После согласной R всё ещё увулярный, но часто ослабленный.',
      hAr: 'بعد حرف ساكن يبقى R حلقيًا لكنه غالبًا يضعف قليلاً.' },
    { id: 'vater-vaters', cat: 'r', a: { t: 'Vater', ipa: '[ˈfaːtɐ]', ex: 'Mein Vater kocht heute.' }, b: { t: 'Väter', ipa: '[ˈfɛːtɐ]', ex: 'Junge Väter sind engagiert.' },
      hEn: 'Word-final -er = schwa-r [ɐ], almost like English "uh".',
      hRu: 'В конце слова -er = редуцированное [ɐ], почти как английское «uh».',
      hAr: 'المقطع -er في نهاية الكلمة يُنطق [ɐ]، قريب من "أَ" الخفيفة.' },
    { id: 'rat-tat', cat: 'r', a: { t: 'Rat', ipa: '[ʁaːt]', ex: 'Ich brauche einen Rat.' }, b: { t: 'tat', ipa: '[taːt]', ex: 'Er tat mir leid.' },
      hEn: 'Word-initial R is the classic gargle. T stays crisp on the alveolar ridge.',
      hRu: 'В начале слова R — тот самый «гортанный»; T — чёткий кончиком языка.',
      hAr: 'R في بداية الكلمة تُنطق من الحلق كالغرغرة؛ T تبقى واضحة بطرف اللسان.' },
    { id: 'reise-meise', cat: 'r', a: { t: 'Reise', ipa: '[ˈʁaɪzə]', ex: 'Gute Reise!' }, b: { t: 'Meise', ipa: '[ˈmaɪzə]', ex: 'Die Meise singt.' },
      hEn: 'Compare the German gargle-R with a normal M. The rest of the word is identical.',
      hRu: 'Сравни гортанный R с обычным M — остальная часть слова одинакова.',
      hAr: 'قارن R الحلقية بحرف M العادي — بقية الكلمة متطابقة.' },
    // sch_s_st_sp
    { id: 'sonne-schonne', cat: 'sch_s_st_sp', a: { t: 'Sonne', ipa: '[ˈzɔnə]', ex: 'Die Sonne scheint.' }, b: { t: 'Schonen', ipa: '[ˈʃoːnən]', ex: 'Wir müssen die Ressourcen schonen.' },
      hEn: 'Initial s before vowel = /z/ (voiced). sch = /ʃ/ like English SH.',
      hRu: 'Начальное s перед гласной = /z/ (звонкое). sch = /ʃ/ как английское SH.',
      hAr: 's في بداية الكلمة قبل حرف علة = /z/ مثل ز؛ sch = /ʃ/ مثل ش.' },
    { id: 'stein-shtein', cat: 'sch_s_st_sp', a: { t: 'Stein', ipa: '[ʃtaɪn]', ex: 'Der Stein ist schwer.' }, b: { t: 'Bein', ipa: '[baɪn]', ex: 'Mein Bein tut weh.' },
      hEn: 'st- and sp- at word start = "SHT" / "SHP" — always sch sound before t/p.',
      hRu: 'st- и sp- в начале слова = «ШТ» / «ШП» — всегда sch перед t/p.',
      hAr: 'st- وsp- في بداية الكلمة تُنطق «شت» و«شب» — دائمًا ش قبل t/p.' },
    { id: 'kirsche-kirche', cat: 'sch_s_st_sp', a: { t: 'Kirsche', ipa: '[ˈkɪʁʃə]', ex: 'Die Kirsche ist rot.' }, b: { t: 'Kirche', ipa: '[ˈkɪʁçə]', ex: 'Die Kirche ist alt.' },
      hEn: 'sch is broad /ʃ/. ch after i/e is narrow /ç/ — feel the air point forward.',
      hRu: 'sch — широкое /ʃ/. ch после i/e — узкое /ç/, воздух идёт вперёд.',
      hAr: 'sch صوت /ʃ/ واسع. أما ch بعد i/e فهو /ç/ ضيّق — الهواء يخرج من الأمام.' },
    { id: 'wasser-waschen', cat: 'sch_s_st_sp', a: { t: 'Wasser', ipa: '[ˈvasɐ]', ex: 'Ich trinke Wasser.' }, b: { t: 'waschen', ipa: '[ˈvaʃn̩]', ex: 'Ich waschen die Hände.' },
      hEn: 'ss between vowels = short /s/. sch = /ʃ/.',
      hRu: 'ss между гласными = короткое /s/. sch = /ʃ/.',
      hAr: 'ss بين حرفين علة = /s/ قصيرة. sch = /ʃ/.' },
    { id: 'strasse-strafe', cat: 'sch_s_st_sp', a: { t: 'Straße', ipa: '[ˈʃtʁaːsə]', ex: 'Die Straße ist leer.' }, b: { t: 'Strafe', ipa: '[ˈʃtʁaːfə]', ex: 'Er muss eine Strafe zahlen.' },
      hEn: 'Both start SHTR. ß = a single sharp s (never a z sound).',
      hRu: 'Оба начинаются на ШТР. ß = один чёткий «с» (никогда не «з»).',
      hAr: 'الاثنان يبدآن بـ ШТР. الحرف ß = س قوية واحدة (ليست ز).' },
    // auslautverhaertung
    { id: 'lieb-lieben', cat: 'auslautverhaertung', a: { t: 'Liebe', ipa: '[ˈliːbə]', ex: 'Liebe zu einem Menschen.' }, b: { t: 'lieb', ipa: '[liːp]', ex: 'Sei lieb zu deinem Bruder.' },
      hEn: 'b/d/g at the end of a word become p/t/k. -e ending keeps them soft.',
      hRu: 'b/d/g в конце слова = p/t/k. Окончание -e сохраняет их звонкими.',
      hAr: 'الحروف b/d/g في نهاية الكلمة تُنطق p/t/k. النهاية -e تحافظ على الحرف مجهورًا.' },
    { id: 'tag-tage', cat: 'auslautverhaertung', a: { t: 'Tag', ipa: '[taːk]', ex: 'Guten Tag!' }, b: { t: 'Tage', ipa: '[ˈtaːɡə]', ex: 'Zwei Tage später kam er.' },
      hEn: 'Tag ends in T sound; Tage brings back the G.',
      hRu: 'Tag звучит как «так»; Tage возвращает звук «г».',
      hAr: 'Tag تُنطق «تاك» بحرف T في النهاية؛ Tage تعيد صوت G.' },
    { id: 'kind-kinder', cat: 'auslautverhaertung', a: { t: 'Kind', ipa: '[kɪnt]', ex: 'Das Kind schläft.' }, b: { t: 'Kinder', ipa: '[ˈkɪndɐ]', ex: 'Die Kinder spielen.' },
      hEn: 'Same rule — d → t at word end, d in the middle keeps its voice.',
      hRu: 'Тот же принцип — d → t в конце слова; в середине сохраняет звонкость.',
      hAr: 'نفس القاعدة — d تصير t في نهاية الكلمة؛ وفي الوسط تبقى مجهورة.' },
    { id: 'weg-wege', cat: 'auslautverhaertung', a: { t: 'Weg', ipa: '[veːk]', ex: 'Der Weg ist frei.' }, b: { t: 'Wege', ipa: '[ˈveːɡə]', ex: 'Es gibt viele Wege.' },
      hEn: 'Word-final g devoices to k. Attach a vowel ending and it recovers.',
      hRu: 'g в конце оглушается до k. Добавь гласное окончание — звонкость вернётся.',
      hAr: 'g في نهاية الكلمة تصبح k. أضف نهاية بحرف علة — يعود الصوت المجهور.' },
    { id: 'freund-freunde', cat: 'auslautverhaertung', a: { t: 'Freund', ipa: '[fʁɔɪnt]', ex: 'Mein Freund kommt.' }, b: { t: 'Freunde', ipa: '[ˈfʁɔɪndə]', ex: 'Zwei Freunde warten.' },
      hEn: 'Same d → t rule with a diphthong before it.',
      hRu: 'То же правило d → t, но с дифтонгом перед ним.',
      hAr: 'نفس قاعدة d → t لكن مع صوت مركّب قبلها.' },
    // diphthonge
    { id: 'ei-eu', cat: 'diphthonge', a: { t: 'Wein', ipa: '[vaɪn]', ex: 'Ein Glas Wein bitte.' }, b: { t: 'weinen', ipa: '[ˈvaɪnən]', ex: 'Kinder weinen manchmal.' },
      hEn: 'ei = ай (like English "aye"). Not the same as ie (long i).',
      hRu: 'ei = «ай» (как англ. "aye"). НЕ то же что ie (долгое И).',
      hAr: 'ei تُنطق «آي» مثل aye الإنجليزية. ليست مثل ie (i طويلة).' },
    { id: 'heute-haeute', cat: 'diphthonge', a: { t: 'heute', ipa: '[ˈhɔɪtə]', ex: 'Heute ist Freitag.' }, b: { t: 'Häute', ipa: '[ˈhɔɪtə]', ex: 'Diese Häute sind wertvoll.' },
      hEn: 'eu and äu sound identical: /ɔɪ/ (English "oy").',
      hRu: 'eu и äu звучат одинаково: /ɔɪ/ (как англ. "oy").',
      hAr: 'eu وäu تُنطقان بنفس الصوت: /ɔɪ/ («أوي»).' },
    { id: 'kaufen-koennen', cat: 'diphthonge', a: { t: 'kaufen', ipa: '[ˈkaʊfən]', ex: 'Wir kaufen Obst.' }, b: { t: 'können', ipa: '[ˈkœnən]', ex: 'Wir können nicht.' },
      hEn: 'au = "ow" (as in "cow"). ö = umlaut, different vowel entirely.',
      hRu: 'au = «ау» (как cow). ö = умлаут, совсем другой гласный.',
      hAr: 'au تُنطق «آو» مثل cow. أما ö فهي أوملاوت — صوت مختلف تمامًا.' },
    { id: 'baum-boot', cat: 'diphthonge', a: { t: 'Baum', ipa: '[baʊm]', ex: 'Der Baum ist alt.' }, b: { t: 'Boot', ipa: '[boːt]', ex: 'Wir fahren Boot.' },
      hEn: 'au is a real glide from A to U. oo is a single held o.',
      hRu: 'au — настоящий скольз от А к У. oo — единый долгий О.',
      hAr: 'au حركة انزلاقية من A إلى U. أما oo فهو صوت O واحد طويل.' },
    { id: 'frei-freu', cat: 'diphthonge', a: { t: 'frei', ipa: '[fʁaɪ]', ex: 'Ich habe heute frei.' }, b: { t: 'freu', ipa: '[fʁɔɪ]', ex: 'Ich freu mich.' },
      hEn: 'ei glides toward I (like English "eye"). eu glides toward Y (like English "oy").',
      hRu: 'ei скользит к И («eye»). eu скользит к Й («oy»).',
      hAr: 'ei تنزلق نحو صوت I (مثل eye). eu تنزلق نحو Y (مثل oy).' },
  ];

  const COPY = {
    en: { pageTitle: 'Pronunciation drill', play: 'Play', pairs: 'Pairs', sentences: 'Sentences', hint: 'Hint', next: 'Next pair', joinFirst: 'Sign in to play the audio.', footnote: (n) => `${n} minimal pairs in 7 categories. Mistakes do not lower your score — take your time.` },
    ru: { pageTitle: 'Тренажёр произношения', play: 'Прослушать', pairs: 'Пары', sentences: 'Предложения', hint: 'Подсказка', next: 'Следующая пара', joinFirst: 'Войдите, чтобы слушать.', footnote: (n) => `${n} минимальных пар в 7 категориях. Ошибки не наказываются — тренируйся спокойно.` },
    de: { pageTitle: 'Aussprachetraining', play: 'Abspielen', pairs: 'Wortpaare', sentences: 'Sätze', hint: 'Hinweis', next: 'Nächstes Paar', joinFirst: 'Zum Abspielen bitte anmelden.', footnote: (n) => `${n} Minimalpaare in 7 Kategorien. Fehler kosten keine Punkte — nimm dir Zeit.` },
    ar: { pageTitle: 'تدريب النطق', play: 'تشغيل', pairs: 'أزواج الكلمات', sentences: 'جمل', hint: 'تلميح', next: 'الزوج التالي', joinFirst: 'سجّل الدخول لتشغيل الصوت.', footnote: (n) => `${n} زوجًا صوتيًا في 7 فئات. الأخطاء لا تنقص النتيجة — تدرّب بهدوء.` },
  };

  function pickLocale() {
    const nav = (navigator.language || 'en').toLowerCase().split('-')[0];
    if (COPY[nav]) return nav;
    return 'en';
  }
  const locale = pickLocale();
  const t = COPY[locale];
  if (document.documentElement) {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }
  const pageTitleEl = document.getElementById('pageTitle');
  if (pageTitleEl) pageTitleEl.textContent = t.pageTitle;
  const footnoteEl = document.getElementById('footnote');
  if (footnoteEl) footnoteEl.textContent = t.footnote(PAIRS.length);

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function pickHint(pair) {
    if (locale === 'ru') return pair.hRu;
    if (locale === 'ar') return pair.hAr || pair.hEn;
    return pair.hEn;
  }

  function estimateVowelLengthUnits(ipa) {
    if (!ipa) return 0;
    const longMarks = (ipa.match(/ː/g) || []).length;
    if (longMarks > 0) return 3 + Math.min(longMarks - 1, 2);
    return /[aeiouyøœɛɪʊɔäöüɐæɑ]/i.test(ipa) ? 1 : 0;
  }

  // ── Supabase / Fish Audio ───────────────────────────────────────────────
  const config = window.DuvelaWebConfig || {};
  const supa = typeof config.createSupabaseClient === 'function' ? config.createSupabaseClient() : null;
  const audioCache = new Map();

  async function fetchFishAudioBlob(body) {
    const base = String(config.supabaseUrl || '').replace(/\/+$/, '');
    if (!base || !supa) throw new Error('Supabase is not configured.');
    const session = await supa.auth.getSession();
    const accessToken = session?.data?.session?.access_token;
    if (!accessToken) throw new Error('Sign in first.');
    const response = await fetch(base + '/functions/v1/fish-audio-tts', {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey || '',
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let message = '';
      try { message = (await response.text()).slice(0, 200); } catch {}
      throw new Error((message || 'Fish Audio failed') + ' (' + response.status + ')');
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('Empty audio');
    return blob;
  }

  let activeAudio = null;
  async function speak(text, speed) {
    const cacheKey = text + '::' + speed;
    let url = audioCache.get(cacheKey);
    if (!url) {
      const blob = await fetchFishAudioBlob({
        action: 'speak',
        text,
        languageCode: 'de',
        rate: speed,
      });
      url = URL.createObjectURL(blob);
      audioCache.set(cacheKey, url);
    }
    if (activeAudio) { try { activeAudio.pause(); } catch {} }
    const audio = new Audio(url);
    activeAudio = audio;
    audio.playbackRate = 1; // rate already baked in by Fish
    await audio.play();
    return audio;
  }

  // ── Progress in localStorage ────────────────────────────────────────────
  const STORAGE_KEY = 'duvela.aussprache.web.v1';
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { solved: new Set(Array.isArray(parsed.solved) ? parsed.solved : []), streak: Array.isArray(parsed.streak) ? parsed.streak : [] };
    } catch {
      return { solved: new Set(), streak: [] };
    }
  }
  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ solved: Array.from(progress.solved), streak: progress.streak }));
    } catch {}
  }

  // ── App state ───────────────────────────────────────────────────────────
  const state = {
    category: 'umlaute',
    index: 0,
    answered: null,        // 'a' | 'b' | null
    mode: 'pairs',         // 'pairs' | 'sentences'
    speed: 1,
    pending: null,
    progress: loadProgress(),
    signedIn: false,
  };

  function pairsForCategory(id) {
    return PAIRS.filter((pair) => pair.cat === id);
  }
  function currentPair() {
    return pairsForCategory(state.category)[state.index];
  }
  function targetIsA(pair) {
    return pair.id.length % 2 === 0;
  }

  async function play(text) {
    if (!state.signedIn) return;
    state.pending = text;
    render();
    try {
      await speak(text, state.speed);
    } catch (error) {
      console.warn('Aussprache play failed', error);
    } finally {
      state.pending = null;
      render();
    }
  }

  function pickChoice(choice) {
    if (state.answered) return;
    const pair = currentPair();
    if (!pair) return;
    const correctSlot = targetIsA(pair) ? 'a' : 'b';
    const isCorrect = choice === correctSlot;
    state.answered = choice;
    // update progress
    if (isCorrect) state.progress.solved.add(pair.id);
    state.progress.streak = isCorrect
      ? [...state.progress.streak.filter((id) => id !== pair.id), pair.id].slice(-16)
      : [];
    saveProgress(state.progress);
    render();
  }

  function next() {
    state.answered = null;
    const list = pairsForCategory(state.category);
    state.index = (state.index + 1) % list.length;
    render();
    setTimeout(() => autoPlayTarget(), 250);
  }

  function autoPlayTarget() {
    const pair = currentPair();
    if (!pair) return;
    const target = targetIsA(pair) ? pair.a : pair.b;
    const text = state.mode === 'sentences' ? target.ex : target.t;
    void play(text);
  }

  function changeCategory(id) {
    state.category = id;
    state.index = 0;
    state.answered = null;
    render();
    setTimeout(() => autoPlayTarget(), 250);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const root = document.getElementById('root');

  function renderChips() {
    return '<div class="chips">' + CATEGORIES.map((cat) => {
      const list = pairsForCategory(cat.id);
      const solved = list.filter((pair) => state.progress.solved.has(pair.id)).length;
      const total = list.length;
      const done = total > 0 && solved >= total;
      return `<button type="button" class="chip${cat.id === state.category ? ' active' : ''}" data-cat="${esc(cat.id)}">
        <span>${done ? '✅' : cat.emoji}</span>
        <span>${esc(cat[locale] || cat.en)}</span>
        <span class="badge">${solved}/${total}</span>
      </button>`;
    }).join('') + '</div>';
  }

  function renderStreak() {
    if (!state.progress.streak.length) return '';
    return `<div class="streak">🔥 ${state.progress.streak.length}</div>`;
  }

  function renderCard() {
    const pair = currentPair();
    if (!pair) return '<div class="card">No pairs.</div>';
    const target = targetIsA(pair) ? pair.a : pair.b;
    const targetText = state.mode === 'sentences' ? target.ex : target.t;
    const targetPending = state.pending === targetText;
    const correctSlot = targetIsA(pair) ? 'a' : 'b';

    const modeRow = `<div class="modes">
      <button type="button" class="mode${state.mode === 'pairs' ? ' active' : ''}" data-mode="pairs">📖 ${esc(t.pairs)}</button>
      <button type="button" class="mode${state.mode === 'sentences' ? ' active' : ''}" data-mode="sentences">💬 ${esc(t.sentences)}</button>
    </div>`;

    const playBtn = `<button type="button" id="playBtn" class="play"${!state.signedIn ? ' disabled' : ''}>
      ${targetPending ? '⏳' : '🔊'} ${esc(t.play)}
    </button>`;

    const speedRow = `<div class="speeds">
      ${[0.7, 1, 1.2].map((step) => `<button type="button" class="speed${state.speed === step ? ' active' : ''}" data-speed="${step}">${step}×</button>`).join('')}
    </div>`;

    const choices = ['a', 'b'].map((slot) => {
      const item = slot === 'a' ? pair.a : pair.b;
      const text = state.mode === 'sentences' ? item.ex : item.t;
      const sub  = state.mode === 'sentences' ? item.t  : item.ipa;
      const isCorrect = state.answered && slot === correctSlot;
      const isWrong   = state.answered === slot && slot !== correctSlot;
      const lengthUnits = state.mode === 'sentences' ? 0 : estimateVowelLengthUnits(item.ipa);
      const classes = ['choice', isCorrect ? 'correct' : '', isWrong ? 'wrong' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-choice="${slot}"${state.answered ? ' disabled' : ''}>
        <span class="word">${esc(text)}</span>
        <span class="ipa">${esc(sub)}</span>
        ${lengthUnits > 0 ? `<span class="len${lengthUnits >= 3 ? ' long' : ''}" style="width:${8 + lengthUnits * 14}px"></span>` : ''}
        <span class="play-mini" data-listen="${esc(text)}">${state.pending === text ? '⏳' : '▶'}</span>
      </button>`;
    }).join('');

    const hint = state.answered ? `<div class="hint">
      <div class="lbl">${esc(t.hint)}</div>
      <div class="text">${esc(pickHint(pair))}</div>
      <div class="ex">«${esc(pair.a.t)}» — ${esc(pair.a.ex)}</div>
      <div class="ex">«${esc(pair.b.t)}» — ${esc(pair.b.ex)}</div>
      <button type="button" class="next" id="nextBtn">${esc(t.next)} →</button>
    </div>` : '';

    return `<div class="card">
      <div class="card-kicker">${state.index + 1} / ${pairsForCategory(state.category).length}</div>
      ${modeRow}
      ${playBtn}
      ${speedRow}
      <div class="choices${state.mode === 'sentences' ? ' stack' : ''}">${choices}</div>
      ${hint}
    </div>`;
  }

  function render() {
    if (!state.signedIn) {
      root.innerHTML = `<div class="gate">${esc(t.joinFirst)} <a href="./index.html">Sign in</a></div>`;
      return;
    }
    root.innerHTML = renderStreak() + renderChips() + renderCard();
    bindEvents();
  }

  function bindEvents() {
    root.querySelectorAll('[data-cat]').forEach((chip) => {
      chip.addEventListener('click', () => changeCategory(chip.getAttribute('data-cat')));
    });
    root.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mode = btn.getAttribute('data-mode');
        state.answered = null;
        render();
        setTimeout(() => autoPlayTarget(), 200);
      });
    });
    root.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.speed = Number(btn.getAttribute('data-speed')) || 1;
        render();
      });
    });
    root.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        // Ignore inner listen mini-button clicks.
        if (event.target && event.target.closest('[data-listen]')) return;
        pickChoice(btn.getAttribute('data-choice'));
      });
    });
    root.querySelectorAll('[data-listen]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        void play(btn.getAttribute('data-listen'));
      });
    });
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        const pair = currentPair();
        if (!pair) return;
        const target = targetIsA(pair) ? pair.a : pair.b;
        void play(state.mode === 'sentences' ? target.ex : target.t);
      });
    }
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.addEventListener('click', next);
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  async function boot() {
    // Read ?category= for teacher deep-links.
    try {
      const url = new URL(window.location.href);
      const rawCategory = url.searchParams.get('category');
      if (rawCategory && CATEGORIES.some((c) => c.id === rawCategory)) {
        state.category = rawCategory;
      }
    } catch {}

    if (supa) {
      try {
        const session = await supa.auth.getSession();
        state.signedIn = Boolean(session?.data?.session?.access_token);
      } catch {
        state.signedIn = false;
      }
      supa.auth.onAuthStateChange((_event, session) => {
        state.signedIn = Boolean(session?.access_token);
        render();
      });
    }
    render();
    if (state.signedIn) setTimeout(() => autoPlayTarget(), 300);
  }

  void boot();
})();
