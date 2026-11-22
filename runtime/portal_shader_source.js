(function (root, factory) {
  var value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.PortalShaderSource = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var vertex = [
    'attribute vec2 aPosition;',
    'void main() {',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}',
  ].join('\n');

  // 穿越门效果：fragcoord.xyz "Star Nest" 风格分形（ctrzdrsa）。
  // 适配 WebGL1 / GLSL ES 1.00：
  //  - 使用管线既有 uniform 名 iResolution / iTime / uExposure，避免改动 portal_effect.js
  //  - 自实现 tanh4（ES1.00 无内置 tanh，并对输入做安全 clamp 防止溢出产生 NaN）
  var fragment = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 iResolution;',
    'uniform float iTime;',
    'uniform float uExposure;',
    '',
    // 稳定的 tanh：把输入钳制在 [-12,12]，避免 exp(大数) 溢出成 inf/NaN
    'vec4 tanh4(vec4 x) {',
    '  vec4 cx = clamp(x, -12.0, 12.0);',
    '  vec4 e = exp(2.0 * cx);',
    '  return (e - 1.0) / (e + 1.0);',
    '}',
    '',
    'void main() {',
    '  vec4 O = vec4(0.0);',
    '  vec2 I = gl_FragCoord.xy;',
    '  float t = 0.0;',
    '  float v = 0.0;',
    '  float f = 0.0;',
    '  float T = iTime;',
    '',
    '  for (int i = 0; i < 50; i++) {',           // Raymarching loop
    '    vec3 P = iResolution.xyy;',
    '    vec3 p = t * normalize(vec3(I + I - P.xy, P.y / max(t, 0.001)));',
    '    p.z += T;',                               // Move forward
    '    float s = 1.0;',
    '    for (int si = 0; si < 4; si++) {',        // 随机把立方体细分为 8 个小立方体
    '      P = ceil(p);',
    '      v = fract(dot(P, sin(P.zxy)));',        // 伪随机数；约 30% 概率退出循环
    '      if (v > 0.7) { f = v; break; }',
    '      p *= 2.0;',
    '      s *= 2.0;',
    '    }',
    '    p = abs(fract(p) - 0.5);',
    '    v = abs(max(max(p.x, p.y), p.z) - 0.3 / s) + 0.01;', // 到立方体表面的密度；细分越多尺寸越小
    '    O += exp(sin(ceil(f * 9.0 + T) + vec4(0.0, 2.0, 4.0, 0.0))) / v;', // 颜色由最后的伪随机数决定，每个立方体一个独特色调
    '    t += v * 0.3;',
    '  }',
    '  O = tanh4(O / 700.0);',                     // Tone mapping
    '  O *= O * O;',
    '  O *= clamp(uExposure, 0.1, 3.0);',
    '  gl_FragColor = O;',
    '}',
  ].join('\n');

  return {
    vertex: vertex,
    fragment: fragment
  };
});
