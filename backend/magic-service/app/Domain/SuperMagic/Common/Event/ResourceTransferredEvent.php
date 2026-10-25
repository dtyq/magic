<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\Event;

/** Emitted only after the ownership transaction has committed. */
class ResourceTransferredEvent extends AbstractEvent
{
    public function __construct(
        public readonly string $code,
        public readonly string $resourceType,
        public readonly string $organizationCode,
        public readonly string $fromUserId,
        public readonly string $toUserId,
    ) {
        parent::__construct();
    }
}
