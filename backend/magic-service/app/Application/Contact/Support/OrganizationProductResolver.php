<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Support;

use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Contract\TranslatorInterface;
use Throwable;

class OrganizationProductResolver
{
    /**
     * @var array<string, array{product_name: ?string, plan_type: ?string, subscription_tier: ?string}>
     */
    private array $cache = [];

    public function __construct(
        private readonly PackageFilterInterface $packageFilter,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /**
     * @return array{product_name: ?string, plan_type: ?string, subscription_tier: ?string}
     */
    public function resolveSubscriptionInfo(string $organizationCode, string $userId): array
    {
        if ($organizationCode === '') {
            return $this->defaultCacheEntry();
        }

        if (array_key_exists($organizationCode, $this->cache)) {
            return $this->cache[$organizationCode];
        }

        $dataIsolation = new BaseDataIsolation($organizationCode, $userId);
        try {
            $subscription = $this->packageFilter->getCurrentSubscription($dataIsolation);
        } catch (Throwable $throwable) {
            return $this->cache[$organizationCode] = $this->defaultCacheEntry();
        }

        $subscriptionInfo = is_array($subscription['info'] ?? null) ? $subscription['info'] : [];
        $product = is_array($subscriptionInfo['product'] ?? null) ? $subscriptionInfo['product'] : null;
        $productName = $this->resolveProductNameFromProduct($product);
        [$planType, $subscriptionTier] = $this->resolvePlanAndTier($subscriptionInfo);

        return $this->cache[$organizationCode] = [
            'product_name' => $productName,
            'plan_type' => $planType,
            'subscription_tier' => $subscriptionTier,
        ];
    }

    public function resolveProductName(string $organizationCode, string $userId): ?string
    {
        return $this->resolveSubscriptionInfo($organizationCode, $userId)['product_name'];
    }

    /**
     * @return array{product_name: ?string, plan_type: ?string, subscription_tier: ?string}
     */
    private function defaultCacheEntry(): array
    {
        return [
            'product_name' => null,
            'plan_type' => null,
            'subscription_tier' => null,
        ];
    }

    private function resolveProductNameFromProduct(?array $product): ?string
    {
        if ($product === null) {
            return null;
        }

        $nameI18n = $product['name_i18n'] ?? null;
        if (! is_array($nameI18n) || $nameI18n === []) {
            $name = $product['name'] ?? null;
            return is_string($name) && $name !== '' ? $name : null;
        }

        $locale = $this->translator->getLocale();
        $preferred = null;
        if ($locale !== '') {
            $preferred = $nameI18n[$locale] ?? null;
        }

        if (! is_string($preferred) || $preferred === '') {
            $preferred = $nameI18n['zh_CN'] ?? null;
        }

        if (! is_string($preferred) || $preferred === '') {
            $first = reset($nameI18n);
            $preferred = is_string($first) && $first !== '' ? $first : null;
        }

        return $preferred ?: null;
    }

    /**
     * @param array<string, mixed> $subscriptionInfo
     * @return array{0: ?string, 1: ?string}
     */
    private function resolvePlanAndTier(array $subscriptionInfo): array
    {
        $planType = null;
        $subscriptionTier = null;

        $skus = $subscriptionInfo['skus'] ?? [];
        if (is_array($skus) && $skus !== []) {
            $firstSku = $skus[0] ?? null;
            if (is_array($firstSku)) {
                $attributes = $firstSku['attributes'] ?? null;
                if (is_array($attributes)) {
                    $planTypeValue = $attributes['plan_type'] ?? null;
                    if (is_string($planTypeValue) && $planTypeValue !== '') {
                        $planType = $planTypeValue;
                    }

                    $subscriptionTierValue = $attributes['subscription_tier'] ?? null;
                    if (is_string($subscriptionTierValue) && $subscriptionTierValue !== '') {
                        $subscriptionTier = $subscriptionTierValue;
                    }
                }
            }
        }

        return [$planType, $subscriptionTier];
    }
}
