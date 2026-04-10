<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

class BillingTiers extends AbstractTokenPricingValueObject
{
    /**
     * @var BillingTierItem[]
     */
    protected array $items = [];

    /**
     * @var array<string, BillingTierItem>
     */
    protected array $indexedItems = [];

    public function __construct(?array $data = null)
    {
        if (! is_array($data)) {
            $this->throwInvalidPricing();
        }

        foreach ($data as $item) {
            if (! is_array($item)) {
                $this->throwInvalidPricing();
            }

            $billingTierItem = new BillingTierItem($item);
            $billingObject = $billingTierItem->getBillingObject()->value;
            if (isset($this->indexedItems[$billingObject])) {
                $this->throwInvalidPricing();
            }

            $this->items[] = $billingTierItem;
            $this->indexedItems[$billingObject] = $billingTierItem;
        }
    }

    /**
     * @return BillingTierItem[]
     */
    public function getItems(): array
    {
        return $this->items;
    }

    public function getBillingTier(BillingObject|string $billingObject): ?BillingTierItem
    {
        if (is_string($billingObject)) {
            $billingObject = BillingObject::tryFrom($billingObject);
        }

        if (! $billingObject instanceof BillingObject) {
            return null;
        }

        return $this->indexedItems[$billingObject->value] ?? null;
    }

    public function toArray(): array
    {
        return array_map(static fn (BillingTierItem $item): array => $item->toArray(), $this->items);
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
