<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant;

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
     * 沙箱已退出状态
     */
    public const EXITED = 'Exited';

    /**
     * 沙箱未知状态
     */
    public const UNKNOWN = 'Unknown';

    /**
     * 沙箱未找到状态
     */
    public const NOT_FOUND = 'NotFound';

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
