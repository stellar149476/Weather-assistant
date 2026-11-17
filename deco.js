/* ==========================================================
   背景动效 · 双模渲染
   · ultra：独显 / 高性能设备 —— 双层 Canvas（星网 + 前景尘埃/彗星/扫描带），60fps，DPR 2
   · lite ：核显 / 移动设备 —— 单画布 + 限帧 + 自动降级 + CSS 光尘
   · 自动探测 GPU 选档；运行中持续掉帧会自动降级到 lite
   · 手动开关：?fx=ultra | ?fx=low | ?fx=off
   ========================================================== */
(function () {
  var deco = document.getElementById("bgDeco");
  if (!deco) return;

  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var conn = navigator.connection || {};
  var fxParam = (location.search.match(/[?&]fx=(off|low|full|ultra|lite|on)/) || [])[1] || "";
  /* 不直接 return：特效先关掉，但按钮仍然要能点（用户显式点击可覆盖） */
  var disabled = !!(reduce || conn.saveData || fxParam === "off");

  /* 用户手动选择的渲染方式：auto / ultra / lite（持久化 + 内存兜底） */
  var PREF_KEY = "wf.fx.mode.v1";
  var memPref = "auto";      /* 预览沙箱里 localStorage 可能抛错，用内存兜底保证点了有效 */
  function readPref() {
    try {
      var v = localStorage.getItem(PREF_KEY);
      if (v === "auto" || v === "ultra" || v === "lite") { memPref = v; return v; }
    } catch (e) {}
    return memPref;
  }
  function savePref(v) {
    memPref = (v === "ultra" || v === "lite") ? v : "auto";
    try { localStorage.setItem(PREF_KEY, memPref); } catch (e) {}
  }

  /* 提示：优先复用页面里的 #toast；万一业务脚本没加载，则自建一个，保证点了有反馈 */
  function notify(msg) {
    var el = document.getElementById("toast");
    if (el) {
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(notify._t);
      notify._t = setTimeout(function () { el.classList.remove("show"); }, 3400);
      return;
    }
    var d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText =
      "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;" +
      "padding:11px 20px;border-radius:12px;font:800 12.5px/1.45 system-ui,-apple-system,sans-serif;" +
      "color:#04101c;background:linear-gradient(115deg,#2BF3FF,#7FC6FF 55%,#C6A6FF);" +
      "box-shadow:0 14px 34px rgba(0,0,0,.45);pointer-events:none";
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  }

  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var narrow = window.innerWidth < 640;
  var COLORS = ["#2BF3FF", "#FF2E88", "#A56BFF", "#C6FF3D", "#5B8DFF"];
  var RGB = [[43, 243, 255], [255, 46, 136], [165, 107, 255], [198, 255, 61], [91, 141, 255]];
  var pick = function () { return COLORS[Math.floor(Math.random() * COLORS.length)]; };
  var isDark = function () {
    return docEl.getAttribute("data-theme") !== "light";
  };

  /* ==========================================================
     设备探测
     ========================================================== */
  function gpuName() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return "";
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      var r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var v = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      return String(r || "") + " " + String(v || "");
    } catch (e) { return ""; }
  }

  function isMobile() {
    var ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(ua)) return true;
    /* iPadOS 13+ 伪装成桌面 UA，用触点数 + 小屏兜底 */
    if (navigator.maxTouchPoints > 1 && window.innerWidth < 900) return true;
    return false;
  }

  function decide() {
    if (fxParam === "ultra" || fxParam === "full" || fxParam === "on") return "ultra";
    if (fxParam === "low" || fxParam === "lite") return "lite";
    /* 用户手动指定优先于自动判断（包括移动端上手动开高性能） */
    var pref = readPref();
    if (pref === "ultra" || pref === "lite") return pref;
    if (isMobile()) return "lite";

    var g = gpuName();
    /* 软件渲染 / 移动 GPU / 老核显 / 核显版 Radeon：直接低档 */
    if (/swiftshader|llvmpipe|software|basic render|microsoft basic|mali|adreno|powervr|videocore/i.test(g)) return "lite";
    if (/intel.*(hd|uhd)\s*graphics|intel\(r\)\s*hd|iris\(tm\)\s*plus|radeon\(tm\)\s*graphics|radeon\s+(graphics|vega)/i.test(g)) return "lite";
    /* 独显 / 高性能统一内存 GPU */
    if (/nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx|pro|vii)|rx\s*\d{3,4}|apple\s*m\d|intel.*arc|tesla/i.test(g)) return "ultra";

    /* 读不到型号时按硬件规格估：8 核 + 8G 以上才给高档 */
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    return (cores >= 8 && mem >= 8 && window.innerWidth >= 1024) ? "ultra" : "lite";
  }

  var MODE = decide();
  var LABEL = { auto: "自动", ultra: "高性能", lite: "流畅" };
  docEl.setAttribute("data-fx", MODE);
  docEl.setAttribute("data-gpu", (gpuName() || "unknown").slice(0, 80));
  console.info("[fx] 渲染模式：" + MODE + " | GPU：" + (gpuName() || "未获取到") + "（可用 ?fx=ultra / ?fx=low / ?fx=off 覆盖，或用右上角按钮切换）");

  /* 按钮 + 菜单状态同步 */
  function paint() {
    var btn = document.getElementById("fxBtn");
    if (!btn) return;
    var pref = readPref();
    var actual = currentName || MODE;
    btn.setAttribute("data-mode", pref);
    var t = pref === "auto"
      ? "渲染方式：自动（当前 " + LABEL[actual] + "）· 点击选择"
      : "渲染方式：" + LABEL[pref] + " · 点击选择";
    btn.title = t;
    btn.setAttribute("aria-label", t);

    var menu = document.getElementById("fxMenu");
    if (menu) {
      var opts = menu.querySelectorAll("[data-fx-opt]");
      for (var i = 0; i < opts.length; i++) {
        var v = opts[i].getAttribute("data-fx-opt");
        var on = v === pref;
        opts[i].classList.toggle("active", on);
        opts[i].setAttribute("aria-checked", on ? "true" : "false");
        if (v === "auto") {
          var sub = opts[i].querySelector("i");
          if (sub) sub.textContent = "按设备选择 · 当前 " + LABEL[actual];
        }
      }
    }
  }

  /* ==========================================================
     公共：精灵图 / 光带
     ========================================================== */
  var SPRITES = RGB.map(function (c) {
    var cv = document.createElement("canvas");
    var S = 48;
    cv.width = S; cv.height = S;
    var g = cv.getContext("2d");
    var grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, "rgba(" + c.join(",") + ",1)");
    grd.addColorStop(0.3, "rgba(" + c.join(",") + ",.5)");
    grd.addColorStop(1, "rgba(" + c.join(",") + ",0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    return cv;
  });

  /* 浅色樱花主题用的柔光粒子（粉 / 玫红 / 樱蓝） */
  var RGB_S = [[255, 157, 180], [255, 120, 160], [135, 206, 235], [255, 183, 197], [214, 33, 122]];
  var SPRITES_S = RGB_S.map(function (c) {
    var cv = document.createElement("canvas");
    var S = 48;
    cv.width = S; cv.height = S;
    var g = cv.getContext("2d");
    var grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, "rgba(" + c.join(",") + ",.95)");
    grd.addColorStop(0.34, "rgba(" + c.join(",") + ",.42)");
    grd.addColorStop(1, "rgba(" + c.join(",") + ",0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    return cv;
  });
  function spriteSet() { return isDark() ? SPRITES : SPRITES_S; }

  /* 竖向数据流光（两种模式共用，transform 动画） */
  var streakN = MODE === "ultra" ? (narrow ? 4 : 7) : (narrow ? 3 : 4);
  if (!disabled) {
    for (var j = 0; j < streakN; j++) {
      var s = document.createElement("span");
      s.className = "data-streak";
      s.style.cssText =
        "left:" + rnd(4, 94) + "%;top:-20vh;color:" + pick() + ";" +
        "height:" + rnd(70, 150) + "px;opacity:" + rnd(.14, .34) + ";" +
        "animation-duration:" + rnd(9, 16) + "s;animation-delay:" + rnd(-14, 0) + "s";
      deco.appendChild(s);
    }
  }

  var W = 0, H = 0, DPR = 1;
  var pointer = { x: -9999, y: -9999, active: false };

  window.addEventListener("pointermove", function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  document.addEventListener("mouseleave", function () { pointer.active = false; });

  /* ==========================================================
     渲染器 A · ultra（独显）
     ========================================================== */
  function Ultra() {
    var canvas = document.createElement("canvas");
    canvas.id = "fx";
    canvas.setAttribute("aria-hidden", "true");
    deco.insertBefore(canvas, deco.firstChild);
    var ctx = canvas.getContext("2d", { alpha: true });

    var front = document.createElement("canvas");
    front.id = "fxFront";
    front.setAttribute("aria-hidden", "true");
    document.body.appendChild(front);
    var fctx = front.getContext("2d", { alpha: true });

    var P = [], rings = [], dust = [], comets = [];
    var raf = 0, running = false, lastRing = 0, scanY = -320, lastComet = 0;
    var f0 = 0, frames = 0, badRun = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      /* 高分屏保留细节，超大屏略降以免显存吃紧 */
      var cap = (W * H) > 2600000 ? 1.5 : 2;
      DPR = Math.min(window.devicePixelRatio || 1, cap);
      [canvas, front].forEach(function (cv) {
        cv.width = Math.round(W * DPR);
        cv.height = Math.round(H * DPR);
        cv.style.width = W + "px";
        cv.style.height = H + "px";
      });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function build() {
      var n = Math.round(Math.min(130, Math.max(42, (W * H) / 12000)));
      P = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = rnd(0.10, 0.40);
        P.push({
          x: rnd(0, W), y: rnd(0, H),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rnd(0.9, 2.2),
          c: Math.floor(Math.random() * SPRITES.length),
          ph: Math.random() * Math.PI * 2,
          sp2: rnd(0.6, 1.4)
        });
      }
      var dn = Math.round(Math.min(30, Math.max(14, (W * H) / 60000)));
      dust = [];
      for (var d = 0; d < dn; d++) {
        dust.push({
          x: rnd(0, W), y: rnd(0, H),
          vx: rnd(-0.16, 0.16), vy: rnd(-0.24, -0.06),
          r: rnd(1.4, 3.6),
          c: Math.floor(Math.random() * SPRITES.length),
          ph: Math.random() * Math.PI * 2,
          sp2: rnd(0.4, 1.0)
        });
      }
      comets = []; rings = [];
    }

    function draw(now) {
      var dark = isDark();
      var SP = dark ? SPRITES : SPRITES_S;
      var CL = dark ? RGB : RGB_S;
      ctx.clearRect(0, 0, W, H);

      /* 冲击波（仅深色霓虹） */
      if (dark && now - lastRing > 5200 && rings.length < 3) {
        lastRing = now;
        rings.push({
          x: rnd(W * 0.12, W * 0.88), y: rnd(H * 0.18, H * 0.82),
          r: 0, max: rnd(200, 380),
          c: Math.random() > 0.5 ? 0 : 1
        });
      }
      for (var q = rings.length - 1; q >= 0; q--) {
        var rg = rings[q];
        rg.r += 2.6;
        var kk = 1 - rg.r / rg.max;
        if (kk <= 0) { rings.splice(q, 1); continue; }
        var rc = CL[rg.c];
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(" + rc[0] + "," + rc[1] + "," + rc[2] + "," + (kk * 0.17).toFixed(3) + ")";
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255," + (kk * 0.07).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* 运动 + 指针斥力 */
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (pointer.active) {
          var dx = p.x - pointer.x, dy = p.y - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            var f = (1 - d2 / 26000) * 0.06;
            var dd = Math.sqrt(d2);
            p.vx += (dx / dd) * f;
            p.vy += (dy / dd) * f;
          }
        }
        p.vx *= 0.992; p.vy *= 0.992;
        var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd < 0.06) {
          var na = Math.random() * Math.PI * 2;
          p.vx += Math.cos(na) * 0.05;
          p.vy += Math.sin(na) * 0.05;
        } else if (spd > 0.9) {
          p.vx *= 0.96; p.vy *= 0.96;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
        if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
      }

      /* 连线（仅深色霓虹；浅色樱花主题不画网，只留柔光点） */
      if (dark) {
        var LINK = 176, L2 = LINK * LINK;
        ctx.lineWidth = 1;
        for (var a1 = 0; a1 < P.length; a1++) {
          var pa = P[a1];
          for (var b1 = a1 + 1; b1 < P.length; b1++) {
            var pb = P[b1];
            var dx2 = pa.x - pb.x, dy2 = pa.y - pb.y;
            var dd2 = dx2 * dx2 + dy2 * dy2;
            if (dd2 > L2) continue;
            var al = Math.pow(1 - Math.sqrt(dd2) / LINK, 1.35) * 0.36;
            var c1 = CL[pa.c];
            ctx.strokeStyle = "rgba(" + c1[0] + "," + c1[1] + "," + c1[2] + "," + al.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
      }

      /* 粒子（双层光晕；浅色下更柔更淡） */
      for (var n2 = 0; n2 < P.length; n2++) {
        var pn = P[n2];
        var pulse = 0.75 + 0.25 * Math.sin(now * 0.0012 * pn.sp2 + pn.ph);
        var R = pn.r * (dark ? 9 : 12) * pulse;
        ctx.globalAlpha = dark ? 0.95 : 0.34;
        ctx.drawImage(SP[pn.c], pn.x - R / 2, pn.y - R / 2, R, R);
        var R2 = pn.r * (dark ? 2.6 : 3.2);
        ctx.globalAlpha = dark ? 0.9 : 0.4;
        ctx.drawImage(SP[pn.c], pn.x - R2 / 2, pn.y - R2 / 2, R2, R2);
      }
      ctx.globalAlpha = 1;
    }

    function drawFront(now) {
      fctx.clearRect(0, 0, W, H);

      /* 浅色樱花主题：只飘粉色光点（普通混合，浮在卡片之上） */
      if (!isDark()) {
        fctx.globalCompositeOperation = "source-over";
        for (var si = 0; si < dust.length; si++) {
          var pd2 = dust[si];
          pd2.x += pd2.vx * 0.8;
          pd2.y += pd2.vy * 0.8;
          if (pd2.y < -30) { pd2.y = H + 20; pd2.x = rnd(0, W); }
          if (pd2.x < -30) pd2.x = W + 20; else if (pd2.x > W + 30) pd2.x = -20;
          var sa = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(now * 0.0009 * pd2.sp2 + pd2.ph));
          var sR = pd2.r * 7;
          fctx.globalAlpha = sa;
          fctx.drawImage(SPRITES_S[pd2.c % SPRITES_S.length], pd2.x - sR / 2, pd2.y - sR / 2, sR, sR);
        }
        fctx.globalAlpha = 1;
        return;
      }

      /* 扫描光带 */
      scanY += 1.7;
      if (scanY > H + 320) scanY = -320;
      var sg = fctx.createLinearGradient(0, scanY - 150, 0, scanY);
      sg.addColorStop(0, "rgba(43,243,255,0)");
      sg.addColorStop(0.75, "rgba(43,243,255,.05)");
      sg.addColorStop(1, "rgba(165,107,255,.12)");
      fctx.fillStyle = sg;
      fctx.fillRect(0, scanY - 150, W, 150);

      /* 彗星 */
      if (now - lastComet > 6500 && comets.length < 2 && Math.random() < 0.06) {
        lastComet = now;
        var fromLeft = Math.random() > 0.5;
        var speed = rnd(7, 11);
        var ang = fromLeft ? rnd(-0.35, 0.35) : Math.PI + rnd(-0.35, 0.35);
        comets.push({
          x: fromLeft ? -60 : W + 60,
          y: rnd(H * 0.12, H * 0.88),
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          c: Math.floor(Math.random() * SPRITES.length),
          trail: []
        });
      }
      for (var ci = comets.length - 1; ci >= 0; ci--) {
        var cm = comets[ci];
        cm.x += cm.vx; cm.y += cm.vy;
        cm.trail.push([cm.x, cm.y]);
        if (cm.trail.length > 22) cm.trail.shift();
        if (cm.x < -140 || cm.x > W + 140 || cm.y < -140 || cm.y > H + 140) { comets.splice(ci, 1); continue; }
        for (var t = 0; t < cm.trail.length; t++) {
          var k = t / cm.trail.length;
          fctx.globalAlpha = k * 0.45;
          var rr = 1 + k * 9;
          fctx.drawImage(SPRITES[cm.c], cm.trail[t][0] - rr / 2, cm.trail[t][1] - rr / 2, rr, rr);
        }
        fctx.globalAlpha = 0.9;
        fctx.drawImage(SPRITES[cm.c], cm.x - 11, cm.y - 11, 22, 22);
      }

      fctx.globalCompositeOperation = "lighter";

      /* 指针与尘埃连线 + 光环 */
      if (pointer.active) {
        for (var pi = 0; pi < dust.length; pi++) {
          var pd = dust[pi];
          var pdx = pd.x - pointer.x, pdy = pd.y - pointer.y;
          var pdd = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdd < 210) {
            var pa2 = (1 - pdd / 210) * 0.55;
            fctx.strokeStyle = "rgba(43,243,255," + pa2.toFixed(3) + ")";
            fctx.lineWidth = 1;
            fctx.beginPath();
            fctx.moveTo(pd.x, pd.y);
            fctx.lineTo(pointer.x, pointer.y);
            fctx.stroke();
          }
        }
        var ringR = 16 + 4 * Math.sin(now * 0.003);
        fctx.beginPath();
        fctx.arc(pointer.x, pointer.y, ringR, 0, Math.PI * 2);
        fctx.strokeStyle = "rgba(255,46,136,.55)";
        fctx.lineWidth = 1.2;
        fctx.stroke();
        fctx.beginPath();
        fctx.arc(pointer.x, pointer.y, 2.2, 0, Math.PI * 2);
        fctx.fillStyle = "rgba(255,255,255,.85)";
        fctx.fill();
      }

      /* 悬浮尘埃 */
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i];
        p.x += p.vx; p.y += p.vy;
        if (p.y < -30) { p.y = H + 20; p.x = rnd(0, W); }
        if (p.x < -30) p.x = W + 20; else if (p.x > W + 30) p.x = -20;
        var a = 0.18 + 0.30 * (0.5 + 0.5 * Math.sin(now * 0.001 * p.sp2 + p.ph));
        var R = p.r * 6;
        fctx.globalAlpha = a;
        fctx.drawImage(SPRITES[p.c], p.x - R / 2, p.y - R / 2, R, R);
      }
      fctx.globalAlpha = 1;
      fctx.globalCompositeOperation = "source-over";
    }

    /* 运行中若持续达不到 45fps，自动切到 lite，避免把老机器拖死 */
    function guard(now) {
      frames++;
      if (!f0) { f0 = now; return; }
      var el = now - f0;
      if (el < 2600) return;
      var fps = frames / (el / 1000);
      frames = 0; f0 = now;
      if (fps < 45) badRun++; else badRun = 0;
      if (badRun >= 2) {
        console.warn("[fx] 独显模式实测 " + fps.toFixed(0) + "fps，自动降级为 lite");
        fallbackToLite();
      }
    }

    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      guard(now);
      if (!running) return;
      draw(now);
      drawFront(now);
    }

    function start() {
      if (running) return;
      running = true;
      canvas.classList.add("on");
      front.classList.add("on");
      lastRing = performance.now();
      f0 = 0; frames = 0; badRun = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.classList.remove("on");
      front.classList.remove("on");
    }
    function destroy() {
      stop();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (front.parentNode) front.parentNode.removeChild(front);
    }

    return { start: start, stop: stop, resize: resize, destroy: destroy };
  }

  /* ==========================================================
     渲染器 B · lite（核显 / 移动端）
     ========================================================== */
  function Lite() {
    /* CSS 光尘（合成层，几乎不耗 GPU） */
    var dustN = narrow ? 4 : 6;
    var nodes = [];
    for (var k = 0; k < dustN; k++) {
      var d = document.createElement("span");
      var size = rnd(1.6, 3.2);
      d.className = "fx-dust";
      d.style.cssText =
        "width:" + size + "px;height:" + size + "px;" +
        "left:" + rnd(3, 96) + "%;top:" + rnd(10, 90) + "%;" +
        "color:" + pick() + ";" +
        "animation-duration:" + rnd(14, 26) + "s;animation-delay:" + rnd(-20, 0) + "s";
      document.body.appendChild(d);
      nodes.push(d);
    }

    var canvas = document.createElement("canvas");
    canvas.id = "fx";
    canvas.setAttribute("aria-hidden", "true");
    deco.insertBefore(canvas, deco.firstChild);
    var ctx = canvas.getContext("2d", { alpha: true });

    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var tier = 2;
    if (cores <= 6 || mem <= 6 || narrow) tier = 1;
    if (cores <= 3 || mem <= 3) tier = 0;
    if (fxParam === "low") tier = 0;

    var QUALITY = {
      0: { n: 22, link: 0, fps: 24, rings: false },
      1: { n: 42, link: 150, fps: 30, rings: true },
      2: { n: 68, link: 172, fps: 30, rings: true }
    };
    var Q = QUALITY[tier];

    var P = [], rings = [], raf = 0, running = false;
    var lastRing = 0, lastDraw = 0, slowFrames = 0, degraded = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      var cap = (W * H) > 1800000 ? 1 : 1.5;
      DPR = Math.min(window.devicePixelRatio || 1, cap);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function build() {
      P = [];
      for (var i = 0; i < Q.n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = rnd(0.10, 0.38);
        P.push({
          x: rnd(0, W), y: rnd(0, H),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rnd(0.9, 2.1),
          c: Math.floor(Math.random() * SPRITES.length),
          ph: Math.random() * Math.PI * 2,
          sp2: rnd(0.6, 1.4)
        });
      }
      rings = [];
    }

    function degrade() {
      if (degraded >= 2) { stop(); return; }
      degraded++;
      Q = {
        n: Math.max(16, Math.round(Q.n * 0.55)),
        link: degraded >= 2 ? 0 : Math.round(Q.link * 0.85),
        fps: degraded >= 2 ? 20 : 24,
        rings: false
      };
      build();
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);

      if (Q.rings && now - lastRing > 6000 && rings.length < 2) {
        lastRing = now;
        rings.push({ x: rnd(W * 0.15, W * 0.85), y: rnd(H * 0.2, H * 0.8), r: 0, max: rnd(180, 300) });
      }
      for (var q = rings.length - 1; q >= 0; q--) {
        var rg = rings[q];
        rg.r += 2.2;
        var kk = 1 - rg.r / rg.max;
        if (kk <= 0) { rings.splice(q, 1); continue; }
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(43,243,255," + (kk * 0.14).toFixed(3) + ")";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (pointer.active) {
          var dx = p.x - pointer.x, dy = p.y - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 18000 && d2 > 1) {
            var f = (1 - d2 / 18000) * 0.05;
            var dd = Math.sqrt(d2);
            p.vx += (dx / dd) * f;
            p.vy += (dy / dd) * f;
          }
        }
        p.vx *= 0.992; p.vy *= 0.992;
        var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd < 0.06) {
          var na = Math.random() * Math.PI * 2;
          p.vx += Math.cos(na) * 0.05;
          p.vy += Math.sin(na) * 0.05;
        } else if (spd > 0.85) {
          p.vx *= 0.96; p.vy *= 0.96;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
        if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
      }

      if (Q.link > 0) {
        ctx.lineWidth = 1;
        var L2 = Q.link * Q.link;
        for (var a1 = 0; a1 < P.length; a1++) {
          var pa = P[a1];
          for (var b1 = a1 + 1; b1 < P.length; b1++) {
            var pb = P[b1];
            var dx2 = pa.x - pb.x, dy2 = pa.y - pb.y;
            var dd2 = dx2 * dx2 + dy2 * dy2;
            if (dd2 > L2) continue;
            var al = (1 - Math.sqrt(dd2) / Q.link) * 0.34;
            var c1 = RGB[pa.c];
            ctx.strokeStyle = "rgba(" + c1[0] + "," + c1[1] + "," + c1[2] + "," + al.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
      }

      for (var n2 = 0; n2 < P.length; n2++) {
        var pn = P[n2];
        var pulse = 0.75 + 0.25 * Math.sin(now * 0.0012 * pn.sp2 + pn.ph);
        var R = pn.r * 9 * pulse;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(SPRITES[pn.c], pn.x - R / 2, pn.y - R / 2, R, R);
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      var dt = now - lastDraw;
      if (dt < 1000 / Q.fps - 1.5) return;
      lastDraw = now;

      if (dt > 46) slowFrames++; else if (slowFrames > 0) slowFrames--;
      if (slowFrames > 24) {
        slowFrames = 0;
        degrade();
        if (!running) return;
      }
      draw(now);
    }

    function start() {
      if (running || !isDark()) return;
      running = true;
      canvas.classList.add("on");
      lastRing = performance.now();
      lastDraw = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.classList.remove("on");
    }
    function destroy() {
      stop();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    }

    return { start: start, stop: stop, resize: resize, destroy: destroy };
  }

  /* ==========================================================
     挂载 / 切换
     ========================================================== */
  var current = null, currentName = "";

  function mount(name) {
    if (current) { try { current.destroy(); } catch (e) {} }
    currentName = name;
    docEl.setAttribute("data-fx", name);
    current = name === "ultra" ? Ultra() : Lite();
    current.resize();
    current.start();
  }

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (current) current.resize(); }, 220);
  });

  document.addEventListener("visibilitychange", function () {
    if (!current) return;
    if (document.hidden) current.stop();
    else current.start();
  });

  new MutationObserver(function () {
    if (!current) return;
    current.stop();
    current.start();          /* 深色继续跑；浅色下 lite 会自行不启动 */
  }).observe(docEl, { attributes: true, attributeFilter: ["data-theme"] });

  /* 高性能实测掉帧 → 落到流畅并记住选择，避免下次又卡一遍 */
  function fallbackToLite() {
    savePref("lite");
    mount("lite");
    paint();
    notify("高性能实测掉帧，已切换为「流畅」渲染（右上角可改回）");
  }

  /* ==========================================================
     渲染方式菜单：自动 / 流畅 / 高性能
     ========================================================== */
  function mountSafely(name) {
    try {
      mount(name);
      return true;
    } catch (e) {
      console.error("[fx] 切换失败", e);
      notify("切换渲染方式失败：" + (e && e.message ? e.message : e));
      return false;
    }
  }

  var fxBtn = document.getElementById("fxBtn");
  var fxMenu = document.getElementById("fxMenu");

  function setMenu(open) {
    if (!fxMenu || !fxBtn) return;
    fxMenu.classList.toggle("open", !!open);
    fxBtn.setAttribute("aria-expanded", open ? "true" : "false");
    var bar = fxBtn.parentNode;
    while (bar && bar !== document.body && !(bar.classList && bar.classList.contains("hud-bar"))) {
      bar = bar.parentNode;
    }
    if (bar && bar.classList) bar.classList.toggle("fx-up", !!open);
  }

  function applyPref(pref) {
    if (pref !== "auto" && pref !== "ultra" && pref !== "lite") pref = "auto";
    /* 之前因系统「减少动效」等被禁用时，用户显式选择视为同意开启 */
    if (disabled) { disabled = false; }
    fxParam = "";
    savePref(pref);
    var name = pref === "auto" ? decide() : pref;
    console.info("[fx] 选择渲染方式：" + pref + "（实际渲染 " + name + "）");

    if (!mountSafely(name)) { paint(); return; }
    paint();

    if (fxBtn) {
      fxBtn.classList.remove("pulse");
      void fxBtn.offsetWidth;
      fxBtn.classList.add("pulse");
      setTimeout(function () { fxBtn.classList.remove("pulse"); }, 700);
    }

    var msg = pref === "auto"
      ? "渲染方式：自动（当前 " + LABEL[name] + "）"
      : "渲染方式：" + LABEL[pref] + (name === "ultra" ? "（双层粒子特效）" : "（省电流畅）");
    notify(msg);
  }

  if (fxBtn) {
    fxBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenu(!(fxMenu && fxMenu.classList.contains("open")));
    });
  }

  if (fxMenu) {
    fxMenu.addEventListener("click", function (e) {
      e.stopPropagation();          /* 点菜单内部不要触发"点外面关闭" */
      var b = e.target && e.target.closest ? e.target.closest("[data-fx-opt]") : null;
      if (!b) return;
      applyPref(b.getAttribute("data-fx-opt"));
      setMenu(false);
    });
  }

  document.addEventListener("click", function () { setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.keyCode === 27) setMenu(false);
  });

  if (disabled) {
    paint();
  } else {
    if (!mountSafely(MODE)) { /* 创建失败也不影响页面其它功能 */ }
    paint();
  }
})();
