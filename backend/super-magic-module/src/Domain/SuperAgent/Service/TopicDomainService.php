<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;

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

    public function getTopicWithDeleted(int $id): ?TopicEntity
    {
        return $this->topicRepository->getTopicWithDeleted($id);
    }

    public function getTopicBySandboxId(string $sandboxId): ?TopicEntity
    {
        return $this->topicRepository->getTopicBySandboxId($sandboxId);
    }

    public function getSandboxIdByTopicId(int $topicId): ?string
    {
        $topic = $this->getTopicById($topicId);
        if (empty($topic)) {
            return null;
        }
        return $topic->getSandboxId();
    }

    public function updateTopicStatus(int $id, int $taskId, TaskStatus $taskStatus): bool
    {
        return $this->topicRepository->updateTopicStatus($id, $taskId, $taskStatus);
    }

    public function updateTopicStatusAndSandboxId(int $id, int $taskId, TaskStatus $taskStatus, string $sandboxId): bool
    {
        return $this->topicRepository->updateTopicStatusAndSandboxId($id, $taskId, $taskStatus, $sandboxId);
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

    public function getTopicMode(DataIsolation $dataIsolation, int $topicId): string
    {
        $conditions = [
            'id' => $topicId,
            'user_id' => $dataIsolation->getCurrentUserId(),
        ];

        $result = $this->topicRepository->getTopicsByConditions($conditions, false);
        if (empty($result['list'])) {
            return '';
        }

        return ! empty($result['list'][0]->getTopicMode()) ? $result['list'][0]->getTopicMode()->value : '';
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

    public function updateTopicWhereUpdatedAt(TopicEntity $topicEntity, string $updatedAt): bool
    {
        return $this->topicRepository->updateTopicWithUpdatedAt($topicEntity, $updatedAt);
    }

    public function updateTopicStatusBySandboxIds(array $sandboxIds, TaskStatus $taskStatus): bool
    {
        return $this->topicRepository->updateTopicStatusBySandboxIds($sandboxIds, $taskStatus->value);
    }

    public function updateTopic(DataIsolation $dataIsolation, int $id, string $topicName): TopicEntity
    {
        // 查找当前的话题是否是自己的
        $topicEntity = $this->topicRepository->getTopicById($id);
        if (empty($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }
        $topicEntity->setTopicName($topicName);

        $this->topicRepository->updateTopic($topicEntity);

        return $topicEntity;
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
     * @param string $workDir Work directory
     * @return TopicEntity Created topic entity
     * @throws Exception If creation fails
     */
    public function createTopic(
        DataIsolation $dataIsolation,
        int $workspaceId,
        int $projectId,
        string $chatConversationId,
        string $chatTopicId,
        string $topicName = '',
        string $workDir = '',
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

        return $this->topicRepository->createTopic($topicEntity);
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

    public function deleteTopicsByProjectId(DataIsolation $dataIsolation, int $projectId)
    {
        $conditions = [
            'project_id' => $projectId,
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
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }

        // 设置删除时间
        $topicEntity->setDeletedAt(date('Y-m-d H:i:s'));
        // 设置更新者用户ID
        $topicEntity->setUpdatedUid($userId);
        $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // 保存更新
        return $this->topicRepository->updateTopic($topicEntity);
    }

    /**
     * Get project topics with pagination
     * 获取项目下的话题列表，支持分页和排序.
     */
    public function getProjectTopicsWithPagination(
        int $projectId,
        string $userId,
        int $page = 1,
        int $pageSize = 10
    ): array {
        $conditions = [
            'project_id' => $projectId,
            'user_id' => $userId,
        ];

        return $this->topicRepository->getTopicsByConditions(
            $conditions,
            true, // needPagination
            $pageSize,
            $page,
            'id', // 按创建时间排序
            'desc' // 降序
        );
    }

    /**
     * 批量计算工作区状态.
     *
     * @param array $workspaceIds 工作区ID数组
     * @return array ['workspace_id' => 'status'] 键值对
     */
    public function calculateWorkspaceStatusBatch(array $workspaceIds): array
    {
        if (empty($workspaceIds)) {
            return [];
        }

        // 从仓储层获取有运行中话题的工作区ID列表
        $runningWorkspaceIds = $this->topicRepository->getRunningWorkspaceIds($workspaceIds);

        // 计算每个工作区的状态
        $result = [];
        foreach ($workspaceIds as $workspaceId) {
            $result[$workspaceId] = in_array($workspaceId, $runningWorkspaceIds, true)
                ? TaskStatus::RUNNING->value
                : TaskStatus::WAITING->value;
        }

        return $result;
    }

    /**
     * 批量计算项目状态.
     *
     * @param array $projectIds 项目ID数组
     * @return array ['project_id' => 'status'] 键值对
     */
    public function calculateProjectStatusBatch(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 从仓储层获取有运行中话题的项目ID列表
        $runningProjectIds = $this->topicRepository->getRunningProjectIds($projectIds);

        // 计算每个项目的状态
        $result = [];
        foreach ($projectIds as $projectId) {
            $result[$projectId] = in_array($projectId, $runningProjectIds, true)
                ? TaskStatus::RUNNING->value
                : TaskStatus::WAITING->value;
        }

        return $result;
    }

    /**
     * 更新话题名称.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $id 话题主键ID
     * @param string $topicName 话题名称
     * @return bool 是否更新成功
     * @throws Exception 如果更新失败
     */
    public function updateTopicName(DataIsolation $dataIsolation, int $id, string $topicName): bool
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

        $conditions = [
            'id' => $id,
        ];
        $data = [
            'topic_name' => $topicName,
            'updated_uid' => $userId,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        // 保存更新
        return $this->topicRepository->updateTopicByCondition($conditions, $data);
    }

    public function updateTopicSandboxId(DataIsolation $dataIsolation, int $id, string $sandboxId): bool
    {
        $conditions = [
            'id' => $id,
        ];
        $data = [
            'sandbox_id' => $sandboxId,
            'updated_uid' => $dataIsolation->getCurrentUserId(),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        return $this->topicRepository->updateTopicByCondition($conditions, $data);
    }

    /**
     * Validate topic for message queue operations.
     * Checks both ownership and running status.
     *
     * @param DataIsolation $dataIsolation Data isolation object
     * @param int $topicId Topic ID
     * @return TopicEntity Topic entity if validation passes
     * @throws Exception If validation fails
     */
    public function validateTopicForMessageQueue(DataIsolation $dataIsolation, int $topicId): TopicEntity
    {
        // Get topic by ID
        $topicEntity = $this->topicRepository->getTopicById($topicId);
        if (empty($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // Check ownership
        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }

        return $topicEntity;
    }

    /**
     * Check if topic is running by user.
     *
     * @param DataIsolation $dataIsolation Data isolation object
     * @param int $topicId Topic ID
     * @return bool True if topic is running and belongs to user
     */
    public function isTopicRunningByUser(DataIsolation $dataIsolation, int $topicId): bool
    {
        try {
            $this->validateTopicForMessageQueue($dataIsolation, $topicId);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}
