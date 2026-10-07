(function (global) {
  'use strict';

  function isOtpStepVisible(stepEl) {
    if (!stepEl) return false;
    const style = global.getComputedStyle ? global.getComputedStyle(stepEl) : null;
    return !!style && style.display !== 'none';
  }

  global.HVIDAuthUtils = { isOtpStepVisible };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isOtpStepVisible };
  }
})(typeof window !== 'undefined' ? window : globalThis);
