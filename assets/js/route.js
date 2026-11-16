/* 02 Journey: the star route.
   The authored <ol> of stops is the source of truth. In film mode it becomes a horizontal flight:
   the map is generated from each stop's data-x / data-kind / data-lane, one card shows at a time. */
(function () {
  "use strict";
  var I = window.INIT; if (!I) return;
  var sec = document.getElementById("journey");
  if (!sec) return;
  var stageEl = sec.querySelector(".j-stage");
  var map = sec.querySelector(".j-map");
  var trackEl = sec.querySelector(".j-track");
  var svg = sec.querySelector(".j-svg");
  var nodesEl = sec.querySelector(".j-nodes");
  var parA = sec.querySelector(".j-par--a"), parB = sec.querySelector(".j-par--b");
  var countN = sec.querySelector(".j-count-n"), countT = sec.querySelector(".j-count-t");
  var tabs = [].slice.call(sec.querySelectorAll('[role="tab"]'));
  var panels = [].slice.call(sec.querySelectorAll('[role="tabpanel"]'));
  var NS = "http://www.w3.org/2000/svg";

  var tracks = panels.map(function (panel) {
    return {
      panel: panel, id: panel.dataset.track, widthMul: +panel.dataset.width || 4,
      stops: [].slice.call(panel.querySelectorAll(".stop")).map(function (li, i) {
        return { li: li, i: i, x: +li.dataset.x, kind: li.dataset.kind, lane: +(li.dataset.lane || 0), label: li.dataset.label, short: li.dataset.short, end: li.dataset.end ? +li.dataset.end : null };
      })
    };
  });
  var cur = tracks[0];
  var active = -1;
  var L = { W: 0, H: 0, TW: 0, x0: 0, x1: 1, mainY: 0, upY: 0, lanes: [] };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- build the map for the current track ---------- */
  function build() {
    var W = L.W, H = L.H, TW = L.TW;
    svg.textContent = ""; nodesEl.textContent = "";
    svg.setAttribute("viewBox", "0 0 " + TW.toFixed(0) + " " + H.toFixed(0));
    trackEl.style.width = TW.toFixed(0) + "px";
    var X = function (f) { return f * TW; };
    var g = el("g", { "clip-path": "url(#jclip)" }, svg);
    var defs = el("defs", {}, svg);
    var cp = el("clipPath", { id: "jclip" }, defs);
    L.clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cp);
    var my = L.mainY;

    if (cur.id === "dev") {
      var stops = cur.stops;
      var ag = stops.filter(function (s) { return s.kind === "paid"; });
      var a0 = ag[0], a1 = ag[1];
      var startX = X(.02), nowX = X(.975);
      /* before the first paid role, the route is a faint path */
      el("path", { class: "rt rt-gap", d: "M" + startX + " " + my + " H" + X(a0.x) }, g);
      el("path", { class: "rt rt-paid", d: "M" + X(a0.x) + " " + my + " H" + X(a0.end || a0.x + .08) }, g);
      el("path", { class: "rt rt-gap", d: "M" + X(a0.end || a0.x + .08) + " " + my + " H" + X(a1.x - .015) }, g);
      el("path", { class: "rt rt-paid", d: "M" + X(a1.x - .015) + " " + my + " H" + nowX }, g);
      /* volunteer lanes branch after Antigravity and run to now */
      var bx = X((a0.end || a0.x + .08) + .005);
      stops.filter(function (s) { return s.kind === "vol"; }).forEach(function (s) {
        var ly = L.lanes[s.lane - 1];
        var fan = 90 + s.lane * 40;   /* lanes fan out quickly after Antigravity, then run side by side */
        el("path", { class: "rt rt-vol", d: "M" + bx + " " + my + " C" + (bx + fan * .6) + " " + my + " " + (bx + fan * .4) + " " + ly + " " + (bx + fan) + " " + ly + " H" + nowX }, g);
      });
      /* freelance and personal stops are tethered above the line */
      stops.filter(function (s) { return s.kind === "free" || s.kind === "own"; }).forEach(function (s) {
        el("path", { class: "rt " + (s.kind === "free" ? "rt-free" : "rt-own"), d: "M" + X(s.x) + " " + my + " V" + L.upY }, g);
      });
      el("path", { class: "rt rt-now", d: "M" + nowX + " " + (L.upY - 20) + " V" + (L.lanes[2] + 20) }, g);
      addNode({ kind: "now", x: .975, label: "Now", short: "" }, nowX, L.upY - 30, true);
    } else {
      el("path", { class: "rt rt-ledger", d: "M" + X(.03) + " " + my + " H" + X(.97) }, g);
    }

    cur.stops.forEach(function (s) {
      var x = X(s.x), y = my, up = false;
      if (s.kind === "vol") y = L.lanes[s.lane - 1];
      if (s.kind === "free" || s.kind === "own") { y = L.upY; up = true; }
      if (s.kind === "way" && cur.id === "dev") up = true;
      s.node = addNode(s, x, y, up);
      s.px = x;
    });
    if (countT) countT.textContent = String(cur.stops.length).padStart(2, "0");
  }

  function addNode(s, x, y, up) {
    var n = document.createElement("div");
    n.className = "j-node" + (up ? " up" : "");
    n.dataset.kind = s.kind;
    n.style.left = x.toFixed(1) + "px"; n.style.top = y.toFixed(1) + "px";
    var dot = document.createElement("span"); dot.className = "j-dot";
    var lbl = document.createElement("span"); lbl.className = "j-lbl";
    if (s.short) { var b = document.createElement("b"); b.textContent = s.short; lbl.appendChild(b); }
    var it = document.createElement("i"); it.textContent = s.label; lbl.appendChild(it);
    n.appendChild(dot); n.appendChild(lbl);
    nodesEl.appendChild(n);
    return n;
  }

  /* ---------- layout ---------- */
  function layout(W, H, scrub) {
    if (!scrub) { cur.stops.forEach(function (s) { s.li.classList.remove("on"); }); active = -1; return; }
    L.W = stageEl.clientWidth || W; L.H = stageEl.clientHeight || H;
    L.TW = L.W * cur.widthMul;
    var first = cur.stops[0].x, last = cur.stops[cur.stops.length - 1].x;
    L.x0 = first; L.x1 = last;
    L.mainY = L.H * .38; L.upY = L.H * .29;
    L.lanes = [L.H * .44, L.H * .485, L.H * .53];
    var cnt = sec.querySelector(".j-count");
    if (cnt) cnt.style.setProperty("--jc-top", (L.lanes[2] + 30).toFixed(0) + "px");
    build();
    active = -1;
  }

  /* ---------- the flight ---------- */
  function render(p) {
    var W = L.W, TW = L.TW;
    var focusF = L.x0 + (L.x1 - L.x0) * p;           /* track fraction under the centre line */
    var tx = W / 2 - focusF * TW;
    I.setStyle(trackEl, "transform", "translate3d(" + tx.toFixed(1) + "px,0,0)");
    I.setStyle(parA, "transform", "translate3d(" + ((tx * .12) % 380).toFixed(1) + "px,0,0)");
    I.setStyle(parB, "transform", "translate3d(" + ((tx * .26) % 520).toFixed(1) + "px,0,0)");
    if (L.clipRect) I.setAttr(L.clipRect, "width", Math.max(0, focusF * TW + W * .38).toFixed(0));

    /* the active stop is the one nearest the centre line, with a little hysteresis */
    var fx = focusF * TW, best = active, bd = 1e9;
    cur.stops.forEach(function (s, i) { var d = Math.abs(s.px - fx); if (d < bd) { bd = d; best = i; } });
    if (active >= 0 && best !== active && Math.abs(cur.stops[active].px - fx) - bd < 14) best = active;
    if (best !== active) setActive(best);
  }

  function setActive(i) {
    cur.stops.forEach(function (s, j) {
      s.li.classList.toggle("on", j === i);
      if (s.node) s.node.classList.toggle("on", j === i);
    });
    active = i;
    if (countN) countN.textContent = String(i + 1).padStart(2, "0");
  }

  var scene = I.scene({
    el: sec, layout: layout, render: render, lerp: .16,
    clear: function () {
      [trackEl, parA, parB].forEach(I.clearEl);
      cur.stops.forEach(function (s) { s.li.classList.remove("on"); });
      active = -1;
    }
  });

  /* keyboard focus on a link in a card that is not on screen: fly to that stop */
  sec.addEventListener("focusin", function (e) {
    if (!I.scrub) return;
    var li = e.target.closest && e.target.closest(".stop");
    if (!li) return;
    var s = cur.stops.filter(function (x) { return x.li === li; })[0];
    if (!s || s.i === active) return;
    var p = (s.x - L.x0) / ((L.x1 - L.x0) || 1);
    I.scrollToProgress(scene, I.clamp(p, 0, 1));
  });

  /* ---------- tabs ---------- */
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.hidden = p.id !== tab.getAttribute("aria-controls"); });
    cur = tracks.filter(function (t) { return t.panel.id === tab.getAttribute("aria-controls"); })[0];
    if (focus) tab.focus();
    sec.classList.toggle("is-acc", cur.id === "acc");
    I.relayout();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var n = null;
      if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") n = tabs[0];
      if (e.key === "End") n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); select(n, true); }
    });
  });
})();
