<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowVersionDomainService;
use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ToolOptions;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\Domain\MCP\Service\MCPServerDomainService;
use App\Domain\MCP\Service\MCPServerToolDomainService;
use App\Domain\MCP\Service\MCPUserSettingDomainService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

abstract class AbstractMCPAppService extends AbstractKernelAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly MCPServerDomainService $mcpServerDomainService,
        protected readonly MCPServerToolDomainService $mcpServerToolDomainService,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
        protected readonly MagicFlowVersionDomainService $magicFlowVersionDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
        protected readonly MCPUserSettingDomainService $mcpUserSettingDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Batch manage tools for an MCP server.
     * Delete all existing tools and create new ones with proper source info.
     *
     * @param array<MCPServerToolEntity> $toolEntities
     */
    protected function batchManageTools(MCPDataIsolation $dataIsolation, string $mcpServerCode, array $toolEntities): void
    {
        // First, delete all existing tools for this MCP server
        $this->mcpServerToolDomainService->deleteByMcpServerCode($dataIsolation, $mcpServerCode);

        if (empty($toolEntities)) {
            return;
        }

        // Set MCP server code for all entities
        foreach ($toolEntities as $toolEntity) {
            $toolEntity->setMcpServerCode($mcpServerCode);
        }

        // Batch append source info for all entities
        $this->batchAppendInfoWithSource($dataIsolation, $toolEntities);

        // Batch insert all entities at once
        $this->mcpServerToolDomainService->batchInsert($dataIsolation, $toolEntities);
    }

    /**
     * Batch append additional information based on tool source for multiple entities.
     *
     * @param array<MCPServerToolEntity> $entities
     */
    protected function batchAppendInfoWithSource(MCPDataIsolation $dataIsolation, array $entities): void
    {
        // Group entities by source type
        $entitiesBySource = [];
        foreach ($entities as $entity) {
            $sourceValue = $entity->getSource()->value;
            $entitiesBySource[$sourceValue][] = $entity;
        }

        // Process each source type in batch
        foreach ($entitiesBySource as $sourceValue => $sourceEntities) {
            $source = ToolSource::fromValue($sourceValue);

            switch ($source) {
                case ToolSource::FlowTool:
                    $this->batchProcessFlowTools($dataIsolation, $sourceEntities);
                    break;
                default:
                    // For unknown sources, validate each individually
                    foreach ($sourceEntities as $entity) {
                        ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'source']);
                    }
            }
        }
    }

    /**
     * Append additional information based on tool source (single entity version).
     */
    protected function appendInfoWithSource(MCPDataIsolation $dataIsolation, MCPServerToolEntity $entity): void
    {
        $this->batchAppendInfoWithSource($dataIsolation, [$entity]);
    }

    /**
     * Batch process FlowTool entities.
     *
     * @param array<MCPServerToolEntity> $entities
     */
    private function batchProcessFlowTools(MCPDataIsolation $dataIsolation, array $entities): void
    {
        $flowDataIsolation = $this->createFlowDataIsolation($dataIsolation);

        // Collect all rel_codes and validate
        $relCodes = [];
        foreach ($entities as $entity) {
            if (empty($entity->getRelCode())) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'rel_code']);
            }
            $relCodes[] = $entity->getRelCode();
        }

        // Batch get all flow tools
        $flowTools = ToolsExecutor::getToolFlows($flowDataIsolation, $relCodes);
        $flowToolsMap = [];
        foreach ($flowTools as $tool) {
            if ($tool && $tool->isEnabled()) {
                $flowToolsMap[$tool->getCode()] = $tool;
            }
        }

        // Collect version codes for batch processing
        $versionCodes = [];
        $entityVersionMap = [];

        foreach ($entities as $entity) {
            $relCode = $entity->getRelCode();
            $tool = $flowToolsMap[$relCode] ?? null;

            if (! $tool) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.not_found', ['label' => $relCode]);
            }

            // Validate permissions
            $this->getToolSetOperation($flowDataIsolation, $tool->getToolSetId())->validate('r', $tool->getVersionCode());

            // Set version code if empty
            if (empty($entity->getRelVersionCode())) {
                $entity->setRelVersionCode($tool->getVersionCode());
            }

            if ($entity->getRelVersionCode()) {
                $versionCodes[] = $entity->getRelVersionCode();
                $entityVersionMap[$entity->getRelVersionCode()][] = $entity;
            }
        }

        // Batch get version information
        $versionTools = [];
        if (! empty($versionCodes)) {
            $versionTools = $this->magicFlowVersionDomainService->getByCodes($flowDataIsolation, array_unique($versionCodes));
            $versionToolsMap = [];
            foreach ($versionTools as $versionTool) {
                $versionToolsMap[$versionTool->getCode()] = $versionTool;
            }
        }

        // Apply information to each entity
        foreach ($entities as $entity) {
            $relCode = $entity->getRelCode();
            $tool = $flowToolsMap[$relCode];

            // Handle version information
            if ($entity->getRelVersionCode() && isset($versionToolsMap[$entity->getRelVersionCode()])) {
                $toolVersion = $versionToolsMap[$entity->getRelVersionCode()];
                $tool = $toolVersion->getMagicFlow() ?? $tool;
                $entity->setVersion($toolVersion->getName());
            }

            // Set tool options
            $entity->setOptions(new ToolOptions(
                $tool->getName(),
                $tool->getDescription(),
                $tool->getInput()?->getForm()?->getForm()?->toJsonSchema() ?? [],
            ));
        }
    }
}
