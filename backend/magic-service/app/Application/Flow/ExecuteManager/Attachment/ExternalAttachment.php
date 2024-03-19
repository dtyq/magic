<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment;

use App\Infrastructure\Util\FileType;

/**
 * 外链.
 */
class ExternalAttachment extends AbstractAttachment
{
    public function __construct(string $url)
    {
        $this->url = $url;
        $this->ext = FileType::getType($url);
        $this->size = 0;
        $this->name = basename($url);
        $this->originAttachment = $url;
    }
}
