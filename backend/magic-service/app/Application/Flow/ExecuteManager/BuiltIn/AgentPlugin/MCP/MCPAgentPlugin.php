<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin\MCP;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\MCPServerConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\AgentPluginDefine;
use App\Infrastructure\Core\Contract\Flow\AgentPluginInterface;

#[AgentPluginDefine(code: 'mcp', name: 'MCP Agent Plugin', description: 'MCP Agent Plugin for Magic Control Panel')]
class MCPAgentPlugin implements AgentPluginInterface
{
    /**
     * @var MCPServerConfig[]
     */
    protected array $mcpList = [];

    public function getParamsTemplate(): array
    {
        return [
            'mcp_list' => [],
        ];
    }

    public function parseParams(array $params): array
    {
        $mcpList = [];
        foreach ($params['mcp_list'] ?? [] as $mcpItem) {
            if (empty($mcpItem['id'])) {
                continue;
            }
            $mcpList[] = new MCPServerConfig(
                id: (string) $mcpItem['id'],
                name: $mcpItem['name'] ?? '',
                description: $mcpItem['description'] ?? '',
                type: isset($mcpItem['type']) ? ServiceType::tryFrom($mcpItem['type']) : ServiceType::SSE,
            );
        }
        $this->mcpList = $mcpList;

        return [
            'mcp_list' => array_map(fn (MCPServerConfig $config) => $config->toArray(), $this->mcpList),
        ];
    }

    public function getAppendSystemPrompt(): ?string
    {
        return null;
    }

    public function getTools(): array
    {
        return [];
    }
}
