/* About parallax, the hold-to-balance ledger, the tools stack, FINDATA counters,
   the next-stop line, copy email, and the contact form. */
(function () {
  "use strict";
  var I = window.INIT; if (!I) return;

  /* ---------- About: the photo drifts slower than the page ---------- */
  var photo = document.querySelector(".about-photo");
  if (photo) {
    var pimg = photo.querySelector("img");
    I.scene({
      el: photo, pinned: false, lerp: .2,
      render: function (p) { I.setVar(pimg, "--py", (7 - 14 * p).toFixed(2) + "%", 0); },
      clear: function () { I.clearEl(pimg); }
    });
  }

  /* ---------- 04 Tools: the stack assembles from the data layer up ---------- */
  var tools = document.getElementById("tools");
  if (tools) {
    var rows = [].slice.call(tools.querySelectorAll(".srow")).sort(function (a, b) { return a.dataset.i - b.dataset.i; });
    var ledgerCol = tools.querySelector(".stack-ledger");
    I.scene({
      el: tools, lerp: .16,
      render: function (p) {
        rows.forEach(function (r, i) { I.setVar(r, "--k", I.smooth(.06 + i * .12, .2 + i * .12, p), .006); });
        I.setVar(ledgerCol, "--k", I.smooth(.68, .84, p), .006);
      },
      clear: function () { rows.forEach(I.clearEl); I.clearEl(ledgerCol); }
    });
  }

  /* ---------- contact: the route's last line draws to the next stop ---------- */
  var contact = document.getElementById("contact");
  if (contact) {
    I.scene({
      el: contact, pinned: false, lerp: .18,
      render: function (p) { I.setVar(contact, "--draw", I.smooth(.12, .5, p)); },
      clear: function () { I.clearEl(contact); }
    });
  }

  /* ---------- FINDATA counters: count up once, on entry ---------- */
  var stats = document.querySelector(".stats");
  if (stats && "IntersectionObserver" in window) {
    var dds = [].slice.call(stats.querySelectorAll("dd[data-count]"));
    var counted = false;
    var finalText = function () { dds.forEach(function (dd) { dd.textContent = (+dd.dataset.count).toLocaleString("en-US"); }); };
    if (!I.reduce) dds.forEach(function (dd) { dd.textContent = "0"; });
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || counted) return;
      if (I.reduce) { finalText(); return; }
      counted = true; io.disconnect();
      var t0 = performance.now(), last = [];
      (function step(now) {
        var t = I.clamp((now - t0) / 1400, 0, 1), e = 1 - Math.pow(1 - t, 3);
        dds.forEach(function (dd, i) {
          var v = Math.round(+dd.dataset.count * e).toLocaleString("en-US");
          if (last[i] !== v) { last[i] = v; dd.textContent = v; }
        });
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: .4 });
    io.observe(stats);
    var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    (rm.addEventListener ? rm.addEventListener.bind(rm, "change") : rm.addListener.bind(rm))(function () { if (rm.matches && !counted) finalText(); });
  }

  /* ---------- the one interactive moment: hold to balance ---------- */
  var ledger = document.querySelector("[data-balance]");
  if (ledger) {
    var seal = ledger.querySelector(".seal");
    var wrap = ledger.querySelector(".seal-wrap");
    var lines = ledger.querySelector(".ledger-lines");
    var debit = [].slice.call(ledger.querySelectorAll(".debit li"));
    var credit = [].slice.call(ledger.querySelectorAll(".credit li"));
    var totals = [].slice.call(ledger.querySelectorAll("[data-total]"));
    var status = ledger.querySelector("[data-balance-status]");
    var NS = "http://www.w3.org/2000/svg";
    var paths = [], lens = [];
    var hold = 0, holding = false, done = false, raf = null, lastT = 0, shownCount = -1, autoFill = false, pinned = false;
    var reduceMQL = window.matchMedia("(prefers-reduced-motion: reduce)");

    function layoutLines() {
      lines.textContent = "";
      paths = []; lens = [];
      var wr = wrap.getBoundingClientRect();
      if (!wr.width) return;
      lines.setAttribute("viewBox", "0 0 " + wr.width.toFixed(0) + " " + wr.height.toFixed(0));
      var cy = wr.height / 2, w = wr.width;
      debit.forEach(function (li, i) {
        var a = li.getBoundingClientRect(), b = credit[i].getBoundingClientRect();
        var y1 = a.top + a.height / 2 - wr.top, y2 = b.top + b.height / 2 - wr.top;
        var d = "M" + (-24) + " " + y1.toFixed(1) + " C" + (w * .3).toFixed(1) + " " + y1.toFixed(1) + " " + (w * .3).toFixed(1) + " " + cy.toFixed(1) + " " + (w * .5).toFixed(1) + " " + cy.toFixed(1) +
                " S" + (w * .7).toFixed(1) + " " + y2.toFixed(1) + " " + (w + 24).toFixed(1) + " " + y2.toFixed(1);
        var p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        lines.appendChild(p);
        var len = p.getTotalLength ? p.getTotalLength() : 600;
        p.style.strokeDasharray = len.toFixed(1);
        p.style.strokeDashoffset = len.toFixed(1);
        paths.push(p); lens.push(len);
      });
      paint();
    }

    function paint() {
      ledger.style.setProperty("--hold", hold.toFixed(4));
      paths.forEach(function (p, i) {
        var k = I.smooth(i * .2, i * .2 + .32, hold);
        p.style.strokeDashoffset = (lens[i] * (1 - k)).toFixed(1);
      });
      var n = Math.min(4, Math.floor(hold * 4 + .0001));
      if (n !== shownCount) {
        shownCount = n;
        totals.forEach(function (t) { t.textContent = n; });
        debit.forEach(function (li, i) { li.classList.toggle("lit", i < n); credit[i].classList.toggle("lit", i < n); });
      }
    }

    function finish() {
      done = true; holding = false; autoFill = false; hold = 1;
      ledger.classList.add("done");
      if (status) status.textContent = "Balanced. Each accounting skill is matched to the system that encodes it.";
      paint();
    }

    function loop(now) {
      var dt = Math.min(64, now - (lastT || now)); lastT = now;
      if (done) { raf = null; return; }
      if (holding) hold = Math.min(1, hold + dt / 1700);
      else hold = Math.max(0, hold - dt / 650);   /* release early: it eases back, never snaps */
      if (hold >= 1) { finish(); raf = null; return; }
      paint();
      if (holding || hold > 0) raf = requestAnimationFrame(loop); else { raf = null; lastT = 0; }
    }
    function start() { if (done) return; holding = true; if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } }
    function stop() { if (autoFill) return; holding = false; if (!raf && !done) raf = requestAnimationFrame(loop); }

    seal.addEventListener("pointerdown", function (e) { e.preventDefault(); try { seal.setPointerCapture(e.pointerId); } catch (x) {} start(); });
    seal.addEventListener("pointerup", stop);
    seal.addEventListener("pointercancel", stop);
    seal.addEventListener("lostpointercapture", stop);
    seal.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    seal.addEventListener("click", function (e) {
      if (done || holding || e.detail !== 0) return;   /* keyboard-free activation, no pointer hold possible */
      if (reduceMQL.matches) { finish(); return; }
      autoFill = true; start();
    });
    seal.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) start(); }
    });
    seal.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stop(); } });
    seal.addEventListener("blur", stop);

    /* reduced motion, live both ways: pin to balanced, and un-pin when it is switched off */
    function syncReduce() {
      if (reduceMQL.matches) { if (!done) { pinned = true; finish(); } }
      else if (pinned) {
        pinned = false; done = false; holding = false; autoFill = false; hold = 0; shownCount = -1;
        ledger.classList.remove("done");
        if (status) status.textContent = "";
        paint();
      }
    }
    reduceMQL.addEventListener ? reduceMQL.addEventListener("change", syncReduce) : reduceMQL.addListener(syncReduce);
    syncReduce();

    var rzT = null;
    window.addEventListener("resize", function () { clearTimeout(rzT); rzT = setTimeout(layoutLines, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutLines);
    window.addEventListener("load", layoutLines);
    layoutLines();
  }

  /* ---------- copy email ---------- */
  [].forEach.call(document.querySelectorAll(".copy-email"), function (btn) {
    var out = btn.parentNode.querySelector(".copy-status"), timer = null;
    function said(t) { if (!out) return; out.textContent = t; clearTimeout(timer); timer = setTimeout(function () { out.textContent = ""; }, 2600); }
    function selectIt() {
      var r = document.createRange(), a = document.querySelector(".email a");
      if (a) { r.selectNodeContents(a); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      said("Selected. Press Ctrl+C to copy.");
    }
    btn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(btn.dataset.copy).then(function () { said("Copied."); }, selectIt);
      else selectIt();
    });
  });

  /* ---------- contact form: honest about where the message goes ---------- */
  var form = document.querySelector(".contact-form");
  if (form) {
    var fst = form.querySelector(".form-status");
    var to = form.dataset.mailto;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim(), email = form.elements.email.value.trim(), msg = form.elements.message.value.trim();
      var topic = (form.querySelector('input[name="topic"]:checked') || {}).value || "A message";
      var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      [["name", !name], ["email", !okEmail], ["message", !msg]].forEach(function (pair) {
        var f = form.elements[pair[0]];
        if (pair[1]) { f.setAttribute("aria-invalid", "true"); f.setAttribute("aria-describedby", "form-status"); }
        else { f.removeAttribute("aria-invalid"); f.removeAttribute("aria-describedby"); }
      });
      if (!name || !msg || !okEmail) {
        fst.textContent = "Please add your name, a valid email and a message.";
        (!name ? form.elements.name : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? form.elements.email : form.elements.message).focus();
        return;
      }
      var action = form.getAttribute("action") || "";
      if (action.indexOf("FORM_ID") !== -1) {
        /* no form service connected yet: hand the message to the visitor's own email app */
        var body = msg + "\n\n" + name + "\n" + email;
        window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(topic + ", from " + name) + "&body=" + encodeURIComponent(body);
        fst.textContent = "Your email app should open with the message ready to send. If it doesn't, write to " + to + ".";
        return;
      }
      fst.textContent = "Sending...";
      fetch(action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          fst.textContent = "Sent. It's in my inbox, and I'll reply within 24 hours.";
        })
        .catch(function () { fst.textContent = "That didn't send. Please email me at " + to + "."; });
    });
  }
})();
