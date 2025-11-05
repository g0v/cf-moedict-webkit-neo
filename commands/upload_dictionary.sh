#!/bin/bash

# 上傳字典資料到 R2 Storage 的腳本
# 使用 rclone sync 將 pack, pcck, phck, ptck 資料夾上傳到 moedict-dictionary

set -e  # 遇到錯誤時退出

echo "🚀 開始上傳字典資料到 R2 Storage..."

# 檢查 rclone 是否安裝
if ! command -v rclone &> /dev/null; then
    echo "❌ 錯誤: rclone 未安裝，請先安裝 rclone"
    exit 1
fi

# 檢查字典資料夾是否存在
DICTIONARY_DIR="../data/dictionary"
if [ ! -d "$DICTIONARY_DIR" ]; then
    echo "❌ 錯誤: dictionary 資料夾不存在"
    exit 1
fi

# R2 Storage 配置
R2_REMOTE="r2"
R2_BUCKET="moedict-dictionary"

# 要上傳的資料夾列表
FOLDERS=("pack" "pcck" "phck" "ptck")

# 檢查每個資料夾是否存在
for folder in "${FOLDERS[@]}"; do
    if [ ! -d "$DICTIONARY_DIR/$folder" ]; then
        echo "❌ 錯誤: $DICTIONARY_DIR/$folder 資料夾不存在"
        exit 1
    fi
done

echo "📁 準備上傳以下資料夾:"
for folder in "${FOLDERS[@]}"; do
    file_count=$(find "$DICTIONARY_DIR/$folder" -name "*.txt" | wc -l)
    echo "  - $folder ($file_count 個 .txt 檔案)"
done

echo ""
echo "🔄 開始同步上傳..."

# 上傳每個資料夾
for folder in "${FOLDERS[@]}"; do
    echo ""
    echo "📤 正在上傳 $folder..."

    # 使用 rclone sync 上傳
    rclone sync "$DICTIONARY_DIR/$folder" "$R2_REMOTE:$R2_BUCKET/$folder" \
        --progress \
        --transfers=32 \
        --checkers=64 \
        --buffer-size=1M \
        --fast-list \
        --retries=3 \
        --low-level-retries=10 \
        --retries-sleep=2s

    if [ $? -eq 0 ]; then
        echo "✅ $folder 上傳完成"
    else
        echo "❌ $folder 上傳失敗"
        exit 1
    fi
done

echo ""
echo "🎉 所有字典資料上傳完成！"
echo ""
echo "📊 上傳摘要:"
for folder in "${FOLDERS[@]}"; do
    file_count=$(find "$DICTIONARY_DIR/$folder" -name "*.txt" | wc -l)
    echo "  - $folder: $file_count 個檔案"
done

echo ""
echo "🔗 R2 Storage 路徑: $R2_REMOTE"
echo "📂 上傳的資料夾: ${FOLDERS[*]}"
