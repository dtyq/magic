<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject;

enum InstructionType: int
{
    // 单选
    case SINGLE_CHOICE = 1;

    // 开关
    case SWITCH = 2;

    // 文本
    case TEXT = 3;
}
