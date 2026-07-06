(function () {
  function createMessagesFeature(ctx) {
    const { $, tr, esc, state, supa, alert, avatarInner } = ctx;
    const CHAT_PROFILE_FIELDS = 'id,full_name,avatar_url,city,country';
    let threadChannel = null;
    let chatSearchTimer = null;
    let chatGroupMode = false;
    const chatGroupSel = new Map();
    let lastPeopleResults = [];

    async function loadConversations() {
      try {
        const { data: mine } = await supa.from('chat_participants')
          .select('conversation_id,last_read_at').eq('user_id', ctx.user.id);
        const ids = (mine || []).map((row) => row.conversation_id);
        if (!ids.length) {
          state.conversations = [];
          renderConversations();
          return;
        }
        const lastReadById = new Map((mine || []).map((row) => [row.conversation_id, row.last_read_at ? Date.parse(row.last_read_at) : 0]));
        const [{ data: convs }, { data: parts }, { data: msgs }] = await Promise.all([
          supa.from('chat_conversations').select('id,title,is_group,updated_at,created_at').in('id', ids),
          supa.from('chat_participants').select('conversation_id,user_id').in('conversation_id', ids),
          supa.from('chat_messages').select('id,conversation_id,sender_id,body,created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300)
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
          const members = partsByConv.get(conversation.id) || [];
          const otherId = members.find((id) => id !== ctx.user.id) || members[0] || '';
          const other = otherId ? profById.get(otherId) : null;
          const last = lastByConv.get(conversation.id);
          return {
            id: conversation.id,
            isGroup: !!conversation.is_group,
            name: (conversation.title || '').trim() || (other && other.full_name) || (conversation.is_group ? tr('Group chat', 'Р“СЂСѓРїРїРѕРІРѕР№ С‡Р°С‚') : tr('Chat', 'Р§Р°С‚')),
            avatarUrl: other && other.avatar_url,
            lastMessage: last ? last.body : '',
            lastAt: last ? last.created_at : (conversation.updated_at || conversation.created_at),
            unread: unreadByConv.get(conversation.id) || 0
          };
        }).sort((a, b) => Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0));
      } catch (error) {
        console.warn('conversations load failed', error);
        state.conversations = [];
      }
      renderConversations();
    }

    function renderConversations() {
      const list = $('#conversationList');
      if (!list) return;
      if (!state.conversations.length) {
        list.innerHTML = '<div class="card empty">' + esc(tr('No conversations yet. Tap “New chat” to message a teacher or learner.', 'Р”РёР°Р»РѕРіРѕРІ РїРѕРєР° РЅРµС‚. РќР°Р¶РјРёС‚Рµ «РќРѕРІС‹Р№ С‡Р°С‚», С‡С‚РѕР±С‹ РЅР°РїРёСЃР°С‚СЊ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЋ РёР»Рё СѓС‡РµРЅРёРєСѓ.')) + '</div>';
        return;
      }
      list.innerHTML = state.conversations.map((conversation) =>
        '<div class="conv' + (conversation.id === state.activeConversationId ? ' active' : '') + '" data-conv="' + esc(conversation.id) + '">' +
          '<div class="avatar">' + avatarInner(conversation.name, conversation.avatarUrl) + '</div>' +
          '<div><h3>' + esc(conversation.name) + '</h3><p>' + esc(conversation.lastMessage || tr('No messages yet', 'РЎРѕРѕР±С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚')) + '</p></div>' +
          (conversation.unread ? '<div class="unread">' + conversation.unread + '</div>' : '<div></div>') +
        '</div>'
      ).join('');
    }

    function renderThread(messages) {
      const body = $('#threadBody');
      if (!body) return;
      body.innerHTML = messages.length
        ? messages.map((message) => '<div class="bubble ' + (message.sender_id === ctx.user.id ? 'me' : 'them') + '">' + esc(message.body) + '</div>').join('')
        : '<div class="empty">' + esc(tr('No messages yet. Say hello.', 'РЎРѕРѕР±С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚. РќР°РїРёС€РёС‚Рµ РїРµСЂРІС‹Рј.')) + '</div>';
      body.scrollTop = body.scrollHeight;
    }

    async function openConversation(id) {
      state.activeConversationId = id;
      const conversation = state.conversations.find((item) => item.id === id);
      if (conversation) conversation.unread = 0;
      renderConversations();
      $('#threadTitle').textContent = conversation ? conversation.name : tr('Chat', 'Р§Р°С‚');
      $('#composeForm').style.display = 'flex';
      $('#msgWrap').classList.add('thread-open');
      $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Р—Р°РіСЂСѓР·РєР°...')) + '</div>';
      try {
        const { data } = await supa.from('chat_messages')
          .select('id,conversation_id,sender_id,body,created_at')
          .eq('conversation_id', id).order('created_at', { ascending: true }).limit(300);
        renderThread(data || []);
        await supa.from('chat_participants').update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', id).eq('user_id', ctx.user.id);
      } catch (error) {
        $('#threadBody').innerHTML = '<div class="empty">' + esc(tr('Could not load this conversation.', 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЌС‚РѕС‚ РґРёР°Р»РѕРі.')) + '</div>';
      }
      if (threadChannel) supa.removeChannel(threadChannel);
      threadChannel = supa.channel('thread-' + id + '-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, (payload) => {
          const message = payload.new;
          const body = $('#threadBody');
          const empty = body.querySelector('.empty');
          if (empty) body.innerHTML = '';
          body.insertAdjacentHTML('beforeend', '<div class="bubble ' + (message.sender_id === ctx.user.id ? 'me' : 'them') + '">' + esc(message.body) + '</div>');
          body.scrollTop = body.scrollHeight;
          if (conversation) {
            conversation.lastMessage = message.body;
            conversation.lastAt = message.created_at;
            renderConversations();
          }
        }).subscribe();
    }

    async function sendCurrentMessage(body) {
      const text = body.trim();
      if (!text || !state.activeConversationId) return;
      $('#composeInput').value = '';
      try {
        await supa.from('chat_messages').insert({ conversation_id: state.activeConversationId, sender_id: ctx.user.id, body: text });
      } catch (error) {
        console.warn('send failed', error);
        $('#composeInput').value = text;
        alert(tr('Could not send the message.', 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ.'));
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
      $('#createGroupBtn').textContent = tr('Create group', 'РЎРѕР·РґР°С‚СЊ РіСЂСѓРїРїСѓ') + ' (' + chatGroupSel.size + ')';
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
        alert(tr('Enter a group name.', 'Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РіСЂСѓРїРїС‹.'));
        return;
      }
      if (chatGroupSel.size < 2) {
        alert(tr('Pick at least 2 people.', 'Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ 2 С‡РµР»РѕРІРµРє.'));
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
        alert(error.message || tr('Could not create the group.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РіСЂСѓРїРїСѓ.'));
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
            '<div><h3>' + esc(person.full_name || tr('Duvela user', 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Duvela')) + '</h3><p>' + esc([person.city, person.country].filter(Boolean).join(', ') || 'Duvela') + '</p></div>' +
            '<div>' + (chatGroupMode ? (selected ? '✓' : '+') : '') + '</div>' +
          '</div>';
        }).join('') : '<div class="empty">' + esc(tr('No people found.', 'Р›СЋРґРё РЅРµ РЅР°Р№РґРµРЅС‹.')) + '</div>';
      } catch (error) {
        picker.innerHTML = '<div class="empty">' + esc(tr('Search is unavailable right now.', 'РџРѕРёСЃРє СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ.')) + '</div>';
      }
    }

    async function startChatWith(otherUserId) {
      try {
        const { data, error } = await supa.rpc('create_direct_chat', { target_user_id: otherUserId });
        if (error) throw error;
        const id = typeof data === 'string' ? data : null;
        $('#newChatOverlay').classList.remove('open');
        await loadConversations();
        if (id) openConversation(id);
      } catch (error) {
        console.warn('create chat failed', error);
        alert(tr('Could not start the chat.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‡Р°С‚.'));
      }
    }

    function renderMessages() {
      renderConversations();
    }

    function bindEvents() {
      $('#newChatBtn').addEventListener('click', () => {
        $('#chatSearch').value = '';
        $('#groupTitle').value = '';
        $('#groupToggle').checked = false;
        setGroupMode(false);
        $('#chatPicker').innerHTML = '<div class="empty">' + esc(tr('Type a name to search.', 'Р’РІРµРґРёС‚Рµ РёРјСЏ РґР»СЏ РїРѕРёСЃРєР°.')) + '</div>';
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
    }

    function cleanup() {
      if (threadChannel) supa.removeChannel(threadChannel);
      threadChannel = null;
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
