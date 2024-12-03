import { PollingFetch, PollingRequestInit } from '../src';

interface TestResponse {
  status: string;
  data?: string;
}

interface AbortError extends Error {
  name: string;
}

describe('PollingFetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should work as normal fetch when no polling config', async () => {
    const mockResponse = { data: 'test' };
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse)))
    ) as jest.Mock;

    const response = await PollingFetch('/test');
    const data = await response.json();

    expect(data).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should execute onRequest and return initial response when no onPolling', async () => {
    const mockResponse = { data: 'test' };
    const onRequestMock = jest.fn().mockReturnValue({ headers: { 'X-Test': 'test' } });
    
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse)))
    ) as jest.Mock;

    const response = await PollingFetch('/test', {
      polling: {
        onRequest: onRequestMock
      }
    } as PollingRequestInit);
    const data = await response.json();

    expect(data).toEqual(mockResponse);
    expect(onRequestMock).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should poll until condition is met', async () => {
    let callCount = 0;
    const mockResponses = [
      { status: 'pending' },
      { status: 'processing' },
      { status: 'completed' }
    ];

    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve(new Response(JSON.stringify(mockResponses[callCount++])));
    }) as jest.Mock;

    const pollingPromise = PollingFetch('/test', {
      polling: {
        interval: 1000,
        onPolling: async (response: Response) => {
          const data = await response.clone().json() as TestResponse;
          return data.status === 'completed' ? response : undefined;
        }
      }
    } as PollingRequestInit);

    await jest.runAllTimersAsync();
    
    const response = await pollingPromise;
    const result = await response.json();
    
    expect(result).toEqual({ status: 'completed' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('should handle abort correctly', async () => {
    const controller = new AbortController();
    let onAbortCalled = false;

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const pollingPromise = PollingFetch('/test', {
      signal: controller.signal,
      polling: {
        interval: 1000,
        onPolling: async (response: Response) => {
          await response.clone().json();
          return undefined;
        },
        onAbort: async () => {
          onAbortCalled = true;
        }
      }
    } as PollingRequestInit);

    // 先中止請求
    controller.abort();

    // 等待 Promise 被拒絕
    let error: Error | undefined;
    try {
      await pollingPromise;
    } catch (e) {
      if (e instanceof Error) {
        error = e;
      }
    }

    // 運行所有計時器
    await jest.runAllTimersAsync();

    // 驗證錯誤和 onAbort 被調用
    expect(error).toBeDefined();
    expect(error?.message).toBe('The user aborted a request.');
    expect(error?.name).toBe('AbortError');
    expect(onAbortCalled).toBe(true);
  });

  it('should propagate onRequest errors', async () => {
    const error = new Error('onRequest error');
    const onRequestMock = jest.fn().mockRejectedValue(error);

    const promise = PollingFetch('/test', {
      polling: {
        onRequest: onRequestMock
      }
    } as PollingRequestInit);

    await expect(promise).rejects.toThrow('onRequest error');
  });

  it('should propagate onPolling errors', async () => {
    const error = new Error('onPolling error');
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const promise = PollingFetch('/test', {
      polling: {
        interval: 1000,
        onPolling: async () => {
          throw error;
        }
      }
    } as PollingRequestInit);

    await expect(promise).rejects.toThrow('onPolling error');
  });

  it('should propagate onAbort errors', async () => {
    const error = new Error('onAbort error');
    const controller = new AbortController();

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const promise = PollingFetch('/test', {
      signal: controller.signal,
      polling: {
        interval: 1000,
        onPolling: async () => undefined,
        onAbort: async () => {
          throw error;
        }
      }
    } as PollingRequestInit);

    controller.abort();
    await expect(promise).rejects.toThrow('onAbort error');
  });
});
