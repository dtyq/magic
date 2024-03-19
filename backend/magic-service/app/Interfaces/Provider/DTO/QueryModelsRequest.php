<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Infrastructure\Core\AbstractDTO;

/**
 * 查询模型列表的请求对象
 */
class QueryModelsRequest extends AbstractDTO
{
    protected ?Category $category = null;

    protected array $modelTypes = [];

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setCategory(null|Category|string $category): void
    {
        if ($category === null || $category === '') {
            $this->category = null;
        } elseif ($category instanceof Category) {
            $this->category = $category;
        } else {
            $this->category = Category::from((string) $category);
        }
    }

    /**
     * @return ModelType[]
     */
    public function getModelTypes(): array
    {
        return $this->modelTypes;
    }

    public function setModelTypes(null|array|string $modelTypes): void
    {
        if ($modelTypes === null) {
            $this->modelTypes = [];
            return;
        }

        if (is_string($modelTypes)) {
            $decoded = json_decode($modelTypes, true);
            $modelTypes = is_array($decoded) ? $decoded : [];
        }

        $this->modelTypes = [];
        foreach ($modelTypes as $modelTypeValue) {
            $modelType = ModelType::tryFrom((int) $modelTypeValue);
            if ($modelType !== null) {
                $this->modelTypes[] = $modelType;
            }
        }
    }
}
