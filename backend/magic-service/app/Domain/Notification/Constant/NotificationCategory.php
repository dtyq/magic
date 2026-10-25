<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Constant;

enum NotificationCategory: string
{
    case SYSTEM = 'system';
    case AUTHORIZATION = 'authorization';
}
