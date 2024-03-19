<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

class KnowledgeFragmentQuery
{
    public string $knowledgeCode = '';

    public array $metadataFilter = [];

    public int $limit = 5;

    /**
     * 获取知识库编码
     */
    public function getKnowledgeCode(): string
    {
        return $this->knowledgeCode;
    }

    /**
     * 设置知识库编码
     */
    public function setKnowledgeCode(string $knowledgeCode): void
    {
        $this->knowledgeCode = $knowledgeCode;
    }

    /**
     * 获取元数据过滤条件.
     */
    public function getMetadataFilter(): array
    {
        return $this->metadataFilter;
    }

    /**
     * 设置元数据过滤条件.
     */
    public function setMetadataFilter(array $metadataFilter): void
    {
        $this->metadataFilter = $metadataFilter;
    }

    /**
     * 获取限制数量.
     */
    public function getLimit(): int
    {
        return $this->limit;
    }

    /**
     * 设置限制数量.
     */
    public function setLimit(int $limit): void
    {
        $this->limit = $limit;
    }
}
