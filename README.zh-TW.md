# PollingFetch 

[English](README.md) | [日本語](README.ja.md)

想讓原生的 Fetch API 能夠更好地處理長時間運行的任務嗎？來認識 PollingFetch 吧！

這個輕量但強大的函式庫為您喜愛的 Fetch API 帶來任務管理的超能力，讓那些耗時的伺服器操作變得輕鬆自如。不再需要複雜的狀態管理 - 就是這麼簡潔優雅！

## 為什麼選擇 PollingFetch？

- **以任務為中心的設計**：專為實際的伺服器操作而設計
- **原生 Fetch 體驗**：用起來就像您熟悉的 Fetch API
- **類型安全**：完整的 TypeScript 支援，避免討厭的錯誤
- **實戰考驗**：透過全面的測試覆蓋確保可靠性
- **零依賴**：輕量的程式碼，巨大的影響力

## 安裝

```bash
npm install polling-fetch
```

## 快速開始

```typescript
import { PollingFetch } from 'polling-fetch';

// 啟動一個長時間運行的任務
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // 每2秒檢查一次
    onInitRespond: async (context) => {
      // 處理初始回應
      const { status } = context.initResponse;
      if (status === 400) {
        throw new Error('無效的請求');
      }
      if (status === 200) {
        return context.initResponse; // 立即完成
      }
      return undefined; // 繼續輪詢
    },
    onPolling: async (context) => {
      // 從初始回應中獲取 taskId
      const { taskId } = await context.initResponse.clone().json();
      
      // 檢查進度
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      if (status.completed) {
        // 任務完成！獲取最終結果
        const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
        return resultResponse;
      }
      
      // 尚未完成，繼續輪詢
      return undefined;
    }
  }
});

const result = await response.json();
```

## 實際應用範例

### 帶進度的任務處理

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    interval: 1000,
    // 在發送前添加認證
    onRequest: async (requestInput) => ({
      ...requestInput,
      headers: {
        ...requestInput.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // 處理初始回應
    onInitRespond: async (context) => {
      const { status } = context.initResponse;
      if (!context.initResponse.ok) {
        throw new Error(`啟動任務失敗：${status}`);
      }
      // 在上下文中儲存任務資訊以供後續使用
      const { taskId } = await context.initResponse.clone().json();
      context.taskId = taskId;
      return undefined; // 繼續輪詢
    },

    // 監控進度
    onPolling: async (context) => {
      // 使用上下文中的 taskId
      const statusResponse = await fetch(`/api/tasks/${context.taskId}/status`);
      const status = await statusResponse.json();
      
      // 保持使用者了解進度
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // 成功！獲取結果
          const resultResponse = await fetch(`/api/tasks/${context.taskId}/result`);
          return resultResponse;
          
        case 'failed':
          throw new Error(status.error);
          
        case 'processing':
        case 'pending':
          return undefined; // 繼續監控
          
        default:
          throw new Error(`意外的狀態：${status.state}`);
      }
    }
  }
});

const result = await response.json();
```

### 優雅的任務取消

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
        // 在伺服器端清理我們的任務
        const { taskId } = await context.initResponse.clone().json();
        await fetch(`/api/tasks/${taskId}/cancel`, {
          method: 'POST'
        });
      }
    }
  });
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('任務已取消');
  }
}

// 需要停止？沒問題！
controller.abort();
```

### 創建您的完美設定

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

## API 參考

### PollingConfig

輪詢行為的配置對象：

```typescript
interface PollingConfig {
  // 輪詢間隔（毫秒）（預設：1000）
  interval?: number;
  
  // 在初始請求前調用
  onRequest?: (fetchInit: RequestInput) => Promise<RequestInput> | RequestInput;
  
  // 在初始回應後調用
  onInitRespond?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // 在每次輪詢時調用
  onPolling?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // 在請求被中止時調用
  onAbort?: (context: IContext) => Promise<void> | void;
}
```

### Context 對象

傳遞給輪詢回調的上下文對象：

```typescript
interface IContext {
  // 初始請求輸入
  requestInput: RequestInput;
  
  // 初始回應
  initResponse: Response;
  
  // 最新的輪詢回應
  pollingResponse?: Response;
  
  // 輪詢嘗試次數
  retryCount: number;
  
  // 輪詢開始時間戳
  startTime: number;
  
  // 當前輪詢配置
  config: PollingConfig;
}
```

## 授權

MIT [Codeium](https://codeium.com)