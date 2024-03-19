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
            'name_i18n' => ['en_US' => 'Analysis', 'zh_CN' => '数据分析'],
            'description_i18n' => [
                'en_US' => 'You can select data sources or upload Excel files, and then enter the requirements for analysis. Super Magic will perform comprehensive data analysis for you. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可选择数据源或上传 Excel 文件后，输入需要分析的需求，超级麦吉将为您进行全面的数据分析。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconChartBarPopular',
            'icon_url' => '',
            'color' => '#ECF9EC',
            'sort_order' => 99,
        ],
        [
            'code' => 'design',
            'name_i18n' => ['en_US' => 'Design', 'zh_CN' => '设计模式'],
            'description_i18n' => [
                'en_US' => 'What\'s on your mind? Tell me an idea like \'neon cyberpunk coffee branding\', or upload an image to edit backgrounds, adjust colors, and reimagine styles.',
                'zh_CN' => '嗨！想一起创造点什么？你可以描述灵感，如\'设计赛博朋克风咖啡包装，要有霓虹感\'；或上传图片，让我帮你换背景、调色或转风格。\nEnter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconComponents',
            'icon_url' => '',
            'color' => '#EEF9FC',
            'sort_order' => 0,
        ],
        [
            'code' => 'general',
            'name_i18n' => ['en_US' => 'General', 'zh_CN' => '通用模式'],
            'description_i18n' => [
                'en_US' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                'zh_CN' => '请输入您的需求，或上传文件，超级麦吉将为您解决问题。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconSuperMagic',
            'icon_url' => '',
            'color' => '#EEF3FD',
            'sort_order' => 10000,
        ],
        [
            'code' => 'ppt',
            'name_i18n' => ['en_US' => 'Silde', 'zh_CN' => 'PPT 模式'],
            'description_i18n' => [
                'en_US' => 'You can enter the theme and specific requirements of the PPT, or upload files, Super Magic will help you create a beautiful PPT. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可输入 PPT 的主题和具体要求，或上传文件，超级麦吉将为您制作精美的 PPT。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconPresentation',
            'icon_url' => '',
            'color' => '#FFF8EB',
            'sort_order' => 98,
        ],
        [
            'code' => 'summary',
            'name_i18n' => ['en_US' => 'Audio Notes', 'zh_CN' => '录音总结'],
            'description_i18n' => [
                'en_US' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                'zh_CN' => '您可输入会议的文字内容，或上传会议录音文件，超级麦吉将为您进行完整的会议总结。 Enter 发送 ; Shift + Enter 换行',
            ],
            'icon' => 'IconFileDescription',
            'icon_url' => '',
            'color' => '#F1EEFC',
            'sort_order' => 97,
        ],
    ],
];
