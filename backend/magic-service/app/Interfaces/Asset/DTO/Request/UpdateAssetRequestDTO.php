<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class UpdateAssetRequestDTO extends AbstractRequestDTO
{
    public ?array $nameI18n = null;

    public ?array $descriptionI18n = null;

    public ?int $parentId = null;

    public ?int $status = null;

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setNameI18n(mixed $value): void
    {
        $this->nameI18n = $value === null ? null : (array) $value;
    }

    public function setDescriptionI18n(mixed $value): void
    {
        $this->descriptionI18n = $value === null ? null : (array) $value;
    }

    public function setParentId(mixed $value): void
    {
        $this->parentId = $value === null || $value === '' ? null : (int) $value;
    }

    public function setStatus(mixed $value): void
    {
        $this->status = $value === null || $value === '' ? null : (int) $value;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name_i18n' => 'nullable|array',
            'description_i18n' => 'nullable|array',
            'parent_id' => 'nullable|integer|min:1',
            'status' => 'nullable|integer|in:0,1',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.array' => __('asset.validation.name_i18n_array'),
            'description_i18n.array' => __('asset.validation.description_i18n_array'),
            'parent_id.integer' => __('asset.validation.parent_id_integer'),
            'parent_id.min' => __('asset.validation.parent_id_min'),
            'status.integer' => __('asset.validation.status_integer'),
            'status.in' => __('asset.validation.status_in'),
        ];
    }
}
