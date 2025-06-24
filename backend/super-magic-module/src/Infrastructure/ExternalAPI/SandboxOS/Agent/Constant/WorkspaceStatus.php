<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant;

/**
 * 工作区状态常量
 * 定义Agent工作区的各种状态值.
 */
class WorkspaceStatus
{
    /**
     * 未初始化 - AgentDispatcher未创建或未初始化.
     */
    public const int UNINITIALIZED = 0;

    /**
     * 正在初始化 - 预留状态，暂未使用.
     */
    public const int INITIALIZING = 1;

    /**
     * 初始化完成 - 工作区完全可用.
     */
    public const int READY = 2;

    /**
     * 初始化错误 - 初始化过程中发生异常.
     */
    public const int ERROR = -1;

    /**
     * 获取状态描述.
     *
     * @param int $status 状态值
     * @return string 状态描述
     */
    public static function getDescription(int $status): string
    {
        return match ($status) {
            self::UNINITIALIZED => '未初始化',
            self::INITIALIZING => '正在初始化',
            self::READY => '初始化完成',
            self::ERROR => '初始化错误',
            default => '未知状态',
        };
    }

    /**
     * 检查状态是否为就绪状态.
     *
     * @param int $status 状态值
     * @return bool 是否就绪
     */
    public static function isReady(int $status): bool
    {
        return $status === self::READY;
    }

    /**
     * 检查状态是否为错误状态.
     *
     * @param int $status 状态值
     * @return bool 是否错误
     */
    public static function isError(int $status): bool
    {
        return $status === self::ERROR;
    }
}
