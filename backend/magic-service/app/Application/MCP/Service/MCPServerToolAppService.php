<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Qbhy\HyperfAuth\Authenticatable;

class MCPServerToolAppService extends AbstractMCPAppService
{
    public function show(Authenticatable $authorization, string $mcpServerCode, int $id): MCPServerToolEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('r', $mcpServerCode);

        $entity = $this->mcpServerToolDomainService->getByIdAndMcpServerCode($dataIsolation, $id, $mcpServerCode);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }

        return $entity;
    }

    /**
     * @return array{total: int, list: array<MCPServerToolEntity>, users: array<string, mixed>, sources_info: array<int, array<string, array>>}
     */
    public function queries(Authenticatable $authorization, string $mcpServerCode): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('r', $mcpServerCode);

        $list = $this->mcpServerToolDomainService->getByMcpServerCodes($dataIsolation, [$mcpServerCode]);

        $sourceCodes = [];
        $userIds = [];
        foreach ($list as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
            $sourceCodes[$item->getSource()->value][$item->getRelCode()] = $item->getRelCode();
        }

        return [
            'total' => count($list),
            'list' => $list,
            'users' => $this->getUsers($dataIsolation->getCurrentOrganizationCode(), $userIds),
            'sources_info' => $this->getSourcesInfo($dataIsolation, $sourceCodes),
        ];
    }

    public function save(Authenticatable $authorization, string $mcpServerCode, MCPServerToolEntity $entity): MCPServerToolEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('w', $mcpServerCode);

        $entity->setMcpServerCode($mcpServerCode);
        $this->appendInfoWithSource($dataIsolation, $entity);

        return $this->mcpServerToolDomainService->save($dataIsolation, $entity);
    }

    public function destroy(Authenticatable $authorization, string $mcpServerCode, int $id): bool
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('d', $mcpServerCode);

        $entity = $this->mcpServerToolDomainService->getByIdAndMcpServerCode($dataIsolation, $id, $mcpServerCode);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }

        return $this->mcpServerToolDomainService->delete($dataIsolation, $id);
    }

    /**
     * @return array<int, array<string, array>>
     */
    private function getSourcesInfo(MCPDataIsolation $dataIsolation, array $sourceCodes): array
    {
        $sourcesInfo = [];

        $flowToolSources = $sourceCodes[ToolSource::FlowTool->value] ?? [];

        $flowDataIsolation = $this->createFlowDataIsolation($dataIsolation);
        $flowTools = $this->magicFlowDomainService->getByCodes($flowDataIsolation, $flowToolSources);
        $flowVersionCodes = [];
        foreach ($flowTools as $flowTool) {
            $flowVersionCodes[] = $flowTool->getVersionCode();
        }
        $flowVersionTools = $this->magicFlowVersionDomainService->getByCodes($flowDataIsolation, $flowVersionCodes);

        foreach ($flowVersionTools as $flowVersionTool) {
            $sourcesInfo[ToolSource::FlowTool->value][$flowVersionTool->getFlowCode()] = [
                'latest_version_code' => $flowVersionTool->getCode(),
                'latest_version_name' => $flowVersionTool->getName(),
            ];
        }

        return $sourcesInfo;
    }
}
