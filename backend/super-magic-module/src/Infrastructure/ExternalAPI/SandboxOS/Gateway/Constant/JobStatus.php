<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant;

/**
 * 任务状态常量
 * 根据沙箱任务管理文档定义的状态值
 */
class JobStatus
{
    /**
     * 任务已创建但未开始.
     */
    public const PENDING = 0;

    /**
     * 任务正在运行.
     */
    public const RUNNING = 1;

    /**
     * 任务成功完成.
     */
    public const SUCCEEDED = 2;

    /**
     * 任务失败.
     */
    public const FAILED = 3;

    /**
     * 任务未找到.
     */
    public const NOT_FOUND = 4;

    /**
     * 获取所有有效状态
     */
    public static function getAllStatuses(): array
    {
        return [
            self::PENDING,
            self::RUNNING,
            self::SUCCEEDED,
            self::FAILED,
            self::NOT_FOUND,
        ];
    }

    /**
     * 检查状态是否有效.
     */
    public static function isValidStatus(int $status): bool
    {
        return in_array($status, self::getAllStatuses(), true);
    }

    /**
     * 检查任务是否正在进行中.
     */
    public static function isInProgress(int $status): bool
    {
        return in_array($status, [self::PENDING, self::RUNNING], true);
    }

    /**
     * 检查任务是否已完成（无论成功或失败）.
     */
    public static function isCompleted(int $status): bool
    {
        return in_array($status, [self::SUCCEEDED, self::FAILED], true);
    }

    /**
     * 检查任务是否成功.
     */
    public static function isSucceeded(int $status): bool
    {
        return $status === self::SUCCEEDED;
    }

    /**
     * 检查任务是否失败.
     */
    public static function isFailed(int $status): bool
    {
        return $status === self::FAILED;
    }

    /**
     * 获取状态描述.
     */
    public static function getDescription(int $status): string
    {
        return match ($status) {
            self::PENDING => 'Pending',
            self::RUNNING => 'Running',
            self::SUCCEEDED => 'Succeeded',
            self::FAILED => 'Failed',
            self::NOT_FOUND => 'Not Found',
            default => 'Unknown',
        };
    }
}
