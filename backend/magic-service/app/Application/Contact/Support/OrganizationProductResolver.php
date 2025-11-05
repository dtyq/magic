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
     * @var array<string, ?string>
     */
    private array $cache = [];

    public function __construct(
        private readonly PackageFilterInterface $packageFilter,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function resolveProductName(string $organizationCode, string $userId): ?string
    {
        if ($organizationCode === '') {
            return null;
        }

        if (array_key_exists($organizationCode, $this->cache)) {
            return $this->cache[$organizationCode];
        }

        $dataIsolation = new BaseDataIsolation($organizationCode, $userId);
        try {
            $subscription = $this->packageFilter->getCurrentSubscription($dataIsolation);
        } catch (Throwable $throwable) {
            $this->cache[$organizationCode] = null;
            return null;
        }

        $product = $subscription['info']['product'] ?? null;
        if (! is_array($product)) {
            $this->cache[$organizationCode] = null;
            return null;
        }

        $nameI18n = $product['name_i18n'] ?? null;
        if (! is_array($nameI18n) || $nameI18n === []) {
            $name = $product['name'] ?? null;
            $resolved = is_string($name) && $name !== '' ? $name : null;
            $this->cache[$organizationCode] = $resolved;
            return $resolved;
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

        $this->cache[$organizationCode] = $preferred ?: null;
        return $this->cache[$organizationCode];
    }
}
