/* The world scene: hero (grid, blurred portrait, the name, bands) + 01 Organizations.
   One pinned stage, one progress value, every write delta-gated.
   Only transform and opacity move, each on its own compositor layer, so scrolling never repaints. */
(function () {
  "use strict";
  var I = window.INIT; if (!I) return;
  var world = document.getElementById("world");
  if (!world) return;
  var frame = world.querySelector(".hero-frame");
  var grid = world.querySelector(".hero-grid");
  var photo = world.querySelector(".hero-photo");
  var photoImg = photo.querySelector(".ph-soft");
  var sharpImg = photo.querySelector(".ph-sharp");
  var name = world.querySelector(".hn");
  var nameL = world.querySelector(".hn-l"), nameR = world.querySelector(".hn-r");
  var bands = [].slice.call(world.querySelectorAll(".band")).map(function (el) {
    return { el: el, a: +el.dataset.a, b: +el.dataset.b };
  });
  var orgs = world.querySelector(".orgs");
  var orgHead = orgs.querySelector(".orgs-head");
  var orgItems = [].slice.call(orgs.querySelectorAll(".org"));
  var linePath = orgs.querySelector(".ol-path");

  /* hero vs organizations share of the pinned range: 420vh then 240vh */
  var HERO_SHARE = 420 / 660;

  var G = { W: 0, H: 0, len: 0 };
  var loadK = 0, loadStart = 0, loadReady = false;

  /* text entrances */
  I.split(world.querySelector(".b2 .beat"), "halves", 11);
  I.split(world.querySelector(".b3 .beat"), "words", 23);
  I.split(world.querySelector(".b4 .beat"), "words", 37);

  /* ---------- layout: only the constellation needs measuring; the hero is sized by CSS ---------- */
  function layout(W, H, scrub) {
    W = frame.clientWidth || W; H = frame.clientHeight || H;
    G.W = W; G.H = H;
    if (!scrub || !linePath) return;
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

  /* ---------- the film ---------- */
  function render(p, now) {
    var hp = I.clamp(p / HERO_SHARE, 0, 1);
    var op = I.clamp((p - HERO_SHARE) / (1 - HERO_SHARE), 0, 1);
    var W = G.W;

    /* band one opens settled: a one-time load ramp, then scroll holds it */
    var more = false;
    if (!loadReady) { more = true; }
    else if (loadK < 1) {
      if (!loadStart) loadStart = now;
      loadK = I.clamp((now - loadStart) / 1300, 0, 1);
      more = loadK < 1;
    }
    var lk = 1 - Math.pow(1 - loadK, 3);

    var z = I.ease(I.clamp((hp - .04) / .9, 0, 1));
    var zT = z + .18 * op;

    /* the camera pushes into the grid */
    I.setStyle(grid, "transform", "scale(" + (1 + .8 * zT).toFixed(4) + ")");
    I.setStyle(grid, "opacity", (lk * (1 - .45 * op)).toFixed(3));

    /* the portrait drifts toward the camera and is gone before band two lands */
    var pf = 1 - I.smooth(.12, .3, hp);
    I.setStyle(photo, "transform", "translate3d(0," + (G.H * .04 * (1 - lk)).toFixed(1) + "px,0) scale(" + (1 + .14 * z).toFixed(4) + ")");
    var po = lk * pf;
    I.setStyle(photo, "opacity", po.toFixed(3));
    I.setStyle(photo, "visibility", po < .02 ? "hidden" : "visible");   /* gone means not clickable either */

    /* the name rises on load, swells, then parts for the camera */
    var gs = 1 + .08 * I.smooth(.18, .5, hp);
    I.setStyle(name, "transform", "translate3d(0," + (28 * (1 - lk)).toFixed(1) + "px,0) scale(" + gs.toFixed(4) + ")");
    var part = I.ease(I.smooth(.42, .7, hp)) * .6 * W;
    I.setStyle(nameL, "transform", "translate3d(" + (-part).toFixed(1) + "px,0,0)");
    I.setStyle(nameR, "transform", "translate3d(" + part.toFixed(1) + "px,0,0)");
    I.setStyle(name, "opacity", (lk * (1 - I.smooth(.6, .72, hp))).toFixed(3));

    /* bands */
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i], st = I.band(hp, b.a, b.b, i === 0, i === bands.length - 1);
      var o = st.op, k = st.k;
      if (i === 0) { k = Math.max(k, lk); o *= lk; }
      if (i === bands.length - 1) o *= 1 - I.smooth(0, .1, op);
      I.setStyle(b.el, "opacity", o.toFixed(3));
      I.setVar(b.el, "--k", k, .008);
      var live = o > .5;
      I.setClass(b.el, "live", live);
      if (b.el.__inert !== !live) { b.el.__inert = !live; b.el.inert = !live; }
    }

    /* 01 organizations */
    I.setClass(orgs, "live", op > .001);
    I.setStyle(orgs, "opacity", I.smooth(0, .07, op).toFixed(3));
    I.setVar(orgHead, "--hk", I.smooth(.02, .14, op));
    for (var j = 0; j < orgItems.length; j++) {
      var a = .1 + j * .062;
      var on = I.smooth(a, a + .07, op);
      I.setVar(orgItems[j], "--on", on);
      I.setClass(orgItems[j], "on", on > .6);   /* only a drawn star takes clicks */
    }
    if (linePath) I.setVar(linePath, "--off", (G.len * (1 - I.smooth(.1, .78, op))).toFixed(1), 0);

    return more;
  }

  function clear() {
    [grid, photo, name, nameL, nameR, orgs, orgHead, linePath].forEach(I.clearEl);
    bands.forEach(function (b) { I.clearEl(b.el); b.el.inert = false; b.el.__inert = null; });
    orgItems.forEach(I.clearEl);
  }

  /* ---------- the portrait: a light overlay; click to see it clearly ---------- */
  function loadSharp() { if (!sharpImg.getAttribute("src")) sharpImg.src = sharpImg.dataset.src; }
  ["pointerenter", "focus", "touchstart"].forEach(function (ev) { photo.addEventListener(ev, loadSharp, { once: true, passive: true }); });
  function setClear(on) {
    photo.classList.toggle("is-clear", on);
    photo.setAttribute("aria-pressed", on ? "true" : "false");
    photo.setAttribute("aria-label", on ? "Soften Ini-abasi's portrait" : "Show Ini-abasi's portrait clearly");
  }
  photo.addEventListener("click", function () {
    var on = !photo.classList.contains("is-clear");
    if (!on) { setClear(false); return; }
    loadSharp();
    /* fade across only once the sharp file is here, so the portrait never blinks out */
    if (sharpImg.complete && sharpImg.naturalWidth) setClear(true);
    else sharpImg.addEventListener("load", function () { setClear(true); }, { once: true });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && photo.classList.contains("is-clear") && !document.querySelector("dialog[open]")) setClear(false);
  });

  /* ---------- 01 organizations: each org opens its journey card ---------- */
  var dlg = document.getElementById("org-dialog");
  if (dlg && typeof dlg.showModal === "function") {
    var dlgBody = dlg.querySelector(".od-body");
    var current = null, opener = null, routing = false;
    orgs.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".org-btn");
      if (!btn) return;
      var stop = document.getElementById(btn.dataset.stop);
      var card = stop && stop.querySelector(".card");
      if (!card) return;
      var copy = card.cloneNode(true);
      [].forEach.call(copy.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
      var h = copy.querySelector("h3"); if (h) h.id = "od-title";
      [].forEach.call(copy.querySelectorAll("img[loading]"), function (im) { im.removeAttribute("loading"); });
      dlgBody.textContent = "";
      dlgBody.appendChild(copy);
      dlg.setAttribute("aria-labelledby", "od-title");
      dlg.dataset.kind = stop.dataset.kind;
      current = stop.id; opener = btn; routing = false;
      dlg.showModal();
      dlg.scrollTop = 0;
    });
    dlg.querySelector(".od-close").addEventListener("click", function () { dlg.close(); });
    /* closing hands focus back to the org it came from, unless we are flying to the route */
    dlg.addEventListener("close", function () { if (!routing && opener) opener.focus({ preventScroll: true }); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });   /* backdrop */
    dlg.querySelector(".od-route").addEventListener("click", function () {
      var id = current;
      routing = true;
      dlg.close();
      requestAnimationFrame(function () { if (I.route) I.route.goTo(id); });
    });
  }

  I.scene({ el: world, layout: layout, render: render, clear: clear, lerp: .14,
    pin: function () { loadK = 1; } });

  /* start the load ramp once the portrait is decoded, so the first frame is never empty */
  function ready() { if (loadReady) return; loadReady = true; I.wake(); }
  if (photoImg.complete) ready();
  else { photoImg.addEventListener("load", ready); photoImg.addEventListener("error", ready); }
  setTimeout(ready, 1500);
  if (I.reduce) loadK = 1;
})();
