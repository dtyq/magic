<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseOperationPermissionAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\SourceType;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use Hyperf\Di\Annotation\Inject;

class BaseKnowledgeBaseStrategy extends AbstractKernelAppService implements KnowledgeBaseStrategyInterface
{
    #[Inject]
    protected KnowledgeBaseOperationPermissionAppService $knowledgeBaseOperationPermissionAppService;

    public function __construct(
        protected OperationPermissionAppService $operationPermissionAppService,
        protected KnowledgeBaseDocumentDomainService $knowledgeBaseDocumentDomainService,
    ) {
    }

    /**
     * @return array<string, Operation>
     */
    public function getKnowledgeBaseOperations(KnowledgeBaseDataIsolation $dataIsolation): array
    {
        $permissionDataIsolation = KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->knowledgeBaseOperationPermissionAppService->getKnowledgeOperationByUserIds(
            $permissionDataIsolation,
            [$dataIsolation->getCurrentUserId()]
        )[$dataIsolation->getCurrentUserId()] ?? [];
    }

    public function getQueryKnowledgeTypes(): array
    {
        return [KnowledgeType::UserKnowledgeBase->value];
    }

    public function getKnowledgeOperation(KnowledgeBaseDataIsolation $dataIsolation, int|string $knowledgeCode): Operation
    {
        $permissionDataIsolation = KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($dataIsolation);

        if (empty($knowledgeCode)) {
            return Operation::None;
        }
        return $this->knowledgeBaseOperationPermissionAppService->getKnowledgeOperationByUser(
            $permissionDataIsolation,
            (string) $knowledgeCode,
            $permissionDataIsolation->getCurrentUserId()
        );
    }

    public function getOrCreateDefaultDocument(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeBaseEntity): void
    {
        $this->knowledgeBaseDocumentDomainService->getOrCreateDefaultDocument($dataIsolation, $knowledgeBaseEntity);
    }

    /**
     * 获取或创建默认知识库数据源类型.
     *
     * @param KnowledgeBaseEntity $knowledgeBaseEntity 知识库实体
     *
     * @return null|int 数据源类型
     */
    public function getOrCreateDefaultSourceType(KnowledgeBaseEntity $knowledgeBaseEntity): ?int
    {
        // 如果source_type为null，则设置为从外部文件导入
        if ($knowledgeBaseEntity->getSourceType() === null) {
            return SourceType::EXTERNAL_FILE->value;
        }
        return $knowledgeBaseEntity->getSourceType();
    }
}
