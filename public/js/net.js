// การเชื่อมต่อเล่นร่วมกับเพื่อน (WebSocket)
export class Net {
  constructor() { this.ws = null; this.online = false; this.handlers = []; }
  connect(url) {
    return new Promise((resolve) => {
      let done = false;
      try { this.ws = new WebSocket(url); } catch { return resolve(false); }
      const fail = () => { if (!done) { done = true; resolve(false); } };
      setTimeout(fail, 4000);
      this.ws.onopen = () => { done = true; this.online = true; resolve(true); };
      this.ws.onerror = fail;
      this.ws.onclose = () => { if (this.online) this.handlers.forEach((h) => h({ t: 'disconnected' })); this.online = false; };
      this.ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.handlers.forEach((h) => h(m)); };
    });
  }
  on(h) { this.handlers.push(h); }
  send(m) { if (this.online && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
}
