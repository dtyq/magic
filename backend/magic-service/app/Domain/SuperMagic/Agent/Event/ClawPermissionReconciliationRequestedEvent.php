<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Event;

final readonly class ClawPermissionReconciliationRequestedEvent
{
    public function __construct(public string $organizationCode)
    {
    }
}
