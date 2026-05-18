<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

/**
 * Dispatched when sandbox-gateway begins reporting a different latest agent
 * image than what the warm pool was previously stocking. Subscribers are
 * expected to invalidate cached state tied to the old generation.
 */
class SandboxAgentImageChangedEvent extends AbstractEvent
{
    public function __construct(
        private readonly string $previousImage,
        private readonly string $currentImage
    ) {
        parent::__construct();
    }

    public function getPreviousImage(): string
    {
        return $this->previousImage;
    }

    public function getCurrentImage(): string
    {
        return $this->currentImage;
    }
}
