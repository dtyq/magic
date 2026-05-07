<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;
use Dtyq\BillingManager\Infrastructure\Util\Billing\AbstractBillingUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\ImageCalculate\ImageUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\TokenCalculate\TokenUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\VideoCalculate\VideoUsageDto;

enum BillingType: string
{
    case Tokens = 'Tokens'; // token 计价
    case Times = 'Times'; // 次数计价
    case Per_Second = 'Per_Second'; // 按秒计价
    case TextTokens = 'TextTokens'; // 文本模型 token 计费
    case ImageCount = 'ImageCount'; // 图片按张计费
    case ImageTokens = 'ImageTokens'; // 图片 token 计费
    case VideoResolutionDuration = 'VideoResolutionDuration'; // 视频按时长计费：分辨率
    case VideoResolutionAudioDuration = 'VideoResolutionAudioDuration'; // 视频按时长计费：分辨率 + 音频
    case VideoResolutionReferenceVideoDuration = 'VideoResolutionReferenceVideoDuration'; // 视频按时长计费：分辨率 + 参考视频
    case VideoResolutionTokens = 'VideoResolutionTokens'; // 视频 token 计费：分辨率
    case VideoResolutionReferenceVideoTokens = 'VideoResolutionReferenceVideoTokens'; // 视频 token 计费：分辨率 + 参考视频

    public function isTokens(): bool
    {
        return in_array($this, [self::Tokens, self::TextTokens], true);
    }

    public function isTimes(): bool
    {
        return $this->value === self::Times->value;
    }

    public function isTextToken(): bool
    {
        return in_array($this, [self::Tokens, self::TextTokens], true);
    }

    /**
     * 由 BillingType 根据 usage 直接给出本次应参与计算的 BillingObject。
     *
     * @return BillingObject[]
     */
    public function resolveBillingObjects(AbstractBillingUsageDto $usage): array
    {
        return match (true) {
            $usage instanceof TokenUsageDto => $this->resolveTokenBillingObjects(),
            $usage instanceof ImageUsageDto => $this->resolveImageBillingObjects($usage),
            $usage instanceof VideoUsageDto => $this->resolveVideoBillingObjects($usage),
            default => [],
        };
    }

    /**
     * @return BillingObject[]
     */
    private function resolveTokenBillingObjects(): array
    {
        return $this->isTextToken()
            ? BillingObject::textObjects()
            : [];
    }

    /**
     * @return BillingObject[]
     */
    private function resolveImageBillingObjects(ImageUsageDto $usage): array
    {
        if ($this === self::Times) {
            return BillingObject::oldImageCount();
        }

        if ($this === self::ImageCount) {
            $resolution = $usage->resolution ?: 'default';
            return [
                BillingObject::imageCount($resolution),
                BillingObject::imageCountCost($resolution),
            ];
        }

        if ($this === self::ImageTokens || ($this === self::Tokens && ($usage->tokenUsage instanceof TokenUsageDto || $usage->promptTokens > 0 || $usage->thoughtTokens > 0))) {
            return array_filter([
                BillingObject::tryFrom(BillingObject::IMAGE_INPUT_TOKEN),
                BillingObject::tryFrom(BillingObject::IMAGE_INPUT_TOKEN_COST),
                BillingObject::tryFrom(BillingObject::IMAGE_OUTPUT_TOKEN),
                BillingObject::tryFrom(BillingObject::IMAGE_OUTPUT_TOKEN_COST),
                BillingObject::tryFrom(BillingObject::THOUGHT_TOKEN),
                BillingObject::tryFrom(BillingObject::THOUGHT_TOKEN_COST),
            ]);
        }

        return [];
    }

    /**
     * @return BillingObject[]
     */
    private function resolveVideoBillingObjects(VideoUsageDto $usage): array
    {
        if ($this === self::VideoResolutionTokens) {
            return [
                BillingObject::videoToken($usage->quality),
                BillingObject::videoTokenCost($usage->quality),
            ];
        }

        if ($this === self::VideoResolutionReferenceVideoTokens) {
            return [
                BillingObject::videoReferenceVideoToken($usage->quality),
                BillingObject::videoReferenceVideoTokenCost($usage->quality),
            ];
        }

        $resolution = $usage->quality !== '' ? $usage->quality : 'default';
        if ($this === self::VideoResolutionReferenceVideoDuration) {
            return [
                BillingObject::videoReferenceVideoDuration($resolution),
                BillingObject::videoReferenceVideoDurationCost($resolution),
            ];
        }

        if ($this === self::VideoResolutionAudioDuration) {
            return [
                BillingObject::videoAudioDuration($resolution),
                BillingObject::videoAudioDurationCost($resolution),
            ];
        }

        if (! in_array($this, [self::Per_Second, self::VideoResolutionDuration], true)) {
            return [];
        }

        return [
            BillingObject::videoDuration($resolution),
            BillingObject::videoDurationCost($resolution),
        ];
    }
}
