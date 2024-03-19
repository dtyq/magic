<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 用户查询类型。
 */
enum UserQueryType: int
{
    // 人员
    case User = 1;

    // 人员 + 部门
    case UserAndDepartment = 2;

    // 人员 + 部门（完整路径）
    case UserAndDepartmentFullPath = 3;

    /**
     * @return int[]
     */
    public static function types(): array
    {
        return [
            self::User->value,
            self::UserAndDepartment->value,
            self::UserAndDepartmentFullPath->value,
        ];
    }
}
