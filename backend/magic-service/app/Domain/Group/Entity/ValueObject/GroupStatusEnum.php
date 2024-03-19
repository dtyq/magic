<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity\ValueObject;

enum GroupStatusEnum: int
{
    // 正常
    case Normal = 1;

    // 解散
    case Disband = 2;
}
