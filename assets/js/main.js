(function () {
  "use strict";

  const select = (el, all = false) => {
    el = el.trim();
    return all ? [...document.querySelectorAll(el)] : document.querySelector(el);
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = select("#header");
  const body = document.body;

  /**
   * Glass nav: become more solid once the page scrolls
   */
  const toggleScrolled = () => {
    const scrolled = window.scrollY > 24;
    if (header) header.classList.toggle("scrolled", scrolled);
    body.classList.toggle("has-scrolled", scrolled);
  };

  /**
   * Hero parallax: desktop pointers only, never with reduced motion
   */
  const heroBg = select(".hero-bg");
  const parallaxQuery = window.matchMedia("(hover: hover) and (min-width: 992px)");
  let parallaxTicking = false;
  const updateParallax = () => {
    parallaxTicking = false;
    if (!heroBg) return;
    if (reduceMotion || !parallaxQuery.matches) {
      heroBg.style.translate = "";
      return;
    }
    const y = window.scrollY;
    if (y > window.innerHeight * 1.2) return;
    heroBg.style.translate = "0 " + (y * 0.25).toFixed(1) + "px";
  };
  const requestParallax = () => {
    if (!parallaxTicking) {
      parallaxTicking = true;
      window.requestAnimationFrame(updateParallax);
    }
  };

  /**
   * Active nav link follows the section in view
   */
  const navbarlinks = select("#navbar .scrollto", true);
  const navbarlinksActive = () => {
    const position = window.scrollY + 200;
    navbarlinks.forEach((link) => {
      if (!link.hash) return;
      const section = select(link.hash);
      if (!section) return;
      const inView = position >= section.offsetTop && position <= section.offsetTop + section.offsetHeight;
      link.classList.toggle("active", inView);
    });
  };

  /**
   * Back to top button
   */
  const backtotop = select(".back-to-top");
  const toggleBacktotop = () => {
    if (backtotop) backtotop.classList.toggle("active", window.scrollY > 100);
  };

  const onScroll = () => {
    toggleScrolled();
    navbarlinksActive();
    toggleBacktotop();
    requestParallax();
  };
  window.addEventListener("load", onScroll);
  onScroll();
  document.addEventListener("scroll", onScroll, { passive: true });

  /**
   * Smooth scroll that accounts for the fixed nav
   */
  const scrollto = (hash) => {
    const target = select(hash);
    if (!target) return;
    const offset = header ? header.offsetHeight + 24 : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? "auto" : "smooth" });
  };

  /**
   * Mobile nav
   */
  const toggle = select(".mobile-nav-toggle");
  const setMobileNav = (open) => {
    body.classList.toggle("mobile-nav-active", open);
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.classList.toggle("bi-list", !open);
      icon.classList.toggle("bi-x", open);
    }
  };

  if (toggle) {
    toggle.addEventListener("click", () => setMobileNav(!body.classList.contains("mobile-nav-active")));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMobileNav(false);
  });

  // Tap outside the open menu closes it
  document.addEventListener("click", (e) => {
    if (body.classList.contains("mobile-nav-active") && header && !header.contains(e.target)) {
      setMobileNav(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 992) setMobileNav(false);
    requestParallax();
  });

  select(".scrollto, .back-to-top", true).forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!link.hash || !select(link.hash)) return;
      e.preventDefault();
      setMobileNav(false);
      scrollto(link.hash);
    });
  });

  /**
   * Scroll with offset on page load with hash links in the url
   */
  window.addEventListener("load", () => {
    if (window.location.hash && select(window.location.hash)) {
      scrollto(window.location.hash);
    }
  });

  /**
   * Preloader fades out first; only then does the hero entrance play,
   * so the motion is never hidden behind the loader.
   */
  const preloader = select("#preloader");
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      if (preloader) preloader.remove();
      body.classList.add("is-ready");
    };
    if (preloader) {
      preloader.addEventListener("transitionend", start, { once: true });
      preloader.classList.add("loaded");
      setTimeout(start, 700);
    } else {
      start();
    }
  };

  // Don't wait for window "load" (it waits on every third-party request).
  // Start once fonts and the hero photo are ready, capped so a slow network
  // never leaves the visitor staring at the loader.
  const whenAssetsReady = () => {
    const waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    if (heroBg) {
      const match = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(heroBg).backgroundImage);
      if (match) {
        const img = new Image();
        img.src = match[1];
        waits.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
      }
    }
    const cap = new Promise((resolve) => setTimeout(resolve, 1800));
    Promise.race([Promise.all(waits), cap]).then(reveal, reveal);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whenAssetsReady);
  } else {
    whenAssetsReady();
  }
  window.addEventListener("load", reveal);

  /**
   * Footer year
   */
  select("[data-year]", true).forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /**
   * Animation on scroll
   */
  // Reduced motion keeps AOS on; CSS strips the movement so only the fade remains.
  if (typeof AOS !== "undefined") {
    AOS.init({
      duration: 1200,
      easing: "ease-out-cubic",
      once: true,
      mirror: false,
      offset: 60
    });
    window.addEventListener("load", () => AOS.refresh());
  }
})();
