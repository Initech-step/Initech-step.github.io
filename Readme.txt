INIT · Ini-abasi Etim
=====================

Personal portfolio: https://initech-step.github.io/

Plain HTML, CSS and vanilla JavaScript. No framework, no build step.

Pages
- index.html      The film: hero (name over a blurred portrait on a navy grid), organizations,
                  the journey star route (two tabs), about + hold to balance,
                  tools, projects, education, contact.
- journey.html    The full journey, every stop in detail.

Code
- assets/css/site.css   Every style. Design tokens sit at the top in :root.
- assets/js/engine.js   Scroll engine: one scroll listener, one rAF loop that rests,
                        delta-gated writes, the five static-hero gates (phones,
                        portrait tablets, coarse portrait, landscape phones,
                        reduced motion), live in both directions.
- assets/js/hero.js     Hero + organizations scene. Moves only transform and opacity.
- assets/js/route.js    Journey star route, built from the <ol> of stops.
- assets/js/scenes.js   About parallax, hold to balance, tools stack, counters,
                        contact form.

Editing content
- Journey stops live in index.html (section #journey) as <li class="stop"> items.
  data-x is the position on the route (0 to 1), data-kind is paid / vol / free /
  own / way / bridge / ledger. The map draws itself from these.
- The contact form posts to Formspree once FORM_ID in index.html is replaced with
  a real form id. Until then it opens the visitor's email app.

Images
- assets/img/portrait/hero-blur-1200.webp is cutout-1200.webp, blurred ahead of time
  (Gaussian, alpha-premultiplied) so the hero never filters at runtime.
- og.jpg (social preview) still uses Pismis 24: NASA, ESA, CSA, and STScI,
  A. Pagan (STScI), CC BY 4.0 (https://esawebb.org/images/weic2518a/).

Preview locally
    python -m http.server 8000
then open http://localhost:8000
