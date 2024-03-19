<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 第三方平台与麦吉的部门、用户、组织编码、空间编码等的映射关系记录.
 */
enum ThirdPlatformIdMappingType: string
{
    // 部门
    case Department = 'department';

    // 用户
    case User = 'user';

    // 组织
    case Organization = 'organization';

    // 空间
    case Space = 'space';
}
