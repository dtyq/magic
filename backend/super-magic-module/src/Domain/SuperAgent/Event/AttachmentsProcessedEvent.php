<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class AttachmentsProcessedEvent
{
    public function __construct(
        public int $parentFileId,
        public int $projectId,
        public int $taskId = 0
    ) {
    }
}
