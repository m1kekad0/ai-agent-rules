# Human が仲介する agent handoff — 運用例

[共通ルール](../AGENTS.md)と[プロジェクト指示の例](project-AGENTS.md)を具体化する、日本語の小さな運用例。自動起動・broker・新しい権限を追加せず、既存の指示・ゲート・pin を維持する。

## 役割と記録先

- **Human**: Claude / Cursor などを手動で起動し、開始文を1回貼る。結果コメント URL または簡潔な結果を 調整担当 に返し、最終 merge を判断する。
- **調整担当**: 目的・承認済み範囲・受入条件を整理して開始文を用意し、成果と証拠を集約して次の担当を示す。
- **実装担当 / 独立レビュアー**: 指定された checkout と SHA で作業し、実際の検証と未確認事項を分けて返す。レビューの既定は読み取りのみで、結果投稿は別途承認が必要。未承認なら Human が結果を返送する。

必要な場合は **1タスク1 Issue** を使い、目的・owner・対象 HEAD の段階（実装完了・未レビュー / レビュー済み・指摘なし / レビュー済み・修正必要 / 中断 / blocked）・承認済み範囲・次の担当を集約する。単なる「完了」でレビューや統合を示さない。統合済みは検証した Human merge の事実としてのみ記録し、agent の操作許可を意味しない。成果物は Git branch と不変の base / head SHA で特定する。既存の作業ブランチ文書は長い設計・再現手順に使い、Issue と状態を二重管理しない。進捗だけのコミットは作らない。

Issue を使わない小さな作業では、既存の引き継ぎ文書または Human の結果返送を使う。

承認は真正な Human の発言・許可された承認元、時刻またはメッセージ参照、正確な操作と対象に結び付ける。agent / 調整担当 の集約・コメント・要約は、Human アカウントで投稿されても Human の承認にならない。現在の Human 承認チャネルと実行環境の確認方針を優先する。Issue コメントの Human らしい見た目だけで判断せず、許可されたチャネルで真正性と正確な操作・対象を検証できなければ、依存する操作を止めて Human に確認する。環境が直接承認を求める場合は従う。

## 作業単位と終了

- 同一 PR 内の修正・独立レビュー・CI は同じタスク（thread）で続ける。担当交代も下の停止確認・1人だけの書き込み・固定 HEAD レビューに従う。
- Human merge または Issue close の完了を確認し、その事実と参照先を記録してタスクを終了する。Draft PR 作成・レビュー完了・Issue close は merge を意味しない。終了の事実は次の操作への承認にならない。
- 次の別作業は新規タスク（new thread）で始める。引き継ぐ要約は **固定 SHA・完了事項・未解決事項・成果物の取得先** に絞り、検証・レビュー・承認の証拠は元の Issue または既存文書を参照する。新規タスクでも開始文で適用指示・真正な承認範囲・取得確認を確認する。
- merge 不要の調査は成果物と未解決事項を報告して終了する。タスク終了は自動 archive / delete を意味しない。

## 最小の流れ

1. 調整担当 が既存指示、承認元と操作、受入条件、成果物の受け渡し先を確認し、開始文を作る。Human が担当を起動する。
2. 引き渡す前に前担当の停止を確認する。無応答なら自動で再起動・引き継ぎをせず、Human が終了を確認してから次の書き手を起動する。同じ編集対象・記録先には同時に1人だけが書き込み、実装とレビューの checkout を分ける。
3. 実装担当が小さな変更と検証を行い、head SHA を固定して結果を返す。調整担当 が記録先に証拠を集約する。ローカル SHA だけでは不十分で、受け手が許可済み公開 ref または合意した成果物から正確な対象を取得できることを確認する。`ls-remote` だけで過去の全 commit の取得可否を判断しない。環境終了前にローカル成果物を許可された受け渡し先へ保存し、未承認の公開や認証情報の抽出・流用で解決しない。
4. Human が別のレビュアーを起動し、取得可能な固定 HEAD を読み取りで独立レビューする。古い SHA のレビューは流用しない。新しい HEAD ごとに前回レビュー済み SHA、正確な差分、新しいレビュー範囲を記録して確認を受ける。未確認 HEAD をレビュー済み・承認済みと扱わない。汎用の終了報告がレビューを求めるだけなら、同じ HEAD の有効な独立レビューを重複させない。
5. 調整担当 が検証・レビュー・残る制約を提示する。未承認の push / PR / merge / 設定変更は行わず、Human が merge する。

取得確認の例: 許可済み remote と ref に対して `git fetch origin <承認済みref>` を行い、受け手が作業前に `git cat-file -e <対象SHA>^{commit}` と `git rev-parse <対象SHA>^{commit}` で対象 commit の存在・完全 SHA の一致を確認する。任意の SHA の直接 fetch が許可・可能とは仮定しない。

## コピー用: 開始文

`<...>` を実際の値に置き換える。目的・状態・次の担当は記録先を参照し、重複させない。レビュー時の実装者証拠は同じ記録先から参照し、独立検証と混同しない。

