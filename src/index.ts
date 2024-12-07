type TimeoutId = ReturnType<typeof setTimeout>;
type RequestInput = RequestInit & { input: RequestInfo | URL };

// 上下文接口
interface IContext {
  requestInput: RequestInput;
  initResponse: Response;
  pollingResponse?: Response;
  retryCount: number;
  startTime: number;
  config: PollingConfig;
  [key: string]: any;
}

// 完整配置接口
interface PollingConfig {
  interval?: number;
  onRequest?: (fetchInit: RequestInput) => Promise<RequestInput> | RequestInput;
  onPolling?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  onAbort?: (context: IContext) => Promise<void> | void;
  onInitRespond?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
}

interface PollingRequestInit extends RequestInit {
  polling?: PollingConfig;
}

interface PollingFetchFunction {
  (input: RequestInfo | URL, init?: PollingRequestInit): Promise<Response>;
  create: (config?: PollingConfig) => PollingFetchFunction;
}

function createPollingFetch(defaultConfig?: PollingConfig): PollingFetchFunction {
  const config: PollingConfig = {
    interval: 2000,
    ...defaultConfig
  };

  const pollingFetch = (async function (
    input: RequestInfo | URL,
    init?: PollingRequestInit
  ): Promise<Response> {
    // Handle standard fetch case
    if (!init?.polling) {
      const standardInit: RequestInit = { ...init };
      delete (standardInit as any).polling;
      return fetch(input, standardInit);
    }

    const mergedConfig = {
      ...config,
      ...init.polling
    };

    if (init.signal?.aborted) {
      const error = new Error('The user aborted a request.');
      error.name = 'AbortError';
      throw error;
    }

    let currentTimeout: TimeoutId | undefined;

    const requestInput: RequestInput = { input, ...init };
    delete (requestInput as any).polling;
    if (mergedConfig.onRequest) {
      try {
        Object.assign(requestInput, await mergedConfig.onRequest(requestInput));
      } catch (error) {
        throw error;
      }
    }

    const context: IContext = {
      requestInput,
      config: mergedConfig,
      retryCount: 0,
      startTime: Date.now()
    } as IContext;  // Will be fully initialized after initial fetch

    const cleanup = () => {
      if (currentTimeout !== undefined) {
        clearTimeout(currentTimeout);
        currentTimeout = undefined;
      }
    };

    const handleAbort = async (): Promise<void> => {
      cleanup();

      if (mergedConfig.onAbort && context.initResponse) {
        try {
          await mergedConfig.onAbort(context);
        } catch (error) {
          throw error;
        }
      }
    };

    try {
      if (init.signal) {
        init.signal.addEventListener('abort', () => {
          handleAbort().catch(error => {
            throw error;
          });
        });
      }

      try {
        const { input: reqInput, ...reqInit } = requestInput;
        const response = await fetch(reqInput, reqInit);
        context.initResponse = response;
        context.pollingResponse = response;
        
        if (mergedConfig.onInitRespond) {
          try {
            const initResult = await mergedConfig.onInitRespond(context);
            if (initResult) {
              if (initResult instanceof Response) {
                return initResult;
              } else {
                return new Response(JSON.stringify(initResult), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
          } catch (error) {
            throw error;
          }
        }
      } catch (error) {
        throw error;
      }

      if (!mergedConfig.onPolling) {
        return context.initResponse;
      }

      while (true) {
        if (init.signal?.aborted) {
          await handleAbort();
          const error = new Error('The user aborted a request.');
          error.name = 'AbortError';
          throw error;
        }

        try {
          const pollingResult = await mergedConfig.onPolling(context);
          if (pollingResult) {
            if (pollingResult instanceof Response) {
              context.pollingResponse = pollingResult;
              return pollingResult;
            } else {
              // Wrap non-Response result in a new Response
              const wrappedResponse = new Response(JSON.stringify(pollingResult), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
              context.pollingResponse = wrappedResponse;
              return wrappedResponse;
            }
          }
        } catch (error) {
          throw error;
        }

        // 等待下一次輪詢
        context.retryCount++;
        await new Promise((resolve) => {
          currentTimeout = setTimeout(resolve, mergedConfig.interval);
        });
      }
    } catch (error) {
      throw error;
    } finally {
      cleanup();
    }
  }) as PollingFetchFunction;

  pollingFetch.create = createPollingFetch;
  return pollingFetch;
}

// Create default instance
const PollingFetch = createPollingFetch();

export { PollingFetch, createPollingFetch };
