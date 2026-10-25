<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant;

/**
 * Sandbox Gateway Response Code Constants
 * Response codes defined according to sandbox communication documentation.
 */
class ResponseCode
{
    /**
     * Success response code.
     */
    public const int SUCCESS = 1000;

    /**
     * Error response code.
     */
    public const int ERROR = 2000;

    /**
     * Not found response code.
     */
    public const int NOT_FOUND = 4004;

    /**
     * User tool call question not found (expired or already consumed) response code.
     * Must stay in sync with super-magic ErrorCode::USER_TOOL_CALL_NOT_FOUND.
     */
    public const int USER_TOOL_CALL_NOT_FOUND = 4100;

    // 同步 Python ErrorCode；环境退出不会结束等待中的问题。
    public const int USER_TOOL_CALL_ENVIRONMENT_CLOSING = 4101;

    /**
     * Check if response code indicates success.
     */
    public static function isSuccess(int $code): bool
    {
        return $code === self::SUCCESS;
    }

    /**
     * Check if response code indicates error.
     */
    public static function isError(int $code): bool
    {
        return $code === self::ERROR;
    }

    /**
     * Check if response code indicates not found.
     */
    public static function isNotFound(int $code): bool
    {
        return $code === self::NOT_FOUND;
    }

    /**
     * Check if the response indicates the user tool call question was not found
     * (already timed out or submitted twice).
     */
    public static function isUserToolCallNotFound(int $code): bool
    {
        return $code === self::USER_TOOL_CALL_NOT_FOUND;
    }

    /**
     * Get response code description.
     */
    public static function getDescription(int $code): string
    {
        return match ($code) {
            self::SUCCESS => 'Success',
            self::ERROR => 'Error',
            self::NOT_FOUND => 'Not Found',
            self::USER_TOOL_CALL_NOT_FOUND => 'User Tool Call Not Found',
            self::USER_TOOL_CALL_ENVIRONMENT_CLOSING => 'User Tool Call Environment Closing',
            default => 'Unknown',
        };
    }
}
