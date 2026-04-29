<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\SourceType;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;

class BaseKnowledgeBaseStrategy extends AbstractKernelAppService implements KnowledgeBaseStrategyInterface
{
    public function __construct(
        protected KnowledgeBaseDocumentDomainService $knowledgeBaseDocumentDomainService,
    ) {
    }

    public function getQueryKnowledgeTypes(): array
    {
        return [KnowledgeType::UserKnowledgeBase->value];
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
        return $knowledgeBaseEntity->getSourceType() ?? SourceType::EXTERNAL_FILE->value;
    }
}
