(function () {
  window.SJ = {
    toast: function (msg) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.classList.remove('show'); }, 2200);
    },
    participate: function (id) {
      if (!id) return;
      var key = 'sj_part_' + id;
      if (localStorage.getItem(key)) return; // counted once per browser
      localStorage.setItem(key, '1');
      fetch('/m/' + id + '/participate', { method: 'POST', headers: { 'x-requested-with': 'fetch' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            var el = document.querySelector('.read-count');
            if (el) el.textContent = j.readCount;
            SJ.toast('جزاك الله خيرًا — احتُسبت مشاركتك 🤍');
          }
        })
        .catch(function () {});
    },
  };

  // ===== Tabs =====
  function initTabs() {
    var btns = document.querySelectorAll('.tab-btn');
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var tab = b.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var panel = document.querySelector('.tab-panel[data-panel="' + tab + '"]');
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ===== Share =====
  function initShare() {
    var d = window.SJ_DECEASED;
    var wa = document.getElementById('shareWhatsapp');
    var copy = document.getElementById('copyLink');
    var url = location.href.split('#')[0];
    if (wa && d) {
      wa.addEventListener('click', function () {
        var text = 'ادعُ لـ ' + d.name + ' 🤍\nاقرأ له القرآن وادعُ له من هنا:\n' + url;
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      });
    }
    if (copy) {
      copy.addEventListener('click', function () {
        function done() { SJ.toast('تم نسخ الرابط ✅'); }
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(fallback);
        else fallback();
        function fallback() {
          var i = document.createElement('input');
          i.value = url; document.body.appendChild(i); i.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(i);
        }
      });
    }
  }

  // ===== Submit dua without reload =====
  function initDuaForm() {
    var form = document.getElementById('duaForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = form.querySelector('[name=text]').value.trim();
      if (!text) return;
      var fd = new URLSearchParams();
      fd.append('name', form.querySelector('[name=name]').value);
      fd.append('text', text);
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-requested-with': 'fetch' },
        body: fd.toString(),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) { SJ.toast('تعذّر إضافة الدعاء'); return; }
          var list = document.getElementById('duaList');
          var empty = list.querySelector('.dua-empty');
          if (empty) empty.remove();
          var div = document.createElement('div');
          div.className = 'dua-item';
          div.innerHTML = '<div class="who">' + escapeHtml(j.dua.name) +
            ' <span class="when">· الآن</span></div><div class="txt">' + escapeHtml(j.dua.text) + '</div>' +
            '<div class="dua-foot"><button class="like-btn" data-id="' + j.dua.id + '" type="button" aria-label="أعجبني">' +
            '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' +
            ' <span class="like-count">0</span></button></div>';
          list.insertBefore(div, list.firstChild);
          form.reset();
          var pc = document.querySelector('.pray-count');
          if (pc && typeof j.prayCount === 'number') pc.textContent = j.prayCount;
          SJ.toast('تقبّل الله دعاءك 🤲');
        })
        .catch(function () { SJ.toast('حدث خطأ، حاول مرة أخرى'); });
    });
  }

  // ===== Deceased search (instant) =====
  function initSearch() {
    var input = document.getElementById('searchInput');
    var grid = document.getElementById('peopleGrid');
    var none = document.getElementById('noResults');
    if (!input || !grid) return;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      var cards = grid.querySelectorAll('.person-card');
      var shown = 0;
      cards.forEach(function (c) {
        var name = c.getAttribute('data-name') || '';
        var match = q === '' || name.indexOf(q) > -1;
        c.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (none) none.style.display = (shown === 0) ? '' : 'none';
    });
  }

  // ===== Dua likes (toggleable) =====
  function paintLiked(btn, liked) {
    btn.classList.toggle('liked', liked); // heart color is controlled by CSS via .liked
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  }

  function markExistingLikes() {
    document.querySelectorAll('.like-btn').forEach(function (btn) {
      var liked = !!localStorage.getItem('sj_liked_' + btn.getAttribute('data-id'));
      if (liked) paintLiked(btn, true);
    });
  }

  function initLikes() {
    markExistingLikes();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.like-btn') : null;
      if (!btn || btn._busy) return;
      var id = btn.getAttribute('data-id');
      var key = 'sj_liked_' + id;
      var liked = !!localStorage.getItem(key);
      var countEl = btn.querySelector('.like-count');
      var cur = parseInt(countEl ? countEl.textContent : '0', 10) || 0;

      // optimistic toggle
      var next = !liked;
      if (next) { localStorage.setItem(key, '1'); cur += 1; }
      else { localStorage.removeItem(key); cur = Math.max(0, cur - 1); }
      if (countEl) countEl.textContent = cur;
      paintLiked(btn, next);
      // pulse animation
      btn.classList.remove('pop'); void btn.offsetWidth; if (next) btn.classList.add('pop');
      if (navigator.vibrate) navigator.vibrate(10);

      btn._busy = true;
      fetch('/dua/' + id + (next ? '/like' : '/unlike'), { method: 'POST', headers: { 'x-requested-with': 'fetch' } })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok && countEl) countEl.textContent = j.likes; })
        .catch(function () {})
        .then(function () { btn._busy = false; });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initShare();
    initDuaForm();
    initSearch();
    initLikes();
  });
})();
