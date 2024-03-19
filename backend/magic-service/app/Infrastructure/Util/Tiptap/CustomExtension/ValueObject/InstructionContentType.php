<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject;

enum InstructionContentType: string
{
    case TEXT = 'text';
    case QUICK_INSTRUCTION = 'quick-instruction';
}
