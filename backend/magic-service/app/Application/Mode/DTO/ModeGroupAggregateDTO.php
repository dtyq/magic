<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeGroupAggregateDTO extends AbstractDTO
{
    protected ModeGroupDTO $group;

    /**
     * @var ModeGroupModelDTO[] 该分组对应的模型详细信息数组
     */
    protected array $models = [];

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getGroup(): ModeGroupDTO
    {
        return $this->group;
    }

    public function setGroup(array|ModeGroupDTO $group): void
    {
        $this->group = $group instanceof ModeGroupDTO ? $group : new ModeGroupDTO($group);
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
     * 添加模型.
     */
    public function addModel(ModeGroupModelDTO $model): void
    {
        if (! $this->hasModelId($model->getModelId())) {
            $this->models[] = $model;
        }
    }

    /**
     * 添加模型ID（向后兼容，但不推荐使用）.
     */
    public function addModelId(string $modelId): void
    {
        if (! $this->hasModelId($modelId)) {
            $model = new ModeGroupModelDTO();
            $model->setModelId($modelId);
            $this->models[] = $model;
        }
    }

    /**
     * 移除模型.
     */
    public function removeModelId(string $modelId): void
    {
        foreach ($this->models as $key => $model) {
            if ($model->getModelId() === $modelId) {
                unset($this->models[$key]);
                $this->models = array_values($this->models); // 重新索引
                break;
            }
        }
    }

    /**
     * 检查是否包含指定模型ID.
     */
    public function hasModelId(string $modelId): bool
    {
        foreach ($this->models as $model) {
            if ($model->getModelId() === $modelId) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取模型数量.
     */
    public function getModelCount(): int
    {
        return count($this->models);
    }

    /**
     * 获取模型ID数组（向后兼容）.
     * @return string[]
     */
    public function getModelIds(): array
    {
        return array_map(fn ($model) => $model->getModelId(), $this->models);
    }

    /**
     * 设置模型ID数组（向后兼容，但不推荐使用）.
     * @param string[] $modelIds
     */
    public function setModelIds(array $modelIds): void
    {
        // 这个方法保留用于向后兼容，但实际上需要完整的模型信息
        // 建议使用 setModels() 方法
        $this->models = [];
        foreach ($modelIds as $modelId) {
            $model = new ModeGroupModelDTO();
            $model->setModelId($modelId);
            $this->models[] = $model;
        }
    }
}
