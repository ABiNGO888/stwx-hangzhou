(function (root, factory) {
  var value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.PortalEffectConfig = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    version: '5.2',

    // 正式游戏仍由 unlock_config.js 控制穿越时长；此处只控制独立预览循环。
    previewDuration: 6.0,
    previewWhiteDuration: 1.0,

    // 微信小游戏内使用较低离屏分辨率，再放大到主画布，降低真机负载。
    renderWidth: 240,
    renderHeight: 426,

    // 画面参数。浏览器预览工具可实时调整并导出此文件。
    brightness: 1.20,
    saturation: 0.82,
    exposure: 0.92,
    energyStrength: 0.58,
    warmTint: 0.18,
    whiteMix: 0.12,
    portalRadius: 3.35,
    cameraSpeed: 0.28,
    distortion: 1.08,
    glowStrength: 0.72,
    edgeShade: 0.10,

    // 覆盖层参数。
    flashStart: 0.84,
    flashStrength: 0.55,
    showTransitText: true,

    // auto：优先 WebGL，失败时自动回退 Canvas；也可强制 webgl / canvas。
    mode: 'auto'
  };
});
