<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\MCPServer;

use App\Infrastructure\Util\Context\RequestCoContext;
use Dtyq\PhpMcp\Server\Framework\Hyperf\Collector\Annotations\McpTool;

class Demo
{
    #[McpTool(name: 'user_info', description: '获取个人信息', server: 'demo', version: '1.0.0')]
    public function userInfo(): array
    {
        $authorization = RequestCoContext::getUserAuthorization();
        return [
            'info' => $authorization?->toArray(),
        ];
    }

    #[McpTool(name: 'add', description: '两个数字相加', server: 'demo', version: '1.0.0')]
    public function add(int $a, int $b): int
    {
        return $a + $b;
    }
}
