/* Capa que le da a Foco Semanal lo que en Claude venía incluido: cuenta, base de datos en la nube (Supabase),
   IA con clave propia (Anthropic) y descargas. La app habla con window.claude; acá se implementa. */
(function () {
  'use strict';
  var CFG = { url: 'https://qphndwcaivcynmuncvfa.supabase.co', key: 'sb_publishable_07Sq1QvnHZPJtH0M3C33KQ_FbcED9FF' };
  var K_AI = 'foco-anthropic-key', K_SKIP = 'foco-sin-cuenta', K_LOCAL = 'foco-semanal-v1', K_PEND = 'foco-pendiente';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var sb = null;
  try { sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }

  /* ---------- Cuenta ---------- */
  function storedUserId() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k)) { var v = JSON.parse(localStorage.getItem(k)); if (v && v.user && v.user.id) return v.user.id; }
      }
    } catch (e) { /* sin datos */ }
    return null;
  }
  async function currentSession() {
    try { var r = await sb.auth.getSession(); return (r && r.data && r.data.session) || null; } catch (e) { return null; }
  }
  var idP = null;
  function userId() {
    if (!sb) return Promise.reject({ code: 'unavailable' });
    if (!idP) idP = (async function () {
      var s = await currentSession();
      if (s) return s.user.id;
      var cached = storedUserId();
      if (cached) return cached;
      if (lsGet(K_SKIP)) throw { code: 'unavailable' };
      return showLogin();
    })();
    return idP;
  }

  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (/invalid login/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/not confirmed/i.test(m)) return 'Falta confirmar el email. Abrí el link que te mandamos y volvé a entrar.';
    if (/already registered|already been registered/i.test(m)) return 'Ese email ya tiene cuenta. Probá con Entrar.';
    if (/password/i.test(m) && /6|short|weak/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (/fetch|network|failed/i.test(m)) return 'No hay conexión. Probá de nuevo cuando vuelva internet.';
    return 'No se pudo completar: ' + m.slice(0, 120);
  }

  function showLogin() {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('div');
      el.className = 'fx-screen';
      el.innerHTML = '<form class="fx-card" id="fxLogin" novalidate><h1>Foco Semanal</h1>' +
        '<p class="fx-hint">Entrá con tu cuenta para tener los mismos datos en todos tus dispositivos.</p>' +
        '<label class="fx-f">Email<input id="fxEmail" type="email" autocomplete="username" inputmode="email" required></label>' +
        '<label class="fx-f">Contraseña<input id="fxPass" type="password" autocomplete="current-password" minlength="6" required></label>' +
        '<p class="fx-msg" id="fxMsg" role="alert"></p>' +
        '<div class="fx-row"><button class="btn primary" type="submit" id="fxIn">Entrar</button><button class="btn" type="button" id="fxUp">Crear cuenta</button></div>' +
        '<button class="fx-link" type="button" id="fxSkip">Usar sin cuenta (solo en este dispositivo)</button></form>';
      document.body.appendChild(el);
      var msg = el.querySelector('#fxMsg'), email = el.querySelector('#fxEmail'), pass = el.querySelector('#fxPass'), busy = false;
      function setBusy(b) { busy = b; el.querySelector('#fxIn').disabled = b; el.querySelector('#fxUp').disabled = b; }
      function check() {
        if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { msg.textContent = 'Escribí un email válido.'; email.focus(); return false; }
        if (pass.value.length < 6) { msg.textContent = 'La contraseña tiene que tener al menos 6 caracteres.'; pass.focus(); return false; }
        return true;
      }
      function done(user) { el.remove(); resolve(user.id); }
      async function signIn() {
        if (busy || !check()) return;
        setBusy(true); msg.textContent = '';
        try {
          var r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
          if (r.error) throw r.error;
          lsDel(K_SKIP); done(r.data.user);
        } catch (e) { msg.textContent = errText(e); setBusy(false); }
      }
      async function signUp() {
        if (busy || !check()) return;
        setBusy(true); msg.textContent = '';
        try {
          var r = await sb.auth.signUp({ email: email.value.trim(), password: pass.value });
          if (r.error) throw r.error;
          if (r.data.session) { lsDel(K_SKIP); done(r.data.user); return; }
          msg.textContent = 'Listo. Te mandamos un email para confirmar la cuenta: abrí el link y después tocá Entrar.';
          setBusy(false);
        } catch (e) { msg.textContent = errText(e); setBusy(false); }
      }
      el.querySelector('#fxLogin').addEventListener('submit', function (ev) { ev.preventDefault(); signIn(); });
      el.querySelector('#fxUp').addEventListener('click', signUp);
      el.querySelector('#fxSkip').addEventListener('click', function () { lsSet(K_SKIP, '1'); el.remove(); reject({ code: 'unavailable' }); });
      setTimeout(function () { try { email.focus(); } catch (e) { /* sin foco */ } }, 50);
    });
  }

  /* ---------- Base de datos: un documento por usuario ---------- */
  var own = {}, ownN = 0;
  function makeDoc() {
    var uid = null, chan = null, emit = null, started = false;
    function mkSnap(row) {
      var d = row ? JSON.parse(JSON.stringify(row.data)) : null;
      if (d) delete d._w;
      return { id: 'planner', exists: !!row, data: function () { return d == null ? undefined : JSON.parse(JSON.stringify(d)); }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    async function fetchRow() {
      var r = await sb.from('planner').select('data').eq('user_id', uid).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    }
    async function refresh() {
      if (!emit || !uid) return;
      try { emit(mkSnap(await fetchRow())); } catch (e) { status('Sin conexión · los cambios se guardan al volver'); }
    }
    function status(t) { var s = $('#status'); if (s) s.textContent = t; }
    return {
      async get() { uid = uid || await userId(); return mkSnap(await fetchRow()); },
      async set(data) {
        uid = uid || await userId();
        var w = Math.random().toString(36).slice(2);
        own[w] = 1; if (++ownN > 30) { own = {}; ownN = 0; own[w] = 1; }
        var payload = Object.assign({}, data, { _w: w });
        var r;
        try { r = await sb.from('planner').upsert({ user_id: uid, data: payload }, { onConflict: 'user_id' }); }
        catch (e) { delete own[w]; throw { code: 'unavailable', message: String(e) }; }
        if (r.error) { delete own[w]; throw { code: 'unavailable', message: r.error.message }; }
      },
      async delete() { uid = uid || await userId(); var r = await sb.from('planner').delete().eq('user_id', uid); if (r.error) throw { code: 'unavailable', message: r.error.message }; },
      onSnapshot(next, error) {
        emit = next;
        (async function () {
          try { uid = await userId(); } catch (e) { if (error) error(e); return; }
          var tries = 0, first = false;
          while (!first && started === false && tries < 1e6) {
            try { emit(mkSnap(await fetchRow())); first = true; }
            catch (e) { status('Sin conexión · los cambios se guardan al volver'); await new Promise(function (r) { setTimeout(r, Math.min(30000, 3000 * (++tries))); }); }
          }
          if (started) return;
          started = true;
          try {
            chan = sb.channel('planner-' + uid).on('postgres_changes', { event: '*', schema: 'public', table: 'planner', filter: 'user_id=eq.' + uid }, function (p) {
              var row = p && p.new; if (!row || !row.data) return;
              if (row.data._w && own[row.data._w]) return;
              emit(mkSnap(row));
            }).subscribe();
          } catch (e) { /* sin tiempo real: queda la actualización al volver a la app */ }
          document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });
          window.addEventListener('online', refresh);
        })();
        return function () { emit = null; try { if (chan) sb.removeChannel(chan); } catch (e) { /* ya cerrado */ } };
      }
    };
  }
  var dbApi = { doc: function () { return makeDoc(); }, collection: function () { throw new Error('no usado'); } };
  var userApi = { id: userId, isOwner: function () { return true; }, canEdit: function () { return true; }, can: function () { return true; } };

  /* ---------- IA con clave propia ---------- */
  async function ask(prompt, opts) {
    opts = opts || {};
    var content = prompt;
    if (opts.attachments && opts.attachments.length) {
      content = opts.attachments.map(function (a) {
        if (a.kind === 'image') return { type: 'image', source: { type: 'base64', media_type: a.type, data: a.data } };
        if (a.kind === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } };
        return { type: 'text', text: 'Archivo adjunto "' + a.name + '":\n' + a.text };
      }).concat([{ type: 'text', text: prompt }]);
    }
    var key = lsGet(K_AI), model = opts.modelTier === 'quick' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-5-5', stream = typeof opts.onText === 'function', res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: opts.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: model, max_tokens: 1800, stream: stream, messages: [{ role: 'user', content: content }] })
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelado' };
      throw { code: 'upstream_error', message: String(e) };
    }
    if (!res.ok) {
      var c = res.status === 401 || res.status === 403 ? 'bad_key' : res.status === 429 ? 'rate_limited' : 'upstream_error';
      throw { code: c, message: 'HTTP ' + res.status };
    }
    var text = '', truncated = false;
    try {
      if (!stream) {
        var j = await res.json();
        text = (j.content || []).map(function (b) { return b.type === 'text' ? b.text : ''; }).join('');
        truncated = j.stop_reason === 'max_tokens';
      } else {
        var rd = res.body.getReader(), dec = new TextDecoder(), buf = '';
        for (;;) {
          var chunk = await rd.read();
          if (chunk.done) break;
          buf += dec.decode(chunk.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].trim();
            if (ln.indexOf('data:') !== 0) continue;
            var ev; try { ev = JSON.parse(ln.slice(5)); } catch (e) { continue; }
            if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; opts.onText({ text: text, delta: ev.delta.text }); }
            else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason === 'max_tokens') truncated = true;
          }
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelado' };
      throw { code: 'upstream_error', message: String(e) };
    }
    if (!text.trim()) throw { code: 'empty_completion', message: 'vacío' };
    return { text: text, truncated: truncated, modelTierApplied: opts.modelTier || 'default' };
  }
  var sampleFn = function (input, opts) { return ask(String(input), opts); };
  sampleFn.json = async function (input, opts) {
    var r = await ask(String(input), opts), t = r.text, m = /```(?:json)?\s*([\s\S]*?)```/.exec(t), s = m ? m[1] : t;
    var i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i < 0 || j <= i) throw { code: 'invalid_json', message: 'sin JSON', text: t };
    try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { throw { code: 'invalid_json', message: String(e), text: t }; }
  };

  /* ---------- Descargas ---------- */
  var dlApi = {
    save: async function (r) {
      var isCsv = /\.csv$/i.test(r.filename || '');
      var blob = new Blob([isCsv ? '﻿' : '', r.data], { type: isCsv ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
      var a = document.createElement('a'), u = URL.createObjectURL(blob);
      a.href = u; a.download = r.filename || 'archivo'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      return { status: 'saved' };
    }
  };

  window.claude = {
    use: async function (name) {
      if (name === 'db') return sb ? dbApi : null;
      if (name === 'user') return sb ? userApi : null;
      if (name === 'sample') return lsGet(K_AI) ? sampleFn : null;
      if (name === 'downloads') return dlApi;
      return null;
    }
  };

  /* ---------- Botón y ventana de Cuenta ---------- */
  function openAccount() {
    if (document.querySelector('.fx-screen')) return;
    (async function () {
      var s = sb ? await currentSession() : null, key = lsGet(K_AI) || '';
      var el = document.createElement('div');
      el.className = 'fx-screen';
      el.innerHTML = '<div class="fx-card" role="dialog" aria-label="Cuenta"><h1>Cuenta</h1>' +
        '<p class="fx-hint">' + (s ? 'Sesión iniciada como <b>' + esc(s.user.email) + '</b>.' : 'Estás usando la app solo en este dispositivo.') + '</p>' +
        (s ? '<button class="btn danger" type="button" id="fxOut" data-ok="0">Cerrar sesión</button>' : '<button class="btn primary" type="button" id="fxGo">Entrar o crear cuenta</button>') +
        '<hr class="fx-hr"><label class="fx-f">Clave de API de Anthropic (para planificar y el coaching con IA)<input id="fxKey" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(key) + '"></label>' +
        '<p class="fx-hint">La clave se guarda solo en este dispositivo y las consultas se pagan según uso. Si la dejás vacía, la IA queda oculta.</p>' +
        '<div class="fx-row"><button class="btn primary" type="button" id="fxSaveKey">Guardar clave</button><button class="btn" type="button" id="fxClose">Cerrar</button></div></div>';
      document.body.appendChild(el);
      el.querySelector('#fxClose').addEventListener('click', function () { el.remove(); });
      el.addEventListener('click', function (ev) { if (ev.target === el) el.remove(); });
      el.querySelector('#fxSaveKey').addEventListener('click', function () {
        var v = el.querySelector('#fxKey').value.trim();
        if (v) lsSet(K_AI, v); else lsDel(K_AI);
        location.reload();
      });
      var out = el.querySelector('#fxOut');
      if (out) out.addEventListener('click', async function () {
        if (out.getAttribute('data-ok') !== '1') { out.setAttribute('data-ok', '1'); out.textContent = 'Tocá de nuevo: se borra la copia de este dispositivo (en la nube queda todo)'; return; }
        try { await sb.auth.signOut(); } catch (e) { /* sin conexión */ }
        lsDel(K_LOCAL); lsDel(K_PEND); lsDel(K_SKIP);
        location.reload();
      });
      var go = el.querySelector('#fxGo');
      if (go) go.addEventListener('click', function () { lsDel(K_SKIP); location.reload(); });
    })();
  }
  document.addEventListener('DOMContentLoaded', function () {
    var top = $('.rail-top');
    if (top) {
      var b = document.createElement('button');
      b.className = 'pill fx-acc'; b.type = 'button'; b.textContent = 'Cuenta'; b.setAttribute('data-fx', 'account');
      top.appendChild(b);
      b.addEventListener('click', openAccount);
    }
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo offline */ }); });
  }
})();
