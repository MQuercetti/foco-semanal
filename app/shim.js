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
    return { id: id, kind: d.kind || 'openai', key: key, url: url, model: model, pdf: !!d.pdf, mct: !!d.mct };
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
  async function listModels(c) {
    var P = pick(c, true);
    if (!P) throw { code: 'bad_key', message: 'Falta la clave o la dirección.' };
    var url, headers = {};
    if (P.kind === 'anthropic') { url = P.url + '/models?limit=100'; headers = { 'x-api-key': P.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }; }
    else if (P.kind === 'gemini') { url = P.url + '/models?pageSize=200'; headers = { 'x-goog-api-key': P.key }; }
    else { url = P.url + '/models'; if (P.key) headers = { authorization: 'Bearer ' + P.key }; }
    var res;
    try { res = await fetch(url, { headers: headers }); } catch (e) { throw { code: 'network', message: String(e) }; }
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
      res = await fetch(url, { method: 'POST', signal: opts.signal, headers: headers, body: JSON.stringify(body) });
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
        $f('#fxHint').textContent = prov === 'ollama' ? 'Ollama corre en tu compu y no cobra. Tiene que estar abierto y permitir este origen (OLLAMA_ORIGINS).' : prov === 'custom' ? 'Sirve cualquier servicio con la API de chat de OpenAI (LM Studio, Together, Fireworks, un proxy propio…). Poné la URL base y el modelo.' : 'Las consultas se cobran según uso al proveedor. Podés dejar cargadas varias claves y cambiar de proveedor cuando quieras. Si el modelo ya no existe, escribí el nombre del vigente.';
        $f('#fxAiMsg').textContent = '';
      }
      show();
      $f('#fxProv').addEventListener('change', function () { stash(); prov = $f('#fxProv').value; show(); });
      el.querySelector('#fxClose').addEventListener('click', function () { el.remove(); });
      el.addEventListener('click', function (ev) { if (ev.target === el) el.remove(); });
      function finalCfg() { stash(); draft.active = prov; return JSON.parse(JSON.stringify(draft)); }
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
