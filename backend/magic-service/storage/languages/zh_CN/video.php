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
        'model_resolution_not_supported' => '当前模型（:model）暂不支持 :resolution，请改为 :supported 后重试。',

        // volcengine ark
        'SensitiveContentDetected' => '输入或生成内容可能包含敏感信息，请调整提示词或素材后重试。',
        'InputTextSensitiveContentDetected' => [
            'PolicyViolation' => '输入提示词可能涉及版权相关限制，请删除明星、IP、品牌等描述后重试。',
        ],
        'InputImageSensitiveContentDetected' => [
            'PolicyViolation' => '输入图片可能涉及版权相关限制，请更换无版权风险素材后重试。',
            'PrivacyInformation' => '输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。',
        ],
        'InputVideoSensitiveContentDetected' => [
            'PolicyViolation' => '输入视频可能涉及版权相关限制，请更换无版权风险素材后重试。',
            'PrivacyInformation' => '输入视频可能包含真人或人脸，请更换无真人、无肖像的素材后再试。',
        ],
        'InputAudioSensitiveContentDetected' => [
            'PolicyViolation' => '输入音频可能涉及版权相关限制，请更换无版权风险音频后重试。',
        ],
        'OutputTextSensitiveContentDetected' => '生成内容可能包含敏感信息，请调整提示词后重试。',
        'OutputImageSensitiveContentDetected' => '生成图片可能包含敏感或受限内容，请调整提示词或参考素材后重试。',
        'OutputVideoSensitiveContentDetected' => [
            'PolicyViolation' => '生成视频可能涉及版权相关限制，请调整提示词、音频或参考素材后重试。',
        ],
        'OutputAudioSensitiveContentDetected' => '生成音频可能包含敏感或受限内容，请调整提示词或参考素材后重试。',
        'ContentSecurity' => [
            'CopyrightRisk' => '当前内容可能涉及版权风险，请替换无版权音频或删除提示词中的明星、IP、品牌信息后重试。',
            'SensitiveContent' => '输入内容可能包含敏感信息，请简化提示词并删除违规、低俗、政治或擦边内容后重试。',
            'TrademarkRisk' => '素材中可能包含品牌 Logo 或商标，请裁剪、模糊标识或更换无标识素材后重试。',
            'ViolentContent' => '输入内容可能包含暴力或不适画面，请更换合规素材后重试。',
        ],
        'MissingParameter' => '缺少必要请求参数，请检查后重试。',
        'InvalidParameter' => [
            'InvalidVideoDuration' => '当前视频时长不受支持，请改为官方支持的时长档位后重试。',
            'InvalidResolution' => '当前分辨率不受支持，请改为 480p 或 720p 后重试。',
            'EmptyInput' => '未检测到有效的图片、视频或音频素材，请确认素材上传成功后重试。',
        ],
        'InvalidRequestError' => '请求格式不合法，请检查请求体后重试。',
        'InvalidArgumentError' => '请求参数内容不合法，请检查后重试。',
        /*   'InvalidEndpointOrModel' => [
            'NotFound' => '模型或推理接入点不存在，或当前账号无权限访问，请检查模型配置后重试。',
            'ModelIDAccessDisabled' => '当前账号不允许通过模型 ID 直接访问该模型，请改用已授权的推理接入点后重试。',
        ],
        'ModelNotOpen' => '当前账号尚未开通该模型服务，请先在火山方舟控制台开通后重试。',
        'NotFound' => '请求的资源不存在，请检查资源标识后重试。',
        'UnsupportedModel' => '当前模型不支持该能力，请更换支持该能力的模型后重试。',
        'AuthenticationError' => '鉴权失败，请检查 API Key 或鉴权信息后重试。',
        'AccessDenied' => '当前账号无权访问该资源，请检查权限配置后重试。',
        'OperationDenied' => [
            'PermissionDenied' => '当前账号无权访问该模型配置，请检查权限后重试。',
            'CustomizationNotSupported' => '当前模型版本不支持该定制化能力，请更换支持的模型版本后重试。',
            'ServiceNotOpen' => '模型服务尚未开通，请先在火山方舟控制台开通后重试。',
            'ServiceOverdue' => '当前账号欠费，暂时无法调用该服务，请充值后重试。',
            'InvalidState' => '目标资源当前状态不可用，请稍后重试。',
            'UnsupportedPhase' => '目标资源当前处于特殊状态，暂不支持该操作，请稍后重试。',
            'FileQuotaExceeded' => '当前账号文件存储配额已用尽，请清理历史文件后重试。',
        ],
        'AccountOverdueError' => '当前账号已欠费，请充值后重试。',
        'RateLimitExceeded' => [
            'EndpointRPMExceeded' => '当前推理接入点的 RPM 限额已超出，请稍后重试。',
            'EndpointTPMExceeded' => '当前推理接入点的 TPM 限额已超出，请稍后重试。',
        ],
        'ModelAccountRpmRateLimitExceeded' => '当前模型的 RPM 限额已超出，请稍后重试。',
        'ModelAccountTpmRateLimitExceeded' => '当前模型的 TPM 限额已超出，请稍后重试。',
        'APIAccountRpmRateLimitExceeded' => '当前接口的 RPM 限额已超出，请稍后重试。',
        'ModelAccountIpmRateLimitExceeded' => '当前模型的 IPM 限额已超出，请稍后重试。',
        'RequestConcurrentLimitExceeded' => '当前并发请求数已达上限，请稍后重试。',
        'RequestBurstTooFast' => '短时间内请求过快，请降低请求频率后重试。',
        'SetLimitExceeded' => '当前模型已触达安全体验模式的限额，请调整限额或关闭安全体验模式后重试。',
        'InflightBatchsizeExceeded' => '当前并发额度已达上限，请降低并发或充值提升额度后重试。',
        'AccountRateLimitExceeded' => '请求已超过 RPM 或 TPM 限额，请稍后重试。',
        'QuotaExceeded' => '用量已超过当前配额限制，请等待额度重置后重试。',*/
        'ServerOverloaded' => '当前服务繁忙，请稍后重试。',
        'InternalServiceError' => '服务内部异常，请稍后重试。',
        'InvalidFileFormat' => '素材格式不受支持，请使用 JPG/PNG 图片、MP4 视频或 MP3/WAV 音频后重试。',
        'FileSizeTooLarge' => '素材文件大小超出限制，请压缩后重试。',
        'AudioDurationTooLong' => '音频时长长于生成视频时长，请裁剪音频后重试。',
    ],
];
