<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

class BillingTierItem extends AbstractTokenPricingValueObject
{
    protected BillingObject $billingObject;

    protected BillingTierMode $billingMode;

    protected BillingObject $followObject;

    /**
     * @var BillingTierPriceRule[]
     */
    protected array $pricingRules = [];

    public function __construct(?array $data = null)
    {
        if (! is_array($data)) {
            $this->throwInvalidPricing();
        }

        $billingObject = BillingObject::tryFrom((string) ($data['billing_object'] ?? ''));
        $billingMode = BillingTierMode::tryFrom((string) ($data['billing_mode'] ?? ''));
        $followObject = BillingObject::tryFrom((string) ($data['follow_object'] ?? ''));

        if (! $billingObject instanceof BillingObject || ! $billingMode instanceof BillingTierMode || ! $followObject instanceof BillingObject) {
            $this->throwInvalidPricing();
        }

        $pricingRules = $data['pricing_rules'] ?? null;
        if (! is_array($pricingRules)) {
            $this->throwInvalidPricing();
        }

        $this->billingObject = $billingObject;
        $this->billingMode = $billingMode;
        $this->followObject = $followObject;
        $this->pricingRules = array_map(function (mixed $pricingRule): BillingTierPriceRule {
            if (! is_array($pricingRule)) {
                $this->throwInvalidPricing();
            }

            return new BillingTierPriceRule($pricingRule);
        }, $pricingRules);

        $this->assertPricingRulesAreValid();
    }

    public function getBillingObject(): BillingObject
    {
        return $this->billingObject;
    }

    public function getBillingMode(): BillingTierMode
    {
        return $this->billingMode;
    }

    public function getFollowObject(): BillingObject
    {
        return $this->followObject;
    }

    /**
     * @return BillingTierPriceRule[]
     */
    public function getPricingRules(): array
    {
        return $this->pricingRules;
    }

    public function resolvePrice(?int $followValue): ?float
    {
        if ($this->billingMode === BillingTierMode::Fixed) {
            return $this->pricingRules[0]->getPrice();
        }

        if ($followValue === null) {
            return null;
        }

        foreach ($this->pricingRules as $pricingRule) {
            $min = $pricingRule->getMin();
            $max = $pricingRule->getMax();
            if ($min === null) {
                $this->throwInvalidPricing();
            }

            if ($followValue <= $min) {
                continue;
            }

            if ($max !== null && $followValue > $max) {
                continue;
            }

            return $pricingRule->getPrice();
        }

        return null;
    }

    public function toArray(): array
    {
        return [
            'billing_object' => $this->billingObject->value,
            'billing_mode' => $this->billingMode->value,
            'follow_object' => $this->followObject->value,
            'pricing_rules' => array_map(
                static fn (BillingTierPriceRule $pricingRule): array => $pricingRule->toArray(),
                $this->pricingRules
            ),
        ];
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    private function assertPricingRulesAreValid(): void
    {
        if ($this->pricingRules === []) {
            $this->throwInvalidPricing();
        }

        if ($this->billingMode === BillingTierMode::Fixed) {
            $this->assertFixedPricingRulesAreValid();
            return;
        }

        $this->assertTieredPricingRulesAreValid();
    }

    private function assertFixedPricingRulesAreValid(): void
    {
        if (count($this->pricingRules) !== 1) {
            $this->throwInvalidPricing();
        }

        $pricingRule = $this->pricingRules[0];
        if ($pricingRule->getMin() !== null || $pricingRule->getMax() !== null) {
            $this->throwInvalidPricing();
        }
    }

    private function assertTieredPricingRulesAreValid(): void
    {
        $previousMax = null;

        foreach ($this->pricingRules as $index => $pricingRule) {
            $min = $pricingRule->getMin();
            $max = $pricingRule->getMax();

            if ($min === null) {
                $this->throwInvalidPricing();
            }

            if ($index === 0 && $min !== 0) {
                $this->throwInvalidPricing();
            }

            if ($previousMax !== null && $min !== $previousMax) {
                $this->throwInvalidPricing();
            }

            if ($max !== null && $max <= $min) {
                $this->throwInvalidPricing();
            }

            if ($max === null && $index !== array_key_last($this->pricingRules)) {
                $this->throwInvalidPricing();
            }

            $previousMax = $max;
        }
    }
}
