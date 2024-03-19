<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Kernel\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use Hyperf\Redis\Redis;

/**
 * Platform Settings Domain Service.
 * Handles platform configuration business logic at domain level.
 */
class PlatformSettingsDomainService
{
    private const string CACHE_KEY = 'magic:platform_settings_cache';

    public function __construct(
        private readonly MagicUserSettingRepositoryInterface $magicUserSettingRepository,
        private readonly Redis $redis,
    ) {
    }

    /**
     * Get platform settings.
     */
    public function get(): PlatformSettings
    {
        $cache = $this->redis->get(self::CACHE_KEY);
        if ($cache) {
            $data = json_decode($cache, true) ?? [];
            return PlatformSettings::fromArray($data);
        }

        $entity = $this->magicUserSettingRepository->getGlobal(UserSettingKey::PlatformSettings->value);
        $settings = $entity ? PlatformSettings::fromArray($entity->getValue()) : new PlatformSettings();
        $this->redis->set(self::CACHE_KEY, json_encode($settings->toArray()));
        return $settings;
    }

    /**
     * Get agent role name by language.
     * Fallback: current language -> en_US -> first available -> empty string.
     *
     * @param string $language Language code (e.g., 'zh_CN', 'en_US')
     * @return string Agent role name
     */
    public function getAgentRoleName(string $language): string
    {
        $settings = $this->get();
        $nameI18n = $settings->getAgentRoleNameI18n();

        // Try current language
        if (isset($nameI18n[$language]) && $nameI18n[$language] !== '') {
            return $nameI18n[$language];
        }

        // Fallback to English
        if (isset($nameI18n['en_US']) && $nameI18n['en_US'] !== '') {
            return $nameI18n['en_US'];
        }

        // Return first available value or empty string
        return ! empty($nameI18n) ? reset($nameI18n) : '';
    }

    /**
     * Get agent role description by language.
     * Fallback: current language -> en_US -> first available -> empty string.
     *
     * @param string $language Language code (e.g., 'zh_CN', 'en_US')
     * @return string Agent role description
     */
    public function getAgentRoleDescription(string $language): string
    {
        $settings = $this->get();
        $descriptionI18n = $settings->getAgentRoleDescriptionI18n();

        // Try current language
        if (isset($descriptionI18n[$language]) && $descriptionI18n[$language] !== '') {
            return $descriptionI18n[$language];
        }

        // Fallback to English
        if (isset($descriptionI18n['en_US']) && $descriptionI18n['en_US'] !== '') {
            return $descriptionI18n['en_US'];
        }

        // Return first available value or empty string
        return ! empty($descriptionI18n) ? reset($descriptionI18n) : '';
    }

    /**
     * Save platform settings.
     */
    public function save(PlatformSettings $settings): PlatformSettings
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::PlatformSettings->value);
        $entity->setValue($settings->toArray());
        $entity->setMagicId(null);
        $this->magicUserSettingRepository->saveGlobal($entity);
        $this->redis->del(self::CACHE_KEY);
        return $settings;
    }
}
