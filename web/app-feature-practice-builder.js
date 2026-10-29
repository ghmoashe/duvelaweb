(function () {
  function createPracticeBuilderFeature(ctx) {
    const { $, $$, tr, esc, supa } = ctx;
    let counter = 0;

    function addBuilderItem() {
      const uid = ++counter;
      const options = [0, 1, 2, 3].map((index) =>
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
          '<input type="radio" name="pbc-' + uid + '" value="' + index + '"' + (index === 0 ? ' checked' : '') + '>' +
          '<input class="pb-opt" maxlength="160" placeholder="' + esc(tr('Option', 'Вариант') + ' ' + (index + 1)) + '" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft)">' +
        '</div>'
      ).join('');
      $('#pbItems').insertAdjacentHTML(
        'beforeend',
        '<div class="card pb-item" data-uid="' + uid + '" style="padding:12px;margin-bottom:10px">' +
          '<div class="field"><label>' + esc(tr('Question', 'Вопрос')) + '</label><input class="pb-prompt" maxlength="300"></div>' +
          '<p style="font-weight:800;font-size:12px;color:var(--soft);margin:2px 0 6px">' + esc(tr('Select the correct option', 'Отметьте правильный вариант')) + '</p>' +
          options +
          '<button class="btn danger pb-remove" type="button" style="margin-top:4px">' + esc(tr('Remove', 'Удалить')) + '</button>' +
        '</div>'
      );
    }

    // Who may open the practice (access_audiences): everyone, or DUVELA Premium
    // learners and/or the author's active Super subscribers (needs a Super price).
    let audiences = ['everyone'];
    let canUseSuper = false;

    function renderAccess() {
      let host = $('#pbAccess');
      if (!host) {
        host = document.createElement('div');
        host.id = 'pbAccess';
        host.className = 'field';
        host.style.marginTop = '6px';
        $('#pbItems').parentNode.insertBefore(host, $('#pbItems'));
      }
      const free = audiences.includes('everyone');
      const chip = (id, label, active, locked) => '<button type="button" class="tag' + (active ? ' blue' : '') + '" data-pb-access="' + id + '"' +
        ' style="border:1px solid var(--line);cursor:pointer;padding:7px 12px;margin:0 6px 6px 0;font-weight:800' + (locked ? ';opacity:.55' : '') + '">' + esc(label) + '</button>';
      const both = audiences.includes('premium') && audiences.includes('subscribers');
      const hint = free
        ? tr('Any student can take the whole practice.', 'Практику целиком может пройти любой ученик.')
        : both
          ? tr('The first 3 items are open to everyone as a preview. The full practice is for students with Duvela Premium, your active Super subscribers and those you assign it to as homework.', 'Первые 3 задания открыты всем как превью. Целиком — для учеников с Duvela Premium, ваших активных Super-подписчиков и тех, кому вы задали практику как ДЗ.')
          : audiences.includes('subscribers')
            ? tr('The first 3 items are open to everyone as a preview. The full practice is for your active Super subscribers and those you assign it to as homework.', 'Первые 3 задания открыты всем как превью. Целиком — для ваших активных Super-подписчиков и тех, кому вы задали практику как ДЗ.')
            : tr('The first 3 items are open to everyone as a preview. The full practice is for students with Duvela Premium and those you assign it to as homework.', 'Первые 3 задания открыты всем как превью. Целиком — для учеников с Duvela Premium и тех, кому вы задали практику как ДЗ.');
      host.innerHTML = '<label>' + esc(tr('Access', 'Доступ')) + '</label><div>' +
        chip('everyone', tr('Free', 'Бесплатно'), free, false) +
        chip('premium', '🔒 ' + tr('Premium only', 'Только Premium'), audiences.includes('premium'), false) +
        chip('subscribers', '⭐ ' + tr('Super subscribers', 'Только Super'), audiences.includes('subscribers'), !canUseSuper && !audiences.includes('subscribers')) +
        '</div><p style="font-size:12px;color:var(--soft);font-weight:700;margin:4px 0 0">' + esc(hint) + '</p>';
      $$('#pbAccess [data-pb-access]').forEach((button) => {
        button.onclick = () => {
          const id = button.getAttribute('data-pb-access');
          if (id === 'everyone') audiences = ['everyone'];
          else if (id === 'subscribers' && !canUseSuper && !audiences.includes('subscribers')) {
            const note = $('#pbNote');
            note.style.color = 'var(--red)';
            note.textContent = tr('Set a Super subscription price in your teacher profile first.', 'Сначала укажите цену Super-подписки в профиле преподавателя.');
            note.style.display = 'block';
            return;
          } else {
            const restricted = audiences.filter((value) => value !== 'everyone');
            const next = restricted.includes(id) ? restricted.filter((value) => value !== id) : restricted.concat(id);
            audiences = next.length ? next : ['everyone'];
          }
          renderAccess();
        };
      });
    }

    function openPracticeBuilder() {
      $('#pbName').value = '';
      $('#pbLang').value = '';
      $('#pbLevel').value = '';
      $('#pbItems').innerHTML = '';
      $('#pbNote').style.display = 'none';
      counter = 0;
      audiences = ['everyone'];
      renderAccess();
      addBuilderItem();
      $('#pbOverlay').classList.add('open');
      // Super needs the teacher's Super price (own profile row).
      if (ctx.user && ctx.user.id) {
        supa.from('profiles').select('super_subscription_price_dv').eq('id', ctx.user.id).maybeSingle().then(({ data }) => {
          canUseSuper = Number((data && data.super_subscription_price_dv) || 0) > 0;
          renderAccess();
        }, () => {});
      }
    }

    async function submitPractice() {
      const note = $('#pbNote');
      const title = $('#pbName').value.trim();
      const target = $('#pbLang').value.trim().toLowerCase();
      if (!title || !target) {
        note.style.color = 'var(--red)';
        note.textContent = tr('Title and language are required.', 'Нужны название и язык.');
        note.style.display = 'block';
        return;
      }
      const items = [];
      let invalid = false;
      $$('#pbItems .pb-item').forEach((card) => {
        const prompt = card.querySelector('.pb-prompt').value.trim();
        const options = Array.from(card.querySelectorAll('.pb-opt')).map((input) => input.value.trim());
        const filled = options.filter(Boolean);
        const checked = card.querySelector('input[type="radio"]:checked');
        if (!prompt || filled.length < 2 || !checked) {
          invalid = true;
          return;
        }
        items.push({ prompt, options, answer: String(checked.value), order_index: items.length });
      });
      if (invalid || !items.length) {
        note.style.color = 'var(--red)';
        note.textContent = tr('Each question needs text, 2+ options and a correct answer.', 'В каждом вопросе нужен текст, 2+ варианта и верный ответ.');
        note.style.display = 'block';
        return;
      }
      const button = $('#pbSubmit');
      button.disabled = true;
      button.textContent = tr('Publishing...', 'Публикация...');
      try {
        const { data: practice, error } = await supa.from('teacher_practices').insert({
          creator_id: ctx.user.id,
          creator_name: ctx.profile?.full_name || null,
          target,
          level: $('#pbLevel').value.trim().toLowerCase() || null,
          format: 'mcq',
          title,
          // The server derives the legacy access flag (everyone = free, else premium).
          access: audiences.includes('everyone') ? 'free' : 'premium',
          access_audiences: audiences,
          status: 'published'
        }).select('id').single();
        if (error) throw error;
        const rows = items.map((item) => ({
          practice_id: practice.id,
          order_index: item.order_index,
          type: 'mcq',
          prompt: item.prompt,
          options: item.options,
          answer: item.answer
        }));
        const { error: itemsError } = await supa.from('teacher_practice_items').insert(rows);
        if (itemsError) throw itemsError;
        $('#pbOverlay').classList.remove('open');
        await Promise.all([ctx.loadBusinessWorkspace(), ctx.loadPractices()]);
        // Refresh whichever screen shows this teacher's practices: the Management >
        // Practices tab (if that's where the builder was opened from) and the learner-
        // facing practice list (ctx.renderWorkspace, used when a business user is viewing
        // practicesHtml() too). renderBusinessWorkspace()/its #workspaceActions target was
        // retired when Notes took over that DOM node — repaint through the real owners now.
        if (ctx.management && ctx.management.paint) ctx.management.paint();
        if (ctx.renderWorkspace) ctx.renderWorkspace();
      } catch (error) {
        note.style.color = 'var(--red)';
        note.textContent = error.message || tr('Could not publish the practice.', 'Не удалось опубликовать практику.');
        note.style.display = 'block';
      } finally {
        button.disabled = false;
        button.textContent = tr('Publish practice', 'Опубликовать практику');
      }
    }

    return {
      addBuilderItem,
      openPracticeBuilder,
      submitPractice
    };
  }

  window.DuvelaAppPracticeBuilder = { create: createPracticeBuilderFeature };
})();
