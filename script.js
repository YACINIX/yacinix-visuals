/* ═══════════════════════════════════════════════════
   YACINIX VISUALS — « LA TIMELINE »
   ─ Grain filmique (canvas prérendu, ~16 fps)
   ─ Coupes claires / encre (pilote grain + navbar + scrub)
   ─ Scrub / tête de lecture + ticks de section
   ─ Un seul geste au chargement : le playhead balaie le hero
   ─ Scrub des vignettes au hover · tracé de la courbe de rétention
   ─ Filtres soulignés · modal vidéo · formulaire Formspree · année
   ═══════════════════════════════════════════════════ */

/* JS actif : autorise le masquage du titre hero (fallback lisible sans JS) */
document.documentElement.classList.add('js');

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAV_H = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;

const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(Math.floor(sec % 60))}`;
const toSeconds = (mmss) => {
  const [m, s] = String(mmss).split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
};


/* ══════════════════════════════════════════════════
   1 · GRAIN FILMIQUE
   8 tuiles de bruit prérendues, cyclées ~16 fps.
   Le bruit n'est JAMAIS régénéré. Figé si reduced-motion.
══════════════════════════════════════════════════ */
(function initGrain() {
  const canvas = document.getElementById('grain');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const TILE = 128;
  const TILE_COUNT = 8;
  const FPS = 16;
  const frameGap = 1000 / FPS;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  /* — pré-rendu des tuiles (une seule fois) — */
  const tiles = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const tc = document.createElement('canvas');
    tc.width = tc.height = TILE;
    const tctx = tc.getContext('2d');
    const img = tctx.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 110 + ((Math.random() * 40) | 0);   // monochrome, autour du gris neutre
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 24 + ((Math.random() * 20) | 0);    // alpha faible
    }
    tctx.putImageData(img, 0, 0);
    tiles.push(tc);
  }

  /* patterns créés une seule fois — pas de régénération par frame */
  const patterns = tiles.map((t) => ctx.createPattern(t, 'repeat'));

  let frame = 0;
  let rafId = null;
  let last = 0;

  function fit() {
    canvas.width = Math.ceil(window.innerWidth * dpr);
    canvas.height = Math.ceil(window.innerHeight * dpr);
  }

  function paint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = patterns[frame];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function loop(now) {
    if (now - last >= frameGap) {
      frame = (frame + 1) % TILE_COUNT;
      paint();
      last = now;
    }
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId == null) rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  fit();
  paint();

  if (!REDUCED) {
    start();
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });
  }

  window.addEventListener('resize', debounce(() => { fit(); paint(); }, 200));
})();


/* ══════════════════════════════════════════════════
   2 · SCRUB + COUPES CLAIRES/ENCRE + TICKS
   Un seul rAF : progression du scrub, tête de lecture,
   timecode courant, et bascule body.is-ink / grain léger.
══════════════════════════════════════════════════ */
(function initScrub() {
  const scrub = document.getElementById('scrub');
  const played = document.getElementById('scrubPlayed');
  const head = document.getElementById('scrubHead');
  const readout = document.getElementById('scrubReadout');
  const ticksWrap = document.getElementById('scrubTicks');
  const grain = document.getElementById('grain');
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  if (!scrub || !sections.length) return;

  const docEl = document.documentElement;
  let sectionTops = [];

  function measure() {
    ticksWrap.innerHTML = '';
    const max = docEl.scrollHeight - window.innerHeight;
    sectionTops = sections.map((s) => {
      const top = s.getBoundingClientRect().top + window.scrollY;
      const frac = max > 0 ? clamp((top - NAV_H) / max, 0, 1) : 0;
      const tick = document.createElement('span');
      tick.style.left = (frac * 100) + '%';
      ticksWrap.appendChild(tick);
      return { top, tc: s.dataset.tc || '00:00', id: s.id };
    });
  }

  let ticking = false;
  function update() {
    ticking = false;
    const max = docEl.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    const p = max > 0 ? clamp(y / max, 0, 1) : 0;

    played.style.width = (p * 100) + '%';
    head.style.left = (p * 100) + '%';
    readout.style.left = clamp(p * 100, 3, 97) + '%';

    /* section courante = dernière dont le haut est passé sous la navbar */
    const probe = y + NAV_H + 1;
    let current = sectionTops[0] || { tc: '00:00', id: 'hero' };
    for (const s of sectionTops) if (s.top <= probe) current = s;
    readout.textContent = current.tc;

    /* coupe claire / encre : quelle section occupe le tiers haut du viewport */
    const probeDom = y + NAV_H + Math.min(window.innerHeight * 0.35, 240);
    let dom = current.id;
    for (const s of sectionTops) if (s.top <= probeDom) dom = s.id;
    const isInk = dom === 'results' || dom === 'contact';
    document.body.classList.toggle('is-ink', isInk);
    if (grain) grain.classList.toggle('grain--text', !isInk && dom !== 'hero');
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(() => { measure(); update(); }, 150));
  window.addEventListener('load', () => { measure(); update(); });
})();


/* ══════════════════════════════════════════════════
   3 · HERO — le playhead balaie et révèle le titre
   L'unique moment d'attention orchestré. Rien si reduced-motion
   (le CSS affiche alors le titre directement).
══════════════════════════════════════════════════ */
(function initHeroSweep() {
  const hero = document.querySelector('.hero');
  if (!hero || REDUCED) return;

  const sweep = document.createElement('div');
  sweep.className = 'hero__sweep';
  sweep.setAttribute('aria-hidden', 'true');
  hero.appendChild(sweep);

  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('play')));
})();


/* ══════════════════════════════════════════════════
   4 · NAVBAR — état au scroll
══════════════════════════════════════════════════ */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 32);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();


/* ══════════════════════════════════════════════════
   5 · MENU BURGER MOBILE
══════════════════════════════════════════════════ */
(function initBurger() {
  const burger = document.getElementById('navBurger');
  const menu = document.getElementById('navMenu');
  if (!burger || !menu) return;

  const close = () => {
    burger.classList.remove('open');
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  });

  menu.querySelectorAll('.navbar__link').forEach((l) => l.addEventListener('click', close));
  document.addEventListener('click', (e) => {
    if (!burger.contains(e.target) && !menu.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();


/* ══════════════════════════════════════════════════
   6 · FILTRES — onglets soulignés en or profond
   (plus de fade-up : simple bascule d'affichage)
══════════════════════════════════════════════════ */
(function initFilters() {
  const filters = document.getElementById('filters');
  const underline = document.getElementById('filtersUnderline');
  const cards = document.querySelectorAll('.work-card');
  if (!filters || !underline) return;

  const btns = Array.from(filters.querySelectorAll('.filter-btn'));
  const first = btns[0];

  function moveTo(btn) {
    const dx = btn.offsetLeft;
    const dy = btn.offsetTop - first.offsetTop;
    underline.style.width = btn.offsetWidth + 'px';
    underline.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  moveTo(filters.querySelector('.filter-btn.active') || first);

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      moveTo(btn);

      const f = btn.dataset.filter;
      cards.forEach((card) => {
        const match = f === 'all' || card.dataset.category === f;
        card.dataset.hidden = match ? 'false' : 'true';
      });
    });
  });

  window.addEventListener('resize', debounce(() => {
    moveTo(filters.querySelector('.filter-btn.active') || first);
  }, 150));
  window.addEventListener('load', () => moveTo(filters.querySelector('.filter-btn.active') || first));
})();


/* ══════════════════════════════════════════════════
   7 · WORK — scrub de la vignette au hover
   La miniature AVANCE de quelques frames + mini-timecode
   + fine ligne playhead. Pas de zoom.
══════════════════════════════════════════════════ */
(function initWorkScrub() {
  const cards = document.querySelectorAll('.work-card');
  const FRAMES = ['50% 50%', '43% 50%', '57% 47%', '47% 53%', '52% 49%'];

  cards.forEach((card) => {
    const thumb = card.querySelector('.work-card__thumb');
    const playhead = card.querySelector('.work-card__playhead');
    const tcEl = card.querySelector('.work-card__tc');
    if (!thumb || !playhead || !tcEl) return;

    const durSec = toSeconds(card.dataset.duration || '00:20');
    let raf = null;
    let t0 = 0;

    function start() {
      if (REDUCED) {
        playhead.style.left = '55%';
        playhead.style.opacity = '0.9';
        tcEl.textContent = card.dataset.duration || fmtTime(durSec);
        return;
      }
      cancelAnimationFrame(raf);
      t0 = performance.now();
      const step = (now) => {
        const k = Math.min((now - t0) / 650, 1);
        playhead.style.left = (k * 100) + '%';
        playhead.style.opacity = k < 1 ? '1' : '0';
        thumb.style.objectPosition = FRAMES[Math.floor(k * (FRAMES.length - 1))];
        tcEl.textContent = fmtTime(k * durSec);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = null;
      playhead.style.opacity = '0';
      playhead.style.left = '0';
      thumb.style.objectPosition = '50% 50%';
      tcEl.textContent = '00:00';
    }

    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focus', start);
    card.addEventListener('blur', stop);
  });
})();


/* ══════════════════════════════════════════════════
   8 · RESULTS — courbe de rétention dessinée en SVG
   Tracée une fois, à l'entrée à l'écran.
══════════════════════════════════════════════════ */
(function initRetention() {
  const card = document.getElementById('retentionCard');
  const line = document.getElementById('retentionLine');
  const area = document.getElementById('retentionArea');
  const hook = document.getElementById('retentionHook');
  if (!card || !line || !area) return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 640, H = 280, PX = 8, PT = 8, PB = 8;
  const iw = W - PX * 2;
  const ih = H - PT - PB;

  /* rétention réelle : chute brutale sur le hook, puis décroissance douce */
  const data = [
    [0, 1.00], [0.02, 0.94], [0.05, 0.82], [0.12, 0.72], [0.25, 0.63],
    [0.40, 0.55], [0.55, 0.48], [0.70, 0.42], [0.82, 0.39], [0.90, 0.31], [1, 0.24],
  ];
  const X = (f) => PX + f * iw;
  const Y = (r) => PT + (1 - r) * ih;

  const pts = data.map(([f, r]) => `${X(f).toFixed(1)},${Y(r).toFixed(1)}`);
  const linePath = 'M' + pts.join(' L');
  line.setAttribute('d', linePath);
  area.setAttribute('d', `${linePath} L${X(1).toFixed(1)},${(H - PB).toFixed(1)} L${X(0).toFixed(1)},${(H - PB).toFixed(1)} Z`);

  /* le hook = 3e point (0:03) */
  const hk = data[2];
  hook.setAttribute('cx', X(hk[0]).toFixed(1));
  hook.setAttribute('cy', Y(hk[1]).toFixed(1));

  /* repères d'axe en mono */
  const svg = card.querySelector('svg');
  const addText = (x, y, str, anchor = 'start') => {
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('text-anchor', anchor);
    t.textContent = str;
    svg.appendChild(t);
  };
  addText(PX, PT + 12, '100%');
  addText(PX, H - PB - 4, '0');
  ['0:00', '0:15', '0:30', '0:45'].forEach((lbl, i) => {
    addText(X(i / 3), H - PB - 4, lbl, i === 3 ? 'end' : 'middle');
  });
  addText(X(hk[0]) + 10, Y(hk[1]) - 8, '0:03 · le hook');

  if (REDUCED) { card.classList.add('drawn'); return; }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { card.classList.add('drawn'); io.disconnect(); }
    });
  }, { threshold: 0.35 });
  io.observe(card);
})();


/* ══════════════════════════════════════════════════
   9 · SÉPARATEURS WAVEFORM — vraie forme d'onde audio
   Déterministe (PRNG semé) : stable, jamais aléatoire au rechargement.
══════════════════════════════════════════════════ */
(function initWaveforms() {
  const waves = document.querySelectorAll('[data-wave]');
  if (!waves.length) return;

  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function build(el) {
    const bw = 2, gap = 3, step = bw + gap, H = 44, mid = H / 2;
    const n = Math.max(24, Math.floor((el.clientWidth || 1000) / step));
    const rand = mulberry32(0x9E3779B9 ^ n);
    let rects = '';
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / (n - 1)) * Math.PI);           // atténue les bords
      const h = (2 + rand() * rand() * 38) * (0.3 + env * 0.8);
      rects += `<rect x="${(i * step).toFixed(1)}" y="${(mid - h / 2).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}"/>`;
    }
    el.innerHTML =
      `<svg viewBox="0 0 ${n * step} ${H}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
  }

  const render = () => waves.forEach(build);
  render();
  window.addEventListener('resize', debounce(render, 200));
})();


