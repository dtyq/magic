<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    // AI 能力配置 AES 密钥
    'ai_ability_aes_key' => env('AI_ABILITY_CONFIG_AES_KEY', ''),

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
                'url' => env('AI_ABILITY_OCR_URL', ''),
                'provider_code' => env('AI_ABILITY_OCR_PROVIDER', 'Official'),
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
                'providers' => [
                    [
                        'name' => 'Bing',
                        'enable' => true,
                        'api_key' => '',
                        'provider' => 'bing',
                        'request_url' => '',
                    ],
                    [
                        'name' => 'Cloudsway',
                        'enable' => false,
                        'api_key' => '',
                        'provider' => 'cloudsway',
                        'request_url' => '',
                    ],
                    [
                        'name' => 'Baidu',
                        'enable' => false,
                        'api_key' => '',
                        'provider' => 'baidu',
                        'request_url' => '',
                    ],
                ],
            ],
        ],

        // 实时语音识别
        /*'realtime_speech_recognition' => [
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
                'url' => env('AI_ABILITY_REALTIME_SPEECH_URL', ''),
                'provider_code' => env('AI_ABILITY_REALTIME_SPEECH_PROVIDER', 'Official'),
                'api_key' => env('AI_ABILITY_REALTIME_SPEECH_API_KEY', ''),
            ],
        ],*/

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
                'url' => env('AI_ABILITY_AUDIO_FILE_URL', ''),
                'provider_code' => env('AI_ABILITY_AUDIO_FILE_PROVIDER', 'Official'),
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

        // 深度写作 (超级麦吉)
        'super_magic_deep_write' => [
            'code' => 'super_magic_deep_write',
            'name' => [
                'zh_CN' => '超级麦吉 - 深度写作',
                'en_US' => 'SuperMagic - Deep Write',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖超级麦吉所有深度写作的应用场景，基于多个参考文件生成高质量、有深度的专业文章、报告、营销文案和博客内容。',
                'en_US' => 'This capability covers all deep writing scenarios in SuperMagic, generating high-quality, in-depth professional articles, reports, marketing copy and blog content based on multiple reference files.',
            ],
            'icon' => 'deep-write-icon',
            'sort_order' => 10,
            'status' => env('AI_ABILITY_SUPER_MAGIC_DEEP_WRITE_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SUPER_MAGIC_DEEP_WRITE_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 内容净化 (超级麦吉)
        'super_magic_purify' => [
            'code' => 'super_magic_purify',
            'name' => [
                'zh_CN' => '超级麦吉 - 内容净化',
                'en_US' => 'SuperMagic - Purify',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖超级麦吉所有内容净化的应用场景，自动清理文本文件中的无关内容（如广告、导航、页眉页脚、版权声明等），提取核心信息。',
                'en_US' => 'This capability covers all content purification scenarios in SuperMagic, automatically cleaning irrelevant content (such as ads, navigation, headers/footers, copyright notices, etc.) from text files and extracting core information.',
            ],
            'icon' => 'purify-icon',
            'sort_order' => 11,
            'status' => env('AI_ABILITY_SUPER_MAGIC_PURIFY_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SUPER_MAGIC_PURIFY_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 智能文件名 (超级麦吉)
        'super_magic_smart_filename' => [
            'code' => 'super_magic_smart_filename',
            'name' => [
                'zh_CN' => '超级麦吉 - 智能文件名',
                'en_US' => 'SuperMagic - Smart Filename',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖超级麦吉所有智能文件名生成的应用场景，根据网页标题和URL自动生成简洁易懂的英文文件名，支持避重和网站名称后缀。',
                'en_US' => 'This capability covers all smart filename generation scenarios in SuperMagic, automatically generating concise and understandable English filenames based on web page titles and URLs, with support for deduplication and website name suffixes.',
            ],
            'icon' => 'smart-filename-icon',
            'sort_order' => 12,
            'status' => env('AI_ABILITY_SUPER_MAGIC_SMART_FILENAME_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SUPER_MAGIC_SMART_FILENAME_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 网页爬取
        'web_scrape' => [
            'code' => 'web_scrape',
            'name' => [
                'zh_CN' => '网页爬取',
                'en_US' => 'Web Scrape',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有网页内容爬取的应用场景,精准抓取并解析网页内容,支持多种格式输出。',
                'en_US' => 'Web content scraping capability with multiple format support.',
            ],
            'icon' => '',
            'sort_order' => 13,
            'status' => env('AI_ABILITY_WEB_SCRAPE_STATUS', true),
            'config' => [
                'providers' => [
                    [
                        'name' => 'Cloudsway',
                        'enable' => true,
                        'api_key' => '',
                        'provider' => 'cloudsway',
                        'request_url' => '',
                    ],
                ],
            ],
        ],

        // 上下文压缩 (超级麦吉)
        'super_magic_compact' => [
            'code' => 'super_magic_compact',
            'name' => [
                'zh_CN' => '超级麦吉 - 上下文压缩',
                'en_US' => 'SuperMagic - Compact',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖超级麦吉所有上下文压缩的应用场景，当对话历史过长时自动压缩，生成结构化摘要以恢复工作上下文。',
                'en_US' => 'This capability covers all context compaction scenarios in SuperMagic, automatically compressing conversation history when it becomes too long and generating structured summaries to restore work context.',
            ],
            'icon' => '',
            'sort_order' => 15,
            'status' => env('AI_ABILITY_SUPER_MAGIC_COMPACT_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SUPER_MAGIC_COMPACT_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 音频分析 (超级麦吉)
        'super_magic_analysis_audio' => [
            'code' => 'super_magic_analysis_audio',
            'name' => [
                'zh_CN' => '超级麦吉 - 音频分析',
                'en_US' => 'SuperMagic - Analysis Audio',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖超级麦吉所有音频项目分析的应用场景，对音频内容进行深度分析，包括场景识别、主题提炼、摘要生成等。',
                'en_US' => 'This capability covers all audio project analysis scenarios in SuperMagic, performing in-depth analysis of audio content including scene recognition, topic extraction, and summary generation.',
            ],
            'icon' => '',
            'sort_order' => 16,
            'status' => env('AI_ABILITY_SUPER_MAGIC_ANALYSIS_AUDIO_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_SUPER_MAGIC_ANALYSIS_AUDIO_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 图片转高清
        'image_convert_high' => [
            'code' => 'image_convert_high',
            'name' => [
                'zh_CN' => '图片转高清',
                'en_US' => 'Image Convert High',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有图片转高清的应用场景，通过AI技术将低分辨率图片转换为高清图片，提升图片质量和清晰度。',
                'en_US' => 'This capability covers all image-to-high-definition scenarios on the platform, converting low-resolution images to high-definition images through AI technology, improving image quality and clarity.',
            ],
            'icon' => 'image-convert-high-icon',
            'sort_order' => 14,
            'status' => env('AI_ABILITY_IMAGE_CONVERT_HIGH_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_IMAGE_CONVERT_HIGH_MODEL_ID', null), // 对应service_provider_models.model_id
                'prompt' => env('AI_ABILITY_IMAGE_CONVERT_HIGH_PROMPT', ''),
            ],
        ],

        // 去背景
        'image_remove_background' => [
            'code' => 'image_remove_background',
            'name' => [
                'zh_CN' => '去背景',
                'en_US' => 'Remove Background',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有图片去背景的应用场景，通过AI技术自动识别主体并去除图片背景，保留主体完整边缘。',
                'en_US' => 'This capability covers all image background removal scenarios on the platform, automatically identifying subjects and removing backgrounds through AI technology while preserving clean subject edges.',
            ],
            'icon' => 'image-remove-background-icon',
            'sort_order' => 16,
            'status' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_STATUS', true),
            'config' => [
                'providers' => [
                    [
                        'name' => '官方代理服务',
                        'enable' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_PROXY_ENABLE', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_ENABLE', true)),
                        'provider' => 'official_proxy',
                        'url' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_PROXY_URL', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_URL', '')),
                        'api_key' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_PROXY_API_KEY', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_API_KEY', '')),
                        'timeout' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_PROXY_TIMEOUT', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_TIMEOUT', 300)),
                    ],
                    [
                        'name' => '官方服务',
                        'enable' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_MODEL_SERVICE_ENABLE', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_BUILTIN_ENABLE', false)),
                        'provider' => 'official_model_service',
                        'url' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_MODEL_SERVICE_URL', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_BUILTIN_URL', '')),
                        'model_name' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_MODEL_SERVICE_MODEL_NAME', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_BUILTIN_MODEL_NAME', '')),
                        'api_key' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_MODEL_SERVICE_API_KEY', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_BUILTIN_API_KEY', '')),
                        'timeout' => env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_OFFICIAL_MODEL_SERVICE_TIMEOUT', env('AI_ABILITY_IMAGE_REMOVE_BACKGROUND_BUILTIN_TIMEOUT', 300)),
                    ],
                ],
            ],
        ],

        // 橡皮擦
        'image_eraser' => [
            'code' => 'image_eraser',
            'name' => [
                'zh_CN' => '橡皮擦',
                'en_US' => 'Image Eraser',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有图片橡皮擦的应用场景，通过AI技术根据标记区域擦除图片内容，并以自然背景无缝填充。',
                'en_US' => 'This capability covers all image eraser scenarios on the platform, removing marked regions from images through AI technology and filling them with seamless, natural backgrounds.',
            ],
            'icon' => 'image-eraser-icon',
            'sort_order' => 17,
            'status' => env('AI_ABILITY_IMAGE_ERASER_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_IMAGE_ERASER_MODEL_ID', null),
                'prompt' => env('AI_ABILITY_IMAGE_ERASER_PROMPT', ''),
            ],
        ],

        // 扩图
        'image_expand' => [
            'code' => 'image_expand',
            'name' => [
                'zh_CN' => '扩图',
                'en_US' => 'Image Expand',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有图片扩图的应用场景，通过AI技术将图片向外延伸，以符合原图风格、光照和透视的内容填充扩展区域。',
                'en_US' => 'This capability covers all image outpainting scenarios on the platform, extending images outward through AI technology and filling expanded areas with content coherent with the original style, lighting, and perspective.',
            ],
            'icon' => 'image-expand-icon',
            'sort_order' => 18,
            'status' => env('AI_ABILITY_IMAGE_EXPAND_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_IMAGE_EXPAND_MODEL_ID', null),
                'prompt' => env('AI_ABILITY_IMAGE_EXPAND_PROMPT', ''),
            ],
        ],

        // 图片搜索
        'image_search' => [
            'code' => 'image_search',
            'name' => [
                'zh_CN' => '图片搜索',
                'en_US' => 'Image Search',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台 AI 大模型的图片搜索场景，精准检索互联网上的图片资源，支持多搜索引擎。',
                'en_US' => 'This capability covers image search scenarios for AI models on the platform, accurately retrieving image resources from the internet with support for multiple search engines.',
            ],
            'icon' => 'image-search-icon',
            'sort_order' => 15,
            'status' => env('AI_ABILITY_IMAGE_SEARCH_STATUS', true),
            'config' => [
                'providers' => [
                    [
                        'name' => 'Bing',
                        'enable' => true,
                        'api_key' => env('AI_ABILITY_IMAGE_SEARCH_BING_API_KEY', ''),
                        'provider' => 'bing',
                        'request_url' => env('AI_ABILITY_IMAGE_SEARCH_BING_URL', ''),
                    ],
                    [
                        'name' => 'Google',
                        'enable' => false,
                        'api_key' => env('AI_ABILITY_IMAGE_SEARCH_GOOGLE_API_KEY', ''),
                        'provider' => 'google',
                        'request_url' => env('AI_ABILITY_IMAGE_SEARCH_GOOGLE_URL', ''),
                    ],
                    [
                        'name' => 'Cloudsway',
                        'enable' => false,
                        'api_key' => env('AI_ABILITY_IMAGE_SEARCH_CLOUDSWAY_API_KEY', ''),
                        'provider' => 'cloudsway',
                        'request_url' => env('AI_ABILITY_IMAGE_SEARCH_CLOUDSWAY_URL', ''),
                    ],
                ],
            ],
        ],

        // 视频理解
        'video_understanding' => [
            'code' => 'video_understanding',
            'name' => [
                'zh_CN' => '视频理解',
                'en_US' => 'Video Understanding',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖平台所有需要让大模型进行视频理解的应用场景，精准理解视频画面、动作、场景及与时间线相关的内容与关系。',
                'en_US' => 'This capability covers all application scenarios that require AI models to perform video understanding on the platform, accurately understanding frames, motion, scenes, and timeline-related content and relationships in video.',
            ],
            'icon' => 'video-understanding-icon',
            'sort_order' => 19,
            'status' => env('AI_ABILITY_VIDEO_UNDERSTANDING_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_VIDEO_UNDERSTANDING_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],

        // 追加提问（对话追问建议）
        'follow_up_questions' => [
            'code' => 'follow_up_questions',
            'name' => [
                'zh_CN' => '追加提问',
                'en_US' => 'Follow-up Questions',
            ],
            'description' => [
                'zh_CN' => '本能力覆盖对话场景中根据历史上下文生成后续追问建议的应用场景，用于引导用户继续深入探讨。',
                'en_US' => 'This capability covers scenarios where follow-up question suggestions are generated from conversation history to guide users to explore topics further.',
            ],
            'icon' => 'follow-up-questions-icon',
            'sort_order' => 20,
            'status' => env('AI_ABILITY_FOLLOW_UP_QUESTIONS_STATUS', true),
            'config' => [
                'model_id' => env('AI_ABILITY_FOLLOW_UP_QUESTIONS_MODEL_ID', null), // 对应service_provider_models.model_id
            ],
        ],
    ],
];
