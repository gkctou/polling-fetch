# PollingFetch 

[English](README.md) | [繁體中文](README.zh-TW.md)

Fetch APIで長時間実行タスクを簡単に扱えたらいいと思いませんか？PollingFetchの登場です！

このコンパクトながらパワフルなライブラリは、お馴染みのFetch APIにタスク管理機能を追加し、時間のかかるサーバー処理を簡単に扱えるようにします。複雑な状態管理は必要ありません - シンプルでエレガントな実装を実現します！

## なぜPollingFetchなのか？

- **タスク中心の設計**：実際のサーバー処理を念頭に設計
- **Fetch APIの使用感**：お馴染みのFetch APIと同じように使える
- **型安全**：完全なTypeScriptサポートで厄介なバグを防止
- **実戦で実証済み**：包括的なテストカバレッジで信頼性を確保
- **依存関係なし**：軽量な実装で大きな効果を発揮

## インストール

```bash
npm install polling-fetch
```

## クイックスタート

```typescript
import { PollingFetch } from 'polling-fetch';

// 長時間実行タスクを開始
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // 2秒ごとにチェック
    onInitRespond: async (context) => {
      // 初期レスポンスの処理
      const { status } = context.initResponse;
      if (status === 400) {
        throw new Error('無効なリクエスト');
      }
      if (status === 200) {
        return context.initResponse; // 即時完了
      }
      return undefined; // ポーリングを継続
    },
    onPolling: async (context) => {
      // 初期レスポンスからtaskIdを取得
      const { taskId } = await context.initResponse.clone().json();
      
      // 進捗確認
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      if (status.completed) {
        // タスク完了！最終結果を取得
        const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
        return resultResponse;
      }
      
      // まだ完了していない、ポーリングを継続
      return undefined;
    }
  }
});

const result = await response.json();
```

## 実践的な例

### 進捗表示付きタスク処理

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    interval: 1000,
    // 送信前に認証を追加
    onRequest: async (requestInput) => ({
      ...requestInput,
      headers: {
        ...requestInput.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // 初期レスポンスの処理
    onInitRespond: async (context) => {
      const { status } = context.initResponse;
      if (!context.initResponse.ok) {
        throw new Error(`タスク開始失敗：${status}`);
      }
      // 後で使用するためにタスク情報をコンテキストに保存
      const { taskId } = await context.initResponse.clone().json();
      context.taskId = taskId;
      return undefined; // ポーリングを継続
    },

    // 進捗監視
    onPolling: async (context) => {
      // コンテキストからtaskIdを使用
      const statusResponse = await fetch(`/api/tasks/${context.taskId}/status`);
      const status = await statusResponse.json();
      
      // ユーザーに進捗を表示
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // 成功！結果を取得
          const resultResponse = await fetch(`/api/tasks/${context.taskId}/result`);
          return resultResponse;
          
        case 'failed':
          throw new Error(status.error);
          
        case 'processing':
        case 'pending':
          return undefined; // 監視を継続
          
        default:
          throw new Error(`予期しない状態：${status.state}`);
      }
    }
  }
});

const result = await response.json();
```

### エレガントなタスクのキャンセル

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
        // サーバー側でタスクをクリーンアップ
        const { taskId } = await context.initResponse.clone().json();
        await fetch(`/api/tasks/${taskId}/cancel`, {
          method: 'POST'
        });
      }
    }
  });
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('タスクがキャンセルされました');
  }
}

// 停止する必要がある？問題ありません！
controller.abort();
```

### 完璧な設定を作成

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

## API リファレンス

### PollingConfig

ポーリング動作の設定オブジェクト：

```typescript
interface PollingConfig {
  // ポーリング間隔（ミリ秒）（デフォルト：1000）
  interval?: number;
  
  // 初期リクエスト前に呼び出される
  onRequest?: (fetchInit: RequestInput) => Promise<RequestInput> | RequestInput;
  
  // 初期レスポンス後に呼び出される
  onInitRespond?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // 各ポーリング時に呼び出される
  onPolling?: (context: IContext) => Promise<Response | any | undefined> | Response | any | undefined;
  
  // リクエストが中断された時に呼び出される
  onAbort?: (context: IContext) => Promise<void> | void;
}
```

### Context オブジェクト

ポーリングコールバックに渡されるコンテキストオブジェクト：

```typescript
interface IContext {
  // 初期リクエスト入力
  requestInput: RequestInput;
  
  // 初期レスポンス
  initResponse: Response;
  
  // 最新のポーリングレスポンス
  pollingResponse?: Response;
  
  // ポーリング試行回数
  retryCount: number;
  
  // ポーリング開始タイムスタンプ
  startTime: number;
  
  // 現在のポーリング設定
  config: PollingConfig;
}
```

## ライセンス

MIT [Codeium](https://codeium.com)