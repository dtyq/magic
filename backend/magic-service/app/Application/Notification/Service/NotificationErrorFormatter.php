<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use Throwable;

final class NotificationErrorFormatter
{
    public const MAX_MESSAGE_LENGTH = 500;

    public static function code(Throwable $throwable, int $fallback): string
    {
        $code = $throwable->getCode();
        return is_int($code) && $code > 0 ? (string) $code : (string) $fallback;
    }

    public static function message(Throwable $throwable): string
    {
        $message = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $throwable->getMessage()) ?? '';
        $message = preg_replace('/\s+/u', ' ', trim($message)) ?? '';
        if ($message === '') {
            $message = $throwable::class;
        }

        return mb_substr($message, 0, self::MAX_MESSAGE_LENGTH);
    }
}
