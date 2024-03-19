<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\QuickInstruction\DeepSearch;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Util\Tiptap\CustomExtension\QuickInstruction\DeepSearch\Item\Instruction;

class DeepSearchQuickInstructionAttrs extends AbstractEntity
{
    protected Instruction $instruction;

    protected string $value;
}
