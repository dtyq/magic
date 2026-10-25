<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/** 个人素材编辑请求；只允许修改素材元数据，不允许修改文件。 */
class UpdatePersonalAssetRequestDTO extends AbstractRequestDTO
{
    public ?string $name = null;

    public ?string $description = null;

    /** @var null|array{user_ids?: array<string>, department_ids?: array<string>} */
    public ?array $visibility = null;

    /** @var null|array<int, int|string> */
    public ?array $tagIds = null;

    public function getName(): ?string
    {
        return $this->name;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    /** @return null|array{user_ids?: array<string>, department_ids?: array<string>} */
    public function getVisibility(): ?array
    {
        return $this->visibility;
    }

    public function getVisibilityType(): string
    {
        return $this->hasVisibilityPrincipals() ? 'TEAM' : 'PERSONAL';
    }

    /** @return array{user_ids: array<string>, department_ids: array<string>} */
    public function getVisibilityConfig(): array
    {
        return [
            'user_ids' => array_values(array_map('strval', (array) ($this->visibility['user_ids'] ?? []))),
            'department_ids' => array_values(array_map('strval', (array) ($this->visibility['department_ids'] ?? []))),
        ];
    }

    /** @return null|array<int, int|string> */
    public function getTagIds(): ?array
    {
        return $this->tagIds;
    }

    public function setName(mixed $value): void
    {
        $this->name = $value === null ? null : (string) $value;
    }

    public function setDescription(mixed $value): void
    {
        $this->description = $value === null ? null : (string) $value;
    }

    public function setVisibility(mixed $value): void
    {
        $this->visibility = (array) ($value ?? []);
    }

    public function setTagIds(mixed $value): void
    {
        $this->tagIds = is_array($value) ? array_values($value) : [];
    }

    public function setTags(mixed $value): void
    {
        $this->setTagIds($value);
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:5000',
            'visibility' => 'nullable|array',
            'visibility.user_ids' => 'nullable|array',
            'visibility.department_ids' => 'nullable|array',
            'tag_ids' => 'nullable|array',
            'tags' => 'nullable|array',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }

    private function hasVisibilityPrincipals(): bool
    {
        return ($this->visibility['user_ids'] ?? []) !== [] || ($this->visibility['department_ids'] ?? []) !== [];
    }
}
