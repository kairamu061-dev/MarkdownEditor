#!/bin/bash
# 機能エリアを追加するスクリプト
# 使い方: ./add-feature.sh [--small] <パス>
# 例:     ./add-feature.sh auth
#         ./add-feature.sh auth/login
#         ./add-feature.sh --small auth/login   # 小規模用の 3 文書だけ作る

set -e

PROJECT_DIR="$PWD"
DOCS_DIR="$PROJECT_DIR/docs"
TEMPLATES_DIR="$PROJECT_DIR/templates"
INDEX_FILE="$DOCS_DIR/index.md"

SMALL=0
if [ "$1" = "--small" ]; then
  SMALL=1
  TEMPLATES_DIR="$TEMPLATES_DIR/small"
  shift
fi

# 引数チェック
if [ -z "$1" ]; then
  echo "使い方: $0 [--small] <パス>"
  echo "例: $0 auth"
  echo "例: $0 auth/login"
  echo "例: $0 --small auth/login"
  exit 1
fi

FEATURE_PATH="$1"
FEATURE_NAME=$(basename "$FEATURE_PATH")
TARGET_DIR="$DOCS_DIR/$FEATURE_PATH"

# 既存チェック
if [ -d "$TARGET_DIR" ]; then
  echo "エラー: '$TARGET_DIR' は既に存在します"
  exit 1
fi

# フォルダ作成
mkdir -p "$TARGET_DIR"
echo "作成: $TARGET_DIR"

# テンプレートファイルをコピー
for template in "$TEMPLATES_DIR"/*.md; do
  [ -f "$template" ] || continue
  filename=$(basename "$template")
  cp "$template" "$TARGET_DIR/$filename"
  echo "  コピー: $filename"
done

# インデントを計算（パスの深さに応じて2スペース）
DEPTH=$(echo "$FEATURE_PATH" | awk -F'/' '{print NF-1}')
INDENT=""
for i in $(seq 1 "$DEPTH"); do
  INDENT="  $INDENT"
done

RELATIVE_PATH="./$FEATURE_PATH/overview.md"
NEW_LINE="${INDENT}- [$FEATURE_NAME]($RELATIVE_PATH)"

# index.md に挿入する。
# 末尾に追記すると、親と無関係な位置にぶら下がって見える（editor/inline-title が
# settings の子として並んでしまった実例あり）。サブ項目は親の行と、既にある兄弟の
# 直後に差し込む。親が見つからないときだけ末尾へ追記する。
PARENT_PATH=$(dirname "$FEATURE_PATH")
if [ "$PARENT_PATH" != "." ] && grep -qF "($(printf './%s/overview.md' "$PARENT_PATH"))" "$INDEX_FILE"; then
  awk -v parent="./$PARENT_PATH/overview.md" -v newline="$NEW_LINE" -v indent="$INDENT" '
    { lines[NR] = $0 }
    index($0, "(" parent ")") { at = NR }
    END {
      # 親の直後にある、親より深い行（既存の兄弟）を読み飛ばした位置に挿入する
      ins = at
      for (i = at + 1; i <= NR; i++) {
        if (lines[i] ~ "^" indent "- \\[") { ins = i; continue }
        if (lines[i] ~ /^ *- \[/) break
        if (lines[i] ~ /^[^ ]/ && lines[i] != "") break
      }
      for (i = 1; i <= NR; i++) {
        print lines[i]
        if (i == ins) print newline
      }
    }
  ' "$INDEX_FILE" > "$INDEX_FILE.tmp" && mv "$INDEX_FILE.tmp" "$INDEX_FILE"
  echo "index.md に挿入: $PARENT_PATH の下"
else
  echo "$NEW_LINE" >> "$INDEX_FILE"
  echo "index.md に追記: ${INDENT}- [$FEATURE_NAME]"
fi

echo ""
if [ "$SMALL" = "1" ]; then
  echo "完了: '$FEATURE_PATH' を追加しました（小規模版・overview / design / dev-notes の 3 文書）"
  echo "  テストは親の test-cases.md に追加すること"
else
  echo "完了: '$FEATURE_PATH' を追加しました"
fi

if [ "$PARENT_PATH" != "." ]; then
  echo ""
  echo "※ 親のリンクは自動では追加されません。手で追記してください:"
  echo "     docs/$PARENT_PATH/design.md   サブ項目一覧"
  echo "     docs/$PARENT_PATH/tasks.md    サブ項目一覧と依存関係"
fi
