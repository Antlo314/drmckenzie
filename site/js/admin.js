(() => {
  const $ = selector => document.querySelector(selector);
  const login = $('#login');
  const editor = $('#editor');
  const eventList = $('#event-list');
  const status = $('#status');
  const logout = $('#logout');
  const addons = $('#addons');
  const template = $('#event-template');
  const addEvent = $('#add-event');
  const dirtyNote = $('#dirty-note');
  const imageUrl = id => '/api/image?id=' + encodeURIComponent(id);

  const photoSlots = [
    { slot: 'home-about', label: 'Homepage: About Dr. Kem', src: '/assets/img/portrait-thankful.webp' },
    { slot: 'home-mym', label: 'Homepage: Mind Your Mind', src: '/assets/img/mym-drkem-green.webp' },
    { slot: 'home-night', label: 'Homepage: Night Vision', src: '/assets/img/portrait-night.webp' },
    { slot: 'counseling', label: 'Counseling page', src: '/assets/img/counseling-headshot.webp' },
    { slot: 'booking', label: 'Booking page', src: '/assets/img/portrait-thankful.webp' },
  ];
  const groups = ['contact', 'social', 'links'];

  let revision;
  let photos = {};
  let products = [];
  let dirty = false;
  let uploading = 0;

  function markDirty(value = true) {
    dirty = value;
    dirtyNote.hidden = !value;
  }

  async function request(body, admin = false) {
    const response = await fetch('/api/site-content' + (admin ? '?admin=1' : ''), body && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Drkem-Admin': '1' },
      body: JSON.stringify(body),
    });
    let result = {};
    try { result = await response.json(); } catch { /* empty or non-JSON reply */ }
    if (!response.ok) {
      const fallback = response.status === 413 ? 'That photo is too large.' : 'Something went wrong. Try again.';
      throw Object.assign(new Error(result.error || fallback), { status: response.status });
    }
    return result;
  }

  function showEditor(visible) {
    login.hidden = visible;
    editor.hidden = logout.hidden = addons.hidden = !visible;
  }

  function say(text) {
    status.textContent = text;
    if (text) status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function updatePreview() {
    const mode = editor.elements.theme.value;
    $('#custom-colors').hidden = mode !== 'custom';
    const colors = {
      original: ['#7d1f8e', '#10808f'],
      'green-blue': ['#17684e', '#195b86'],
      custom: [editor.elements.accent.value, editor.elements.secondary.value],
    }[mode];
    const stops = mode === 'original' ? colors : colors.map(color => `color-mix(in srgb, ${color} 45%, black)`);
    $('#preview').style.background = `linear-gradient(115deg, ${stops.join(', ')})`;
  }

  // ------------------------------------------------------------ photos
  // Resize in the browser so uploads stay small and fast.
  async function prepareImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Choose a photo file (JPG or PNG).');
    if (file.size > 25_000_000) throw new Error('That photo is over 25 MB. Choose a smaller one.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('This photo type cannot be read here. Save it as a JPG or PNG and try again.'); }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    for (const quality of [0.85, 0.75, 0.6, 0.45]) {
      let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 1_400_000) {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('The photo could not be read.'));
          reader.readAsDataURL(blob);
        });
        return { type: blob.type, data };
      }
    }
    throw new Error('That photo is too large even after resizing.');
  }

  async function uploadImage(file) {
    uploading += 1;
    say('Uploading photo…');
    try {
      const { id } = await request({ action: 'upload', ...await prepareImage(file) });
      say('Photo uploaded. Click “Publish changes” to put it on the site.');
      return id;
    } finally {
      uploading -= 1;
    }
  }

  function renderPhotos() {
    const list = $('#photo-list');
    list.replaceChildren(...photoSlots.map(({ slot, label, src }) => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      const image = document.createElement('img');
      image.alt = label;
      image.src = photos[slot] ? imageUrl(photos[slot]) : src;
      const name = document.createElement('p');
      name.textContent = label;
      const note = document.createElement('small');
      note.textContent = photos[slot] ? 'Custom photo' : 'Original photo';
      const pick = document.createElement('label');
      pick.className = 'btn btn--line file-button';
      pick.textContent = 'Replace';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      pick.append(input);
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'link-button';
      reset.textContent = 'Use original';
      reset.hidden = !photos[slot];
      input.addEventListener('change', async () => {
        const [file] = input.files;
        input.value = '';
        if (!file) return;
        try {
          photos[slot] = await uploadImage(file);
          markDirty();
          renderPhotos();
        } catch (error) { say(error.message); }
      });
      reset.addEventListener('click', () => {
        delete photos[slot];
        markDirty();
        renderPhotos();
      });
      const actions = document.createElement('div');
      actions.className = 'photo-actions';
      actions.append(pick, reset);
      card.append(image, name, note, actions);
      return card;
    }));
  }

  // ------------------------------------------------------------ events
  function setEventImage(row, id) {
    row.dataset.image = id || '';
    const preview = row.querySelector('[data-preview]');
    preview.hidden = !id;
    if (id) preview.src = imageUrl(id);
    else preview.removeAttribute('src');
    row.querySelector('[data-placeholder]').hidden = !!id;
    row.querySelector('[data-clear-image]').hidden = !id;
    row.querySelector('.file-button').firstChild.textContent = id ? 'Change photo' : 'Add photo';
  }

  function syncEventsUi() {
    $('#no-events').hidden = eventList.children.length > 0;
    addEvent.disabled = eventList.children.length >= 50;
  }

  function addRow(event = { id: crypto.randomUUID(), published: true }, atTop = false) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.id = event.id;
    for (const field of row.querySelectorAll('[data-field]')) {
      if (field.type === 'checkbox') field.checked = event[field.dataset.field] === true;
      else field.value = event[field.dataset.field] ?? '';
    }
    setEventImage(row, event.image);
    row.querySelector('[data-remove]').addEventListener('click', () => {
      const title = row.querySelector('[data-field="title"]').value.trim();
      if (!confirm(`Delete ${title ? `“${title}”` : 'this event'}? It is removed from the site when you publish.`)) return;
      row.remove();
      markDirty();
      syncEventsUi();
    });
    row.querySelector('[data-file]').addEventListener('change', async ({ target }) => {
      const [file] = target.files;
      target.value = '';
      if (!file) return;
      try {
        setEventImage(row, await uploadImage(file));
        markDirty();
      } catch (error) { say(error.message); }
    });
    row.querySelector('[data-clear-image]').addEventListener('click', () => {
      setEventImage(row, '');
      markDirty();
    });
    const title = row.querySelector('[data-field="title"]');
    const legend = row.querySelector('legend');
    const rename = () => { legend.textContent = title.value.trim() || 'New event'; };
    title.addEventListener('input', rename);
    rename();
    if (atTop) eventList.prepend(row); else eventList.append(row);
    syncEventsUi();
    return row;
  }

  // ------------------------------------------------------------ shop
  function renderProducts(saved) {
    $('#product-list').replaceChildren(...products.map(product => {
      const settings = saved[product.id] || {};
      const row = document.createElement('div');
      row.className = 'product-admin';
      row.dataset.id = product.id;
      row.innerHTML = `
        <img alt="" loading="lazy">
        <p class="product-admin-name"></p>
        <label class="product-admin-price">Price <input data-field="price" maxlength="12" inputmode="decimal"></label>
        <label class="check-label"><input type="checkbox" data-field="soldOut"> Sold out</label>
        <label class="check-label"><input type="checkbox" data-field="hidden"> Hide</label>`;
      row.querySelector('img').src = product.image;
      row.querySelector('.product-admin-name').textContent = product.name;
      const price = row.querySelector('[data-field="price"]');
      price.placeholder = product.price;
      price.value = settings.price || '';
      row.querySelector('[data-field="soldOut"]').checked = settings.soldOut === true;
      row.querySelector('[data-field="hidden"]').checked = settings.hidden === true;
      return row;
    }));
  }

  // ------------------------------------------------------------ load / save
  async function load() {
    const [content, catalog] = await Promise.all([
      request(undefined, true),
      fetch('/data/products.json').then(response => response.ok ? response.json() : []).catch(() => []),
    ]);
    revision = content.revision;
    products = catalog;
    for (const key of ['theme', 'accent', 'secondary', 'announcement']) editor.elements[key].value = content[key];
    for (const group of groups) {
      for (const [key, value] of Object.entries(content[group] || {})) {
        const field = editor.elements[`${group}.${key}`];
        if (field) field.value = value;
      }
    }
    photos = { ...content.photos };
    eventList.replaceChildren();
    [...content.events].sort((a, b) => b.date.localeCompare(a.date)).forEach(event => addRow(event));
    syncEventsUi();
    renderPhotos();
    renderProducts(content.products || {});
    markDirty(false);
    updatePreview();
    showEditor(true);
  }

  function collect() {
    const content = { revision };
    for (const key of ['theme', 'accent', 'secondary', 'announcement']) content[key] = editor.elements[key].value;
    for (const group of groups) {
      content[group] = {};
      for (const field of editor.querySelectorAll(`[name^="${group}."]`)) {
        content[group][field.name.slice(group.length + 1)] = field.value.trim();
      }
    }
    content.events = [...eventList.children].map(row => {
      const event = { id: row.dataset.id, image: row.dataset.image || '' };
      for (const field of row.querySelectorAll('[data-field]')) {
        event[field.dataset.field] = field.type === 'checkbox' ? field.checked : field.value.trim();
      }
      return event;
    });
    content.photos = { ...photos };
    content.products = {};
    for (const row of document.querySelectorAll('.product-admin')) {
      const price = row.querySelector('[data-field="price"]').value.trim();
      const soldOut = row.querySelector('[data-field="soldOut"]').checked;
      const hidden = row.querySelector('[data-field="hidden"]').checked;
      if (price || soldOut || hidden) content.products[row.dataset.id] = { price, soldOut, hidden };
    }
    return content;
  }

  // Friendly checks before the server's own validation.
  function problem(content) {
    for (const event of content.events) {
      if (!event.title) return 'Every event needs a title.';
      if (!event.date) return `Add a date for “${event.title}”.`;
      if (event.url && !/^https:\/\//i.test(event.url)) return `The link for “${event.title}” must start with https://`;
    }
    for (const group of ['social', 'links']) {
      for (const value of Object.values(content[group])) {
        if (value && !/^https:\/\//i.test(value)) return `Links must start with https:// (check “${value.slice(0, 40)}”).`;
      }
    }
    for (const [id, { price }] of Object.entries(content.products)) {
      if (price && !/^\$?\d{1,5}(\.\d{2})?$/.test(price)) {
        return `Write prices like 25.00 (check ${products.find(product => product.id === id)?.name || 'a product'}).`;
      }
    }
    return '';
  }

  function action(form, run) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.submitter || form.querySelector('[type="submit"]');
      button.disabled = true;
      say('');
      try { await run(); }
      catch (error) {
        say(error.message);
        if (error.status === 401 && form === editor) {
          say('Your session expired. Copy any unsaved text, then sign in again.');
        }
      }
      finally { button.disabled = false; }
    });
  }

  action(login, async () => {
    await request({ action: 'login', password: login.elements.password.value });
    login.reset();
    await load();
    say('');
  });

  action(editor, async () => {
    if (uploading) throw new Error('Wait for the photo upload to finish, then publish.');
    const content = collect();
    const issue = problem(content);
    if (issue) throw new Error(issue);
    const controls = Array.from(editor.elements).filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    logout.disabled = true;
    try {
      const saved = await request({ action: 'save', content });
      revision = saved.revision;
      markDirty(false);
      say('Changes published. They show on the site within about 15 seconds.');
    } finally {
      controls.forEach(control => { control.disabled = false; });
      logout.disabled = false;
    }
  });

  editor.addEventListener('input', () => {
    markDirty();
    updatePreview();
  });
  addEvent.addEventListener('click', () => {
    markDirty();
    const row = addRow(undefined, true);
    row.scrollIntoView({ block: 'start', behavior: 'smooth' });
    row.querySelector('[data-field="title"]').focus({ preventScroll: true });
  });
  logout.addEventListener('click', async () => {
    if (dirty && !confirm('Sign out and discard unpublished edits?')) return;
    try {
      await request({ action: 'logout' });
      markDirty(false);
      eventList.replaceChildren();
      editor.reset();
      showEditor(false);
      say('Signed out.');
    } catch (error) { say(error.message); }
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) event.preventDefault();
  });
  load().catch(error => {
    showEditor(false);
    if (error.status !== 401) say(error.message);
  });
})();
