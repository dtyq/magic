<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class SaveAssetTagRequestDTO extends AbstractRequestDTO
{
    public string $name = '';

    public string $nodeType = 'tag';

    public int $parentId = 0;

    /** 只在创建官方标签时生效；业务类型创建后不可更改。 */
    public string $businessType = 'GENERAL';

    public function setName(mixed $value): void
    {
        $this->name = trim((string) $value);
    }

    public function setNodeType(mixed $value): void
    {
        $nodeType = (string) $value;
        $this->nodeType = in_array($nodeType, ['group', 'tag'], true) ? $nodeType : 'tag';
    }

    public function setBusinessType(mixed $value): void
    {
        $businessType = trim((string) $value);
        $this->businessType = $businessType === '' ? 'GENERAL' : $businessType;
    }

    public function setParentId(mixed $value): void
    {
        $this->parentId = max(0, (int) ($value ?? 0));
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getNodeType(): string
    {
        return $this->nodeType;
    }

    public function getBusinessType(): string
    {
        return $this->businessType;
    }

    public function getParentId(): int
    {
        return $this->parentId;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'node_type' => 'nullable|string|in:group,tag',
            'parent_id' => 'nullable|integer|min:0',
            'business_type' => ['nullable', 'string', 'max:64', 'regex:/^[A-Z][A-Z0-9_]*$/'],
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
