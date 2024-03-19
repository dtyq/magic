<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum InstructionInsertLocation: int
{
    // 消息内容前方
    case Before = 1;

    // 消息内容中光标位置
    case Cursor = 2;

    // 消息内容后方
    case After = 3;
}
