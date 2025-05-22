<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

class PingHandler extends AbstractMethodHandler
{
    public function handle(MessageInterface $request): ?array
    {
        return [];
    }
}
