(function attachDuviAssistant(global) {
  'use strict';

  const ASSET_ROOT = '/web/assets/duvi/';
  const WELCOME_KEY = 'duvela.duvi.welcome.v1';
  const VOICE_KEY = 'duvela.duvi.voice.v1';
  const FRIEND_KEY = 'duvela.duvi.friend.v1';
  const RTL = new Set(['ar', 'fa']);
  const FRIENDS = [
    {
      id: 'lina',
      name: 'LINA',
      role: { en: 'Speaking buddy', ru: 'Speaking buddy' },
      blurb: { en: 'Roleplay and confidence', ru: 'Dialogues and confidence' },
      intro: {
        en: 'LINA is ready for short dialogues, roleplay, and confidence practice.',
        ru: 'LINA is ready for short dialogues, roleplay, and confidence practice.'
      },
      prompt: {
        en: 'LINA, prepare a short speaking practice for me.',
        ru: 'LINA, podgotov mne korotkuyu speaking practice.'
      },
      drill: {
        en: 'LINA, start a two-minute speaking challenge about my day.',
        ru: 'LINA, nachni dvukhminutnyy speaking challenge pro moy den.'
      },
      keywords: ['speak', 'speaking', 'conversation', 'dialogue', 'roleplay', 'talk', 'oral', 'speech', 'govor', 'razgovor', 'dialog']
    },
    {
      id: 'grami',
      name: 'GRAMI',
      role: { en: 'Grammar buddy', ru: 'Grammar buddy' },
      blurb: { en: 'Clear corrections', ru: 'Clear corrections' },
      intro: {
        en: 'GRAMI focuses on mistakes, grammar patterns, and simple explanations.',
        ru: 'GRAMI focuses on mistakes, grammar patterns, and simple explanations.'
      },
      prompt: {
        en: 'GRAMI, explain my mistake simply and show the correct version.',
        ru: 'GRAMI, oby yasni moyu oshibku prosto i pokazi pravilnyy variant.'
      },
      drill: {
        en: 'GRAMI, correct one common mistake at my level and give one quick rule.',
        ru: 'GRAMI, isprav odnu tipichnuyu oshibku na moem urovne i day odno kratkoe pravilo.'
      },
      keywords: ['grammar', 'mistake', 'correct', 'correction', 'rule', 'verb', 'article', 'case', 'tense', 'error', 'gramm', 'oshib', 'pravilo']
    },
    {
      id: 'stella',
      name: 'STELLA',
      role: { en: 'Story buddy', ru: 'Story buddy' },
      blurb: { en: 'Mini stories and scenes', ru: 'Mini stories and scenes' },
      intro: {
        en: 'STELLA brings short stories, scenes, and easy reading moments.',
        ru: 'STELLA brings short stories, scenes, and easy reading moments.'
      },
      prompt: {
        en: 'STELLA, give me a short A1 or A2 story with a few useful words.',
        ru: 'STELLA, day mne korotkuyu istoriyu A1 ili A2 s poleznymi slovami.'
      },
      drill: {
        en: 'STELLA, tell me a tiny story and ask one follow-up question.',
        ru: 'STELLA, rasskazhi mne ochen korotkuyu istoriyu i zaday odin vopros.'
      },
      keywords: ['story', 'dialog', 'dialogue', 'read', 'reading', 'book', 'scene', 'imagine', 'plot', 'istor', 'skaz', 'tekst']
    },
    {
      id: 'nova',
      name: 'NOVA',
      role: { en: 'Pronunciation buddy', ru: 'Pronunciation buddy' },
      blurb: { en: 'Listen and repeat', ru: 'Listen and repeat' },
      intro: {
        en: 'NOVA handles listening, pronunciation, and repeat-after-me practice.',
        ru: 'NOVA handles listening, pronunciation, and repeat-after-me practice.'
      },
      prompt: {
        en: 'NOVA, give me one short phrase to hear and repeat.',
        ru: 'NOVA, day mne odnu korotkuyu frazu dlya listen and repeat.'
      },
      drill: {
        en: 'NOVA, give me a pronunciation drill with one phrase and one listening check.',
        ru: 'NOVA, day mne pronunciation drill s odnoy frazoy i odnoy listening proverkoĭ.'
      },
      keywords: ['listen', 'listening', 'pronunciation', 'pronounce', 'repeat', 'accent', 'sound', 'audio', 'slush', 'proiznoshen', 'povtori']
    },
    {
      id: 'moti',
      name: 'MOTI',
      role: { en: 'Motivation buddy', ru: 'Motivation buddy' },
      blurb: { en: 'Streaks and rewards', ru: 'Streaks and rewards' },
      intro: {
        en: 'MOTI celebrates progress, protects streaks, and sets tiny next steps.',
        ru: 'MOTI celebrates progress, protects streaks, and sets tiny next steps.'
      },
      prompt: {
        en: 'MOTI, motivate me and give me one tiny next step for today.',
        ru: 'MOTI, motiviruy menya i day odin malenkiy sleduyushchiy shag na segodnya.'
      },
      drill: {
        en: 'MOTI, celebrate my progress and give me a mini challenge with a reward feeling.',
        ru: 'MOTI, otmet moy progress i day mini challenge s nagradoy.'
      },
      keywords: ['motivation', 'motivate', 'streak', 'reward', 'goal', 'habit', 'progress', 'hard', 'tired', 'motiv', 'seriya', 'nagrada']
    }
  ];
  const FRIEND_UI = {
    en: {
      friends: 'My friends',
      friendsLead: 'DUVI routes each prompt to the right buddy.',
      active: 'Active: {name}',
      activeDuvi: 'Active: DUVI',
      crew: 'DUVI Crew · 5 min',
      crewLead: 'Tap once for hear, speak, fix, story, and reward.',
      stickers: 'Quick stickers',
      select: 'Starter prompt loaded for {name}.'
    },
    ru: {
      friends: 'Moi druzya',
      friendsLead: 'DUVI marshrutiziruet kazhdyy zapros k nuzhnomu drugu.',
      active: 'Seychas: {name}',
      activeDuvi: 'Seychas: DUVI',
      crew: 'DUVI Crew · 5 min',
      crewLead: 'Odin tap: slushay, govori, ispravlyay, istoriya, nagrada.',
      stickers: 'Bystrye stikery',
      select: 'Startovyy zapros zagruzhen dlya {name}.'
    }
  };
  const CREW_STEPS = [
    { friendId: 'nova', label: { en: 'Hear', ru: 'Hear' } },
    { friendId: 'lina', label: { en: 'Speak', ru: 'Speak' } },
    { friendId: 'grami', label: { en: 'Fix', ru: 'Fix' } },
    { friendId: 'stella', label: { en: 'Story', ru: 'Story' } },
    { friendId: 'moti', label: { en: 'Reward', ru: 'Reward' } }
  ];
  const STICKERS = [
    {
      emoji: '🔥',
      friendId: 'moti',
      label: { en: 'Streak', ru: 'Streak' },
      prompt: {
        en: 'MOTI, give me a streak boost and one tiny goal for today.',
        ru: 'MOTI, day mne streak boost i odnu malenkuyu tsel na segodnya.'
      }
    },
    {
      emoji: '🎧',
      friendId: 'nova',
      label: { en: 'Repeat', ru: 'Repeat' },
      prompt: {
        en: 'NOVA, give me one phrase to hear and repeat right now.',
        ru: 'NOVA, day mne odnu frazu chtoby srazu poslushat i povtorit.'
      }
    },
    {
      emoji: '✨',
      friendId: 'stella',
      label: { en: 'Story', ru: 'Story' },
      prompt: {
        en: 'STELLA, give me a micro story with easy vocabulary.',
        ru: 'STELLA, day mne mikro istoriyu s prostoy leksikoy.'
      }
    },
    {
      emoji: '✅',
      friendId: 'grami',
      label: { en: 'Fix', ru: 'Fix' },
      prompt: {
        en: 'GRAMI, fix one sentence for me and explain the change.',
        ru: 'GRAMI, isprav dlya menya odno predlozhenie i oby yasni zame nu.'
      }
    },
    {
      emoji: '🎤',
      friendId: 'lina',
      label: { en: 'Roleplay', ru: 'Roleplay' },
      prompt: {
        en: 'LINA, start a tiny roleplay with me.',
        ru: 'LINA, nachni so mnoy malenkiy roleplay.'
      }
    }
  ];

  const FRIEND_TONES = {
    en: {
      lina: 'Warm speaking coach',
      grami: 'Calm grammar explainer',
      stella: 'Playful story guide',
      nova: 'Precise listening trainer',
      moti: 'Positive streak coach'
    },
    ru: {
      lina: '\u0422\u0451\u043f\u043b\u044b\u0439 speaking-\u043a\u043e\u0443\u0447',
      grami: '\u0421\u043f\u043e\u043a\u043e\u0439\u043d\u044b\u0439 \u043e\u0431\u044a\u044f\u0441\u043d\u0438\u0442\u0435\u043b\u044c \u0433\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u043a\u0438',
      stella: '\u0418\u0433\u0440\u0438\u0432\u044b\u0439 \u043f\u0440\u043e\u0432\u043e\u0434\u043d\u0438\u043a \u043f\u043e \u0438\u0441\u0442\u043e\u0440\u0438\u044f\u043c',
      nova: '\u0422\u043e\u0447\u043d\u044b\u0439 \u0442\u0440\u0435\u043d\u0435\u0440 \u043f\u043e \u0430\u0443\u0434\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044e',
      moti: '\u041f\u043e\u0437\u0438\u0442\u0438\u0432\u043d\u044b\u0439 \u043a\u043e\u0443\u0447 \u043f\u043e \u0441\u0435\u0440\u0438\u0438'
    },
    de: {
      lina: 'Warmherziger Sprechcoach',
      grami: 'Ruhiger Grammatik-Erklaerer',
      stella: 'Verspielter Story-Guide',
      nova: 'Praeziser Hoertrainer',
      moti: 'Positiver Streak-Coach'
    }
  };
  const FRIEND_STYLES = {
    en: {
      lina: 'Short spoken prompts, one question at a time, praise effort first.',
      grami: 'Explain briefly, show the fix, then give one tiny rule and one example.',
      stella: 'Use vivid but easy scenes, short paragraphs, and one follow-up question.',
      nova: 'Keep phrases short, mark stress clearly, and use hear-repeat-check loops.',
      moti: 'Celebrate progress, keep goals tiny, and end with one concrete next move.'
    },
    ru: {
      lina: '\u041a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0443\u0441\u0442\u043d\u044b\u0435 \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0438, \u043e\u0434\u0438\u043d \u0432\u043e\u043f\u0440\u043e\u0441 \u0437\u0430 \u0440\u0430\u0437, \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u0445\u0432\u0430\u043b\u0430 \u0437\u0430 \u0443\u0441\u0438\u043b\u0438\u0435.',
      grami: '\u041a\u0440\u0430\u0442\u043a\u043e \u043e\u0431\u044a\u044f\u0441\u043d\u0438, \u043f\u043e\u043a\u0430\u0436\u0438 \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435, \u0434\u0430\u0439 \u043e\u0434\u043d\u043e \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u043e\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u043e \u0438 \u043e\u0434\u0438\u043d \u043f\u0440\u0438\u043c\u0435\u0440.',
      stella: '\u042f\u0440\u043a\u0438\u0435, \u043d\u043e \u043f\u0440\u043e\u0441\u0442\u044b\u0435 \u0441\u0446\u0435\u043d\u044b, \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0430\u0431\u0437\u0430\u0446\u044b \u0438 \u043e\u0434\u0438\u043d \u0432\u043e\u043f\u0440\u043e\u0441 \u0432 \u043a\u043e\u043d\u0446\u0435.',
      nova: '\u041a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0444\u0440\u0430\u0437\u044b, \u044f\u0441\u043d\u043e\u0435 \u0443\u0434\u0430\u0440\u0435\u043d\u0438\u0435 \u0438 \u0446\u0438\u043a\u043b hear-repeat-check.',
      moti: '\u041e\u0442\u043c\u0435\u0447\u0430\u0439 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441, \u0434\u0435\u043b\u0430\u0439 \u0446\u0435\u043b\u0438 \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u043c\u0438 \u0438 \u0437\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u0439 \u043e\u0434\u043d\u0438\u043c \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u044b\u043c \u0448\u0430\u0433\u043e\u043c.'
    },
    de: {
      lina: 'Kurze Sprechimpulse, immer nur eine Frage, zuerst Einsatz loben.',
      grami: 'Kurz erklaeren, die Korrektur zeigen, dann eine Mini-Regel und ein Beispiel geben.',
      stella: 'Lebendige, aber einfache Szenen, kurze Absaetze und eine Anschlussfrage.',
      nova: 'Kurze Saetze, klare Betonung und Hoeren-Nachsprechen-Check.',
      moti: 'Fortschritt feiern, Ziele klein halten und mit einem klaren naechsten Schritt enden.'
    }
  };
  const FRIEND_SCENARIOS = {
    en: {
      lina: [
        { title: 'Introduce yourself', teaser: 'Simple self-intro in 4 lines', prompt: 'LINA, roleplay a simple self-introduction with me in four short turns.' },
        { title: 'Order at a cafe', teaser: 'Tiny food-and-drink roleplay', prompt: 'LINA, do a cafe roleplay where I order one drink and one snack.' },
        { title: 'Lesson warm-up', teaser: 'One-minute speaking warm-up', prompt: 'LINA, warm me up for class with three quick speaking questions.' }
      ],
      grami: [
        { title: 'Fix my sentence', teaser: 'One sentence, one correction', prompt: 'GRAMI, ask me for one sentence, correct it, and explain the change in one tiny rule.' },
        { title: 'Der / die / das', teaser: 'Quick article check', prompt: 'GRAMI, train me on der, die, das with three short examples.' },
        { title: 'Word order', teaser: 'Simple sentence structure', prompt: 'GRAMI, show me one common word-order mistake and how to fix it.' }
      ],
      stella: [
        { title: 'Micro fairy tale', teaser: 'Easy magical story', prompt: 'STELLA, tell me a tiny fairy tale with easy vocabulary and one new word list.' },
        { title: 'At the station', teaser: 'Short travel dialogue', prompt: 'STELLA, create a short station scene with two speakers and easy phrases.' },
        { title: 'Finish the story', teaser: 'You choose the ending', prompt: 'STELLA, start a short story and stop before the ending so I can finish it.' }
      ],
      nova: [
        { title: 'Hear and repeat', teaser: 'One phrase, three repeats', prompt: 'NOVA, give me one short phrase, mark the stress, and run a hear-repeat-check cycle.' },
        { title: 'Minimal pair', teaser: 'Train one hard sound', prompt: 'NOVA, train me with one minimal pair and explain the sound difference simply.' },
        { title: 'Sentence rhythm', teaser: 'Stress and flow practice', prompt: 'NOVA, give me one sentence and coach the rhythm and stress pattern.' }
      ],
      moti: [
        { title: 'Save my streak', teaser: 'Two-minute rescue plan', prompt: 'MOTI, save my streak with a two-minute plan I can do right now.' },
        { title: 'Tiny plan for today', teaser: 'One goal, three steps', prompt: 'MOTI, build me a tiny plan for today with one goal and three easy steps.' },
        { title: 'Celebrate progress', teaser: 'Win review and next step', prompt: 'MOTI, celebrate what I already did and give me one next win to chase.' }
      ]
    },
    ru: {
      lina: [
        { title: '\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044c\u0441\u044f', teaser: '\u041f\u0440\u043e\u0441\u0442\u043e\u0435 \u0437\u043d\u0430\u043a\u043e\u043c\u0441\u0442\u0432\u043e \u0432 4 \u0444\u0440\u0430\u0437\u0430\u0445', prompt: '\u041b\u0418\u041d\u0410, \u0440\u0430\u0437\u044b\u0433\u0440\u0430\u0439 \u0441\u043e \u043c\u043d\u043e\u0439 \u043f\u0440\u043e\u0441\u0442\u043e\u0435 \u0437\u043d\u0430\u043a\u043e\u043c\u0441\u0442\u0432\u043e \u0432 \u0447\u0435\u0442\u044b\u0440\u0451\u0445 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0445 \u0445\u043e\u0434\u0430\u0445.' },
        { title: '\u0417\u0430\u043a\u0430\u0437 \u0432 \u043a\u0430\u0444\u0435', teaser: '\u041c\u0438\u043d\u0438-\u0440\u043e\u043b\u0435\u043f\u043b\u0435\u0439 \u0435\u0434\u0430 + \u043d\u0430\u043f\u0438\u0442\u043e\u043a', prompt: '\u041b\u0418\u041d\u0410, \u0441\u0434\u0435\u043b\u0430\u0439 \u0440\u043e\u043b\u0435\u043f\u043b\u0435\u0439 \u0432 \u043a\u0430\u0444\u0435, \u0433\u0434\u0435 \u044f \u0437\u0430\u043a\u0430\u0437\u044b\u0432\u0430\u044e \u043e\u0434\u0438\u043d \u043d\u0430\u043f\u0438\u0442\u043e\u043a \u0438 \u043e\u0434\u0438\u043d \u043f\u0435\u0440\u0435\u043a\u0443\u0441.' },
        { title: '\u0420\u0430\u0437\u043e\u0433\u0440\u0435\u0432 \u043f\u0435\u0440\u0435\u0434 \u0443\u0440\u043e\u043a\u043e\u043c', teaser: '\u041e\u0434\u043d\u043e\u043c\u0438\u043d\u0443\u0442\u043d\u044b\u0439 \u0440\u0430\u0437\u043e\u0433\u0440\u0435\u0432', prompt: '\u041b\u0418\u041d\u0410, \u0440\u0430\u0437\u043e\u0433\u0440\u0435\u0439 \u043c\u0435\u043d\u044f \u043f\u0435\u0440\u0435\u0434 \u0443\u0440\u043e\u043a\u043e\u043c \u0442\u0440\u0435\u043c\u044f \u0431\u044b\u0441\u0442\u0440\u044b\u043c\u0438 speaking-\u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c\u0438.' }
      ],
      grami: [
        { title: '\u0418\u0441\u043f\u0440\u0430\u0432\u044c \u043c\u043e\u044e \u0444\u0440\u0430\u0437\u0443', teaser: '\u041e\u0434\u043d\u0430 \u0444\u0440\u0430\u0437\u0430, \u043e\u0434\u043d\u043e \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435', prompt: '\u0413\u0420\u0410\u041c\u0418, \u043f\u043e\u043f\u0440\u043e\u0441\u0438 \u0443 \u043c\u0435\u043d\u044f \u043e\u0434\u043d\u0443 \u0444\u0440\u0430\u0437\u0443, \u0438\u0441\u043f\u0440\u0430\u0432\u044c \u0435\u0451 \u0438 \u043e\u0431\u044a\u044f\u0441\u043d\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u043e\u0434\u043d\u0438\u043c \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u043c \u043f\u0440\u0430\u0432\u0438\u043b\u043e\u043c.' },
        { title: 'der / die / das', teaser: '\u0411\u044b\u0441\u0442\u0440\u0430\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0430\u0440\u0442\u0438\u043a\u043b\u0435\u0439', prompt: '\u0413\u0420\u0410\u041c\u0418, \u043f\u043e\u0442\u0440\u0435\u043d\u0438\u0440\u0443\u0439 \u043c\u0435\u043d\u044f \u043d\u0430 der, die, das \u0441 \u0442\u0440\u0435\u043c\u044f \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u043c\u0438 \u043f\u0440\u0438\u043c\u0435\u0440\u0430\u043c\u0438.' },
        { title: '\u041f\u043e\u0440\u044f\u0434\u043e\u043a \u0441\u043b\u043e\u0432', teaser: '\u041f\u0440\u043e\u0441\u0442\u0430\u044f \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430 \u0444\u0440\u0430\u0437\u044b', prompt: '\u0413\u0420\u0410\u041c\u0418, \u043f\u043e\u043a\u0430\u0436\u0438 \u043e\u0434\u043d\u0443 \u0447\u0430\u0441\u0442\u0443\u044e \u043e\u0448\u0438\u0431\u043a\u0443 \u0432 \u043f\u043e\u0440\u044f\u0434\u043a\u0435 \u0441\u043b\u043e\u0432 \u0438 \u043a\u0430\u043a \u0435\u0451 \u0438\u0441\u043f\u0440\u0430\u0432\u0438\u0442\u044c.' }
      ],
      stella: [
        { title: '\u041c\u0438\u043a\u0440\u043e-\u0441\u043a\u0430\u0437\u043a\u0430', teaser: '\u041f\u0440\u043e\u0441\u0442\u0430\u044f \u0432\u043e\u043b\u0448\u0435\u0431\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f', prompt: '\u0421\u0422\u0415\u041b\u041b\u0410, \u0440\u0430\u0441\u0441\u043a\u0430\u0436\u0438 \u043c\u043d\u0435 \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0443\u044e \u0441\u043a\u0430\u0437\u043a\u0443 \u0441 \u043f\u0440\u043e\u0441\u0442\u043e\u0439 \u043b\u0435\u043a\u0441\u0438\u043a\u043e\u0439 \u0438 \u043c\u0438\u043d\u0438-\u0441\u043f\u0438\u0441\u043a\u043e\u043c \u043d\u043e\u0432\u044b\u0445 \u0441\u043b\u043e\u0432.' },
        { title: '\u041d\u0430 \u0432\u043e\u043a\u0437\u0430\u043b\u0435', teaser: '\u041a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u0434\u0438\u0430\u043b\u043e\u0433 \u0432 \u043f\u043e\u0435\u0437\u0434\u043a\u0435', prompt: '\u0421\u0422\u0415\u041b\u041b\u0410, \u0441\u043e\u0437\u0434\u0430\u0439 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0441\u0446\u0435\u043d\u0443 \u043d\u0430 \u0432\u043e\u043a\u0437\u0430\u043b\u0435 \u0441 \u0434\u0432\u0443\u043c\u044f \u0433\u043e\u0432\u043e\u0440\u044f\u0449\u0438\u043c\u0438 \u0438 \u043f\u0440\u043e\u0441\u0442\u044b\u043c\u0438 \u0444\u0440\u0430\u0437\u0430\u043c\u0438.' },
        { title: '\u0414\u043e\u043f\u043e\u043b\u043d\u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044e', teaser: '\u0422\u044b \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0448\u044c \u043a\u043e\u043d\u0446\u043e\u0432\u043a\u0443', prompt: '\u0421\u0422\u0415\u041b\u041b\u0410, \u043d\u0430\u0447\u043d\u0438 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0438 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0441\u044c \u043f\u0435\u0440\u0435\u0434 \u043a\u043e\u043d\u0446\u043e\u0432\u043a\u043e\u0439, \u0447\u0442\u043e\u0431\u044b \u044f \u0435\u0451 \u0437\u0430\u043a\u043e\u043d\u0447\u0438\u043b.' }
      ],
      nova: [
        { title: '\u0421\u043b\u0443\u0448\u0430\u0439 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0439', teaser: '\u041e\u0434\u043d\u0430 \u0444\u0440\u0430\u0437\u0430, \u0442\u0440\u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0430', prompt: '\u041d\u041e\u0412\u0410, \u0434\u0430\u0439 \u043c\u043d\u0435 \u043e\u0434\u043d\u0443 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0444\u0440\u0430\u0437\u0443, \u043e\u0442\u043c\u0435\u0442\u044c \u0443\u0434\u0430\u0440\u0435\u043d\u0438\u0435 \u0438 \u043f\u0440\u043e\u0432\u0435\u0434\u0438 \u0446\u0438\u043a\u043b hear-repeat-check.' },
        { title: '\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u043f\u0430\u0440\u0430', teaser: '\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u043e\u0434\u043d\u043e\u0433\u043e \u0442\u0440\u0443\u0434\u043d\u043e\u0433\u043e \u0437\u0432\u0443\u043a\u0430', prompt: '\u041d\u041e\u0412\u0410, \u043f\u043e\u0442\u0440\u0435\u043d\u0438\u0440\u0443\u0439 \u043c\u0435\u043d\u044f \u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0439 \u043f\u0430\u0440\u0435 \u0438 \u043f\u0440\u043e\u0441\u0442\u043e \u043e\u0431\u044a\u044f\u0441\u043d\u0438 \u0440\u0430\u0437\u043d\u0438\u0446\u0443 \u0437\u0432\u0443\u043a\u043e\u0432.' },
        { title: '\u0420\u0438\u0442\u043c \u0444\u0440\u0430\u0437\u044b', teaser: '\u0423\u0434\u0430\u0440\u0435\u043d\u0438\u0435 \u0438 \u043f\u043b\u0430\u0432\u043d\u043e\u0441\u0442\u044c', prompt: '\u041d\u041e\u0412\u0410, \u0434\u0430\u0439 \u043c\u043d\u0435 \u043e\u0434\u043d\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0438 \u043f\u0440\u043e\u0442\u0440\u0435\u043d\u0438\u0440\u0443\u0439 \u0440\u0438\u0442\u043c \u0438 \u0441\u0445\u0435\u043c\u0443 \u0443\u0434\u0430\u0440\u0435\u043d\u0438\u044f.' }
      ],
      moti: [
        { title: '\u0421\u043f\u0430\u0441\u0438 \u043c\u043e\u044e \u0441\u0435\u0440\u0438\u044e', teaser: '\u041f\u043b\u0430\u043d-\u0441\u043f\u0430\u0441\u0435\u043d\u0438\u0435 \u043d\u0430 2 \u043c\u0438\u043d\u0443\u0442\u044b', prompt: '\u041c\u041e\u0422\u0418, \u0441\u043f\u0430\u0441\u0438 \u043c\u043e\u044e \u0441\u0435\u0440\u0438\u044e \u0434\u0432\u0443\u0445\u043c\u0438\u043d\u0443\u0442\u043d\u044b\u043c \u043f\u043b\u0430\u043d\u043e\u043c, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u044f \u043c\u043e\u0433\u0443 \u0441\u0434\u0435\u043b\u0430\u0442\u044c \u0441\u0435\u0439\u0447\u0430\u0441.' },
        { title: '\u041c\u0438\u043d\u0438-\u043f\u043b\u0430\u043d \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f', teaser: '\u041e\u0434\u043d\u0430 \u0446\u0435\u043b\u044c, \u0442\u0440\u0438 \u0448\u0430\u0433\u0430', prompt: '\u041c\u041e\u0422\u0418, \u0441\u043e\u0431\u0435\u0440\u0438 \u043c\u043d\u0435 \u043c\u0438\u043d\u0438-\u043f\u043b\u0430\u043d \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f: \u043e\u0434\u043d\u0430 \u0446\u0435\u043b\u044c \u0438 \u0442\u0440\u0438 \u043b\u0451\u0433\u043a\u0438\u0445 \u0448\u0430\u0433\u0430.' },
        { title: '\u041e\u0442\u043c\u0435\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441', teaser: '\u0420\u0430\u0437\u0431\u043e\u0440 \u043f\u043e\u0431\u0435\u0434\u044b \u0438 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0448\u0430\u0433', prompt: '\u041c\u041e\u0422\u0418, \u043e\u0442\u043c\u0435\u0442\u044c, \u0447\u0442\u043e \u044f \u0443\u0436\u0435 \u0441\u0434\u0435\u043b\u0430\u043b, \u0438 \u0434\u0430\u0439 \u043c\u043d\u0435 \u043e\u0434\u043d\u0443 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0443\u044e \u043f\u043e\u0431\u0435\u0434\u0443.' }
      ]
    },
    de: {
      lina: [
        { title: 'Stell dich vor', teaser: 'Einfache Selbstvorstellung in 4 Saetzen', prompt: 'LINA, spiele mit mir eine einfache Selbstvorstellung in vier kurzen Zuegen.' },
        { title: 'Im Cafe bestellen', teaser: 'Mini-Rollenspiel mit Essen und Getraenk', prompt: 'LINA, mach ein Cafe-Rollenspiel, in dem ich ein Getraenk und einen Snack bestelle.' },
        { title: 'Warm-up vor dem Unterricht', teaser: 'Einminuetiges Sprech-Warm-up', prompt: 'LINA, mach mit mir drei schnelle Sprechfragen als Warm-up fuer den Unterricht.' }
      ],
      grami: [
        { title: 'Korrigiere meinen Satz', teaser: 'Ein Satz, eine Korrektur', prompt: 'GRAMI, frag mich nach einem Satz, korrigiere ihn und erklaere die Aenderung mit einer Mini-Regel.' },
        { title: 'der / die / das', teaser: 'Schneller Artikel-Check', prompt: 'GRAMI, trainiere mit mir der, die, das an drei kurzen Beispielen.' },
        { title: 'Wortstellung', teaser: 'Einfache Satzstruktur', prompt: 'GRAMI, zeig mir einen haeufigen Fehler in der Wortstellung und wie ich ihn korrigiere.' }
      ],
      stella: [
        { title: 'Mini-Maerchen', teaser: 'Einfache magische Geschichte', prompt: 'STELLA, erzaehl mir ein Mini-Maerchen mit einfacher Sprache und einer kleinen Wortliste.' },
        { title: 'Am Bahnhof', teaser: 'Kurzer Reisedialog', prompt: 'STELLA, erfinde eine kurze Bahnhofsszene mit zwei Personen und einfachen Saetzen.' },
        { title: 'Beende die Geschichte', teaser: 'Du waehlst das Ende', prompt: 'STELLA, beginne eine kurze Geschichte und hoer vor dem Ende auf, damit ich sie beenden kann.' }
      ],
      nova: [
        { title: 'Hoer zu und sprich nach', teaser: 'Ein Satz, drei Wiederholungen', prompt: 'NOVA, gib mir einen kurzen Satz, markiere die Betonung und fuehre einen Hoer-Nachsprech-Check durch.' },
        { title: 'Minimalpaar', teaser: 'Trainiere einen schwierigen Laut', prompt: 'NOVA, trainiere mit mir ein Minimalpaar und erklaere den Lautunterschied einfach.' },
        { title: 'Satzrhythmus', teaser: 'Betonung und Sprachfluss', prompt: 'NOVA, gib mir einen Satz und trainiere mit mir Rhythmus und Betonungsmuster.' }
      ],
      moti: [
        { title: 'Rette meinen Streak', teaser: 'Zweiminuetiger Rettungsplan', prompt: 'MOTI, rette meinen Streak mit einem Zwei-Minuten-Plan, den ich sofort machen kann.' },
        { title: 'Mini-Plan fuer heute', teaser: 'Ein Ziel, drei Schritte', prompt: 'MOTI, bau mir einen Mini-Plan fuer heute mit einem Ziel und drei leichten Schritten.' },
        { title: 'Fortschritt feiern', teaser: 'Gewinn-Rueckblick und naechster Schritt', prompt: 'MOTI, feiere, was ich schon geschafft habe, und gib mir den naechsten kleinen Sieg.' }
      ]
    }
  };
  Object.assign(FRIEND_UI.en, {
    scenarios: 'Starter scenarios',
    scenarioLead: 'Tone: {tone}',
    scenarioEmpty: 'Pick a friend to unlock tone and starter scenes.'
  });
  Object.assign(FRIEND_UI.ru, {
    friends: '\u041c\u043e\u0438 \u0434\u0440\u0443\u0437\u044c\u044f',
    friendsLead: 'DUVI \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442 \u043a\u0430\u0436\u0434\u044b\u0439 \u0437\u0430\u043f\u0440\u043e\u0441 \u043d\u0443\u0436\u043d\u043e\u043c\u0443 \u0434\u0440\u0443\u0433\u0443.',
    active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d: {name}',
    activeDuvi: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d: DUVI',
    scenarios: '\u0421\u0442\u0430\u0440\u0442\u043e\u0432\u044b\u0435 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0438',
    scenarioLead: '\u0422\u043e\u043d: {tone}',
    scenarioEmpty: '\u0412\u044b\u0431\u0435\u0440\u0438 \u0434\u0440\u0443\u0433\u0430, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c tone \u0438 starter scenes.',
    crewLead: '\u041e\u0434\u0438\u043d \u0442\u0430\u043f: \u0441\u043b\u0443\u0448\u0430\u0439, \u0433\u043e\u0432\u043e\u0440\u0438, \u0438\u0441\u043f\u0440\u0430\u0432\u044c, \u0438\u0441\u0442\u043e\u0440\u0438\u044f, \u043d\u0430\u0433\u0440\u0430\u0434\u0430.',
    stickers: '\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0441\u0442\u0438\u043a\u0435\u0440\u044b'
  });
  FRIEND_UI.de = {
    friends: 'Meine Freunde',
    friendsLead: 'DUVI leitet jede Anfrage an den passenden Buddy weiter.',
    active: 'Aktiv: {name}',
    activeDuvi: 'Aktiv: DUVI',
    scenarios: 'Start-Szenarien',
    scenarioLead: 'Ton: {tone}',
    scenarioEmpty: 'Waehle einen Buddy, um Ton und Startszenen zu sehen.',
    crew: 'DUVI Crew · 5 min',
    crewLead: 'Ein Tipp fuer Hoeren, Sprechen, Korrigieren, Story und Belohnung.',
    stickers: 'Schnelle Sticker'
  };
  CREW_STEPS[0].label = { en: 'Hear', ru: '\u0421\u043b\u0443\u0448\u0430\u0439', de: 'Hoeren' };
  CREW_STEPS[1].label = { en: 'Speak', ru: '\u0413\u043e\u0432\u043e\u0440\u0438', de: 'Sprechen' };
  CREW_STEPS[2].label = { en: 'Fix', ru: '\u0418\u0441\u043f\u0440\u0430\u0432\u044c', de: 'Korrigieren' };
  CREW_STEPS[3].label = { en: 'Story', ru: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f', de: 'Story' };
  CREW_STEPS[4].label = { en: 'Reward', ru: '\u041d\u0430\u0433\u0440\u0430\u0434\u0430', de: 'Belohnung' };
  STICKERS[0].label = { en: 'Streak', ru: '\u0421\u0435\u0440\u0438\u044f', de: 'Streak' };
  STICKERS[1].label = { en: 'Repeat', ru: '\u041f\u043e\u0432\u0442\u043e\u0440\u0438', de: 'Nachsprechen' };
  STICKERS[2].label = { en: 'Story', ru: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f', de: 'Story' };
  STICKERS[3].label = { en: 'Fix', ru: '\u0418\u0441\u043f\u0440\u0430\u0432\u044c', de: 'Fix' };
  STICKERS[4].label = { en: 'Roleplay', ru: '\u0420\u043e\u043b\u0435\u043f\u043b\u0435\u0439', de: 'Rollenspiel' };
  STICKERS[0].prompt.de = 'MOTI, gib mir einen Streak-Boost und ein kleines Ziel fuer heute.';
  STICKERS[1].prompt.de = 'NOVA, gib mir jetzt sofort einen Satz zum Hoeren und Nachsprechen.';
  STICKERS[2].prompt.de = 'STELLA, gib mir eine Mikro-Story mit einfacher Wortwahl.';
  STICKERS[3].prompt.de = 'GRAMI, korrigiere einen Satz fuer mich und erklaere die Aenderung.';
  STICKERS[4].prompt.de = 'LINA, starte mit mir ein kleines Rollenspiel.';
  STICKERS[0].prompt.ru = '\u041c\u041e\u0422\u0418, \u0434\u0430\u0439 \u043c\u043d\u0435 boost \u0434\u043b\u044f \u0441\u0435\u0440\u0438\u0438 \u0438 \u043e\u0434\u043d\u0443 \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0443\u044e \u0446\u0435\u043b\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f.';
  STICKERS[1].prompt.ru = '\u041d\u041e\u0412\u0410, \u0434\u0430\u0439 \u043c\u043d\u0435 \u043e\u0434\u043d\u0443 \u0444\u0440\u0430\u0437\u0443, \u0447\u0442\u043e\u0431\u044b \u0441\u0435\u0439\u0447\u0430\u0441 \u0443\u0441\u043b\u044b\u0448\u0430\u0442\u044c \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c.';
  STICKERS[2].prompt.ru = '\u0421\u0422\u0415\u041b\u041b\u0410, \u0434\u0430\u0439 \u043c\u043d\u0435 \u043c\u0438\u043a\u0440\u043e-\u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0441 \u043f\u0440\u043e\u0441\u0442\u043e\u0439 \u043b\u0435\u043a\u0441\u0438\u043a\u043e\u0439.';
  STICKERS[3].prompt.ru = '\u0413\u0420\u0410\u041c\u0418, \u0438\u0441\u043f\u0440\u0430\u0432\u044c \u0434\u043b\u044f \u043c\u0435\u043d\u044f \u043e\u0434\u043d\u0443 \u0444\u0440\u0430\u0437\u0443 \u0438 \u043e\u0431\u044a\u044f\u0441\u043d\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435.';
  STICKERS[4].prompt.ru = '\u041b\u0418\u041d\u0410, \u043d\u0430\u0447\u043d\u0438 \u0441\u043e \u043c\u043d\u043e\u0439 \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u0439 \u0440\u043e\u043b\u0435\u043f\u043b\u0435\u0439.';
  FRIENDS.forEach((friend) => {
    const toneMap = { en: FRIEND_TONES.en[friend.id], ru: FRIEND_TONES.ru[friend.id], de: FRIEND_TONES.de[friend.id] };
    const styleMap = { en: FRIEND_STYLES.en[friend.id], ru: FRIEND_STYLES.ru[friend.id], de: FRIEND_STYLES.de[friend.id] };
    friend.tone = toneMap;
    friend.style = styleMap;
    friend.role.de = friend.role.de || friend.role.en;
    friend.blurb.de = friend.blurb.de || friend.blurb.en;
    friend.intro.de = friend.intro.de || friend.intro.en;
    friend.prompt.de = friend.prompt.de || friend.prompt.en;
    friend.drill.de = friend.drill.de || friend.drill.en;
  });

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
  let deckTitle = null;
  let deckLead = null;
  let activeBadge = null;
  let friendRail = null;
  let scenarioTitle = null;
  let scenarioLead = null;
  let scenarioStrip = null;
  let crewTitle = null;
  let crewLead = null;
  let crewStrip = null;
  let stickerTitle = null;
  let stickerStrip = null;
  const history = [];       // [{ role:'user'|'assistant', content }]
  let streaming = false;
  let recognition = null;
  let listening = false;
  let voiceEnabled = localStorage.getItem(VOICE_KEY) === '1';
  let activeFriendId = localStorage.getItem(FRIEND_KEY) || 'duvi';
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

  function deckText(key, data) {
    const locale = currentLocale();
    const value = FRIEND_UI[locale]?.[key] || FRIEND_UI.en[key] || key;
    return interpolate(value, data);
  }

  function localized(value) {
    if (!value || typeof value !== 'object') return String(value || '');
    const locale = currentLocale();
    return value[locale] || value.en || Object.values(value)[0] || '';
  }

  function friendById(id) {
    return FRIENDS.find((friend) => friend.id === id) || null;
  }

  function activeFriend() {
    return friendById(activeFriendId);
  }

  function friendAsset(id) {
    return ASSET_ROOT + 'friends/' + id + '.png';
  }

  function syncActiveFriendId() {
    if (!friendById(activeFriendId)) activeFriendId = 'duvi';
    localStorage.setItem(FRIEND_KEY, activeFriendId);
  }

  function interpolate(value, data) {
    return String(value || '').replace(/\{(\w+)\}/g, (_, key) => String(data?.[key] || ''));
  }

  function assetFor(type) {
    if (typeof type === 'string' && type.indexOf('friend:') === 0) {
      const friendId = type.slice(7);
      return friendById(friendId) ? friendAsset(friendId) : ASSET_ROOT + 'greeting.png';
    }
    if (type === 'home' && activeFriend()) return friendAsset(activeFriendId);
    if (type === 'thinking') return ASSET_ROOT + 'p-think.webp';
    if (type === 'success') return ASSET_ROOT + 'p-joy.webp';
    if (type === 'micError' || type === 'teacherFloor') return ASSET_ROOT + 'p-mic.webp';
    if (type === 'offline') return ASSET_ROOT + 'p-sleep.webp';
    if (type === 'error' || type === 'locationError') return ASSET_ROOT + 'error.png';
    if (type === 'classroom' || type === 'handRaised') return ASSET_ROOT + 'classroom.png';
    if (type === 'start' || type === 'problem') return ASSET_ROOT + 'tip.png';
    return ASSET_ROOT + 'greeting.png';
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

  function seedPrompt(value) {
    if (!inputEl) return;
    openPanel();
    inputEl.value = value;
    inputEl.focus({ preventScroll: true });
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  }

  function syncDeckCopy() {
    if (!deckTitle) return;
    deckTitle.textContent = deckText('friends');
    deckLead.textContent = deckText('friendsLead');
    if (scenarioTitle) scenarioTitle.textContent = deckText('scenarios');
    crewTitle.textContent = deckText('crew');
    crewLead.textContent = deckText('crewLead');
    stickerTitle.textContent = deckText('stickers');
  }

  function friendScenarios(friendId) {
    const locale = currentLocale();
    return FRIEND_SCENARIOS[locale]?.[friendId] || FRIEND_SCENARIOS.en[friendId] || [];
  }

  function renderScenarioStrip() {
    if (!scenarioStrip || !scenarioLead) return;
    scenarioStrip.replaceChildren();
    const friend = activeFriend();
    if (!friend) {
      scenarioLead.textContent = deckText('scenarioEmpty');
      return;
    }
    scenarioLead.textContent = deckText('scenarioLead', { tone: localized(friend.tone) });
    friendScenarios(friend.id).forEach((scenario) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duvi-scenario-chip';
      button.innerHTML = '<strong>' + scenario.title + '</strong><small>' + scenario.teaser + '</small>';
      button.title = scenario.prompt;
      button.addEventListener('click', () => runFriendPrompt(friend.id, scenario.prompt, true));
      scenarioStrip.append(button);
    });
  }

  function syncActiveBadge() {
    if (!activeBadge) return;
    const friend = activeFriend();
    activeBadge.textContent = friend ? deckText('active', { name: friend.name }) : deckText('activeDuvi');
  }

  function setActiveFriend(friendId, options = {}) {
    const friend = friendById(friendId);
    activeFriendId = friend ? friend.id : 'duvi';
    syncActiveFriendId();
    syncActiveBadge();
    if (deckTitle) root.querySelector('.duvi-panel-head strong').textContent = friend ? 'DUVI + ' + friend.name : 'DUVI';
    if (friendRail) {
      friendRail.querySelectorAll('[data-duvi-friend]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.duviFriend === activeFriendId);
      });
    }
    renderScenarioStrip();
    if (options.announce && friend) appendBubble('bot', localized(friend.intro), 'friend:' + friend.id);
    if (options.seed && friend) seedPrompt(localized(friend.prompt));
    if (options.focus && inputEl) inputEl.focus({ preventScroll: true });
  }

  function renderFriendRail() {
    if (!friendRail) return;
    friendRail.replaceChildren();
    FRIENDS.forEach((friend) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duvi-friend-card' + (friend.id === activeFriendId ? ' is-active' : '');
      button.dataset.duviFriend = friend.id;
      button.innerHTML =
        '<img alt="" src="' + friendAsset(friend.id) + '">' +
        '<span class="duvi-friend-copy">' +
          '<strong>' + friend.name + '</strong>' +
          '<small>' + localized(friend.role) + '</small>' +
          '<em>' + localized(friend.blurb) + '</em>' +
        '</span>';
      button.addEventListener('click', () => setActiveFriend(friend.id, { announce: true, seed: true, focus: true }));
      friendRail.append(button);
    });
  }

  function runFriendPrompt(friendId, promptText, announce) {
    const friend = friendById(friendId);
    if (!friend) return;
    setActiveFriend(friend.id, { announce: Boolean(announce) });
    sendChat(promptText || localized(friend.prompt));
  }

  function renderCrewStrip() {
    if (!crewStrip) return;
    crewStrip.replaceChildren();
    CREW_STEPS.forEach((step) => {
      const friend = friendById(step.friendId);
      if (!friend) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duvi-mini-chip';
      button.innerHTML = '<b>' + localized(step.label) + '</b><span>' + friend.name + '</span>';
      button.title = localized(friend.drill);
      button.addEventListener('click', () => runFriendPrompt(friend.id, localized(friend.drill), true));
      crewStrip.append(button);
    });
  }

  function renderStickerStrip() {
    if (!stickerStrip) return;
    stickerStrip.replaceChildren();
    STICKERS.forEach((sticker) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duvi-sticker-chip';
      button.innerHTML = '<span>' + sticker.emoji + '</span><b>' + localized(sticker.label) + '</b>';
      button.title = localized(sticker.prompt);
      button.addEventListener('click', () => runFriendPrompt(sticker.friendId, localized(sticker.prompt), false));
      stickerStrip.append(button);
    });
  }

  function routeFriendFromText(rawText) {
    const value = String(rawText || '').toLowerCase();
    let bestId = null;
    let bestScore = 0;
    FRIENDS.forEach((friend) => {
      let score = 0;
      friend.keywords.forEach((keyword) => {
        if (value.indexOf(keyword) !== -1) score += keyword.length > 6 ? 2 : 1;
      });
      if (score > bestScore) {
        bestScore = score;
        bestId = friend.id;
      }
    });
    return bestId;
  }

  function enrichPromptForFriend(value) {
    const friend = activeFriend();
    if (!friend) return value;
    return '[' + friend.name +
      ' | role: ' + localized(friend.role) +
      ' | focus: ' + localized(friend.blurb) +
      ' | tone: ' + localized(friend.tone) +
      ' | style: ' + localized(friend.style) +
      '] ' + value;
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
    syncActiveFriendId();

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
        '<div class="duvi-deck">' +
          '<div class="duvi-deck-head">' +
            '<div class="duvi-deck-copy">' +
              '<strong class="duvi-deck-title"></strong>' +
              '<small class="duvi-deck-lead"></small>' +
            '</div>' +
            '<span class="duvi-active-badge"></span>' +
          '</div>' +
          '<div class="duvi-friend-rail"></div>' +
          '<div class="duvi-mini-block duvi-scenarios-block">' +
            '<div class="duvi-mini-head">' +
              '<strong class="duvi-scenarios-title"></strong>' +
              '<small class="duvi-scenarios-lead"></small>' +
            '</div>' +
            '<div class="duvi-scenarios-strip"></div>' +
          '</div>' +
          '<div class="duvi-mini-block">' +
            '<div class="duvi-mini-head">' +
              '<strong class="duvi-crew-title"></strong>' +
              '<small class="duvi-crew-lead"></small>' +
            '</div>' +
            '<div class="duvi-crew-strip"></div>' +
          '</div>' +
          '<div class="duvi-mini-block duvi-sticker-block">' +
            '<div class="duvi-mini-head">' +
              '<strong class="duvi-sticker-title"></strong>' +
            '</div>' +
            '<div class="duvi-sticker-strip"></div>' +
          '</div>' +
        '</div>' +
        '<div class="duvi-thread" aria-live="polite"></div>' +
        '<div class="duvi-actions"></div>' +
        '<form class="duvi-input">' +
          '<button class="duvi-mic" type="button" aria-label="' + ui('listen') + '" title="' + ui('listen') + '">🎤</button>' +
          '<input class="duvi-text" type="text" autocomplete="off" enterkeyhint="send" placeholder="' + ui('placeholder') + '">' +
          '<button class="duvi-send" type="submit" aria-label="' + ui('send') + '" title="' + ui('send') + '">➤</button>' +
        '</form>' +
      '</section>' +
      '<button class="duvi-launcher" type="button" aria-label="DUVI" title="DUVI"><img alt="" src="' + ASSET_ROOT + 'greeting.png"></button>';
    document.body.append(root);
    panel = root.querySelector('.duvi-panel');
    thread = root.querySelector('.duvi-thread');
    actions = root.querySelector('.duvi-actions');
    inputEl = root.querySelector('.duvi-text');
    sendBtn = root.querySelector('.duvi-send');
    micBtn = root.querySelector('.duvi-mic');
    voiceBtn = root.querySelector('.duvi-voice');
    form = root.querySelector('.duvi-input');
    deckTitle = root.querySelector('.duvi-deck-title');
    deckLead = root.querySelector('.duvi-deck-lead');
    activeBadge = root.querySelector('.duvi-active-badge');
    friendRail = root.querySelector('.duvi-friend-rail');
    scenarioTitle = root.querySelector('.duvi-scenarios-title');
    scenarioLead = root.querySelector('.duvi-scenarios-lead');
    scenarioStrip = root.querySelector('.duvi-scenarios-strip');
    crewTitle = root.querySelector('.duvi-crew-title');
    crewLead = root.querySelector('.duvi-crew-lead');
    crewStrip = root.querySelector('.duvi-crew-strip');
    stickerTitle = root.querySelector('.duvi-sticker-title');
    stickerStrip = root.querySelector('.duvi-sticker-strip');

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
    syncDeckCopy();
    renderFriendRail();
    renderScenarioStrip();
    renderCrewStrip();
    renderStickerStrip();
    setActiveFriend(activeFriendId);
    if (!speechSupported()) micBtn.hidden = true;

    global.addEventListener('offline', () => show('offline'));
    global.addEventListener('duvela-language-change', () => {
      root.dir = RTL.has(currentLocale()) ? 'rtl' : 'ltr';
      root.querySelector('.duvi-close').setAttribute('aria-label', text('close'));
      inputEl.placeholder = ui('placeholder');
      updateVoiceButton();
      syncDeckCopy();
      renderFriendRail();
      renderScenarioStrip();
      renderCrewStrip();
      renderStickerStrip();
      setActiveFriend(activeFriendId);
    });

    if (options.autoWelcome !== false && !localStorage.getItem(WELCOME_KEY)) {
      localStorage.setItem(WELCOME_KEY, '1');
      setTimeout(() => show('welcome'), Number(options.welcomeDelay || 1200));
    }
    return global.DuvelaDUVI;
  }

  // ── AI chat ────────────────────────────────────────────────────────────────
  function buildContext() {
    const friend = activeFriend();
    return {
      app: context,
      view: currentView(),
      role: currentRole(),
      lang: currentLocale(),
      friend: friend?.id || 'duvi',
      friendName: friend?.name || 'DUVI',
      friendRole: friend ? localized(friend.role) : 'Guide',
      friendFocus: friend ? localized(friend.blurb) : 'Navigation and support',
      friendTone: friend ? localized(friend.tone) : 'Helpful guide',
      friendStyle: friend ? localized(friend.style) : 'Clear, practical support',
      friendScenarios: friend ? friendScenarios(friend.id).map((scenario) => scenario.title) : []
    };
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
    const routedFriendId = routeFriendFromText(value);
    if (routedFriendId) setActiveFriend(routedFriendId);
    inputEl.value = '';
    actions.replaceChildren();
    appendBubble('user', value);
    history.push({ role: 'user', content: enrichPromptForFriend(value) });

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
    setBubbleAvatar(bubble, clean ? (activeFriend() ? 'friend:' + activeFriendId : 'home') : 'error');
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

  global.DuvelaDUVI = {
    mount,
    show,
    hide,
    setContext,
    setLocale,
    registerAction,
    ask: sendChat,
    setVoice: setVoiceEnabled,
    setFriend: (friendId) => setActiveFriend(friendId, { focus: true })
  };
})(window);
