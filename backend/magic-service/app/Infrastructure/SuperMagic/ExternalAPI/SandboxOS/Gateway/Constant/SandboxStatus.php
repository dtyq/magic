<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant;

/**
 * 沙箱状态常量
 * 根据沙箱通信文档定义的状态值
 */
class SandboxStatus
{
    /**
     * 沙箱待启动状态
     */
    public const PENDING = 'Pending';

    /**
     * 沙箱运行中状态
     */
    public const RUNNING = 'Running';

    /**
     * 沙箱已退出状态（agent 容器已终止，调用方应视为需要重建）.
     */
    public const EXITED = 'Exited';

    /**
     * 沙箱未知状态
     */
    public const UNKNOWN = 'Unknown';

    /**
     * 沙箱未找到状态（pod 不存在，非 k8s 原生 phase）.
     */
    public const NOT_FOUND = 'NotFound';

    /**
     * 沙箱未就绪状态：pod 处于 Running，但存在未就绪的容器（非 k8s 原生 phase）.
     */
    public const NOT_READY = 'NotReady';

    /**
     * 沙箱执行成功状态（pod 终态，agent 容器通常已终止）.
     */
    public const SUCCEEDED = 'Succeeded';

    /**
     * 沙箱执行失败状态（pod 终态，agent 容器通常已终止）.
     */
    public const FAILED = 'Failed';

    /**
     * 获取所有有效状态
     */
    public static function getAllStatuses(): array
    {
        return [
            self::PENDING,
            self::RUNNING,
            self::EXITED,
            self::UNKNOWN,
            self::NOT_FOUND,
            self::NOT_READY,
            self::SUCCEEDED,
            self::FAILED,
        ];
    }

    /**
     * 检查状态是否有效.
     */
    public static function isValidStatus(string $status): bool
    {
        return in_array($status, self::getAllStatuses(), true);
    }

    /**
     * 检查沙箱是否可用（运行中）.
     */
    public static function isAvailable(string $status): bool
    {
        return $status === self::RUNNING;
    }
}
