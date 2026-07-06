(function () {
  const EVENT_COLS = 'id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id';

  function createPublicDataFeature(ctx) {
    const { supa, state, tr, formatDate } = ctx;

    async function safeQuery(label, query, map) {
      try {
        const result = await query();
        if (result.error || !result.data || !result.data.length) return;
        state[label] = map ? result.data.map(map) : result.data;
      } catch (error) {
        console.warn(label + ' query failed', error);
      }
    }

    function mapEventRow(item) {
      return {
        id: item.id,
        title: item.title || tr('Event', 'Событие'),
        description: item.description || '',
        image: item.image_url,
        meta: [item.event_date ? formatDate(item.event_date) : '', item.city, item.country].filter(Boolean).join(' · '),
        price: item.is_paid ? item.price_amount : null,
        currency: 'EUR',
        is_free: !item.is_paid,
        is_online: item.format === 'online',
        event_date: item.event_date,
        event_time: item.event_time,
        city: item.city,
        country: item.country,
        format: item.format,
        language: item.language,
        max_participants: item.max_participants,
        organizer_id: item.organizer_id
      };
    }

    async function loadPublicData() {
      await Promise.all([
        safeQuery(
          'live',
          () => supa.from('live_sessions').select('id,teacher_name,topic,language,level,status').eq('status', 'live').limit(6),
          (item) => ({
            id: item.id,
            teacher_name: item.teacher_name || tr('Teacher live', 'Эфир преподавателя'),
            title: item.topic || [item.language, item.level].filter(Boolean).join(' · ') || tr('Live lesson', 'Live-урок'),
            status: item.status || tr('live', 'live')
          })
        ),
        safeQuery(
          'courses',
          () => supa.from('courses').select('id,title,description,cover_image_url,level,price,currency,schedule,starts_on').eq('status', 'active').order('created_at', { ascending: false }).limit(12),
          (item) => ({
            id: item.id,
            title: item.title || tr('Course', 'Курс'),
            description: item.description || item.schedule || '',
            image: item.cover_image_url,
            level: item.level || '',
            price: item.price,
            currency: item.currency,
            schedule: item.schedule || '',
            is_free: item.price == null || Number(item.price) === 0
          })
        ),
        safeQuery(
          'events',
          () => supa.from('events').select(EVENT_COLS).order('event_date', { ascending: true }).limit(12),
          mapEventRow
        )
      ]);
    }

    function getEventColumns() {
      return EVENT_COLS;
    }

    return {
      safeQuery,
      mapEventRow,
      getEventColumns,
      loadPublicData
    };
  }

  window.DuvelaAppPublicData = { create: createPublicDataFeature };
})();
