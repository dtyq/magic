<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

class BillingTierItem extends AbstractTokenPricingValueObject
{
    protected BillingObject $billingObject;

    protected BillingTierMode $pricingMode;

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
        $pricingMode = BillingTierMode::tryFrom((string) ($data['pricing_mode'] ?? ''));
        $followObject = BillingObject::tryFrom((string) ($data['follow_object'] ?? ''));

        if (! $billingObject instanceof BillingObject
            || ! $pricingMode instanceof BillingTierMode
            || ! $followObject instanceof BillingObject) {
            $this->throwInvalidPricing();
        }

        $pricingRules = $data['pricing_rules'] ?? null;
        if (! is_array($pricingRules)) {
            $this->throwInvalidPricing();
        }

        $this->billingObject = $billingObject;
        $this->pricingMode = $pricingMode;
        $this->followObject = $followObject;
        $this->pricingRules = $this->mapPricingRules($pricingRules);

        $this->assertPricingRulesAreValid($this->pricingMode, $this->pricingRules);
    }

    public function getBillingObject(): BillingObject
    {
        return $this->billingObject;
    }

    public function getPricingMode(): BillingTierMode
    {
        return $this->pricingMode;
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
        return $this->resolveRulesPrice($this->pricingMode, $this->pricingRules, $followValue);
    }

    public function toArray(): array
    {
        return [
            'billing_object' => $this->billingObject->value,
            'pricing_mode' => $this->pricingMode->value,
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

    /**
     * @param BillingTierPriceRule[] $rules
     */
    private function resolveRulesPrice(BillingTierMode $mode, array $rules, ?int $followValue): ?float
    {
        if ($mode === BillingTierMode::Fixed) {
            return $rules[0]->getPrice();
        }

        if ($followValue === null) {
            return null;
        }
        // 不可能出现rules为空的情况，因为resolveBillingTierUnitPrices这里已经判断了，如果rules为空，直接就跳过了
        foreach ($rules as $pricingRule) {
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

    /**
     * @param BillingTierPriceRule[] $rules
     */
    private function assertPricingRulesAreValid(BillingTierMode $mode, array $rules): void
    {
        if ($rules === []) {
            $this->throwInvalidPricing();
        }

        if ($mode === BillingTierMode::Fixed) {
            $this->assertFixedPricingRulesAreValid($rules);
            return;
        }

        $this->assertTieredPricingRulesAreValid($rules);
    }

    /**
     * @param array<int, mixed> $rules
     * @return BillingTierPriceRule[]
     */
    private function mapPricingRules(array $rules): array
    {
        return array_map(function (mixed $pricingRule): BillingTierPriceRule {
            if (! is_array($pricingRule)) {
                $this->throwInvalidPricing();
            }

            return new BillingTierPriceRule($pricingRule);
        }, $rules);
    }

    /**
     * @param BillingTierPriceRule[] $rules
     */
    private function assertFixedPricingRulesAreValid(array $rules): void
    {
        if (count($rules) !== 1) {
            $this->throwInvalidPricing();
        }

        $pricingRule = $rules[0];
        if ($pricingRule->getMin() !== null || $pricingRule->getMax() !== null) {
            $this->throwInvalidPricing();
        }
    }

    /**
     * @param BillingTierPriceRule[] $rules
     */
    private function assertTieredPricingRulesAreValid(array $rules): void
    {
        $previousMax = null;

        foreach ($rules as $index => $pricingRule) {
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

            if ($max === null && $index !== array_key_last($rules)) {
                $this->throwInvalidPricing();
            }

            $previousMax = $max;
        }
    }
}
