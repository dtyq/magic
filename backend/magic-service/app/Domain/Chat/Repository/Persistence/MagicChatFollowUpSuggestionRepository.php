<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Repository\Persistence\Model\MagicChatFollowUpSuggestionModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class MagicChatFollowUpSuggestionRepository
{
    public const STATUS_GENERATING = 0;

    public const STATUS_DONE = 1;

    public const STATUS_FAILED = 2;

    public function __construct(
        private readonly MagicChatFollowUpSuggestionModel $model,
    ) {
    }

    /**
     * 为任务创建或复用一条 generating 记录。
     */
    public function createGenerating(int $topicId, string $taskId): array
    {
        $record = $this->findLatestByTopicIdAndTaskId($topicId, $taskId);
        if ($record !== null) {
            return $record;
        }

        $now = date('Y-m-d H:i:s');
        $data = [
            'id' => IdGenerator::getSnowId(),
            'topic_id' => $topicId,
            'task_id' => $taskId,
            'suggestions' => null,
            'status' => self::STATUS_GENERATING,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $record = $this->model::query()->create($data);

        return $record->toArray();
    }

    public function findLatestByTopicId(int $topicId): ?array
    {
        $record = $this->model::query()
            ->where('topic_id', $topicId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $record?->toArray();
    }

    public function findLatestByTopicIdAndTaskId(int $topicId, string $taskId): ?array
    {
        $record = $this->model::query()
            ->where('topic_id', $topicId)
            ->where('task_id', $taskId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $record?->toArray();
    }

    /**
     * @param string[] $suggestions
     */
    public function markDone(string $taskId, array $suggestions): void
    {
        $record = $this->model::query()
            ->where('task_id', $taskId)
            ->first();
        if ($record === null) {
            return;
        }

        $record->suggestions = array_values($suggestions);
        $record->status = self::STATUS_DONE;
        $record->updated_at = date('Y-m-d H:i:s');
        $record->save();
    }

    public function markFailed(string $taskId): void
    {
        $this->model::query()
            ->where('task_id', $taskId)
            ->update([
                'status' => self::STATUS_FAILED,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }
}
