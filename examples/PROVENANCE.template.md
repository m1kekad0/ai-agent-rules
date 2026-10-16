# Pinned shared rules（PROVENANCE 雛形）

消費側の `vendor/ai-agent-rules/PROVENANCE.md` に複製し、`<...>` を埋める。フィールド名は下記の英語表記に揃える（ツールや人が機械的に照合できるようにするため）。値の後ろに注記を付ける場合は、括弧で区切る。

## 必須フィールド

- Upstream URL: <https://github.com/OWNER/ai-agent-rules>
- Commit: `<40桁の完全な commit SHA>`
- Path: `AGENTS.md`
- Retrieval date: <YYYY-MM-DD UTC>
- Bytes: `<wc -c の値>`
- SHA256: `<sha256sum の値>`
- License: MIT（Copyright 表示を含む。確認日 <YYYY-MM-DD>）
- License file: `LICENSE`（同じ commit から無改変で `vendor/ai-agent-rules/LICENSE` に配置）
- License bytes: `<wc -c の値>`
- License SHA256: `<sha256sum の値>`
- Review: <独立レビューの状態と参照先。未レビューの場合は `未レビュー（採用候補）` と明記する>

## 任意フィールド

- Canonical retrieval: <固定 SHA を含む取得 URL。upstream が private の場合は取得方法（GitHub contents API 等）を本文に記す>

## 本文に記す事項

- `AGENTS.md` と `LICENSE` が上記 commit からの無改変コピーであること、byte 数と SHA256 の測定方法。
- 可変な `main` の取得結果を固定版として扱わないこと。
- 更新手順: 明示した commit を選び、ライセンスと通知を確認し、固定 SHA で取得して byte 数・SHA256 を再確認し、この記録とともに独立レビューを受ける。

## 公開時の注意

upstream が private の場合、public な消費側では非公開のソース場所や取得経路を無断で転載しない。public 側には許可された範囲の表記と `LICENSE` の通知を残し、完全な provenance は内部に保持する（README 参照）。

## 旧表記との対応

既存の記録で使われている次の表記は、上記の名前に読み替える。新規作成・更新時は上記へ揃える。

| 旧表記 | 統一後 |
|---|---|
| `Upstream:` | `Upstream URL:` |
| `Retrieved / verified:` | `Retrieval date:` |
| `License path:` | `License file:` |
