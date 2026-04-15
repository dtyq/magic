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
    case Unknown = 'unknown';                          // 未知能力
    case Ocr = 'ocr';                                      // OCR 识别
    case WebSearch = 'web_search';                         // 互联网搜索
    case ImageSearch = 'image_search';                     // 图片搜索

    //    case RealtimeSpeechRecognition = 'realtime_speech_recognition';  // 实时语音识别
    case AudioFileRecognition = 'audio_file_recognition';  // 音频文件识别
    case AutoCompletion = 'auto_completion';               // 自动补全
    case ContentSummary = 'content_summary';               // 内容总结
    case VisualUnderstanding = 'visual_understanding';     // 视觉理解
    case SmartRename = 'smart_rename';                     // 智能重命名
    case AiOptimization = 'ai_optimization';               // AI 优化
    case DeepWrite = 'super_magic_deep_write';             // 深度写作 (超级麦吉)
    case Purify = 'super_magic_purify';                    // 内容净化 (超级麦吉)
    case SmartFilename = 'super_magic_smart_filename';     // 智能文件名 (超级麦吉)
    case Compact = 'super_magic_compact';                  // 上下文压缩 (超级麦吉)
    case AnalysisAudio = 'super_magic_analysis_audio';     // 音频分析 (超级麦吉)
    case WebScrape = 'web_scrape';                         // 网页爬取
    case ImageConvertHigh = 'image_convert_high';          // 图片转高清
    case ImageRemoveBackground = 'image_remove_background'; // 去背景
    case ImageEraser = 'image_eraser';                     // 橡皮擦
    case ImageExpand = 'image_expand';                     // 扩图

    /**
     * 获取能力名称.
     */
    public function label(): string
    {
        return match ($this) {
            self::Ocr => 'OCR 识别',
            self::WebSearch => '互联网搜索',
            self::ImageSearch => '图片搜索',
            //            self::RealtimeSpeechRecognition => '实时语音识别',
            self::AudioFileRecognition => '音频文件识别',
            self::AutoCompletion => '自动补全',
            self::ContentSummary => '内容总结',
            self::VisualUnderstanding => '视觉理解',
            self::SmartRename => '智能重命名',
            self::AiOptimization => 'AI 优化',
            self::DeepWrite => '超级麦吉 - 深度写作',
            self::Purify => '超级麦吉 - 文本净化',
            self::SmartFilename => '超级麦吉 - 智能文件名',
            self::Compact => '超级麦吉 - 上下文压缩',
            self::AnalysisAudio => '超级麦吉 - 音频分析',
            self::WebScrape => '网页爬取',
            self::ImageConvertHigh => '图片转高清',
            self::ImageRemoveBackground => '去背景',
            self::ImageEraser => '橡皮擦',
            self::ImageExpand => '扩图',
            default => 'Unknown',
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
            self::ImageSearch => '本能力覆盖平台 AI 大模型的图片搜索场景，精准检索互联网上的图片资源，支持多搜索引擎。',
            //            self::RealtimeSpeechRecognition => '本能力覆盖平台所有语音转文字的应用场景，实时监听音频流并逐步输出准确的文字内容。',
            self::AudioFileRecognition => '本能力覆盖平台所有音频文件转文字的应用场景，精准识别说话人、音频文字等信息。',
            self::AutoCompletion => '本能力覆盖平台所有输入内容自动补全的应用场景，根据理解上下文为用户自动补全内容，由用户选择是否采纳。',
            self::ContentSummary => '本能力覆盖平台所有内容总结的应用场景，对长篇文档、报告或网页文章进行深度分析。',
            self::VisualUnderstanding => '本能力覆盖平台所有需要让大模型进行视觉理解的应用场景，精准理解各种图像中的内容以及复杂关系。',
            self::SmartRename => '本能力覆盖平台所有支持 AI 重命名的应用场景，根据理解上下文为用户自动进行内容标题的命名。',
            self::AiOptimization => '本能力覆盖平台所有支持 AI 优化内容的应用场景，根据理解上下文为用户自动对内容进行优化。',
            self::DeepWrite => '本能力覆盖超级麦吉所有深度写作的应用场景，基于多个参考文件生成高质量、有深度的专业文章、报告、营销文案和博客内容。',
            self::Purify => '本能力覆盖超级麦吉所有内容净化的应用场景，自动清理文本文件中的无关内容（如广告、导航、页眉页脚、版权声明等），提取核心信息。',
            self::SmartFilename => '本能力覆盖超级麦吉所有智能文件名生成的应用场景，根据网页标题和URL自动生成简洁易懂的英文文件名，支持避重和网站名称后缀。',
            self::Compact => '本能力覆盖超级麦吉所有上下文压缩的应用场景，当对话历史过长时自动压缩，生成结构化摘要以恢复工作上下文。',
            self::AnalysisAudio => '本能力覆盖超级麦吉所有音频项目分析的应用场景，对音频内容进行深度分析，包括场景识别、主题提炼、摘要生成等。',
            self::WebScrape => '本能力覆盖平台所有网页内容爬取的应用场景，精准抓取并解析网页内容，支持多种格式输出。',
            self::ImageConvertHigh => '本能力覆盖平台所有图片转高清的应用场景，通过AI技术将低分辨率图片转换为高清图片，提升图片质量和清晰度。',
            self::ImageRemoveBackground => '本能力覆盖平台所有图片去背景的应用场景，通过AI技术自动识别主体并去除图片背景，保留主体完整边缘。',
            self::ImageEraser => '本能力覆盖平台所有图片橡皮擦的应用场景，通过AI技术根据标记区域擦除图片内容，并以自然背景无缝填充。',
            self::ImageExpand => '本能力覆盖平台所有图片扩图的应用场景，通过AI技术将图片向外延伸，以符合原图风格、光照和透视的内容填充扩展区域。',
            default => 'Unknown',
        };
    }

    /**
     * 获取需要脱敏的字段列表.
     *
     * @return array<string> 需要脱敏的字段名称数组
     */
    public function getSensitiveFields(): array
    {
        return match ($this) {
            self::WebSearch => ['api_key'],
            self::ImageSearch => ['api_key'],
            self::ImageRemoveBackground => ['api_key'],
            self::Ocr => ['access_key', 'secret_key'],
            self::AudioFileRecognition => ['app_key', 'access_key', 'cluster'],
            default => [],
        };
    }
}
