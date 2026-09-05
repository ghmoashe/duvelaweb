// Shared LIVE-duel stage effects: DUVI reactions, reveal chime, confetti,
// and the hourly gift-rank pill. Used by the practice overlay and Live Studio.
(function () {
  const DUVI = {
    joy: './web/assets/duvi/p-joy.png',
    think: './web/assets/duvi/p-think.png',
    greet: './web/assets/duvi/greeting.png',
    tip: './web/assets/duvi/tip.png',
    mic: './web/assets/duvi/p-mic.png'
  };

  function duviSrc(kind) {
    if (kind === 'win' || kind === 'correct' || kind === 'reveal') return DUVI.joy;
    if (kind === 'wrong') return DUVI.think;
    if (kind === 'wait') return DUVI.tip;
    return DUVI.greet;
  }

  function showDuvi(host, kind) {
    if (!host) return;
    let img = host.querySelector('.duel-duvi');
    if (!img) {
      img = document.createElement('img');
      img.className = 'duel-duvi';
      img.alt = 'DUVI';
      host.appendChild(img);
    }
    img.src = duviSrc(kind);
    img.classList.remove('pop');
    void img.offsetWidth;
    img.classList.add('pop');
    img.hidden = false;
  }

  function playRevealSound(ok) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      const notes = ok ? [523, 659, 784] : [220, 196];
      notes.forEach(function (freq, index) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02 + index * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28 + index * 0.08);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now + index * 0.07);
        osc.stop(now + 0.32 + index * 0.08);
      });
    } catch (error) { /* autoplay lock */ }
  }

  function confetti(host) {
    if (!host) return;
    let canvas = host.querySelector('.duel-confetti');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'duel-confetti';
      host.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    const rect = host.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width));
    canvas.height = Math.max(240, Math.floor(rect.height));
    const colors = ['#7040d8', '#c53ada', '#26caee', '#d5af68', '#7dffc4', '#fff'];
    const bits = [];
    for (let i = 0; i < 70; i += 1) {
      bits.push({
        x: canvas.width * Math.random(),
        y: -20 - Math.random() * 80,
        w: 6 + Math.random() * 7,
        h: 8 + Math.random() * 10,
        vx: -2 + Math.random() * 4,
        vy: 3 + Math.random() * 5,
        rot: Math.random() * 6,
        vr: -0.2 + Math.random() * 0.4,
        color: colors[i % colors.length]
      });
    }
    const started = performance.now();
    function frame(now) {
      const t = now - started;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.forEach(function (bit) {
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.vy += 0.08;
        bit.rot += bit.vr;
        ctx.save();
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / 1400);
        ctx.fillStyle = bit.color;
        ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
        ctx.restore();
      });
      if (t < 1400) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  async function renderGiftRank(node, teacherId) {
    if (!node || !teacherId) return;
    const config = window.DuvelaWebConfig;
    if (!config || typeof config.createSupabaseClient !== 'function') return;
    try {
      const supa = config.createSupabaseClient();
      const res = await supa.rpc('live_gift_rank', { p_teacher: teacherId, p_period: 'hour' });
      const row = res && res.data && (Array.isArray(res.data) ? res.data[0] : res.data);
      const rank = row ? Number(row.rank) || 0 : 0;
      if (rank > 0 && rank <= 50) {
        node.hidden = false;
        node.textContent = '#' + rank + ' gifts this hour';
      } else {
        node.hidden = true;
      }
    } catch (error) {
      node.hidden = true;
    }
  }

  window.DuvelaDuelFx = {
    duviSrc: duviSrc,
    showDuvi: showDuvi,
    playRevealSound: playRevealSound,
    confetti: confetti,
    renderGiftRank: renderGiftRank
  };
})();
