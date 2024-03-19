#!/usr/bin/env php
<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
require_once '/Users/liaobw/Workspace/code/develop/magic/backend/magic-service/vendor/autoload.php';

use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;

$fixturesDir = __DIR__ . '/fixtures';

echo "\n";
echo "╔═══════════════════════════════════════════════════════════════════════╗\n";
echo "║          FileMetadataUtil 解析结果测试                                ║\n";
echo "╚═══════════════════════════════════════════════════════════════════════╝\n";
echo "\n";

$testFiles = [
    'test-project.js' => '标准项目配置（你的实际格式）',
    'with-comments.js' => '带注释的项目配置（新功能测试）',
    'normal-project.js' => '新增测试文件',
    'complex-project.js' => '复杂项目配置（包含嵌套对象）',
    'empty-slides.js' => '空 slides 数组',
    'nested-paths.js' => '嵌套路径项目',
    'invalid-file.txt' => '无效文件（无配置对象）',
];

foreach ($testFiles as $filename => $description) {
    $filePath = $fixturesDir . '/' . $filename;

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📄 文件: {$filename}\n";
    echo "📝 描述: {$description}\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

    if (! file_exists($filePath)) {
        echo "❌ 文件不存在: {$filePath}\n\n";
        continue;
    }

    // 显示原始文件内容
    echo "\n📖 原始文件内容:\n";
    echo "┌─────────────────────────────────────────────────────────────────────┐\n";
    $content = file_get_contents($filePath);
    $lines = explode("\n", $content);
    foreach ($lines as $i => $line) {
        printf("│ %2d │ %s\n", $i + 1, $line);
    }
    echo "└─────────────────────────────────────────────────────────────────────┘\n";

    // 解析配置
    echo "\n🔍 解析结果:\n";
    try {
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        if ($config === null) {
            echo "┌─────────────────────────────────────────────────────────────────────┐\n";
            echo "│ ⚠️  返回值: NULL                                                     │\n";
            echo "│ 说明: 文件中未找到 window.magicProjectConfig 配置对象              │\n";
            echo "└─────────────────────────────────────────────────────────────────────┘\n";
        } else {
            echo "┌─────────────────────────────────────────────────────────────────────┐\n";
            echo "│ ✅ 解析成功!                                                         │\n";
            echo "└─────────────────────────────────────────────────────────────────────┘\n";
            echo "\n📊 解析后的 PHP 数组:\n";
            echo "┌─────────────────────────────────────────────────────────────────────┐\n";
            print_r($config);
            echo "└─────────────────────────────────────────────────────────────────────┘\n";

            echo "\n📋 解析后的 JSON 格式:\n";
            echo "┌─────────────────────────────────────────────────────────────────────┐\n";
            echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
            echo "└─────────────────────────────────────────────────────────────────────┘\n";

            // 显示关键信息
            echo "\n🔑 关键信息提取:\n";
            echo "┌─────────────────────────────────────────────────────────────────────┐\n";
            if (isset($config['version'])) {
                echo "│ 版本 (version):    {$config['version']}\n";
            }
            if (isset($config['type'])) {
                echo "│ 类型 (type):       {$config['type']}\n";
            }
            if (isset($config['name'])) {
                echo "│ 名称 (name):       {$config['name']}\n";
            }
            if (isset($config['slides'])) {
                $slideCount = count($config['slides']);
                echo "│ Slides 数量:       {$slideCount} 个\n";
                if ($slideCount > 0) {
                    echo "│   - 第一个: {$config['slides'][0]}\n";
                    if ($slideCount > 1) {
                        echo "│   - 最后一个: {$config['slides'][$slideCount - 1]}\n";
                    }
                }
            }
            echo "└─────────────────────────────────────────────────────────────────────┘\n";
        }
    } catch (Exception $e) {
        echo "┌─────────────────────────────────────────────────────────────────────┐\n";
        echo "│ ❌ 解析失败!                                                         │\n";
        echo "└─────────────────────────────────────────────────────────────────────┘\n";
        echo "\n错误信息:\n";
        echo '  类型: ' . get_class($e) . "\n";
        echo "  消息: {$e->getMessage()}\n";
        echo "  文件: {$e->getFile()}\n";
        echo "  行号: {$e->getLine()}\n";
    }

    echo "\n\n";
}

echo "╔═══════════════════════════════════════════════════════════════════════╗\n";
echo "║                          测试完成                                     ║\n";
echo "╚═══════════════════════════════════════════════════════════════════════╝\n";
echo "\n";

// 统计信息
echo "📈 统计信息:\n";
echo '  - 测试文件数: ' . count($testFiles) . " 个\n";
echo "  - 测试目录: {$fixturesDir}\n";
echo "\n";
