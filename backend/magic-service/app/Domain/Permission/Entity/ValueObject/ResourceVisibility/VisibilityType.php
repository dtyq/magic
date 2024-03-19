<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\ResourceVisibility;

/**
 * 可见性类型枚举.
 */
enum VisibilityType: int
{
    /**
     * 不配置可见性.
     */
    case NONE = 0;

    /**
     * 全员可见（组织级别）.
     */
    case ALL = 1;

    /**
     * 部分可见（指定用户和部门）.
     */
    case SPECIFIC = 2;
}
