/* INIT scroll engine
   One passive scroll listener, one rAF loop that rests, delta-gated DOM writes,
   the five static gates kept live, reduced motion honored live in both directions. */
(function () {
  "use strict";

  var root = document.documentElement;
  var GATES = window.__GATES || [];
  var MQLS = GATES.map(function (q) { return window.matchMedia(q); });
  var reduceMQL = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarseMQL = window.matchMedia("(pointer: coarse)");

  /* ---------- small math ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- delta-gated writes ---------- */
  function setVar(el, name, v, eps) {
    var c = el.__v || (el.__v = {});
    if (typeof v === "number") {
      if (c[name] !== undefined && Math.abs(c[name] - v) < (eps === undefined ? .002 : eps)) return;
      c[name] = v; el.style.setProperty(name, (Math.round(v * 10000) / 10000).toString());
    } else {
      if (c[name] === v) return;
      c[name] = v; el.style.setProperty(name, v);
    }
  }
  function setStyle(el, prop, v) {
    var c = el.__s || (el.__s = {});
    if (c[prop] === v) return;
    c[prop] = v; el.style[prop] = v;
  }
  function setAttr(el, name, v) {
    var c = el.__a || (el.__a = {});
    if (c[name] === v) return;
    c[name] = v; el.setAttribute(name, v);
  }
  function setClass(el, cls, on) {
    var c = el.__c || (el.__c = {});
    if (c[cls] === on) return;
    c[cls] = on; el.classList.toggle(cls, on);
  }
  /* forget every cached write and inline style, so CSS owns the element again */
  function clearEl(el) {
    if (!el) return;
    if (el.__v) { for (var k in el.__v) el.style.removeProperty(k); el.__v = null; }
    if (el.__s) { for (var p in el.__s) el.style[p] = ""; el.__s = null; }
    if (el.__c) { for (var c in el.__c) el.classList.remove(c); el.__c = null; }
    el.__a = null;
  }

  /* ---------- split text: screen readers get the sentence, eyes get the pieces ---------- */
  function split(el, mode, seed) {
    if (!el || el.__split) return el && el.__split;
    var text = el.textContent.replace(/\s+/g, " ").trim();
    /* remember which words sat inside an accent span (.hl), so the pieces keep their colour */
    var flags = [];
    [].forEach.call(el.childNodes, function (n) {
      var hl = n.nodeType === 1 && n.classList.contains("hl");
      n.textContent.split(/\s+/).forEach(function (w) { if (w) flags.push(hl); });
    });
    var r = rng(seed || 7);
    el.textContent = "";
    var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = text;
    var vis = document.createElement("span"); vis.setAttribute("aria-hidden", "true"); vis.className = "split";
    var words = text.split(" ");
    if (flags.length !== words.length) flags = [];
    var allHl = function (a, b) { for (var i = a; i < b; i++) if (!flags[i]) return false; return a < b; };
    var out = { words: [], chars: [] };
    if (mode === "halves") {
      var mid = Math.ceil(words.length / 2);
      var a = document.createElement("span"); a.className = "half-a" + (allHl(0, mid) ? " hl" : ""); a.textContent = words.slice(0, mid).join(" ") + " ";
      var b = document.createElement("span"); b.className = "half-b" + (allHl(mid, words.length) ? " hl" : ""); b.textContent = words.slice(mid).join(" ");
      vis.appendChild(a); vis.appendChild(b);
    } else {
      words.forEach(function (w, i) {
        var ws = document.createElement("span"); ws.className = "w" + (flags[i] ? " hl" : "");
        if (mode === "chars") {
          for (var j = 0; j < w.length; j++) {
            var cs = document.createElement("span"); cs.className = "c"; cs.textContent = w[j];
            cs.style.setProperty("--th", (r() * .55).toFixed(3));
            ws.appendChild(cs); out.chars.push(cs);
          }
        } else {
          ws.textContent = w;
          ws.style.setProperty("--th", (i / Math.max(1, words.length) * .5 + r() * .06).toFixed(3));
        }
        vis.appendChild(ws); out.words.push(ws);
        if (i < words.length - 1) vis.appendChild(document.createTextNode(" "));
      });
    }
    el.appendChild(sr); el.appendChild(vis);
    el.__split = out;
    return out;
  }

  /* ---------- band math (the skill's caption-band pattern) ---------- */
  function bandState(p, a, b, first, last, ramp) {
    var f = Math.min(.02, (b - a) / 3);
    var op = (first ? 1 : smooth(a, a + f, p)) * (last ? 1 : 1 - smooth(b - f, b, p));
    var k = clamp((p - a) / (ramp || Math.min(.025, (b - a) * .35)), 0, 1);
    return { op: op, k: k };
  }

  /* ---------- scenes and the loop ---------- */
  var scenes = [];
  var scrub = false;
  var rafId = null, lastT = 0;
  var vw = window.innerWidth, vh = window.innerHeight;

  function measure(s) {
    var r = s.el.getBoundingClientRect();
    s.top = r.top + window.scrollY;
    s.height = s.el.offsetHeight;
    var stageH = s.pinned && s.stage ? s.stage.offsetHeight || vh : vh;
    s.range = s.pinned ? Math.max(1, s.height - stageH) : s.height + vh;
  }
  function progressOf(s) {
    var y = window.scrollY;
    return s.pinned ? clamp((y - s.top) / s.range, 0, 1) : clamp((y + vh - s.top) / s.range, 0, 1);
  }
  function near(s) {
    var y = window.scrollY;
    return y + vh > s.top - vh * .5 && y < s.top + s.height + vh * .5;
  }

  function tick(now) {
    var dt = Math.min(100, now - (lastT || now)); lastT = now;
    var busy = false;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!scrub && !s.always) continue;
      if (!near(s)) { if (s.wasNear) { s.wasNear = false; s.leave && s.leave(); } continue; }
      s.wasNear = true;
      var k = s.lerp || .16;
      var target = s.target;
      s.shown += (target - s.shown) * (1 - Math.pow(1 - k, dt / 16.667));
      if (Math.abs(target - s.shown) < .0004) s.shown = target; else busy = true;
      if (s.render(s.shown, now, dt)) busy = true; /* a scene can ask for more frames (load ramps) */
    }
    if (busy) rafId = requestAnimationFrame(tick);
    else { rafId = null; lastT = 0; }
  }
  function wake() { if (rafId === null) rafId = requestAnimationFrame(tick); }

  function onScroll() {
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!scrub && !s.always) continue;
      s.target = progressOf(s);
    }
    wake();
    navState();
  }

  function layoutAll() {
    vw = window.innerWidth; vh = window.innerHeight;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      s.layout && s.layout(vw, vh, scrub);
      measure(s);
      s.target = progressOf(s);
      if (s.snapOnLayout !== false) s.shown = s.target;
    }
    wake();
  }

  /* ---------- the gates: arm and disarm the film, live ---------- */
  function gated() { for (var i = 0; i < MQLS.length; i++) if (MQLS[i].matches) return true; return false; }
  function applyMode() {
    var want = !gated() && !!window.requestAnimationFrame;
    if (want === scrub && root.classList.contains("scrub") === want) return;
    scrub = want;
    root.classList.toggle("scrub", scrub);
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!scrub) s.clear && s.clear();   /* static layout owns every element again */
      s.mode && s.mode(scrub);
    }
    requestAnimationFrame(layoutAll);    /* heights changed with the class: measure after layout */
  }
  MQLS.forEach(function (m) { (m.addEventListener ? m.addEventListener("change", applyMode) : m.addListener(applyMode)); });
  /* reduced motion live, both ways: flipping in pins final states; flipping out re-arms through the same gate */
  function onReduce() {
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (reduceMQL.matches) s.pin && s.pin(); else s.unpin && s.unpin();
    }
    applyMode();
  }
  reduceMQL.addEventListener ? reduceMQL.addEventListener("change", onReduce) : reduceMQL.addListener(onReduce);

  var lastW = window.innerWidth, lastH = window.innerHeight, rz = null;
  window.addEventListener("resize", function () {
    /* ignore toolbar-only height jitter on mobile; relayout on real changes */
    var w = window.innerWidth, h = window.innerHeight;
    /* touch toolbars jitter the height while scrolling: ignore small changes only there */
    if (w === lastW && h === lastH) return;
    if (w === lastW && coarseMQL.matches && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    clearTimeout(rz); rz = setTimeout(layoutAll, 120);
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("load", function () { layoutAll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layoutAll(); });

  /* ---------- page furniture ---------- */
  var nav = document.querySelector(".nav");
  var navLinks = [].slice.call(document.querySelectorAll(".nav nav a[href^='#']"));
  var lastSolid = null, lastActive = null;
  function navState() {
    if (!nav) return;
    var solid = window.scrollY > 24;
    if (solid !== lastSolid) { lastSolid = solid; nav.classList.toggle("solid", solid); }
    var mid = window.scrollY + vh * .4, active = null;
    navLinks.forEach(function (a) {
      var t = document.querySelector(a.getAttribute("href"));
      if (t) { var r = t.getBoundingClientRect(), top = r.top + window.scrollY; if (mid >= top && mid < top + t.offsetHeight) active = a; }
    });
    if (active !== lastActive) {
      if (lastActive) lastActive.classList.remove("active");
      if (active) active.classList.add("active");
      lastActive = active;
    }
  }

  /* reveals: entrance on the parent, retire the stagger once it has played */
  var revealIO = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; el.classList.add("in"); revealIO.unobserve(el);
      setTimeout(function () { el.classList.add("settled"); }, 1400);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .12 }) : null;
  [].forEach.call(document.querySelectorAll(".reveal"), function (el) {
    if (revealIO) revealIO.observe(el); else el.classList.add("in");
  });

  /* phone menu: a disclosure for the primary nav */
  var menuBtn = document.querySelector(".menu-btn");
  if (menuBtn && nav) {
    var setMenu = function (open) {
      nav.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Close" : "Menu";
    };
    menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("menu-open")); });
    nav.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("nav a")) setMenu(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && nav.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", function (ev) { if (nav.classList.contains("menu-open") && !nav.contains(ev.target)) setMenu(false); });
  }

  document.addEventListener("visibilitychange", function () { document.body.classList.toggle("paused", document.hidden); });
  [].forEach.call(document.querySelectorAll("[data-year]"), function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- public API ---------- */
  window.INIT = {
    clamp: clamp, smooth: smooth, ease: ease, rng: rng,
    setVar: setVar, setStyle: setStyle, setAttr: setAttr, setClass: setClass, clearEl: clearEl,
    split: split, band: bandState,
    get scrub() { return scrub; },
    get reduce() { return reduceMQL.matches; },
    scene: function (s) {
      s.shown = 0; s.target = 0; s.pinned = s.pinned !== false;
      if (s.pinned && !s.stage) s.stage = s.el.querySelector(".stage");
      scenes.push(s);
      measure(s);
      return s;
    },
    wake: wake,
    relayout: layoutAll,
    scrollToProgress: function (s, p) {
      measure(s);
      var y = s.pinned ? s.top + p * s.range : s.top - vh + p * s.range;
      window.scrollTo({ top: y, behavior: reduceMQL.matches ? "auto" : "smooth" });
    }
  };

  /* start once every scene script has registered */
  document.addEventListener("DOMContentLoaded", function () {
    scrub = !root.classList.contains("scrub"); /* force applyMode to run its first pass */
    applyMode();
    navState();
  });
})();
