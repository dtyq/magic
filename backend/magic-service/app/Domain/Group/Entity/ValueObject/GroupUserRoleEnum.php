<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity\ValueObject;

enum GroupUserRoleEnum: int
{
    // 群主
    case OWNER = 1;

    // 管理员
    case ADMIN = 2;

    // 普通成员
    case MEMBER = 3;
}
