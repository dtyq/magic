<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;

class TopicDomainService
{
    public function __construct(
        protected TopicRepositoryInterface $topicRepository,
    ) {
    }

    public function getTopicById(int $id): ?TopicEntity
    {
        return $this->topicRepository->getTopicById($id);
    }

    public function getTopicBySandboxId(string $sandboxId): ?TopicEntity
    {
        return $this->topicRepository->getTopicBySandboxId($sandboxId);
    }

    public function updateTopicStatus(int $id, int $taskId, TaskStatus $taskStatus): bool
    {
        return $this->topicRepository->updateTopicStatus($id, $taskId, $taskStatus);
    }

    /**
     * Get topic list whose update time exceeds specified time.
     *
     * @param string $timeThreshold Time threshold, if topic update time is earlier than this time, it will be included in the result
     * @param int $limit Maximum number of results returned
     * @return array<TopicEntity> Topic entity list
     */
    public function getTopicsExceedingUpdateTime(string $timeThreshold, int $limit = 100): array
    {
        return $this->topicRepository->getTopicsExceedingUpdateTime($timeThreshold, $limit);
    }

    /**
     * Get topic entity by ChatTopicId.
     */
    public function getTopicByChatTopicId(DataIsolation $dataIsolation, string $chatTopicId): ?TopicEntity
    {
        $conditions = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'chat_topic_id' => $chatTopicId,
        ];

        $result = $this->topicRepository->getTopicsByConditions($conditions, false);
        if (empty($result['list'])) {
            return null;
        }

        return $result['list'][0];
    }

    /**
     * @return array<TopicEntity>
     */
    public function getUserRunningTopics(DataIsolation $dataIsolation): array
    {
        $conditions = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'current_task_status' => TaskStatus::RUNNING,
        ];
        $result = $this->topicRepository->getTopicsByConditions($conditions, false);
        if (empty($result['list'])) {
            return [];
        }

        return $result['list'];
    }

    /**
     * Get topic entity by ChatTopicId.
     */
    public function getTopicOnlyByChatTopicId(string $chatTopicId): ?TopicEntity
    {
        $conditions = [
            'chat_topic_id' => $chatTopicId,
        ];

        $result = $this->topicRepository->getTopicsByConditions($conditions, false);
        if (empty($result['list'])) {
            return null;
        }

        return $result['list'][0];
    }

    public function updateTopic(TopicEntity $topicEntity): bool
    {
        return $this->topicRepository->updateTopic($topicEntity);
    }

    public function updateTopicWhereUpdatedAt(TopicEntity $topicEntity, string $updatedAt): bool
    {
        return $this->topicRepository->updateTopicWithUpdatedAt($topicEntity, $updatedAt);
    }

    public function updateTopicStatusBySandboxIds(array $sandboxIds, TaskStatus $taskStatus): bool
    {
        return $this->topicRepository->updateTopicStatusBySandboxIds($sandboxIds, $taskStatus->value);
    }
}
