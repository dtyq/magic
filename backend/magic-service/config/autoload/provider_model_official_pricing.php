<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

$officialPrice = static fn (string $price): array => [
    'price' => $price,
];

$officialPricePair = static fn (string $billingObject, string $costBillingObject, string $price): array => [
    $billingObject => $officialPrice($price),
    $costBillingObject => $officialPrice($price),
];

$pricingGroup = static fn (
    ProviderCode $providerCode,
    Category $category,
    array $modelIds,
    string $currency,
    array $items
): array => [
    'provider_code' => $providerCode->value,
    'category' => $category->value,
    'model_ids' => $modelIds,
    'currency' => $currency,
    'items' => $items,
];

$imageCountPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::imageCount($resolution)->value,
    BillingObject::imageCountCost($resolution)->value,
    $price
);

$videoDurationPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::videoDuration($resolution)->value,
    BillingObject::videoDurationCost($resolution)->value,
    $price
);

$videoAudioDurationPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::videoAudioDuration($resolution)->value,
    BillingObject::videoAudioDurationCost($resolution)->value,
    $price
);

$videoReferenceVideoDurationPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::videoReferenceVideoDuration($resolution)->value,
    BillingObject::videoReferenceVideoDurationCost($resolution)->value,
    $price
);

$videoTokenPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::videoToken($resolution)->value,
    BillingObject::videoTokenCost($resolution)->value,
    $price
);

$videoReferenceVideoTokenPair = static fn (string $resolution, string $price): array => $officialPricePair(
    BillingObject::videoReferenceVideoToken($resolution)->value,
    BillingObject::videoReferenceVideoTokenCost($resolution)->value,
    $price
);

$flatImageCountItems = static fn (string $price): array => array_merge(
    $imageCountPair('1k', $price),
    $imageCountPair('2k', $price),
    $imageCountPair('4k', $price),
);

