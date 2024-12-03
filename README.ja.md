# PollingFetch 🚀

[English](README.md) | [繁體中文](README.zh-TW.md)

長時間実行タスクをFetch APIで優雅に処理したいと思ったことはありませんか？PollingFetchをご紹介します！🎉

このコンパクトなライブラリは、Fetch APIにタスク管理機能をもたらし、長時間実行タスクを簡単に扱えるようにします。複雑な状態管理は必要ありません - シンプルで効果的です！

## なぜPollingFetchなのか？🤔

- **タスク指向設計**：実際のサーバー操作を考慮して設計
- **ネイティブFetchの操作性**：慣れ親しんだFetch APIと同じ使い方
- **型安全**：完全なTypeScriptサポート
- **実績あり**：包括的なテストによる信頼性
- **依存関係なし**：軽量な実装で強力な機能を実現

## インストール 📦

```bash
npm install polling-fetch
```

## クイックスタート ✨

```typescript
import { PollingFetch } from 'polling-fetch';

// 長時間実行タスクの開始
const response = await PollingFetch('/api/tasks/process-data', {
  method: 'POST',
  body: JSON.stringify({ data: 'process this!' }),
  polling: {
    interval: 2000,  // 2秒ごとに確認
    onPolling: async (response) => {
      // 初期レスポンスからtaskIdを取得
      const { taskId } = await response.clone().json();
      
      // タスクの状態を確認
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

## 実践的な例 ✨

### タスク進捗の管理

```typescript
const response = await PollingFetch('/api/tasks/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: 'analyze this!' }),
  polling: {
    // リクエスト送信前の認証処理
    onRequest: async (init) => ({
      ...init,
      headers: {
        ...init.headers,
        'Authorization': `Bearer ${await getToken()}`
      }
    }),

    // 進捗のモニタリング
    onPolling: async (response) => {
      const { taskId } = await response.clone().json();
      
      // 状態の確認
      const statusResponse = await fetch(`/api/tasks/${taskId}/status`);
      const status = await statusResponse.json();
      
      // UI更新
      if (status.progress) {
        updateProgressBar(status.progress);
      }
      
      switch (status.state) {
        case 'completed':
          // 完了！結果を取得
          const resultResponse = await fetch(`/api/tasks/${taskId}/result`);
          return resultResponse;
          
        case 'failed':
          throw new Error(status.error);
          
        case 'processing':
        case 'pending':
          return undefined; // ポーリング継続
          
        default:
          throw new Error(`予期しない状態：${status.state}`);
      }
    }
  }
});

const result = await response.json();
```

### タスクのキャンセル処理

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
        // サーバー側のタスクをクリーンアップ
        const { taskId } = await response.clone().json();
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

// キャンセルが必要な場合
controller.abort();
```

### カスタム設定の作成

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

## 主な機能 🌟

- **タスク中心設計**：現代のタスク管理パターンに最適
- **進捗管理**：簡単な状態と進捗の監視
- **クリーンアップ機能**：クライアントとサーバー両方での適切な後処理
- **柔軟なAPI**：様々なタスク管理システムに対応
- **TypeScript対応**：完全な型定義を提供

## API仕様

### PollingConfig

```typescript
interface PollingConfig {
  interval?: number;
  onRequest?: (fetchInit: RequestInit) => Promise<RequestInit> | RequestInit;
  onPolling?: (response: Response) => Promise<Response | undefined> | Response | undefined;
  onAbort?: (response: Response) => Promise<void> | void;
}
```

### 実装パターン

1. **タスクフロー**：
   - 初期リクエストでタスク作成とtaskId取得
   - taskIdによる進捗確認
   - 完了時に結果を取得

2. **進捗更新**：
   - 状態エンドポイントの定期確認
   - UI進捗の更新
   - 各種タスク状態の処理

3. **タスク管理**：
   - 初期リクエストでタスク開始
   - 状態エンドポイントで進捗監視
   - 専用エンドポイントから結果取得
   - キャンセル時の後処理

## 選ばれる理由 ❤️

1. **最適なタスクパターン**：現代のAPIに最適
2. **本番環境対応**：実績と型安全性
3. **フレームワーク非依存**：fetchが使える環境なら利用可能
4. **開発者思考**：開発体験を重視した設計

## ライセンス

MIT