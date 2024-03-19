<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension;

use Tiptap\Extensions\RenderTextInterface;
use Tiptap\Nodes\HardBreak;

/**
 * Extends the default HardBreak node to support text serialization.
 * Renders as "\n" when converting rich text to plain text.
 */
class HardBreakTextNode extends HardBreak implements RenderTextInterface
{
    public function renderText($node): string
    {
        return "\n";
    }
}
