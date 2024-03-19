<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 部门的一些可选操作.
 */
enum DepartmentOption: int
{
    // 隐藏
    case Hidden = 1;
}
