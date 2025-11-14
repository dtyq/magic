<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * AI 能力代码枚举.
 */
enum AiAbilityCode: string
{
    case Ocr = 'ocr';                                      // OCR 识别
    case WebSearch = 'web_search';                         // 互联网搜索
    case RealtimeSpeechRecognition = 'realtime_speech_recognition';  // 实时语音识别
    case AudioFileRecognition = 'audio_file_recognition';  // 音频文件识别
    case AutoCompletion = 'auto_completion';               // 自动补全
    case ContentSummary = 'content_summary';               // 内容总结
    case VisualUnderstanding = 'visual_understanding';     // 视觉理解
    case SmartRename = 'smart_rename';                     // 智能重命名
    case AiOptimization = 'ai_optimization';               // AI 优化

    /**
     * 获取能力名称.
     */
    public function label(): string
    {
        return match ($this) {
            self::Ocr => 'OCR 识别',
            self::WebSearch => '互联网搜索',
            self::RealtimeSpeechRecognition => '实时语音识别',
            self::AudioFileRecognition => '音频文件识别',
            self::AutoCompletion => '自动补全',
            self::ContentSummary => '内容总结',
            self::VisualUnderstanding => '视觉理解',
            self::SmartRename => '智能重命名',
            self::AiOptimization => 'AI 优化',
        };
    }

    /**
     * 获取能力描述.
     */
    public function description(): string
    {
        return match ($this) {
            self::Ocr => '本能力覆盖平台所有 OCR 应用场景，精准捕捉并提取 PDF、扫描件及各类图片中的文字信息。',
            self::WebSearch => '本能力覆盖平台 AI 大模型的互联网搜索场景，精准获取并整合最新的新闻、事实和数据信息。',
            self::RealtimeSpeechRecognition => '本能力覆盖平台所有语音转文字的应用场景，实时监听音频流并逐步输出准确的文字内容。',
            self::AudioFileRecognition => '本能力覆盖平台所有音频文件转文字的应用场景，精准识别说话人、音频文字等信息。',
            self::AutoCompletion => '本能力覆盖平台所有输入内容自动补全的应用场景，根据理解上下文为用户自动补全内容，由用户选择是否采纳。',
            self::ContentSummary => '本能力覆盖平台所有内容总结的应用场景，对长篇文档、报告或网页文章进行深度分析。',
            self::VisualUnderstanding => '本能力覆盖平台所有需要让大模型进行视觉理解的应用场景，精准理解各种图像中的内容以及复杂关系。',
            self::SmartRename => '本能力覆盖平台所有支持 AI 重命名的应用场景，根据理解上下文为用户自动进行内容标题的命名。',
            self::AiOptimization => '本能力覆盖平台所有支持 AI 优化内容的应用场景，根据理解上下文为用户自动对内容进行优化。',
        };
    }
}
