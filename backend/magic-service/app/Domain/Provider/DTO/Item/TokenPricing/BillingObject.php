<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

use Dtyq\BillingManager\Infrastructure\Util\Billing\AbstractBillingUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\ImageCalculate\ImageUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\TokenCalculate\TokenUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\VideoCalculate\VideoUsageDto;

/**
 * 统一描述所有可配置的计费对象。
 *
 * 说明：
 * - 文本类对象是固定常量；
 * - 图片按张、视频按时长、视频分辨率 token 走“动态对象族”；
 * - BillingType 负责声明对象归属，BillingObject 只负责值对象行为和 usage 取值。
 */
final class BillingObject
{
    /**
     * TextTokens: 文本输入 token 售价。
     */
    public const INPUT_TOKEN = 'input_token';

    /**
     * TextTokens: 文本输出 token 售价。
     */
    public const OUTPUT_TOKEN = 'output_token';

    /**
     * TextTokens: 缓存命中 token 售价。
     */
    public const CACHE_HIT_TOKEN = 'cache_hit_token';

    /**
     * TextTokens: 缓存写入 token 售价。
     */
    public const CACHE_WRITE_TOKEN = 'cache_write_token';

    /**
     * TextTokens: 文本输入 token 成本。
     */
    public const INPUT_COST = 'input_cost';

    /**
     * TextTokens: 文本输出 token 成本。
     */
    public const OUTPUT_COST = 'output_cost';

    /**
     * TextTokens: 缓存命中 token 成本。
     */
    public const CACHE_HIT_COST = 'cache_hit_cost';

    /**
     * TextTokens: 缓存写入 token 成本。
     */
    public const CACHE_WRITE_COST = 'cache_write_cost';

    /**
     * ImageTokens: 图片输入 token 售价。
     */
    public const IMAGE_INPUT_TOKEN = 'image_input_token';

    /**
     * ImageTokens: 图片输入 token 成本。
     */
    public const IMAGE_INPUT_TOKEN_COST = 'image_input_token_cost';

    /**
     * ImageTokens: 图片输出 token 售价。
     */
    public const IMAGE_OUTPUT_TOKEN = 'image_output_token';

    /**
     * ImageTokens: 图片输出 token 成本。
     */
    public const IMAGE_OUTPUT_TOKEN_COST = 'image_output_token_cost';

    /**
     * ImageTokens / VideoTokens: 通用思考 token 售价。
     */
    public const THOUGHT_TOKEN = 'thought_token';

    /**
     * ImageTokens / VideoTokens: 通用思考 token 成本。
     */
    public const THOUGHT_TOKEN_COST = 'thought_token_cost';

    /**
     * ImageCount: 历史兼容对象，旧 Times 路径仍然使用它映射到 time_pricing。
     */
    public const OLD_IMAGE_COUNT = 'old_image_count';

    /**
     * ImageCount: 历史兼容对象成本。
     */
    public const OLD_IMAGE_COUNT_COST = 'old_image_count_cost';

    /**
     * TextTokens 固定对象。
     */
    private const array TEXT_OBJECTS = [
        self::INPUT_TOKEN,
        self::OUTPUT_TOKEN,
        self::CACHE_HIT_TOKEN,
        self::CACHE_WRITE_TOKEN,
        self::INPUT_COST,
        self::OUTPUT_COST,
        self::CACHE_HIT_COST,
        self::CACHE_WRITE_COST,
    ];

    /**
     * 静态对象：不依赖分辨率、输入扩展维度即可唯一命名。
     */
    private const array STATIC_OBJECTS = [
        self::INPUT_TOKEN,
        self::OUTPUT_TOKEN,
        self::CACHE_HIT_TOKEN,
        self::CACHE_WRITE_TOKEN,
        self::INPUT_COST,
        self::OUTPUT_COST,
        self::CACHE_HIT_COST,
        self::CACHE_WRITE_COST,
        self::IMAGE_INPUT_TOKEN,
        self::IMAGE_INPUT_TOKEN_COST,
        self::IMAGE_OUTPUT_TOKEN,
        self::IMAGE_OUTPUT_TOKEN_COST,
        self::THOUGHT_TOKEN,
        self::THOUGHT_TOKEN_COST,
        self::OLD_IMAGE_COUNT,
        self::OLD_IMAGE_COUNT_COST,
    ];

    private const array OLD_IMAGE_OBJECTS = [
        self::OLD_IMAGE_COUNT,
        self::OLD_IMAGE_COUNT_COST,
    ];

    /**
     * ImageCount 动态对象族：image_{1k|2k|4k}_output_count[_cost].
     */
    private const string IMAGE_COUNT_PATTERN = '/^image_[a-z0-9x_]+_output_count(?:_cost)?$/';

