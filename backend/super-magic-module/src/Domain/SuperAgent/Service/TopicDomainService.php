<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\Query\TopicQuery;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class TopicDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        protected TopicRepositoryInterface $topicRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('topic');
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

        return $result['list'][0]->getTopicMode() ?? '';
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
        string $topicMode = ''
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
        if (! empty($topicMode)) {
            $topicEntity->setTopicMode($topicMode);
        }
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

    // ======================= 消息回滚相关方法 =======================

    /**
     * 执行消息回滚逻辑.
     */
    public function rollbackMessages(string $targetSeqId): void
    {
        // 根据seq_id获取magic_message_id
        $magicMessageId = $this->topicRepository->getMagicMessageIdBySeqId($targetSeqId);
        if (empty($magicMessageId)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.seq_id_not_found');
        }

        // 获取所有相关的seq_id（所有视角）
        $baseSeqIds = $this->topicRepository->getAllSeqIdsByMagicMessageId($magicMessageId);
        if (empty($baseSeqIds)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.magic_message_id_not_found');
        }

        // 获取从当前消息开始的所有seq_ids（当前消息和后续消息）
        $allSeqIds = $this->topicRepository->getAllSeqIdsFromCurrent($baseSeqIds);
        if (empty($allSeqIds)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.seq_id_not_found');
        }

        // 在事务中执行删除操作
        Db::transaction(function () use ($allSeqIds, $targetSeqId) {
            // 删除topic_messages数据
            $this->topicRepository->deleteTopicMessages($allSeqIds);

            // 删除messages和sequences数据
            $this->topicRepository->deleteMessagesAndSequencesBySeqIds($allSeqIds);

            // 删除magic_super_agent_message表的数据
            $this->topicRepository->deleteSuperAgentMessagesFromSeqId((int) $targetSeqId);
        });
    }

    /**
     * 执行消息回滚开始逻辑（标记状态而非删除）.
     */
    public function rollbackMessagesStart(string $targetSeqId): void
    {
        // 根据seq_id获取magic_message_id
        $magicMessageId = $this->topicRepository->getMagicMessageIdBySeqId($targetSeqId);
        if (empty($magicMessageId)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.seq_id_not_found');
        }

        // 获取所有相关的seq_id（所有视角）
        $baseSeqIds = $this->topicRepository->getAllSeqIdsByMagicMessageId($magicMessageId);
        if (empty($baseSeqIds)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.magic_message_id_not_found');
        }

        // 获取从当前消息开始的所有seq_ids（当前消息和后续消息）
        $allSeqIdsFromCurrent = $this->topicRepository->getAllSeqIdsFromCurrent($baseSeqIds);
        if (empty($allSeqIdsFromCurrent)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'chat.message.rollback.seq_id_not_found');
        }

        // 获取小于当前消息的所有消息
        $allSeqIdsBeforeCurrent = $this->topicRepository->getAllSeqIdsBeforeCurrent($baseSeqIds);

        // 在事务中执行状态更新操作
        Db::transaction(function () use ($allSeqIdsFromCurrent, $allSeqIdsBeforeCurrent) {
            // 1. 将小于target_message_id的所有消息设置为已查看状态（正常状态）
            if (! empty($allSeqIdsBeforeCurrent)) {
                $this->topicRepository->batchUpdateSeqStatus($allSeqIdsBeforeCurrent, MagicMessageStatus::Read);
            }

            // 2. 标记大于等于target_message_id的消息为撤回状态
            $this->topicRepository->batchUpdateSeqStatus($allSeqIdsFromCurrent, MagicMessageStatus::Revoked);
        });
    }

    /**
     * 执行消息回滚提交逻辑（物理删除撤回状态的消息）.
     */
    public function rollbackMessagesCommit(int $topicId, string $userId): void
    {
        // 获取该话题中所有撤回状态的消息seq_ids
        $revokedSeqIds = $this->topicRepository->getRevokedSeqIdsByTopicId($topicId, $userId);

        if (empty($revokedSeqIds)) {
            // 没有撤回状态的消息，直接返回
            return;
        }

        // 为了使用现有的删除逻辑，需要找到一个target_seq_id用于deleteSuperAgentMessagesFromSeqId
        // 取最小的seq_id作为target（确保删除所有相关的super_agent_message）
        $targetSeqId = min($revokedSeqIds);

        // 在事务中执行删除操作（与现有rollbackMessages逻辑一致）
        Db::transaction(function () use ($revokedSeqIds, $targetSeqId) {
            // 删除topic_messages数据
            $this->topicRepository->deleteTopicMessages($revokedSeqIds);

            // 删除messages和sequences数据
            $this->topicRepository->deleteMessagesAndSequencesBySeqIds($revokedSeqIds);

            // 删除magic_super_agent_message表的数据
            $this->topicRepository->deleteSuperAgentMessagesFromSeqId($targetSeqId);
        });
    }

    /**
     * 执行消息撤回撤销逻辑（将撤回状态的消息恢复为正常状态）.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID（权限验证）
     */
    public function rollbackMessagesUndo(int $topicId, string $userId): void
    {
        $this->logger->info('[TopicDomain] Starting message rollback undo', [
            'topic_id' => $topicId,
            'user_id' => $userId,
        ]);

        // 获取该话题中所有撤回状态的消息seq_ids
        $revokedSeqIds = $this->topicRepository->getRevokedSeqIdsByTopicId($topicId, $userId);

        if (empty($revokedSeqIds)) {
            $this->logger->info('[TopicDomain] No revoked messages found for undo', [
                'topic_id' => $topicId,
                'user_id' => $userId,
            ]);
            // 没有撤回状态的消息，直接返回
            return;
        }

        $this->logger->info('[TopicDomain] Found revoked messages for undo', [
            'topic_id' => $topicId,
            'user_id' => $userId,
            'revoked_seq_ids_count' => count($revokedSeqIds),
        ]);

        // 在事务中执行状态更新操作（将撤回状态恢复为已查看状态）
        Db::transaction(function () use ($revokedSeqIds) {
            // 将撤回状态的消息恢复为已查看状态
            $this->topicRepository->batchUpdateSeqStatus($revokedSeqIds, MagicMessageStatus::Read);
        });

        $this->logger->info('[TopicDomain] Message rollback undo completed successfully', [
            'topic_id' => $topicId,
            'user_id' => $userId,
            'restored_seq_ids_count' => count($revokedSeqIds),
        ]);
    }

    /**
     * 根据话题查询对象获取话题列表.
     *
     * @param TopicQuery $query 话题查询对象
     * @return array{total: int, list: array<TopicEntity>} 话题列表和总数
     */
    public function getTopicsByQuery(TopicQuery $query): array
    {
        $conditions = $query->toConditions();

        // 查询话题
        return $this->topicRepository->getTopicsByConditions(
            $conditions,
            true,
            $query->getPageSize(),
            $query->getPage(),
            $query->getOrderBy(),
            $query->getOrder()
        );
    }

    /**
     * 获取话题状态统计指标.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param string $organizationCode 可选的组织代码过滤
     * @return array 话题状态统计指标数据
     */
    public function getTopicStatusMetrics(DataIsolation $dataIsolation, string $organizationCode = ''): array
    {
        // 构建查询条件
        $conditions = [];
        // 如果提供了组织代码，添加到查询条件
        if (! empty($organizationCode)) {
            $conditions['user_organization_code'] = $organizationCode;
        }

        // 使用仓储层查询统计数据
        return $this->topicRepository->getTopicStatusMetrics($conditions);
    }
}
