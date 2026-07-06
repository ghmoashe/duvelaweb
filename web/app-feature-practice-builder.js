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

    function openPracticeBuilder() {
      $('#pbName').value = '';
      $('#pbLang').value = '';
      $('#pbLevel').value = '';
      $('#pbItems').innerHTML = '';
      $('#pbNote').style.display = 'none';
      counter = 0;
      addBuilderItem();
      $('#pbOverlay').classList.add('open');
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
        ctx.renderBusinessWorkspace();
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