```text
担当: <実装 / 独立レビュー> / owner: <名前>
状態・目的・受入条件・次の担当・実装者証拠の参照: <Issue URL または既存文書>
適用指示: <AGENTS・必要な skill・vendored rules / provenance のパス>
権限: <真正な Human 承認元・時刻/メッセージ参照・正確な操作/対象>
承認チャネル: <現在の環境で許可された確認方法、直接承認の要否>
checkout: <専用パス> / branch: <名前>
base SHA: <完全 SHA> / 対象 head SHA: <完全 SHA>
取得確認: <許可済み公開 ref / 合意した成果物、受け手の固定 SHA 取得確認>
前担当の停止確認: <確認者と事実。無応答時は Human の終了確認>
レビュー範囲: <初回 base..HEAD / 前回レビュー済み SHA..新 HEAD、証拠の参照>
レビュー時: 対象 HEAD を固定し、既定は読み取りのみ。別 SHA のレビューを流用しない。
任意の runtime / model / Fast: 対応する場合だけ要求値と観測値を別々に報告。不明は不明。Fast 既定 OFF。
quota: 開始/終了時に容易に取得できれば記録。取得できなければ unavailable。polling しない。
不足する権限・アクセス・判断は具体的な対象と根拠を添えて 調整担当 に返す。
下の結果形式で返す。承認外の公開・結果コメント投稿・起動・再起動は行わない。
```

## コピー用: 結果

```text
担当・対象 HEAD の状態: <実装 / 独立レビュー> / <実装完了・未レビュー / レビュー済み・指摘なし / レビュー済み・修正必要 / 中断 / blocked>
対象: <branch> / base <完全 SHA> / head <完全 SHA>
完了事項: <成果と変更ファイル。終了時は確認した merge / Issue close の事実と参照先、または調査成果>
成果物・取得確認: <許可済み ref / 合意した成果物の取得先、受け手の固定 SHA 取得確認>
実際の検証: <担当自身が実行したコマンド・対象 SHA・成功/失敗>
未実行・blocked: <項目・理由、または「なし」>
実装者提供の証拠: <出典と内容、独立確認の有無>
独立レビュー: <未実施 / 前回レビュー済み SHA・今回対象 SHA・正確な差分/範囲・担当・結果・指摘>
停止・残る制約: <書き込み終了の事実、未解決事項>
次の担当・推奨操作: <Human / 調整担当 / 担当者と具体的な一手>
追加承認が必要な操作: <対象と理由、または「なし」>
任意の runtime / model / Fast（対応時）: 要求 <値> / 観測 <値または不明>
quota: 開始 <値または unavailable> / 終了 <値または unavailable>
```

## 根拠

共通ルールの Scope and authority、Validation and independent review、Asynchronous delivery に沿い、Human の手作業を開始文と結果返送に絞る。Issue は判断と状態、Git は成果物の特定、長い文書は設計と再現に使う。実行・レビューの証拠を固定 SHA に結び付け、実際に許可・観測されたことだけを報告する。

## 公開プロジェクトからの学び — 2026-10-08

### 観測・実施記録

