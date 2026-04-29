<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

interface KnowledgeBaseStrategyInterface
{
    public function getQueryKnowledgeTypes(): array;

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
