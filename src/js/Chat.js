export default class Chat {
  constructor(apiUrl) {
    this.apiUrl = new URL(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
    this.user = null;
    this.socket = null;
    this.joining = false;
    this.elements = {};
    this.dateFormat = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  init() {
    document.querySelectorAll('[id]').forEach((element) => {
      this.elements[element.id] = element;
    });
    this.elements['login-form'].addEventListener('submit', (event) => this.login(event));
    this.elements['message-form'].addEventListener('submit', (event) => this.send(event));
    this.elements.logout.addEventListener('click', () => this.leave());
    this.elements['login-dialog'].addEventListener('cancel', (event) => event.preventDefault());
    this.elements.nickname.addEventListener('input', () => {
      this.elements.nickname.setCustomValidity('');
      this.elements.nickname.removeAttribute('aria-invalid');
      this.elements['login-error'].textContent = '';
    });
    this.elements.message.addEventListener('input', () => {
      this.elements.message.setCustomValidity('');
      this.elements['message-error'].textContent = '';
    });
    window.addEventListener('pagehide', () => this.disconnect());
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) this.leave();
    });
    this.elements['login-dialog'].showModal();
  }

  async login(event) {
    event.preventDefault();
    if (this.joining) return;
    const name = this.elements.nickname.value.trim();
    if (!name) {
      this.elements.nickname.setCustomValidity('Введите псевдоним.');
      this.elements.nickname.reportValidity();
      return;
    }
    this.joining = true;
    this.elements['login-submit'].disabled = true;
    this.elements['login-submit'].textContent = 'Подключение…';
    this.elements['login-error'].textContent = '';
    try {
      const response = await fetch(new URL('new-user', this.apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 409) throw new Error('Этот псевдоним уже занят. Выберите другой.');
      if (!response.ok) throw new Error('Не удалось войти. Попробуйте ещё раз.');
      const result = await response.json();
      if (result.status !== 'ok' || !result.user?.id) throw new Error('Не удалось войти. Попробуйте ещё раз.');
      this.user = result.user;
      await this.connect();
      this.elements.messages.replaceChildren();
      this.elements['empty-chat'].hidden = false;
      this.setConnected(true);
      this.elements['login-dialog'].close();
      this.elements.message.focus();
    } catch (error) {
      this.disconnect();
      this.elements['login-error'].textContent = error.message === 'Failed to fetch' || error.name === 'TimeoutError'
        ? 'Сервер недоступен. Проверьте подключение и попробуйте снова.' : error.message;
      this.elements.nickname.setAttribute('aria-invalid', 'true');
      this.elements.nickname.focus();
    } finally {
      this.joining = false;
      this.elements['login-submit'].disabled = false;
      this.elements['login-submit'].textContent = 'Продолжить';
    }
  }

  connect() {
    const url = new URL(this.apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('id', this.user.id);
    const socket = new WebSocket(url);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Время подключения истекло. Попробуйте снова.'));
      }, 15000);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Не удалось подключиться к чату. Попробуйте снова.'));
      }, { once: true });
      socket.addEventListener('message', (event) => {
        if (this.socket !== socket) return;
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) this.renderUsers(data);
          else if (data.type === 'send' && data.user && typeof data.message === 'string') this.renderMessage(data);
        } catch {
          this.elements['message-error'].textContent = 'Не удалось прочитать сообщение сервера.';
        }
      });
      socket.addEventListener('close', () => {
        clearTimeout(timer);
        reject(new Error('Соединение закрыто. Попробуйте снова.'));
        if (this.socket === socket) this.leave('Соединение прервано. Войдите в чат ещё раз.');
      });
    });
  }

  setConnected(connected) {
    this.elements.message.disabled = !connected;
    this.elements.send.disabled = !connected;
    this.elements.logout.disabled = !connected;
    this.elements.status.textContent = connected ? 'В сети' : 'Войдите в чат';
    document.querySelector('.connection').classList.toggle('is-connected', connected);
  }

  renderUsers(users) {
    const fragment = document.createDocumentFragment();
    users.forEach((user) => {
      const item = document.createElement('li');
      const avatar = document.createElement('span');
      const name = document.createElement('span');
      const isOwn = user.id === this.user?.id;
      item.className = `user${isOwn ? ' user-own' : ''}`;
      avatar.className = 'avatar';
      avatar.textContent = Array.from(user.name)[0]?.toUpperCase() || '?';
      avatar.setAttribute('aria-hidden', 'true');
      name.className = 'user-name';
      name.textContent = isOwn ? 'You' : user.name;
      if (isOwn) item.title = user.name;
      item.append(avatar, name);
      fragment.append(item);
    });
    this.elements.users.replaceChildren(fragment);
    this.elements['user-count'].textContent = users.length;
    this.elements['users-empty'].hidden = users.length > 0;
  }

  renderMessage(data) {
    const item = document.createElement('li');
    const meta = document.createElement('div');
    const content = document.createElement('p');
    const isOwn = data.user.id === this.user?.id;
    const timestamp = new Date(data.timestamp || Date.now());
    item.className = `message${isOwn ? ' message-own' : ''}`;
    meta.className = 'message-meta';
    meta.textContent = `${isOwn ? 'You' : data.user.name}, ${this.dateFormat.format(Number.isNaN(timestamp.getTime()) ? new Date() : timestamp)}`;
    content.className = 'message-text';
    content.textContent = data.message;
    item.append(meta, content);
    this.elements['empty-chat'].hidden = true;
    this.elements.messages.append(item);
    item.scrollIntoView({ block: 'nearest' });
  }

  send(event) {
    event.preventDefault();
    const message = this.elements.message.value.trim();
    if (!message) {
      this.elements.message.setCustomValidity('Введите сообщение.');
      this.elements.message.reportValidity();
      return;
    }
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.leave('Соединение прервано. Войдите в чат ещё раз.');
      return;
    }
    try {
      this.socket.send(JSON.stringify({ type: 'send', message, user: this.user }));
      this.elements['message-form'].reset();
      this.elements.message.focus();
    } catch {
      this.elements['message-error'].textContent = 'Не удалось отправить сообщение. Попробуйте снова.';
    }
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'exit', user: this.user }));
    }
    socket?.close();
    this.user = null;
  }

  leave(message = '') {
    this.disconnect();
    this.setConnected(false);
    this.renderUsers([]);
    this.elements['message-form'].reset();
    this.elements['login-error'].textContent = message;
    if (!this.elements['login-dialog'].open) this.elements['login-dialog'].showModal();
    this.elements.nickname.focus();
  }
}
