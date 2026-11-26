// Applies what Dr. Kem publishes from /admin: colors, announcement, events,
// contact details, social links, booking and payment links, photos and shop
// settings. Anything left blank in the admin keeps what the page already shows.
(async () => {
  const root = document.documentElement;
  const section = document.querySelector('[data-events]');
  const message = section?.querySelector('[data-events-message]');
  const defaultEmail = 'info@kemberlymckenzie.com';
  const defaultPhone = '+14709015555';
  const imageUrl = id => '/api/image?id=' + encodeURIComponent(id);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  let content;
  try {
    const response = await fetch('/api/site-content');
    if (!response.ok) throw new Error('Content unavailable');
    content = await response.json();
  } catch {
    if (message) message.textContent = 'Events are temporarily unavailable. Please check back shortly.';
    return;
  }

  // ---------------------------------------------------------- colors
  if (content.theme === 'green-blue' || content.theme === 'custom') {
    const [primary, secondary] = content.theme === 'green-blue'
      ? ['#17684e', '#195b86']
      : [content.accent, content.secondary];
    if ([primary, secondary].every(color => /^#[a-f\d]{6}$/i.test(color))) {
      root.style.setProperty('--site-primary', primary);
      root.style.setProperty('--site-secondary', secondary);
      root.dataset.sitePalette = 'on';
      window.__setGLPalette?.(primary, secondary);
    }
  }

  const announcement = document.querySelector('[data-announcement]');
  if (announcement && content.announcement) {
    announcement.textContent = content.announcement;
    announcement.hidden = false;
  }

  // ---------------------------------------------------------- contact
  const email = content.contact?.email;
  if (email && email.toLowerCase() !== defaultEmail) {
    window.__drkemEmail = email;
    for (const link of document.querySelectorAll('a[href^="mailto:"]')) {
      const [address, query] = link.getAttribute('href').slice(7).split('?');
      if (address.toLowerCase() !== defaultEmail) continue;
      link.href = 'mailto:' + email + (query ? '?' + query : '');
      if (link.textContent.trim().toLowerCase() === defaultEmail) link.textContent = email;
    }
  }
  const phone = content.contact?.phone;
  if (phone) {
    let digits = phone.replace(/[^\d+]/g, '');
    if (/^\d{10}$/.test(digits)) digits = '+1' + digits;
    for (const link of document.querySelectorAll(`a[href="tel:${defaultPhone}"]`)) {
      link.href = 'tel:' + digits;
      link.textContent = link.textContent.replace('(470) 901-5555', phone);
    }
  }

  // ---------------------------------------------------------- links
  const social = content.social || {};
  for (const [key, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn']]) {
    if (!social[key]) continue;
    for (const link of document.querySelectorAll(`.socials a[aria-label="${label}"]`)) link.href = social[key];
  }
  for (const [key, url] of Object.entries(content.links || {})) {
    if (!url) continue;
    for (const link of document.querySelectorAll(`a[data-link="${key}"]`)) link.href = url;
  }

  // ---------------------------------------------------------- photos
  for (const [slot, id] of Object.entries(content.photos || {})) {
    for (const image of document.querySelectorAll(`img[data-photo="${slot}"]`)) {
      image.removeAttribute('width');
      image.removeAttribute('height');
      image.src = imageUrl(id);
    }
  }

  // ---------------------------------------------------------- shop
  for (const [id, settings] of Object.entries(content.products || {})) {
    const product = document.querySelector(`[data-product="${id}"]`);
    if (!product) continue;
    if (settings.hidden) { product.hidden = true; continue; }
    if (settings.price) {
      const price = product.querySelector('.product-price');
      if (price) price.textContent = settings.price.startsWith('$') ? settings.price : '$' + settings.price;
    }
    if (settings.soldOut) {
      product.removeAttribute('href');
      product.setAttribute('aria-disabled', 'true');
      product.classList.add('is-sold-out');
      const cta = product.querySelector('.product-cta');
      if (cta) cta.textContent = 'SOLD OUT';
    }
  }

  // ---------------------------------------------------------- events
  if (!section) return;
  const list = section.querySelector('[data-event-list]');
  const events = content.events || [];
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' }).format(new Date());
  const upcoming = events.filter(event => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter(event => event.date < today).sort((a, b) => b.date.localeCompare(a.date));

  function render(event) {
    const card = element('article', '', 'event-card');
    if (event.image) {
      const image = element('img', '', 'event-image');
      image.src = imageUrl(event.image);
      image.alt = event.title;
      image.loading = 'lazy';
      card.classList.add('event-card--photo');
      card.append(image);
    }
    const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(event.date));
    const when = element('time', event.time ? `${day} · ${event.time}` : day, 'event-when');
    when.dateTime = event.date;
    card.append(when, element('h3', event.title));
    if (event.location) card.append(element('p', event.location, 'event-location'));
    if (event.details) card.append(element('p', event.details, 'event-description'));
    if (event.url) {
      const link = element('a', 'Event details', 'btn btn--line');
      link.href = event.url;
      link.target = '_blank';
      link.rel = 'noopener';
      card.append(link);
    }
    return card;
  }

  if (section.dataset.events === 'upcoming') {
    list.append(...upcoming.slice(0, 3).map(render));
    section.hidden = !upcoming.length;
  } else {
    for (const [heading, group] of [['Upcoming events', upcoming], ['Past events', past]]) {
      if (!group.length) continue;
      const block = element('section', '', 'event-group');
      const grid = element('div', '', 'mym-grid');
      grid.append(...group.map(render));
      block.append(element('h2', heading, 'h-serif'), grid);
      list.append(block);
    }
    message.textContent = 'New events will appear here when announced.';
    message.hidden = !!(upcoming.length || past.length);
  }
})();
