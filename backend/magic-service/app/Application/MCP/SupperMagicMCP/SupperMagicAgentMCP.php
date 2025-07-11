<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Application\MCP\BuiltInMCP\SuperMagicChat\SuperMagicChatBuiltInMCPServer;
use App\Application\MCP\Service\MCPServerAppService;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

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
        $this->logger->debug('CreateChatMessageRequestMcpConfigArgs', ['mentions' => $mentions, 'agentIds' => $agentIds, 'mcpIds' => $mcpIds, 'toolIds' => $toolIds]);
        try {
            if ($mentions !== null) {
                $mentions = Json::decode($mentions);
                foreach ($mentions as $mention) {
                    $type = MentionType::tryFrom($mention['type'] ?? '');
                    switch ($type) {
                        case MentionType::AGENT:
                            if (! empty($mention['agent_id'])) {
                                $agentIds[] = $mention['agent_id'];
                            }
                            break;
                        case MentionType::MCP:
                            if (! empty($mention['id'])) {
                                $mcpIds[] = $mention['id'];
                            }
                            break;
                        case MentionType::TOOL:
                            if (! empty($mention['id'])) {
                                $toolIds[] = $mention['id'];
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            $agentIds = array_values(array_filter(array_unique($agentIds)));
            $mcpIds = array_values(array_filter(array_unique($mcpIds)));
            $toolIds = array_values(array_filter(array_unique($toolIds)));

            $builtinSuperMagicServer = SuperMagicChatBuiltInMCPServer::createByChatParams($dataIsolation, $agentIds, $toolIds);

            $mcpServers = $this->createMcpServers($dataIsolation, $mcpIds, [$builtinSuperMagicServer]);
            $mcpServers = [
                'mcpServers' => $mcpServers,
            ];
            $this->logger->debug('CreateChatMessageRequestMcpConfig', $mcpServers);
            return $mcpServers;
        } catch (Throwable $throwable) {
            $this->logger->error('CreateChatMessageRequestMcpConfigError', [
                'message' => $throwable->getMessage(),
                'code' => $throwable->getCode(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
        }
        return null;
    }

    private function createMcpServers(MCPDataIsolation $mcpDataIsolation, array $mcpIds = [], array $builtinServers = []): array
    {
        $dataIsolation = DataIsolation::create($mcpDataIsolation->getCurrentOrganizationCode(), $mcpDataIsolation->getCurrentUserId());
        $servers = [];

        $mcpSettings = $this->magicUserSettingDomainService->get($dataIsolation, 'super_magic_mcp_servers');
        if (! $mcpSettings) {
            return $servers;
        }
        $mcpServerIds = array_column($mcpSettings->getValue()['servers'], 'id');
        $mcpServerIds = array_filter($mcpServerIds);
        $mcpServerIds = array_values(array_unique(array_merge($mcpServerIds, $mcpIds)));

        $query = new MCPServerQuery();
        $query->setEnabled(true);
        $query->setCodes($mcpServerIds);
        $data = $this->MCPServerAppService->availableQueries($mcpDataIsolation, $query, Page::createNoPage());
        $mcpServers = $data['list'] ?? [];
        /** @var array<MCPServerEntity> $mcpServers */
        $mcpServers = array_filter(array_merge($mcpServers, $builtinServers), function ($item) {
            return $item instanceof MCPServerEntity;
        });

        $localHttpUrl = config('super-magic.sandbox.callback_host', '');

        foreach ($mcpServers as $mcpServer) {
            if (! $mcpServer->isBuiltIn() && ! in_array($mcpServer->getCode(), $mcpServerIds, true)) {
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
