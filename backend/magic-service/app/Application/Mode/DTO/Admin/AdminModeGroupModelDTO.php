<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\Admin;

use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;

/**
 * 管理后台模式分组模型DTO
 * 继承自 ModeGroupModelDTO，添加动态模型相关字段（model_type, model_category, model_translate, aggregate_config）.
 */
class AdminModeGroupModelDTO extends ModeGroupModelDTO
{
    protected string $modelType = 'ATOM';

    protected string $modelCategory = '';

    protected array $modelTranslate = [];

    protected ?array $aggregateConfig = null;

    public function getModelType(): string
    {
        return $this->modelType;
    }

    public function getModelTypeEnum(): ProviderModelType
    {
        return ProviderModelType::from(strtoupper($this->modelType));
    }

    public function setModelType(null|ProviderModelType|string $modelType): void
    {
        if ($modelType === null || $modelType === '') {
            $this->modelType = 'atom';
        } elseif ($modelType instanceof ProviderModelType) {
            $this->modelType = strtolower($modelType->value);
        } else {
            // 验证是否有效并转为小写
            $enum = ProviderModelType::tryFrom(strtoupper((string) $modelType));
            $this->modelType = $enum ? strtolower($enum->value) : 'atom';
        }
    }

    public function getModelCategory(): string
    {
        return $this->modelCategory;
    }

    public function setModelCategory(string $modelCategory): void
    {
        $this->modelCategory = $modelCategory;
    }

    public function getModelTranslate(): array
    {
        return $this->modelTranslate;
    }

    public function setModelTranslate(array $modelTranslate): void
    {
        $this->modelTranslate = $modelTranslate;
    }

    public function getAggregateConfig(): ?array
    {
        return $this->aggregateConfig;
    }

    public function setAggregateConfig(?array $aggregateConfig): void
    {
        $this->aggregateConfig = $aggregateConfig;
    }
}
