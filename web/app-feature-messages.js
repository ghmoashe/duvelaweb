(function () {
  function createMessagesFeature(ctx) {
    const { $, tr, esc, state, supa, alert, avatarInner } = ctx;
    const CHAT_PROFILE_FIELDS = 'id,full_name,avatar_url,city,country';
    let threadChannel = null;
    let chatSearchTimer = null;
    const renderedMessageIds = new Set();
    let chatGroupMode = false;
    const chatGroupSel = new Map();
    let lastPeopleResults = [];
    let showingArchive = false;
    let typingTimer = null;

    async function loadConversations() {
      try {
        const { data: mine, error: mineError } = await supa.from('chat_participants')
          .select('conversation_id,last_read_at,is_pinned,is_archived,is_blocked').eq('user_id', ctx.user.id);
        if (mineError) throw mineError;
        const ids = (mine || []).map((row) => row.conversation_id);
        if (!ids.length) {
          state.conversations = [];
          renderConversations();
          return;
        }
        const lastReadById = new Map((mine || []).map((row) => [row.conversation_id, row.last_read_at ? Date.parse(row.last_read_at) : 0]));
        const [{ data: convs }, { data: parts }, { data: msgs }] = await Promise.all([
          supa.from('chat_conversations').select('id,title,is_group,updated_at,created_at').in('id', ids),
          supa.from('chat_participants').select('conversation_id,user_id,last_read_at,is_blocked').in('conversation_id', ids),
          supa.from('chat_messages').select('id,conversation_id,sender_id,body,created_at,edited_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300)
        ]);
        const otherIds = Array.from(new Set((parts || []).map((part) => part.user_id).filter((id) => id !== ctx.user.id)));
        const { data: profs } = otherIds.length
          ? await supa.from('profiles').select(CHAT_PROFILE_FIELDS).in('id', otherIds)
          : { data: [] };
        const profById = new Map((profs || []).map((profile) => [profile.id, profile]));
        const partsByConv = new Map();
        (parts || []).forEach((part) => {
          const items = partsByConv.get(part.conversation_id) || [];
          items.push(part.user_id);
          partsByConv.set(part.conversation_id, items);
        });
        const lastByConv = new Map();
        (msgs || []).forEach((message) => {
          if (!lastByConv.has(message.conversation_id)) lastByConv.set(message.conversation_id, message);
        });
        const unreadByConv = new Map();
        (msgs || []).forEach((message) => {
          if (message.sender_id === ctx.user.id) return;
          if (Date.parse(message.created_at) > (lastReadById.get(message.conversation_id) || 0)) {
            unreadByConv.set(message.conversation_id, (unreadByConv.get(message.conversation_id) || 0) + 1);
          }
        });
        state.conversations = (convs || []).map((conversation) => {
          const own = (mine || []).find((row) => row.conversation_id === conversation.id) || {};
          const members = partsByConv.get(conversation.id) || [];
          const otherId = members.find((id) => id !== ctx.user.id) || members[0] || '';
          const other = otherId ? profById.get(otherId) : null;
          const last = lastByConv.get(conversation.id);
          return {
            id: conversation.id,
            isGroup: !!conversation.is_group,
            name: (conversation.title || '').trim() || (other && other.full_name) || (conversation.is_group ? tr('Group chat', 'Групповой чат') : tr('Chat', 'Чат')),
            avatarUrl: other && other.avatar_url,
            lastMessage: last ? last.body : '',
            lastAt: last ? last.created_at : (conversation.updated_at || conversation.created_at),
            unread: unreadByConv.get(conversation.id) || 0
            ,pinned: !!own.is_pinned
            ,archived: !!own.is_archived
            ,ownBlocked: !!own.is_blocked
            ,blocked: (parts || []).some((part) => part.conversation_id === conversation.id && part.is_blocked)
            ,otherLastReadAt: ((parts || []).find((part) => part.conversation_id === conversation.id && part.user_id !== ctx.user.id) || {}).last_read_at || null
          };
        }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0));
      } catch (error) {
        console.warn('conversations load failed', error);
        state.conversations = [];
      }
      renderConversations();
    }

    function renderConversations() {
      const list = $('#conversationList');
      if (!list) return;
      const search = $('#chatSearchInput');
      if (search) {
        search.placeholder = tr('Search chats...', 'Поиск по чатам...');
        if (!search.dataset.bound) {
          search.dataset.bound = '1';
          search.addEventListener('input', renderConversations);
        }
      }
      const label = $('#newChatBtnLabel');
      if (label) label.textContent = tr('New chat', 'Новый чат');

      const query = (search && search.value.trim().toLowerCase()) || '';
      const archiveFiltered = state.conversations.filter((conversation) => conversation.archived === showingArchive);
      const visible = query
        ? archiveFiltered.filter((conversation) =>
            (conversation.name || '').toLowerCase().indexOf(query) >= 0 ||
            (conversation.lastMessage || '').toLowerCase().indexOf(query) >= 0)
        : archiveFiltered;

      if (!archiveFiltered.length) {
        list.innerHTML = '<div class="msg-empty"><b>' + esc(tr('No conversations yet', 'Диалогов пока нет')) + '</b>' +
          '<p>' + esc(tr('Start one with the "New chat" button to message a teacher or learner.', 'Нажмите «Новый чат», чтобы написать преподавателю или ученику.')) + '</p></div>';
        return;
      }
      if (!visible.length) {
        list.innerHTML = '<div class="msg-empty"><b>' + esc(tr('Nothing found', 'Ничего не найдено')) + '</b>' +
          '<p>' + esc(tr('No chats match your search.', 'Под запрос не подошёл ни один чат.')) + '</p></div>';
        return;
      }
      list.innerHTML = visible.map((conversation) =>
        '<div class="conv' + (conversation.id === state.activeConversationId ? ' active' : '') + '" data-conv="' + esc(conversation.id) + '">' +
          '<div class="avatar">' + avatarInner(conversation.name, conversation.avatarUrl) + '</div>' +
          '<div class="conv-main"><h3>' + esc(conversation.name) + '</h3>' +
          '<p>' + esc(conversation.lastMessage || tr('No messages yet', 'Сообщений пока нет')) + '</p></div>' +
          '<div class="conv-meta">' +
            '<span class="conv-time">' + esc(conversation.lastAt && ctx.timeAgo ? ctx.timeAgo(conversation.lastAt) : '') + '</span>' +
            (conversation.unread ? '<span class="unread">' + conversation.unread + '</span>' : '') +
            (conversation.pinned ? '<span class="conv-pin" title="' + esc(tr('Pinned', 'Закреплено')) + '">●</span>' : '') +
            '<details class="conv-actions"><summary aria-label="' + esc(tr('Conversation menu', 'Меню диалога')) + '">⋯</summary><div class="conv-menu">' +
              '<button type="button" data-conv-action="pin" data-id="' + esc(conversation.id) + '">' + esc(conversation.pinned ? tr('Unpin', 'Открепить') : tr('Pin', 'Закрепить')) + '</button>' +
              '<button type="button" data-conv-action="archive" data-id="' + esc(conversation.id) + '">' + esc(conversation.archived ? tr('Restore from archive', 'Вернуть из архива') : tr('Archive', 'В архив')) + '</button>' +
              '<button type="button" data-conv-action="block" data-id="' + esc(conversation.id) + '">' + esc(conversation.ownBlocked ? tr('Unblock', 'Разблокировать') : tr('Block user', 'Заблокировать')) + '</button>' +
              '<button class="danger" type="button" data-conv-action="remove" data-id="' + esc(conversation.id) + '">' + esc(tr('Remove for me', 'Удалить у меня')) + '</button>' +
              '<button class="danger" type="button" data-conv-action="delete-all" data-id="' + esc(conversation.id) + '">' + esc(tr('Delete for everyone', 'Удалить у всех')) + '</button>' +
            '</div></details>' +
          '</div>' +
        '</div>'
      ).join('');
    }

    function renderThread(messages) {
      const body = $('#threadBody');
      if (!body) return;
      renderedMessageIds.clear();
      messages.forEach((message) => { if (message.id) renderedMessageIds.add(message.id); });
      body.innerHTML = messages.length
        ? messages.map(messageHtml).join('')
        : '<div class="empty">' + esc(tr('No messages yet. Say hello.', 'Сообщений пока нет. Напишите первым.')) + '</div>';
      body.scrollTop = body.scrollHeight;
    }

    function messageHtml(message) {
      const mine = message.sender_id === ctx.user.id;
      const conversation = state.conversations.find((item) => item.id === message.conversation_id);
      const read = mine && conversation && conversation.otherLastReadAt && Date.parse(conversation.otherLastReadAt) >= Date.parse(message.created_at);
      const time = message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="bubble ' + (mine ? 'me' : 'them') + '" data-message-id="' + esc(message.id || '') + '" data-created-at="' + esc(message.created_at || '') + '">' +
        '<span class="bubble-text">' + esc(message.body) + '</span>' +
        '<span class="bubble-meta"><span>' + esc(time) + '</span>' + (message.edited_at ? '<span>' + esc(tr('edited', 'изменено')) + '</span>' : '') + (mine ? '<span data-delivery-status>' + esc(read ? tr('Read', 'Прочитано') : tr('Delivered', 'Доставлено')) + '</span>' : '') + '</span>' +
        (mine && message.id ? '<button class="message-more" type="button" data-message-menu="' + esc(message.id) + '" aria-label="' + esc(tr('Message menu', 'Меню сообщения')) + '">⋯</button><div class="bubble-menu"><button type="button" data-message-action="edit" data-id="' + esc(message.id) + '">' + esc(tr('Edit', 'Редактировать')) + '</button><button type="button" data-message-action="copy" data-id="' + esc(message.id) + '">' + esc(tr('Copy', 'Копировать')) + '</button><button class="danger" type="button" data-message-action="delete" data-id="' + esc(message.id) + '">' + esc(tr('Delete', 'Удалить')) + '</button></div>' : '') +
      '</div>';
    }

    async function editMessage(id) {
      const node = $('#threadBody').querySelector('[data-message-id="' + id + '"]');
      const current = node && node.querySelector('.bubble-text') ? node.querySelector('.bubble-text').textContent : '';
      const next = window.prompt(tr('Edit message', 'Изменить сообщение'), current);
      if (next === null || !next.trim() || next.trim() === current) return;
      const result = await supa.from('chat_messages').update({ body: next.trim(), edited_at: new Date().toISOString() }).eq('id', id).eq('sender_id', ctx.user.id).select('id,conversation_id,sender_id,body,created_at,edited_at').single();
      if (result.error) { alert(result.error.message || tr('Could not edit the message.', 'Не удалось изменить сообщение.')); return; }
      if (node) node.outerHTML = messageHtml(result.data);
      await loadConversations();
    }

    async function copyMessage(id) {
      const node = $('#threadBody').querySelector('[data-message-id="' + id + '"] .bubble-text');
      if (!node) return;
      try { await navigator.clipboard.writeText(node.textContent); } catch (_) { window.prompt(tr('Copy message', 'Скопируйте сообщение'), node.textContent); }
    }

    // Appends one message, ignoring duplicates so an optimistic append and the
    // realtime INSERT for the same row don't both render a bubble.
    function appendMessage(message) {
      if (!message || (message.id && renderedMessageIds.has(message.id))) return;
      if (message.id) renderedMessageIds.add(message.id);
      const body = $('#threadBody');
      if (!body) return;
      const empty = body.querySelector('.empty');
      if (empty) body.innerHTML = '';
      body.insertAdjacentHTML('beforeend', messageHtml(message));
      body.scrollTop = body.scrollHeight;
      const conversation = state.conversations.find((item) => item.id === message.conversation_id);
      if (conversation) {
        conversation.lastMessage = message.body;
        conversation.lastAt = message.created_at || new Date().toISOString();
        renderConversations();
      }
    }

    async function deleteMessage(id) {
      if (!id || !window.confirm(tr('Delete this message?', 'Удалить это сообщение?'))) return;
      const result = await supa.from('chat_messages').delete().eq('id', id).eq('sender_id', ctx.user.id);
      if (result.error) {
        alert(result.error.message || tr('Could not delete the message.', 'Не удалось удалить сообщение.'));
        return;
      }
      renderedMessageIds.delete(id);
      const node = $('#threadBody').querySelector('[data-message-id="' + id + '"]');
      if (node) node.remove();
      if (!$('#threadBody').querySelector('.bubble')) {
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('No messages yet. Say hello.', 'Сообщений пока нет. Напишите первым.')) + '</div>';
      }
      await loadConversations();
    }

    async function removeConversation(id) {
      if (!id || !window.confirm(tr('Remove this conversation from your list?', 'Удалить этот диалог из вашего списка?'))) return;
      const result = await supa.from('chat_participants').delete().eq('conversation_id', id).eq('user_id', ctx.user.id);
      if (result.error) {
        alert(result.error.message || tr('Could not remove the conversation.', 'Не удалось удалить диалог.'));
        return;
      }
      if (state.activeConversationId === id) {
        state.activeConversationId = null;
        if (threadChannel) supa.removeChannel(threadChannel);
        threadChannel = null;
        $('#threadTitle').textContent = tr('Select a conversation', 'Выберите диалог');
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Choose a chat on the left to start messaging.', 'Выберите чат слева, чтобы начать переписку.')) + '</div>';
        $('#composeForm').style.display = 'none';
        $('#msgWrap').classList.remove('thread-open');
      }
      await loadConversations();
    }

    async function updateConversationPreference(id, values) {
      const result = await supa.from('chat_participants').update(values).eq('conversation_id', id).eq('user_id', ctx.user.id);
      if (result.error) { alert(result.error.message || tr('Could not update the conversation.', 'Не удалось изменить диалог.')); return; }
      await loadConversations();
      const current = state.conversations.find((item) => item.id === id);
      if (current && state.activeConversationId === id) $('#composeForm').style.display = current.blocked ? 'none' : 'flex';
    }

    async function deleteConversationForEveryone(id) {
      if (!window.confirm(tr('Delete this conversation and all messages for everyone? This cannot be undone.', 'Удалить диалог и все сообщения у всех? Это действие нельзя отменить.'))) return;
      const result = await supa.rpc('delete_chat_for_everyone', { target_conversation_id: id });
      if (result.error) { alert(result.error.message || tr('Could not delete the conversation.', 'Не удалось удалить диалог.')); return; }
      if (state.activeConversationId === id) {
        state.activeConversationId = null;
        $('#composeForm').style.display = 'none';
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Choose a chat on the left to start messaging.', 'Выберите чат слева, чтобы начать переписку.')) + '</div>';
        $('#msgWrap').classList.remove('thread-open');
      }
      await loadConversations();
    }

    async function openConversation(id) {
      state.activeConversationId = id;
      const conversation = state.conversations.find((item) => item.id === id);
      if (conversation) conversation.unread = 0;
      renderConversations();
      $('#threadTitle').textContent = conversation ? conversation.name : tr('Chat', 'Чат');
      $('#threadTyping').textContent = '';
      $('#composeForm').style.display = conversation && conversation.blocked ? 'none' : 'flex';
      $('#msgWrap').classList.add('thread-open');
      $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      try {
        const { data } = await supa.from('chat_messages')
          .select('id,conversation_id,sender_id,body,created_at,edited_at')
          .eq('conversation_id', id).order('created_at', { ascending: true }).limit(300);
        renderThread(data || []);
        await supa.from('chat_participants').update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', id).eq('user_id', ctx.user.id);
      } catch (error) {
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Could not load this conversation.', 'Не удалось загрузить этот диалог.')) + '</div>';
      }
      if (threadChannel) supa.removeChannel(threadChannel);
      threadChannel = supa.channel('thread-' + id + '-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, (payload) => {
          appendMessage(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, (payload) => {
          const node = $('#threadBody').querySelector('[data-message-id="' + payload.new.id + '"]');
          if (node) node.outerHTML = messageHtml(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
          const node = payload.old && $('#threadBody').querySelector('[data-message-id="' + payload.old.id + '"]');
          if (node) node.remove();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: 'conversation_id=eq.' + id }, (payload) => {
          if (!payload.new || payload.new.user_id === ctx.user.id || !payload.new.last_read_at) return;
          if (conversation) conversation.otherLastReadAt = payload.new.last_read_at;
          $('#threadBody').querySelectorAll('.bubble.me[data-created-at]').forEach((bubble) => {
            if (Date.parse(bubble.dataset.createdAt) <= Date.parse(payload.new.last_read_at)) {
              const status = bubble.querySelector('[data-delivery-status]');
              if (status) status.textContent = tr('Read', 'Прочитано');
            }
          });
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (!payload.payload || payload.payload.userId === ctx.user.id) return;
          $('#threadTyping').textContent = payload.payload.typing ? tr('typing…', 'печатает…') : '';
        }).subscribe();
    }

    async function sendCurrentMessage(body) {
      const text = body.trim();
      if (!text || !state.activeConversationId) return;
      const conversation = state.conversations.find((item) => item.id === state.activeConversationId);
      if (conversation && conversation.blocked) { alert(tr('Unblock this conversation before sending.', 'Разблокируйте диалог перед отправкой.')); return; }
      const input = $('#composeInput');
      input.value = '';
      const restore = (error) => {
        console.warn('send failed', error);
        input.value = text;
        alert((error && error.message) || tr('Could not send the message.', 'Не удалось отправить сообщение.'));
      };
      try {
        // supabase-js resolves with { data, error } instead of throwing, so the
        // error MUST be checked explicitly — otherwise a rejected insert looks
        // like a successful send that silently vanishes.
        const result = await supa.from('chat_messages')
          .insert({ conversation_id: state.activeConversationId, sender_id: ctx.user.id, body: text })
          .select('id,conversation_id,sender_id,body,created_at,edited_at')
          .single();
        if (result.error) { restore(result.error); return; }
        // Render immediately instead of waiting on the realtime echo.
        appendMessage(result.data);
      } catch (error) {
        restore(error);
      }
    }

    function setGroupMode(on) {
      chatGroupMode = on;
      chatGroupSel.clear();
      $('#groupTitle').style.display = on ? 'block' : 'none';
      $('#createGroupBtn').style.display = on ? 'block' : 'none';
      updateGroupBtn();
      searchPeople($('#chatSearch').value);
    }

    function updateGroupBtn() {
      $('#createGroupBtn').textContent = tr('Create group', 'Создать группу') + ' (' + chatGroupSel.size + ')';
      $('#createGroupBtn').disabled = chatGroupSel.size < 2;
    }

    function toggleGroupPerson(id) {
      if (chatGroupSel.has(id)) {
        chatGroupSel.delete(id);
      } else {
        const person = lastPeopleResults.find((item) => item.id === id);
        chatGroupSel.set(id, (person && person.full_name) || 'Duvela');
      }
      updateGroupBtn();
      searchPeople($('#chatSearch').value);
    }

    async function createGroupChat() {
      const title = $('#groupTitle').value.trim();
      if (!title) {
        alert(tr('Enter a group name.', 'Введите название группы.'));
        return;
      }
      if (chatGroupSel.size < 2) {
        alert(tr('Pick at least 2 people.', 'Выберите хотя бы 2 человек.'));
        return;
      }
      try {
        const { data, error } = await supa.rpc('create_group_chat', { group_title: title, member_ids: Array.from(chatGroupSel.keys()) });
        if (error) throw error;
        const id = typeof data === 'string' ? data : null;
        $('#newChatOverlay').classList.remove('open');
        await loadConversations();
        if (id) openConversation(id);
      } catch (error) {
        alert(error.message || tr('Could not create the group.', 'Не удалось создать группу.'));
      }
    }

    async function searchPeople(query) {
      const picker = $('#chatPicker');
      const q = query.trim();
      try {
        let results = [];
        const rpc = await supa.rpc('search_chat_profiles', { result_limit: 20, search_text: q });
        if (!rpc.error && rpc.data) {
          results = rpc.data;
        } else {
          let request = supa.from('profiles').select(CHAT_PROFILE_FIELDS).neq('id', ctx.user.id).limit(20);
          if (q) request = request.or('full_name.ilike.%' + q.replace(/[%,()]/g, '') + '%,city.ilike.%' + q.replace(/[%,()]/g, '') + '%');
          const fallback = await request;
          results = (fallback.data || []).filter((person) => person.id !== ctx.user.id);
        }
        lastPeopleResults = results;
        picker.innerHTML = results.length ? results.map((person) => {
          const selected = chatGroupMode && chatGroupSel.has(person.id);
          return '<div class="conv' + (selected ? ' active' : '') + '" data-person="' + esc(person.id) + '">' +
            '<div class="avatar">' + avatarInner(person.full_name, person.avatar_url) + '</div>' +
            '<div><h3>' + esc(person.full_name || tr('Duvela user', 'Пользователь Duvela')) + '</h3><p>' + esc([person.city, person.country].filter(Boolean).join(', ') || 'Duvela') + '</p></div>' +
            '<div>' + (chatGroupMode ? (selected ? '✓' : '+') : '') + '</div>' +
          '</div>';
        }).join('') : '<div class="empty">' + esc(tr('No people found.', 'Люди не найдены.')) + '</div>';
      } catch (error) {
        picker.innerHTML = '<div class="empty">' + esc(tr('Search is unavailable right now.', 'Поиск сейчас недоступен.')) + '</div>';
      }
    }

    async function startChatWith(otherUserId) {
      try {
        const { data, error } = await supa.rpc('create_direct_chat', { target_user_id: otherUserId });
        if (error) throw error;
        const id = typeof data === 'string' ? data : null;
        if (id) await supa.rpc('restore_own_chat', { target_conversation_id: id });
        $('#newChatOverlay').classList.remove('open');
        await loadConversations();
        if (id) openConversation(id);
      } catch (error) {
        console.warn('create chat failed', error);
        alert(tr('Could not start the chat.', 'Не удалось создать чат.'));
      }
    }

    function renderMessages() {
      renderConversations();
    }

    function bindEvents() {
      $('#conversationList').addEventListener('click', (event) => {
        const action = event.target.closest('[data-conv-action]');
        if (!action && !event.target.closest('.conv-actions')) return;
        event.stopPropagation();
        if (!action) return;
        event.preventDefault();
        const id = action.dataset.id;
        const conversation = state.conversations.find((item) => item.id === id);
        if (!conversation) return;
        if (action.dataset.convAction === 'pin') updateConversationPreference(id, { is_pinned: !conversation.pinned });
        if (action.dataset.convAction === 'archive') updateConversationPreference(id, { is_archived: !conversation.archived });
        if (action.dataset.convAction === 'block') updateConversationPreference(id, { is_blocked: !conversation.ownBlocked });
        if (action.dataset.convAction === 'remove') removeConversation(id);
        if (action.dataset.convAction === 'delete-all') deleteConversationForEveryone(id);
      });
      $('#threadBody').addEventListener('click', (event) => {
        const menuButton = event.target.closest('[data-message-menu]');
        if (menuButton) {
          const bubble = menuButton.closest('.bubble');
          $('#threadBody').querySelectorAll('.bubble.menu-open').forEach((item) => { if (item !== bubble) item.classList.remove('menu-open'); });
          bubble.classList.toggle('menu-open');
          return;
        }
        const action = event.target.closest('[data-message-action]');
        if (!action) return;
        const id = action.dataset.id;
        if (action.dataset.messageAction === 'edit') editMessage(id);
        if (action.dataset.messageAction === 'copy') copyMessage(id);
        if (action.dataset.messageAction === 'delete') deleteMessage(id);
      });
      $('#archiveToggle').addEventListener('click', () => {
        showingArchive = !showingArchive;
        $('#archiveToggle').classList.toggle('active', showingArchive);
        $('#archiveToggle').textContent = showingArchive ? tr('Chats', 'Чаты') : tr('Archive', 'Архив');
        renderConversations();
      });
      $('#newChatBtn').addEventListener('click', () => {
        $('#chatSearch').value = '';
        $('#groupTitle').value = '';
        $('#groupToggle').checked = false;
        setGroupMode(false);
        $('#chatPicker').innerHTML = '<div class="empty">' + esc(tr('Type a name to search.', 'Введите имя для поиска.')) + '</div>';
        $('#newChatOverlay').classList.add('open');
        searchPeople('');
        setTimeout(() => $('#chatSearch').focus(), 50);
      });
      $('#groupToggle').addEventListener('change', (event) => setGroupMode(event.target.checked));
      $('#createGroupBtn').addEventListener('click', createGroupChat);
      $('#newChatClose').addEventListener('click', () => $('#newChatOverlay').classList.remove('open'));
      $('#newChatOverlay').addEventListener('click', (event) => {
        if (event.target === $('#newChatOverlay')) $('#newChatOverlay').classList.remove('open');
      });
      $('#chatSearch').addEventListener('input', (event) => {
        clearTimeout(chatSearchTimer);
        const value = event.target.value;
        chatSearchTimer = setTimeout(() => searchPeople(value), 250);
      });
      $('#threadBack').addEventListener('click', () => {
        $('#msgWrap').classList.remove('thread-open');
      });
      $('#composeForm').addEventListener('submit', (event) => {
        event.preventDefault();
        sendCurrentMessage($('#composeInput').value);
      });
      $('#composeInput').addEventListener('input', () => {
        if (!threadChannel) return;
        threadChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: ctx.user.id, typing: true } });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (threadChannel) threadChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: ctx.user.id, typing: false } });
        }, 1200);
      });
    }

    function cleanup() {
      if (threadChannel) supa.removeChannel(threadChannel);
      threadChannel = null;
      clearTimeout(typingTimer);
    }

    return {
      bindEvents,
      cleanup,
      isGroupMode: () => chatGroupMode,
      loadConversations,
      openConversation,
      renderMessages,
      startChatWith,
      toggleGroupPerson
    };
  }

  window.DuvelaAppMessages = { create: createMessagesFeature };
})();
