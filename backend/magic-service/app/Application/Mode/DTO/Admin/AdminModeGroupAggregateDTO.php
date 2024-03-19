<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\Admin;

use App\Infrastructure\Core\AbstractDTO;

class AdminModeGroupAggregateDTO extends AbstractDTO
{
    protected ?AdminModeGroupDTO $group = null;

    /**
     * @var AdminModeGroupModelDTO[] 该分组对应的模型详细信息数组
     */
    protected array $models = [];

    /**
     * @var AdminModeGroupModelDTO[] 该分组对应的图像模型详细信息数组（VLM）
     */
    protected array $imageModels = [];

    public function __construct(null|AdminModeGroupDTO|array $group = null, array $models = [], array $imageModels = [])
    {
        if (! is_null($group)) {
            $this->group = $group instanceof AdminModeGroupDTO ? $group : new AdminModeGroupDTO($group);
        }
        $this->setModels($models);
        $this->setImageModels($imageModels);
    }

    public function getGroup(): ?AdminModeGroupDTO
    {
        return $this->group;
    }

    public function setGroup(AdminModeGroupDTO|array $group): void
    {
        $this->group = $group instanceof AdminModeGroupDTO ? $group : new AdminModeGroupDTO($group);
    }

    /**
     * @return AdminModeGroupModelDTO[]|array[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $modelData = [];
        foreach ($models as $model) {
            $modelData[] = $model instanceof AdminModeGroupModelDTO ? $model : new AdminModeGroupModelDTO($model);
        }

        $this->models = $modelData;
    }

    /**
     * @return AdminModeGroupModelDTO[]|array[]
     */
    public function getImageModels(): array
    {
        return $this->imageModels;
    }

    public function setImageModels(array $imageModels): void
    {
        $modelData = [];
        foreach ($imageModels as $model) {
            $modelData[] = $model instanceof AdminModeGroupModelDTO ? $model : new AdminModeGroupModelDTO($model);
        }

        $this->imageModels = $modelData;
    }
}
