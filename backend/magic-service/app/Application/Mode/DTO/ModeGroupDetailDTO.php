<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeGroupDetailDTO extends AbstractDTO
{
    protected string $id;

    protected string $modeId;

    protected ?string $icon = null;

    protected ?string $color = null;

    protected ?string $description = null;

    protected int $sort;

    /**
     * @var ModeGroupModelDTO[] 该分组对应的模型详细信息数组
     */
    protected array $models = [];

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

    public function setModeId(int|string $modeId): void
    {
        $this->modeId = (string) $modeId;
    }

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): void
    {
        $this->color = $color;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    /**
     * @return ModeGroupModelDTO[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $modelData = [];
        foreach ($models as $model) {
            $modelData[] = $model instanceof ModeGroupModelDTO ? $model : new ModeGroupModelDTO($model);
        }

        $this->models = $modelData;
    }

    /**
     * 对模型按sort字段排序（降序，越大越前）.
     */
    public function sortModels(): void
    {
        usort($this->models, function ($a, $b) {
            return $b->getSort() <=> $a->getSort();
        });
    }
}
