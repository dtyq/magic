<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Redis;

use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;

/**
 * 用户当前组织Redis服务
 */
class MagicUserOrganizationRedisService
{
    protected RedisProxy $redis;

    /**
     * Redis键前缀
     */
    protected string $keyPrefix = 'magic:user:current_organization:';

    /**
     * 缓存过期时间（秒）= 86400 * 90天.
     */
    protected int $ttl = 7776000;

    public function __construct(RedisFactory $redisFactory)
    {
        $this->redis = $redisFactory->get('default');
    }

    /**
     * 获取用户当前组织代码
     */
    public function getCurrentOrganizationCode(string $magicId): ?string
    {
        $organizationData = $this->getCurrentOrganizationData($magicId);
        return $organizationData['magic_organization_code'] ?? null;
    }

    /**
     * 设置用户当前组织完整数据.
     */
    public function setCurrentOrganizationData(string $magicId, array $organizationData): bool
    {
        $key = $this->getRedisKey($magicId);
        return $this->redis->setex($key, $this->ttl, json_encode($organizationData));
    }

    /**
     * 获取用户当前组织完整数据.
     */
    public function getCurrentOrganizationData(string $magicId): ?array
    {
        $key = $this->getRedisKey($magicId);
        $data = $this->redis->get($key);

        if ($data !== false) {
            $decoded = json_decode($data, true);
            return $decoded ?: null;
        }

        return null;
    }

    /**
     * 生成Redis键.
     */
    private function getRedisKey(string $magicId): string
    {
        return $this->keyPrefix . $magicId;
    }
}
