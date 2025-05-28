<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TokenUsageRecordEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TokenUsageRecordRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TokenUsageRecordModel;

class TokenUsageRecordRepository implements TokenUsageRecordRepositoryInterface
{
    public function __construct(protected TokenUsageRecordModel $model)
    {
    }

    public function create(DataIsolation $dataIsolation, TokenUsageRecordEntity $entity): TokenUsageRecordEntity
    {
        $record = $this->model::query()->create($entity->toArray());
        $entity->setId($record->id);
        return $entity;
    }

    public function getById(DataIsolation $dataIsolation, int $id): ?TokenUsageRecordEntity
    {
        $record = $this->model::query()->find($id);
        if (! $record) {
            return null;
        }
        return new TokenUsageRecordEntity($record->toArray());
    }

    public function getByTaskId(DataIsolation $dataIsolation, string $taskId): array
    {
        $records = $this->model::query()
            ->where('task_id', $taskId)
            ->orderBy('created_at', 'desc')
            ->get();

        $entities = [];
        foreach ($records as $record) {
            $entities[] = new TokenUsageRecordEntity($record->toArray());
        }

        return $entities;
    }

    public function getByTopicId(DataIsolation $dataIsolation, int $topicId): array
    {
        $records = $this->model::query()
            ->where('topic_id', $topicId)
            ->orderBy('created_at', 'desc')
            ->get();

        $entities = [];
        foreach ($records as $record) {
            $entities[] = new TokenUsageRecordEntity($record->toArray());
        }

        return $entities;
    }

    public function getByOrganizationAndUser(
        DataIsolation $dataIsolation,
        string $organizationCode,
        string $userId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        $query = $this->model::query()
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId);

        if ($startDate) {
            $query->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }

        $records = $query->orderBy('created_at', 'desc')->get();

        $entities = [];
        foreach ($records as $record) {
            $entities[] = new TokenUsageRecordEntity($record->toArray());
        }

        return $entities;
    }

    /**
     * Save token usage record.
     *
     * @param TokenUsageRecordEntity $entity Token usage record entity
     * @return TokenUsageRecordEntity Saved entity with ID
     */
    public function save(TokenUsageRecordEntity $entity): TokenUsageRecordEntity
    {
        $model = new TokenUsageRecordModel();
        $model->fill($entity->toArray());
        $model->save();

        // Update entity with generated ID
        $entity->setId($model->id);

        return $entity;
    }

    /**
     * Find existing record by unique key for idempotency check.
     *
     * @param int $topicId Topic ID
     * @param string $taskId Task ID
     * @param null|string $sandboxId Sandbox ID
     * @param null|string $modelId Model ID
     * @return null|TokenUsageRecordEntity Existing record or null if not found
     */
    public function findByUniqueKey(int $topicId, string $taskId, ?string $sandboxId, ?string $modelId): ?TokenUsageRecordEntity
    {
        $query = TokenUsageRecordModel::query()
            ->where('topic_id', $topicId)
            ->where('task_id', $taskId);

        // Handle nullable sandbox_id
        if ($sandboxId === null) {
            $query->whereNull('sandbox_id');
        } else {
            $query->where('sandbox_id', $sandboxId);
        }

        // Handle nullable model_id
        if ($modelId === null) {
            $query->whereNull('model_id');
        } else {
            $query->where('model_id', $modelId);
        }

        $model = $query->first();

        if ($model === null) {
            return null;
        }

        // Convert model to entity
        $entity = new TokenUsageRecordEntity();
        $entity->setId($model->id);
        $entity->setTopicId($model->topic_id);
        $entity->setTaskId($model->task_id);
        $entity->setSandboxId($model->sandbox_id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setUserId($model->user_id);
        $entity->setTaskStatus($model->task_status);
        $entity->setUsageType($model->usage_type);
        $entity->setTotalInputTokens($model->total_input_tokens);
        $entity->setTotalOutputTokens($model->total_output_tokens);
        $entity->setTotalTokens($model->total_tokens);
        $entity->setModelId($model->model_id);
        $entity->setModelName($model->model_name);
        $entity->setCachedTokens($model->cached_tokens);
        $entity->setCacheWriteTokens($model->cache_write_tokens);
        $entity->setReasoningTokens($model->reasoning_tokens);
        $entity->setUsageDetails($model->usage_details);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
