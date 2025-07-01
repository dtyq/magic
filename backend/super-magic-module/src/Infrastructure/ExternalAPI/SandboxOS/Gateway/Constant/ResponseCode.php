<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant;

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
     * Get response code description.
     */
    public static function getDescription(int $code): string
    {
        return match ($code) {
            self::SUCCESS => 'Success',
            self::ERROR => 'Error',
            self::NOT_FOUND => 'Not Found',
            default => 'Unknown',
        };
    }
}
