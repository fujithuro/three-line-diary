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
- 編集は1日ずつモーダルで行います。背景は操作できず、変更後のキャンセルとEscapeでは破棄を確認します。保存後は元の日付に戻ります。
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

統合テストは本番ではなく、検証用ローカルDBで実行します。2001-01-01にテスト履歴を追加します。

```sh
npm run dev -- --var DIARY_TOKEN:local-verification-token
# 別のターミナルで
DIARY_TEST_URL=http://localhost:8787 npm test
```

## 祝日表示

土曜の曜日を青、日曜と祝日・休日の曜日を赤で表示します。祝日・休日は `(水・祝)` の形式です。
内閣府の公式CSV（https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html）を同梱し、閲覧時に外部サービスへ接続しません。
現在の収録範囲は1955〜2027年です。範囲外の祝日は推測せず、通常の曜日表示になります。
翌年分の公表や祝日の変更時は `npm run holidays:update` を実行してデータを更新し、再デプロイしてください。

## 開発用：GitHubへの認証

GitHubへのHTTPSでのプッシュには、Fine-grained personal access token（PAT）を使います。これは日記アプリへのログインに使う `DIARY_TOKEN` とは別の認証情報です。

### PATの作成

[GitHubのFine-grained token作成画面](https://github.com/settings/personal-access-tokens/new)で、次のように設定します。

- Resource owner：自分の個人アカウント（このリポジトリでは `fujithuro`）
- Repository access：`Only select repositories` → `three-line-diary` のみ
- Repository permissions：`Contents: Read and write`（`Metadata: Read-only` は自動付与）
- Expiration：運用に合わせた有効期限を設定

このPATには会社のOrganizationの非公開リポジトリへの権限を与えません。GitHubの公開リポジトリの読み取りは可能です。

### このPCでの保存設定（初回のみ）

Git標準の `credential-store` を使い、PATをプロジェクト外の `~/.config/three-line-diary/git-credentials` に平文で保存します。個人用PCでの扱いやすさを優先した方式です。自作の認証スクリプト、キーチェーン、常時設定する環境変数は使いません。

プロジェクトのディレクトリで実行します。

```sh
mkdir -p ~/.config/three-line-diary
chmod 700 ~/.config/three-line-diary

git config --local --replace-all credential.helper ''
git config --local --add credential.helper \
  "store --file=$HOME/.config/three-line-diary/git-credentials"
git config --local credential.useHttpPath true
```

この設定は `.git/config` に保存され、このリポジトリだけに適用されます。空のhelper設定で引き継いだ認証ヘルパーをリセットし、接続先のリポジトリパスも含めて認証情報を区別します。設定ファイルとPAT保存ファイルはコミット対象ではありません。PATの値や保存ファイルの中身をREADME・コード・コミットへ含めないでください。

### PATの登録・更新

Mac標準のzshで、まず次の1行だけを実行します。

```sh
read -rs "diary_pat?GitHub PAT: "
```

入力待ちになったらPATを貼り付け、Enterを押します。入力文字は表示されません。その後、以下をまとめて実行します。

```sh
echo
printf 'protocol=https\nhost=github.com\npath=fujithuro/three-line-diary.git\nusername=fujithuro\npassword=%s\n\n' "$diary_pat" |
  git credential approve
unset diary_pat
```

正常時は何も表示されません。GitがPATを保存し、ファイルの権限を自分だけが読み書きできる状態にします。`approve` は保存のみを行い、PATの有効性は検証しません。保存ファイルの存在は、内容を表示せずに確認できます。

```sh
test -s ~/.config/three-line-diary/git-credentials \
  && echo '認証情報のファイルが保存されています'
```

以後は通常の `git push` で保存済みPATが使われます。ターミナルやPCを再起動しても再入力は不要です。期限切れ・失効時は新しいPATを作り、この「PATの登録・更新」を繰り返してください。保存してもPATの有効期限は延びません。

GitHubへのプッシュとCloudflareへの公開は別操作です。`git push` はコードと履歴をGitHubへ送信し、`npm run deploy` は手元のコードをCloudflareへ公開します。

参考：[Git credential-store](https://git-scm.com/docs/git-credential-store)、[Git credential](https://git-scm.com/docs/git-credential)
