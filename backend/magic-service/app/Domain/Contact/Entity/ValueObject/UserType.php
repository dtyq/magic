<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * magic_user的类型.
 */
enum UserType: int
{
    // ai
    case Ai = 0;

    // 人类
    case Human = 1;

    /**
     * 将枚举类型转换:0转为ai,1转为 user.
     */
    public static function getCaseFromName(string $typeName): ?self
    {
        foreach (self::cases() as $userType) {
            if ($userType->name === $typeName) {
                return $userType;
            }
        }
        return null;
    }
}
