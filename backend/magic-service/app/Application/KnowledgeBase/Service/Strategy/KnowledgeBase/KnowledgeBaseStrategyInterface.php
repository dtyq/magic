<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;

interface KnowledgeBaseStrategyInterface
{
    public function getKnowledgeBaseOperations(KnowledgeBaseDataIsolation $dataIsolation): array;

    public function getQueryKnowledgeTypes(): array;

    public function getKnowledgeOperation(KnowledgeBaseDataIsolation $dataIsolation, int|string $knowledgeCode): Operation;

    public function getOrCreateDefaultDocument(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeBaseEntity): void;

    /**
     * 获取或创建默认知识库数据源类型.
     *
     * @param KnowledgeBaseEntity $knowledgeBaseEntity 知识库实体
     *
     * @return null|int 数据源类型
     */
    public function getOrCreateDefaultSourceType(KnowledgeBaseEntity $knowledgeBaseEntity): ?int;
}
