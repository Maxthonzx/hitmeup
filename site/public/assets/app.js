(function () {
  'use strict';

  // ---------- i18n: Chinese is the source of truth (captured from DOM), EN overrides here ----------
  var EN = {
    nav_features: 'Features', nav_install: 'Install', nav_explore: "Who's online",
    pill: 'Open source · runs on your own computer', dev: '🚧 In development · try it and tell us',
    h1a: 'Your AI wingman', h1b: 'breaks the ice, books the meetup',
    lead: 'Fill in a relaxed icebreaker card and let your wingman do the rest. People only see the times you are free and can pick one to meet you; their AI can talk to yours directly. Hit "Accept" and it lands in your calendar.',
    cta_start: 'Get started', cta_star: 'GitHub · Star it ⭐',
    hint: 'Free · MIT open source · your data stays on your own computer',
    f_title: 'What it does', f_sub: 'Starting with making friends: light, low-pressure, low barrier — that Tinder / Her kind of ease.',
    f1h: 'Icebreaker card', f1p: 'Hobbies, what you are into lately, who you want to meet, what you can offer, favorite meeting spots… all optional. Your contact info is shared only after you accept a meetup.',
    f2h: 'Book a meetup', f2p: 'Nobody sees your schedule, only the times you are free. They can pick a slot right on the web page; once you hit "Accept", it is written into your calendar.',
    f3h: 'Wingmen talk to each other', f3p: 'Do they have a wingman or an AI too? Over the A2A protocol the two sides negotiate time and place on their own. You just give the final nod.',
    s_title: '3 steps to start', s_sub: 'No tech skills needed — just hand a paragraph to your AI.',
    s1h: 'Copy the prompt', s1p: 'Copy the install prompt below in one click.',
    s2h: 'Send it to your AI', s2p: 'Paste it into Claude Code / Codex / Cursor or any AI that can run commands. It installs everything, asks a few questions and fills your card.',
    s3h: 'Share your link', s3p: 'Get <code class="i">hitmeup-agent.pages.dev/u/your-name</code> and send it to people you want to meet.',
    p_title: 'Copy this to your AI', p_sub: 'One click to copy, then paste it to any AI agent that can run commands. It will install it for you.',
    p_bar: 'Install prompt (Chinese; your AI will reply in your language)', copy: 'Copy prompt', copied: 'Copied ✓', copy_fail: 'Press Ctrl/Cmd+C',
    tab_other: 'Other AI',
    tab_cc: '<li>Open a terminal and go to the folder where you want the project (e.g. <code class="i">~/projects</code>).</li><li>Run <code class="i">claude</code> to start Claude Code.</li><li>Paste the prompt above and press Enter. Glance at any command that asks for approval before allowing it.</li>',
    tab_cx: '<li>Open a terminal in the folder you want to use.</li><li>Run <code class="i">codex</code> to start Codex CLI (or open the Codex desktop app and pick a working folder).</li><li>Paste the prompt, press Enter, and approve commands as prompted.</li>',
    tab_cu: '<li>Open an empty folder in Cursor (File → Open Folder).</li><li>Open the Agent / Composer panel (<code class="i">Ctrl/Cmd + I</code>) and pick an Agent mode that can run terminal commands.</li><li>Paste and send the prompt; allow it to run commands in the terminal.</li>',
    tab_ot: '<li>Any AI that can run commands on your computer works (Windsurf, Cline, Gemini CLI, …).</li><li>Have it work in an empty folder, then paste the prompt.</li><li>If your AI cannot run commands, use "Manual install" below.</li>',
    m_title: 'Manual install', m_sub: 'Requires Node.js 20+ and cloudflared.', m_cf: 'Install cloudflared: ',
    cmd_h: 'Handy commands', cmd1: 'check your setup', cmd2: 'have your wingman invite someone', cmd3: 'go offline and remove your public link',
    adm_h: 'Admin dashboard', adm_p: 'Only reachable on your own computer. Edit your card and handle meetup requests.',
    c_title: 'Connect your calendar', c_sub: 'Optional. Once connected, your wingman knows when you are free and can write meetups in.',
    c_g_tag: 'read + one-click add', c_a_tag: 'read + write', c_o_tag: 'ICS read-only', c_f_tag: 'optional',
    c_g: '<li>Open Google Calendar on the web and click "Settings" (top right).</li><li>Pick the calendar on the left → "Integrate calendar".</li><li>Copy the "<b>Secret address in iCal format</b>" and give it to your wingman (paste it into <code class="i">npm run setup</code>).</li><li>When a meetup is accepted you get a one-click "Add to Google Calendar" link.</li>',
    c_a: '<li>Open <code class="i">appleid.apple.com</code> and sign in.</li><li>Go to "Sign-In and Security" → "App-Specific Passwords".</li><li>Generate a new one (name it Hit Me Up) and hand it over when prompted. <b>Never use your Apple ID password.</b></li>',
    c_o: '<li>Outlook on the web: Settings → Calendar → Shared calendars → Publish a calendar.</li><li>Choose "Can view all details" and copy the ICS link for your wingman.</li>',
    c_f: 'Feishu / Lark (for work)', c_f_p: 'If you use Feishu calendar at work, your wingman can connect to it too. Follow the setup prompts — skipping it changes nothing else.',
    pr_title: 'Privacy: your data, your call', pr_sub: 'Your wingman runs on your own computer. It is not an account on someone else\'s platform.',
    pr1h: 'Data stays local', pr1p: 'Your card and meetup records live in the data/ folder on your computer and are never uploaded.',
    pr2h: 'Schedule never leaves', pr2p: 'People only see "which times are free", never what is on your calendar.',
    pr3h: 'Contact shared later', pr3p: 'WeChat / phone / email is sent only after you click "Accept".',
    pr4h: 'Off = offline', pr4p: 'Shut down your computer and your wingman goes offline; visitors see "not online right now". The directory only stores your current tunnel address (plus the card summary you chose to list), never your schedule.',
    pr_how: 'How it works: while your computer is on and online, Hit Me Up serves your card through a Cloudflare quick tunnel (cloudflared). This site\'s directory points the stable link <code class="i">https://hitmeup-agent.pages.dev/u/&lt;handle&gt;</code> at your current tunnel address.',
    q_title: 'FAQ',
    q1: 'What if my computer is off?', q1a: 'Your wingman goes offline and visitors see "their wingman is not online right now". It comes back when you turn the computer on and run npm start.',
    q2: 'Can others see my schedule?', q2a: 'No. They only see the free time slots, never the details. Your calendar data never leaves your computer.',
    q3: 'Does it cost anything?', q3a: 'No. Hit Me Up is MIT-licensed open source and the directory service is free (it runs on Cloudflare\'s free tier).',
    q4: "Can someone without a wingman book me?", q4a: 'Yes. They just open your share link and pick one of your free slots on the web page. Nothing to install.',
    q5: 'Where is my data?', q5a: 'In the project folder on your computer (the data/ directory, ignored by .gitignore). This site only keeps one record, "your handle → current tunnel address", plus the card summary you chose to list.',
    q6: 'How do I take it down?', q6a: 'Run <code class="i">npm run unpublish</code>. Your public link and directory record are deleted.',
    // explore page
    ex_title: "Who's online", ex_sub: 'Cards from people who chose to be listed. Tap one to say hi.',
    ex_loading: 'Loading…', ex_empty_h: 'Nobody is listed yet', ex_empty_p: 'Be the first! Install Hit Me Up and turn on "list me in the directory".',
    ex_err: 'Could not load the list. Try again later.', ex_online: 'online', ex_offline: 'offline', ex_cta: 'Get my own wingman'
  };

  var lang = 'zh';
  try { lang = localStorage.getItem('hitmeup-lang') || (/^zh/i.test(navigator.language) ? 'zh' : 'en'); } catch (e) {}

  var nodes = [].slice.call(document.querySelectorAll('[data-i18n]'));
  nodes.forEach(function (n) { n._zh = n.innerHTML; });
  var zhTitle = document.title;

  function t(key) { return lang === 'en' && EN[key] != null ? EN[key] : (nodes.filter(function (n) { return n.dataset.i18n === key; })[0] || {})._zh; }
  window.hmuT = function (key) { return lang === 'en' && EN[key] != null ? EN[key] : null; };
  window.hmuLang = function () { return lang; };

  function apply() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    nodes.forEach(function (n) {
      var k = n.dataset.i18n;
      n.innerHTML = lang === 'en' && EN[k] != null ? EN[k] : n._zh;
    });
    var btn = document.getElementById('lang');
    if (btn) btn.textContent = lang === 'en' ? '中文' : 'EN';
    if (lang === 'en') document.title = document.body.dataset.titleEn || '约我 Hit Me Up — Your AI wingman that breaks the ice and books the meetup';
    else document.title = zhTitle;
    document.dispatchEvent(new CustomEvent('hitmeup:lang', { detail: lang }));
  }

  var langBtn = document.getElementById('lang');
  if (langBtn) langBtn.addEventListener('click', function () {
    lang = lang === 'en' ? 'zh' : 'en';
    try { localStorage.setItem('hitmeup-lang', lang); } catch (e) {}
    apply();
  });
  if (lang === 'en') apply(); else if (langBtn) langBtn.textContent = 'EN';

  // ---------- copy button ----------
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.className = 'sr-copy'; ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var src = document.querySelector(btn.dataset.copy);
      if (!src) return;
      copyText(src.textContent.trim()).then(function (ok) {
        var label = ok ? (EN_or('copied', '已复制 ✓', '已复制 ✓')) : (EN_or('copy_fail', '请按 Ctrl/Cmd+C 复制', '')) ;
        btn.textContent = label; btn.classList.toggle('done', ok);
        if (!ok) { var r = document.createRange(); r.selectNodeContents(src); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        setTimeout(function () { btn.classList.remove('done'); btn.innerHTML = btn._zh_label(); }, 2200);
      });
    });
    btn._zh_label = function () { return lang === 'en' ? EN.copy : (nodes.filter(function (n) { return n === btn; })[0] || {})._zh || '复制提示词'; };
  });
  function EN_or(key, zh) { return lang === 'en' ? EN[key] : zh; }

  // ---------- tabs ----------
  var tabs = [].slice.call(document.querySelectorAll('.tab'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x === tab ? 'true' : 'false'); });
      [].forEach.call(document.querySelectorAll('.panel'), function (p) { p.classList.toggle('on', p.id === 'tab-' + tab.dataset.tab); });
    });
  });
})();
