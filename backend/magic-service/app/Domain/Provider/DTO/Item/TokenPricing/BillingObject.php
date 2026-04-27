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

final class BillingObject
{
    public const INPUT_TOKEN = 'input_token';

    public const OUTPUT_TOKEN = 'output_token';

    public const CACHE_HIT_TOKEN = 'cache_hit_token';

    public const CACHE_WRITE_TOKEN = 'cache_write_token';

    public const INPUT_COST = 'input_cost';

    public const OUTPUT_COST = 'output_cost';

    public const CACHE_HIT_COST = 'cache_hit_cost';

    public const CACHE_WRITE_COST = 'cache_write_cost';

    public const IMAGE_OUTPUT_TOKEN = 'image_output_token';

    public const IMAGE_OUTPUT_TOKEN_COST = 'image_output_token_cost';

    public const VIDEO_VISUAL_INPUT_OUTPUT_TOKEN = 'video_visual_input_output_token';

    public const VIDEO_VISUAL_INPUT_OUTPUT_TOKEN_COST = 'video_visual_input_output_token_cost';

    public const VIDEO_TEXT_INPUT_OUTPUT_TOKEN = 'video_text_input_output_token';

    public const VIDEO_TEXT_INPUT_OUTPUT_TOKEN_COST = 'video_text_input_output_token_cost';

    public const OLD_IMAGE_COUNT = 'old_image_count';

    public const OLD_IMAGE_COUNT_COST = 'old_image_count_cost';

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

    private const array STATIC_OBJECTS = [
        self::INPUT_TOKEN,
        self::OUTPUT_TOKEN,
        self::CACHE_HIT_TOKEN,
        self::CACHE_WRITE_TOKEN,
        self::INPUT_COST,
        self::OUTPUT_COST,
        self::CACHE_HIT_COST,
        self::CACHE_WRITE_COST,
        self::IMAGE_OUTPUT_TOKEN,
        self::IMAGE_OUTPUT_TOKEN_COST,
        self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN,
        self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN_COST,
        self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN,
        self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN_COST,
        self::OLD_IMAGE_COUNT,
        self::OLD_IMAGE_COUNT_COST,
    ];

    private const array OLD_IMAGE_OBJECTS = [
        self::OLD_IMAGE_COUNT,
        self::OLD_IMAGE_COUNT_COST,
    ];

    private const string IMAGE_COUNT_PATTERN = '/^image_[a-z0-9x_]+_output_count(?:_cost)?$/';

    private const string VIDEO_DURATION_PATTERN = '/^video_[a-z0-9x_]+_output_duration(?:_cost)?$/';

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
            || preg_match(self::VIDEO_DURATION_PATTERN, $normalized) === 1) {
            return new self($normalized);
        }

        return null;
    }

    public static function textObjects(): array
    {
        return array_map(static fn (string $value): self => new self($value), self::TEXT_OBJECTS);
    }

    public static function imageCount(string $resolution): self
    {
        return new self(sprintf('image_%s_output_count', self::normalizeResolutionKey($resolution)));
    }

    public static function imageCountCost(string $resolution): self
    {
        return new self(sprintf('image_%s_output_count_cost', self::normalizeResolutionKey($resolution)));
    }

    public static function oldImageCount(): array
    {
        return array_map(static fn (string $value): self => new self($value), self::OLD_IMAGE_OBJECTS);
    }

    public static function videoDuration(string $resolution): self
    {
        return new self(sprintf('video_%s_output_duration', self::normalizeResolutionKey($resolution)));
    }

    public static function videoDurationCost(string $resolution): self
    {
        return new self(sprintf('video_%s_output_duration_cost', self::normalizeResolutionKey($resolution)));
    }

    public function isTextObject(): bool
    {
        return in_array($this->value, self::TEXT_OBJECTS, true);
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

        if ($this->isVideoDurationObject()) {
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

    private function isTokenFamily(): bool
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
            self::IMAGE_OUTPUT_TOKEN,
            self::IMAGE_OUTPUT_TOKEN_COST,
            self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN,
            self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN_COST,
            self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN,
            self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN_COST,
        ], true);
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
        if (in_array($this->value, [self::IMAGE_OUTPUT_TOKEN, self::IMAGE_OUTPUT_TOKEN_COST], true)) {
            return $usage->tokenUsage?->getOutputTokens() ?? 0;
        }

        return $usage->imageCount;
    }

    private function resolveVideoUsageValue(VideoUsageDto $usage): int
    {
        if (in_array($this->value, [self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN, self::VIDEO_VISUAL_INPUT_OUTPUT_TOKEN_COST], true)) {
            return $usage->hasVisualInput ? max(0, (int) $usage->totalTokens) : 0;
        }

        if (in_array($this->value, [self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN, self::VIDEO_TEXT_INPUT_OUTPUT_TOKEN_COST], true)) {
            return $usage->hasVisualInput ? 0 : max(0, (int) $usage->totalTokens);
        }

        if (! $this->isVideoDurationObject()) {
            return 0;
        }

        $resolution = self::normalizeResolutionKey($usage->quality !== '' ? $usage->quality : 'default');
        if ($resolution !== $this->extractResolutionKey('video_', '_output_duration')) {
            return 0;
        }

        return max(0, $usage->durationInMilliseconds);
    }

    private function isVideoDurationObject(): bool
    {
        return preg_match(self::VIDEO_DURATION_PATTERN, $this->value) === 1;
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
}
