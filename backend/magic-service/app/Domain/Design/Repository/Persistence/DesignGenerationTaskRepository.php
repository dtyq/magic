<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Repository\Persistence;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Repository\Persistence\Model\DesignGenerationTaskModel;

class DesignGenerationTaskRepository extends DesignAbstractRepository implements DesignGenerationTaskRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function create(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $model = new DesignGenerationTaskModel();
        $model->fill($this->extractAttributes($entity));
        $model->save();
        $entity->setId($model->id);
    }

    public function update(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $builder = $this->createBuilder($dataIsolation, DesignGenerationTaskModel::query());
        /** @var null|DesignGenerationTaskModel $model */
        $model = $builder->where('id', $entity->getId())->first();
        if ($model === null) {
            return;
        }

        $model->fill($this->extractAttributes($entity, false));
        $model->save();
    }

    public function delete(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $builder = $this->createBuilder($dataIsolation, DesignGenerationTaskModel::query());
        $builder
            ->where('project_id', $entity->getProjectId())
            ->where('asset_type', $entity->getAssetType()->value)
            ->where('generation_id', $entity->getGenerationId())
            ->delete();
    }

    public function findByProjectAndGenerationId(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $generationId
    ): ?DesignGenerationTaskEntity {
        $builder = $this->createBuilder($dataIsolation, DesignGenerationTaskModel::query());
        /** @var null|DesignGenerationTaskModel $model */
        $model = $builder
            ->where('project_id', $projectId)
            ->where('asset_type', $assetType->value)
            ->where('generation_id', $generationId)
            ->first();

        if ($model === null) {
            return null;
        }

        return DesignGenerationTaskFactory::modelToEntity($model);
    }

    public function findProcessingTasksAfterId(int $cursorId, int $limit): array
    {
        $models = DesignGenerationTaskModel::query()
            ->whereIn('status', ['pending', 'processing'])
            ->where('id', '>', $cursorId)
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $entities = [];
        /** @var DesignGenerationTaskModel $model */
        foreach ($models as $model) {
            $entities[] = DesignGenerationTaskFactory::modelToEntity($model);
        }

        return $entities;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractAttributes(DesignGenerationTaskEntity $entity, bool $withId = true): array
    {
        $attributes = [
            'organization_code' => $entity->getOrganizationCode(),
            'user_id' => $entity->getUserId(),
            'project_id' => $entity->getProjectId(),
            'generation_id' => $entity->getGenerationId(),
            'asset_type' => $entity->getAssetType()->value,
            'generation_type' => $entity->getGenerationType()->value,
            'model_id' => $entity->getModelId(),
            'prompt' => $entity->getPrompt(),
            'file_dir' => $entity->getFileDir(),
            'file_name' => $entity->getFileName(),
            'input_payload' => $entity->getInputPayload(),
            'request_payload' => $entity->getRequestPayload(),
            'provider_payload' => $entity->getProviderPayload(),
            'output_payload' => $entity->getOutputPayload(),
            'status' => $entity->getStatus()->value,
            'error_message' => $entity->getErrorMessage() === null ? null : mb_substr($entity->getErrorMessage(), 0, 2000),
            'updated_at' => $entity->getUpdatedAt()->format('Y-m-d H:i:s'),
        ];

        if ($withId) {
            $attributes['id'] = $entity->getId();
            $attributes['created_at'] = $entity->getCreatedAt()->format('Y-m-d H:i:s');
        }

        return $attributes;
    }
}
