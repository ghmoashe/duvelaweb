(function attachDuvelaIndexPublicData(global) {
  'use strict';

  const copy = {
    en: {
      live: 'LIVE lesson happening now',
      scheduled: 'Next live lesson is scheduled',
      idle: 'New live lessons are being scheduled',
      join: 'Join live lesson',
      explore: 'Explore the web app',
      teachers: 'Public teacher profiles',
      subjects: 'Courses and subjects',
      liveLabel: 'Live and scheduled lessons',
      noTeachersTitle: 'Teacher profiles are coming online',
      noTeachersCopy: 'Open Duvela Business to create a public teaching profile, publish lessons and schedule live sessions.',
      teach: 'Create a teacher profile',
      profile: 'View public profile',
      language: 'Teacher',
    },
    ru: {
      live: 'LIVE-урок идёт прямо сейчас',
      scheduled: 'Следующий LIVE-урок уже запланирован',
      idle: 'Новые LIVE-уроки готовятся',
      join: 'Присоединиться',
      explore: 'Открыть веб-приложение',
      teachers: 'Публичные профили преподавателей',
      subjects: 'Курсы и предметы',
      liveLabel: 'LIVE и запланированные уроки',
      noTeachersTitle: 'Профили преподавателей скоро появятся',
      noTeachersCopy: 'Откройте Duvela Business, создайте публичный профиль, публикуйте уроки и планируйте эфиры.',
      teach: 'Создать профиль преподавателя',
      profile: 'Открыть профиль',
      language: 'Преподаватель',
    },
  };

  function locale() {
    const code = String(document.documentElement.lang || 'en').split('-')[0];
    return copy[code] ? code : 'en';
  }

  function text() {
    return copy[locale()];
  }

  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function initials(name) {
    const parts = String(name || 'Duvela').trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0] || '').join('').toUpperCase() || 'D';
  }

  function teacherDescription(teacher, fallback) {
    const bio = String(teacher.bio || '').trim();
    if (bio.length >= 24 && !/^(h+|test|asdf|demo)\b/i.test(bio)) return bio;
    if (fallback) return fallback.bio;
    return 'Публичный профиль преподавателя Duvela. Уроки, эфиры и практические занятия.';
  }

  function fallbackForName(name) {
    const normalized = String(name || '').toLowerCase();
    if (normalized.includes('sofia')) return fallbackTeachers[0];
    if (normalized.includes('ghazanfar') || normalized.includes('maosher')) return fallbackTeachers[1];
    if (normalized.includes('elsa')) return fallbackTeachers[2];
    return null;
  }

  function socialUrl(kind, value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) return raw;
    const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
    if (kind === 'instagram') return 'https://instagram.com/' + handle;
    if (kind === 'tiktok') return 'https://tiktok.com/@' + handle;
    if (kind === 'facebook') return 'https://facebook.com/' + handle;
    if (kind === 'linkedin') return 'https://linkedin.com/in/' + handle;
    if (kind === 'youtube') return 'https://youtube.com/' + handle;
    if (kind === 'telegram') return 'https://t.me/' + handle;
    if (kind === 'website') return 'https://' + handle;
    return raw;
  }

  function teacherContacts(teacher) {
    return [
      ['website', teacher.website, 'Website'],
      ['telegram', teacher.telegram, 'Telegram'],
      ['instagram', teacher.instagram, 'Instagram'],
      ['tiktok', teacher.tiktok, 'TikTok'],
      ['youtube', teacher.youtube, 'YouTube'],
      ['linkedin', teacher.linkedin, 'LinkedIn'],
    ].filter((item) => String(item[1] || '').trim()).slice(0, 4);
  }

  const fallbackTeachers = [
    {
      id: 'sofia-becker',
      full_name: 'Sofia Becker',
      city: 'Berlin',
      country: 'Germany',
      language: 'Преподаватель',
      bio: 'Разговорная практика, ежедневные темы и мягкая поддержка для уверенной речи.',
      tags: ['Speaking', 'A1-B2'],
      avatar_url: './web/assets/duvi/friends/sofia.png',
    },
    {
      id: 'ghazanfar-maosher',
      full_name: 'Ghazanfar Maosher',
      city: 'Berlin',
      country: 'Germany',
      language: 'Преподаватель',
      bio: 'Публичный профиль преподавателя Duvela. Уроки, эфиры и практические занятия.',
      tags: ['Speaking', 'Live'],
      avatar_url: './assets/hero-teacher.webp',
    },
    {
      id: 'elsa-novak',
      full_name: 'Elsa Novak',
      city: 'Berlin',
      country: 'Germany',
      language: 'Преподаватель',
      bio: 'Подготовка к speaking, структурированные занятия и уверенные ответы на экзамене.',
      tags: ['Exam', 'A1-B2'],
      avatar_url: './web/assets/duvi/friends/elsa.png',
    },
  ];

  function setTrustValue(id, value, label) {
    const item = document.getElementById(id);
    if (!item) return;
    item.querySelector('b').textContent = value;
    item.querySelector('span').textContent = label;
  }

  function renderLive(rows) {
    const t = text();
    const badge = document.getElementById('heroLiveBadge');
    const preview = document.getElementById('heroLivePreview');
    const sessions = Array.isArray(rows) ? rows : [];
    const active = sessions.find((row) => row.status === 'live');
    const next = active || sessions.find((row) => row.status === 'scheduled');

    badge.classList.remove('is-scheduled', 'is-idle');
    if (!next) {
      badge.classList.add('is-idle');
      badge.innerHTML = '<span class="dot"></span> ' + safe(t.idle);
      if (preview) preview.hidden = true;
      setTrustValue('trustLive', 'Open', t.liveLabel);
      return;
    }

    const isLive = next.status === 'live';
    if (!isLive) badge.classList.add('is-scheduled');
    badge.innerHTML = '<span class="dot"></span> ' + safe(isLive ? t.live : t.scheduled);
    setTrustValue('trustLive', String(sessions.length), t.liveLabel);

    if (!preview) return;
    preview.hidden = false;
    preview.querySelector('.hero-preview-kicker').textContent = isLive ? t.live : t.scheduled;
    preview.querySelector('.hero-preview-topic').textContent = next.topic || next.language || 'Duvela Live';
    preview.querySelector('.hero-preview-sub').textContent = [next.teacher_name, next.language, next.level].filter(Boolean).join(' · ');
    const link = preview.querySelector('.hero-preview-link');
    link.textContent = isLive ? t.join : t.explore;
    link.href = isLive ? './live.html?session=' + encodeURIComponent(next.id) : './app.html?role=learner#live';
  }

  function renderTeachers(rows) {
    const grid = document.getElementById('teacherGrid');
    if (!grid) return;
    const t = text();
    const publicTeachers = (Array.isArray(rows) ? rows : []).filter((row) => row.is_teacher).slice(0, 3);
    const teachers = publicTeachers.length ? publicTeachers : fallbackTeachers;

    if (!teachers.length) {
      grid.innerHTML = `
        <div class="teacher-empty reveal in">
          <h3>${safe(t.noTeachersTitle)}</h3>
          <p>${safe(t.noTeachersCopy)}</p>
          <a class="btn-primary" href="./app.html?role=teacher#workspace">${safe(t.teach)}</a>
        </div>
      `;
      setTrustValue('trustTeachers', 'Open', t.teachers);
      return;
    }

    setTrustValue('trustTeachers', publicTeachers.length ? String(teachers.length) : 'Open', t.teachers);
    grid.innerHTML = teachers.map((teacher) => {
      const name = teacher.full_name || t.language;
      const fallback = fallbackForName(name);
      const role = teacher.language || fallback?.language || t.language;
      const location = [teacher.city, teacher.country].filter(Boolean).join(', ');
      const avatar = teacher.avatar_url
        ? `<img src="${safe(teacher.avatar_url)}" alt="${safe(name)}" loading="lazy" decoding="async">`
        : safe(initials(name));
      const tags = Array.isArray(teacher.tags) && teacher.tags.length
        ? teacher.tags
        : (fallback?.tags || [teacher.language, teacher.language_level].filter(Boolean).slice(0, 2));
      const contacts = teacherContacts(teacher);
      const href = String(teacher.id || '').includes('-') && !publicTeachers.length
        ? './app.html?role=learner#teachers'
        : './profile.html?id=' + encodeURIComponent(teacher.id);
      return `
        <article class="tch-card-big reveal in">
          <div class="tch-card-head">
            <div class="tch-av-big" style="background:linear-gradient(135deg,#6D3FE0,#0F9F7A)">${avatar}</div>
            <span class="tch-online" aria-label="Online"></span>
          </div>
          <div class="tch-name-big">${safe(name)}</div>
          ${location ? `<div class="tch-stats-big"><span>${safe(location)}</span></div>` : ''}
          <span class="tch-lang-big">${safe(role)}</span>
          <p class="tch-bio-big">${safe(teacherDescription(teacher, fallback))}</p>
          ${tags.length ? `<div class="tch-tags-big">${tags.map((tag) => `<span>${safe(tag)}</span>`).join('')}</div>` : ''}
          ${contacts.length ? `<div class="tch-contact-mini">${contacts.map((item) => `<a href="${safe(socialUrl(item[0], item[1]))}" target="_blank" rel="noopener">${safe(item[2])}</a>`).join('')}</div>` : ''}
          <a class="tch-btn-big" href="${safe(href)}">${safe(t.profile)} →</a>
        </article>
      `;
    }).join('');
  }

  async function load() {
    const config = global.DuvelaWebConfig;
    if (!config?.createSupabaseClient) return;

    const supa = config.createSupabaseClient();
    const publicRowsEnabled = config.publicMarketingDataEnabled === true;
    const [liveResult, teacherResult, courseResult] = await Promise.all([
      publicRowsEnabled ? supa
        .from('live_sessions')
        .select('id,teacher_name,language,level,topic,status,started_at')
        .in('status', ['live', 'scheduled'])
        .eq('is_private', false)
        .order('started_at', { ascending: false })
        .limit(12) : Promise.resolve({ data: [], error: null }),
      supa
        .from('profiles')
        .select('id,full_name,avatar_url,city,country,bio,is_teacher,language,language_level,website,telegram,instagram,tiktok,facebook,linkedin,youtube')
        .eq('is_teacher', true)
        .limit(12),
      publicRowsEnabled ? supa
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active') : Promise.resolve({ data: [], count: null, error: null }),
    ]);

    renderLive(liveResult.error ? [] : liveResult.data);
    renderTeachers(teacherResult.error ? [] : teacherResult.data);

    const t = text();
    const count = courseResult.error ? null : courseResult.count;
    setTrustValue('trustCourses', count ? String(count) : 'Open', t.subjects);
  }

  global.addEventListener('duvela-language-change', () => load().catch(() => {}));
  document.addEventListener('DOMContentLoaded', () => load().catch(() => {
    renderLive([]);
    renderTeachers([]);
  }));
})(window);
