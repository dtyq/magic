<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'input_modes' => [
        'standard' => '普通文生视频模式，不依赖任何参考素材。',
        'omni_reference' => '上传1~:max_count 份图 / 视 / 音参考素材，搭配文字指令，自由联动多元素生成专属互动创意。示例：综合 @图片 1的主体、@视频 3的动态、@音频 2的音色，融合1~:max_count 份素材，生成一段氛围感短片。',
        'keyframe_guided' => [
            'start_end' => '用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。',
            'start_only' => '用首帧定格起点，搭配文字描述，让 AI 为画面赋予动态，生成连贯的视频故事。',
        ],
        'image_reference' => [
            'single' => '上传 1 张参考图，搭配文字，生成高度匹配视频。示例：参考 @图片 1，生成动态视频。',
            'multiple' => '上传1~:max_count 张参考图片，搭配文字描述，让 AI 精准融合多图素材，生成与原图风格、主体及内容高度一致的视频。示例：参考 @图片 1 风格、@图片 2 场景，生成自然流畅的动态视频。',
        ],
    ],
    'errors' => [
        'generic' => '视频生成失败，请检查输入内容或稍后重试。',
        'user_concurrency_limit' => '您的视频生成任务已达到同时运行上限（最多 :limit 个），请等待已有任务完成后再提交。',
        'organization_concurrency_limit' => '当前组织的视频生成任务已达到同时运行上限（最多 :limit 个），请等待组织内已有任务完成后再提交。',
        'volcengine' => [
            'InputVideoSensitiveContentDetected' => [
                'PrivacyInformation' => '输入视频或图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。',
            ],
            'ContentSecurity' => [
                'CopyrightRisk' => '当前内容可能涉及版权风险，请替换无版权音频或删除提示词中的明星、IP、品牌信息后重试。',
                'SensitiveContent' => '输入内容可能包含敏感信息，请简化提示词并删除违规、低俗、政治或擦边内容后重试。',
                'TrademarkRisk' => '素材中可能包含品牌 Logo 或商标，请裁剪、模糊标识或更换无标识素材后重试。',
                'ViolentContent' => '输入内容可能包含暴力或不适画面，请更换合规素材后重试。',
            ],
            'InvalidParameter' => [
                'InvalidVideoDuration' => '当前视频时长不受支持，请改为官方支持的时长档位后重试。',
                'InvalidResolution' => '当前分辨率不受支持，请改为 480p 或 720p 后重试。',
                'EmptyInput' => '未检测到有效的图片、视频或音频素材，请确认素材上传成功后重试。',
            ],
            'InvalidFileFormat' => '素材格式不受支持，请使用 JPG/PNG 图片、MP4 视频或 MP3/WAV 音频后重试。',
            'FileSizeTooLarge' => '素材文件大小超出限制，请压缩后重试。',
            'AudioDurationTooLong' => '音频时长长于生成视频时长，请裁剪音频后重试。',
        ],
    ],
];
