<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

final class ProviderVirtualIdentity
{
    public const string PLATFORM_OFFICIAL_ID = 'platform_official';

    public const string PLATFORM_OFFICIAL_NAME = '平台官方服务商';

    public static function isPlatformOfficialId(string $value): bool
    {
        return $value === self::PLATFORM_OFFICIAL_ID;
    }

    public static function matchesPlatformOfficialSearch(ProviderConfigSearchField $field, string $keyword): bool
    {
        return match ($field) {
            ProviderConfigSearchField::ConfigId => self::isPlatformOfficialId($keyword),
            ProviderConfigSearchField::ProviderName,
            ProviderConfigSearchField::ProviderAlias => $keyword === self::PLATFORM_OFFICIAL_NAME,
        };
    }

    /** @return array{service_provider_config_id: string, provider_name: string, provider_alias: string} */
    public static function platformOfficialSelectorItem(): array
    {
        return [
            'service_provider_config_id' => self::PLATFORM_OFFICIAL_ID,
            'provider_name' => self::PLATFORM_OFFICIAL_NAME,
            'provider_alias' => self::PLATFORM_OFFICIAL_NAME,
        ];
    }
}
