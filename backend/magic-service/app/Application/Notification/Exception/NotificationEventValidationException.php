<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Exception;

use App\ErrorCode\NotificationErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Throwable;

final class NotificationEventValidationException extends BusinessException
{
    public function __construct(
        NotificationErrorCode $errorCode,
        string $message,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $errorCode->value, $previous);
    }
}
