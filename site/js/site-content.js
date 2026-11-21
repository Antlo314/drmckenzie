(async () => {
  const root = document.documentElement;
  const section = document.querySelector('[data-events]');
  const message = section?.querySelector('[data-events-message]');
  try {
    const response = await fetch('/api/site-content');
    if (!response.ok) throw new Error('Events unavailable');
    const content = await response.json();
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

    if (!section) return;
    const list = section.querySelector('[data-event-list]');
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' }).format(new Date());
    const upcoming = content.events.filter(event => event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = content.events.filter(event => event.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    const element = (tag, text, className) => {
      const node = document.createElement(tag);
      node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    function render(event) {
      const card = element('article', '', 'event-card');
      const date = element('time', new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
        .format(new Date(event.date)), 'event-when');
      date.dateTime = event.date;
      card.append(date, element('h3', event.title));
      if (event.location) card.append(element('p', event.location));
      if (event.details) card.append(element('p', event.details, 'event-description'));
      if (event.url) {
        const link = element('a', 'Event details', 'btn btn--line');
        link.href = event.url;
        card.append(link);
      }
      return card;
    }
    if (section.dataset.events === 'upcoming') {
      list.append(...upcoming.slice(0, 3).map(render));
      section.hidden = !upcoming.length;
    } else {
      for (const [heading, events] of [['Upcoming events', upcoming], ['Past events', past]]) {
        if (!events.length) continue;
        const group = element('section', '', 'event-group');
        const grid = element('div', '', 'mym-grid');
        grid.append(...events.map(render));
        group.append(element('h2', heading, 'h-serif'), grid);
        list.append(group);
      }
      message.textContent = 'New events will appear here when announced.';
      message.hidden = !!(upcoming.length || past.length);
    }
  } catch {
    if (message) message.textContent = 'Events are temporarily unavailable. Please check back shortly.';
  }
})();
