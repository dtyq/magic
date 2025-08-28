<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeGroupModelDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $groupId = '';

    protected string $modelId = '';

    protected string $modelName = '';

    protected string $modelIcon = '';

    protected int $sort = 0;
    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        $this->id = (string) $id;
    }

    public function getGroupId(): string
    {
        return $this->groupId;
    }

    public function setGroupId(int|string $groupId): void
    {
        $this->groupId = (string) $groupId;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(string $modelName): void
    {
        $this->modelName = $modelName;
    }

    public function getModelIcon(): string
    {
        return $this->modelIcon;
    }

    public function setModelIcon(string $modelIcon): void
    {
        $this->modelIcon = $modelIcon;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }
}
