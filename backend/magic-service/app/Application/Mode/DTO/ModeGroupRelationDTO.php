<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeGroupRelationDTO extends AbstractDTO
{
    protected string $id;

    protected string $modeId;

    protected string $groupId;

    protected string $modelId;

    protected int $sort;

    protected ?string $createdAt = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        $this->id = (string) $id;
    }

    public function getModeId(): string
    {
        return $this->modeId;
    }

    public function setModeId(string $modeId): void
    {
        $this->modeId = $modeId;
    }

    public function getGroupId(): string
    {
        return $this->groupId;
    }

    public function setGroupId(string $groupId): void
    {
        $this->groupId = $groupId;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }
}
