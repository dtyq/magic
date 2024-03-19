<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event\Group;

class GroupDeleteEvent
{
    public function __construct(public string $groupId)
    {
    }
}
