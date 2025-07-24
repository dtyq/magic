<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;

class AttachmentsProcessedEvent
{
    public function __construct(
        /** @var TaskFileEntity[] Array of processed file entities */
        public array $processedAttachments,
        public TaskContext $taskContext
    ) {
    }
}