/* ══════════════════════════════════════════════════
   10 · MODAL LECTEUR VIDÉO
══════════════════════════════════════════════════ */
(function initVideoModal() {
  const modal = document.getElementById('videoModal');
  const iframe = document.getElementById('modalIframe');
  const closeBtn = document.getElementById('modalClose');
  const backdrop = document.getElementById('modalBackdrop');
  const cards = document.querySelectorAll('.work-card');
  if (!modal || !iframe) return;

  const YT = 'https://www.youtube.com/embed/';
  const PARAMS = '?autoplay=1&rel=0&modestbranding=1';
  let lastFocused = null;

  const open = (id, trigger) => {
    lastFocused = trigger || null;
    iframe.src = YT + id + PARAMS;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const close = () => {
    iframe.src = '';
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  };

  cards.forEach((card) => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const trigger = () => {
      const id = card.dataset.videoId;
      if (id && !id.startsWith('VIDEO_ID')) open(id, card);
    };
    card.addEventListener('click', trigger);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    });
  });

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) close();
  });
})();


/* ══════════════════════════════════════════════════
   11 · FORMULAIRE FORMSPREE (AJAX)
══════════════════════════════════════════════════ */
(function initContactForm() {
  const form = document.getElementById('contactForm');
  const feedback = document.getElementById('formFeedback');
  const submitBtn = document.getElementById('submitBtn');
  if (!form) return;

  const show = (msg, type) => {
    feedback.textContent = msg;
    feedback.className = 'form-feedback ' + type;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const msg = form.message.value.trim();

    if (!name || !email || !msg) return show('Merci de remplir tous les champs.', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('Adresse email invalide.', 'error');

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (res.ok) {
        show('Message envoyé ! Je vous répondrai sous 24 h.', 'success');
        form.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        const err = data?.errors?.map((x) => x.message).join(', ') || 'Erreur inconnue.';
        show('Erreur : ' + err, 'error');
      }
    } catch {
      show('Problème réseau. Veuillez réessayer.', 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
})();


/* ══════════════════════════════════════════════════
   12 · ANNÉE FOOTER
══════════════════════════════════════════════════ */
(function setFooterYear() {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = new Date().getFullYear();
})();