return [
    'source' => 'official_research_2026_05_20',
    'prices' => [
        $pricingGroup(
            ProviderCode::Google,
            Category::VLM,
            [
                'gemini-2.5-flash-image',
            ],
            'USD',
            array_merge(
                $officialPricePair(BillingObject::IMAGE_INPUT_TOKEN, BillingObject::IMAGE_INPUT_TOKEN_COST, '0.30'),
                $officialPricePair(BillingObject::IMAGE_OUTPUT_TOKEN, BillingObject::IMAGE_OUTPUT_TOKEN_COST, '30.00'),
                $imageCountPair('1k', '0.039'),
            ),
        ),
        $pricingGroup(
            ProviderCode::Google,
            Category::VLM,
            [
                'gemini-3.1-flash-image-preview',
            ],
            'USD',
            array_merge(
                $officialPricePair(BillingObject::IMAGE_INPUT_TOKEN, BillingObject::IMAGE_INPUT_TOKEN_COST, '0.50'),
                $officialPricePair(BillingObject::IMAGE_OUTPUT_TOKEN, BillingObject::IMAGE_OUTPUT_TOKEN_COST, '60.00'),
                $officialPricePair(BillingObject::THOUGHT_TOKEN, BillingObject::THOUGHT_TOKEN_COST, '3.00'),
                $imageCountPair('1k', '0.067'),
                $imageCountPair('2k', '0.101'),
                $imageCountPair('4k', '0.151'),
            ),
        ),
        $pricingGroup(
            ProviderCode::Google,
            Category::VLM,
            [
                'gemini-3-pro-image-preview',
            ],
            'USD',
            array_merge(
                $officialPricePair(BillingObject::IMAGE_INPUT_TOKEN, BillingObject::IMAGE_INPUT_TOKEN_COST, '2.00'),
                $officialPricePair(BillingObject::IMAGE_OUTPUT_TOKEN, BillingObject::IMAGE_OUTPUT_TOKEN_COST, '120.00'),
                $officialPricePair(BillingObject::THOUGHT_TOKEN, BillingObject::THOUGHT_TOKEN_COST, '12.00'),
                $imageCountPair('1k', '0.134'),
                $imageCountPair('2k', '0.134'),
                $imageCountPair('4k', '0.24'),
            ),
        ),
        $pricingGroup(
            ProviderCode::OpenAI,
            Category::VLM,
            [
                'gpt-image-1.5',
            ],
            'USD',
            array_merge(
                $officialPricePair(BillingObject::IMAGE_INPUT_TOKEN, BillingObject::IMAGE_INPUT_TOKEN_COST, '8.00'),
                $officialPricePair(BillingObject::IMAGE_OUTPUT_TOKEN, BillingObject::IMAGE_OUTPUT_TOKEN_COST, '32.00'),
            ),
        ),
        $pricingGroup(
            ProviderCode::OpenAI,
            Category::VLM,
            [
                'gpt-image-2',
            ],
            'USD',
            array_merge(
                $officialPricePair(BillingObject::IMAGE_INPUT_TOKEN, BillingObject::IMAGE_INPUT_TOKEN_COST, '8.00'),
                $officialPricePair(BillingObject::IMAGE_OUTPUT_TOKEN, BillingObject::IMAGE_OUTPUT_TOKEN_COST, '30.00'),
            ),
        ),
        $pricingGroup(
            ProviderCode::VolcengineArk,
            Category::VLM,
            [
                'doubao-seedream-4.0',
                'doubao-seedream-4-0-250828',
            ],
            'CNY',
            $flatImageCountItems('0.20'),
        ),
        $pricingGroup(
            ProviderCode::VolcengineArk,
            Category::VLM,
            [
                'doubao-seedream-4.5',
            ],
            'CNY',
            $flatImageCountItems('0.25'),
        ),
        $pricingGroup(
            ProviderCode::Qwen,
            Category::VLM,
            [
                'qwen-image',
            ],
            'CNY',
            $flatImageCountItems('0.25'),
        ),
        $pricingGroup(
            ProviderCode::Qwen,
            Category::VLM,
            [
                'qwen-image-plus',
                'qwen-image-plus-2026-01-09',
                'qwen-image2.0',
                'qwen-image-2.0',
                'qwen-image-2.0-2026-03-03',
                'qwen-image-edit-plus',
                'qwen-image-edit-plus-2025-10-30',
                'qwen-image-edit-plus-2025-12-15',
            ],
            'CNY',
            $flatImageCountItems('0.20'),
        ),
        $pricingGroup(
            ProviderCode::Qwen,
            Category::VLM,
            [
                'qwen-image2.0-pro',
                'qwen-image-2.0-pro',
                'qwen-image-2.0-pro-2026-03-03',
                'qwen-image-2.0-pro-2026-04-22',
            ],
            'CNY',
            $flatImageCountItems('0.50'),
        ),
        $pricingGroup(
            ProviderCode::Qwen,
            Category::VLM,
            [
                'qwen-image-edit',
            ],
            'CNY',
            $flatImageCountItems('0.30'),
        ),
        $pricingGroup(
            ProviderCode::Cloudsway,
            Category::VGM,
            [
                'veo-3.1-fast',
                'veo-3.1-fast-generate-preview',
            ],
            'USD',
            array_merge(
                $videoDurationPair('720p', '0.08'),
                $videoDurationPair('1080p', '0.10'),
                $videoDurationPair('4k', '0.25'),
            ),
        ),
        $pricingGroup(
            ProviderCode::Cloudsway,
            Category::VGM,
            [
                'veo-3.1',
                'veo-3.1-pro',
                'veo-3.1-generate-preview',
            ],
            'USD',
            array_merge(
                $videoDurationPair('720p', '0.20'),
                $videoDurationPair('1080p', '0.20'),
                $videoDurationPair('4k', '0.40'),
            ),
        ),
        $pricingGroup(
            ProviderCode::VolcengineArk,
            Category::VGM,
            [
                'doubao-seedance-2.0',
                'doubao-seedance-2-0-260128',
            ],
            'CNY',
            array_merge(
                $videoTokenPair('480p', '46.00'),
                $videoTokenPair('720p', '46.00'),
                $videoTokenPair('1080p', '51.00'),
                $videoReferenceVideoTokenPair('480p', '28.00'),
                $videoReferenceVideoTokenPair('720p', '28.00'),
                $videoReferenceVideoTokenPair('1080p', '31.00'),
            ),
        ),
        $pricingGroup(
            ProviderCode::VolcengineArk,
            Category::VGM,
            [
                'doubao-seedance-2.0-fast',
                'doubao-seedance-2-0-fast-260128',
            ],
            'CNY',
            array_merge(
                $videoTokenPair('480p', '37.00'),
                $videoTokenPair('720p', '37.00'),
                $videoReferenceVideoTokenPair('480p', '22.00'),
                $videoReferenceVideoTokenPair('720p', '22.00'),
            ),
        ),
        $pricingGroup(
            ProviderCode::Keling,
            Category::VGM,
            [
                'kling-v3',
                'kling-3.0-video',
                'keling-3.0-video',
            ],
            'USD',
            array_merge(
                $videoDurationPair('720p', '0.0840'),
                $videoDurationPair('1080p', '0.1120'),
                $videoAudioDurationPair('720p', '0.1260'),
                $videoAudioDurationPair('1080p', '0.1680'),
                $videoAudioDurationPair('4k', '0.4200'),
            ),
        ),
        $pricingGroup(
            ProviderCode::Keling,
            Category::VGM,
            [
                'kling-v3-omni',
                'kling-3.0-omni',
                'keling-3.0-omni',
            ],
            'USD',
            array_merge(
                $videoDurationPair('720p', '0.0840'),
                $videoDurationPair('1080p', '0.1120'),
                $videoAudioDurationPair('720p', '0.1120'),
                $videoAudioDurationPair('1080p', '0.1400'),
                $videoAudioDurationPair('4k', '0.4200'),
                $videoReferenceVideoDurationPair('720p', '0.1260'),
                $videoReferenceVideoDurationPair('1080p', '0.1680'),
                $videoReferenceVideoDurationPair('4k', '0.4200'),
            ),
        ),
    ],
];
