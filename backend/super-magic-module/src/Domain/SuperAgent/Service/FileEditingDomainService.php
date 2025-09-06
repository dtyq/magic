<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Hyperf\Redis\Redis;
use Psr\Container\ContainerInterface;

/**
 * 文件编辑状态领域服务
 */
class FileEditingDomainService
{
    private const REDIS_KEY_PREFIX = 'file_editing_status';

    private const TTL_SECONDS = 120; // 2分钟

    private Redis $redis;

    public function __construct(ContainerInterface $container)
    {
        $this->redis = $container->get(Redis::class);
    }

    /**
     * 加入编辑.
     */
    public function joinEditing(int $fileId, string $userId, string $organizationCode): void
    {
        $key = $this->buildRedisKey($fileId, $organizationCode);

        // 添加用户到编辑列表
        $this->redis->sadd($key, $userId);
        $this->redis->expire($key, self::TTL_SECONDS);
    }

    /**
     * 离开编辑.
     */
    public function leaveEditing(int $fileId, string $userId, string $organizationCode): void
    {
        $key = $this->buildRedisKey($fileId, $organizationCode);

        // 从编辑列表中移除用户
        $this->redis->srem($key, $userId);

        // 如果没有用户在编辑，删除整个key
        if ($this->redis->scard($key) === 0) {
            $this->redis->del($key);
        }
    }

    /**
     * 获取编辑用户数量.
     */
    public function getEditingUsersCount(int $fileId, string $organizationCode): int
    {
        $key = $this->buildRedisKey($fileId, $organizationCode);

        // 返回编辑用户数量
        return $this->redis->scard($key);
    }

    /**
     * 构建Redis键名.
     */
    public function buildRedisKey(int $fileId, string $organizationCode): string
    {
        return sprintf('%s:%s:%d', self::REDIS_KEY_PREFIX, $organizationCode, $fileId);
    }
}
