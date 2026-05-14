import type { PresetFileType } from "./constant"

/**
 * 预设「新建文件」类型对应的扩展名（用于默认文件名与 MIME 推断）。
 * 桌面虚拟行创建与移动端项目详情创建共用，避免两处拷贝漂移。
 */
export const PRESET_FILE_EXTENSION_MAP: Record<PresetFileType, string> = {
	txt: "txt",
	md: "md",
	html: "html",
	py: "py",
	go: "go",
	php: "php",
	design: "design",
	customFile: "",
}

/**
 * 新建文件时的初始正文（虚拟 File 或服务端 saveFileContent 共用同一份模板）。
 */
export const PRESET_FILE_INITIAL_CONTENT: Record<PresetFileType, string> = {
	txt: " ",
	md: "# 新建文档\n\n在这里开始编写您的 Markdown 内容...\n",
	html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新建页面</title>
</head>
<body>
    <h1>欢迎使用</h1>
    <p>在这里开始编写您的 HTML 内容...</p>
</body>
</html>`,
	py: `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新建 Python 文件
"""

def main():
    """主函数"""
    print("Hello, World!")

if __name__ == "__main__":
    main()
`,
	go: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
`,
	php: `<?php
/**
 * 新建 PHP 文件
 */

echo "Hello, World!";
?>
`,
	design: "{}",
	customFile: " ",
}
