# 三行日記

個人用のレスポンシブWebアプリ。Cloudflare Workersで画面とAPIを配信し、D1に日記とすべての保存履歴を記録します。

## ローカル起動

```sh
npm ci
cp .dev.vars.example .dev.vars
# .dev.vars の DIARY_TOKEN を自分用の値へ変更
npm run db:local
npm run dev
```

表示されたURLを開き、DIARY_TOKENの値を入力します。端末ごとにlocalStorageへ保存します。実際のトークンはGitに含めないでください。

## Cloudflareへの配置

```sh
npx wrangler login
npx wrangler d1 create diary
```

返されたdatabase_idをwrangler.jsoncに設定した後、実行します。

```sh
npm run db:remote
npx wrangler secret put DIARY_TOKEN
npm run deploy
```

本番トークンには十分長いランダム値を設定してください。独自ドメインは必須ではありません。トークン変更時は各端末で再入力します。

## 仕様

- 日本時間の日付。今日の位置から開始し、明日まで表示。過去は30日ずつ追加取得。
- 本文は日付ごとに1つ。最低3行で長文は伸長。APIの保護上限は10万文字。
- 保存・空欄への変更・復元を版として記録。同一本文は新しい版を作りません。
- 更新時は版番号を確認し、競合なら409を返します。入力内容は画面に残ります。
- 履歴は編集中の「履歴」から閲覧・復元。復元も新しい版になります。
- PWAのキャッシュは画面のみ。日記APIはキャッシュせず、閲覧・保存には接続が必要です。
- アプリの外枠は公開ですが、すべての日記APIはBearer認証が必須です。

## テストとバックアップ

```sh
npm test
npx wrangler d1 export diary --remote --output diary-backup.sql
```

エクスポートには日記本文と履歴が含まれるので安全な場所に保管してください。履歴は誤編集への対策であり、DB全体の削除へのバックアップではありません。

## コミット方針

同じ意図の変更を1つのコミットにまとめ、日本語の件名と本文で変更理由・背景・重要な判断を残します。API、画面、不具合修正など目的で分け、同じ目的のファイル変更は分割しません。
