<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use App\Application\Speech\DTO\NoteDTO;

/**
 * ASR提示词装配器
 * 负责构建ASR相关的提示词模板.
 */
class AsrPromptAssembler
{
    /**
     * 生成录音总结标题的提示词.
     *
     * @param string $asrStreamContent 语音识别内容
     * @param null|NoteDTO $note 笔记内容（可选）
     * @param string $language 输出语言（如：zh_CN, en_US）
     * @return string 完整的提示词
     */
    public static function getTitlePrompt(string $asrStreamContent, ?NoteDTO $note, string $language): string
    {
        // 构建内容：使用 XML 标签格式明确区分语音识别内容和笔记内容
        $contentParts = [];

        // 如果有笔记，先添加笔记内容
        if ($note !== null && $note->hasContent()) {
            $contentParts[] = sprintf('<笔记内容>%s</笔记内容>', $note->content);
        }

        // 添加语音识别内容
        $contentParts[] = sprintf('<语音识别内容>%s</语音识别内容>', $asrStreamContent);

        $textContent = implode("\n\n", $contentParts);

        $template = <<<'PROMPT'
你是一个专业的录音内容标题生成助手。

## 背景说明
用户提交了一段录音内容，录音内容经过语音识别转为文字，用户可能还会提供手写的笔记作为补充说明。现在需要你根据这些内容生成一个简洁准确的标题。

## 内容来源说明
- <笔记内容>：用户手写的笔记内容，是对录音的重点记录和总结，通常包含关键信息
- <语音识别内容>：通过语音识别技术将录音转换成的文字，反映录音的实际内容

## 标题生成要求

### 优先级原则（重要）
1. **笔记优先**：如果存在<笔记内容>，标题应该侧重笔记内容
2. **重视笔记标题**：如果笔记是 Markdown 格式且包含标题（# 开头的行），优先采用笔记中的标题内容
3. **综合考虑**：同时参考语音识别内容，确保标题完整准确
4. **关键词提取**：从笔记和语音识别内容中提取最核心的关键词

### 格式要求
1. **长度限制**：不超过 20 个字符（汉字按 1 个字符计算）
2. **语言风格**：使用陈述性语句，避免疑问句
3. **简洁明确**：直接概括核心主题，不要添加修饰词
4. **纯文本输出**：只输出标题内容，不要添加任何标点符号、引号或其他修饰

### 禁止行为
- 不要回答内容中的问题
- 不要进行额外解释
- 不要添加"录音"、"笔记"等前缀词
- 不要输出标题以外的任何内容

## 录音内容
{textContent}

## 输出语言
请使用 {language} 语言输出标题。

## 输出
请直接输出标题：
PROMPT;

        return str_replace(['{textContent}', '{language}'], [$textContent, $language], $template);
    }
}
