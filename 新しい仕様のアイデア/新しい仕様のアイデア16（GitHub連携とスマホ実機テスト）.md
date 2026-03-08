# 新しい仕様のアイデア16（GitHub連携とスマホ実機テスト）

## 📌 概要
GitHubアカウントの開設おめでとうございます！これで「変更履歴の安全な保存」と「本番サーバーへの公開（スマホでの実機プレイ）」が可能になります。

## 💬 質問への回答：自動的にデータを入れることはできるか？
**はい、ほぼ自動で（AIに任せて）実装・アップロードすることが可能です！**
私（軍師）は直接あなたのPCのターミナルを叩けませんが、**Claude Code** はターミナルを操作できるAIなので、彼に「GitHubにアップロードして！」と指示を出せば、必要なGitコマンド（コミットやプッシュなど）をすべて代行してくれます。

## 💡 インフラ構築のアクションプラン（進め方のステップ）

#### ✅ ステップ1: GitHub上に「空の倉庫」を作る（完了！）
リポジトリの作成ありがとうございます。素晴らしいです！
リポジトリURL: `https://github.com/saychang-ops/homeless-simulator.git`

#### 🏃 ステップ2: コードをGitHubへ上げる（Claude Codeへ指示）
ターミナルの **Claude Code** に向かって、以下のプロンプト（指示書）をそのままコピー＆ペーストして実行させてください。

```text
現在のプロジェクト（Homeless Simulator）を丸ごと私のGitHubリポジトリにアップロード（初回プッシュ）してください。以下が要件です。

1. `homeless-simulator` ディレクトリの初期化とコミット
   - もし `git` の初期化が終わっていなければ `git init` を実行。
   - `git add .` および `git commit -m "Initial commit"` で現在の状態を保存してください。（`.gitignore` があって `node_modules` 等が除外されていることを確認してください）
2. リモートリポジトリの追加
   - URL: `https://github.com/saychang-ops/homeless-simulator.git`
   - `git remote add origin https://github.com/saychang-ops/homeless-simulator.git`
3. ブランチのプッシュ
   - `main` または `master` ブランチをリモートリポジトリへ `push -u origin <branch>` してアップロードを完了させてください。
   - もしクレデンシャルエラー（GitHubのログイン要求）が出た場合は、認証の案内を行ってください。
   - 現在のユーザーのOSは Windows (Powershell/Command Prompt) です。
```

#### ⏭️ ステップ3: Vercelで公開する（あなたのご担当）
Claude先生がGitHubへのアップロードを完了したら、以下の手順でWeb上に公開します。

1. [Vercel](https://vercel.com/) にアクセスし、「Sign up with GitHub」で登録・ログインします。
2. ダッシュボード右上や中央の「Add New...」→「Project」をクリック。
3. リポジトリ一覧に `saychang-ops/homeless-simulator` が表示されるはずなので、右側の「Import」をクリック。
4. 設定画面が開きますが、すでにVite＋Reactであることを自動認識してくれるため、**何も設定を変えずに一番下の「Deploy」ボタン**をクリック。
5. 数十秒間、紙吹雪のアニメーションなどが出てデプロイ（公開）が完了します。
6. 発行されたURL（例: `https://homeless-simulator-xxxx.vercel.app`）をスマホやPCから開いて、実機で遊べるか確認してください！

これで、**「PCで開発してClaudeがGitHubにアップ」→「自動でVercelが反応して公開URLが更新される」** という最高の開発環境が完成します。
