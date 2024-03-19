<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Extra;

enum PermissionRange: int
{
    // 全部
    case ALL = 1;

    // 指定
    case SELECT = 2;
}
