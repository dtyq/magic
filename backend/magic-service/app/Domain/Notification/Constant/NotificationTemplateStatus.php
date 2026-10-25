<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Constant;

enum NotificationTemplateStatus: string
{
    case ACTIVE = 'active';
    case ARCHIVED = 'archived';
}
