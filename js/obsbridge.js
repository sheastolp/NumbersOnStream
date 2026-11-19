// Tiny OBS WebSocket (v5, built into OBS 28+) client used as a message bus
// between the game and the control page. Both connect to OBS and talk with
// BroadcastCustomEvent, so the control page works from a Custom Browser Dock,
// a normal browser or another device, without sharing browser storage.
window.ObsBridge = (() => {
  const APP = 'numbersonstream';

  async function sha256b64(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  // opts: { host, port, password, onMessage(data), onStatus(state, detail) }
  function connect(opts) {
    const url = `ws://${opts.host || 'localhost'}:${opts.port || 4455}`;
    const status = opts.onStatus || (() => {});
    let ws = null, ready = false, retry = 1000, reqId = 0, closedByAuth = false;

    function open() {
      status('connecting');
      try { ws = new WebSocket(url); } catch (e) { status('error', e.message); return later(); }
      ws.onmessage = async (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.op === 0) { // Hello
          const identify = { rpcVersion: 1, eventSubscriptions: 1 /* General: includes CustomEvent */ };
          const auth = msg.d.authentication;
          if (auth) {
            if (!opts.password) { closedByAuth = true; status('error', 'OBS WebSocket needs a password'); ws.close(); return; }
            const secret = await sha256b64(opts.password + auth.salt);
            identify.authentication = await sha256b64(secret + auth.challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } else if (msg.op === 2) { // Identified
          ready = true; retry = 1000; status('connected');
        } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
          const data = msg.d.eventData;
          if (data && data.app === APP && opts.onMessage) opts.onMessage(data);
        }
      };
      ws.onclose = (ev) => {
        ready = false;
        if (ev.code === 4009) { closedByAuth = true; status('error', 'wrong OBS WebSocket password'); }
        else if (!closedByAuth) status('disconnected');
        later();
      };
      ws.onerror = () => {};
    }
    function later() { setTimeout(open, retry); retry = Math.min(retry * 2, 15000); }

    function send(data) {
      if (!ready) return false;
      ws.send(JSON.stringify({ op: 6, d: { requestType: 'BroadcastCustomEvent', requestId: String(++reqId), requestData: { eventData: { app: APP, ...data } } } }));
      return true;
    }

    open();
    return { send, get ready() { return ready; } };
  }

  // Reads ?obs=1&obspass=...&obsport=...&obshost=... from the page URL.
  function fromParams(params) {
    if (params.get('obs') !== '1') return null;
    return { host: params.get('obshost') || 'localhost', port: params.get('obsport') || 4455, password: params.get('obspass') || '' };
  }

  return { connect, fromParams };
})();
