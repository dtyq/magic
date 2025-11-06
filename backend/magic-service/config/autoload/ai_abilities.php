<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    // 接入点配置映射
    /*'access_points' => [
        'domestic_access_points' => 'domestic_access_points',              // 中国接入点
        'international_access_point' => 'international_access_point',  // 国际接入点
    ],*/

    // 默认接入点
    'default_access_point' => env('AI_ABILITY_DEFAULT_ACCESS_POINT', ''),

    // 默认APIKEY
    'default_api_key' => env('AI_ABILITY_DEFAULT_API_KEY', ''),

    // AI 能力列表配置
    'abilities' => [
        // OCR 识别
        'ocr' => [
            'code' => 'ocr',
            'name' => [
                'zh_CN' => 'OCR 识别',
                'en_US' => 'OCR Recognition',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有 OCR 应用场景，精准捕捉并提取 PDF、扫描件及各类图片中的文字信息。',
                'en_US' => 'This capability covers all OCR application scenarios on the platform, accurately capturing and extracting text information from PDFs, scanned documents, and various images.',
            ],
            'icon' => 'ocr-icon',
            'sort_order' => 1,
            'status' => env('AI_ABILITY_OCR_STATUS', true),
            'config' => [
                'provider_code' => env('AI_ABILITY_OCR_PROVIDER', 'Official'),
                'access_point' => env('AI_ABILITY_OCR_ACCESS_POINT', null), // null 则使用默认接入点
                'api_key' => env('AI_ABILITY_OCR_API_KEY', ''),
            ],
        ],

        // 互联网搜索
        'web_search' => [
            'code' => 'web_search',
            'name' => [
                'zh_CN' => '互联网搜索',
                'en_US' => 'Web Search',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台 AI 大模型的互联网搜索场景，精准获取并整合最新的新闻、事实和数据信息。',
                'en_US' => 'This capability covers web search scenarios for AI models on the platform, accurately obtaining and integrating the latest news, facts and data information.',
            ],
            'icon' => 'web-search-icon',
            'sort_order' => 2,
            'status' => env('AI_ABILITY_WEB_SEARCH_STATUS', true),
            'config' => [
                'provider_code' => env('AI_ABILITY_WEB_SEARCH_PROVIDER', 'Official'),
                'access_point' => env('AI_ABILITY_WEB_SEARCH_ACCESS_POINT', null), // null 则使用默认接入点
                'api_key' => env('AI_ABILITY_WEB_SEARCH_API_KEY', ''),
            ],
        ],

        // 实时语音识别
        'realtime_speech_recognition' => [
            'code' => 'realtime_speech_recognition',
            'name' => [
                'zh_CN' => '实时语音识别',
                'en_US' => 'Realtime Speech Recognition',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有语音转文字的应用场景，实时监听音频流并逐步输出准确的文字内容。',
                'en_US' => 'This capability covers all speech-to-text application scenarios on the platform, monitoring audio streams in real-time and gradually outputting accurate text content.',
            ],
            'icon' => 'realtime-speech-icon',
            'sort_order' => 3,
            'status' => env('AI_ABILITY_REALTIME_SPEECH_STATUS', true),
            'config' => [
                'provider_code' => env('AI_ABILITY_REALTIME_SPEECH_PROVIDER', 'Official'),
                'access_point' => env('AI_ABILITY_REALTIME_SPEECH_ACCESS_POINT', null), // null 则使用默认接入点
                'api_key' => env('AI_ABILITY_REALTIME_SPEECH_API_KEY', ''),
            ],
        ],

        // 音频文件识别
        'audio_file_recognition' => [
            'code' => 'audio_file_recognition',
            'name' => [
                'zh_CN' => '音频文件识别',
                'en_US' => 'Audio File Recognition',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有音频文件转文字的应用场景，精准识别说话人、音频文字等信息。',
                'en_US' => 'This capability covers all audio file-to-text application scenarios on the platform, accurately identifying speakers, audio text and other information.',
            ],
            'icon' => 'audio-file-icon',
            'sort_order' => 4,
            'status' => env('AI_ABILITY_AUDIO_FILE_STATUS', true),
            'config' => [
                'provider_code' => env('AI_ABILITY_AUDIO_FILE_PROVIDER', 'Official'),
                'access_point' => env('AI_ABILITY_AUDIO_FILE_ACCESS_POINT', null), // null 则使用默认接入点
                'api_key' => env('AI_ABILITY_AUDIO_FILE_API_KEY', ''),
            ],
        ],

        // 自动补全
        'auto_completion' => [
            'code' => 'auto_completion',
            'name' => [
                'zh_CN' => '自动补全',
                'en_US' => 'Auto Completion',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有输入内容自动补全的应用场景，根据理解上下文为用户自动补全内容，由用户选择是否采纳。',
                'en_US' => 'This capability covers all input auto-completion scenarios on the platform, automatically completing content for users based on context understanding, allowing users to choose whether to accept.',
            ],
            'icon' => 'auto-completion-icon',
            'sort_order' => 5,
            'status' => env('AI_ABILITY_AUTO_COMPLETION_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_AUTO_COMPLETION_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 内容总结
        'content_summary' => [
            'code' => 'content_summary',
            'name' => [
                'zh_CN' => '内容总结',
                'en_US' => 'Content Summary',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有内容总结的应用场景，对长篇文档、报告或网页文章进行深度分析。',
                'en_US' => 'This capability covers all content summarization scenarios on the platform, performing in-depth analysis of long documents, reports or web articles.',
            ],
            'icon' => 'content-summary-icon',
            'sort_order' => 6,
            'status' => env('AI_ABILITY_CONTENT_SUMMARY_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_CONTENT_SUMMARY_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 视觉理解
        'visual_understanding' => [
            'code' => 'visual_understanding',
            'name' => [
                'zh_CN' => '视觉理解',
                'en_US' => 'Visual Understanding',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有需要让大模型进行视觉理解的应用场景，精准理解各种图像中的内容以及复杂关系。',
                'en_US' => 'This capability covers all application scenarios that require AI models to perform visual understanding on the platform, accurately understanding content and complex relationships in various images.',
            ],
            'icon' => 'visual-understanding-icon',
            'sort_order' => 7,
            'status' => env('AI_ABILITY_VISUAL_UNDERSTANDING_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_VISUAL_UNDERSTANDING_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 智能重命名
        'smart_rename' => [
            'code' => 'smart_rename',
            'name' => [
                'zh_CN' => '智能重命名',
                'en_US' => 'Smart Rename',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有支持 AI 重命名的应用场景，根据理解上下文为用户自动进行内容标题的命名。',
                'en_US' => 'This capability covers all AI renaming scenarios on the platform, automatically naming content titles for users based on context understanding.',
            ],
            'icon' => 'smart-rename-icon',
            'sort_order' => 8,
            'status' => env('AI_ABILITY_SMART_RENAME_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SMART_RENAME_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // AI 优化
        'ai_optimization' => [
            'code' => 'ai_optimization',
            'name' => [
                'zh_CN' => 'AI 优化',
                'en_US' => 'AI Optimization',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有支持 AI 优化内容的应用场景，根据理解上下文为用户自动对内容进行优化。',
                'en_US' => 'This capability covers all AI content optimization scenarios on the platform, automatically optimizing content for users based on context understanding.',
            ],
            'icon' => 'ai-optimization-icon',
            'sort_order' => 9,
            'status' => env('AI_ABILITY_AI_OPTIMIZATION_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_AI_OPTIMIZATION_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],
    ],
];
