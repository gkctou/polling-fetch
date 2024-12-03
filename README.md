# PollingFetch 🚀

[繁體中文](README.zh-TW.md) | [日本語](README.ja.md)

Ever wished the native Fetch API could handle long-running tasks like a pro? Say hello to PollingFetch! 🎉

This tiny but mighty library brings task management superpowers to your favorite Fetch API, making those lengthy server operations a breeze to handle. No more complex state management - just clean, elegant task handling! 

## Why PollingFetch? 🤔

- **Task-First Design**: Built with real-world server operations in mind
- **Native Fetch Feel**: Works exactly like the Fetch API you know and love
- **Type-Safe**: Full TypeScript support to catch those pesky bugs
- **Battle-Tested**: Rock-solid reliability with comprehensive test coverage
- **Zero Dependencies**: Tiny footprint, huge impact

## Installation 📦

```bash
npm install polling-fetch
```

## Quick Start ✨

```typescript
import { PollingFetch } from 'polling-fetch';

// Kick off a long-running task
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // Check every 2 seconds
    onPolling: async (response) => {
      // Get our taskId from the initial response
      const { taskId } = await response.clone().json();
      
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

## Real-World Magic ✨

### Task Progress with Style

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    // Add some auth magic before sending
    onRequest: async (init) => ({
      ...init,
      headers: {
        ...init.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // Keep an eye on the progress
    onPolling: async (response) => {
      const { taskId } = await response.clone().json();
      
      // How's it going?
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      // Keep the user in the loop
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // Success! Fetch the goodies
          const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
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
      onPolling: async (response) => {
        const { taskId } = await response.clone().json();
        
        const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
        const status = await statusResponse.json();
        
        if (status.completed) {
          const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
          return resultResponse;
        }
      },
      onAbort: async (response) => {
        // Clean up our task on the server
        const { taskId } = await response.clone().json();
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
  onPolling: async (response) => {
    const { taskId } = await response.clone().json();
    const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
    const status = await statusResponse.json();
    
    if (status.completed) {
      const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
      return resultResponse;
    }
  }
});
```

## Awesome Features 🌟

- **Task-Focused**: Built for modern task management patterns
- **Progress Tracking**: Keep your users in the loop
- **Smart Cleanup**: Proper cleanup on both ends
- **Flexible API**: Adapts to your task management style
- **TypeScript Ready**: Complete type definitions included

## API Goodness

### PollingConfig

```typescript
interface PollingConfig {
  interval?: number;
  onRequest?: (fetchInit: RequestInit) => Promise<RequestInit> | RequestInit;
  onPolling?: (response: Response) => Promise<Response | undefined> | Response | undefined;
  onAbort?: (response: Response) => Promise<void> | void;
}
```

### Task Patterns that Rock

1. **Task Flow**:
   - Initial request creates task & gives you a taskId
   - Use taskId to check progress
   - Grab the final result when ready

2. **Progress Updates**:
   - Keep checking that status endpoint
   - Show progress to your users
   - Handle all task states smoothly

3. **Task Management**:
   - Start with the initial request
   - Watch progress via status endpoint
   - Get results from the dedicated endpoint
   - Clean up with cancellation

## Why You'll Love It ❤️

1. **Task Pattern Heaven**: Perfect for modern APIs
2. **Production Ready**: Battle-tested and type-safe
3. **Framework Happy**: Works anywhere fetch does
4. **Developer Joy**: Built with your happiness in mind

## License

MIT