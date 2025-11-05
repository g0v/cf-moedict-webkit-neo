#!/bin/bash

# 同步前端資產到 R2 Storage
# 使用 rclone sync 確保完整同步，不會跳過已存在的檔案

set -e  # 遇到錯誤時退出

BUCKET="r2:moedict-assets-preview"
ASSETS_DIR="../data/assets"

echo "🚀 開始同步前端資產到 R2..."

# 檢查 rclone 是否已配置
if ! rclone listremotes | grep -q "^r2:"; then
    echo "❌ 錯誤: rclone 未配置 r2 remote"
    echo "請先運行: rclone config"
    exit 1
fi

# 檢查資產目錄是否存在
if [ ! -d "$ASSETS_DIR" ]; then
    echo "❌ 錯誤: 資產目錄不存在: $ASSETS_DIR"
    exit 1
fi

echo "📁 準備同步資產目錄: $ASSETS_DIR"

# rclone sync 設置
RCLONE_OPTS="--progress --transfers=4 --checkers=8 --buffer-size=1M --retries=3 --low-level-retries=10 --retries-sleep=2s --timeout=300s --delete-excluded"

# 顯示同步前的差異檢查（不因差異而中斷）
echo ""
echo "🔍 檢查同步差異..."
rclone check "$ASSETS_DIR/" "$BUCKET/" --one-way --missing-on-dst --max-backlog=200000 || true

echo ""
echo "📤 開始同步所有資產..."

# 使用 rclone sync 同步整個 assets 目錄
echo "同步中: $ASSETS_DIR/ -> $BUCKET/"
rclone sync "$ASSETS_DIR/" "$BUCKET/" $RCLONE_OPTS

echo ""
echo "✅ 資產同步完成！"

echo ""
echo "📊 同步摘要:"
echo "查看同步的文件："
rclone ls "$BUCKET" | head -20

echo ""
echo "🔍 驗證同步結果..."
rclone check "$ASSETS_DIR/" "$BUCKET/" --one-way --missing-on-dst --max-backlog=200000 || true

echo ""
echo "🔗 R2 Storage 路徑: $BUCKET"
echo "🌐 公開端點: https://pub-1808868ac1e14b13abe9e2800cace884.r2.dev"
