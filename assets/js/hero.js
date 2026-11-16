/* The world scene: hero (glass name, plate parallax, stars, bands) + 01 Organizations.
   One pinned stage, one progress value, every write delta-gated. */
(function () {
  "use strict";
  var I = window.INIT; if (!I) return;
  var root = document.documentElement;
  var world = document.getElementById("world");
  if (!world) return;
  var frame = world.querySelector(".hero-frame");
  var stage = world.querySelector(".world-stage");
  var far = world.querySelector(".layer.far"), mid = world.querySelector(".layer.mid"),
      near = world.querySelector(".layer.near"), cut = world.querySelector(".layer.cut");
  var glass = world.querySelector(".glass");
  var nms = [].slice.call(glass.querySelectorAll(".nm"));
  var halfL = glass.querySelector(".half-l"), halfR = glass.querySelector(".half-r");
  var frosts = [].slice.call(glass.querySelectorAll(".frost"));
  var insides = [].slice.call(glass.querySelectorAll(".inside"));
  var surname = world.querySelector(".surname");
  var bands = [].slice.call(world.querySelectorAll(".band")).map(function (el) {
    return { el: el, a: +el.dataset.a, b: +el.dataset.b };
  });
  var orgs = world.querySelector(".orgs");
  var orgHead = orgs.querySelector(".orgs-head");
  var orgItems = [].slice.call(orgs.querySelectorAll(".org"));
  var linePath = orgs.querySelector(".ol-path");
  var toggle = world.querySelector(".mode-toggle");

  /* plate geometry, measured in the processed band (2560 x 1887) */
  var PA = 1887 / 2560, SPIRE_Y = .625, FOCAL = [.455, .235];
  /* name outline geometry, font units */
  var VB = { x: 86, y: 350, w: 6666, h: 1636 };
  var INSIDE_ASPECT = 1;          /* set when the inside portrait loads */

  /* hero vs organizations share of the pinned range: 420vh then 240vh */
  var HERO_SHARE = 420 / 660;

  var G = { W: 0, H: 0, nameTop: 0, nh: 0, s: 1, cx: 0, cy: 0, fx: 0, fy: 0, len: 0 };
  var stars = null, starsCanvas = world.querySelector("canvas.stars");
  var loadK = 0, loadStart = 0, loadReady = false, firstPaint = true;
  var lastCam = -1;

  /* text entrances */
  I.split(world.querySelector(".b2 .beat"), "halves", 11);
  I.split(world.querySelector(".b3 .beat"), "words", 23);
  I.split(world.querySelector(".b4 .beat"), "words", 37);

  /* ---------- the portrait toggle ---------- */
  var cutImg = cut.querySelector("img");
  function loadCut() { if (cutImg && !cutImg.getAttribute("src") && cutImg.dataset.src) cutImg.src = cutImg.dataset.src; }
  function syncToggle() {
    var stand = root.classList.contains("mode-stand");
    if (stand) loadCut();
    toggle.setAttribute("aria-pressed", stand ? "true" : "false");
  }
  if (toggle) {
    syncToggle();
    toggle.addEventListener("click", function () {
      var stand = !root.classList.contains("mode-stand");
      root.classList.toggle("mode-stand", stand);
      try { localStorage.setItem("portrait-mode", stand ? "stand" : "window"); } catch (e) {}
      syncToggle();
    });
  }

  /* ---------- layout: cover maths shared by every plate layer and the frost ---------- */
  function layout(W, H, scrub) {
    W = frame.clientWidth || W; H = frame.clientHeight || H;
    G.W = W; G.H = H;
    var sc = Math.max(W / 2560, H / 1887), pw = 2560 * sc, ph = 1887 * sc;
    var ox = (pw - W) / 2;
    var oy = I.clamp(SPIRE_Y * ph - .70 * H, 0, Math.max(0, ph - H));
    var opy = ph - H > 1 ? (oy / (ph - H)) * 100 : 50;
    stage.style.setProperty("--opy", opy.toFixed(2) + "%");
    G.fx = FOCAL[0] * pw - ox; G.fy = FOCAL[1] * ph - oy;
    stage.style.setProperty("--fx", G.fx.toFixed(1) + "px");
    stage.style.setProperty("--fy", G.fy.toFixed(1) + "px");

    /* the name spans the full width, inside a small safe gutter */
    var portrait = H > W;
    var gut = Math.max(12, Math.round(W * .018));
    var s = (W - 2 * gut) / VB.w;
    var maxH = (portrait ? .2 : .42) * H;
    if (VB.h * s > maxH) s = maxH / VB.h;
    var nh = VB.h * s;
    var nameTop = portrait ? Math.max(H * .15, 70) : H * .24;
    if (!portrait) {
      var copy = frame.querySelector(".b1-copy");
      var copyTop = copy ? copy.offsetTop : H;
      var surH = Math.max(18, Math.min(32, W * .021));
      var room = copyTop - nameTop - Math.max(10, H * .02) - surH - 16;
      if (room > 40 && VB.h * s > room) s = room / VB.h;
      if (room <= 40) { nameTop = Math.max(70, H * .14); room = copyTop - nameTop - surH - 26; if (VB.h * s > room && room > 40) s = room / VB.h; }
    }
    var x = (W - VB.w * s) / 2 - VB.x * s, y = nameTop - VB.y * s;
    G.s = s; G.nh = nh; G.nameTop = nameTop; G.cx = W / 2; G.cy = nameTop + nh / 2;

    glass.setAttribute("viewBox", "0 0 " + W.toFixed(0) + " " + H.toFixed(0));
    glass.setAttribute("preserveAspectRatio", "none");
    var t = "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") scale(" + s.toFixed(5) + ")";
    nms.forEach(function (p) { p.setAttribute("transform", t); });
    frosts.forEach(function (im) {
      im.setAttribute("x", (-ox).toFixed(1)); im.setAttribute("y", (-oy).toFixed(1));
      im.setAttribute("width", pw.toFixed(1)); im.setAttribute("height", ph.toFixed(1));
      im.setAttribute("preserveAspectRatio", "none");
    });
    var ih = nh * 1.42, iw = ih * INSIDE_ASPECT;
    insides.forEach(function (im) {
      im.setAttribute("x", (W / 2 - iw / 2).toFixed(1)); im.setAttribute("y", (nameTop - nh * .16).toFixed(1));
      im.setAttribute("width", iw.toFixed(1)); im.setAttribute("height", ih.toFixed(1));
    });
    surname.style.setProperty("--surname-top", (nameTop + nh + Math.max(10, H * .02)).toFixed(0) + "px");

    if (stars) stars.resize(W, H);
    lastCam = -1;

    /* constellation lines through the stars, in route order */
    if (scrub && linePath) {
      var pts = orgItems.map(function (li) {
        var cs = li.style;
        return [parseFloat(cs.getPropertyValue("--x")) / 100 * W, parseFloat(cs.getPropertyValue("--y")) / 100 * H + 12];
      });
      var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
      for (var i = 1; i < pts.length; i++) {
        var p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += " C" + [c1x, c1y, c2x, c2y, p2[0], p2[1]].map(function (v) { return v.toFixed(1); }).join(" ");
      }
      linePath.setAttribute("d", d);
      G.len = linePath.getTotalLength ? linePath.getTotalLength() : 3000;
      orgs.querySelector(".orgs-lines").setAttribute("viewBox", "0 0 " + W.toFixed(0) + " " + H.toFixed(0));
      I.setVar(linePath, "--len", G.len.toFixed(0), 0);
    }
    if (!scrub) staticFrame();
  }

  function halfTransform(rise, gs, dx) {
    return "translate(" + G.cx.toFixed(1) + " " + (G.cy + rise).toFixed(1) + ") scale(" + gs.toFixed(4) + ") translate(" + (-G.cx + dx).toFixed(1) + " " + (-G.cy).toFixed(1) + ")";
  }

  function staticFrame() {
    halfL.removeAttribute("transform"); halfR.removeAttribute("transform");
    halfL.__a = halfR.__a = null;
  }

  /* ---------- the film ---------- */
  function render(p, now) {
    var hp = I.clamp(p / HERO_SHARE, 0, 1);
    var op = I.clamp((p - HERO_SHARE) / (1 - HERO_SHARE), 0, 1);
    var W = G.W, H = G.H;

    /* band one opens settled: a one-time load ramp, then scroll holds it */
    var more = false;
    if (!loadReady) { more = true; }
    else if (loadK < 1) {
      if (!loadStart) loadStart = now;
      loadK = I.clamp((now - loadStart) / 1500, 0, 1);
      more = loadK < 1;
    }
    var lk = 1 - Math.pow(1 - loadK, 3);

    var z = I.ease(I.clamp((hp - .04) / .9, 0, 1));
    var zT = z + .18 * op;

    I.setStyle(far, "transform", "scale(" + (1 + .14 * zT).toFixed(4) + ")");
    I.setStyle(mid, "transform", "translate3d(0," + (.05 * H * z).toFixed(1) + "px,0) scale(" + (1 + .34 * z).toFixed(4) + ")");
    I.setStyle(mid, "opacity", (1 - I.smooth(.55, .8, hp)).toFixed(3));
    I.setStyle(near, "transform", "translate3d(0," + (.62 * H * z).toFixed(1) + "px,0) scale(" + (1 + .95 * z).toFixed(4) + ")");
    /* the stand-out portrait sinks with the ridge as the camera flies past, and is gone before band three */
    I.setStyle(cut, "transform", "translate3d(-50%," + (.85 * H * z).toFixed(1) + "px,0)");
    I.setVar(cut, "--cut-p", lk * (1 - I.smooth(.3, .5, hp)));

    /* the glass name: rises from behind the ridge on load, swells, then parts for the camera */
    var rise = (1 - lk) * G.nh * .62;
    var gs = 1 + .1 * I.smooth(.22, .5, hp);
    var part = I.ease(I.smooth(.5, .74, hp)) * .62 * W;
    I.setAttr(halfL, "transform", halfTransform(rise, gs, -part));
    I.setAttr(halfR, "transform", halfTransform(rise, gs, part));
    var gop = lk * (1 - I.smooth(.7, .8, hp));
    I.setStyle(halfL, "opacity", gop.toFixed(3));
    I.setStyle(halfR, "opacity", gop.toFixed(3));
    I.setVar(glass, "--inside-p", 1 - I.smooth(.3, .46, hp));
    I.setVar(surname, "--surname-op", lk * (1 - I.smooth(.2, .3, hp)));

    /* bands */
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i], st = I.band(hp, b.a, b.b, i === 0, i === bands.length - 1);
      var o = st.op, k = st.k;
      if (i === 0) k = Math.max(k, lk);
      if (i === bands.length - 1) o *= 1 - I.smooth(0, .1, op);
      I.setStyle(b.el, "opacity", o.toFixed(3));
      I.setVar(b.el, "--k", k, .008);
      var live = o > .5;
      I.setClass(b.el, "live", live);
      if (b.el.__inert !== !live) { b.el.__inert = !live; b.el.inert = !live; }
    }

    /* stars stream out of the cluster while the camera moves */
    if (stars) {
      var cam = zT * 26;
      if (Math.abs(cam - lastCam) > .0005 || more) {
        lastCam = cam;
        stars.draw(cam, now / 1000, G.fx / W * 2 - 1, -(G.fy / H * 2 - 1), (.5 + .5 * I.smooth(.15, .55, hp)) * lk);
      }
    }

    /* 01 organizations */
    I.setClass(orgs, "live", op > .001);
    I.setStyle(orgs, "opacity", I.smooth(0, .07, op).toFixed(3));
    I.setVar(orgHead, "--hk", I.smooth(.02, .14, op));
    for (var j = 0; j < orgItems.length; j++) {
      var a = .1 + j * .062;
      I.setVar(orgItems[j], "--on", I.smooth(a, a + .07, op));
    }
    if (linePath) I.setVar(linePath, "--off", (G.len * (1 - I.smooth(.1, .78, op))).toFixed(1), 0);

    return more;
  }

  function clear() {
    [far, mid, near, cut, orgs, orgHead, linePath, glass, surname, halfL, halfR].forEach(I.clearEl);
    bands.forEach(function (b) { I.clearEl(b.el); b.el.inert = false; b.el.__inert = null; });
    orgItems.forEach(I.clearEl);
    staticFrame();
    if (stars) stars.clear();
  }

  var scene = I.scene({ el: world, layout: layout, render: render, clear: clear, lerp: .14,
    mode: function (on) { if (on && !stars && starsCanvas) initStars(); },
    pin: function () { loadK = 1; } });

  function initStars() {
    stars = window.INITStars ? window.INITStars.create(starsCanvas, (navigator.hardwareConcurrency || 4) >= 8 ? 1600 : 1100, function () { lastCam = -1; I.wake(); }) : null;
    if (!stars) { starsCanvas.style.display = "none"; return; }
    if (G.W) stars.resize(G.W, G.H);
  }

  /* the inside portrait's aspect, then start the load ramp once the plate is decoded */
  var ins = new Image();
  ins.onload = function () { INSIDE_ASPECT = ins.naturalWidth / ins.naturalHeight; I.relayout(); };
  ins.src = insides[0].getAttribute("href");
  var farImg = far.querySelector("img");
  function ready() { if (loadReady) return; loadReady = true; I.wake(); }
  if (farImg.complete) ready();
  else { farImg.addEventListener("load", ready); farImg.addEventListener("error", ready); }
  setTimeout(ready, 1800);
  if (I.reduce) loadK = 1;
})();
