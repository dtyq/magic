<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Capabilities;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 初始化方法处理器.
 */
class InitializeHandler extends AbstractMethodHandler
{
    /**
     * 处理初始化请求.
     */
    public function handle(MessageInterface $request): ?array
    {
        $capabilities = new Capabilities(
            hasTools: ! $this->getToolManager()->isEmpty(),
            hasResources: ! $this->getResourceManager()->isEmpty(),
            hasPrompts: ! $this->getPromptManager()->isEmpty()
        );

        return [
            'protocolVersion' => '2025-03-26',
            'capabilities' => $capabilities->jsonSerialize(),
            'serverInfo' => [
                'name' => 'magic-sse',
                'version' => '1.0.0',
            ],
            'instructions' => '',
        ];
    }
}
