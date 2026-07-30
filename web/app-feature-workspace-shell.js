(function () {
  function createWorkspaceShellFeature(ctx) {
    const { $, tr, esc, roleLabels } = ctx;
    const notesKey = () => 'duvela.businessNotes.' + ((ctx.user && ctx.user.id) || 'guest');

    function focusRow(index, title, copy) {
      return '<div class="hub-focus-row"><div class="n">' + index + '</div><div><b>' + esc(title) + '</b><p>' + esc(copy) + '</p></div></div>';
    }

    function renderWorkspace() {
      const creator = ctx.isBusiness();
      $('#workspaceNavLabel').textContent = creator ? tr('Notes', 'Заметки') : tr('Practice', 'Практика');
      $('#workspaceTitle').textContent = creator ? tr('Notes', 'Заметки') : tr('Practice', 'Практика');
      $('#workspaceSub').textContent = creator
        ? tr('Plan lessons, events, content and team follow-ups.', 'Планируйте уроки, события, контент и задачи команды.')
        : tr('Take practices from teachers.', 'Проходите практики от преподавателей.');
      $('#workspacePrimaryTitle').textContent = creator ? tr('Your notes', 'Ваши заметки') : tr('Teacher practices', 'Практики от преподавателей');
      if (creator) {
        document.querySelector('[data-panel="workspace"]')?.classList.remove('learner-practice-panel');
        renderCreatorNotes();
        return;
      }
      document.querySelector('[data-panel="workspace"]')?.classList.add('learner-practice-panel');
      var studyHtml = ctx.studyToolsHtml ? ctx.studyToolsHtml() : '';
      $('#workspaceActions').innerHTML =
        studyHtml +
        '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Teacher practices', 'Teacher practices')) + '</h2><span>' + esc(tr('Published by creators', 'Published by creators')) + '</span></div>' +
        ctx.practicesHtml() +
        ctx.challengesHtml();
      if (ctx.bindStudyTiles) ctx.bindStudyTiles();
      renderWorkspaceSide(false);
    }

    let notesCache = [];
    let notesLoaded = false;
    let notesFilter = 'all';
    let notesSearch = '';
    let autosaveTimer = null;

    function normalizeNote(row) {
      return {
        id: row.id,
        title: row.title || '',
        text: row.body || row.text || '',
        type: row.note_type || row.type || 'lesson',
        typeLabel: row.typeLabel || noteTypeLabel(row.note_type || row.type || 'lesson'),
        status: row.status || 'draft',
        isPinned: !!(row.is_pinned || row.isPinned),
        dueDate: row.due_date || row.dueDate || '',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
        localOnly: !!row.localOnly
      };
    }

    function loadLocalNotes() {
      try {
        var parsed = JSON.parse(localStorage.getItem(notesKey()) || '[]');
        return Array.isArray(parsed) ? parsed.map(normalizeNote) : [];
      } catch (error) {
        return [];
      }
    }

    function saveLocalNotes(notes) {
      localStorage.setItem(notesKey(), JSON.stringify(notes));
    }

    async function loadNotes() {
      if (notesLoaded) return notesCache;
      var local = loadLocalNotes();
      notesCache = local;
      notesLoaded = true;
      if (ctx.user && ctx.user.id && ctx.supa) {
        var result = await ctx.supa.from('business_notes').select('id,title,body,note_type,status,is_pinned,due_date,created_at,updated_at').eq('user_id', ctx.user.id).order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200);
        if (!result.error) {
          notesCache = (result.data || []).map(normalizeNote);
          saveLocalNotes(notesCache);
        }
      }
      return notesCache;
    }

    async function persistNote(note) {
      var payload = {
        user_id: ctx.user && ctx.user.id,
        title: note.title,
        body: note.text,
        note_type: note.type,
        status: note.status,
        is_pinned: !!note.isPinned,
        due_date: note.dueDate || null,
        updated_at: new Date().toISOString()
      };
      if (ctx.user && ctx.user.id && ctx.supa) {
        var result = note.localOnly || String(note.id).indexOf('local-') === 0
          ? await ctx.supa.from('business_notes').insert(payload).select('id,title,body,note_type,status,is_pinned,due_date,created_at,updated_at').single()
          : await ctx.supa.from('business_notes').update(payload).eq('id', note.id).eq('user_id', ctx.user.id).select('id,title,body,note_type,status,is_pinned,due_date,created_at,updated_at').single();
        if (!result.error && result.data) return normalizeNote(result.data);
      }
      return Object.assign({}, note, { localOnly: true, updatedAt: new Date().toISOString() });
    }

    function visibleNotes(notes) {
      var q = notesSearch.trim().toLowerCase();
      return notes.filter(function (note) {
        var typeOk = notesFilter === 'all' || note.type === notesFilter;
        var textOk = !q || [note.title, note.text, note.typeLabel, note.status].join(' ').toLowerCase().indexOf(q) !== -1;
        return typeOk && textOk;
      }).sort(function (a, b) {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
    }

    function statusLabel(status) {
      var labels = { draft: tr('Draft', 'Черновик'), todo: tr('Todo', 'Задача'), done: tr('Done', 'Готово') };
      return labels[status] || labels.draft;
    }

    function noteCard(note) {
      var date = note.updatedAt || note.createdAt;
      return '<article class="note-card' + (note.isPinned ? ' pinned' : '') + '" data-note-id="' + esc(note.id) + '">' +
        '<div class="note-card-top"><span class="tag ' + esc(note.type || '') + '">' + esc(note.typeLabel || tr('Note', 'Заметка')) + '</span><small>' + esc(date ? new Date(date).toLocaleString() : tr('Today', 'Сегодня')) + '</small></div>' +
        '<h3>' + (note.isPinned ? '📌 ' : '') + esc(note.title || tr('Untitled note', 'Без названия')) + '</h3>' +
        '<div class="note-meta"><span>' + esc(statusLabel(note.status)) + '</span>' + (note.dueDate ? '<span>Due: ' + esc(note.dueDate) + '</span>' : '') + (note.localOnly ? '<span>Local</span>' : '') + '</div>' +
        '<p>' + esc(note.text || '') + '</p>' +
        '<div class="note-actions"><button type="button" data-note-pin="' + esc(note.id) + '">' + esc(note.isPinned ? tr('Unpin', 'Открепить') : tr('Pin', 'Закрепить')) + '</button><button type="button" data-note-edit="' + esc(note.id) + '">' + esc(tr('Edit', 'Изменить')) + '</button><button type="button" data-note-copy="' + esc(note.id) + '">' + esc(tr('Copy', 'Копировать')) + '</button><button type="button" data-note-download="' + esc(note.id) + '">' + esc(tr('Download', 'Скачать')) + '</button><button type="button" data-note-delete="' + esc(note.id) + '">' + esc(tr('Delete', 'Удалить')) + '</button></div>' +
      '</article>';
    }

    async function renderCreatorNotes(editId) {
      var notes = await loadNotes();
      var editing = notes.find(function (note) { return note.id === editId; }) || null;
      var list = visibleNotes(notes);
      var filterButton = function (id, label) { return '<button type="button" class="' + (notesFilter === id ? 'active' : '') + '" data-note-filter="' + esc(id) + '">' + esc(label) + '</button>'; };
      $('#workspaceActions').innerHTML =
        '<div class="notes-page">' +
          '<form id="noteForm" class="note-form">' +
            '<div class="note-form-head"><div><h2>' + esc(editing ? tr('Edit note', 'Изменить заметку') : tr('New note', 'Новая заметка')) + '</h2><p>' + esc(tr('Autosaves while you type. Synced when the DB table is installed.', 'Автосохранение при наборе. Синхронизация работает после установки DB таблицы.')) + '</p></div><button class="btn primary" type="submit">' + esc(editing ? tr('Save note', 'Сохранить заметку') : tr('Add note', 'Добавить заметку')) + '</button></div>' +
            '<input type="hidden" id="noteId" value="' + esc(editing ? editing.id : '') + '">' +
            '<div class="form-grid">' +
              '<div class="field"><label for="noteTitle">' + esc(tr('Title', 'Заголовок')) + '</label><input id="noteTitle" maxlength="120" placeholder="' + esc(tr('For example: B1 speaking lesson plan', 'Например: план speaking урока B1')) + '" value="' + esc(editing ? editing.title : '') + '" required></div>' +
              '<div class="field"><label for="noteType">' + esc(tr('Type', 'Тип')) + '</label><select id="noteType" class="role-select"><option value="lesson"' + (editing && editing.type === 'lesson' ? ' selected' : '') + '>Lesson</option><option value="content"' + (editing && editing.type === 'content' ? ' selected' : '') + '>Content</option><option value="event"' + (editing && editing.type === 'event' ? ' selected' : '') + '>Event</option><option value="student"' + (editing && editing.type === 'student' ? ' selected' : '') + '>Student</option><option value="business"' + (editing && editing.type === 'business' ? ' selected' : '') + '>Business</option></select></div>' +
              '<div class="field"><label for="noteStatus">' + esc(tr('Status', 'Статус')) + '</label><select id="noteStatus" class="role-select"><option value="draft"' + (editing && editing.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="todo"' + (editing && editing.status === 'todo' ? ' selected' : '') + '>Todo</option><option value="done"' + (editing && editing.status === 'done' ? ' selected' : '') + '>Done</option></select></div>' +
              '<div class="field"><label for="noteDue">' + esc(tr('Deadline', 'Дедлайн')) + '</label><input id="noteDue" type="date" value="' + esc(editing ? editing.dueDate : '') + '"></div>' +
            '</div>' +
            '<label class="note-pin-check"><input id="notePinned" type="checkbox"' + (editing && editing.isPinned ? ' checked' : '') + '> ' + esc(tr('Pin this note', 'Закрепить заметку')) + '</label>' +
            '<div class="field"><label for="noteText">' + esc(tr('Note', 'Заметка')) + '</label><textarea id="noteText" rows="7" maxlength="2000" placeholder="' + esc(tr('Write the plan, checklist or idea here...', 'Напишите план, чеклист или идею здесь...')) + '" required>' + esc(editing ? editing.text : '') + '</textarea></div>' +
            '<div class="note-form-foot"><span id="noteFormStatus">' + esc(tr('Draft autosaves locally.', 'Черновик автосохраняется локально.')) + '</span>' + (editing ? '<button class="btn" type="button" id="noteCancel">' + esc(tr('Cancel edit', 'Отменить редактирование')) + '</button>' : '') + '</div>' +
          '</form>' +
          '<section class="note-list-wrap"><div class="section-head"><h2>' + esc(tr('Saved notes', 'Сохранённые заметки')) + '</h2><span>' + list.length + '/' + notes.length + '</span></div>' +
          '<div class="note-toolbar"><input id="noteSearch" placeholder="' + esc(tr('Search notes...', 'Поиск заметок...')) + '" value="' + esc(notesSearch) + '"><div>' + filterButton('all', 'All') + filterButton('lesson', 'Lesson') + filterButton('content', 'Content') + filterButton('event', 'Event') + filterButton('student', 'Student') + filterButton('business', 'Business') + '</div></div>' +
          (list.length ? '<div class="note-grid">' + list.map(noteCard).join('') + '</div>' : '<div class="empty note-empty">' + esc(tr('No notes match this search.', 'Нет заметок по этому поиску.')) + '</div>') +
          '</section>' +
        '</div>';
      renderWorkspaceSide(true);
      bindNotes();
    }

    function noteTypeLabel(type) {
      var labels = { lesson: tr('Lesson', 'Урок'), content: tr('Content', 'Контент'), event: tr('Event', 'Событие'), student: tr('Student', 'Ученик'), business: tr('Business', 'Бизнес') };
      return labels[type] || tr('Note', 'Заметка');
    }

    function formNote(existing) {
      var type = $('#noteType').value;
      return {
        id: $('#noteId').value || 'local-' + (((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()))),
        title: $('#noteTitle').value.trim(), text: $('#noteText').value.trim(), type: type,
        typeLabel: noteTypeLabel(type), status: $('#noteStatus').value || 'draft', isPinned: !!$('#notePinned').checked,
        dueDate: $('#noteDue').value || '', createdAt: existing ? existing.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString(), localOnly: existing ? existing.localOnly : true
      };
    }

    async function upsertNoteFromForm(silent) {
      var hidden = $('#noteId');
      var id = hidden ? hidden.value : '';
      var existing = id ? notesCache.find(function (note) { return note.id === id; }) : null;
      var next = formNote(existing);
      if (!next.title || !next.text) return;
      var saved = await persistNote(next);
      if (hidden) hidden.value = saved.id;
      notesCache = existing
        ? notesCache.map(function (note) { return note.id === existing.id ? saved : note; })
        : (notesCache.some(function (note) { return note.id === saved.id; }) ? notesCache.map(function (note) { return note.id === saved.id ? saved : note; }) : [saved].concat(notesCache));
      saveLocalNotes(notesCache);
      if (silent) { var status = $('#noteFormStatus'); if (status) status.textContent = tr('Autosaved.', 'Автосохранено.'); return; }
      renderCreatorNotes();
    }

    function bindNotes() {
      var form = $('#noteForm');
      if (form) form.addEventListener('submit', function (event) { event.preventDefault(); upsertNoteFromForm(false); });
      ['noteTitle','noteText','noteType','noteStatus','noteDue','notePinned'].forEach(function (id) {
        var el = $('#' + id); if (!el) return;
        el.addEventListener(id === 'notePinned' ? 'change' : 'input', function () {
          clearTimeout(autosaveTimer);
          autosaveTimer = setTimeout(function () { upsertNoteFromForm(true); }, 800);
        });
      });
      var search = $('#noteSearch');
      if (search) search.addEventListener('input', function () { notesSearch = search.value; renderCreatorNotes(); });
      document.querySelectorAll('[data-note-filter]').forEach(function (button) { button.addEventListener('click', function () { notesFilter = button.dataset.noteFilter; renderCreatorNotes(); }); });
      var cancel = $('#noteCancel'); if (cancel) cancel.addEventListener('click', function () { renderCreatorNotes(); });
      document.querySelectorAll('[data-note-delete]').forEach(function (button) { button.addEventListener('click', async function () { var id = button.dataset.noteDelete; if (ctx.supa && String(id).indexOf('local-') !== 0) await ctx.supa.from('business_notes').delete().eq('id', id).eq('user_id', ctx.user.id); notesCache = notesCache.filter(function (note) { return note.id !== id; }); saveLocalNotes(notesCache); renderCreatorNotes(); }); });
      document.querySelectorAll('[data-note-edit]').forEach(function (button) { button.addEventListener('click', function () { renderCreatorNotes(button.dataset.noteEdit); }); });
      document.querySelectorAll('[data-note-pin]').forEach(function (button) { button.addEventListener('click', async function () { var note = notesCache.find(function (n) { return n.id === button.dataset.notePin; }); if (!note) return; note.isPinned = !note.isPinned; var saved = await persistNote(note); notesCache = notesCache.map(function (n) { return n.id === note.id ? saved : n; }); saveLocalNotes(notesCache); renderCreatorNotes(); }); });
      document.querySelectorAll('[data-note-copy]').forEach(function (button) { button.addEventListener('click', async function () { var note = notesCache.find(function (n) { return n.id === button.dataset.noteCopy; }); if (!note) return; await navigator.clipboard?.writeText((note.title || '') + '\n\n' + (note.text || '')); }); });
      document.querySelectorAll('[data-note-download]').forEach(function (button) { button.addEventListener('click', function () { var note = notesCache.find(function (n) { return n.id === button.dataset.noteDownload; }); if (!note) return; var blob = new Blob([(note.title || '') + '\n\n' + (note.text || '')], { type: 'text/plain;charset=utf-8' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (note.title || 'duvela-note').replace(/[^a-z0-9а-яё_-]+/gi, '-').slice(0, 60) + '.txt'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }); });
    }

    function renderWorkspaceSide(creator) {
      const side = $('#workspaceSide');
      if (creator) {
        var notes = notesCache || [];
        side.innerHTML =
          '<div class="section-head"><h2>' + esc(tr('Notes summary', 'Сводка заметок')) + '</h2><span>' + esc(tr('Local workspace', 'Локальная зона')) + '</span></div>' +
          '<div class="note-side-card">' +
            focusRow('1', tr('Lesson plans', 'Планы уроков'), tr('Prepare structure before LIVE or Zoom.', 'Готовьте структуру перед LIVE или Zoom.')) +
            focusRow('2', tr('Content and event ideas', 'Идеи контента и событий'), tr('Save media, course, event and campaign ideas.', 'Сохраняйте идеи медиа, курсов, событий и кампаний.')) +
            focusRow('3', tr('Follow-ups', 'Follow-up'), tr('Track students, clients, leads and team tasks.', 'Отмечайте учеников, клиентов, лиды и задачи команды.')) +
          '</div>' +
          '<div class="note-mini-stats"><div><b>' + notes.length + '</b><span>' + esc(tr('notes', 'заметок')) + '</span></div><div><b>' + notes.filter(function (n) { return n.isPinned; }).length + '</b><span>' + esc(tr('pinned', 'закреплено')) + '</span></div></div>';
        return;
      }
      const saved = (() => {
        try { return JSON.parse(localStorage.getItem('duvela.webNote') || '{}'); } catch (error) { return {}; }
      })();
      const grammar = ctx.profile?.grammar_progress ?? 0;
      const speaking = ctx.profile?.speaking_progress ?? 0;
      const vocabulary = ctx.profile?.vocabulary_progress ?? 0;
      side.innerHTML =
        '<div class="section-head"><h2>' + esc(tr('Today focus', 'Today focus')) + '</h2><span>' + esc(tr('Learner mode', 'Learner mode')) + '</span></div>' +
        '<div class="hub-focus-card card" style="box-shadow:none">' +
          focusRow('1', tr('Warm up', 'Warm up'), tr('Run one flashcard or grammar tool before browsing.', 'Run one flashcard or grammar tool before browsing.')) +
          focusRow('2', tr('Do the hard rep', 'Do the hard rep'), tr('Open a teacher practice or submit one course task.', 'Open a teacher practice or submit one course task.')) +
          focusRow('3', tr('Close the loop', 'Close the loop'), tr('Save one note or book a teacher slot.', 'Save one note or book a teacher slot.')) +
        '</div>' +
        '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Skill balance', 'Skill balance')) + '</h2><span>' + esc(tr('Profile progress', 'Profile progress')) + '</span></div>' +
        '<div class="prog-row"><div class="prog-label"><span>' + esc(tr('Grammar', 'Grammar')) + '</span><span>' + grammar + '%</span></div><div class="prog-bar"><i style="width:' + grammar + '%"></i></div></div>' +
        '<div class="prog-row"><div class="prog-label"><span>' + esc(tr('Speaking', 'Speaking')) + '</span><span>' + speaking + '%</span></div><div class="prog-bar"><i style="width:' + speaking + '%"></i></div></div>' +
        '<div class="prog-row"><div class="prog-label"><span>' + esc(tr('Vocabulary', 'Vocabulary')) + '</span><span>' + vocabulary + '%</span></div><div class="prog-bar"><i style="width:' + vocabulary + '%"></i></div></div>' +
        '<div class="section-head"><h2>' + esc(tr('Learning note', 'Учебная заметка')) + '</h2><span>' + esc(tr('Saved on this device', 'Сохранено на этом устройстве')) + '</span></div>' +
        '<div class="field"><label for="noteText">' + esc(tr('Your note', 'Ваша заметка')) + '</label><textarea id="noteText" placeholder="' + esc(tr('Words to review, goals for the week...', 'Слова на повторение, цели на неделю...')) + '">' + esc(saved.text || '') + '</textarea></div>' +
        '<button class="btn primary" id="noteSave" type="button" style="margin-top:8px">' + esc(tr('Save note', 'Сохранить заметку')) + '</button>' +
        '<div id="noteSaved" style="display:none;color:var(--teal);font-weight:900;margin-top:8px">' + esc(tr('Saved ✓', 'Сохранено ✓')) + '</div>';
      $('#noteSave').addEventListener('click', () => {
        localStorage.setItem('duvela.webNote', JSON.stringify({ text: $('#noteText').value, savedAt: new Date().toISOString() }));
        $('#noteSaved').style.display = 'block';
        setTimeout(() => { $('#noteSaved').style.display = 'none'; }, 1800);
      });
    }

    return {
      renderWorkspace
    };
  }

  window.DuvelaAppWorkspaceShell = { create: createWorkspaceShellFeature };
})();
