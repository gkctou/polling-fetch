# PollingFetch 🚀

[English](README.md) | [日本語](README.ja.md)

想讓 Fetch API 輕鬆駕馭長時間執行的任務嗎？來認識一下 PollingFetch 吧！🎉

這個小小的函式庫為您帶來強大的任務管理能力，讓那些耗時的伺服器操作變得超級容易處理。不需要複雜的狀態管理 - 就是這麼簡單直接！

## 為什麼選擇 PollingFetch？🤔

- **以任務為核心**：專為實際的伺服器操作打造
- **原生 Fetch 風格**：跟您熟悉的 Fetch API 使用方式一模一樣
- **類型安全**：完整的 TypeScript 支援，錯誤早點抓
- **實戰考驗**：全面的測試覆蓋，超級可靠
- **零依賴**：輕量級封裝，強大功能

## 安裝超簡單 📦

```bash
npm install polling-fetch
```

## 快速開始 ✨

```typescript
import { PollingFetch } from 'polling-fetch';

// 開始一個長時間執行的任務
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // 每 2 秒檢查一次
    onPolling: async (response) => {
      // 從初始回應中取得 taskId
      const { taskId } = await response.clone().json();
      
      // 檢查任務狀態
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      if (status.completed) {
        // 任務完成！取得最終結果
        const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
        return resultResponse;
      }
      
      // 還沒完成，繼續等待
      return undefined;
    }
  }
});

const result = await response.json();
```

## 實戰範例 ✨

### 超棒的進度追蹤

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    // 發送前加點認證魔法
    onRequest: async (init) => ({
      ...init,
      headers: {
        ...init.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // 監控任務進度
    onPolling: async (response) => {
      const { taskId } = await response.clone().json();
      
      // 看看進度如何
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      // 讓使用者知道進度
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // 成功！取得結果
          const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
          return resultResponse;
          
        case 'failed':
          throw new Error(status.error);
          
        case 'processing':
        case 'pending':
          return undefined; // 繼續等待
          
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
        // 清理伺服器端的任務
        const { taskId } = await response.clone().json();
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

### 打造您的完美設定

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

## 超強功能 🌟

- **任務導向**：為現代任務管理模式量身打造
- **進度追蹤**：讓您的使用者掌握最新進度
- **智慧清理**：妥善處理兩端的資源清理
- **靈活 API**：適應您的任務管理風格
- **TypeScript 就緒**：完整的型別定義隨插即用

## API 精華

### PollingConfig

```typescript
interface PollingConfig {
  interval?: number;
  onRequest?: (fetchInit: RequestInit) => Promise<RequestInit> | RequestInit;
  onPolling?: (response: Response) => Promise<Response | undefined> | Response | undefined;
  onAbort?: (response: Response) => Promise<void> | void;
}
```

### 超實用的任務模式

1. **任務流程**：
   - 初始請求建立任務並給您 taskId
   - 用 taskId 追蹤進度
   - 完成時取得最終結果

2. **進度更新**：
   - 持續檢查狀態端點
   - 向使用者展示進度
   - 順暢處理所有任務狀態

3. **任務管理**：
   - 從初始請求開始
   - 透過狀態端點監控進度
   - 從專屬端點取得結果
   - 透過取消機制清理資源

## 您會愛上它的原因 ❤️

1. **任務處理天堂**：完美匹配現代 API
2. **生產環境就緒**：經過實戰考驗，類型安全
3. **框架通吃**：哪裡有 fetch 就能用
4. **開發者至上**：為您的開發體驗量身打造

## 授權條款

MIT