import { PollingFetch, createPollingFetch } from '../src';

interface TestResponse {
  status: string;
  data?: string;
}

describe('PollingFetch', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should work as normal fetch when no polling config', async () => {
    const mockResponse = { data: 'test' };
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse)))
    ) as jest.Mock;

    const response = await PollingFetch('/test');
    const result = await response.json();

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/test', expect.any(Object));
  });

  it('should execute onRequest and return initial response when no onPolling', async () => {
    const mockResponse = { data: 'test' };
    const onRequest = jest.fn((input) => input);
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse)))
    ) as jest.Mock;

    const response = await PollingFetch('/test', {
      polling: {
        onRequest
      }
    });
    const result = await response.json();

    expect(result).toEqual(mockResponse);
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle onInitRespond correctly', async () => {
    const mockResponse = { status: 'pending' };
    const finalResponse = { status: 'done' };
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse)))
    ) as jest.Mock;

    const response = await PollingFetch('/test', {
      polling: {
        onInitRespond: async () => finalResponse
      }
    });
    const result = await response.json();

    expect(result).toEqual(finalResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle non-Response polling result', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const response = await PollingFetch('/test', {
      polling: {
        onPolling: async () => ({ status: 'completed', data: 'test' })
      }
    });
    const result = await response.json();

    expect(result).toEqual({ status: 'completed', data: 'test' });
  });

  it('should handle abort correctly', async () => {
    const controller = new AbortController();
    const onAbort = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const promise = PollingFetch('/test', {
      signal: controller.signal,
      polling: {
        interval: 10,
        onPolling: async () => undefined,
        onAbort
      }
    });

    controller.abort();

    await expect(promise).rejects.toThrow('The user aborted a request.');
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('should handle pre-aborted signal', async () => {
    const controller = new AbortController();
    const onAbort = jest.fn();
    controller.abort();

    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    await expect(PollingFetch('/test', {
      signal: controller.signal,
      polling: {
        onPolling: async () => undefined,
        onAbort
      }
    })).rejects.toThrow('The user aborted a request.');

    expect(onAbort).not.toHaveBeenCalled();
  });

  it('should propagate onRequest errors', async () => {
    const error = new Error('onRequest error');
    const onRequest = jest.fn().mockRejectedValue(error);

    await expect(
      PollingFetch('/test', {
        polling: {
          onRequest
        }
      })
    ).rejects.toThrow(error);
  });

  it('should propagate onPolling errors', async () => {
    const error = new Error('onPolling error');
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    await expect(
      PollingFetch('/test', {
        polling: {
          onPolling: async () => {
            throw error;
          }
        }
      })
    ).rejects.toThrow(error);
  });

  it('should propagate onAbort errors', async () => {
    const error = new Error('onAbort error');
    const controller = new AbortController();
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
    ) as jest.Mock;

    const promise = PollingFetch('/test', {
      signal: controller.signal,
      polling: {
        interval: 10,
        onPolling: async () => undefined,
        onAbort: async () => {
          throw error;
        }
      }
    });

    controller.abort();

    await expect(promise).rejects.toThrow(error);
  });

  describe('createPollingFetch', () => {
    it('should create instance with custom interval', async () => {
      const customFetch = createPollingFetch({
        interval: 100
      });

      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
      ) as jest.Mock;

      const promise = customFetch('/test', {
        polling: {
          onPolling: async () => ({ status: 'completed' })
        }
      });

      const response = await promise;
      const result = await response.json();

      expect(result).toEqual({ status: 'completed' });
    });

    it('should override default config with request config', async () => {
      const customFetch = createPollingFetch({
        interval: 500
      });

      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'pending' })))
      ) as jest.Mock;

      const promise = customFetch('/test', {
        polling: {
          interval: 100,
          onPolling: async () => ({ status: 'completed' })
        }
      });

      const response = await promise;
      const result = await response.json();

      expect(result).toEqual({ status: 'completed' });
    });
  });
});