<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'model_aes_key' => env('SERVICE_PROVIDER_CONFIG_AES_KEY', ''),
    'office_organization' => env('OFFICE_ORGANIZATION', 'DT001'),
    'office_organization_name' => parse_json_config(env('OFFICE_ORGANIZATION_NAME', '{"zh_CN":"官方组织","en_US":"Official Organization"}')) ?: [
        'zh_CN' => '官方组织',
        'en_US' => 'Official Organization',
    ],
    'llm_model_file' => env('LLM_MODEL_FILE', BASE_PATH . '/storage/model/llm-models.json'),
    'official_agents' => [
        [
            'code' => 'data_analysis',
            'name_i18n' => [
                'default' => 'Analysis',
                'en_US' => 'Analysis',
                'zh_CN' => '数据分析专家',
            ],
            'role_i18n' => [
                'default' => [
                    'Collect & clean data, model & mine value, deliver visual reports & suggestions',
                ],
                'en_US' => [
                    'Collect & clean data, model & mine value, deliver visual reports & suggestions',
                ],
                'zh_CN' => [
                    '智能清洗数据，建模分析挖掘价值，输出可视化报告与决策建议',
                ],
            ],
            'description_i18n' => [
                'default' => 'You can select data sources or upload Excel files, and then enter the requirements for analysis. Super Magic will perform comprehensive data analysis for you. Enter to send; Shift + Enter to line break',
                'en_US' => 'You can select data sources or upload Excel files, and then enter the requirements for analysis. Super Magic will perform comprehensive data analysis for you. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可选择数据源或上传 Excel 文件后，输入需要分析的需求，超级麦吉将为您进行全面的数据分析。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconChartBarPopular',
            'icon_url' => '',
            'color' => '#ECF9EC',
            'sort_order' => 999,
        ],
        [
            'code' => 'design',
            'name_i18n' => [
                'default' => 'Designer',
                'en_US' => 'Designer',
                'zh_CN' => '设计专家',
            ],
            'role_i18n' => [
                'default' => [
                    'Lead visual design, control style & tone, deliver high-quality creative solutions',
                ],
                'en_US' => [
                    'Lead visual design, control style & tone, deliver high-quality creative solutions',
                ],
                'zh_CN' => [
                    '主导品牌 / 产品视觉设计，把控风格调性，输出高质量创意设计方案',
                ],
            ],
            'description_i18n' => [
                'default' => 'What\'s on your mind? Tell me an idea like \'neon cyberpunk coffee branding\', or upload an image to edit backgrounds, adjust colors, and reimagine styles.',
                'en_US' => 'What\'s on your mind? Tell me an idea like \'neon cyberpunk coffee branding\', or upload an image to edit backgrounds, adjust colors, and reimagine styles.',
                'zh_CN' => '嗨！想一起创造点什么？你可以描述灵感，如\'设计赛博朋克风咖啡包装，要有霓虹感\'；或上传图片，让我帮你换背景、调色或转风格。\nEnter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconComponents',
            'icon_url' => '',
            'color' => '#EEF9FC',
            'sort_order' => 996,
        ],
        [
            'code' => 'general',
            'name_i18n' => [
                'default' => 'SuperMagic',
                'en_US' => 'SuperMagic',
                'zh_CN' => '超级麦吉',
            ],
            'role_i18n' => [
                'default' => [
                    'An all-scenario intelligent expert dedicated to precise information retrieval, in-depth logical analysis, and efficient document processing, serving as your reliable digital office assistant.',
                ],
                'en_US' => [
                    'An all-scenario intelligent expert dedicated to precise information retrieval, in-depth logical analysis, and efficient document processing, serving as your reliable digital office assistant.',
                ],
                'zh_CN' => [
                    '全场景智能专家，专注提供精准的信息检索、深度的逻辑分析及高效的文件处理服务等场景，是您值得信赖的数字化办公助手',
                ],
            ],
            'description_i18n' => [
                'default' => 'SuperMagic, your all-scenario intelligent expert. We focus on delivering precise information retrieval, in-depth logical analysis, and efficient document processing services. Simply enter your request or upload a file, and I will immediately provide you with the optimal solution — your trusted core for digital office work.',
                'en_US' => 'SuperMagic, your all-scenario intelligent expert. We focus on delivering precise information retrieval, in-depth logical analysis, and efficient document processing services. Simply enter your request or upload a file, and I will immediately provide you with the optimal solution — your trusted core for digital office work.',
                'zh_CN' => '超级麦吉，您的全场景智能专家。专注提供精准的信息检索、深度的逻辑分析及高效的文件处理服务。只需输入需求或上传文件，我将即刻为您提供最优解决方案，是您值得信赖的数字化办公核心。',
            ],
            'icon' => 'IconSuperMagic',
            'icon_url' => '',
            'color' => '#EEF3FD',
            'sort_order' => 1000,
        ],
        [
            'code' => 'ppt',
            'name_i18n' => [
                'default' => 'PPT Specialist',
                'en_US' => 'PPT Specialist',
                'zh_CN' => 'PPT制作专家',
            ],
            'role_i18n' => [
                'default' => [
                    'Plan, design PPT layout & visuals, deliver professional & logical presentations',
                ],
                'en_US' => [
                    'Plan, design PPT layout & visuals, deliver professional & logical presentations',
                ],
                'zh_CN' => [
                    '负责 PPT 策划、排版与视觉设计，输出专业美观、逻辑清晰的演示文稿',
                ],
            ],
            'description_i18n' => [
                'default' => 'You can enter the theme and specific requirements of the PPT, or upload files, Super Magic will help you create a beautiful PPT. Enter to send; Shift + Enter to line break',
                'en_US' => 'You can enter the theme and specific requirements of the PPT, or upload files, Super Magic will help you create a beautiful PPT. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可输入 PPT 的主题和具体要求，或上传文件，超级麦吉将为您制作精美的 PPT。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconPresentation',
            'icon_url' => '',
            'color' => '#FFF8EB',
            'sort_order' => 998,
        ],
        [
            'code' => 'summary',
            'name_i18n' => [
                'default' => 'Recording Summary Specialist',
                'en_US' => 'Recording Summary Specialist',
                'zh_CN' => '录音总结专家',
            ],
            'role_i18n' => [
                'default' => [
                    'Transcribe audio accurately, extract key points, form concise professional summaries',
                ],
                'en_US' => [
                    'Transcribe audio accurately, extract key points, form concise professional summaries',
                ],
                'zh_CN' => [
                    '对音频录音精准转写，提炼核心要点，形成简洁专业的文字总结',
                ],
            ],
            'description_i18n' => [
                'default' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                'en_US' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可输入会议的文字内容，或上传会议录音文件，我将为您进行完整的会议总结。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconFileDescription',
            'icon_url' => '',
            'color' => '#F1EEFC',
            'sort_order' => 997,
        ],
    ],
];
