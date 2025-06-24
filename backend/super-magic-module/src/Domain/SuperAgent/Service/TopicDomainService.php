<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
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

    /**
     * Create topic.
     *
     * @param DataIsolation $dataIsolation Data isolation object
     * @param int $workspaceId Workspace ID
     * @param int $projectId Project ID
     * @param string $chatConversationId Chat conversation ID
     * @param string $chatTopicId Chat topic ID
     * @param string $topicName Topic name
     * @return TopicEntity Created topic entity
     * @throws \Exception If creation fails
     */
    public function createTopic(
        DataIsolation $dataIsolation,
        int $workspaceId,
        int $projectId,
        string $chatConversationId,
        string $chatTopicId,
        string $topicName = '',
        string $workDir = ''
    ): TopicEntity {
        // Get current user info
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $currentTime = date('Y-m-d H:i:s');

        // Validate required parameters
        if (empty($chatTopicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic.id_required');
        }

        // Create topic entity
        $topicEntity = new TopicEntity();
        $topicEntity->setUserId($userId);
        $topicEntity->setUserOrganizationCode($organizationCode);
        $topicEntity->setWorkspaceId($workspaceId);
        $topicEntity->setProjectId($projectId);
        $topicEntity->setChatTopicId($chatTopicId);
        $topicEntity->setChatConversationId($chatConversationId);
        $topicEntity->setTopicName($topicName);
        $topicEntity->setSandboxId(''); // Initially empty
        $topicEntity->setWorkDir($workDir); // Initially empty
        $topicEntity->setCurrentTaskId(0);
        $topicEntity->setCurrentTaskStatus(TaskStatus::WAITING); // Default status: waiting
        $topicEntity->setCreatedUid($userId); // Set creator user ID
        $topicEntity->setUpdatedUid($userId); // Set updater user ID
        $topicEntity->setCreatedAt($currentTime);

        // Save topic
        $topicEntity = $this->topicRepository->createTopic($topicEntity);

        // Update work directory after topic is created
        if ($topicEntity->getId()) {
            $topicEntity->setUpdatedAt($currentTime);
            $this->topicRepository->updateTopic($topicEntity);
        }

        return $topicEntity;
    }

    public function deleteTopicsByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId)
    {
        $conditions = [
          'workspace_id' => $workspaceId,
        ];
        $data = [
            'deleted_at' => date('Y-m-d H:i:s'),
            'updated_uid' => $dataIsolation->getCurrentUserId(),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        return $this->topicRepository->updateTopicByCondition($conditions, $data);
    }

    /**
     * 删除话题（逻辑删除）.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $id 话题ID(主键)
     * @return bool 是否删除成功
     * @throws Exception 如果删除失败或任务状态为运行中
     */
    public function deleteTopic(DataIsolation $dataIsolation, int $id): bool
    {
        // 获取当前用户ID
        $userId = $dataIsolation->getCurrentUserId();

        // 通过主键ID获取话题
        $topicEntity = $this->topicRepository->getTopicById($id);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'topic.not_found');
        }

        // 检查用户权限（检查话题是否属于当前用户）
        if ($topicEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'topic.access_denied');
        }

        // 检查任务状态，如果是运行中则不允许删除
        if ($topicEntity->getCurrentTaskStatus() === TaskStatus::RUNNING) {
            // 向 agent 发送停止命令
            $taskEntity = $this->taskRepository->getTaskById($topicEntity->getCurrentTaskId());
            if (! empty($taskEntity)) {
                $this->taskDomainService->handleInterruptInstruction($dataIsolation, $taskEntity);
            }
        }

        // 获取工作区详情，检查工作区是否存在
        $workspaceEntity = $this->workspaceRepository->getWorkspaceById($topicEntity->getWorkspaceId());
        if (! $workspaceEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.not_found');
        }

        // 检查工作区是否已归档
        if ($workspaceEntity->getArchiveStatus() === WorkspaceArchiveStatus::Archived) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.archived');
        }

        // 删除该话题下的所有任务（调用仓储层的批量删除方法）
        $this->taskRepository->deleteTasksByTopicId($id);

        // 设置删除时间
        $topicEntity->setDeletedAt(date('Y-m-d H:i:s'));
        // 设置更新者用户ID
        $topicEntity->setUpdatedUid($userId);

        // 保存更新
        return $this->topicRepository->updateTopic($topicEntity);
    }

    /**
     * Generate work directory.
     */
    private function generateWorkDir(string $userId, int $topicId): string
    {
        return sprintf('/%s/%s/topic_%d', AgentConstant::SUPER_MAGIC_CODE, $userId, $topicId);
    }
}
