<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Provider\DTO\Item\BillingType;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

return [
    'templates' => [
        [
            'code' => BillingType::TextTokens->value,
            'label' => '文本 Token 计费',
            'category' => Category::LLM->value,
            'billing_type' => BillingType::TextTokens->value,
            'items' => [
                [
                    'billing_object' => BillingObject::INPUT_TOKEN,
                    'label' => '输入 Token',
                ],
                [
                    'billing_object' => BillingObject::INPUT_COST,
                    'label' => '输入 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::OUTPUT_TOKEN,
                    'label' => '输出 Token',
                ],
                [
                    'billing_object' => BillingObject::OUTPUT_COST,
                    'label' => '输出 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::CACHE_HIT_TOKEN,
                    'label' => '缓存命中 Token',
                ],
                [
                    'billing_object' => BillingObject::CACHE_HIT_COST,
                    'label' => '缓存命中 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::CACHE_WRITE_TOKEN,
                    'label' => '缓存写入 Token',
                ],
                [
                    'billing_object' => BillingObject::CACHE_WRITE_COST,
                    'label' => '缓存写入 Token 成本',
                ],
            ],
        ],
        [
            'code' => BillingType::ImageCount->value,
            'label' => '图片按张计费',
            'category' => Category::VLM->value,
            'billing_type' => BillingType::ImageCount->value,
            'items' => [
                [
                    'billing_object' => BillingObject::imageCount('1k')->value,
                    'label' => '1K 图片输出张数',
                ],
                [
                    'billing_object' => BillingObject::imageCountCost('1k')->value,
                    'label' => '1K 图片输出张数成本',
                ],
                [
                    'billing_object' => BillingObject::imageCount('2k')->value,
                    'label' => '2K 图片输出张数',
                ],
                [
                    'billing_object' => BillingObject::imageCountCost('2k')->value,
                    'label' => '2K 图片输出张数成本',
                ],
                [
                    'billing_object' => BillingObject::imageCount('4k')->value,
                    'label' => '4K 图片输出张数',
                ],
                [
                    'billing_object' => BillingObject::imageCountCost('4k')->value,
                    'label' => '4K 图片输出张数成本',
                ],
            ],
        ],
        [
            'code' => BillingType::ImageTokensWithThought->value,
            'label' => '图片 Token 计费（含思考过程）',
            'category' => Category::VLM->value,
            'billing_type' => BillingType::ImageTokensWithThought->value,
            'items' => [
                [
                    'billing_object' => BillingObject::IMAGE_INPUT_TOKEN,
                    'label' => '图片输入 Token',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_INPUT_TOKEN_COST,
                    'label' => '图片输入 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN,
                    'label' => '图片输出 Token',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN_COST,
                    'label' => '图片输出 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::THOUGHT_TOKEN,
                    'label' => '思考 Token',
                ],
                [
                    'billing_object' => BillingObject::THOUGHT_TOKEN_COST,
                    'label' => '思考 Token 成本',
                ],
            ],
        ],
        [
            'code' => BillingType::ImageTokens->value,
            'label' => '图片 Token 计费',
            'category' => Category::VLM->value,
            'billing_type' => BillingType::ImageTokens->value,
            'items' => [
                [
                    'billing_object' => BillingObject::IMAGE_INPUT_TOKEN,
                    'label' => '图片输入 Token',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_INPUT_TOKEN_COST,
                    'label' => '图片输入 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN,
                    'label' => '图片输出 Token',
                ],
                [
                    'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN_COST,
                    'label' => '图片输出 Token 成本',
                ],
            ],
        ],
        [
            'code' => BillingType::VideoResolutionDuration->value,
            'label' => '视频按分辨率时长计费',
            'category' => Category::VGM->value,
            'billing_type' => BillingType::VideoResolutionDuration->value,
            'items' => [
                [
                    'billing_object' => BillingObject::videoDuration('480p')->value,
                    'label' => '480P 视频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('480p')->value,
                    'label' => '480P 视频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoDuration('720p')->value,
                    'label' => '720P 视频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('720p')->value,
                    'label' => '720P 视频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoDuration('1080p')->value,
                    'label' => '1080P 视频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('1080p')->value,
                    'label' => '1080P 视频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoDuration('2k')->value,
                    'label' => '2K 视频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('2k')->value,
                    'label' => '2K 视频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoDuration('4k')->value,
                    'label' => '4K 视频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('4k')->value,
                    'label' => '4K 视频输出时长成本',
                ],
            ],
        ],
        [
            'code' => BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
            'label' => '可灵视频按规格与输入条件时长计费',
            'category' => Category::VGM->value,
            'billing_type' => BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
            'items' => [
                [
                    'billing_object' => BillingObject::videoDuration('720p')->value,
                    'label' => '标准模式（720P）无参考视频无音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('720p')->value,
                    'label' => '标准模式（720P）无参考视频无音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDuration('720p')->value,
                    'label' => '标准模式（720P）无参考视频带音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDurationCost('720p')->value,
                    'label' => '标准模式（720P）无参考视频带音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDuration('720p')->value,
                    'label' => '标准模式（720P）有参考视频无音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDurationCost('720p')->value,
                    'label' => '标准模式（720P）有参考视频无音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoDuration('1080p')->value,
                    'label' => '专业模式（1080P）无参考视频无音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoDurationCost('1080p')->value,
                    'label' => '专业模式（1080P）无参考视频无音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDuration('1080p')->value,
                    'label' => '专业模式（1080P）无参考视频带音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDurationCost('1080p')->value,
                    'label' => '专业模式（1080P）无参考视频带音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDuration('1080p')->value,
                    'label' => '专业模式（1080P）有参考视频无音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDurationCost('1080p')->value,
                    'label' => '专业模式（1080P）有参考视频无音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDuration('4k')->value,
                    'label' => '4K 模式无参考视频带音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoAudioDurationCost('4k')->value,
                    'label' => '4K 模式无参考视频带音频输出时长成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDuration('4k')->value,
                    'label' => '4K 模式有参考视频无音频输出时长',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoDurationCost('4k')->value,
                    'label' => '4K 模式有参考视频无音频输出时长成本',
                ],
            ],
        ],
        [
            'code' => BillingType::VolcengineArkVideoResolutionReferenceVideoTokenMatrix->value,
            'label' => '火山视频按分辨率与参考视频 Token 矩阵计费',
            'category' => Category::VGM->value,
            'billing_type' => BillingType::VolcengineArkVideoResolutionReferenceVideoTokenMatrix->value,
            'items' => [
                [
                    'billing_object' => BillingObject::videoToken('480p')->value,
                    'label' => '480P 无参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoTokenCost('480p')->value,
                    'label' => '480P 无参考视频 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoToken('480p')->value,
                    'label' => '480P 参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoTokenCost('480p')->value,
                    'label' => '480P 参考视频 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::videoToken('720p')->value,
                    'label' => '720P 无参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoTokenCost('720p')->value,
                    'label' => '720P 无参考视频 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoToken('720p')->value,
                    'label' => '720P 参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoTokenCost('720p')->value,
                    'label' => '720P 参考视频 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::videoToken('1080p')->value,
                    'label' => '1080P 无参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoTokenCost('1080p')->value,
                    'label' => '1080P 无参考视频 Token 成本',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoToken('1080p')->value,
                    'label' => '1080P 参考视频 Token',
                ],
                [
                    'billing_object' => BillingObject::videoReferenceVideoTokenCost('1080p')->value,
                    'label' => '1080P 参考视频 Token 成本',
                ],
            ],
        ],
    ],

    'defaults' => [
        Category::LLM->value => [
            BillingType::TextTokens->value,
        ],
        Category::VLM->value => [
            BillingType::ImageCount->value,
        ],
        Category::VGM->value => [
            BillingType::VideoResolutionDuration->value,
        ],
    ],

    'provider_templates' => [
        [
            'provider_code' => ProviderCode::Google->value,
            'category' => Category::VLM->value,
            'template_codes' => [
                BillingType::ImageTokensWithThought->value,
                BillingType::ImageCount->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::OpenAI->value,
            'category' => Category::VLM->value,
            'template_codes' => [
                BillingType::ImageTokens->value,
                BillingType::ImageCount->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::MicrosoftAzure->value,
            'category' => Category::VLM->value,
            'template_codes' => [
                BillingType::ImageTokens->value,
                BillingType::ImageCount->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::OpenRouter->value,
            'category' => Category::VLM->value,
            'template_codes' => [
                BillingType::ImageTokens->value,
                BillingType::ImageTokensWithThought->value,
                BillingType::ImageCount->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::Cloudsway->value,
            'category' => Category::VGM->value,
            'template_codes' => [
                BillingType::VideoResolutionDuration->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::Keling->value,
            'category' => Category::VGM->value,
            'template_codes' => [
                BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
            ],
        ],
        [
            'provider_code' => ProviderCode::VolcengineArk->value,
            'category' => Category::VGM->value,
            'template_codes' => [
                BillingType::VolcengineArkVideoResolutionReferenceVideoTokenMatrix->value,
            ],
        ],
    ],
];
