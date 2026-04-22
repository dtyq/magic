<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway\Queue;

final class QueueCoreRedisKeys
{
    public static function operation(string $operationId): string
    {
        return sprintf('mg:queue:operation:%s', $operationId);
    }

    public static function userQueue(string $endpoint, string $userId): string
    {
        return sprintf('mg:queue:user_queue:%s:%s', $endpoint, $userId);
    }

    public static function ready(string $endpoint): string
    {
        return sprintf('mg:queue:ready:%s', $endpoint);
    }

    public static function waitingAll(string $endpoint): string
    {
        return sprintf('mg:queue:waiting_all:%s', $endpoint);
    }

    public static function running(string $endpoint): string
    {
        return sprintf('mg:queue:running:%s', $endpoint);
    }

    public static function userPending(string $endpoint): string
    {
        return sprintf('mg:queue:user_pending:%s', $endpoint);
    }

    public static function userActive(string $endpoint, string $userId): string
    {
        return sprintf('mg:queue:user_active:%s:%s', $endpoint, $userId);
    }

    /**
     * 记录同一组织用户当前正在运行的视频任务 ID 列表。
     */
    public static function userActiveOperations(string $organizationCode, string $userId): string
    {
        return sprintf('mg:video:user_active_operations:%s:%s', $organizationCode, $userId);
    }

    /**
     * 记录同一组织当前正在运行的视频任务 ID 列表。
     */
    public static function organizationActiveOperations(string $organizationCode): string
    {
        return sprintf('mg:video:organization_active_operations:%s', $organizationCode);
    }

    public static function signalList(): string
    {
        return 'mg:queue:dispatch_signal';
    }

    public static function seq(): string
    {
        return 'mg:queue:seq';
    }
}
