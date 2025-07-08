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
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MCPServerAppService extends AbstractMCPAppService
{
    public function show(Authenticatable $authorization, string $code): MCPServerEntity
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
        return $entity;
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

        $data = $this->mcpServerDomainService->queries(
            $dataIsolation,
            $query,
            $page
        );
        $filePaths = [];
        $userIds = [];
        foreach ($data['list'] ?? [] as $item) {
            $filePaths[] = $item->getIcon();
            $operation = $resources[$item->getCode()] ?? Operation::None;
            $item->setUserOperation($operation->value);
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $filePaths);
        $data['users'] = $this->getUsers($dataIsolation->getCurrentOrganizationCode(), $userIds);
        return $data;
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>}
     */
    public function availableQueries(Authenticatable|MCPDataIsolation $authorization, MCPServerQuery $query, Page $page): array
    {
        if ($authorization instanceof MCPDataIsolation) {
            $dataIsolation = $authorization;
        } else {
            $dataIsolation = $this->createMCPDataIsolation($authorization);
        }

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

        if (! empty($query->getCodes())) {
            $resourceIds = array_intersect($resourceIds, $query->getCodes());
        }

        $query->setCodes($resourceIds);
        $orgData = $this->mcpServerDomainService->queries($dataIsolation->disabled(), $query, $page);

        foreach ($orgData['list'] ?? [] as $item) {
            $item->setIcon($this->getFileLink($item->getOrganizationCode(), $item->getIcon())?->getUrl() ?? '');
            if (in_array($item->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)) {
                $item->setOffice(true);
            }
        }

        return $orgData;
    }

    public function save(Authenticatable $authorization, MCPServerEntity $entity): MCPServerEntity
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
