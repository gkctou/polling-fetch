# PollingFetch 

[繁體中文](README.zh-TW.md) | [日本語](README.ja.md)

Ever wished the native Fetch API could handle long-running tasks like a pro? Say hello to PollingFetch! 

This tiny but mighty library brings task management superpowers to your favorite Fetch API, making those lengthy server operations a breeze to handle. No more complex state management - just clean, elegant task handling! 

## Why PollingFetch? 

- **Task-First Design**: Built with real-world server operations in mind
- **Native Fetch Feel**: Works exactly like the Fetch API you know and love
- **Type-Safe**: Full TypeScript support to catch those pesky bugs
- **Battle-Tested**: Rock-solid reliability with comprehensive test coverage
- **Zero Dependencies**: Tiny footprint, huge impact

## Installation 

```bash
npm install polling-fetch
```

## Quick Start 

```typescript
import { PollingFetch } from 'polling-fetch';

// Kick off a long-running task
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // Check every 2 seconds
    onInitRespond: async (context) => {
      // Handle initial response
      const { status } = context.initResponse;
      if (status === 400) {
        throw new Error('Invalid request');
      }
      if (status === 200) {
        return context.initResponse; // Done immediately
      }
      return undefined; // Continue to polling
    },
    onPolling: async (context) => {
      // Get our taskId from the initial response
      const { taskId } = await context.initResponse.clone().json();
      
      // Check how it's going
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      if (status.completed) {
        // Task's done! Get the final result
        const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
        return resultResponse;
      }
      
      // Not done yet, keep polling
      return undefined;
    }
  }
});

const result = await response.json();
```

## Real-World Magic 

### Task Progress with Style

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    interval: 1000,
    // Add some auth magic before sending
    onRequest: async (requestInput) => ({
      ...requestInput,
      headers: {
        ...requestInput.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // Handle initial response
    onInitRespond: async (context) => {
      const { status } = context.initResponse;
      if (!context.initResponse.ok) {
        throw new Error(`Failed to start task: ${status}`);
      }
      // Store task info in context for later use
      const { taskId } = await context.initResponse.clone().json();
      context.taskId = taskId;
      return undefined; // Continue to polling
    },

    // Keep an eye on the progress
    onPolling: async (context) => {
      // Use taskId from context
      const statusResponse = await fetch(`/api/tasks/${context.taskId}/status`);
      const status = await statusResponse.json();
      
      // Keep the user in the loop
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // Success! Fetch the goodies
          const resultResponse = await fetch(`/api/tasks/${context.taskId}/result`);
          return resultResponse;
          
        case 'failed':
          throw new Error(status.error);
          
        case 'processing':
        case 'pending':
          return undefined; // Keep watching
          
        default:
          throw new Error(`Unexpected state: ${status.state}`);
      }
    }
  }
});

const result = await response.json();
```

### Graceful Task Cancellation

```typescript
const controller = new AbortController();

try {
  const response = await PollingFetch('/api/tasks/heavy-computation', {
    signal: controller.signal,
    polling: {
      onPolling: async (context) => {
        const { taskId } = await context.initResponse.clone().json();
        
        const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
        const status = await statusResponse.json();
        
        if (status.completed) {
          const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
          return resultResponse;
        }
      },
      onAbort: async (context) => {
        // Clean up our task on the server
        const { taskId } = await context.initResponse.clone().json();
        await fetch(`/api/tasks/${taskId}/cancel`, {
          method: 'POST'
        });
      }
    }
  });
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('Task was cancelled');
  }
}

// Need to stop? No problem!
controller.abort();
```

### Create Your Perfect Setup

```typescript
const taskFetch = PollingFetch.create({
  interval: 2000,
  onPolling: async (context) => {
    const { taskId } = await context.initResponse.clone().json();
    const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
    const status = await statusResponse.json();
    
    if (status.completed) {
      const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
      return resultResponse;
    }
  }
});
```

## API Reference 

### PollingConfig

The configuration object for polling behavior:

```typescript
interface PollingConfig {
  // Polling interval in milliseconds (default: 1000)
  interval?: number;
  
  // Called before the initial request
  onRequest?: (fetchInit: RequestInput) => Promise<RequestInput> | RequestInput;
  
  // Called after the initial response
  onInitRespond?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // Called for each polling attempt
  onPolling?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // Called when the request is aborted
  onAbort?: (context: IContext) => Promise<void> | void;
}
```

### Context Object

The context object passed to polling callbacks:

```typescript
interface IContext {
  // The initial request input
  requestInput: RequestInput;
  
  // The initial response
  initResponse: Response;
  
  // The latest polling response
  pollingResponse?: Response;
  
  // Number of polling attempts
  retryCount: number;
  
  // Timestamp when polling started
  startTime: number;
  
  // Current polling configuration
  config: PollingConfig;
}
```

## License

MIT  [Codeium](https://codeium.com)