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
use App\Infrastructure\Util\Locker\Excpetion\LockException;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Redis\GlobalConfigCacheUtil;
use Hyperf\Redis\Redis;

/**
 * Platform Settings Domain Service.
 * Handles platform configuration business logic at domain level.
 */
class PlatformSettingsDomainService
{
    private const string CACHE_KEY = 'magic:platform_settings_cache:v2';

    private const string LEGACY_CACHE_KEY = 'magic:platform_settings_cache';

    private const int CACHE_TTL = 300;

    private const string UPDATE_LOCK = 'platform_settings_update';

    public function __construct(
        private readonly MagicUserSettingRepositoryInterface $magicUserSettingRepository,
        private readonly Redis $redis,
        private readonly LockerInterface $locker,
    ) {
    }

    /** 缓存回填与配置保存共用互斥锁，避免旧读取在失效之后写回。 */
    public function get(): PlatformSettings
    {
        $settings = $this->getCachedSettings();
        if ($settings !== null) {
            return $settings;
        }

        $owner = bin2hex(random_bytes(16));
        if (! $this->locker->spinLock(self::UPDATE_LOCK, $owner, 180, 3)) {
            // 锁超时只读数据库，不参与回填，避免覆盖其他请求保存的新值。
            return $this->getPersisted();
        }
        try {
            $settings = $this->getCachedSettings();
            if ($settings !== null) {
                return $settings;
            }
            $settings = $this->getPersisted();
            $this->redis->setex(self::CACHE_KEY, self::CACHE_TTL, json_encode($settings->toArray()));
            return $settings;
        } finally {
            $this->locker->release(self::UPDATE_LOCK, $owner);
        }
    }

    /** 倍率计算、管理配置与写入链统一读取持久化状态，不依赖展示缓存。 */
    public function getPersisted(): PlatformSettings
    {
        $entity = $this->magicUserSettingRepository->getGlobal(UserSettingKey::PlatformSettings->value);
        return $entity ? PlatformSettings::fromArray($entity->getValue()) : new PlatformSettings();
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

    /** 在统一互斥范围内读取最新配置并应用字段更新，防止不同页面互相覆盖。 */
    public function update(callable $updater): PlatformSettings
    {
        $owner = bin2hex(random_bytes(16));
        if (! $this->locker->spinLock(self::UPDATE_LOCK, $owner, 180, 3)) {
            throw new LockException();
        }
        try {
            $current = $this->getPersisted();
            $settings = $updater($current);
            return $this->persist($settings);
        } finally {
            $this->locker->release(self::UPDATE_LOCK, $owner);
        }
    }

    /** 保留全量保存契约；管理端部分更新必须使用 update，在锁内合并最新状态。 */
    public function save(PlatformSettings $settings): PlatformSettings
    {
        return $this->update(static fn (PlatformSettings $current): PlatformSettings => $settings);
    }

    /** 仅使用当前版本的完整缓存，缺失倍率字段时回源读取。 */
    private function getCachedSettings(): ?PlatformSettings
    {
        $cache = $this->redis->get(self::CACHE_KEY);
        if (! $cache) {
            return null;
        }
        $data = json_decode($cache, true);
        return is_array($data) && isset($data['model_billing_multiplier']) ? PlatformSettings::fromArray($data) : null;
    }

    /** 保存已归一化配置并清除平台缓存，仅供更新临界区调用。 */
    private function persist(PlatformSettings $settings): PlatformSettings
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::PlatformSettings->value);
        $entity->setValue($settings->toArray());
        $entity->setMagicId(null);
        $this->magicUserSettingRepository->saveGlobal($entity);
        $this->redis->del(self::CACHE_KEY);
        $this->redis->del(self::LEGACY_CACHE_KEY);
        GlobalConfigCacheUtil::deleteGlobalConfig();
        return $settings;
    }
}
