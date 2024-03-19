<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 资源列表方法处理器.
 */
class ResourceListHandler extends AbstractMethodHandler
{
    /**
     * 处理资源列表请求.
     */
    public function handle(MessageInterface $request): ?array
    {
        return [
            'resources' => $this->getResourceManager()->getResources(),
        ];
    }
}
