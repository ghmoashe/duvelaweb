(function () {
  function createNotificationsFeature(ctx) {
    const { $, tr, esc, state, supa, timeAgo } = ctx;

    async function loadNotifications() {
      try {
        const { data } = await supa.from('notifications')
          .select('id,type,title,body,read,created_at')
          .eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(40);
        state.notifications = data || [];
      } catch (error) {
        console.warn('notifications load failed', error);
      }
      renderNotifBadge();
    }

    function renderNotifBadge() {
      const dot = $('#notifDot');
      if (!dot) return;
      const count = state.notifications.filter((item) => !item.read).length;
      dot.textContent = count > 9 ? '9+' : String(count);
      dot.style.display = count > 0 ? 'grid' : 'none';
    }

    function renderNotifList() {
      const list = $('#notifList');
      if (!list) return;
      if (!state.notifications.length) {
        list.innerHTML = '<div class="empty">' + esc(tr('No notifications yet.', 'Уведомлений пока нет.')) + '</div>';
        return;
      }
      list.innerHTML = state.notifications.map((item) =>
        '<div class="notif-item' + (item.read ? '' : ' unread') + '"><div class="ndot"></div><div><b>' +
        esc(item.title || tr('Notification', 'Уведомление')) + '</b>' +
        (item.body ? '<p>' + esc(item.body) + '</p>' : '') +
        '<time>' + esc(timeAgo(item.created_at)) + '</time></div></div>'
      ).join('');
    }

    async function openNotifications() {
      renderNotifList();
      $('#notifOverlay').classList.add('open');
      await markAllNotifRead();
    }

    async function markAllNotifRead() {
      const ids = state.notifications.filter((item) => !item.read).map((item) => item.id);
      if (!ids.length) return;
      try {
        await supa.from('notifications').update({ read: true }).in('id', ids);
        state.notifications.forEach((item) => { item.read = true; });
        renderNotifBadge();
        renderNotifList();
      } catch (error) {
        console.warn('mark read failed', error);
      }
    }

    function subscribeNotifications() {
      try {
        supa.channel('notif-' + ctx.user.id)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + ctx.user.id }, (payload) => {
            state.notifications.unshift(payload.new);
            renderNotifBadge();
            if ($('#notifOverlay').classList.contains('open')) renderNotifList();
          }).subscribe();
      } catch (error) {
        /* realtime optional */
      }
    }

    function bindEvents() {
      $('#notifBell').addEventListener('click', openNotifications);
      $('#notifClose').addEventListener('click', () => $('#notifOverlay').classList.remove('open'));
      $('#notifOverlay').addEventListener('click', (event) => {
        if (event.target === $('#notifOverlay')) $('#notifOverlay').classList.remove('open');
      });
      $('#markAllRead').addEventListener('click', markAllNotifRead);
    }

    return {
      bindEvents,
      loadNotifications,
      openNotifications,
      renderNotifBadge,
      subscribeNotifications
    };
  }

  window.DuvelaAppNotifications = { create: createNotificationsFeature };
})();
