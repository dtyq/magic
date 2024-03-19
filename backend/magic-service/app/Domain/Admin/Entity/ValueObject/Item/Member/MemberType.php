<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Item\Member;

enum MemberType: int
{
    case USER = 1;
    case DEPARTMENT = 2;
}
