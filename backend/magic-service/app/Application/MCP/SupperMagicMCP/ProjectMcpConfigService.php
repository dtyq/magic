<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\MCP\Service\MCPServerAppService;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 项目级 MCP 运行时配置构建服务。
 *
 * 仅负责把 user_settings 中“项目维度” MCP 服务器列表反查并构建为
 * 可直接赋值给 ChatMessageRequest::mcpConfig 的运行时结构。
 *
 * 不再处理 mention（mention 一律由 MentionNormalizationService 接管）；
 * 不再生成 builtin server。
 */
readonly class ProjectMcpConfigService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicUserSettingDomainService $magicUserSettingDomainService,
        protected MCPServerAppService $MCPServerAppService,
        protected TempAuthInterface $tempAuth,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('ProjectMcpConfigService');
    }

    /**
     * 构建项目级 MCP 运行时配置。
     *
     * @return array|array{mcpServers: array<string, array>}
     */
    public function buildForTask(MCPDataIsolation $dataIsolation, TaskContext $taskContext): array
    {
        try {
            $projectId = $taskContext->getTask()->getProjectId();
            if (! $projectId) {
                return [];
            }

            $mcpIds = $this->getProjectMcpServerIds($dataIsolation, (string) $projectId);
            if (empty($mcpIds)) {
                return [];
            }

            $mcpServers = $this->createMcpServers($dataIsolation, $mcpIds);

            return ['mcpServers' => $mcpServers];
        } catch (Throwable $throwable) {
            $this->logger->error('ProjectMcpConfigBuildError', [
                'message' => $throwable->getMessage(),
                'code' => $throwable->getCode(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
            return [];
        }
    }

    /**
     * 获取项目的 MCP 服务器 ID 列表（来自 user_settings）。
     *
     * @return array<string>
     */
    private function getProjectMcpServerIds(MCPDataIsolation $mcpDataIsolation, string $projectId): array
    {
        $dataIsolation = DataIsolation::create(
            $mcpDataIsolation->getCurrentOrganizationCode(),
            $mcpDataIsolation->getCurrentUserId()
        );
        $mcpServerIds = [];

        $mcpSettings = $this->magicUserSettingDomainService->get(
            $dataIsolation,
            UserSettingKey::genSuperMagicProjectMCPServers($projectId)
        );
        if ($mcpSettings) {
            $mcpServerIds = array_filter(array_column($mcpSettings->getValue()['servers'], 'id'));
        }
        return $mcpServerIds;
    }

    /**
     * 反查 mcp servers 并生成运行时配置（含 token）。
     */
    private function createMcpServers(MCPDataIsolation $mcpDataIsolation, array $mcpIds): array
    {
        $dataIsolation = DataIsolation::create(
            $mcpDataIsolation->getCurrentOrganizationCode(),
            $mcpDataIsolation->getCurrentUserId()
        );
        $servers = [];

        $query = new MCPServerQuery();
        $query->setEnabled(true);
        $query->setCodes($mcpIds);
        $data = $this->MCPServerAppService->availableQueries($mcpDataIsolation, $query, Page::createNoPage());
        /** @var array<MCPServerEntity> $mcpServers */
        $mcpServers = array_filter($data['list'] ?? [], static function ($item) {
            return $item instanceof MCPServerEntity;
        });

        $localHttpUrl = config('super-magic.sandbox.callback_host', '');

        foreach ($mcpServers as $mcpServer) {
            if (! in_array($mcpServer->getCode(), $mcpIds, true)) {
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
                $localHttpUrlNoSlash = rtrim($localHttpUrl, '/');
                if (str_starts_with($mcpServerConfig->getUrl(), $localHttpUrlNoSlash . '/api/v1/mcp/sse')) {
                    $token = $this->tempAuth->create([
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'server_code' => $mcpServer->getCode(),
                    ], 3600);
                    $mcpServerConfig->setToken($token);
                }
                $config = $mcpServerConfig->toArray();
                $config['description'] = $mcpServer->getDescription();
                $config['server_options'] = [];
            } catch (Throwable $throwable) {
                $this->logger->notice('ProjectMcpConfigBuildNotice', [
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
                    'description' => $mcpServer->getDescription(),
                    'error_message' => $throwable->getMessage(),
                ];
            }

            $servers[$mcpServer->getName()] = $config;
        }
        return $servers;
    }
}
