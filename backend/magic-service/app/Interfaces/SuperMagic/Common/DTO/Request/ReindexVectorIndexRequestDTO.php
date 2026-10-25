<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Common\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 市场向量索引重建请求 DTO（Agent 市场 / Skill 市场共用）.
 */
class ReindexVectorIndexRequestDTO extends AbstractRequestDTO
{
    /**
     * 是否强制重新生成向量。
     *
     * 开启后，当向量集合维度与模型实际输出维度不一致时会删除集合并按实际维度重建，随后全量重灌数据；
     * 关闭时遇到维度不一致直接抛错，不会改动集合。
     */
    public bool $forceReEmbedding = false;

    public function getForceReEmbedding(): bool
    {
        return $this->forceReEmbedding;
    }

    public function setForceReEmbedding(bool|int|string $forceReEmbedding): void
    {
        $this->forceReEmbedding = filter_var($forceReEmbedding, FILTER_VALIDATE_BOOL);
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'force_re_embedding' => 'nullable|boolean',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'force_re_embedding.boolean' => 'force_re_embedding must be a boolean',
        ];
    }
}
