(() => {
  const login = document.querySelector('#login');
  const editor = document.querySelector('#editor');
  const eventList = document.querySelector('#event-list');
  const status = document.querySelector('#status');
  const logout = document.querySelector('#logout');
  const addons = document.querySelector('#addons');
  const template = document.querySelector('#event-template');
  const addEvent = document.querySelector('#add-event');
  let revision;
  let dirty = false;

  async function request(body, admin = false) {
    const response = await fetch('/api/site-content' + (admin ? '?admin=1' : ''), body && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Drkem-Admin': '1' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
    return result;
  }

  function showEditor(visible) {
    login.hidden = visible;
    editor.hidden = logout.hidden = addons.hidden = !visible;
  }

  function updatePreview() {
    const mode = editor.elements.theme.value;
    document.querySelector('#custom-colors').hidden = mode !== 'custom';
    const colors = {
      original: ['#7d1f8e', '#10808f'],
      'green-blue': ['#17684e', '#195b86'],
      custom: [editor.elements.accent.value, editor.elements.secondary.value],
    }[mode];
    const stops = mode === 'original' ? colors : colors.map(color => `color-mix(in srgb, ${color} 45%, black)`);
    document.querySelector('#preview').style.background = `linear-gradient(115deg, ${stops.join(', ')})`;
  }

  function addRow(event = { id: crypto.randomUUID() }) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.id = event.id;
    for (const field of row.querySelectorAll('input, textarea')) {
      if (field.type === 'checkbox') field.checked = event[field.name] === true;
      else field.value = event[field.name] ?? '';
    }
    row.querySelector('[data-remove]').addEventListener('click', () => {
      row.remove();
      dirty = true;
      addEvent.disabled = false;
    });
    eventList.append(row);
    addEvent.disabled = eventList.children.length >= 50;
    return row;
  }

  async function load() {
    const content = await request(undefined, true);
    revision = content.revision;
    for (const key of ['theme', 'accent', 'secondary', 'announcement']) editor.elements[key].value = content[key];
    eventList.replaceChildren();
    addEvent.disabled = false;
    content.events.forEach(addRow);
    dirty = false;
    updatePreview();
    showEditor(true);
  }

  function action(form, run) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.submitter || form.querySelector('[type="submit"]');
      button.disabled = true;
      status.textContent = '';
      try { await run(); }
      catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    });
  }

  action(login, async () => {
    await request({ action: 'login', password: login.elements.password.value });
    login.reset();
    await load();
  });

  action(editor, async () => {
    const content = { revision };
    for (const key of ['theme', 'accent', 'secondary', 'announcement']) content[key] = editor.elements[key].value;
    content.events = [...eventList.children].map(row => {
      const event = { id: row.dataset.id };
      for (const field of row.querySelectorAll('input, textarea')) {
        event[field.name] = field.type === 'checkbox' ? field.checked : field.value.trim();
      }
      return event;
    });
    const controls = Array.from(editor.elements).filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    logout.disabled = true;
    try {
      const saved = await request({ action: 'save', content });
      revision = saved.revision;
      dirty = false;
      status.textContent = 'Changes published.';
    } finally {
      controls.forEach(control => { control.disabled = false; });
      logout.disabled = false;
    }
  });

  editor.addEventListener('input', () => {
    dirty = true;
    updatePreview();
  });
  addEvent.addEventListener('click', () => {
    dirty = true;
    addRow().querySelector('input').focus();
  });
  logout.addEventListener('click', async () => {
    if (dirty && !confirm('Sign out and discard unpublished edits?')) return;
    try {
      await request({ action: 'logout' });
      dirty = false;
      eventList.replaceChildren();
      editor.reset();
      showEditor(false);
      status.textContent = 'Signed out.';
    } catch (error) { status.textContent = error.message; }
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) event.preventDefault();
  });
  load().catch(error => {
    showEditor(false);
    if (error.status !== 401) status.textContent = error.message;
  });
})();
