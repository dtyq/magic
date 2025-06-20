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
    public const SUCCESS = 1000;

    /**
     * Error response code.
     */
    public const ERROR = 2000;

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
     * Get response code description.
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
