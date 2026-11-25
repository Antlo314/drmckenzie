/* ============================================================
   Mind Your Mind · scroll orchestration
   - section observer drives [data-theme] + WebGL palette
   - reveal-on-scroll with stagger
   - nav active state, mobile menu, card tilt, countdown
   ============================================================ */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.remove('no-js');   // CSS only hides reveals once JS can show them

  const application = document.querySelector('[data-coaching-application]');
  if (application) {
    application.hidden = false;
    const chosen = new URLSearchParams(location.search).get('package');
    if (chosen) application.elements.package.value = chosen.slice(0, 80);
    application.addEventListener('submit', event => {
      event.preventDefault();
      const fields = new FormData(application);
      const body = [
        `Name: ${fields.get('name')}`,
        `Coaching package: ${fields.get('package')}`,
        `Coaching goals: ${fields.get('goals')}`,
      ].join('\r\n');
      location.href = `mailto:KeepEverythingMoving@gmail.com?subject=KEM%20Coaching%20application&body=${encodeURIComponent(body)}`;
    });
  }

  // ------------------------------------------------ theme per section
  const themed = document.querySelectorAll('[data-theme-section]');
  const themeObs = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const t = e.target.dataset.themeSection;
        root.dataset.theme = t;
        if (window.__setGLTheme) window.__setGLTheme(t);
      }
    }
  }, { rootMargin: '-38% 0px -38% 0px' });
  themed.forEach(s => themeObs.observe(s));

  // ------------------------------------------------ reveals (staggered)
  const reveals = document.querySelectorAll('[data-reveal]');
  const staticMode = location.search.includes('static');   // for screenshot capture
  if (reduced || staticMode) {
    reveals.forEach(el => el.classList.add('in'));
    // QA capture: ?static=1&only=<section-id> isolates one section at the top
    // of the document so headless screenshots need no scrolling.
    const only = new URLSearchParams(location.search).get('only');
    if (staticMode && only) {
      root.style.scrollBehavior = 'auto';
      document.querySelectorAll('main > section').forEach(s => {
        if (s.id !== only) s.remove();
      });
      const keep = document.getElementById(only);
      if (keep) {
        keep.style.minHeight = '0';
        root.dataset.theme = keep.dataset.themeSection || 'hero';
        if (window.__setGLTheme) window.__setGLTheme(root.dataset.theme);
      }
    }
  } else {
    const revObs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const el = e.target;
          const siblings = [...el.parentElement.querySelectorAll(':scope > [data-reveal]')];
          const idx = Math.max(0, siblings.indexOf(el));
          el.style.transitionDelay = `${Math.min(idx * 90, 360)}ms`;
          el.classList.add('in');
          revObs.unobserve(el);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(el => revObs.observe(el));

    // Failsafe: IntersectionObserver stays idle while a tab is hidden, and a
    // page opened in the background could otherwise paint blank on first view.
    // Anything on screen and still unrevealed after a beat gets shown.
    const failsafe = () => reveals.forEach(el => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
    });
    setTimeout(failsafe, 2500);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(failsafe, 600);
    });
  }

  // ------------------------------------------------ nav active link
  const navLinks = [...document.querySelectorAll('.nav a')];
  const byHash = Object.fromEntries(navLinks.map(a => [a.getAttribute('href'), a]));
  const secObs = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const link = byHash['#' + e.target.id];
        if (link) link.classList.add('active');
      }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => secObs.observe(s));

  // ------------------------------------------------ mobile menu
  const btn = document.querySelector('.menu-btn');
  const mnav = document.querySelector('.mobile-nav');
  function setMenuOpen(open) {
    mnav.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  btn.addEventListener('click', () => setMenuOpen(mnav.hidden));
  mnav.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      setMenuOpen(false);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mnav.hidden) {
      setMenuOpen(false);
      btn.focus();
    }
  });
  matchMedia('(min-width: 1081px)').addEventListener('change', e => {
    if (e.matches) setMenuOpen(false);
  });

  // ------------------------------------------------ card tilt
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.card, .event-card, .product').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `translateY(-6px) rotateX(${-y * 4}deg) rotateY(${x * 5}deg)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // ------------------------------------------------ countdown
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const when = new Date(el.dataset.countdown).getTime();
    const tick = () => {
      const d = Math.max(0, Math.ceil((when - Date.now()) / 86400000));
      el.textContent = d > 0 ? `${d} days` : 'Departing';
    };
    tick();
    setInterval(tick, 3600000);
  });
})();
