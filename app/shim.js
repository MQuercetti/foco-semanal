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

  /* ---------- IA con clave propia (Anthropic y cualquier servicio compatible con OpenAI) ---------- */
  var K_CFG = 'foco-ai-config';
  var PROVIDERS = {
    anthropic: { name: 'Anthropic (Claude)', kind: 'anthropic', url: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5', ph: 'sk-ant-…' },
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o', ph: 'sk-…', pdf: true, mct: true },
    gemini: { name: 'Google Gemini (AI Studio)', kind: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-flash-latest', ph: 'AIza…' },
    openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', ph: 'sk-or-…' },
    groq: { name: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', ph: 'gsk_…' },
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', ph: 'sk-…' },
    mistral: { name: 'Mistral', url: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', ph: '' },
    opencode: { name: 'OpenCode Zen', url: 'https://opencode.ai/inference/openai/v1', list: 'https://opencode.ai/inference/v1', proxy: true, model: 'kimi-k3', ph: 'Clave de la consola de OpenCode', editUrl: true },
    opencodego: { name: 'OpenCode Go', url: 'https://opencode.ai/inference/go/openai/v1', list: 'https://opencode.ai/inference/go/v1', proxy: true, model: 'kimi-k3', ph: 'Clave de OpenCode', editUrl: true },
    ollama: { name: 'Ollama (en tu compu)', url: 'http://localhost:11434/v1', model: 'llama3.2', ph: 'No hace falta', nokey: true, editUrl: true },
    custom: { name: 'Otro (compatible con OpenAI)', url: '', model: '', ph: 'Clave (si el servicio la pide)', nokey: true, editUrl: true }
  };
  var cfg = null;
  function loadCfg() {
    try { var c = JSON.parse(lsGet(K_CFG) || 'null'); if (c && c.providers && typeof c.providers === 'object') return c; } catch (e) { /* configuración dañada */ }
    var old = lsGet(K_AI);
    return old ? { active: 'anthropic', providers: { anthropic: { key: old } } } : null;
  }
  function pick(c, loose) {
    if (!c || !c.providers) return null;
    var id = c.active, d = PROVIDERS[id], u = c.providers[id];
    if (!d || !u) return null;
    var key = String(u.key || '').trim(), url = String((d.editUrl ? u.url : '') || d.url || '').trim().replace(/\/+$/, ''), model = String(u.model || d.model || '').trim();
    if ((!key && !d.nokey) || !url || (!model && !loose)) return null;
    return { id: id, kind: d.kind || 'openai', key: key, url: url, model: model, pdf: !!d.pdf, mct: !!d.mct, list: (!u.url && d.list) || '', proxy: !!d.proxy };
  }
  function activeP() { return pick(cfg); }
  async function cloudLoad() {
    try {
      var s = sb ? await currentSession() : null;
      if (!s) return null;
      var r = await sb.from('ai_settings').select('config').eq('user_id', s.user.id).maybeSingle();
      return r && !r.error && r.data && r.data.config && r.data.config.providers ? r.data.config : null;
    } catch (e) { return null; }
  }
  async function cloudSave(c) {
    var s = await currentSession(); if (!s) throw new Error('sin sesión');
    var r = await sb.from('ai_settings').upsert({ user_id: s.user.id, config: c, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (r.error) throw r.error;
  }
  async function cloudDel() {
    var s = await currentSession(); if (!s) return;
    await sb.from('ai_settings').delete().eq('user_id', s.user.id);
  }
  function httpErr(status, body) {
    var c = status === 401 || status === 403 ? 'bad_key' : status === 429 ? 'rate_limited' : 'upstream_error', m = '';
    try { var j = JSON.parse(body); m = (j.error && (j.error.message || j.error)) || j.message || ''; } catch (e) { m = String(body || '').slice(0, 160); }
    if (status === 400 && /api key not valid|api_key_invalid/i.test(String(m) + body)) c = 'bad_key';
    return { code: c, message: 'HTTP ' + status + (m ? ': ' + String(m).slice(0, 160) : ''), status: status };
  }
  /* Algunos servicios (OpenCode) no permiten llamadas directas desde el navegador (CORS):
     con la cuenta iniciada pasan por una función propia que solo reenvía a ese servicio. */
  var OC_SES = 'foco' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  async function aiFetch(P, url, init) {
    if (P.proxy) {
      var s = null; try { s = await currentSession(); } catch (e) { /* sin sesión */ }
      if (s && s.access_token) {
        var h = { authorization: 'Bearer ' + s.access_token, apikey: CFG.key, 'x-target-url': url };
        var inh = init.headers || {};
        if (inh.authorization) h['x-target-auth'] = inh.authorization;
        if (inh['content-type']) h['content-type'] = inh['content-type'];
        h['x-opencode-session'] = OC_SES;
        return fetch(CFG.url + '/functions/v1/ai-proxy', { method: init.method || 'GET', signal: init.signal, headers: h, body: init.body });
      }
    }
    return fetch(url, init);
  }
  async function listModels(c) {
    var P = pick(c, true);
    if (!P) throw { code: 'bad_key', message: 'Falta la clave o la dirección.' };
    var url, headers = {};
    if (P.kind === 'anthropic') { url = P.url + '/models?limit=100'; headers = { 'x-api-key': P.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }; }
    else if (P.kind === 'gemini') { url = P.url + '/models?pageSize=200'; headers = { 'x-goog-api-key': P.key }; }
    else { url = (P.list || P.url) + '/models'; if (P.key) headers = { authorization: 'Bearer ' + P.key }; }
    var res;
    try { res = await aiFetch(P, url, { headers: headers }); } catch (e) { throw { code: 'network', message: String(e) }; }
    var tx = await res.text();
    if (!res.ok) throw httpErr(res.status, tx);
    var j = {}; try { j = JSON.parse(tx); } catch (e) { /* respuesta no JSON */ }
    var ids = P.kind === 'gemini' ? (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0; }).map(function (m) { return String(m.name || '').replace(/^models\//, ''); })
      : (j.data || j.models || []).map(function (m) { return m.id || m.name; });
    return ids.filter(Boolean).slice(0, 300);
  }
  async function ask(prompt, opts) {
    opts = opts || {};
    var P = activeP();
    if (!P) throw { code: 'bad_key', message: 'sin configurar' };
    var atts = opts.attachments || [], stream = typeof opts.onText === 'function', res, url, headers, body;
    if (P.kind === 'anthropic') {
      var content = prompt;
      if (atts.length) {
        content = atts.map(function (a) {
          if (a.kind === 'image') return { type: 'image', source: { type: 'base64', media_type: a.type, data: a.data } };
          if (a.kind === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } };
          return { type: 'text', text: 'Archivo adjunto "' + a.name + '":\n' + a.text };
        }).concat([{ type: 'text', text: prompt }]);
      }
      url = P.url + '/messages';
      headers = { 'content-type': 'application/json', 'x-api-key': P.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = { model: P.model, max_tokens: 1800, stream: stream, messages: [{ role: 'user', content: content }] };
    } else if (P.kind === 'gemini') {
      var parts = atts.map(function (a) {
        if (a.kind === 'image' || a.kind === 'pdf') return { inline_data: { mime_type: a.kind === 'pdf' ? 'application/pdf' : a.type, data: a.data } };
        return { text: 'Archivo adjunto "' + a.name + '":\n' + a.text };
      }).concat([{ text: prompt }]);
      url = P.url + '/models/' + encodeURIComponent(P.model) + (stream ? ':streamGenerateContent?alt=sse' : ':generateContent');
      headers = { 'content-type': 'application/json', 'x-goog-api-key': P.key };
      body = { contents: [{ role: 'user', parts: parts }], generationConfig: { maxOutputTokens: 8192 } };
    } else {
      var oc = prompt;
      if (atts.length) {
        oc = atts.map(function (a) {
          if (a.kind === 'image') return { type: 'image_url', image_url: { url: 'data:' + a.type + ';base64,' + a.data } };
          if (a.kind === 'pdf') return P.pdf ? { type: 'file', file: { filename: a.name, file_data: 'data:application/pdf;base64,' + a.data } } : { type: 'text', text: '[Adjuntó el PDF "' + a.name + '", pero este proveedor no lee PDF. Pedile que lo mande como foto o texto.]' };
          return { type: 'text', text: 'Archivo adjunto "' + a.name + '":\n' + a.text };
        }).concat([{ type: 'text', text: prompt }]);
      }
      url = P.url + '/chat/completions';
      headers = { 'content-type': 'application/json' };
      if (P.key) headers.authorization = 'Bearer ' + P.key;
      body = { model: P.model, stream: stream, messages: [{ role: 'user', content: oc }] };
      body[P.mct ? 'max_completion_tokens' : 'max_tokens'] = 1800;
    }
    try {
      res = await aiFetch(P, url, { method: 'POST', signal: opts.signal, headers: headers, body: JSON.stringify(body) });
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelado' };
      throw { code: 'network', message: String(e) };
    }
    if (!res.ok) { var tx = ''; try { tx = await res.text(); } catch (e) { /* sin cuerpo */ } throw httpErr(res.status, tx); }
    var text = '', truncated = false;
    function gtext(j) {
      var cd = j.candidates && j.candidates[0];
      if (cd && cd.finishReason === 'MAX_TOKENS') truncated = true;
      return cd && cd.content && cd.content.parts ? cd.content.parts.map(function (x) { return typeof x.text === 'string' && !x.thought ? x.text : ''; }).join('') : '';
    }
    function piece(j) {
      if (P.kind === 'gemini') return gtext(j);
      if (P.kind === 'anthropic') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') return j.delta.text;
        if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'max_tokens') truncated = true;
        return '';
      }
      var ch = j.choices && j.choices[0];
      if (ch && ch.finish_reason === 'length') truncated = true;
      return (ch && ch.delta && typeof ch.delta.content === 'string') ? ch.delta.content : '';
    }
    try {
      if (!stream) {
        var j = await res.json();
        if (P.kind === 'gemini') text = gtext(j);
        else if (P.kind === 'anthropic') { text = (j.content || []).map(function (b) { return b.type === 'text' ? b.text : ''; }).join(''); truncated = j.stop_reason === 'max_tokens'; }
        else { var c0 = j.choices && j.choices[0]; var mc = c0 && c0.message && c0.message.content; text = typeof mc === 'string' ? mc : Array.isArray(mc) ? mc.map(function (b) { return b.text || ''; }).join('') : ''; truncated = !!(c0 && c0.finish_reason === 'length'); }
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
            var raw = ln.slice(5).trim();
            if (raw === '[DONE]') continue;
            var ev; try { ev = JSON.parse(raw); } catch (e) { continue; }
            var d = piece(ev);
            if (d) { text += d; opts.onText({ text: text, delta: d }); }
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
      if (name === 'sample') {
        cfg = loadCfg();
        var cc = await Promise.race([cloudLoad(), new Promise(function (r) { setTimeout(function () { r(null); }, 3500); })]);
        if (cc) { cfg = cc; lsSet(K_CFG, JSON.stringify(cc)); }
        return activeP() ? sampleFn : null;
      }
      if (name === 'downloads') return dlApi;
      return null;
    }
  };

  /* ---------- Avisos con la app cerrada (Web Push) ---------- */
  var PUSH = {
    fn: CFG.url + '/functions/v1/push-reminders',
    supported: function () { return !!sb && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    u8: function (b64) { var t = b64.replace(/-/g, '+').replace(/_/g, '/'); var r = atob(t + '='.repeat((4 - t.length % 4) % 4)); var o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; },
    sub: async function () { try { var reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; } },
    status: async function () {
      if (!PUSH.supported()) return 'unsupported';
      if (Notification.permission === 'denied') return 'blocked';
      return (Notification.permission === 'granted' && await PUSH.sub()) ? 'on' : 'off';
    },
    save: async function (sub, uid) {
      var j = sub.toJSON(), tz = 'UTC';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* UTC */ }
      var r = await sb.from('push_subs').upsert({ user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: tz }, { onConflict: 'endpoint' });
      if (r.error) throw r.error;
    },
    enable: async function () {
      var s = await currentSession();
      if (!s) throw new Error('Iniciá sesión para activar los avisos.');
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('No diste permiso para las notificaciones.');
      var reg = await navigator.serviceWorker.ready;
      var kr = await fetch(PUSH.fn + '?action=key'), kj = await kr.json();
      if (!kj.key) throw new Error('No se pudo preparar el servicio de avisos.');
      var sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: PUSH.u8(kj.key) });
      await PUSH.save(sub, s.user.id);
    },
    disable: async function () {
      var sub = await PUSH.sub();
      if (sub) { var ep = sub.endpoint; try { await sub.unsubscribe(); } catch (e) { /* ya estaba */ } try { await sb.from('push_subs').delete().eq('endpoint', ep); } catch (e) { /* sin conexión */ } }
    },
    sync: async function () {
      try { if (await PUSH.status() !== 'on') return; var s = await currentSession(), sub = await PUSH.sub(); if (s && sub) await PUSH.save(sub, s.user.id); } catch (e) { /* se reintenta en el próximo arranque */ }
    }
  };
  window.addEventListener('load', function () { setTimeout(PUSH.sync, 4000); });

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
        '<hr class="fx-hr"><h2 class="fx-h">Avisos con la app cerrada</h2>' +
        '<p class="fx-hint" id="fxPushHint"></p><p class="fx-msg" id="fxPushMsg" role="status"></p>' +
        '<div class="fx-row"><button class="btn" type="button" id="fxPush" hidden></button></div>' +
        (s ? '<hr class="fx-hr"><h2 class="fx-h">Calendario por enlace</h2>' +
          '<p class="fx-hint" id="fxCalHint">Mirá tus bloques y exámenes en Google Calendar u otra app de calendario, y se actualizan solos.</p>' +
          '<input class="fx-f" id="fxCalUrl" type="text" readonly hidden aria-label="Enlace del calendario"><p class="fx-msg" id="fxCalMsg" role="status"></p>' +
          '<div class="fx-row"><button class="btn" type="button" id="fxCalOn">Crear enlace</button><button class="btn" type="button" id="fxCalCopy" hidden>Copiar enlace</button><button class="btn danger" type="button" id="fxCalOff" data-ok="0" hidden>Desactivar</button></div>' : '') +
        '<hr class="fx-hr"><h2 class="fx-h">IA del asistente</h2>' +
        '<label class="fx-f">Proveedor<select id="fxProv">' + Object.keys(PROVIDERS).map(function (k) { return '<option value="' + k + '">' + esc(PROVIDERS[k].name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fx-f">Clave de API<input id="fxKey" type="password" autocomplete="off" spellcheck="false"></label>' +
        '<label class="fx-f">Modelo<input id="fxModel" type="text" list="fxModels" autocomplete="off" spellcheck="false"><datalist id="fxModels"></datalist></label>' +
        '<label class="fx-f" id="fxUrlW">Dirección del servicio (URL base)<input id="fxUrl" type="text" autocomplete="off" spellcheck="false" placeholder="https://…/v1"></label>' +
        (s ? '<label class="fx-chk"><input type="checkbox" id="fxCloud" checked><span>Guardar en mi cuenta para usarla en todos mis dispositivos</span></label>' : '') +
        '<p class="fx-hint" id="fxHint"></p><p class="fx-msg" id="fxAiMsg" role="status"></p>' +
        '<div class="fx-row"><button class="btn primary" type="button" id="fxSaveKey">Guardar</button><button class="btn" type="button" id="fxList">Ver modelos</button><button class="btn" type="button" id="fxTest">Probar</button><button class="btn" type="button" id="fxClose">Cerrar</button></div></div>';
      document.body.appendChild(el);
      try { if (window.focoDesktop && window.focoDesktop.version) window.focoDesktop.version().then(function (v) { if (v) { var h = el.querySelector('h1'); if (h) h.insertAdjacentHTML('afterend', '<p class="fx-hint">Foco Semanal, versión ' + esc(v) + '</p>'); } }); } catch (e) { /* sin escritorio */ }
      (async function () {
        var btn = el.querySelector('#fxPush'), hint = el.querySelector('#fxPushHint'), msg = el.querySelector('#fxPushMsg');
        async function paint() {
          var st = await PUSH.status();
          btn.hidden = true; msg.textContent = '';
          if (window.focoDesktop) hint.textContent = 'En Windows la app sigue activa en la bandeja del sistema (junto al reloj) y te avisa aunque cierres la ventana. Desde el menú de ese ícono también podés elegir Iniciar con Windows o Salir para cerrarla del todo.';
          else if (!s) hint.textContent = 'Iniciá sesión para recibir avisos de tus bloques aunque la app esté cerrada.';
          else if (st === 'unsupported') hint.textContent = 'Este navegador no admite avisos con la app cerrada. En iPhone, primero agregá la app a la pantalla de inicio.';
          else if (st === 'blocked') hint.textContent = 'Las notificaciones están bloqueadas para este sitio. Activalas en los ajustes del navegador o del teléfono.';
          else if (st === 'on') { hint.textContent = 'Activados en este dispositivo: te llegan los avisos de tus bloques aunque no tengas la app abierta.'; btn.textContent = 'Desactivar en este dispositivo'; btn.hidden = false; }
          else { hint.textContent = 'Recibí los avisos de tus bloques aunque no tengas la app abierta.'; btn.textContent = 'Activar en este dispositivo'; btn.hidden = false; }
        }
        await paint();
        btn.addEventListener('click', async function () {
          btn.disabled = true; msg.textContent = '';
          try { if (await PUSH.status() === 'on') await PUSH.disable(); else await PUSH.enable(); } catch (e) { msg.textContent = (e && e.message) || 'No se pudo cambiar.'; }
          btn.disabled = false; var m = msg.textContent; await paint(); msg.textContent = m;
        });
      })();
      if (s) (async function () {
        var on = el.querySelector('#fxCalOn'), cp = el.querySelector('#fxCalCopy'), off = el.querySelector('#fxCalOff'), u = el.querySelector('#fxCalUrl'), msg = el.querySelector('#fxCalMsg'), hint = el.querySelector('#fxCalHint');
        function paint(tok) {
          msg.textContent = '';
          if (tok) {
            u.value = CFG.url + '/functions/v1/calendar-feed?t=' + tok; u.hidden = cp.hidden = off.hidden = false; on.hidden = true;
            hint.textContent = 'En Google Calendar: Otros calendarios → Desde URL, y pegá este enlace. Cualquiera que tenga el enlace puede ver tus bloques, así que no lo compartas. Si se filtró, desactivalo y creá otro.';
          } else { u.hidden = cp.hidden = off.hidden = true; on.hidden = false; hint.textContent = 'Mirá tus bloques y exámenes en Google Calendar u otra app de calendario, y se actualizan solos.'; }
        }
        try { var r = await sb.from('cal_feeds').select('token').eq('user_id', s.user.id).maybeSingle(); paint(r.data && r.data.token); } catch (e) { paint(null); }
        on.addEventListener('click', async function () {
          on.disabled = true; var tz = 'UTC'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* UTC */ }
          try { var r = await sb.from('cal_feeds').upsert({ user_id: s.user.id, tz: tz }, { onConflict: 'user_id' }).select('token').single(); if (r.error) throw r.error; paint(r.data.token); }
          catch (e) { msg.textContent = (e && e.message) || 'No se pudo crear el enlace.'; }
          on.disabled = false;
        });
        cp.addEventListener('click', async function () { try { await navigator.clipboard.writeText(u.value); msg.textContent = 'Enlace copiado.'; } catch (e) { u.select(); msg.textContent = 'Copialo a mano.'; } });
        off.addEventListener('click', async function () {
          if (off.dataset.ok !== '1') { off.dataset.ok = '1'; off.textContent = 'Tocá de nuevo para desactivar'; return; }
          try { var r = await sb.from('cal_feeds').delete().eq('user_id', s.user.id); if (r.error) throw r.error; off.dataset.ok = '0'; off.textContent = 'Desactivar'; paint(null); }
          catch (e) { msg.textContent = (e && e.message) || 'No se pudo desactivar.'; }
        });
      })();
      var draft = JSON.parse(JSON.stringify(cfg || loadCfg() || { active: 'anthropic', providers: {} }));
      if (!draft.providers) draft.providers = {};
      var prov = PROVIDERS[draft.active] ? draft.active : 'anthropic', $f = function (id) { return el.querySelector(id); };
      function stash() { var d = PROVIDERS[prov]; draft.providers[prov] = { key: $f('#fxKey').value.trim(), model: $f('#fxModel').value.trim(), url: $f('#fxUrl').value.trim() }; if (!draft.providers[prov].key && !d.nokey) delete draft.providers[prov]; }
      function show() {
        var d = PROVIDERS[prov], u = draft.providers[prov] || {};
        $f('#fxProv').value = prov;
        $f('#fxKey').value = u.key || ''; $f('#fxKey').placeholder = d.ph || '';
        $f('#fxModel').value = u.model || ''; $f('#fxModel').placeholder = d.model || 'Nombre del modelo';
        $f('#fxUrl').value = u.url || ''; $f('#fxUrl').placeholder = d.url || 'https://…/v1';
        $f('#fxUrlW').hidden = !d.editUrl;
        $f('#fxHint').textContent = (prov === 'opencode' || prov === 'opencodego') ? 'Usá la clave de opencode.ai. Si tu cuenta usa otra dirección, cambiala abajo. Con el modelo vacío se usa el sugerido; podés poner el que quieras (ej: kimi-k3, glm-5.3, deepseek-v4-pro).' : prov === 'ollama' ? 'Ollama corre en tu compu y no cobra. Tiene que estar abierto y permitir este origen (OLLAMA_ORIGINS).' : prov === 'custom' ? 'Sirve cualquier servicio con la API de chat de OpenAI (LM Studio, Together, Fireworks, un proxy propio…). Poné la URL base y el modelo.' : 'Las consultas se cobran según uso al proveedor. Podés dejar cargadas varias claves y cambiar de proveedor cuando quieras. Si el modelo ya no existe, escribí el nombre del vigente.';
        $f('#fxAiMsg').textContent = '';
      }
      show();
      $f('#fxProv').addEventListener('change', function () { stash(); prov = $f('#fxProv').value; show(); });
      function finalCfg() { stash(); draft.active = prov; return JSON.parse(JSON.stringify(draft)); }
      /* Al cerrar sin tocar Guardar no se pierde lo que escribiste: queda en este dispositivo
         (la copia en la cuenta solo se actualiza con Guardar). Nunca borra una clave ya guardada. */
      function closeDlg() {
        try {
          var c = finalCfg();
          if (Object.keys(c.providers).length && JSON.stringify(c) !== JSON.stringify(cfg || loadCfg() || null)) { lsSet(K_CFG, JSON.stringify(c)); cfg = c; }
        } catch (e) { /* no se pudo guardar */ }
        el.remove();
      }
      el.querySelector('#fxClose').addEventListener('click', closeDlg);
      el.addEventListener('click', function (ev) { if (ev.target === el) closeDlg(); });
      el.querySelector('#fxList').addEventListener('click', async function () {
        var msg = $f('#fxAiMsg'), c = finalCfg();
        msg.style.color = 'var(--ink-2)'; msg.textContent = 'Buscando modelos…';
        try {
          var ids = await listModels(c);
          $f('#fxModels').innerHTML = ids.map(function (i) { return '<option value="' + esc(i) + '">'; }).join('');
          msg.style.color = 'var(--good)'; msg.textContent = ids.length ? ids.length + ' modelos disponibles. Tocá el campo Modelo y elegí uno.' : 'No devolvió modelos. Escribí el nombre a mano.';
        } catch (e) { msg.style.color = 'var(--danger)'; msg.textContent = e && e.code === 'bad_key' ? 'La clave no es válida o falta (' + (e.message || '') + ').' : e && e.code === 'network' ? 'No se pudo conectar. Revisá la dirección y tu conexión.' : 'No se pudo listar: ' + String((e && e.message) || e).slice(0, 140); }
      });
      el.querySelector('#fxTest').addEventListener('click', async function () {
        var msg = $f('#fxAiMsg'), c = finalCfg(), prev = cfg;
        if (!pick(c)) { msg.style.color = 'var(--danger)'; msg.textContent = 'Falta la clave, el modelo o la dirección.'; return; }
        msg.style.color = 'var(--ink-2)'; msg.textContent = 'Probando…';
        cfg = c;
        try { var r = await ask('Respondé solo con la palabra OK.', {}); msg.style.color = 'var(--good)'; msg.textContent = 'Funciona. Respondió: ' + r.text.trim().slice(0, 40); }
        catch (e) { msg.style.color = 'var(--danger)'; msg.textContent = e && e.code === 'bad_key' ? 'La clave no es válida (' + (e.message || '') + ').' : e && e.code === 'network' ? 'No se pudo conectar. Revisá la dirección y tu conexión.' : 'No funcionó: ' + String((e && e.message) || e).slice(0, 140); }
        cfg = prev;
      });
      el.querySelector('#fxSaveKey').addEventListener('click', async function () {
        var c = finalCfg(), has = Object.keys(c.providers).length > 0, cl = $f('#fxCloud'), msg = $f('#fxAiMsg');
        if (has) lsSet(K_CFG, JSON.stringify(c)); else lsDel(K_CFG);
        lsDel(K_AI);
        if (s) {
          try { if (has && cl && cl.checked) await cloudSave(c); else await cloudDel(); }
          catch (e) { msg.style.color = 'var(--danger)'; msg.textContent = 'Se guardó en este dispositivo, pero no en la cuenta: ' + String((e && e.message) || e).slice(0, 100); return; }
        }
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

/* Selector propio: reemplaza la lista desplegable nativa (que el navegador dibuja a su manera)
   por una que sigue el diseño de la app. El <select> original sigue ahí, oculto, y es el que guarda el valor:
   todo el código que lo lee o lo escucha funciona igual. */
(function () {
  'use strict';
  var css = [
    '.ss-native{position:absolute!important;width:1px!important;height:1px!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)}',
    '.ss{display:block;min-width:0;max-width:100%}',
    '.ss-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-width:0;cursor:pointer;font:inherit;font-size:15px;color:var(--ink);background:var(--fill,var(--surface-2));border-radius:10px;padding:8px 11px;transition:background-color 140ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}',
    '.ss-btn:focus-visible{outline:2px solid var(--accent);outline-offset:0}',
    '.ss-btn:active{transform:scale(.99)}',
    '.ss-btn[disabled]{opacity:.5;cursor:default}',
    '.ss-btn .ss-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ss-btn .ss-t.ph{opacity:.6}',
    '.ss-btn::after{content:"";flex:none;width:12px;height:12px;background:currentColor;opacity:.6;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M2.5 4.5 6 8l3.5-3.5\' fill=\'none\' stroke=\'black\' stroke-width=\'1.6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M2.5 4.5 6 8l3.5-3.5\' fill=\'none\' stroke=\'black\' stroke-width=\'1.6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E") center/contain no-repeat;transition:transform 160ms cubic-bezier(.23,1,.32,1)}',
    '.ss-btn[aria-expanded="true"]::after{transform:rotate(180deg)}',
    '.lock-main .ss-btn{background:color-mix(in srgb,var(--on) 10%,transparent);color:var(--on)}',
    '.ss-pop{position:fixed;z-index:10000;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:5px;border-radius:14px;background:var(--surface);color:var(--ink);box-shadow:0 10px 32px rgba(0,0,0,.28),0 0 0 1px color-mix(in srgb,var(--ink) 7%,transparent);opacity:0;transform:translateY(-4px) scale(.98);transform-origin:var(--ss-o,top);transition:opacity 130ms ease-out,transform 160ms cubic-bezier(.23,1,.32,1)}',
    '.ss-pop.in{opacity:1;transform:none}',
    '.ss-pop.up{--ss-o:bottom;transform:translateY(4px) scale(.98)}',
    '.ss-pop.up.in{transform:none}',
    '.ss-o{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:15px;line-height:1.25;user-select:none;-webkit-user-select:none}',
    '.ss-o .ss-x{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ss-o.act{background:var(--fill-2,var(--surface-2))}',
    '.ss-o[aria-selected="true"]{background:color-mix(in srgb,var(--accent) 16%,transparent);font-weight:600}',
    '.ss-o[aria-selected="true"]::after{content:"";flex:none;width:14px;height:14px;background:var(--accent);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 14 14\'%3E%3Cpath d=\'M2.5 7.5 5.5 10.5 11.5 3.8\' fill=\'none\' stroke=\'black\' stroke-width=\'1.8\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 14 14\'%3E%3Cpath d=\'M2.5 7.5 5.5 10.5 11.5 3.8\' fill=\'none\' stroke=\'black\' stroke-width=\'1.8\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E") center/contain no-repeat}',
    '.ss-o[aria-disabled="true"]{opacity:.4;cursor:default}',
    '.ss-g{padding:9px 11px 4px;font-size:12px;font-weight:600;opacity:.6}',
    '@media (max-width:700px),(pointer:coarse){.ss-btn{font-size:16px}.ss-o{min-height:44px;font-size:16px}}',
    '@media (prefers-reduced-motion:reduce){.ss-pop,.ss-btn,.ss-btn::after{transition:none}.ss-pop{transform:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var openS = null; // { sel, btn, pop, items, act, typed, tt, cleanup }

  function optsOf(sel) {
    var out = [];
    Array.prototype.forEach.call(sel.children, function (n) {
      if (n.tagName === 'OPTGROUP') {
        out.push({ group: n.label || '' });
        Array.prototype.forEach.call(n.children, function (o) { out.push({ o: o }); });
      } else if (n.tagName === 'OPTION') out.push({ o: n });
    });
    return out;
  }
  function labelOf(sel) {
    var o = sel.options[sel.selectedIndex];
    return o ? o.textContent.trim() : '';
  }
  function paint(sel) {
    var b = sel.__ssBtn; if (!b) return;
    var t = b.firstChild, txt = labelOf(sel);
    t.textContent = txt || '—'; t.classList.toggle('ph', !txt);
    b.disabled = sel.disabled;
  }
  function closePop(refocus) {
    var s = openS; if (!s) return; openS = null;
    s.cleanup(); s.pop.remove();
    s.btn.setAttribute('aria-expanded', 'false'); s.btn.removeAttribute('aria-activedescendant');
    if (refocus) try { s.btn.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }
  function choose(s, o) {
    if (!o || o.disabled) return;
    var changed = s.sel.value !== o.value;
    setNative(s.sel, o.value); paint(s.sel);
    closePop(true);
    if (changed) { s.sel.dispatchEvent(new Event('input', { bubbles: true })); s.sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function setNative(sel, v) { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v); }
  function setAct(s, i, scroll) {
    if (s.act >= 0 && s.items[s.act]) s.items[s.act].el.classList.remove('act');
    s.act = i;
    var it = s.items[i]; if (!it) return;
    it.el.classList.add('act'); s.btn.setAttribute('aria-activedescendant', it.el.id);
    if (scroll) { var p = s.pop, t = it.el.offsetTop, b = t + it.el.offsetHeight; if (t < p.scrollTop + 4) p.scrollTop = Math.max(0, t - 4); else if (b > p.scrollTop + p.clientHeight - 4) p.scrollTop = b - p.clientHeight + 4; }
  }
  function step(s, from, dir) {
    var n = s.items.length;
    for (var k = 1; k <= n; k++) { var i = (from + dir * k + n * 2) % n; if (!s.items[i].o.disabled) return i; }
    return from;
  }
  function place(s) {
    var r = s.btn.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth, p = s.pop;
    p.style.maxHeight = ''; p.style.minWidth = r.width + 'px';
    var h = Math.min(p.scrollHeight, 340), below = vh - r.bottom - 12, above = r.top - 12;
    var up = below < Math.min(h, 220) && above > below;
    var mh = Math.max(120, Math.min(340, up ? above : below));
    p.style.maxHeight = mh + 'px';
    var ph = Math.min(p.scrollHeight, mh), left = Math.min(Math.max(8, r.left), Math.max(8, vw - p.offsetWidth - 8));
    p.style.left = left + 'px'; p.style.top = (up ? r.top - ph - 6 : r.bottom + 6) + 'px';
    p.classList.toggle('up', up);
  }
  function openPop(sel) {
    if (openS) { var same = openS.sel === sel; closePop(false); if (same) return; }
    var btn = sel.__ssBtn; if (!btn || btn.disabled) return;
    var pop = document.createElement('div'); pop.className = 'ss-pop'; pop.setAttribute('role', 'listbox');
    var uid = 'ss' + Math.random().toString(36).slice(2, 8), items = [], cur = -1;
    optsOf(sel).forEach(function (x) {
      if (x.group != null) { var g = document.createElement('div'); g.className = 'ss-g'; g.textContent = x.group; g.setAttribute('role', 'presentation'); pop.appendChild(g); return; }
      var el = document.createElement('div'); el.className = 'ss-o'; el.setAttribute('role', 'option'); el.id = uid + '-' + items.length;
      el.setAttribute('aria-selected', x.o.selected ? 'true' : 'false'); if (x.o.disabled) el.setAttribute('aria-disabled', 'true');
      var tx = document.createElement('span'); tx.className = 'ss-x'; tx.textContent = x.o.textContent.trim() || '—'; el.appendChild(tx);
      if (x.o.selected) cur = items.length;
      items.push({ o: x.o, el: el }); pop.appendChild(el);
    });
    document.body.appendChild(pop);
    var s = { sel: sel, btn: btn, pop: pop, items: items, act: -1, typed: '', tt: 0 };
    var onDown = function (e) { if (!pop.contains(e.target) && !btn.contains(e.target)) closePop(false); };
    var onScroll = function (e) { if (!pop.contains(e.target)) closePop(false); };
    var onResize = function () { closePop(false); };
    var chk = setInterval(function () { if (!btn.isConnected) closePop(false); }, 300);
    document.addEventListener('pointerdown', onDown, true); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onResize);
    s.cleanup = function () { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); clearInterval(chk); clearTimeout(s.tt); };
    pop.addEventListener('pointermove', function (e) { var el = e.target.closest && e.target.closest('.ss-o'); if (!el) return; for (var i = 0; i < items.length; i++) if (items[i].el === el && s.act !== i) { setAct(s, i, false); break; } });
    pop.addEventListener('click', function (e) { var el = e.target.closest && e.target.closest('.ss-o'); if (!el) return; for (var i = 0; i < items.length; i++) if (items[i].el === el) { choose(s, items[i].o); break; } });
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); }); // el foco se queda en el botón
    openS = s; btn.setAttribute('aria-expanded', 'true');
    place(s); setAct(s, cur >= 0 ? cur : step(s, -1, 1), true);
    requestAnimationFrame(function () { if (openS === s) pop.classList.add('in'); });
  }
  function onKey(e) {
    var btn = e.currentTarget, sel = btn.__ssSel, s = openS && openS.btn === btn ? openS : null, k = e.key;
    if (!s) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); openPop(sel); }
      return;
    }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(true); return; }
    if (k === 'Tab') { closePop(false); return; }
    if (k === 'ArrowDown') { e.preventDefault(); setAct(s, step(s, s.act, 1), true); }
    else if (k === 'ArrowUp') { e.preventDefault(); setAct(s, step(s, s.act, -1), true); }
    else if (k === 'Home') { e.preventDefault(); setAct(s, step(s, -1, 1), true); }
    else if (k === 'End') { e.preventDefault(); setAct(s, step(s, s.items.length, -1), true); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (s.act >= 0) choose(s, s.items[s.act].o); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      s.typed += k.toLowerCase(); clearTimeout(s.tt); s.tt = setTimeout(function () { s.typed = ''; }, 700);
      for (var j = 0; j < s.items.length; j++) { var i = (s.act + 1 + j) % s.items.length; if (!s.items[i].o.disabled && s.items[i].o.textContent.trim().toLowerCase().indexOf(s.typed) === 0) { setAct(s, i, true); break; } }
    }
  }
  function enhance(sel) {
    if (sel.__ssBtn || sel.multiple || sel.size > 1 || sel.dataset.native != null) return;
    var wrap = document.createElement('span'); wrap.className = 'ss';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ss-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(document.createElement('span')).className = 'ss-t';
    var lab = sel.getAttribute('aria-label'); if (lab) btn.setAttribute('aria-label', lab);
    wrap.appendChild(btn); sel.classList.add('ss-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel.insertAdjacentElement('afterend', wrap);
    sel.__ssBtn = btn; btn.__ssSel = sel;
    // código que asigna .value o .selectedIndex a mano: que el texto del botón siga al valor
    var vd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(sel, 'value', { configurable: true, get: function () { return vd.get.call(sel); }, set: function (v) { vd.set.call(sel, v); paint(sel); } });
    btn.addEventListener('click', function () { openPop(sel); });
    btn.addEventListener('keydown', onKey);
    sel.addEventListener('change', function () { paint(sel); });
    sel.addEventListener('focus', function () { btn.focus(); });
    new MutationObserver(function () { paint(sel); }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label'] });
    paint(sel);
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'SELECT') enhance(root);
    else if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('select'), enhance);
  }
  window.FocoSelect = { enhance: enhance, scan: scan };
  function start() {
    scan(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
