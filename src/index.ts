type TimeoutId = ReturnType<typeof setTimeout>;
type RequestInput = RequestInit & { input: RequestInfo | URL };
interface PollingConfig {
  interval?: number;
  maxTimeout?: number;
  onRequest?: (fetchInit: RequestInput) => Promise<RequestInput> | RequestInput;
  onPolling?: (response: Response) => Promise<Response | undefined> | Response | undefined;
  onAbort?: (response: Response) => Promise<void> | void;
}

interface PollingRequestInit extends RequestInit {
  polling?: PollingConfig;
}

interface PollingFetchFunction {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  create: (config?: PollingConfig) => PollingFetchFunction;
}

function createPollingFetch(defaultConfig?: PollingConfig): PollingFetchFunction {
  const config: Required<Pick<PollingConfig, 'interval'>> & PollingConfig = {
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

    let initialResponse: Response | undefined;
    // let currentRequest: Promise<Response> | undefined;
    let currentTimeout: TimeoutId | undefined;

    const cleanup = () => {
      if (currentTimeout !== undefined) {
        clearTimeout(currentTimeout);
        currentTimeout = undefined;
      }
    };

    const handleAbort = async (): Promise<void> => {
      cleanup();

      if (mergedConfig.onAbort && initialResponse) {
        try {
          await mergedConfig.onAbort(initialResponse);
        } catch (error) {
          throw error; // Propagate errors from onAbort
        }
      }
    };

    try {
      if (init.signal) {
        init.signal.addEventListener('abort', () => {
          handleAbort().catch(error => {
            throw error; // Propagate errors from abort handling
          });
        });
      }

      const requestInput: RequestInput = { input, ...init };
      delete (requestInput as any).polling;
      if (mergedConfig.onRequest) {
        try {
          Object.assign(requestInput, await mergedConfig.onRequest(requestInput));
        } catch (error) {
          throw error; // Propagate errors from onRequest
        }
      }

      try {
        // currentRequest = fetch(input, requestInit);
        const { input: reqInput, ...reqInit } = requestInput;
        initialResponse = await fetch(reqInput, reqInit);;
      } catch (error) {
        throw error; // Propagate errors from fetch request
      }

      // If onPolling is not set, return initial response directly
      if (!mergedConfig.onPolling || !initialResponse.ok) {
        return initialResponse;
      }

      while (true) {
        if (init.signal?.aborted) {
          await handleAbort();
          const error = new Error('The user aborted a request.');
          error.name = 'AbortError';
          throw error;
        }

        try {
          const pollingResult = await mergedConfig.onPolling(initialResponse);
          if (pollingResult) {
            return pollingResult;
          }
        } catch (error) {
          throw error; // Propagate errors from onPolling
        }

        try {
          await new Promise<void>((resolve, reject) => {
            const tid = setTimeout(() => {
              resolve();
            }, mergedConfig.interval);
            currentTimeout = tid;

            if (init.signal) {
              init.signal.addEventListener('abort', () => {
                cleanup();
                reject(new Error('The user aborted a request.'));
              }, { once: true });
            }
          });
        } catch (error) {
          if (error instanceof Error && error.message === 'The user aborted a request.') {
            await handleAbort();
            throw error;
          }
          throw error;
        }

        // try {
        //   currentRequest = fetch(input, requestInit);
        //   initialResponse = await currentRequest;
        // } catch (error) {
        //   throw error; // Propagate errors from fetch request
        // }
      }
    } catch (error) {
      throw error; // Propagate all errors
    } finally {
      cleanup();
    }
  }) as PollingFetchFunction;

  pollingFetch.create = (newConfig?: PollingConfig) =>
    createPollingFetch({ ...config, ...newConfig });

  return pollingFetch;
}

// Create default instance
const PollingFetch = createPollingFetch();

export { PollingFetch, createPollingFetch };
export type {
  PollingFetchFunction,
  PollingConfig,
  PollingRequestInit
};
export default PollingFetch;
