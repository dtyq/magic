<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

enum BillingObject: string
{
    case InputToken = 'input_token';
    case OutputToken = 'output_token';
    case CacheHitToken = 'cache_hit_token';
    case CacheWriteToken = 'cache_write_token';
    case InputCost = 'input_cost';
    case OutputCost = 'output_cost';
    case CacheHitCost = 'cache_hit_cost';
    case CacheWriteCost = 'cache_write_cost';

    public function toUsageField(): string
    {
        return match ($this) {
            self::InputToken => 'inputTokens',
            self::OutputToken => 'outputTokens',
            self::CacheHitToken => 'cacheHitTokens',
            self::CacheWriteToken => 'cacheWriteTokens',
            self::InputCost => 'inputCostUnits',
            self::OutputCost => 'outputCostUnits',
            self::CacheHitCost => 'cacheHitCostUnits',
            self::CacheWriteCost => 'cacheWriteCostUnits',
        };
    }

    public function toFlatConfigField(): string
    {
        return match ($this) {
            self::InputToken => 'input_pricing',
            self::OutputToken => 'output_pricing',
            self::CacheHitToken => 'cache_hit_pricing',
            self::CacheWriteToken => 'cache_write_pricing',
            self::InputCost => 'input_cost',
            self::OutputCost => 'output_cost',
            self::CacheHitCost => 'cache_hit_cost',
            self::CacheWriteCost => 'cache_write_cost',
        };
    }

    public function toDefaultPriceKey(): string
    {
        return match ($this) {
            self::InputToken,
            self::InputCost => 'input_price',
            self::OutputToken,
            self::OutputCost => 'output_price',
            self::CacheHitToken,
            self::CacheHitCost => 'cached_token',
            self::CacheWriteToken,
            self::CacheWriteCost => 'cache_write_token',
        };
    }

    public function toFallbackUsageField(): ?string
    {
        return match ($this) {
            self::InputCost => 'inputTokens',
            self::OutputCost => 'outputTokens',
            self::CacheHitCost => 'cacheHitTokens',
            self::CacheWriteCost => 'cacheWriteTokens',
            default => null,
        };
    }

    public function isCostObject(): bool
    {
        return match ($this) {
            self::InputCost,
            self::OutputCost,
            self::CacheHitCost,
            self::CacheWriteCost => true,
            default => false,
        };
    }
}
