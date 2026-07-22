(function () {
  function createWorkspaceShellFeature(ctx) {
    const { $, tr, esc, roleLabels } = ctx;

    function focusRow(index, title, copy) {
      return '<div class="hub-focus-row"><div class="n">' + index + '</div><div><b>' + esc(title) + '</b><p>' + esc(copy) + '</p></div></div>';
    }

    function renderWorkspace() {
      const creator = ctx.isBusiness();
      $('#workspaceNavLabel').textContent = creator ? tr('Workspace', 'Рабочая зона') : tr('Practice', 'Практика');
      $('#workspaceTitle').textContent = creator ? roleLabels[ctx.role] + ' ' + tr('workspace', 'кабинет') : tr('Practice', 'Практика');
      $('#workspaceSub').textContent = creator
        ? tr('Publish and manage your activity.', 'Публикуйте и управляйте своей активностью.')
        : tr('Take practices from teachers.', 'Проходите практики от преподавателей.');
      $('#workspacePrimaryTitle').textContent = creator ? tr('Creator actions', 'Действия автора') : tr('Teacher practices', 'Практики от преподавателей');
      if (creator) {
        document.querySelector('[data-panel="workspace"]')?.classList.remove('learner-practice-panel');
        ctx.renderBusinessWorkspace();
        renderWorkspaceSide(true);
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

    function renderWorkspaceSide(creator) {
      const side = $('#workspaceSide');
      if (creator) {
        side.innerHTML =
          '<div class="section-head"><h2>' + esc(tr('Publish an event', 'Опубликовать событие')) + '</h2><span>' + esc(tr('Goes live to learners', 'Сразу появляется у учеников')) + '</span></div>' +
          '<form id="eventForm">' +
            '<div class="field"><label for="evTitle">' + esc(tr('Title', 'Название')) + '</label><input id="evTitle" placeholder="' + esc(tr('German speaking meetup', 'Немецкий speaking meetup')) + '" required></div>' +
            '<div class="field"><label for="evDesc">' + esc(tr('Description', 'Описание')) + '</label><textarea id="evDesc" placeholder="' + esc(tr('What happens, who it is for...', 'Что будет происходить и для кого это...')) + '"></textarea></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label for="evDate">' + esc(tr('Date', 'Дата')) + '</label><input id="evDate" type="date"></div>' +
              '<div class="field"><label for="evTime">' + esc(tr('Time', 'Время')) + '</label><input id="evTime" type="time"></div>' +
              '<div class="field"><label for="evCity">' + esc(tr('City', 'Город')) + '</label><input id="evCity" placeholder="Berlin"></div>' +
              '<div class="field"><label for="evFormat">' + esc(tr('Format', 'Формат')) + '</label><select id="evFormat" class="role-select"><option value="offline">' + esc(tr('In person', 'Оффлайн')) + '</option><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option></select></div>' +
              '<div class="field"><label for="evLang">' + esc(tr('Language', 'Язык')) + '</label><input id="evLang" placeholder="' + esc(tr('German', 'Немецкий')) + '"></div>' +
              '<div class="field"><label for="evPrice">' + esc(tr('Price (EUR, blank = free)', 'Цена (EUR, пусто = бесплатно)')) + '</label><input id="evPrice" type="number" min="0" step="1" placeholder="' + esc(tr('Free', 'Бесплатно')) + '"></div>' +
              '<div class="field"><label for="evRepeat">' + esc(tr('Repeat weekly (times)', 'Повтор еженедельно (раз)')) + '</label><input id="evRepeat" type="number" min="1" max="12" value="1"></div>' +
            '</div>' +
            '<div class="field"><label for="evImage">' + esc(tr('Cover image (optional)', 'Обложка (необязательно)')) + '</label><input id="evImage" type="file" accept="image/*"></div>' +
            '<button class="btn primary" type="submit" style="margin-top:12px">' + esc(tr('Publish event', 'Опубликовать событие')) + '</button>' +
            '<div id="evNote" style="display:none;margin-top:8px;font-weight:900"></div>' +
          '</form>';
        $('#eventForm').addEventListener('submit', ctx.publishEvent);
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
