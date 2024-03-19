<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Exception\InvalidParamsException;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 资源读取方法处理器.
 */
class ResourceReadHandler extends AbstractMethodHandler
{
    /**
     * 获取该处理器支持的方法名称.
     */
    public function getMethod(): string
    {
        return 'resources/read';
    }

    /**
     * 处理资源读取请求.
     */
    public function handle(MessageInterface $request): ?array
    {
        $params = $request->getParams();
        if (! isset($params['id'])) {
            throw new InvalidParamsException('Resource ID is required');
        }

        $resource = $this->getResourceManager()->getResource($params['id']);
        if ($resource === null) {
            throw new InvalidParamsException("Resource '{$params['id']}' not found");
        }

        return [
            'resource' => $resource,
        ];
    }
}
