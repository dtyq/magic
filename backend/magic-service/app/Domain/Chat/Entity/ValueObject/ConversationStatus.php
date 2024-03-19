<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum ConversationStatus: int
{
    case Normal = 0;

    // 隐藏
    case Hidden = 1;

    // 删除
    case Delete = 2;
}
