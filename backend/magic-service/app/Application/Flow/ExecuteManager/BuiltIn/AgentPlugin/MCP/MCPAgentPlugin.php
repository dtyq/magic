<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin\MCP;

use App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin\AbstractAgentPlugin;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\MCPServerItem;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\MCP\Service\MCPServerDomainService;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\AgentPluginDefine;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Odin\Mcp\McpServerConfig;

#[AgentPluginDefine(code: 'mcp', name: 'MCP Agent Plugin', description: 'MCP Agent Plugin for Magic Control Panel')]
class MCPAgentPlugin extends AbstractAgentPlugin
{
    /**
     * @var MCPServerItem[]
     */
    protected array $mcpList = [];

    protected array $ids = [];

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
            if (in_array($mcpItem['id'], $this->ids, true)) {
                continue; // Skip if already exists
            }
            $item = new MCPServerItem(
                id: (string) $mcpItem['id'],
                name: $mcpItem['name'] ?? '',
                description: $mcpItem['description'] ?? '',
                type: isset($mcpItem['type']) ? ServiceType::tryFrom($mcpItem['type']) : ServiceType::SSE,
            );
            $mcpList[] = $item;
            $this->ids[] = $item->getId();
        }
        $this->mcpList = $mcpList;

        return [
            'mcp_list' => array_map(fn (MCPServerItem $config) => $config->toArray(), $this->mcpList),
        ];
    }

    /**
     * @return array<string, McpServerConfig>
     */
    public function getMcpServerConfigs(): array
    {
        $dataIsolation = MCPDataIsolation::create()->disabled();
        $query = new MCPServerQuery();
        $query->setCodes($this->ids);
        $query->setEnabled(true);
        $data = di(MCPServerDomainService::class)->queries($dataIsolation, $query, Page::createNoPage());

        $configs = [];
        foreach ($data['list'] ?? [] as $MCPServerEntity) {
            $config = $MCPServerEntity->createMcpServerConfig();
            if ($config) {
                $configs[$MCPServerEntity->getCode()] = $config;
            }
        }

        return $configs;
    }
}
