<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity\ValueObject;

enum GroupUserStatusEnum: int
{
    // 正常
    case Normal = 1;

    // 被禁言
    case Mute = 2;
}
