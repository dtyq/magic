<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class FollowUpSuggestionsQueryRequestDTO extends AbstractRequestDTO
{
    public int $type = 0;

    public string $relationId = '';

    public function getType(): int
    {
        return $this->type;
    }

    public function getRelationId(): string
    {
        return $this->relationId;
    }

    public static function fromArray(array $data): self
    {
        static::checkParams($data);
        $dto = new self();
        $dto->initProperty($data);

        return $dto;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'type' => 'required|integer|in:1',
            'relation_id' => 'required|string|max:64',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'type.required' => '建议类型不能为空',
            'type.integer' => '建议类型必须为整数',
            'type.in' => '建议类型无效',
            'relation_id.required' => '关联 ID 不能为空',
            'relation_id.string' => '关联 ID 必须为字符串',
            'relation_id.max' => '关联 ID 不能超过 64 个字符',
        ];
    }
}
