<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Infrastructure\Core\AbstractDTO;

class ModeGroupModelDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $groupId = '';

    protected string $modelId = '';

    protected string $modelName = '';

    protected string $providerModelId = '';

    protected string $modelDescription = '';

    protected string $modelIcon = '';

    protected int $sort = 0;

    protected ModelStatus $modelStatus = ModelStatus::Normal;

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

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(int|string $providerModelId): void
    {
        $this->providerModelId = (string) $providerModelId;
    }

    public function getModelDescription(): string
    {
        return $this->modelDescription;
    }

    public function setModelDescription(string $modelDescription): void
    {
        $this->modelDescription = $modelDescription;
    }

    public function getModelStatus(): ModelStatus
    {
        return $this->modelStatus;
    }

    public function setModelStatus(ModelStatus|string $modelStatus): void
    {
        if ($modelStatus instanceof ModelStatus) {
            $this->modelStatus = $modelStatus;
        } else {
            $this->modelStatus = ModelStatus::from($modelStatus);
        }
    }
}
