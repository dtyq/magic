<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct;

interface MessageAttachmentHandlerInterface
{
    public function handle(string $content, bool $markdownImageFormat = false): string;
}