- public の text-diff-lab は [PR #1](https://github.com/m1kekad0/text-diff-lab/pull/1) で bootstrap、[PR #2](https://github.com/m1kekad0/text-diff-lab/pull/2) で MVP を進め、Human が merge した。private の共有ルールをコピーせず、独立したプロジェクト指示を使った。
- PR #2 の固定 HEAD は `fa2ea7c7580b2fd6e2497a538845511790bae6a8`、統合された main は `cdc82bd30f71c55da6f7886356c219743539522b`。両者を別々に確認し、後者の [main CI run 37765663308](https://github.com/m1kekad0/text-diff-lab/actions/runs/37765663308) は成功した。
- PR #2 の author / committer は本人の GitHub noreply identity。公式 Actions は full SHA に固定し、main の必須 `ci` は strict、発行元 app ID `15368` に結び付いていた。これらの設定だけで安全性や検証の網羅性は認定しない。
- PR #2 の実施記録は、元画像・PR 上の描画の目視、画像メタデータの点検、認証なしの取得と元画像 bytes の一致を報告している。独立レビューによるブラウザ再実行、Chromium 以外、実機 screen reader の検証とは区別されている。

### 次の作業への推奨

ソース・レビュー・CI・画像の版対応と、merge 後の正確な main CI は[共通ルール](../AGENTS.md)に、画像の実見・公開アクセス確認は[公開プロジェクト向け補足](project-AGENTS.md)に反映する。公開対象がソース以外の履歴・metadata・文書・ログ・画像にも及ぶこと、private ルールの公開再配布条件が未確定ならコピーしないことは、既存の共通ルールと [README](../README.md) を使う。成功した単一の事例を包括的な安全性やブラウザ対応の証明にしない。

## Pages 公開・cloud 準備の引き継ぎ例 — 2026-10-09

text-diff-lab で得た教訓を、既存の結果形式へ短く添える例。共通ルールや承認範囲は増やさない。

### Pages の公開状態

- source Release SHA、current main SHA、承認した deploy SHA、成功 run URL、live assets の取得・一致確認を別々に記録する。初回公開では source Release と deploy 元が異なり、その後の merge も自動公開されなかった。実際の deploy 後は README・現在の公開状態を更新し、過去のローカル検証記録を公開サイトの検証へ読み替えない。[固定版の公開記録](https://github.com/m1kekad0/text-diff-lab/blob/f43c2f5329fbdee9a14498628e476fda3ae77eed/docs/pages-hosting.md)
- 実ホストの subpath・asset URL・応答ヘッダーを確認する。ローカルサーバーの保護は Pages に引き継がれず、meta CSP では `frame-ancestors` やヘッダーの `nosniff` / `no-store` を代替できなかった。
- sole maintainer が実行者と唯一の reviewer を兼ねる場合は、事前に self-review 設定との両立を確認する。承認できない場合は別 reviewer または Human が判断した運用へ戻し、保護を黙って弱めない。ユーザー端末での操作確認も、端末・操作・返答の範囲だけを記録し、全ブラウザ対応や a11y 認定に広げない。

### cloud の準備状態

- basic Node / unit readiness と managed browser readiness を別々に返す。runtime・module 参照・browser cache の設定は各検証 shell で明示・確認し、setup shell の環境変数が別 shell へ持続すると仮定しない。ローカル Chromium の成功を cloud の成功に流用しない。
- network denial は対象 host・原文・実行環境を記録し、新しい allowlist revision と、その設定での再実行成功を別の状態として返す。設定変更だけで解消や provider 障害を断定しない。この記録では cloud の managed browser 成功は未確認。

### 検証の取り違えを防ぐ例

- reload/reset の前に非空入力・描画結果など、消えるべき状態が存在することを assert する。既に空の欄への `fill('')` は編集イベントの根拠にならなかった。[固定版の訂正記録](https://github.com/m1kekad0/text-diff-lab/blob/f43c2f5329fbdee9a14498628e476fda3ae77eed/docs/browser-reset-verification.md)
- Node の関数 benchmark と DOM / textarea・実 paste の応答性を分けて報告する。限定したブラウザ fixture の成功や関数の改善で、実 paste の freeze 改善を保証しない。[固定版の計測範囲](https://github.com/m1kekad0/text-diff-lab/blob/f43c2f5329fbdee9a14498628e476fda3ae77eed/docs/counts-preflight-verification.md)

### ブラウザ回帰を fail-closed な必須 CI に接続する例

- 検証ツールを exact-pinned 依存と lockfile で固定し、その版に対応する browser と必要な OS 依存を明示する。受入対象の mode 組合せをすべて既存の required job に接続し、任意チェックの成功で代用しない。
- missing browser、取得・起動・assertion の失敗、子プロセスの非ゼロ終了、timeout を job の失敗へ伝播させる。skip-success、`continue-on-error`、失敗時の代替 browser で成功扱いにしない。
- 安全な一時 fixture で失敗後の停止と非ゼロ終了の伝播を確認し、実コマンド・合成 stub・観測結果を記録する。ローカル fixture の timeout は GitHub timeout の実測ではなく、実際の Linux CI の browser 取得・起動・回帰成功とも別の証拠として返す。
- text-diff-lab では通常 / Pages subpath × 比較 / keyboard の4チェックを既存の必須 `ci` に含めた。[固定版の検証記録](https://github.com/m1kekad0/text-diff-lab/blob/83d4b8bf65ab69fb2b4fe0138e0359718e9831a7/docs/browser-ci-verification.md)はローカル fixture の範囲を示し、統合 main `e240a94bf3ae406269cecaf51de12bca129fd96a` の [Linux CI run 37933584181](https://github.com/m1kekad0/text-diff-lab/actions/runs/37933584181)は実 Chromium 取得と全4回帰に成功した。

### 公開用 build 出力の引き継ぎ例 — 2026-10-10

- text-diff-lab の [PR #16](https://github.com/m1kekad0/text-diff-lab/pull/16) のレビュー済み HEAD は `df45dec95990d8311f1b12ee06c734e6d6c5ed34`。[固定版の build 実装](https://github.com/m1kekad0/text-diff-lab/blob/df45dec95990d8311f1b12ee06c734e6d6c5ed34/scripts/build.mjs)は公開用の4ファイルを許可集合とし、許可外の項目、出力先・asset の symlink、asset の hard link、危険な出力先を既存 asset の書き換え前に拒否し、自動削除しない。
- [共通ルール](../AGENTS.md)の公開用 build 出力の確認と停止条件を具体化し、正常な再 build、汚れた出力先の拒否と既存データ保持、symlink / hard link と実体パスの境界を、対象 SHA と実際の検証結果に結び付けて返す。停止・公開可否も共通ルールに従って記録する。
- この事例の許可集合や検証結果は上記の固定版に限る。共通ルールの適用対象は公開用 build 出力であり、一般の全 build へ広げない。
