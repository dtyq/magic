<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\BuiltInMCP\SuperMagicChat;

use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Infrastructure\Core\Collector\BuiltInMCP\Annotation\BuiltInMCPServerDefine;
use App\Infrastructure\Core\Contract\MCP\BuiltInMCPServerInterface;

#[BuiltInMCPServerDefine(serverCode: 'super_magic_chat', enabled: true, priority: 1)]
class SuperMagicChatBuiltInMCPServer implements BuiltInMCPServerInterface
{
    private static string $codePrefix = 'super-magic-chat-';

    public function __construct()
    {
    }

    public static function createByChatParams(MCPDataIsolation $MCPDataIsolation, array $agentIds = [], array $toolIds = []): string
    {
        $mcpServerCode = uniqid(self::$codePrefix);
        SuperMagicChatManager::createByChatParams($MCPDataIsolation, $mcpServerCode, $agentIds, $toolIds);
        return $mcpServerCode;
    }

    public static function match(string $mcpServerCode): bool
    {
        return str_starts_with($mcpServerCode, self::$codePrefix);
    }

    public function getServerCode(): string
    {
        return 'super_magic_chat';
    }

    public function getServerName(): string
    {
        return 'Super Magic Chat';
    }

    public function getRegisteredTools(string $mcpServerCode): array
    {
        return SuperMagicChatManager::getRegisteredTools($mcpServerCode);
    }
}
