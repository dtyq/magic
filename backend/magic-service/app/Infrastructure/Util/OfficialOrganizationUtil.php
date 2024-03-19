<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

/**
 * 官方组织工具类
 * 统一管理官方组织相关的配置和判断逻辑.
 */
class OfficialOrganizationUtil
{
    private const array DEFAULT_OFFICIAL_ORGANIZATION_NAME = [
        'zh_CN' => '官方组织',
        'en_US' => 'Official Organization',
    ];

    /**
     * 获取官方组织编码
     */
    public static function getOfficialOrganizationCode(): string
    {
        return config('service_provider.office_organization', '');
    }

    /**
     * 判断是否为官方组织.
     */
    public static function isOfficialOrganization(string $organizationCode): bool
    {
        return $organizationCode === self::getOfficialOrganizationCode();
    }

    /**
     * 获取包含官方组织在内的组织编码数组.
     * @param string $currentOrganizationCode 当前组织编码
     * @return array 去重后的组织编码数组
     */
    public static function getOrganizationCodesWithOfficial(string $currentOrganizationCode): array
    {
        $officialOrganizationCode = self::getOfficialOrganizationCode();
        return array_filter(array_unique([$currentOrganizationCode, $officialOrganizationCode]));
    }

    /**
     * 检查官方组织编码是否已配置.
     */
    public static function hasOfficialOrganization(): bool
    {
        return ! empty(self::getOfficialOrganizationCode());
    }

    /**
     * 获取官方组织名称（i18n）.
     */
    public static function getOfficialOrganizationNameI18n(): array
    {
        $configured = config('service_provider.office_organization_name', []);
        if (! is_array($configured)) {
            return self::DEFAULT_OFFICIAL_ORGANIZATION_NAME;
        }

        $zhCN = isset($configured['zh_CN']) && is_string($configured['zh_CN']) && $configured['zh_CN'] !== ''
            ? $configured['zh_CN']
            : self::DEFAULT_OFFICIAL_ORGANIZATION_NAME['zh_CN'];
        $enUS = isset($configured['en_US']) && is_string($configured['en_US']) && $configured['en_US'] !== ''
            ? $configured['en_US']
            : self::DEFAULT_OFFICIAL_ORGANIZATION_NAME['en_US'];

        return [
            'zh_CN' => $zhCN,
            'en_US' => $enUS,
        ];
    }
}
