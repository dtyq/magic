<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 用户在组织中的状态
 */
enum UserStatus: int
{
    // 0:冻结 (刚同步过来没激活)
    case Frozen = 0;

    // 1:已激活
    case Activated = 1;

    // 2:已离职
    case Resigned = 2;

    // 3:已退出
    case Exited = 3;
}
