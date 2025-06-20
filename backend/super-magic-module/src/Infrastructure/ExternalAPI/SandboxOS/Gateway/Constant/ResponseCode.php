<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant;

/**
 * 沙箱网关响应码常量
 * 根据沙箱通信文档定义的响应码
 */
class ResponseCode
{
    /**
     * 成功响应码
     */
    public const SUCCESS = 1000;

    /**
     * 错误响应码
     */
    public const ERROR = 2000;

    /**
     * 检查响应码是否表示成功
     */
    public static function isSuccess(int $code): bool
    {
        return $code === self::SUCCESS;
    }

    /**
     * 检查响应码是否表示错误
     */
    public static function isError(int $code): bool
    {
        return $code === self::ERROR;
    }

    /**
     * 获取响应码描述
     */
    public static function getDescription(int $code): string
    {
        return match ($code) {
            self::SUCCESS => 'Success',
            self::ERROR => 'Error',
            default => 'Unknown',
        };
    }
} 