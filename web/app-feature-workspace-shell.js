(function () {
  function createWorkspaceShellFeature(ctx) {
    const { $, tr, esc, roleLabels } = ctx;

    function renderWorkspace() {
      const creator = ctx.isBusiness();
      $('#workspaceNavLabel').textContent = creator ? tr('Workspace', 'Рабочая зона') : tr('Practice', 'Практика');
      $('#workspaceTitle').textContent = creator ? roleLabels[ctx.role] + ' ' + tr('workspace', 'кабинет') : tr('Practice', 'Практика');
      $('#workspaceSub').textContent = creator
        ? tr('Publish and manage your activity.', 'Публикуйте и управляйте своей активностью.')
        : tr('Take practices from teachers.', 'Проходите практики от преподавателей.');
      $('#workspacePrimaryTitle').textContent = creator ? tr('Creator actions', 'Действия автора') : tr('Teacher practices', 'Практики от преподавателей');
      if (creator) {
        ctx.renderBusinessWorkspace();
        renderWorkspaceSide(true);
        return;
      }
      $('#workspaceActions').innerHTML =
        '<div style="display:flex;gap:10px;margin-bottom:14px">' +
          '<button class="btn primary" id="openDuelBtn" style="flex:1">⚔️ ' + esc(tr('Duel', 'Дуэль')) + '</button>' +
          '<button class="btn" id="openChessBtn" style="flex:1">♟️ ' + esc(tr('Chess', 'Шахматы')) + '</button>' +
        '</div>' + ctx.practicesHtml() + ctx.challengesHtml();
      $('#openDuelBtn').addEventListener('click', ctx.openDuel);
      $('#openChessBtn').addEventListener('click', ctx.openChess);
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
      side.innerHTML =
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
