<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class MCPServerSelectListDTO extends AbstractDTO
{
    use StringIdDTOTrait;

    /**
     * MCP服务名称.
     */
    public string $name = '';

    /**
     * MCP服务描述.
     */
    public string $description = '';

    /**
     * MCP服务图标.
     */
    public string $icon = '';

    /**
     * 服务类型.
     */
    public string $type = '';

    /**
     * 需要的动态字段.
     *
     * @var array<array<string, string>>
     */
    public array $requireFields = [];

    public bool $office = false;

    public int $userOperation = 0;

    public bool $checkRequireFields = false;

    public bool $checkAuth = false;

    public function setCheckRequireFields(bool $checkRequireFields): void
    {
        $this->checkRequireFields = $checkRequireFields;
    }

    public function setCheckAuth(bool $checkAuth): void
    {
        $this->checkAuth = $checkAuth;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(int $userOperation): void
    {
        $this->userOperation = $userOperation;
    }

    public function isOffice(): bool
    {
        return $this->office;
    }

    public function setOffice(bool $office): void
    {
        $this->office = $office;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(?string $type): void
    {
        $this->type = $type ?? '';
    }

    public function getRequireFields(): array
    {
        return $this->requireFields;
    }

    public function setRequireFields(array $requireFields): void
    {
        $data = [];
        foreach ($requireFields as $field) {
            if (is_string($field)) {
                $data[] = [
                    'field_name' => $field,
                    'field_value' => '',
                ];
            }
            if (is_array($field) && isset($field['field_name'])) {
                $data[] = [
                    'field_name' => $field['field_name'],
                    'field_value' => $field['field_value'] ?? '',
                ];
            }
        }

        $this->requireFields = $data;
    }
}
