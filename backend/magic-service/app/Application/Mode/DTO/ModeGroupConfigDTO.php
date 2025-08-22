<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeGroupConfigDTO extends AbstractDTO
{
    protected string $groupId;

    /**
     * @var array 该分组下的模型配置数组
     */
    protected array $models = [];

    public function getGroupId(): string
    {
        return $this->groupId;
    }

    public function setGroupId(string $groupId): void
    {
        $this->groupId = $groupId;
    }

    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $this->models = $models;
    }

    /**
     * 添加模型配置.
     */
    public function addModel(string $modelId, int $sort = 0): void
    {
        $this->models[] = [
            'model_id' => $modelId,
            'sort' => $sort,
        ];
    }

    /**
     * 获取模型ID数组.
     */
    public function getModelIds(): array
    {
        return array_map(fn ($model) => $model['model_id'], $this->models);
    }
}
