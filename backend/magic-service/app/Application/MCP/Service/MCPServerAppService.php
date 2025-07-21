<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\MCP\Utils\MCPExecutor\MCPExecutorFactory;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Hyperf\DbConnection\Annotation\Transactional;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MCPServerAppService extends AbstractMCPAppService
{
    /**
     * @return array{mcp_server: MCPServerEntity, tools: ?array<MCPServerToolEntity>}
     */
    public function show(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('r', $code);

        $entity = $this->mcpServerDomainService->getByCode(
            $this->createMCPDataIsolation($authorization),
            $code
        );
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
        $entity->setUserOperation($operation->value);

        $tools = null;
        if ($entity->getType() === ServiceType::SSE) {
            // For SSE type, we need to load tools
            $tools = $this->mcpServerToolDomainService->getByMcpServerCode($dataIsolation, $code);
        }
        return [
            'mcp_server' => $entity,
            'tools' => $tools,
        ];
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>, icons: array<string, FileLink>, users: array<string, MagicUserEntity>}
     */
    public function queries(Authenticatable $authorization, MCPServerQuery $query, Page $page, bool $office = false): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);
        if ($office) {
            $dataIsolation->setOnlyOfficialOrganization(true);
        } else {
            if (! $dataIsolation->isOfficialOrganization()) {
                $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
                    $dataIsolation,
                    ResourceType::MCPServer,
                    [$authorization->getId()]
                )[$authorization->getId()] ?? [];
                $resourceIds = array_keys($resources);

                if (! empty($query->getCodes())) {
                    $resourceIds = array_intersect($resourceIds, $query->getCodes());
                }
                $query->setCodes($resourceIds);
            }
        }

        $data = $this->mcpServerDomainService->queries(
            $dataIsolation,
            $query,
            $page
        );
        $filePaths = [];
        $userIds = [];
        foreach ($data['list'] ?? [] as $item) {
            $filePaths[] = $item->getIcon();
            if ($dataIsolation->isOfficialOrganization()) {
                $operation = Operation::Admin;
            } else {
                $operation = $resources[$item->getCode()] ?? Operation::None;
            }
            $item->setUserOperation($operation->value);
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $filePaths);
        $data['users'] = $this->getUsers($dataIsolation->getCurrentOrganizationCode(), $userIds);
        return $data;
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>, icons: array<string, FileLink>}
     */
    public function availableQueries(Authenticatable|MCPDataIsolation $authorization, MCPServerQuery $query, Page $page, ?bool $office = null): array
    {
        if ($authorization instanceof MCPDataIsolation) {
            $dataIsolation = $authorization;
        } else {
            $dataIsolation = $this->createMCPDataIsolation($authorization);
        }

        $resources = [];
        if (is_null($office)) {
            // 官方数据和组织内的，一并查询
            $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
                $dataIsolation,
                ResourceType::MCPServer,
                [$dataIsolation->getCurrentUserId()]
            )[$dataIsolation->getCurrentUserId()] ?? [];
            $resourceIds = array_keys($resources);
            // 获取官方的 code
            $officialCodes = $this->mcpServerDomainService->getOfficialMCPServerCodes($dataIsolation);
            $resourceIds = array_merge($resourceIds, $officialCodes);
        } else {
            if ($office) {
                // 只查官方数据
                $resourceIds = $this->mcpServerDomainService->getOfficialMCPServerCodes($dataIsolation);
            } else {
                // 只查组织内数据
                $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
                    $dataIsolation,
                    ResourceType::MCPServer,
                    [$dataIsolation->getCurrentUserId()]
                )[$dataIsolation->getCurrentUserId()] ?? [];
                $resourceIds = array_keys($resources);
            }
        }
        if (! empty($query->getCodes())) {
            $resourceIds = array_intersect($resourceIds, $query->getCodes());
        }
        $query->setCodes($resourceIds);

        $orgData = $this->mcpServerDomainService->queries($dataIsolation->disabled(), $query, $page);

        $icons = [];
        foreach ($orgData['list'] ?? [] as $item) {
            if (in_array($item->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)) {
                $item->setOffice(true);
            }
            $icons[$item->getIcon()] = $this->getFileLink($item->getOrganizationCode(), $item->getIcon());

            $operation = Operation::None;
            if (in_array($item->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)) {
                // 如果是官方组织数据，并且当前组织所在的组织是官方组织，则设置操作权限为管理员
                if ($dataIsolation->isOfficialOrganization()) {
                    $operation = Operation::Admin;
                }
            } else {
                $operation = $resources[$item->getCode()] ?? Operation::None;
            }
            $item->setUserOperation($operation->value);
        }
        $orgData['icons'] = $icons;

        // 获取用户填写的配置
        $validationResults = MCPServerConfigUtil::batchValidateUserConfigurations($dataIsolation, $orgData['list'] ?? []);
        $orgData['validation_results'] = $validationResults;

        return $orgData;
    }

    /**
     * @param null|array<MCPServerToolEntity> $toolEntities
     */
    #[Transactional]
    public function save(Authenticatable $authorization, MCPServerEntity $entity, ?array $toolEntities = null): MCPServerEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        if (! $entity->shouldCreate()) {
            $operation = $this->getMCPServerOperation($dataIsolation, $entity->getCode());
            $operation->validate('w', $entity->getCode());
        } else {
            $operation = Operation::Owner;
        }

        $entity = $this->mcpServerDomainService->save(
            $this->createMCPDataIsolation($authorization),
            $entity
        );
        $entity->setUserOperation($operation->value);

        // Handle batch tool management for SSE type
        // null = don't operate on tools, [] = clear all tools, [tools...] = replace with new tools
        if ($toolEntities !== null && $entity->getType() === ServiceType::SSE) {
            $this->batchManageTools($dataIsolation, $entity->getCode(), $toolEntities);
        }

        return $entity;
    }

    public function destroy(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('d', $code);

        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        return $this->mcpServerDomainService->delete($dataIsolation, $code);
    }

    public function updateStatus(Authenticatable $authorization, string $code, bool $enabled): MCPServerEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('w', $code);

        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        // Only update the enabled status
        $entity->setEnabled($enabled);
        $entity = $this->mcpServerDomainService->save($dataIsolation, $entity);
        $entity->setUserOperation($operation->value);

        return $entity;
    }

    /**
     * Get tools for a specific MCP server.
     *
     * @return null|array<MCPServerToolEntity>
     */
    public function getToolsForServer(Authenticatable $authorization, string $code): ?array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('r', $code);

        // Get server entity to check type
        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            return null;
        }

        // Only return tools for SSE type servers
        if ($entity->getType() === ServiceType::SSE) {
            return $this->mcpServerToolDomainService->getByMcpServerCodes($dataIsolation, [$code]);
        }

        return null;
    }

    public function checkStatus(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('r', $code);

        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        $tools = [];
        $error = '';
        $success = true;
        try {
            $mcpServerConfig = MCPServerConfigUtil::create($dataIsolation, $entity);
            $executor = MCPExecutorFactory::createExecutor($dataIsolation, $entity);
            $toolsResult = $executor->getListToolsResult($mcpServerConfig);

            $tools = array_map(function (Tool $tool) use ($code) {
                return [
                    'mcp_server_code' => $code,
                    'name' => $tool->getName(),
                    'description' => $tool->getDescription(),
                    'input_schema' => $tool->getInputSchema(),
                    'version' => '',
                    'enabled' => true,
                    'source_version' => [
                        'latest_version_code' => '',
                        'latest_version_name' => '',
                    ],
                ];
            }, $toolsResult?->getTools() ?? []);

            // 每次检测成功，都存下一次工具列表
            $this->mcpUserSettingDomainService->updateAdditionalConfig(
                $dataIsolation,
                $code,
                'history_check_tools',
                [
                    'tools' => $tools,
                    'last_check_at' => date('Y-m-d H:i:s'),
                ]
            );
        } catch (Throwable $throwable) {
            $success = false;
            $error = $throwable->getMessage();
        }

        return [
            'success' => $success,
            'tools' => $tools,
            'error' => $error,
        ];
    }
}
