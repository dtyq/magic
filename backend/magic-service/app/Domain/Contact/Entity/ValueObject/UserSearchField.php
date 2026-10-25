<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 用户搜索字段。
 */
enum UserSearchField: string
{
    /** 组织内用户 ID，精确匹配。 */
    case UserId = 'user_id';

    /** 账号手机号，精确匹配。 */
    case Phone = 'phone';

    /** 用户名称，同时模糊匹配昵称和真名。 */
    case UserName = 'user_name';
}
