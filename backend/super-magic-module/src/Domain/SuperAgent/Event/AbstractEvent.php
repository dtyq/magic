<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

abstract class AbstractEvent
{
    private readonly int $eventId;

    public function __construct()
    {
        // Generate unique snowflake ID for each event instance
        $this->eventId = IdGenerator::getSnowId();
    }

    /**
     * Get the unique event ID.
     */
    public function getEventId(): int
    {
        return $this->eventId;
    }
}
