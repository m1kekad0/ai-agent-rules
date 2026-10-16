# ai-agent-rules v0

Human の手間を最小限にして生産的な仕事を進めるための、小さくプロバイダー中立な共通ルール。正本は [AGENTS.md](AGENTS.md)。本 v0 の初期5ファイルに運用例を加え、現在の文書・CIを提供する。許可されたローカル編集・検証・コミットを行い、外部公開はプロジェクトで定めた担当者が承認範囲内で調整する。

## 消費側での利用

本リポジトリは [MIT License](LICENSE)（Copyright (c) 2026 m1kekad0）で提供する。コピー・改変・再配布する際は、著作権表示と許諾表示を含む `LICENSE` の通知を保持する。消費側では採用した固定版の `LICENSE` を `vendor/ai-agent-rules/LICENSE` として `AGENTS.md` と同じ場所に置き、`PROVENANCE.md` にライセンスを記録する。

1. レビュー済みのソース commit を選ぶ。
2. その commit の `AGENTS.md` と `LICENSE` を消費側の `vendor/ai-agent-rules/` にそのままコピーする。
3. 隣接する `PROVENANCE.md` にソース場所、commit、パス、SHA-256、ライセンス（MIT）、採用日を記録する。フィールド名は[雛形](examples/PROVENANCE.template.md)に揃える。
4. [プロジェクト用の例](examples/project-AGENTS.md)を基に、消費側の範囲・受入条件・許可された操作を定める。開始時にローカルの vendored 文書も読む。

完全な provenance は内部に保持し、public の表記は許可された範囲にして `LICENSE` の通知を維持する。非公開のソース場所などを公開用の `PROVENANCE.md` に無断転載しない。vendor を使わず独立した最小のプロジェクト指示で開始することもできる。

起動時に最新版を取得しない。更新は pin と差分をレビューする明示的な変更にする。ローカル候補の commit を利用する場合は、その候補が未レビューであることを明記する。

Human が手動で担当を起動し、Issue または既存文書で成果を引き継ぐ場合は、[運用例と開始・結果テンプレート](examples/human-handoff.md)を使う。同一 PR の修正・レビュー・CI は同じタスクで進め、Human merge または Issue close の完了確認で区切る。次の別作業は新規タスクとし、固定 SHA・完了事項・未解決事項・成果物の取得先を渡す。merge 不要の調査や終了時の扱いも運用例に従う。

## pin 検査スクリプト

[`scripts/check-pin.mjs`](scripts/check-pin.mjs) は、消費側の `vendor/ai-agent-rules/AGENTS.md` と `LICENSE` が `PROVENANCE.md` に記録した byte 数・SHA256 と一致するかを検査する。読み取り専用で、Node.js 22 以上の標準機能だけを使う。

- 取得: レビュー済み commit の `scripts/check-pin.mjs` を消費側（例: `scripts/check-pin.mjs`）に無改変でコピーし、取得元 commit を `PROVENANCE.md` の本文に記録する。起動時に取得しない。
- 実行: `node scripts/check-pin.mjs [--json] [--vendor-dir <path>] [dir ...]`。終了コードは 0 = 一致、1 = 不一致・欠落、2 = 使い方の誤り。
- 消費側 CI の例: `run: node scripts/check-pin.mjs .`（ネットワーク不要）。
- フィールドは[雛形](examples/PROVENANCE.template.md)に従う。旧表記 `Upstream:`、`<...>` で囲んだ URL、値の後の括弧注記も受け付ける。
- 任意の `--upstream` は GitHub REST API の compare で、upstream `main` が pin 以降に `AGENTS.md` / `LICENSE` を変更したか（drift）を報告する。既定では情報表示のみで、`--fail-on-drift` を付けたときだけ drift または検証不能を失敗にする。public の upstream は token なしで検査できる（GitHub API の未認証レート制限内）。upstream が private の場合は、読み取り権限のない token または token なしでは 404 になり「検証不能」と表示する。その場合は upstream の contents 読み取りだけを許可した fine-grained token を secret で `GITHUB_TOKEN` として渡す（消費側 CI の既定の `GITHUB_TOKEN` は別リポジトリを読めない）。token は出力に含めない。

## v0 の受入条件

- 範囲、権限、プロジェクトで定めた経路での相談、他者の作業保護、テスト、独立レビュー、非同期 Draft PR、Human merge、機密保護、事実に基づく報告、公開用 build 出力の確認と停止条件が共通ルールに含まれる。
- vendor を採用する消費側は provenance 付きの固定コピーで利用し、起動時にネットワーク接続を必要としない。
- 既存 CI は `examples/human-handoff.md` を含む`LICENSE` を含む列挙された7ファイルの存在、非空、終端改行、行末空白、相対 Markdown リンク先の存在を検査する。HTTPS の証跡リンクは `examples/human-handoff.md` に限り許容し、外部 URL への通信や可用性検査は行わない。他の文書の外部リンクは拒否する。別担当による内容レビューを受ける。CI は内容の正しさ、ルールへの意味的適合や独立レビューを認定するものではない。

このプロジェクトはルール文書と pin 検査スクリプトだけを提供する。モデル台帳、quota routing、agenthooks/agentlint、launcher、scheduler、permission wrapper、Workboard engine は含めない。既存のゲートやプラットフォーム権限は変更しない。[移行計画](MIGRATION.md)は既存消費側への変更を実行しない。
