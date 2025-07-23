<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\MCP\BuiltInMCP\SuperMagicChat\SuperMagicChatBuiltInMCPServer;
use App\Application\MCP\Service\MCPServerAppService;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Agent\Service\AgentDomainService;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
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
        protected AgentDomainService $agentDomainService,
        protected MagicFlowDomainService $magicFlowDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('SupperMagicAgentMCP');
    }

    public function createChatMessageRequestMcpConfig(MCPDataIsolation $dataIsolation, TaskContext $taskContext, array $agentIds = [], array $mcpIds = [], array $toolIds = []): ?array
    {
        $mentions = $taskContext->getTask()->getMentions();
        $this->logger->debug('CreateChatMessageRequestMcpConfigArgs', ['mentions' => $mentions, 'agentIds' => $agentIds, 'mcpIds' => $mcpIds, 'toolIds' => $toolIds]);
        try {
            if ($mentions !== null) {
                $mentions = str_replace('\"', '"', $mentions);
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

            $serverOptions = [];
            if ($builtinSuperMagicServer) {
                $serverOptions[$builtinSuperMagicServer->getCode()] = $this->createBuiltinSuperMagicServerOptions($dataIsolation, $agentIds, $toolIds);
            }

            $projectId = $taskContext->getTask()->getProjectId();
            if ($projectId) {
                $projectMcpIds = $this->getProjectMcpServerIds($dataIsolation, (string) $projectId);
                $mcpIds = array_merge($mcpIds, $projectMcpIds);
            }

            $mcpServers = $this->createMcpServers($dataIsolation, $mcpIds, [$builtinSuperMagicServer], $serverOptions);

            $mcpServers = [
                'mcpServers' => $mcpServers,
            ];
            $this->logger->debug('CreateChatMessageRequestMcpConfig', $mcpServers);
            $taskContext->setMcpConfig($mcpServers);
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

    private function createMcpServers(MCPDataIsolation $mcpDataIsolation, array $mcpIds = [], array $builtinServers = [], array $serverOptions = []): array
    {
        $dataIsolation = DataIsolation::create($mcpDataIsolation->getCurrentOrganizationCode(), $mcpDataIsolation->getCurrentUserId());
        $servers = [];

        $query = new MCPServerQuery();
        $query->setEnabled(true);
        $query->setCodes($mcpIds);
        $data = $this->MCPServerAppService->availableQueries($mcpDataIsolation, $query, Page::createNoPage());
        $mcpServers = $data['list'] ?? [];
        /** @var array<MCPServerEntity> $mcpServers */
        $mcpServers = array_filter(array_merge($mcpServers, $builtinServers), function ($item) {
            return $item instanceof MCPServerEntity;
        });

        $localHttpUrl = config('super-magic.sandbox.callback_host', '');

        foreach ($mcpServers as $mcpServer) {
            if (! $mcpServer->isBuiltIn() && ! in_array($mcpServer->getCode(), $mcpIds, true)) {
                continue;
            }

            try {
                $mcpServerConfig = MCPServerConfigUtil::create(
                    $mcpDataIsolation,
                    $mcpServer,
                    $localHttpUrl,
                );
                if (! $mcpServerConfig) {
                    ExceptionBuilder::throw(MCPErrorCode::NotFound, 'ServerConfigCreateFailed');
                }
                if (str_starts_with($mcpServerConfig->getUrl(), $localHttpUrl)) {
                    $token = $this->tempAuth->create([
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'server_code' => $mcpServer->getCode(),
                    ], 3600);
                    $mcpServerConfig->setToken($token);
                }
                $config = $mcpServerConfig->toArray();
                $config['server_options'] = $serverOptions[$mcpServer->getCode()] ?? [];
            } catch (Throwable $throwable) {
                $this->logger->notice('CreateChatMessageRequestMcpConfigNotice', [
                    'mcp_server' => [
                        'id' => $mcpServer->getId(),
                        'code' => $mcpServer->getCode(),
                        'name' => $mcpServer->getName(),
                        'description' => $mcpServer->getDescription(),
                    ],
                    'message' => $throwable->getMessage(),
                    'code' => $throwable->getCode(),
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                ]);
                $config = [
                    'name' => $mcpServer->getName(),
                    'error_message' => $throwable->getMessage(),
                ];
            }

            $servers[$mcpServer->getName()] = $config;
        }
        return $servers;
    }

    /**
     * 获取项目的 MCP 服务器 ID 列表.
     */
    private function getProjectMcpServerIds(MCPDataIsolation $mcpDataIsolation, string $projectId): array
    {
        $dataIsolation = DataIsolation::create($mcpDataIsolation->getCurrentOrganizationCode(), $mcpDataIsolation->getCurrentUserId());
        $mcpServerIds = [];

        $mcpSettings = $this->magicUserSettingDomainService->get($dataIsolation, UserSettingKey::genSuperMagicProjectMCPServers($projectId));
        if ($mcpSettings) {
            $mcpServerIds = array_filter(array_column($mcpSettings->getValue()['servers'], 'id'));
        }
        return $mcpServerIds;
    }

    private function createBuiltinSuperMagicServerOptions(MCPDataIsolation $dataIsolation, array $agentIds = [], array $toolIds = []): array
    {
        $labelNames = [];

        // 查询 agent 信息
        $agentDataIsolation = AgentDataIsolation::createByBaseDataIsolation($dataIsolation);
        $agentQuery = new MagicAgentQuery();
        $agentQuery->setIds($agentIds);
        $agents = $this->agentDomainService->queries($agentDataIsolation->disabled(), $agentQuery, Page::createNoPage())['list'] ?? [];
        $agentInfos = [];

        // 查询 tool 信息
        $flowDataIsolation = FlowDataIsolation::createByBaseDataIsolation($dataIsolation);
        $flowQuery = new MagicFLowQuery();
        $flowQuery->setCodes($toolIds);
        $tools = ToolsExecutor::getToolFlows($flowDataIsolation->disabled(), $toolIds);

        foreach ($agents as $agent) {
            $agentInfos[$agent->getId()] = [
                'id' => $agent->getId(),
                'name' => $agent->getAgentName(),
                'description' => $agent->getAgentDescription(),
            ];
            $labelNames[] = $agent->getAgentName();
        }
        foreach ($tools as $tool) {
            $labelNames[] = $tool->getName();
        }

        return [
            'label_name' => implode(', ', $labelNames),
            'label_names' => $labelNames,
            'tools' => [
                'call_magic_agent' => [
                    'label_name' => '',
                    'agents' => $agentInfos,
                ],
            ],
        ];
    }
}
