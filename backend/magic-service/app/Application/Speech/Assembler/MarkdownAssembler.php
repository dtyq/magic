<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

/**
 * Markdown装配器
 * 负责处理ASR相关的Markdown文件格式化.
 */
class MarkdownAssembler
{
    /**
     * 转录内容 Markdown 模板
     * 使用占位符，便于直观查看排版效果.
     */
    private const TRANSCRIPTION_TEMPLATE = <<<'MARKDOWN'
# {{title}}

**{{taskIdLabel}}**: `{{taskKey}}`

**{{generateTimeLabel}}**: {{generateTime}}

## {{contentTitle}}

{{content}}

MARKDOWN;

    /**
     * 总结内容 Markdown 模板
     * 使用占位符，便于直观查看排版效果.
     */
    private const SUMMARY_TEMPLATE = <<<'MARKDOWN'
# {{title}}

**{{taskIdLabel}}**: `{{taskKey}}`

**{{generateTimeLabel}}**: {{generateTime}}

## {{contentTitle}}

{{content}}

MARKDOWN;

    /**
     * 构建转录内容的 Markdown（使用模板）.
     *
     * @param string $taskKey 任务键
     * @param string $transcriptionContent 转录内容
     * @param string $title 文档标题
     * @param string $taskIdLabel 任务ID标签
     * @param string $generateTimeLabel 生成时间标签
     * @param string $contentTitle 内容标题
     * @return string 格式化后的Markdown内容
     */
    public function buildTranscriptionMarkdown(
        string $taskKey,
        string $transcriptionContent,
        string $title = '录音转文字',
        string $taskIdLabel = '任务ID',
        string $generateTimeLabel = '生成时间',
        string $contentTitle = '转录内容'
    ): string {
        return $this->renderTemplate(self::TRANSCRIPTION_TEMPLATE, [
            'title' => $title,
            'taskIdLabel' => $taskIdLabel,
            'taskKey' => $taskKey,
            'generateTimeLabel' => $generateTimeLabel,
            'generateTime' => date('Y-m-d H:i:s'),
            'contentTitle' => $contentTitle,
            'content' => $this->formatContent($transcriptionContent),
        ]);
    }

    /**
     * 构建总结内容的 Markdown（使用模板）.
     *
     * @param string $taskKey 任务键
     * @param string $summaryContent 总结内容
     * @param string $title 文档标题
     * @param string $taskIdLabel 任务ID标签
     * @param string $generateTimeLabel 生成时间标签
     * @param string $contentTitle 内容标题
     * @return string 格式化后的Markdown内容
     */
    public function buildSummaryMarkdown(
        string $taskKey,
        string $summaryContent,
        string $title = 'AI总结',
        string $taskIdLabel = '任务ID',
        string $generateTimeLabel = '生成时间',
        string $contentTitle = '总结内容'
    ): string {
        return $this->renderTemplate(self::SUMMARY_TEMPLATE, [
            'title' => $title,
            'taskIdLabel' => $taskIdLabel,
            'taskKey' => $taskKey,
            'generateTimeLabel' => $generateTimeLabel,
            'generateTime' => date('Y-m-d H:i:s'),
            'contentTitle' => $contentTitle,
            'content' => $this->formatContent($summaryContent),
        ]);
    }

    /**
     * 获取转录内容模板（用于预览）.
     *
     * @return string 模板字符串
     */
    public function getTranscriptionTemplate(): string
    {
        return self::TRANSCRIPTION_TEMPLATE;
    }

    /**
     * 获取总结内容模板（用于预览）.
     *
     * @return string 模板字符串
     */
    public function getSummaryTemplate(): string
    {
        return self::SUMMARY_TEMPLATE;
    }

    /**
     * 验证Markdown内容格式.
     *
     * @param string $content Markdown内容
     * @return array 验证结果 ['valid' => bool, 'issues' => string[]]
     */
    public function validateMarkdown(string $content): array
    {
        $issues = [];

        // 检查标题层级
        if (preg_match_all('/^(#{1,6})\s/m', $content, $matches)) {
            $levels = array_map('strlen', $matches[1]);
            if (! empty($levels) && min($levels) > 1) {
                $issues[] = '文档应该以一级标题(#)开始';
            }
        }

        // 检查空行
        if (! preg_match('/\n\n/', $content)) {
            $issues[] = '段落之间应该有空行分隔';
        }

        // 检查文档结尾
        if (! str_ends_with($content, "\n")) {
            $issues[] = '文档应该以换行符结尾';
        }

        return [
            'valid' => empty($issues),
            'issues' => $issues,
        ];
    }

    /**
     * 渲染模板，替换变量占位符.
     *
     * @param string $template 模板字符串
     * @param array $variables 变量数组 ['key' => 'value']
     * @return string 渲染后的内容
     */
    private function renderTemplate(string $template, array $variables): string
    {
        $content = $template;

        foreach ($variables as $key => $value) {
            // 转义除了 content 之外的其他变量（content 可能已经包含 Markdown 格式）
            if ($key !== 'content') {
                $value = $this->escapeMarkdown((string) $value);
            }

            $placeholder = '{{' . $key . '}}';
            $content = str_replace($placeholder, (string) $value, $content);
        }

        return $content;
    }

    /**
     * 格式化内容，确保符合Markdown规范.
     *
     * @param string $content 原始内容
     * @return string 格式化后的内容
     */
    private function formatContent(string $content): string
    {
        if (empty($content)) {
            return "*暂无内容*\n\n";
        }

        // 清理内容：移除多余的空白字符
        $content = trim($content);

        // 如果内容已经是Markdown格式（包含标题），直接返回
        if ($this->isMarkdownContent($content)) {
            return $content . "\n\n";
        }

        // 将普通文本转换为段落格式
        $paragraphs = explode("\n\n", $content);
        $formattedParagraphs = [];

        foreach ($paragraphs as $paragraph) {
            $paragraph = trim($paragraph);
            if (! empty($paragraph)) {
                // 如果段落不是以标题开头，确保它是一个正确的段落
                if (! preg_match('/^#{1,6}\s/', $paragraph)) {
                    // 将单个换行符替换为空格，保持段落格式
                    $paragraph = preg_replace('/\n(?!\n)/', ' ', $paragraph);
                }
                $formattedParagraphs[] = $paragraph;
            }
        }

        return implode("\n\n", $formattedParagraphs) . "\n\n";
    }

    /**
     * 检查内容是否已经是Markdown格式.
     *
     * @param string $content 内容
     * @return bool 是否已经是Markdown格式
     */
    private function isMarkdownContent(string $content): bool
    {
        // 检查是否包含Markdown标题、列表等格式
        return preg_match('/^#{1,6}\s/', $content)
               || preg_match('/^\*\*\w+\*\*/', $content)
               || preg_match('/^[-*+]\s/', $content)
               || preg_match('/^\d+\.\s/', $content);
    }

    /**
     * 转义Markdown特殊字符.
     *
     * @param string $text 要转义的文本
     * @return string 转义后的文本
     */
    private function escapeMarkdown(string $text): string
    {
        // 转义Markdown中的特殊字符
        $specialChars = ['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '-', '.', '!', '|'];

        foreach ($specialChars as $char) {
            $text = str_replace($char, '\\' . $char, $text);
        }

        return $text;
    }
}