    /**
     * VideoDuration 基础对象族：video_{resolution}_output_duration[_cost].
     */
    private const string VIDEO_DURATION_PATTERN = '/^video_[a-z0-9x_]+_output_duration(?:_cost)?$/';

    /**
     * VideoDuration 参考视频对象族：video_{resolution}_reference_video_output_duration[_cost].
     */
    private const string VIDEO_REFERENCE_VIDEO_DURATION_PATTERN = '/^video_[a-z0-9x_]+_reference_video_output_duration(?:_cost)?$/';

    /**
     * VideoDuration 音频扩展对象族：video_{resolution}_audio_output_duration[_cost].
     */
    private const string VIDEO_AUDIO_DURATION_PATTERN = '/^video_[a-z0-9x_]+_audio_output_duration(?:_cost)?$/';

    /**
     * VideoTokens 分辨率对象族：video_{resolution}_output_token[_cost].
     */
    private const string VIDEO_TOKEN_PATTERN = '/^video_[a-z0-9x_]+_output_token(?:_cost)?$/';

    /**
     * VideoTokens 分辨率 + 参考视频对象族：video_{resolution}_reference_video_output_token[_cost].
     */
    private const string VIDEO_REFERENCE_VIDEO_TOKEN_PATTERN = '/^video_[a-z0-9x_]+_reference_video_output_token(?:_cost)?$/';

    public function __construct(public readonly string $value)
    {
    }

