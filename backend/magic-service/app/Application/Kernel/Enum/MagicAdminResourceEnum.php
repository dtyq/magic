<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Enum;

/**
 * Magic 组织管理员资源.
 */
enum MagicAdminResourceEnum: string
{
    case ORGANIZATION_ADMIN = 'MAGIC_ALL_PERMISSIONS';
    case PERSONAL_ORGANIZATION_ADMIN = 'MAGIC_PERSON_PERMISSIONS';
    case PLATFORM_ORGANIZATION_ADMIN = 'MAGIC_PLATFORM_PERMISSIONS';
}
