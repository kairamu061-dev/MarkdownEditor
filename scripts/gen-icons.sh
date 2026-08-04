#!/usr/bin/env bash
# アプリアイコン一式を原画から生成する。
#
#   scripts/gen-icons.sh [原画のパス]     既定: assets/icon-source-1024.png
#
# 原画は「背景透過済み・正方形・1024px 以上」の PNG であること。
# 白背景の絵から透過版を作る手順は docs/app-shell/dev-notes.md を参照。
#
# tauri icon をそのまま使わない理由（BUG-024）:
#   tauri icon が生成する icon.ico は全エントリが PNG 圧縮になる。Windows が
#   ICO 内の PNG 圧縮エントリを扱えるのは 256x256 のみで、16/24/32/48/64 は
#   BMP/DIB でなければならない。PNG のままだとエクスプローラが exe の
#   アイコンを描画できず、既定アイコンのままに見える。
#   そのため ICO だけ ImageMagick で作り直す。
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-assets/icon-source-1024.png}"
[ -f "$SRC" ] || { echo "[NG] 原画が見つかりません: $SRC" >&2; exit 1; }

command -v convert >/dev/null || { echo "[NG] ImageMagick (convert) が必要です" >&2; exit 1; }

# 1) PNG / ICNS / Appx ロゴを生成（ここで作られる icon.ico は後で上書きする）
#
# 存在確認だけでは不十分。@tauri-apps/cli はプラットフォーム別のネイティブ
# バイナリを別パッケージで持つため、他 OS 側で npm ci された node_modules が
# 共有ツリーに残っていると .bin/tauri はあるのに実行時に落ちる（BUG-023 参照）。
# 実際に起動できるものを選ぶ。
TAURI=""
for cand in node_modules/.bin/tauri /tmp/tauricli/node_modules/.bin/tauri tauri; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" --version >/dev/null 2>&1; then
    TAURI="$cand"; break
  fi
done
if [ -z "$TAURI" ]; then
  echo "[NG] 実行可能な tauri CLI が見つかりません。" >&2
  echo "     プロジェクトの node_modules を壊さずに用意するには:" >&2
  echo "       npm i --prefix /tmp/tauricli @tauri-apps/cli@2" >&2
  echo "     （このスクリプトは /tmp/tauricli も自動で探します）" >&2
  exit 1
fi
echo "tauri CLI: $TAURI"
"$TAURI" icon "$SRC" -o src-tauri/icons >/dev/null

# 2) モバイル用は未使用（bundle.targets は msi / nsis のみ）
rm -rf src-tauri/icons/android src-tauri/icons/ios

# 3) ICO を作り直す。256 は PNG 圧縮のまま（Vista 以降が対応・サイズ削減）、
#    それ未満は BMP/DIB にする。ImageMagick はこの振り分けを自動で行う。
convert "$SRC" -background none \
  -define icon:auto-resize=256,64,48,32,24,16 \
  src-tauri/icons/icon.ico

# 4) 検証: 256 以外が BMP/DIB になっていること
python3 - <<'PY'
import struct, sys
d = open('src-tauri/icons/icon.ico', 'rb').read()
_, _, cnt = struct.unpack('<HHH', d[:6])
off, bad = 6, []
print(f"icon.ico: {cnt} entries, {len(d)} bytes")
for _ in range(cnt):
    w, h, _, _, _, bpp, size, o = struct.unpack('<BBBBHHII', d[off:off+16]); off += 16
    w = w or 256
    enc = "PNG" if d[o:o+8] == b'\x89PNG\r\n\x1a\n' else "BMP/DIB"
    print(f"  {w:3}x{w:<3} bpp={bpp:2} {size:6} bytes  {enc}")
    if w < 256 and enc == "PNG":
        bad.append(w)
if bad:
    sys.exit(f"[NG] {bad} が PNG 圧縮のままです。Windows で exe のアイコンが表示されません。")
print("[OK] 256 未満のエントリはすべて BMP/DIB です。")
PY

echo "[OK] アイコンを生成しました: src-tauri/icons/"
echo "     Windows で再ビルドすると exe に反映されます（build.rs が icons/ を監視）。"
