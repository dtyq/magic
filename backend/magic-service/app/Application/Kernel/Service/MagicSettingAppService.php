<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Kernel\DTO\GlobalConfig;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use Hyperf\Redis\Redis;

class MagicSettingAppService extends AbstractKernelAppService
{
    private const string CACHE_KEY = 'magic:global_config_cache';

    public function __construct(
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly Redis $redis,
    ) {
    }

    /**
     * 保存全局配置
     * 全局配置不属于任何账号、组织或用户.
     */
    public function save(GlobalConfig $config): GlobalConfig
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::GlobalConfig->value);
        $entity->setValue($config->toArray());

        $this->magicUserSettingDomainService->saveGlobal($entity);

        // 重置缓存
        $this->redis->del(self::CACHE_KEY);

        return $config;
    }

    /**
     * 获取全局配置.
     */
    public function get(): GlobalConfig
    {
        $cache = $this->redis->get(self::CACHE_KEY);
        if ($cache) {
            $data = json_decode($cache, true) ?? [];
            return GlobalConfig::fromArray($data);
        }

        $entity = $this->magicUserSettingDomainService->getGlobal(UserSettingKey::GlobalConfig->value);
        $config = $entity ? GlobalConfig::fromArray($entity->getValue()) : new GlobalConfig();

        $this->redis->set(self::CACHE_KEY, json_encode($config->toArray()));

        return $config;
    }
}
