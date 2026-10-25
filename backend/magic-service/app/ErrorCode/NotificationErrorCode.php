<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/** Notification user API errors: 35000-35099. */
enum NotificationErrorCode: int
{
    #[ErrorMessage('notification.not_found')]
    case NOT_FOUND = 35000;

    #[ErrorMessage('notification.withdrawn')]
    case WITHDRAWN = 35001;

    #[ErrorMessage('notification.event_duplicated')]
    case EVENT_DUPLICATED = 35005;

    #[ErrorMessage('notification.event_not_retryable')]
    case EVENT_NOT_RETRYABLE = 35006;

    #[ErrorMessage('notification.unsupported_schema_version')]
    case UNSUPPORTED_SCHEMA_VERSION = 35007;

    #[ErrorMessage('notification.event_type_not_registered')]
    case EVENT_TYPE_NOT_REGISTERED = 35008;

    #[ErrorMessage('notification.event_payload_invalid')]
    case EVENT_PAYLOAD_INVALID = 35009;

    #[ErrorMessage('notification.template_not_found')]
    case TEMPLATE_NOT_FOUND = 35010;

    #[ErrorMessage('notification.organization_context_required')]
    case ORGANIZATION_CONTEXT_REQUIRED = 35012;

    #[ErrorMessage('notification.event_dispatch_failed')]
    case EVENT_DISPATCH_FAILED = 35015;
}
