(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var items = [];

  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function en() { return window.daziLang && window.daziLang() === 'en'; }

  function card(it) {
    var a = el('a', 'pcard');
    a.href = '/u/' + encodeURIComponent(it.handle);
    var top = el('div', 'top');
    var av = el('div', 'av');
    av.style.setProperty('--h', String(hue(it.handle)));
    if (/^https:\/\//.test(it.avatar)) {
      var img = document.createElement('img'); img.src = it.avatar; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.loading = 'lazy';
      av.appendChild(img);
    } else {
      av.appendChild(document.createTextNode(it.avatar || (it.nickname || it.handle).slice(0, 1).toUpperCase()));
    }
    av.appendChild(el('span', 'dot' + (it.online ? '' : ' off')));
    var who = el('div');
    who.appendChild(el('b', '', it.nickname || it.handle));
    var meta = [];
    if (it.city) meta.push(it.city);
    meta.push(it.online ? (en() ? 'online' : '在线') : (en() ? 'offline' : '离线'));
    who.appendChild(el('small', '', meta.join(' · ')));
    top.appendChild(av); top.appendChild(who); a.appendChild(top);
    if (it.tagline) a.appendChild(el('div', 'tl', it.tagline));
    if (it.tags && it.tags.length) {
      var tg = el('div', 'tags');
      it.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
      a.appendChild(tg);
    }
    return a;
  }

  function render() {
    var list = $('list');
    list.textContent = '';
    items.forEach(function (it) { list.appendChild(card(it)); });
    list.hidden = !items.length;
    $('empty').hidden = !!items.length;
  }

  fetch('/api/explore', { headers: { accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) { items = (j && j.items) || []; $('loading').hidden = true; render(); })
    .catch(function () { $('loading').hidden = true; $('error').hidden = false; });

  document.addEventListener('dazi:lang', function () { if (items.length) render(); });
})();
