<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

class BillingTierPriceRule extends AbstractTokenPricingValueObject
{
    protected ?int $min = null;

    protected ?int $max = null;

    protected float $price = 0.0;

    public function __construct(?array $data = null)
    {
        if (! is_array($data)) {
            $this->throwInvalidPricing();
        }

        $this->min = $this->normalizeNullableInteger($data['min'] ?? null);
        $this->max = $this->normalizeNullableInteger($data['max'] ?? null);
        $this->price = $this->normalizeNonNegativeNumber($data['price'] ?? null);
    }

    public function getMin(): ?int
    {
        return $this->min;
    }

    public function getMax(): ?int
    {
        return $this->max;
    }

    public function getPrice(): float
    {
        return $this->price;
    }

    public function toArray(): array
    {
        return [
            'min' => $this->min,
            'max' => $this->max,
            'price' => $this->price,
        ];
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
