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
    const e2ee = window.DuvelaChatE2EE;
    let currentMessages = [];
    let replyTo = null;
    let multiSelectMode = false;
    const recentSends = [];

    async function decryptMessages(messages) {
      return Promise.all((messages || []).map(async (message) => {
        try { return Object.assign({}, message, { body: await e2ee.decryptText(supa, ctx.user.id, message.conversation_id, message.body) }); }
        catch (_) { return Object.assign({}, message, { body: tr('🔒 Encrypted message is unavailable on this device.', '🔒 Зашифрованное сообщение недоступно на этом устройстве.') }); }
      }));
    }

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
          supa.from('chat_messages').select('id,conversation_id,sender_id,body,created_at,edited_at,reply_to_id,forwarded_from_id,attachment_path,attachment_name,attachment_type,attachment_iv').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300)
        ]);
        const decryptedMsgs = await decryptMessages(msgs || []);
        const otherIds = Array.from(new Set((parts || []).map((part) => part.user_id).filter((id) => id !== ctx.user.id)));
        const { data: profs } = otherIds.length
          ? await supa.from('profiles').select(CHAT_PROFILE_FIELDS).in('id', otherIds)
          : { data: [] };
        const { data: identities } = otherIds.length ? await supa.from('chat_e2ee_identities').select('user_id,last_seen_at').in('user_id', otherIds) : { data: [] };
        const lastSeenById = new Map((identities || []).map((item) => [item.user_id, item.last_seen_at]));
        const profById = new Map((profs || []).map((profile) => [profile.id, profile]));
        const partsByConv = new Map();
        (parts || []).forEach((part) => {
          const items = partsByConv.get(part.conversation_id) || [];
          items.push(part.user_id);
          partsByConv.set(part.conversation_id, items);
        });
        const lastByConv = new Map();
        decryptedMsgs.forEach((message) => {
          if (!lastByConv.has(message.conversation_id)) lastByConv.set(message.conversation_id, message);
        });
        const unreadByConv = new Map();
        decryptedMsgs.forEach((message) => {
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
            otherUserId: otherId,
            otherLastSeenAt: lastSeenById.get(otherId) || null,
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
      currentMessages = messages;
      let lastDay = '';
      body.innerHTML = messages.length
        ? messages.map((message) => {
            const day = message.created_at ? new Date(message.created_at).toLocaleDateString() : '';
            const divider = day !== lastDay ? '<div class="date-divider">' + esc(day) + '</div>' : '';
            lastDay = day;
            return divider + messageHtml(message);
          }).join('')
        : '<div class="empty">' + esc(tr('No messages yet. Say hello.', 'Сообщений пока нет. Напишите первым.')) + '</div>';
      body.scrollTop = body.scrollHeight;
    }

    function messageHtml(message) {
      const mine = message.sender_id === ctx.user.id;
      const conversation = state.conversations.find((item) => item.id === message.conversation_id);
      const read = mine && conversation && conversation.otherLastReadAt && Date.parse(conversation.otherLastReadAt) >= Date.parse(message.created_at);
      const time = message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const replied = message.reply_to_id && currentMessages.find((item) => item.id === message.reply_to_id);
      return '<div class="bubble ' + (mine ? 'me' : 'them') + '" data-message-id="' + esc(message.id || '') + '" data-created-at="' + esc(message.created_at || '') + '">' +
        (multiSelectMode ? '<input class="message-check" type="checkbox" aria-label="Select message">' : '') +
        (replied ? '<div class="bubble-quote">' + esc(replied.body.slice(0, 90)) + '</div>' : '') +
        (message.forwarded_from_id ? '<div class="bubble-quote">' + esc(tr('Forwarded', 'Переслано')) + '</div>' : '') +
        '<span class="bubble-text">' + esc(message.body) + '</span>' +
        (message.attachment_path ? '<div><button type="button" class="btn" data-download-attachment="' + esc(message.id) + '">📎 ' + esc(message.attachment_name || tr('Encrypted file', 'Зашифрованный файл')) + '</button></div>' : '') +
        (message.reactions && message.reactions.length ? '<div class="bubble-reactions">' + message.reactions.map((item) => '<button type="button">' + esc(item.emoji) + ' ' + item.count + '</button>').join('') + '</div>' : '') +
        '<span class="bubble-meta"><span>' + esc(time) + '</span>' + (message.edited_at ? '<span>' + esc(tr('edited', 'изменено')) + '</span>' : '') + (mine ? '<span data-delivery-status>' + esc(read ? tr('Read', 'Прочитано') : tr('Delivered', 'Доставлено')) + '</span>' : '') + '</span>' +
        (message.id ? '<button class="message-more" type="button" data-message-menu="' + esc(message.id) + '" aria-label="' + esc(tr('Message menu', 'Меню сообщения')) + '">⋯</button><div class="bubble-menu"><button type="button" data-message-action="reply" data-id="' + esc(message.id) + '">' + esc(tr('Reply', 'Ответить')) + '</button><button type="button" data-message-action="forward" data-id="' + esc(message.id) + '">' + esc(tr('Forward', 'Переслать')) + '</button><button type="button" data-message-action="react" data-id="' + esc(message.id) + '">' + esc(tr('Reaction', 'Реакция')) + '</button><button type="button" data-message-action="copy" data-id="' + esc(message.id) + '">' + esc(tr('Copy', 'Копировать')) + '</button><button type="button" data-message-action="report" data-id="' + esc(message.id) + '">' + esc(tr('Report', 'Пожаловаться')) + '</button>' + (mine ? '<button type="button" data-message-action="edit" data-id="' + esc(message.id) + '">' + esc(tr('Edit', 'Редактировать')) + '</button><button class="danger" type="button" data-message-action="delete" data-id="' + esc(message.id) + '">' + esc(tr('Delete', 'Удалить')) + '</button>' : '') + '</div>' : '') +
      '</div>';
    }

    function setReply(message) {
      replyTo = message;
      $('#replyPreview').classList.toggle('open', !!message);
      $('#replyPreviewText').textContent = message ? tr('Reply: ', 'Ответ: ') + message.body.slice(0, 100) : '';
      if (message) $('#composeInput').focus();
    }

    async function forwardMessage(message) {
      const names = state.conversations.filter((item) => item.id !== state.activeConversationId && !item.archived);
      if (!names.length) return alert(tr('There is no other chat to forward to.', 'Нет другого чата для пересылки.'));
      const name = window.prompt(tr('Enter the chat name:', 'Введите название чата:') + '\n' + names.map((item) => item.name).join(', '));
      const target = names.find((item) => item.name.toLowerCase() === String(name || '').trim().toLowerCase());
      if (!target) return;
      const body = await e2ee.encryptText(supa, ctx.user.id, target.id, message.body);
      const result = await supa.from('chat_messages').insert({ conversation_id: target.id, sender_id: ctx.user.id, body, forwarded_from_id: message.id });
      if (result.error) alert(result.error.message);
      else void supa.functions.invoke('notify-chat-message', { body: { conversationId: target.id } }).catch(() => {});
    }

    async function reactToMessage(id) {
      const emoji = window.prompt(tr('Reaction emoji:', 'Введите реакцию:'), '👍');
      if (!emoji) return;
      const result = await supa.from('chat_message_reactions').upsert({ message_id: id, user_id: ctx.user.id, emoji: emoji.slice(0, 12) });
      if (result.error) alert(result.error.message);
    }

    async function reportMessage(message) {
      if (!window.confirm(tr('Send a decrypted copy of this message with the report?', 'Отправить расшифрованную копию сообщения вместе с жалобой?'))) return;
      const reason = window.prompt(tr('Reason for report:', 'Причина жалобы:'));
      if (!reason) return;
      const result = await supa.from('chat_reports').insert({ reporter_id: ctx.user.id, conversation_id: state.activeConversationId, message_id: message.id, reported_user_id: message.sender_id, decrypted_excerpt: message.body.slice(0, 1000), reason });
      if (result.error) alert(result.error.message); else alert(tr('Report sent.', 'Жалоба отправлена.'));
    }

    async function sendAttachment(file) {
      if (!file || !state.activeConversationId) return;
      if (file.size > 20 * 1024 * 1024) return alert(tr('Maximum file size is 20 MB.', 'Максимальный размер файла — 20 МБ.'));
      try {
        const encrypted = await e2ee.encryptBytes(supa, ctx.user.id, state.activeConversationId, await file.arrayBuffer());
        const path = state.activeConversationId + '/' + crypto.randomUUID() + '.bin';
        const uploaded = await supa.storage.from('chat-encrypted').upload(path, new Blob([encrypted.cipher]), { contentType: 'application/octet-stream' });
        if (uploaded.error) throw uploaded.error;
        const body = await e2ee.encryptText(supa, ctx.user.id, state.activeConversationId, '📎 ' + file.name);
        const result = await supa.from('chat_messages').insert({ conversation_id: state.activeConversationId, sender_id: ctx.user.id, body, attachment_path: path, attachment_name: file.name, attachment_type: file.type, attachment_iv: encrypted.iv });
        if (result.error) throw result.error;
        void supa.functions.invoke('notify-chat-message', { body: { conversationId: state.activeConversationId } }).catch(() => {});
      } catch (error) { alert(error.message || tr('Could not send the file.', 'Не удалось отправить файл.')); }
    }

    async function downloadAttachment(message) {
      try {
        const downloaded = await supa.storage.from('chat-encrypted').download(message.attachment_path);
        if (downloaded.error) throw downloaded.error;
        const plain = await e2ee.decryptBytes(supa, ctx.user.id, message.conversation_id, await downloaded.data.arrayBuffer(), message.attachment_iv);
        const url = URL.createObjectURL(new Blob([plain], { type: message.attachment_type || 'application/octet-stream' }));
        const link = document.createElement('a'); link.href = url; link.download = message.attachment_name || 'attachment'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { alert(error.message || tr('Could not decrypt the file.', 'Не удалось расшифровать файл.')); }
    }

    async function editMessage(id) {
      const node = $('#threadBody').querySelector('[data-message-id="' + id + '"]');
      const current = node && node.querySelector('.bubble-text') ? node.querySelector('.bubble-text').textContent : '';
      const next = window.prompt(tr('Edit message', 'Изменить сообщение'), current);
      if (next === null || !next.trim() || next.trim() === current) return;
      const encryptedBody = await e2ee.encryptText(supa, ctx.user.id, state.activeConversationId, next.trim());
      const result = await supa.from('chat_messages').update({ body: encryptedBody, edited_at: new Date().toISOString() }).eq('id', id).eq('sender_id', ctx.user.id).select('id,conversation_id,sender_id,body,created_at,edited_at').single();
      if (result.error) { alert(result.error.message || tr('Could not edit the message.', 'Не удалось изменить сообщение.')); return; }
      if (node) node.outerHTML = messageHtml(Object.assign({}, result.data, { body: next.trim() }));
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
      if (conversation && conversation.otherLastSeenAt) $('#threadTyping').textContent = tr('last seen ', 'был(а) в сети ') + new Date(conversation.otherLastSeenAt).toLocaleString();
      $('#composeForm').style.display = conversation && conversation.blocked ? 'none' : 'flex';
      $('#msgWrap').classList.add('thread-open');
      $('#composeInput').value = localStorage.getItem('duvela.chat.draft.' + id) || '';
      $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      try {
        const { data } = await supa.from('chat_messages')
          .select('id,conversation_id,sender_id,body,created_at,edited_at,reply_to_id,forwarded_from_id,attachment_path,attachment_name,attachment_type,attachment_iv')
          .eq('conversation_id', id).order('created_at', { ascending: true }).limit(300);
        const decrypted = await decryptMessages(data || []);
        const messageIds = decrypted.map((item) => item.id);
        const reactionResult = messageIds.length ? await supa.from('chat_message_reactions').select('message_id,emoji').in('message_id', messageIds) : { data: [] };
        decrypted.forEach((message) => {
          const counts = new Map();
          (reactionResult.data || []).filter((item) => item.message_id === message.id).forEach((item) => counts.set(item.emoji, (counts.get(item.emoji) || 0) + 1));
          message.reactions = Array.from(counts, ([emoji, count]) => ({ emoji, count }));
        });
        renderThread(decrypted);
        await supa.from('chat_participants').update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', id).eq('user_id', ctx.user.id);
      } catch (error) {
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Could not load this conversation.', 'Не удалось загрузить этот диалог.')) + '</div>';
      }
      if (threadChannel) supa.removeChannel(threadChannel);
      threadChannel = supa.channel('thread-' + id + '-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, async (payload) => {
          const decrypted = await decryptMessages([payload.new]);
          appendMessage(decrypted[0]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, async (payload) => {
          const decrypted = await decryptMessages([payload.new]);
          const node = $('#threadBody').querySelector('[data-message-id="' + payload.new.id + '"]');
          if (node) node.outerHTML = messageHtml(decrypted[0]);
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
        })
        .on('presence', { event: 'sync' }, () => {
          const online = Object.values(threadChannel.presenceState()).flat().some((item) => item.userId !== ctx.user.id);
          if (!$('#threadTyping').textContent.includes(tr('typing…', 'печатает…'))) $('#threadTyping').textContent = online ? tr('online', 'в сети') : tr('offline', 'не в сети');
        }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await threadChannel.track({ userId: ctx.user.id, at: new Date().toISOString() }); });
    }

    async function sendCurrentMessage(body) {
      const text = body.trim();
      if (!text || !state.activeConversationId) return;
      const now = Date.now();
      while (recentSends.length && now - recentSends[0].at > 10000) recentSends.shift();
      if (recentSends.length >= 8 || recentSends.filter((item) => item.text === text).length >= 3) { alert(tr('Please slow down. Spam protection is active.', 'Пожалуйста, отправляйте сообщения реже. Работает защита от спама.')); return; }
      recentSends.push({ at: now, text });
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
        const encryptedBody = await e2ee.encryptText(supa, ctx.user.id, state.activeConversationId, text);
        const result = await supa.from('chat_messages')
          .insert({ conversation_id: state.activeConversationId, sender_id: ctx.user.id, body: encryptedBody, reply_to_id: replyTo && replyTo.id })
          .select('id,conversation_id,sender_id,body,created_at,edited_at,reply_to_id,forwarded_from_id,attachment_path,attachment_name,attachment_type,attachment_iv')
          .single();
        if (result.error) { restore(result.error); return; }
        // Push + in-app feed for the other participants. E2EE chat — the push
        // deliberately carries NO plaintext preview (function falls back to a
        // generic "Новое сообщение" title/body).
        void supa.functions.invoke('notify-chat-message', { body: { conversationId: state.activeConversationId } }).catch(() => {});
        // Render immediately instead of waiting on the realtime echo.
        appendMessage(Object.assign({}, result.data, { body: text }));
        setReply(null);
        localStorage.removeItem('duvela.chat.draft.' + state.activeConversationId);
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
        const attachment = event.target.closest('[data-download-attachment]');
        if (attachment) { const message = currentMessages.find((item) => item.id === attachment.dataset.downloadAttachment); if (message) downloadAttachment(message); return; }
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
        const message = currentMessages.find((item) => item.id === id);
        if (action.dataset.messageAction === 'reply' && message) setReply(message);
        if (action.dataset.messageAction === 'forward' && message) forwardMessage(message);
        if (action.dataset.messageAction === 'react') reactToMessage(id);
        if (action.dataset.messageAction === 'report' && message) reportMessage(message);
      });
      $('#archiveToggle').addEventListener('click', () => {
        showingArchive = !showingArchive;
        $('#archiveToggle').classList.toggle('active', showingArchive);
        $('#archiveToggle').textContent = showingArchive ? tr('Chats', 'Чаты') : tr('Archive', 'Архив');
        renderConversations();
      });
      $('#blockedListBtn').addEventListener('click', () => {
        const blocked = state.conversations.filter((item) => item.ownBlocked);
        if (!blocked.length) return alert(tr('The blocked list is empty.', 'Список заблокированных пуст.'));
        const name = window.prompt(tr('Blocked users. Enter a chat name to unblock:', 'Заблокированные. Введите название чата для разблокировки:') + '\n' + blocked.map((item) => item.name).join('\n'));
        const selected = blocked.find((item) => item.name.toLowerCase() === String(name || '').trim().toLowerCase());
        if (selected) updateConversationPreference(selected.id, { is_blocked: false });
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
        if (state.activeConversationId) localStorage.setItem('duvela.chat.draft.' + state.activeConversationId, $('#composeInput').value);
        if (!threadChannel) return;
        threadChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: ctx.user.id, typing: true } });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (threadChannel) threadChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: ctx.user.id, typing: false } });
        }, 1200);
      });
      $('#replyCancel').addEventListener('click', () => setReply(null));
      $('#chatFileBtn').addEventListener('click', () => $('#chatFileInput').click());
      $('#chatFileInput').addEventListener('change', () => { sendAttachment($('#chatFileInput').files[0]); $('#chatFileInput').value = ''; });
      $('#emojiBtn').addEventListener('click', () => {
        const emoji = window.prompt(tr('Choose emoji:', 'Выберите emoji:'), '😊 👍 ❤️ 😂 🎉');
        if (emoji) { $('#composeInput').value += emoji.trim().split(/\s+/)[0]; $('#composeInput').dispatchEvent(new Event('input')); }
      });
      $('#threadSearch').addEventListener('click', () => {
        const query = window.prompt(tr('Search in this conversation:', 'Поиск в переписке:'));
        $('#threadBody').querySelectorAll('.bubble').forEach((bubble) => { bubble.style.display = !query || bubble.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none'; });
      });
      $('#threadProfile').addEventListener('click', () => {
        const conversation = state.conversations.find((item) => item.id === state.activeConversationId);
        if (conversation && conversation.otherUserId) window.location.href = './profile.html?id=' + encodeURIComponent(conversation.otherUserId);
      });
      $('#multiSelectBtn').addEventListener('click', async () => {
        if (!multiSelectMode) { multiSelectMode = true; renderThread(currentMessages); return; }
        const ids = Array.from($('#threadBody').querySelectorAll('.message-check:checked')).map((input) => input.closest('.bubble').dataset.messageId);
        if (ids.length && window.confirm(tr('Delete selected own messages?', 'Удалить выбранные собственные сообщения?'))) {
          const result = await supa.from('chat_messages').delete().in('id', ids).eq('sender_id', ctx.user.id);
          if (result.error) alert(result.error.message); else currentMessages = currentMessages.filter((item) => !ids.includes(item.id));
        }
        multiSelectMode = false;
        renderThread(currentMessages);
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
