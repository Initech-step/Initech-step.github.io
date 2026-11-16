/* Raw WebGL starfield: one VBO, one drawArrays(POINTS), additive blending.
   The camera pushes toward a vanishing point (the Pismis 24 cluster).
   Draws only when asked; no free-running loop. Absent WebGL = the plate alone, still complete. */
(function () {
  "use strict";

  var VS = [
    "attribute vec3 a_pos; attribute vec3 a_col; attribute vec2 a_tw;",
    "uniform float u_cam, u_time, u_dpr, u_max, u_aspect, u_gain;",
    "uniform vec2 u_vp;",
    "varying vec3 v_col; varying float v_a;",
    "void main(){",
    "  float d = mod(a_pos.z - u_cam, 38.0) + 0.7;",
    "  vec2 p = a_pos.xy / d; p.x /= u_aspect;",
    "  gl_Position = vec4(p + u_vp, 0.0, 1.0);",
    "  float s = 22.0 / d * u_dpr;",
    "  gl_PointSize = clamp(s, 1.0, u_max);",
    "  float fade = smoothstep(38.7, 26.0, d) * smoothstep(0.7, 2.2, d);",
    "  float tw = 0.72 + 0.28 * sin(u_time * a_tw.y + a_tw.x);",
    "  float small = s < 1.6 ? 0.55 : 1.0;",
    "  v_a = fade * tw * small * u_gain;",
    "  v_col = a_col;",
    "}"
  ].join("\n");
  var FS = [
    "precision mediump float;",
    "varying vec3 v_col; varying float v_a;",
    "void main(){",
    "  vec2 c = gl_PointCoord - 0.5; float r = dot(c, c) * 4.0;",
    "  if (r > 1.0) discard;",
    "  float a = exp(-r * 4.5) * v_a;",
    "  gl_FragColor = vec4(v_col * a, a);",
    "}"
  ].join("\n");

  /* approximate blackbody colours, 2,500K to 30,000K */
  function tempColor(t) {
    var stops = [[2500, [1.0, .62, .38]], [4000, [1.0, .8, .62]], [5800, [1.0, .95, .88]], [7500, [.92, .94, 1.0]], [12000, [.74, .82, 1.0]], [30000, [.62, .72, 1.0]]];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k];
      }
    }
    return stops[stops.length - 1][1];
  }

  function create(canvas, count, onRestore) {
    var gl = null;
    try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: "low-power" }); } catch (e) { gl = null; }
    if (!gl) return null;

    var prog, buf, loc = {}, maxPt = 64, lost = false, N = count || 1400;

    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function build() {
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      ["a_pos", "a_col", "a_tw"].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
      ["u_cam", "u_time", "u_dpr", "u_max", "u_aspect", "u_vp", "u_gain"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

      var r = window.INIT ? window.INIT.rng(2518) : Math.random;
      var data = new Float32Array(N * 8);
      for (var i = 0; i < N; i++) {
        var ang = r() * Math.PI * 2, rad = .12 + Math.pow(r(), .7) * 2.6;  /* keep the axis clear so stars stream, not sit */
        var temp = r() < .12 ? 2600 + r() * 1800 : (r() < .7 ? 5200 + r() * 2600 : 8000 + r() * 16000);
        var col = tempColor(temp), bright = .55 + r() * .45;
        data.set([Math.cos(ang) * rad, Math.sin(ang) * rad * .8, r() * 38, col[0] * bright, col[1] * bright, col[2] * bright, r() * 6.28, .6 + r() * 1.6], i * 8);
      }
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var F = 4 * 8;
      gl.enableVertexAttribArray(loc.a_pos); gl.vertexAttribPointer(loc.a_pos, 3, gl.FLOAT, false, F, 0);
      gl.enableVertexAttribArray(loc.a_col); gl.vertexAttribPointer(loc.a_col, 3, gl.FLOAT, false, F, 12);
      gl.enableVertexAttribArray(loc.a_tw); gl.vertexAttribPointer(loc.a_tw, 2, gl.FLOAT, false, F, 24);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      var range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      maxPt = Math.min(range ? range[1] : 64, 40);
    }

    try { build(); } catch (e) { return null; }

    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); lost = true; });
    canvas.addEventListener("webglcontextrestored", function () {
      try { build(); lost = false; gl.viewport(0, 0, W, H); if (onRestore) onRestore(); } catch (e) { lost = true; }
    });

    var W = 0, H = 0, dpr = 1;
    return {
      resize: function (w, h) {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.round(w * dpr); H = Math.round(h * dpr);
        canvas.width = W; canvas.height = H;
        gl.viewport(0, 0, W, H);
      },
      /* cam: distance travelled; vp: vanishing point in clip space; gain: overall brightness */
      draw: function (cam, time, vpx, vpy, gain) {
        if (lost || !W) return;
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(loc.u_cam, cam);
        gl.uniform1f(loc.u_time, time);
        gl.uniform1f(loc.u_dpr, dpr);
        gl.uniform1f(loc.u_max, maxPt);
        gl.uniform1f(loc.u_aspect, W / H);
        gl.uniform2f(loc.u_vp, vpx, vpy);
        gl.uniform1f(loc.u_gain, gain);
        gl.drawArrays(gl.POINTS, 0, N);
      },
      clear: function () { if (!lost) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } }
    };
  }

  window.INITStars = { create: create };
})();
