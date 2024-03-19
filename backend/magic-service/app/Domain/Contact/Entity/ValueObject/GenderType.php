<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

/**
 * gender的类型.
 */
enum GenderType: int
{
    // 未知
    case Unknown = 0;

    // 男
    case Male = 1;

    // 女
    case Female = 2;
}
