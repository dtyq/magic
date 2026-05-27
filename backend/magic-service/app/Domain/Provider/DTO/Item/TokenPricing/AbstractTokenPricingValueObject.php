<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

abstract class AbstractTokenPricingValueObject extends AbstractValueObject
{
    protected function throwInvalidPricing(): never
    {
        ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
    }

    protected function normalizeNonNegativeNumber(mixed $value): float
    {
        if (! is_numeric($value)) {
            $this->throwInvalidPricing();
        }

        $normalizedValue = (float) $value;
        if ($normalizedValue < 0) {
            $this->throwInvalidPricing();
        }

        return $normalizedValue;
    }

    protected function normalizeNonNegativeInteger(mixed $value): int
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            $this->throwInvalidPricing();
        }

        $normalizedValue = (int) $value;
        if ($normalizedValue < 0) {
            $this->throwInvalidPricing();
        }

        return $normalizedValue;
    }

    protected function normalizeNullableInteger(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            $this->throwInvalidPricing();
        }

        return (int) $value;
    }

    protected function normalizeNullableMaxTokens(mixed $value, int $minTokens): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            $this->throwInvalidPricing();
        }

        $maxTokens = (int) $value;
        if ($maxTokens < $minTokens) {
            $this->throwInvalidPricing();
        }

        return $maxTokens;
    }
}
