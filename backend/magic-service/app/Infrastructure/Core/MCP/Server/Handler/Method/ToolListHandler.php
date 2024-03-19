<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 工具列表方法处理器.
 */
class ToolListHandler extends AbstractMethodHandler
{
    /**
     * 处理工具列表请求.
     */
    public function handle(MessageInterface $request): ?array
    {
        return [
            'tools' => $this->getToolManager()->getToolSchemas(),
        ];
    }
}
