<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskInitializationMessageDTO;

/**
 * Task initialization event.
 */
class TaskInitializationEvent
{
    public function __construct(
        public readonly TaskInitializationMessageDTO $message
    ) {
    }
}
