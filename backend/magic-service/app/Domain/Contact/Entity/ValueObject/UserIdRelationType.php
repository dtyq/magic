<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 用户id的关联值的含义.
 */
enum UserIdRelationType: int
{
    /**
     * 组织编码
     */
    case organizationCode = 0;

    /**
     * 应用编码
     */
    case applicationCode = 1;

    /**
     * 应用的创建组织编码
     */
    case applicationCreatedOrganizationCode = 2;

    /**
     * 将枚举类型转换:
     */
    public static function getCaseFromUserIdType(UserIdType $userIdType): self
    {
        return match ($userIdType) {
            UserIdType::UserId => self::organizationCode,
            UserIdType::OpenId => self::applicationCode,
            UserIdType::UnionId => self::applicationCreatedOrganizationCode,
        };
    }
}
