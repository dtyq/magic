<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Support;

final class BillingTierFlatPriceCompatibility
{
    private const array FLAT_PRICE_FIELDS = [
        'input_pricing',
        'output_pricing',
        'cache_hit_pricing',
        'cache_write_pricing',
        'input_cost',
        'output_cost',
        'cache_hit_cost',
        'cache_write_cost',
    ];

    private const array BILLING_OBJECT_FIELD_MAP = [
        'input_token' => ['pricing' => 'input_pricing', 'cost' => 'input_cost'],
        'output_token' => ['pricing' => 'output_pricing', 'cost' => 'output_cost'],
        'cache_hit_token' => ['pricing' => 'cache_hit_pricing', 'cost' => 'cache_hit_cost'],
        'cache_write_token' => ['pricing' => 'cache_write_pricing', 'cost' => 'cache_write_cost'],
    ];

    public static function normalizeSavePayload(array $payload): array
    {
        if (! isset($payload['config']) || ! is_array($payload['config'])) {
            return $payload;
        }

        if (self::hasActiveBillingTiers($payload['config']['billing_tiers'] ?? null)) {
            $payload['config'] = self::deriveFlatFields($payload['config']);
        }

        return $payload;
    }

    public static function deriveFlatFields(array $config): array
    {
        $billingTiers = self::normalizeBillingTiers($config['billing_tiers'] ?? null);
        if ($billingTiers === null) {
            return $config;
        }

        foreach (self::FLAT_PRICE_FIELDS as $field) {
            $config[$field] = null;
        }

        foreach ($billingTiers as $billingTierItem) {
            if (! is_array($billingTierItem)) {
                continue;
            }

            $fieldMap = self::BILLING_OBJECT_FIELD_MAP[$billingTierItem['billing_object'] ?? ''] ?? null;
            if ($fieldMap === null) {
                continue;
            }

            $config[$fieldMap['pricing']] = self::resolveFixedRulePrice(
                (string) ($billingTierItem['pricing_mode'] ?? ''),
                $billingTierItem['pricing_rules'] ?? []
            );
            $config[$fieldMap['cost']] = self::resolveFixedRulePrice(
                (string) ($billingTierItem['cost_mode'] ?? ''),
                $billingTierItem['cost_rules'] ?? []
            );
        }

        return $config;
    }

    private static function hasActiveBillingTiers(mixed $billingTiers): bool
    {
        return self::normalizeBillingTiers($billingTiers) !== null;
    }

    private static function normalizeBillingTiers(mixed $billingTiers): ?array
    {
        if ($billingTiers === null || $billingTiers === '' || $billingTiers === []) {
            return null;
        }

        if (is_string($billingTiers)) {
            if (! json_validate($billingTiers)) {
                return null;
            }

            $decoded = json_decode($billingTiers, true);
            return is_array($decoded) && $decoded !== [] ? $decoded : null;
        }

        return is_array($billingTiers) ? $billingTiers : null;
    }

    private static function resolveFixedRulePrice(string $mode, mixed $rules): ?string
    {
        if ($mode !== 'fixed' || ! is_array($rules) || $rules === []) {
            return null;
        }

        $price = $rules[0]['price'] ?? null;
        if ($price === null || $price === '') {
            return null;
        }

        return (string) $price;
    }
}
