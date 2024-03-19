<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * 用户的一些可选操作.
 */
enum UserOption: int
{
    // 隐藏
    case Hidden = 1;
}