    public static function tryFrom(string $value): ?self
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, self::STATIC_OBJECTS, true)
            || preg_match(self::IMAGE_COUNT_PATTERN, $normalized) === 1
            || preg_match(self::VIDEO_DURATION_PATTERN, $normalized) === 1
            || preg_match(self::VIDEO_REFERENCE_VIDEO_DURATION_PATTERN, $normalized) === 1
            || preg_match(self::VIDEO_AUDIO_DURATION_PATTERN, $normalized) === 1
            || preg_match(self::VIDEO_TOKEN_PATTERN, $normalized) === 1
            || preg_match(self::VIDEO_REFERENCE_VIDEO_TOKEN_PATTERN, $normalized) === 1) {
            return new self($normalized);
        }

        return null;
    }

    /**
     * TextTokens 对应的固定对象集。
     *
     * @return self[]
     */
    public static function textObjects(): array
    {
        return array_map(static fn (string $value): self => new self($value), self::TEXT_OBJECTS);
    }

    /**
     * ImageCount: 构造按张计费对象。
     */
    public static function imageCount(string $resolution): self
    {
        return new self(sprintf('image_%s_output_count', self::normalizeImageResolutionKey($resolution)));
    }

    /**
     * ImageCount: 构造按张计费成本对象。
     */
    public static function imageCountCost(string $resolution): self
    {
        return new self(sprintf('image_%s_output_count_cost', self::normalizeImageResolutionKey($resolution)));
    }

    /**
     * ImageCount: 历史兼容旧对象。
     *
     * @return self[]
     */
    public static function oldImageCount(): array
    {
        return array_map(static fn (string $value): self => new self($value), self::OLD_IMAGE_OBJECTS);
    }

    /**
     * VideoDuration: 仅按分辨率计费。
     */
    public static function videoDuration(string $resolution): self
    {
        return new self(sprintf('video_%s_output_duration', self::normalizeVideoResolutionKey($resolution)));
    }

    public static function videoDurationCost(string $resolution): self
    {
        return new self(sprintf('video_%s_output_duration_cost', self::normalizeVideoResolutionKey($resolution)));
    }

    /**
     * VideoDuration: 分辨率 + 参考视频扩展。
     */
    public static function videoReferenceVideoDuration(string $resolution): self
    {
        return new self(sprintf('video_%s_reference_video_output_duration', self::normalizeVideoResolutionKey($resolution)));
    }

    public static function videoReferenceVideoDurationCost(string $resolution): self
    {
        return new self(sprintf('video_%s_reference_video_output_duration_cost', self::normalizeVideoResolutionKey($resolution)));
    }

    /**
     * VideoDuration: 分辨率 + 音频输入扩展。
     */
    public static function videoAudioDuration(string $resolution): self
    {
        return new self(sprintf('video_%s_audio_output_duration', self::normalizeVideoResolutionKey($resolution)));
    }

    public static function videoAudioDurationCost(string $resolution): self
    {
        return new self(sprintf('video_%s_audio_output_duration_cost', self::normalizeVideoResolutionKey($resolution)));
    }

    /**
     * VideoTokens: 仅按分辨率计费的 token。
     */
    public static function videoToken(string $resolution): self
    {
        return new self(sprintf('video_%s_output_token', self::normalizeVideoResolutionKey($resolution)));
    }

    public static function videoTokenCost(string $resolution): self
    {
        return new self(sprintf('video_%s_output_token_cost', self::normalizeVideoResolutionKey($resolution)));
    }

    /**
     * VideoTokens: 分辨率 + 参考视频 token。
     */
    public static function videoReferenceVideoToken(string $resolution): self
    {
        return new self(sprintf('video_%s_reference_video_output_token', self::normalizeVideoResolutionKey($resolution)));
    }

    public static function videoReferenceVideoTokenCost(string $resolution): self
    {
        return new self(sprintf('video_%s_reference_video_output_token_cost', self::normalizeVideoResolutionKey($resolution)));
    }

    public function isCostObject(): bool
    {
        return str_ends_with($this->value, '_cost');
    }

    public function toFlatConfigField(): ?string
    {
        return match ($this->value) {
            self::INPUT_TOKEN => 'input_pricing',
            self::OUTPUT_TOKEN => 'output_pricing',
            self::CACHE_HIT_TOKEN => 'cache_hit_pricing',
            self::CACHE_WRITE_TOKEN => 'cache_write_pricing',
            self::INPUT_COST => 'input_cost',
            self::OUTPUT_COST => 'output_cost',
            self::CACHE_HIT_COST => 'cache_hit_cost',
            self::CACHE_WRITE_COST => 'cache_write_cost',
            self::OLD_IMAGE_COUNT => 'time_pricing',
            self::OLD_IMAGE_COUNT_COST => 'time_cost',
            default => null,
        };
    }

    public function toDefaultPriceKey(): ?string
    {
        return match ($this->value) {
            self::INPUT_TOKEN,
            self::INPUT_COST => 'input_price',
            self::OUTPUT_TOKEN,
            self::OUTPUT_COST => 'output_price',
            self::CACHE_HIT_TOKEN,
            self::CACHE_HIT_COST => 'cached_token',
            self::CACHE_WRITE_TOKEN,
            self::CACHE_WRITE_COST => 'cache_write_token',
            default => null,
        };
    }

    public function getAmountDivisor(): string
    {
        if ($this->isTokenFamily()) {
            return '1000000';
        }

        if ($this->isVideoBaseDurationObject() || $this->isVideoReferenceVideoDurationObject() || $this->isVideoAudioDurationObject()) {
            return '1000';
        }

        return '1';
    }

    public function resolveUsageValue(AbstractBillingUsageDto $usage): int
    {
        if ($usage instanceof TokenUsageDto) {
            return $this->resolveTextUsageValue($usage);
        }

        if ($usage instanceof ImageUsageDto) {
            return $this->resolveImageUsageValue($usage);
        }

        if ($usage instanceof VideoUsageDto) {
            return $this->resolveVideoUsageValue($usage);
        }

        return 0;
    }

    public function isTokenFamily(): bool
    {
        return in_array($this->value, [
            self::INPUT_TOKEN,
            self::OUTPUT_TOKEN,
            self::CACHE_HIT_TOKEN,
            self::CACHE_WRITE_TOKEN,
            self::INPUT_COST,
            self::OUTPUT_COST,
            self::CACHE_HIT_COST,
            self::CACHE_WRITE_COST,
            self::IMAGE_INPUT_TOKEN,
            self::IMAGE_INPUT_TOKEN_COST,
            self::IMAGE_OUTPUT_TOKEN,
            self::IMAGE_OUTPUT_TOKEN_COST,
            self::THOUGHT_TOKEN,
            self::THOUGHT_TOKEN_COST,
        ], true)
            || $this->isVideoTokenObject()
            || $this->isVideoReferenceVideoTokenObject();
    }

    private function resolveTextUsageValue(TokenUsageDto $usage): int
    {
        return match ($this->value) {
            self::INPUT_TOKEN,
            self::INPUT_COST => $usage->getInputTokens(),
            self::OUTPUT_TOKEN,
            self::OUTPUT_COST => $usage->getOutputTokens(),
            self::CACHE_HIT_TOKEN,
            self::CACHE_HIT_COST => $usage->getCachedTokens(),
            self::CACHE_WRITE_TOKEN,
            self::CACHE_WRITE_COST => $usage->getCacheWriteTokens(),
            default => 0,
        };
    }

    private function resolveImageUsageValue(ImageUsageDto $usage): int
    {
        if (in_array($this->value, [self::IMAGE_INPUT_TOKEN, self::IMAGE_INPUT_TOKEN_COST], true)) {
            return max(0, $usage->promptTokens > 0 ? $usage->promptTokens : ($usage->tokenUsage?->getInputTokens() ?? 0));
        }

        if (in_array($this->value, [self::IMAGE_OUTPUT_TOKEN, self::IMAGE_OUTPUT_TOKEN_COST], true)) {
            return max(0, $usage->tokenUsage?->getOutputTokens() ?? 0);
        }

        if (in_array($this->value, [self::THOUGHT_TOKEN, self::THOUGHT_TOKEN_COST], true)) {
            return max(0, $usage->thoughtTokens);
        }

        if (in_array($this->value, self::OLD_IMAGE_OBJECTS, true)) {
            return max(0, $usage->imageCount);
        }

        if (! $this->isImageCountObject()) {
            return 0;
        }

        $resolution = self::normalizeImageResolutionKey($usage->resolution ?? '');
        if ($resolution !== $this->extractResolutionKey('image_', '_output_count')) {
            return 0;
        }

        return max(0, $usage->imageCount);
    }

    private function resolveVideoUsageValue(VideoUsageDto $usage): int
    {
        $resolution = self::normalizeResolutionKey($usage->quality !== '' ? $usage->quality : 'default');

        if ($this->isVideoReferenceVideoTokenObject()) {
            if (($usage->referenceVideoCount ?? 0) <= 0) {
                return 0;
            }

            return $resolution === $this->extractResolutionKey('video_', '_reference_video_output_token')
                ? max(0, (int) $usage->totalTokens)
                : 0;
        }

        if ($this->isVideoTokenObject()) {
            if (($usage->referenceVideoCount ?? 0) > 0) {
                return 0;
            }

            return $resolution === $this->extractResolutionKey('video_', '_output_token')
                ? max(0, (int) $usage->totalTokens)
                : 0;
        }

        if ($this->isVideoReferenceVideoDurationObject()) {
            if (($usage->referenceVideoCount ?? 0) <= 0) {
                return 0;
            }

            return $resolution === $this->extractResolutionKey('video_', '_reference_video_output_duration')
                ? max(0, $usage->durationInMilliseconds)
                : 0;
        }

        if ($this->isVideoAudioDurationObject()) {
            if (($usage->referenceAudioCount ?? 0) <= 0 || ($usage->referenceVideoCount ?? 0) > 0) {
                return 0;
            }

            return $resolution === $this->extractResolutionKey('video_', '_audio_output_duration')
                ? max(0, $usage->durationInMilliseconds)
                : 0;
        }

        if (! $this->isVideoBaseDurationObject()) {
            return 0;
        }

        if (($usage->referenceVideoCount ?? 0) > 0 || ($usage->referenceAudioCount ?? 0) > 0) {
            return 0;
        }

        return $resolution === $this->extractResolutionKey('video_', '_output_duration')
            ? max(0, $usage->durationInMilliseconds)
            : 0;
    }

    private function isImageCountObject(): bool
    {
        return preg_match(self::IMAGE_COUNT_PATTERN, $this->value) === 1;
    }

    private function isVideoBaseDurationObject(): bool
    {
        return preg_match(self::VIDEO_DURATION_PATTERN, $this->value) === 1;
    }

    private function isVideoReferenceVideoDurationObject(): bool
    {
        return preg_match(self::VIDEO_REFERENCE_VIDEO_DURATION_PATTERN, $this->value) === 1;
    }

    private function isVideoAudioDurationObject(): bool
    {
        return preg_match(self::VIDEO_AUDIO_DURATION_PATTERN, $this->value) === 1;
    }

    private function isVideoTokenObject(): bool
    {
        return preg_match(self::VIDEO_TOKEN_PATTERN, $this->value) === 1;
    }

    private function isVideoReferenceVideoTokenObject(): bool
    {
        return preg_match(self::VIDEO_REFERENCE_VIDEO_TOKEN_PATTERN, $this->value) === 1;
    }

    private function extractResolutionKey(string $prefix, string $suffix): string
    {
        $value = $this->value;
        if ($this->isCostObject()) {
            $suffix .= '_cost';
        }

        return substr($value, strlen($prefix), -strlen($suffix));
    }

    private static function normalizeResolutionKey(string $resolution): string
    {
        $normalized = strtolower(trim($resolution));
        $normalized = str_replace(['-', ' '], '_', $normalized);
        return preg_replace('/[^a-z0-9x_]/', '', $normalized) ?? '';
    }

    private static function normalizeVideoResolutionKey(string $resolution): string
    {
        $normalized = self::normalizeResolutionKey($resolution);
        return $normalized === '' ? 'default' : $normalized;
    }

    private static function normalizeImageResolutionKey(string $resolution): string
    {
        $normalized = self::normalizeResolutionKey($resolution);
        if ($normalized === '' || $normalized === 'default') {
            return '1k';
        }

        if (str_contains($normalized, '4096') || preg_match('/(?:^|_)4k(?:_|$)/', $normalized) === 1) {
            return '4k';
        }

        if (str_contains($normalized, '2048') || preg_match('/(?:^|_)2k(?:_|$)/', $normalized) === 1) {
            return '2k';
        }

        if (str_contains($normalized, '1024') || preg_match('/(?:^|_)1k(?:_|$)/', $normalized) === 1) {
            return '1k';
        }

        return $normalized;
    }
}
