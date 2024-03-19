<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

/**
 * 好友状态.
 */
enum FriendStatus: int
{
    // 申请
    case Apply = 1;

    // 同意
    case Agree = 2;

    // 拒绝
    case Refuse = 3;

    // 忽略
    case Ignore = 4;
}
