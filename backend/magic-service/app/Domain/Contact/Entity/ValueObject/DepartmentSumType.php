<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 部门成员求和类型。
 */
enum DepartmentSumType: int
{
    // 1：返回部门直属用户总数，
    case DirectEmployee = 1;

    // 2：返回本部门 + 所有子部门用户总数
    case All = 2;
}
