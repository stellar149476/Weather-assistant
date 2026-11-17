/* ==========================================================
   主题控制 · 深色 / 浅色切换 + 霓虹交互微动效
   ========================================================== */
(function () {
  "use strict";

  var KEY = "wf.theme.v1";
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function apply(t) {
    root.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#EDF3FB" : "#05070f");
    var btn = document.getElementById("themeBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
      btn.setAttribute("title", t === "light" ? "切换到深色模式" : "切换到浅色模式");
      btn.setAttribute("aria-label", t === "light" ? "切换到深色模式" : "切换到浅色模式");
    }
  }

  /* 初始主题：用户选择 > 系统偏好 > 深色 */
  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  apply(read() || (prefersLight ? "light" : "dark"));

  var SUN = '<svg class="tb-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>';
  var MOON = '<svg class="tb-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9z"/></svg>';

  function mountBtn() {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    btn.innerHTML = SUN + MOON;
    apply(root.getAttribute("data-theme") || "dark");
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      save(next);
      btn.classList.remove("pulse");
      void btn.offsetWidth;
      btn.classList.add("pulse");
    });
  }

  /* 卡片入场错峰 */
  function stagger() {
    var list = document.querySelectorAll(".page > .card");
    for (var i = 0; i < list.length; i++) list[i].style.setProperty("--i", i);
  }

  /* 点击时的霓虹闪动 */
  var SEL = ".card, .stat, .act, .ix, .metric, .slot, .seg, .h-city, .hot-chip, .gear, .cmp-card, .drow";
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest(SEL) : null;
    if (!el) return;
    el.classList.remove("zap");
    void el.offsetWidth;
    el.classList.add("zap");
    window.setTimeout(function () { el.classList.remove("zap"); }, 620);
  }, true);

  /* 鼠标跟随的卡片光斑（桌面端） */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest ? e.target.closest(".card, .stat, .act, .ix") : null;
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  function boot() { mountBtn(); stagger(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
