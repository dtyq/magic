<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Event;

use App\Domain\MCP\Entity\MCPServerEntity;

class MCPServerSavedEvent
{
    public function __construct(public MCPServerEntity $MCPServerEntity, public bool $create)
    {
    }
}
