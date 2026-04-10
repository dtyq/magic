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

    public function toUsageField(): string
    {
        return match ($this) {
            self::InputToken => 'inputTokens',
            self::OutputToken => 'outputTokens',
            self::CacheHitToken => 'cacheHitTokens',
            self::CacheWriteToken => 'cacheWriteTokens',
        };
    }

    public function toUnitPriceKey(): string
    {
        return match ($this) {
            self::InputToken => 'input',
            self::OutputToken => 'output',
            self::CacheHitToken => 'cache_hit',
            self::CacheWriteToken => 'cache_write',
        };
    }
}
