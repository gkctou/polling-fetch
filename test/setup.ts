// 引入 whatwg-fetch 來提供 fetch polyfill
require('whatwg-fetch');

// 確保全局有 AbortController
if (typeof global.AbortController === 'undefined') {
  const AbortController = require('abort-controller');
  global.AbortController = AbortController;
  global.AbortSignal = AbortController.AbortSignal;
}

// 清理所有計時器
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
