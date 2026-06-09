<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

/**
 * Dispatched when sandbox-gateway begins reporting a different latest image
 * generation than what the warm pool was previously stocking. A generation is
 * the pair (agent_image, agfs_image); this event fires when EITHER changes.
 * Subscribers are expected to invalidate cached state tied to the old
 * generation.
 */
class SandboxImageChangedEvent extends AbstractEvent
{
    public function __construct(
        private readonly string $previousAgentImage,
        private readonly string $currentAgentImage,
        private readonly string $previousAgfsImage = '',
        private readonly string $currentAgfsImage = ''
    ) {
        parent::__construct();
    }

    public function getPreviousAgentImage(): string
    {
        return $this->previousAgentImage;
    }

    public function getCurrentAgentImage(): string
    {
        return $this->currentAgentImage;
    }

    public function getPreviousAgfsImage(): string
    {
        return $this->previousAgfsImage;
    }

    public function getCurrentAgfsImage(): string
    {
        return $this->currentAgfsImage;
    }
}
