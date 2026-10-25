<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject\Query;

use App\Domain\Provider\Entity\ValueObject\Status;

class ModelIdentifierMappingQuery extends Query
{
    private string $keyword = '';

    private ?Status $status = null;

    /**
     * 获取映射组名称或模型标识的搜索关键词。
     */
    public function getKeyword(): string
    {
        return $this->keyword;
    }

    /**
     * 设置映射组名称或模型标识的搜索关键词。
     */
    public function setKeyword(string $keyword): self
    {
        $this->keyword = trim($keyword);
        return $this;
    }

    /**
     * 获取映射组状态筛选条件。
     */
    public function getStatus(): ?Status
    {
        return $this->status;
    }

    /**
     * 设置映射组状态筛选条件。
     */
    public function setStatus(?Status $status): self
    {
        $this->status = $status;
        return $this;
    }
}
