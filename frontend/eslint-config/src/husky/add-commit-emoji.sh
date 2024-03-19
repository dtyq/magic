#!/usr/bin/env sh

# 检查根目录是否有 .husky 目录
if [ ! -d "$(pwd)/.husky" ]; then
  echo "Not found .husky directory, please install husky and run 'npx husky init' in root directory first."
  exit 1
fi

# 读取./template/add-commit-emoji, 插入到 $(pwd)/.husky/commit-msg 的开头
TEMPLATE_FILE="$(dirname $0)/template/add-commit-emoji"

# 读取.husky/commit-msg的内容，临时保存
COMMIT_MSG="$(pwd)/.husky/commit-msg"
COMMIT_MSG_TMP="$(pwd)/.husky/commit-msg.tmp"

if [ -f "$COMMIT_MSG" ]; then
    cp $COMMIT_MSG $COMMIT_MSG_TMP
fi

if [ -f "$TEMPLATE_FILE" ]; then

    cat $TEMPLATE_FILE > $(pwd)/.husky/commit-msg

    if [ -f "$COMMIT_MSG_TMP" ]; then
        while read line || [[ -n ${line} ]];
        do
            echo $line >> $(pwd)/.husky/commit-msg
        done < $COMMIT_MSG_TMP

        rm -rf $COMMIT_MSG_TMP
    fi

    # 设置执行权限
    chmod +x $(pwd)/.husky/commit-msg

    echo "\n🥳 Add Successfully! \nTry to create a commit to verify.\n"

    exit 1
fi

echo "Not found template file"