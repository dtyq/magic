<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity\ValueObject;

enum GroupLimitEnum: int
{
    // 普通群聊最大人数限制
    case NormalGroup = 1000;
}
