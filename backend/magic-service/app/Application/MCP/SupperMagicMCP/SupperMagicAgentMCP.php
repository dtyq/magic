<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Application\MCP\Service\MCPServerAppService;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

readonly class SupperMagicAgentMCP implements SupperMagicAgentMCPInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicUserSettingDomainService $magicUserSettingDomainService,
        protected MCPServerAppService $MCPServerAppService,
        protected TempAuthInterface $tempAuth,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('SupperMagicAgentMCP');
    }

    public function createChatMessageRequestMcpConfig(MCPDataIsolation $dataIsolation, ?string $mentions = null, array $agentIds = [], array $mcpIds = [], array $toolIds = []): ?array
    {
        $globalMcpServers = $this->createGlobalMcpServers($dataIsolation);
        // todo 自定义 agent、mcp
        $agentMcpServers = [];
        $currentMcpServers = [];
        $toolMcpServers = [];

        $mcpServers = [
            'mcpServers' => array_merge($globalMcpServers, $agentMcpServers, $currentMcpServers, $toolMcpServers),
        ];

        $this->logger->debug('createChatMessageRequestMcpConfig', $mcpServers);
        return $mcpServers;
    }

    private function createGlobalMcpServers(MCPDataIsolation $mcpDataIsolation): array
    {
        $dataIsolation = DataIsolation::create($mcpDataIsolation->getCurrentOrganizationCode(), $mcpDataIsolation->getCurrentUserId());
        $servers = [];

        $mcpSettings = $this->magicUserSettingDomainService->get($dataIsolation, 'super_magic_mcp_servers');
        if (! $mcpSettings) {
            return $servers;
        }
        $mcpServerIds = array_column($mcpSettings->getValue()['servers'], 'id');
        $mcpServerIds = array_filter($mcpServerIds);
        if (empty($mcpServerIds)) {
            return $servers;
        }

        $query = new MCPServerQuery();
        $query->setEnabled(true);
        $query->setCodes($mcpServerIds);
        $data = $this->MCPServerAppService->availableQueries($mcpDataIsolation, $query, Page::createNoPage());
        $mcpServers = $data['list'] ?? [];

        $localHttpUrl = config('super-magic.sandbox.callback_host', '');

        foreach ($mcpServers as $mcpServer) {
            if (! in_array($mcpServer->getCode(), $mcpServerIds, true)) {
                continue;
            }

            $mcpServerConfig = MCPServerConfigUtil::create(
                $mcpDataIsolation,
                $mcpServer,
                $localHttpUrl,
            );
            if (! $mcpServerConfig) {
                continue;
            }
            if (str_starts_with($mcpServerConfig->getUrl(), $localHttpUrl)) {
                $token = $this->tempAuth->create([
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'server_code' => $mcpServer->getCode(),
                ], 3600);
                $mcpServerConfig->setToken($token);
            }

            $servers[$mcpServer->getName()] = $mcpServerConfig->toArray();
        }
        return $servers;
    }
}
