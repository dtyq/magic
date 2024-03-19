<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum InstructionDisplayType: int
{
    // 普通指令
    case Normal = 1;

    // 系统指令
    case System = 2;
}
