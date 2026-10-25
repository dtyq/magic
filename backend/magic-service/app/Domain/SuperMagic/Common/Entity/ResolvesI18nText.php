<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\Entity;

use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;

trait ResolvesI18nText
{
    /**
     * Resolve text in the requested language, then default/en_US/zh_CN, then the first scalar value.
     */
    private function resolveI18nText(?array $i18n, string $language): string
    {
        $i18n ??= [];

        // Keep one deterministic fallback order for every domain entity that exposes localized text.
        foreach ([$language, LanguageEnum::DEFAULT->value, LanguageEnum::EN_US->value, LanguageEnum::ZH_CN->value] as $key) {
            $value = $i18n[$key] ?? null;
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        foreach ($i18n as $value) {
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return '';
    }
}
