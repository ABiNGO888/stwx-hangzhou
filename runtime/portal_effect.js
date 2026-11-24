(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./portal_effect_config'), require('./portal_shader_source'));
  } else {
    root.PortalEffect = factory(root.PortalEffectConfig, root.PortalShaderSource);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (defaultConfig, shaderSource) {
  'use strict';

  defaultConfig = defaultConfig || {};
  shaderSource = shaderSource || { vertex: '', fragment: '' };

  var runtime = null;
  var disabled = false;
  var lastError = '';
  var lastMode = 'none';

  function number(value, fallback, min, max) {
    var n = Number(value);
    if (!isFinite(n)) n = fallback;
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    return n;
  }

  function mergeConfig(overrides) {
    var out = {};
    var key;
    for (key in defaultConfig) if (Object.prototype.hasOwnProperty.call(defaultConfig, key)) out[key] = defaultConfig[key];
    overrides = overrides || {};
    for (key in overrides) if (Object.prototype.hasOwnProperty.call(overrides, key)) out[key] = overrides[key];
    return out;
  }

  function createCanvas() {
    if (typeof wx !== 'undefined' && wx.createCanvas) return wx.createCanvas();
    if (typeof document !== 'undefined' && document.createElement) return document.createElement('canvas');
    return null;
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var message = gl.getShaderInfoLog(shader) || 'unknown shader compile error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createRuntime(config) {
    var canvas = createCanvas();
    if (!canvas) throw new Error('offscreen canvas unavailable');
    canvas.width = Math.round(number(config.renderWidth, 240, 96, 720));
    canvas.height = Math.round(number(config.renderHeight, 426, 160, 1280));

    var options = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false
    };
    var gl = canvas.getContext && (canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options));
    if (!gl) throw new Error('WebGL context unavailable');

    var vertexShader = compile(gl, gl.VERTEX_SHADER, shaderSource.vertex);
    var fragmentShader = compile(gl, gl.FRAGMENT_SHADER, shaderSource.fragment);
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var linkMessage = gl.getProgramInfoLog(program) || 'unknown shader link error';
      gl.deleteProgram(program);
      throw new Error(linkMessage);
    }

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    return {
      canvas: canvas,
      gl: gl,
      program: program,
      buffer: buffer,
      width: canvas.width,
      height: canvas.height,
      locations: {
        position: gl.getAttribLocation(program, 'aPosition'),
        resolution: gl.getUniformLocation(program, 'iResolution'),
        time: gl.getUniformLocation(program, 'iTime'),
        brightness: gl.getUniformLocation(program, 'uBrightness'),
        saturation: gl.getUniformLocation(program, 'uSaturation'),
        portalRadius: gl.getUniformLocation(program, 'uPortalRadius'),
        cameraSpeed: gl.getUniformLocation(program, 'uCameraSpeed'),
        distortion: gl.getUniformLocation(program, 'uDistortion'),
        glowStrength: gl.getUniformLocation(program, 'uGlowStrength'),
        edgeShade: gl.getUniformLocation(program, 'uEdgeShade'),
        exposure: gl.getUniformLocation(program, 'uExposure'),
        energyStrength: gl.getUniformLocation(program, 'uEnergyStrength'),
        warmTint: gl.getUniformLocation(program, 'uWarmTint'),
        whiteMix: gl.getUniformLocation(program, 'uWhiteMix')
      }
    };
  }

  function ensureRuntime(config) {
    var width = Math.round(number(config.renderWidth, 240, 96, 720));
    var height = Math.round(number(config.renderHeight, 426, 160, 1280));
    if (runtime && runtime.width === width && runtime.height === height) return runtime;
    reset();
    if (disabled) return null;
    try {
      runtime = createRuntime(config);
      lastError = '';
    } catch (error) {
      runtime = null;
      disabled = true;
      lastError = String(error && error.message ? error.message : error);
    }
    return runtime;
  }

  function uniform1f(gl, location, value) {
    if (location !== null && location !== undefined) gl.uniform1f(location, value);
  }

  function renderWebGL(targetContext, time, width, height, config) {
    var active = ensureRuntime(config);
    if (!active) return false;
    try {
      var gl = active.gl;
      if (gl.isContextLost && gl.isContextLost()) {
        runtime = null;
        disabled = false;
        lastError = 'WebGL context lost';
        return false;
      }
      gl.viewport(0, 0, active.canvas.width, active.canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(active.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, active.buffer);
      gl.enableVertexAttribArray(active.locations.position);
      gl.vertexAttribPointer(active.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(active.locations.resolution, active.canvas.width, active.canvas.height);
      uniform1f(gl, active.locations.time, Math.max(0.001, Number(time) || 0.001));
      uniform1f(gl, active.locations.brightness, number(config.brightness, 1.78, 0.1, 6));
      uniform1f(gl, active.locations.saturation, number(config.saturation, 1.18, 0, 3));
      uniform1f(gl, active.locations.portalRadius, number(config.portalRadius, 3.35, 0.5, 8));
      uniform1f(gl, active.locations.cameraSpeed, number(config.cameraSpeed, 0.28, 0, 2));
      uniform1f(gl, active.locations.distortion, number(config.distortion, 1.08, 0, 3));
      uniform1f(gl, active.locations.glowStrength, number(config.glowStrength, 1.36, 0, 5));
      uniform1f(gl, active.locations.edgeShade, number(config.edgeShade, 0.10, 0, 1));
       uniform1f(gl, active.locations.exposure, number(config.exposure, 0.92, 0, 3));
       uniform1f(gl, active.locations.energyStrength, number(config.energyStrength, 0.58, 0, 3));
       uniform1f(gl, active.locations.warmTint, number(config.warmTint, 0.18, 0, 1));
       uniform1f(gl, active.locations.whiteMix, number(config.whiteMix, 0.12, 0, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();

      targetContext.save();
      targetContext.globalAlpha = 1;
      targetContext.globalCompositeOperation = 'source-over';
      targetContext.imageSmoothingEnabled = true;
      targetContext.drawImage(active.canvas, 0, 0, width, height);
      targetContext.restore();
      lastMode = 'webgl';
      lastError = '';
      return true;
    } catch (error) {
      runtime = null;
      disabled = true;
      lastError = String(error && error.message ? error.message : error);
      return false;
    }
  }

  function renderCanvas(targetContext, time, progress, width, height, config) {
    var brightness = number(config.brightness, 1.78, 0.1, 6);
    var saturation = number(config.saturation, 1.18, 0, 3);
    var distortion = number(config.distortion, 1.08, 0, 3);
    var glowStrength = number(config.glowStrength, 1.36, 0, 5);
    var portalRadius = number(config.portalRadius, 3.35, 0.5, 8);
    var cx = width * 0.5 + Math.sin(time * 5.7) * 11 * distortion;
    var cy = height * 0.46 + Math.cos(time * 4.2) * 8 * distortion;
    var maxR = Math.hypot(width, height) * 0.72;
    var radiusScale = portalRadius / 3.35;

    targetContext.save();
    var bg = targetContext.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    bg.addColorStop(0, '#321b78');
    bg.addColorStop(0.25, '#160b58');
    bg.addColorStop(0.60, '#092454');
    bg.addColorStop(1, '#020817');
    targetContext.fillStyle = bg;
    targetContext.fillRect(0, 0, width, height);
    targetContext.globalCompositeOperation = 'lighter';

    var rayCount = 18;
    for (var ray = 0; ray < rayCount; ray++) {
      var rayAngle = ray / rayCount * Math.PI * 2 + time * (ray % 2 ? 0.52 : -0.38) * number(config.cameraSpeed, 0.28, 0, 2) / 0.28;
      var wave = 0.70 + 0.30 * Math.sin(time * 6.2 + ray * 1.73);
      var rayLen = maxR * (0.86 + wave * 0.18);
      var rayX = cx + Math.cos(rayAngle) * rayLen;
      var rayY = cy + Math.sin(rayAngle) * rayLen;
      var rayGrad = targetContext.createLinearGradient(cx, cy, rayX, rayY);
      var rayHue = (ray * 31 + time * 190 * saturation) % 360;
      rayGrad.addColorStop(0, 'hsla(' + rayHue + ',100%,82%,0)');
      rayGrad.addColorStop(0.28, 'hsla(' + rayHue + ',100%,72%,' + (0.11 * brightness) + ')');
      rayGrad.addColorStop(1, 'hsla(' + ((rayHue + 70) % 360) + ',100%,67%,' + Math.min(0.72, 0.35 * brightness) + ')');
      targetContext.strokeStyle = rayGrad;
      targetContext.lineWidth = 2 + wave * 8 * distortion;
      targetContext.beginPath();
      targetContext.moveTo(cx, cy);
      targetContext.quadraticCurveTo(cx + Math.cos(rayAngle + 0.30) * rayLen * 0.46, cy + Math.sin(rayAngle + 0.30) * rayLen * 0.46, rayX, rayY);
      targetContext.stroke();
    }

    for (var ringIndex = 0; ringIndex < 28; ringIndex++) {
      var z = (ringIndex / 28 + progress * 4.6) % 1;
      var eased = Math.pow(z, 2.02);
      var ringRadius = (13 + eased * maxR) * radiusScale;
      var ringAlpha = Math.sin(Math.PI * z) * (0.26 + z * 0.78) * Math.min(1.6, brightness * 0.72);
      var hue = (ringIndex * 27 + time * 240 * saturation) % 360;
      var wobble = Math.sin(ringIndex * 1.83 + time * 7.5) * 0.18 * distortion;
      targetContext.save();
      targetContext.translate(cx, cy);
      targetContext.rotate(time * (ringIndex % 2 ? 0.78 : -0.63) + ringIndex * 0.19);
      targetContext.scale(1, 0.64 + wobble * 0.12);
      targetContext.strokeStyle = 'hsla(' + hue + ',100%,' + (62 + z * 25) + '%,' + ringAlpha + ')';
      targetContext.lineWidth = 1.6 + z * 10 * distortion;
      targetContext.shadowColor = 'hsla(' + hue + ',100%,70%,.88)';
      targetContext.shadowBlur = ringIndex % 3 === 0 ? (7 + z * 15) * glowStrength : 0;
      targetContext.beginPath();
      targetContext.arc(0, 0, ringRadius, ringIndex % 3 === 0 ? 0.22 : 0, Math.PI * 2 - (ringIndex % 4 === 0 ? 0.38 : 0));
      targetContext.stroke();
      targetContext.restore();
    }

    targetContext.shadowBlur = 0;
    for (var star = 0; star < 42; star++) {
      var seed = Math.abs(Math.sin((star + 1) * 12.9898) * 43758.5453) % 1;
      var starZ = (seed + progress * (3.4 + (star % 5) * 0.19)) % 1;
      var starAngle = star * 2.399963 + Math.sin(star * 0.7) * 0.28;
      var starRadius = 10 + Math.pow(starZ, 2.3) * maxR;
      var streak = 20 + starZ * 100 * distortion;
      var sx = cx + Math.cos(starAngle) * starRadius;
      var sy = cy + Math.sin(starAngle) * starRadius;
      var ex = cx + Math.cos(starAngle) * (starRadius + streak);
      var ey = cy + Math.sin(starAngle) * (starRadius + streak);
      targetContext.strokeStyle = 'hsla(' + ((star * 43 + time * 260 * saturation) % 360) + ',100%,82%,' + Math.min(1, (0.20 + starZ * 0.80) * brightness) + ')';
      targetContext.lineWidth = 0.9 + starZ * 4.2;
      targetContext.beginPath();
      targetContext.moveTo(sx, sy);
      targetContext.lineTo(ex, ey);
      targetContext.stroke();
    }

    var coreRadius = 190 * radiusScale;
    var core = targetContext.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.08, 'rgba(190,253,255,.99)');
    core.addColorStop(0.28, 'rgba(105,183,255,.88)');
    core.addColorStop(0.52, 'rgba(202,82,255,.62)');
    core.addColorStop(0.76, 'rgba(255,62,178,.30)');
    core.addColorStop(1, 'rgba(13,2,54,0)');
    targetContext.globalAlpha = Math.min(1, 0.72 + brightness * 0.18);
    targetContext.fillStyle = core;
    targetContext.beginPath();
    targetContext.arc(cx, cy, coreRadius + Math.sin(time * 9) * 13 * distortion, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
    lastMode = 'canvas';
    return true;
  }

  function render(targetContext, options) {
    options = options || {};
    if (!targetContext) return { ok: false, mode: 'none', error: '2D target context unavailable' };
    var config = mergeConfig(options.config);
    var width = Math.max(1, Number(options.width) || (targetContext.canvas && targetContext.canvas.width) || 1);
    var height = Math.max(1, Number(options.height) || (targetContext.canvas && targetContext.canvas.height) || 1);
    var time = Math.max(0, Number(options.time) || 0);
    var duration = Math.max(0.1, Number(options.duration) || number(config.previewDuration, 6, 0.1, 60));
    var progress = Math.max(0, Math.min(1, Number(options.progress) || time / duration));
    var mode = String(options.mode || config.mode || 'auto').toLowerCase();
    var ok = false;

    if (mode !== 'canvas') ok = renderWebGL(targetContext, time, width, height, config);
    if (!ok && mode !== 'webgl') ok = renderCanvas(targetContext, time, progress, width, height, config);
    if (!ok && mode === 'webgl') lastMode = 'webgl-error';
    return { ok: ok, mode: lastMode, error: lastError, config: config };
  }

  function reset() {
    if (runtime && runtime.gl) {
      try {
        runtime.gl.deleteBuffer(runtime.buffer);
        runtime.gl.deleteProgram(runtime.program);
      } catch (ignore) {}
    }
    runtime = null;
    disabled = false;
    lastError = '';
    lastMode = 'none';
  }

  function getStatus() {
    return { mode: lastMode, disabled: disabled, error: lastError };
  }

  return {
    render: render,
    reset: reset,
    getStatus: getStatus,
    config: defaultConfig,
    shaderSource: shaderSource
  };
});
