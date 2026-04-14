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
     * @var AdminModeGroupModelDTO[] 该分组对应的全部模型详细信息数组
     */
    protected array $models = [];

    /**
     * @var AdminModeGroupModelDTO[] 该分组对应的文本模型详细信息数组（LLM）
     */
    protected array $textModels = [];

    /**
     * @var AdminModeGroupModelDTO[] 该分组对应的图像模型详细信息数组（VLM）
     */
    protected array $imageModels = [];

    /**
     * @var AdminModeGroupModelDTO[] 该分组对应的视频模型详细信息数组（VGM）
     */
    protected array $videoModels = [];

    public function __construct(
        null|AdminModeGroupDTO|array $group = null,
        array $models = [],
        array $imageModels = [],
        array $videoModels = [],
        array $textModels = [],
    ) {
        if (! is_null($group)) {
            $this->group = $group instanceof AdminModeGroupDTO ? $group : new AdminModeGroupDTO($group);
        }

        [$models, $textModels, $imageModels, $videoModels] = $this->normalizeCategorizedModels(
            $models,
            $imageModels,
            $videoModels,
            $textModels,
        );

        $this->setModels($models);
        $this->setTextModels($textModels);
        $this->setImageModels($imageModels);
        $this->setVideoModels($videoModels);
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
    public function getTextModels(): array
    {
        return $this->textModels;
    }

    public function setTextModels(array $textModels): void
    {
        $modelData = [];
        foreach ($textModels as $model) {
            $modelData[] = $model instanceof AdminModeGroupModelDTO ? $model : new AdminModeGroupModelDTO($model);
        }

        $this->textModels = $modelData;
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

    /**
     * @return AdminModeGroupModelDTO[]|array[]
     */
    public function getVideoModels(): array
    {
        return $this->videoModels;
    }

    public function setVideoModels(array $videoModels): void
    {
        $modelData = [];
        foreach ($videoModels as $model) {
            $modelData[] = $model instanceof AdminModeGroupModelDTO ? $model : new AdminModeGroupModelDTO($model);
        }

        $this->videoModels = $modelData;
    }

    /**
     * 模式保存入参允许在 models 中混传不同 category 的模型，这里按 model_category 归类后再落库。
     *
     * @return array{0: array, 1: array, 2: array, 3: array}
     */
    private function normalizeCategorizedModels(
        array $models,
        array $imageModels,
        array $videoModels,
        array $textModels,
    ): array {
        $normalizedTextModels = $textModels;
        $normalizedImageModels = $imageModels;
        $normalizedVideoModels = $videoModels;

        foreach ($models as $model) {
            $category = $this->extractModelCategory($model);
            if ($category === 'vlm') {
                $normalizedImageModels[] = $model;
                continue;
            }
            if ($category === 'vgm') {
                $normalizedVideoModels[] = $model;
                continue;
            }

            $normalizedTextModels[] = $model;
        }

        $deduplicatedTextModels = $this->deduplicateModels($normalizedTextModels);
        $deduplicatedImageModels = $this->deduplicateModels($normalizedImageModels);
        $deduplicatedVideoModels = $this->deduplicateModels($normalizedVideoModels);

        return [
            $this->mergeAndDeduplicateModels($models, $deduplicatedTextModels, $deduplicatedImageModels, $deduplicatedVideoModels),
            $deduplicatedTextModels,
            $deduplicatedImageModels,
            $deduplicatedVideoModels,
        ];
    }

    private function extractModelCategory(AdminModeGroupModelDTO|array $model): string
    {
        if ($model instanceof AdminModeGroupModelDTO) {
            return $model->getModelCategory();
        }

        return (string) ($model['model_category'] ?? $model['modelCategory'] ?? '');
    }

    private function deduplicateModels(array $models): array
    {
        $uniqueModels = [];
        foreach ($models as $model) {
            $key = $this->buildModelDeduplicationKey($model);
            $uniqueModels[$key] = $model;
        }

        return array_values($uniqueModels);
    }

    private function mergeAndDeduplicateModels(array ...$modelGroups): array
    {
        $uniqueModels = [];
        foreach ($modelGroups as $models) {
            foreach ($models as $model) {
                $key = $this->buildModelDeduplicationKey($model);
                if (! isset($uniqueModels[$key])) {
                    $uniqueModels[$key] = $model;
                }
            }
        }

        return array_values($uniqueModels);
    }

    private function buildModelDeduplicationKey(AdminModeGroupModelDTO|array $model): string
    {
        if ($model instanceof AdminModeGroupModelDTO) {
            if ($model->getId() !== '') {
                return 'id:' . $model->getId();
            }

            return 'model:' . $model->getModelId() . ':' . $model->getProviderModelId();
        }

        $id = (string) ($model['id'] ?? '');
        if ($id !== '') {
            return 'id:' . $id;
        }

        $modelId = (string) ($model['model_id'] ?? $model['modelId'] ?? '');
        $providerModelId = (string) ($model['provider_model_id'] ?? $model['providerModelId'] ?? '');

        return 'model:' . $modelId . ':' . $providerModelId;
    }
}
