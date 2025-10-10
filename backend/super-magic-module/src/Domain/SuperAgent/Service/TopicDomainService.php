<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatTopicRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\Query\TopicQuery;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

class TopicDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        protected TopicRepositoryInterface $topicRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected MagicMessageRepositoryInterface $magicMessageRepository,
        protected MagicChatSeqRepositoryInterface $magicSeqRepository,
        protected MagicChatTopicRepositoryInterface $magicChatTopicRepository,
        protected TaskMessageRepositoryInterface $taskMessageRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
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

    public function duplicateTopic(
        DataIsolation $dataIsolation,
        TopicEntity $sourceTopicEntity,
        int $messageId,
        string $newTopicName,
        ?callable $progressCallback = null
    ): TopicEntity {
        // 初始化 IM 会话
        $progressCallback && $progressCallback('running', 20, 'Initializing IM conversation');
        $imConversationResult = $this->initImConversationFromTopic($sourceTopicEntity, $newTopicName);

        // Create topic entity
        $progressCallback && $progressCallback('running', 30, 'Creating topic entity');
        $targetTopicEntity = $this->copyTopicEntity($dataIsolation, $sourceTopicEntity, $imConversationResult['user_conversation_id'], $imConversationResult['new_topic_id'], $newTopicName);

        // 复制消息
        $progressCallback && $progressCallback('running', 50, 'Copying topic messages');
        $messageIdMapping = $this->copyTopicShareMessages($messageId, $sourceTopicEntity, $targetTopicEntity);

        // 获取 agent 的 seq id
        $progressCallback && $progressCallback('running', 60, 'Getting sequence IDs');
        $seqList = $this->getSeqIdByMessageId((string) $messageId);
        $userSeqId = (int) $seqList['user_seq_id'];
        $aiSeqId = (int) $seqList['ai_seq_id'];

        // 复制 IM 消息
        $progressCallback && $progressCallback('running', 80, 'Copying IM messages');
        $this->copyImMessages($imConversationResult, $messageIdMapping, $userSeqId, $aiSeqId);

        // 复制沙箱的聊天记录
        $progressCallback && $progressCallback('running', 95, 'Copying chat history files');
        $this->copyAiChatHistoryFile($sourceTopicEntity, $targetTopicEntity);

        $progressCallback && $progressCallback('running', 100, 'Topic duplication completed');
        return $targetTopicEntity;
    }

    private function copyTopicEntity(
        DataIsolation $dataIsolation,
        TopicEntity $sourceTopicEntity,
        string $chatConversationId,
        string $chatTopicId,
        string $newTopicName
    ): TopicEntity {
        $currentTime = date('Y-m-d H:i:s');
        $topicEntity = new TopicEntity();
        $topicEntity->setUserId($sourceTopicEntity->getUserId());
        $topicEntity->setUserOrganizationCode($sourceTopicEntity->getUserOrganizationCode());
        $topicEntity->setWorkspaceId($sourceTopicEntity->getWorkspaceId());
        $topicEntity->setProjectId($sourceTopicEntity->getProjectId());
        $topicEntity->setChatTopicId($chatTopicId);
        $topicEntity->setChatConversationId($chatConversationId);
        $topicEntity->setTopicName($newTopicName);
        $topicEntity->setSandboxId(''); // Initially empty
        $topicEntity->setWorkDir($sourceTopicEntity->getWorkDir());
        $topicEntity->setCurrentTaskId(0);
        $topicEntity->setCurrentTaskStatus(TaskStatus::WAITING); // Default status: waiting
        $topicEntity->setCreatedUid($dataIsolation->getCurrentUserId()); // Set creator user ID
        $topicEntity->setUpdatedUid($dataIsolation->getCurrentUserId()); // Set updater user ID
        $topicEntity->setCreatedAt($currentTime);
        $topicEntity->setFromTopicId($sourceTopicEntity->getId());
        return $this->topicRepository->createTopic($topicEntity);
    }

    private function copyTopicTaskEntity(int $sourceTopicId, int $targetTopicId, array $taskIds): array
    {
        $this->logger->info('Starting to copy topic task entities', [
            'source_topic_id' => $sourceTopicId,
            'target_topic_id' => $targetTopicId,
            'task_ids' => $taskIds,
        ]);

        // 先通过 topic_id 和 task_id 查询任务的实体
        $sourceTaskEntities = $this->taskRepository->getTasksByTopicIdAndTaskIds($sourceTopicId, $taskIds);

        if (empty($sourceTaskEntities)) {
            $this->logger->info('No tasks found to copy', [
                'source_topic_id' => $sourceTopicId,
                'task_ids' => $taskIds,
            ]);
            return [];
        }

        $this->logger->info('Found tasks to copy', [
            'source_topic_id' => $sourceTopicId,
            'target_topic_id' => $targetTopicId,
            'task_count' => count($sourceTaskEntities),
        ]);

        // 然后参考 copyTopicEntity 方法，进行赋值
        $newTaskEntities = [];
        $taskIdMapping = []; // 旧task_id => 新task_id的映射关系
        $currentTime = date('Y-m-d H:i:s');

        foreach ($sourceTaskEntities as $sourceTask) {
            $newTaskEntity = new TaskEntity();

            // 提前生成新任务的ID
            $newTaskId = IdGenerator::getSnowId();
            $newTaskEntity->setId($newTaskId);

            // 复制所有相关属性
            $newTaskEntity->setUserId($sourceTask->getUserId());
            $newTaskEntity->setWorkspaceId($sourceTask->getWorkspaceId());
            $newTaskEntity->setProjectId($sourceTask->getProjectId());
            $newTaskEntity->setTopicId($targetTopicId); // 设置为新话题ID
            $newTaskEntity->setTaskId(''); // 任务ID由沙箱生成，暂时留空
            $newTaskEntity->setSandboxId(''); // 新的沙箱ID
            $newTaskEntity->setPrompt($sourceTask->getPrompt());
            $newTaskEntity->setAttachments($sourceTask->getAttachments());
            $newTaskEntity->setMentions($sourceTask->getMentions());
            $newTaskEntity->setTaskStatus($sourceTask->getTaskStatus());
            $newTaskEntity->setWorkDir($sourceTask->getWorkDir());
            $newTaskEntity->setTaskMode($sourceTask->getTaskMode());
            $newTaskEntity->setErrMsg(null); // 清空错误信息
            $newTaskEntity->setConversationId(null); // 清空会话ID

            // 设置复制来源任务ID
            $newTaskEntity->setFromTaskId($sourceTask->getId());

            // 设置时间戳
            $newTaskEntity->setCreatedAt($currentTime);
            $newTaskEntity->setUpdatedAt($currentTime);
            $newTaskEntity->setDeletedAt(null);

            $newTaskEntities[] = $newTaskEntity;

            // 直接建立映射关系：旧任务ID => 新任务ID
            $taskIdMapping[$sourceTask->getId()] = $newTaskId;
        }

        // 批量创建任务
        $createdTaskEntities = $this->taskRepository->batchCreateTasks($newTaskEntities);

        $this->logger->info('Successfully copied topic task entities', [
            'source_topic_id' => $sourceTopicId,
            'target_topic_id' => $targetTopicId,
            'copied_count' => count($createdTaskEntities),
            'task_id_mapping' => $taskIdMapping,
        ]);

        // 最后返回旧的task_id 和 新的task_id 的映射关系，如 ['old_task_id' => 'new_task_id']
        return $taskIdMapping;
    }

    private function copyTopicShareMessages(int $messageId, TopicEntity $sourceTopicEntity, TopicEntity $targetTopicEntity): array
    {
        $this->logger->info('Starting to copy topic share messages', [
            'source_topic_id' => $sourceTopicEntity->getId(),
            'target_topic_id' => $targetTopicEntity->getId(),
            'message_id' => $messageId,
        ]);

        // 查询需要拷贝的数据
        $messagesToCopy = $this->taskMessageRepository->findMessagesToCopyByTopicIdAndMessageId(
            $sourceTopicEntity->getId(),
            $messageId
        );

        if (empty($messagesToCopy)) {
            $this->logger->info('No messages found to copy', [
                'source_topic_id' => $sourceTopicEntity->getId(),
                'message_id' => $messageId,
            ]);
            return [];
        }

        $this->logger->info('Found messages to copy', [
            'source_topic_id' => $sourceTopicEntity->getId(),
            'target_topic_id' => $targetTopicEntity->getId(),
            'message_count' => count($messagesToCopy),
        ]);

        // 在处理消息之前，需要确保消息里都有任务进行关联，因此需要补充一下任务
        $taskIds = [];
        foreach ($messagesToCopy as $messageToCopy) {
            if (! in_array($messageToCopy->getTaskId(), $taskIds)) {
                $taskIds[] = $messageToCopy->getTaskId();
            }
        }
        $taskIdMapping = $this->copyTopicTaskEntity($sourceTopicEntity->getId(), $targetTopicEntity->getId(), $taskIds);

        $newMessageEntities = [];
        $messageIdMapping = []; // 旧消息ID => 新消息ID的映射关系

        foreach ($messagesToCopy as $messageToCopy) {
            $newMessageEntity = new TaskMessageEntity();

            // 复制消息属性，更新为新话题ID
            $newMessageEntity->setSenderType($messageToCopy->getSenderType());
            $newMessageEntity->setTopicId($targetTopicEntity->getId()); // 设置为新话题ID
            $newMessageEntity->setSenderUid($messageToCopy->getSenderUid());
            $newMessageEntity->setReceiverUid($messageToCopy->getReceiverUid());
            $newMessageEntity->setMessageId($messageToCopy->getMessageId());
            $newMessageEntity->setType($messageToCopy->getType());
            $newMessageEntity->setTaskId((string) $taskIdMapping[$messageToCopy->getTaskId()] ?? '');
            $newMessageEntity->setEvent($messageToCopy->getEvent());
            $newMessageEntity->setStatus($messageToCopy->getStatus());
            $newMessageEntity->setSteps($messageToCopy->getSteps());
            $newMessageEntity->setTool($messageToCopy->getTool());
            $newMessageEntity->setAttachments($messageToCopy->getAttachments());
            $newMessageEntity->setMentions($messageToCopy->getMentions());
            $newMessageEntity->setRawData('');
            $newMessageEntity->setContent($messageToCopy->getContent());
            $newMessageEntity->setSeqId($messageToCopy->getSeqId());
            $newMessageEntity->setProcessingStatus($messageToCopy->getProcessingStatus());
            $newMessageEntity->setErrorMessage($messageToCopy->getErrorMessage());
            $newMessageEntity->setRetryCount($messageToCopy->getRetryCount());
            $newMessageEntity->setProcessedAt($messageToCopy->getProcessedAt());
            $newMessageEntity->setShowInUi($messageToCopy->getShowInUi());
            $newMessageEntity->setRawContent($messageToCopy->getRawContent());

            $newMessageEntities[] = $newMessageEntity;

            // 建立映射关系：旧消息ID => 新消息ID
            $messageIdMapping[$messageToCopy->getId()] = (string) $newMessageEntity->getId();
        }

        // 批量插入到新话题中
        $createdMessageEntities = $this->taskMessageRepository->batchCreateMessages($newMessageEntities);

        $this->logger->debug('Successfully copied topic share messages', [
            'source_topic_id' => $sourceTopicEntity->getId(),
            'target_topic_id' => $targetTopicEntity->getId(),
            'copied_count' => count($createdMessageEntities),
            'message_id_mapping' => $messageIdMapping,
        ]);

        return $messageIdMapping;
    }

    private function initImConversationFromTopic(TopicEntity $sourceTopicEntity, string $topicName = ''): array
    {
        $this->logger->info('开始从话题初始化IM会话', [
            'source_topic_id' => $sourceTopicEntity->getId(),
            'chat_topic_id' => $sourceTopicEntity->getChatTopicId(),
            'chat_conversation_id' => $sourceTopicEntity->getChatConversationId(),
        ]);

        // 1. 通过 chat_topic_id 查询 magic_chat_topics 表获取所有相关记录
        $existingTopics = $this->magicChatTopicRepository->getTopicsByTopicId($sourceTopicEntity->getChatTopicId());

        if (count($existingTopics) !== 2) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TOPIC_NOT_FOUND,
                trans('super_agent.topic.im_topic_not_found')
            );
        }

        // 2. 生成新的话题ID
        $newTopicId = (string) IdGenerator::getSnowId();
        $aiConversationId = '';
        $userConversationId = '';

        // 3. 在循环中确定角色并直接创建记录
        foreach ($existingTopics as $topic) {
            $newTopicEntity = new MagicTopicEntity();
            $newTopicEntity->setTopicId($newTopicId);
            $newTopicEntity->setConversationId($topic->getConversationId());
            $newTopicEntity->setName(! empty($topicName) ? $topicName : $sourceTopicEntity->getTopicName());
            $newTopicEntity->setDescription($topic->getDescription());
            $newTopicEntity->setOrganizationCode($topic->getOrganizationCode());

            // 保存新的话题记录
            $this->magicChatTopicRepository->createTopic($newTopicEntity);

            // 确定AI和用户的会话ID
            if ($topic->getConversationId() === $sourceTopicEntity->getChatConversationId()) {
                $userConversationId = $topic->getConversationId();
            } else {
                $aiConversationId = $topic->getConversationId();
            }
        }

        // 验证会话ID都已找到
        if (empty($aiConversationId) || empty($userConversationId)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TOPIC_NOT_FOUND,
                trans('super_agent.topic.conversation_mismatch')
            );
        }

        $result = [
            'ai_conversation_id' => $aiConversationId,
            'user_conversation_id' => $userConversationId,
            'old_topic_id' => $sourceTopicEntity->getChatTopicId(),
            'new_topic_id' => $newTopicId,
        ];

        $this->logger->info('IM会话初始化完成', $result);

        return $result;
    }

    private function copyImMessages(array $imConversationResult, array $messageIdMapping, int $userSeqId, int $aiSeqId): array
    {
        $this->logger->info('开始复制IM消息', [
            'user_seq_id' => $userSeqId,
            'ai_seq_id' => $aiSeqId,
            'im_conversation_result' => $imConversationResult,
        ]);

        // 处理 magic_chat_topic_messages 表
        // 1. 查询用户的topic messages
        $userTopicMessages = $this->magicChatTopicRepository->getTopicMessagesBySeqId(
            $imConversationResult['user_conversation_id'],
            $imConversationResult['old_topic_id'],
            $userSeqId
        );

        // 2. 查询AI的topic messages
        $aiTopicMessages = $this->magicChatTopicRepository->getTopicMessagesBySeqId(
            $imConversationResult['ai_conversation_id'],
            $imConversationResult['old_topic_id'],
            $aiSeqId
        );

        $this->logger->info('查询到IM消息', [
            'user_messages_count' => count($userTopicMessages),
            'ai_messages_count' => count($aiTopicMessages),
        ]);

        // 3. 准备批量插入数据
        $batchInsertData = [];
        $userSeqIds = [];
        $aiSeqIds = [];
        $seqIdsMap = [];
        $currentTime = date('Y-m-d H:i:s');

        // 处理用户消息
        foreach ($userTopicMessages as $userMessage) {
            $newSeqId = (string) IdGenerator::getSnowId();
            $seqIdsMap[$userMessage->getSeqId()] = $newSeqId;
            $userSeqIds[] = $userMessage->getSeqId();
            $batchInsertData[] = [
                'seq_id' => $newSeqId,
                'conversation_id' => $imConversationResult['user_conversation_id'],
                'topic_id' => $imConversationResult['new_topic_id'],
                'organization_code' => $userMessage->getOrganizationCode(),
                'created_at' => $currentTime,
                'updated_at' => $currentTime,
            ];
        }

        // 处理AI消息
        foreach ($aiTopicMessages as $aiMessage) {
            $newSeqId = (string) IdGenerator::getSnowId();
            $seqIdsMap[$aiMessage->getSeqId()] = $newSeqId;
            $aiSeqIds[] = $aiMessage->getSeqId();
            $batchInsertData[] = [
                'seq_id' => $newSeqId,
                'conversation_id' => $imConversationResult['ai_conversation_id'],
                'topic_id' => $imConversationResult['new_topic_id'],
                'organization_code' => $aiMessage->getOrganizationCode(),
                'created_at' => $currentTime,
                'updated_at' => $currentTime,
            ];
        }

        // 4. 批量插入消息
        $insertResult = false;
        if (! empty($batchInsertData)) {
            $insertResult = $this->magicChatTopicRepository->createTopicMessages($batchInsertData);
        }

        // 5. 处理 magic_chat_sequences 表
        $magicMessageIdMapping = [];
        $batchSeqInsertData = [];

        // 5.1 查询用户的 sequences
        $userSequences = $this->magicSeqRepository->getSequencesByConversationIdAndSeqIds(
            $imConversationResult['user_conversation_id'],
            $userSeqIds
        );

        // 5.2 查询AI的 sequences
        $aiSequences = $this->magicSeqRepository->getSequencesByConversationIdAndSeqIds(
            $imConversationResult['ai_conversation_id'],
            $aiSeqIds
        );

        $this->logger->info('查询到Seq消息', [
            'user_sequences_count' => count($userSequences),
            'ai_sequences_count' => count($aiSequences),
        ]);

        // 5.3 处理用户 sequences
        foreach ($userSequences as $userSeq) {
            $originalSeqId = $userSeq->getId();
            $newSeqId = $seqIdsMap[$originalSeqId] ?? null;

            if (! $newSeqId) {
                continue;
            }

            // 生成或获取 magic_message_id 映射
            $originalMagicMessageId = $userSeq->getMagicMessageId();
            if (! isset($magicMessageIdMapping[$originalMagicMessageId])) {
                $magicMessageIdMapping[$originalMagicMessageId] = IdGenerator::getUniqueId32();
            }
            $newMagicMessageId = $magicMessageIdMapping[$originalMagicMessageId];

            // 处理 extra 中的 topic_id 替换
            $extra = $userSeq->getExtra();
            if ($extra && $extra->getTopicId()) {
                $extraData = $extra->toArray();
                $extraData['topic_id'] = $imConversationResult['new_topic_id'];
                $newExtra = new SeqExtra($extraData);
            } else {
                $newExtra = $extra;
            }

            // 获取 sender_message_id
            $senderMessageId = $seqIdsMap[$userSeq->getSenderMessageId()] ?? '';

            // 处理 app_message_id - 使用 messageIdMapping 映射
            $originalAppMessageId = $userSeq->getAppMessageId();
            $appMessageId = $messageIdMapping[$originalAppMessageId] ?? '';

            // 创建新的 sequence 实体
            $newUserSeq = new MagicSeqEntity();
            $newUserSeq->setId($newSeqId);
            $newUserSeq->setOrganizationCode($userSeq->getOrganizationCode());
            $newUserSeq->setObjectType($userSeq->getObjectType());
            $newUserSeq->setObjectId($userSeq->getObjectId());
            $newUserSeq->setSeqId($newSeqId);
            $newUserSeq->setSeqType($userSeq->getSeqType());
            $newUserSeq->setContent($userSeq->getContent());
            $newUserSeq->setMagicMessageId($newMagicMessageId);
            $newUserSeq->setMessageId($newSeqId);
            $newUserSeq->setReferMessageId('');
            $newUserSeq->setSenderMessageId($senderMessageId);
            $newUserSeq->setConversationId($imConversationResult['user_conversation_id']);
            $newUserSeq->setStatus($userSeq->getStatus());
            $newUserSeq->setReceiveList($userSeq->getReceiveList());
            $newUserSeq->setExtra($newExtra);
            $newUserSeq->setAppMessageId($appMessageId);
            $newUserSeq->setCreatedAt($currentTime);
            $newUserSeq->setUpdatedAt($currentTime);

            $batchSeqInsertData[] = $newUserSeq;
        }

        // 5.4 处理AI sequences
        foreach ($aiSequences as $aiSeq) {
            $originalSeqId = $aiSeq->getId();
            $newSeqId = $seqIdsMap[$originalSeqId] ?? null;

            if (! $newSeqId) {
                continue;
            }

            // 生成或获取 magic_message_id 映射
            $originalMagicMessageId = $aiSeq->getMagicMessageId();
            if (! isset($magicMessageIdMapping[$originalMagicMessageId])) {
                $magicMessageIdMapping[$originalMagicMessageId] = IdGenerator::getUniqueId32();
            }
            $newMagicMessageId = $magicMessageIdMapping[$originalMagicMessageId];

            // 处理 extra 中的 topic_id 替换
            $extra = $aiSeq->getExtra();
            if ($extra && $extra->getTopicId()) {
                $extraData = $extra->toArray();
                $extraData['topic_id'] = $imConversationResult['new_topic_id'];
                $newExtra = new SeqExtra($extraData);
            } else {
                $newExtra = $extra;
            }

            // 获取 sender_message_id
            $senderMessageId = $seqIdsMap[$aiSeq->getSenderMessageId()] ?? '';

            // 处理 app_message_id - 使用 messageIdMapping 映射
            $originalAppMessageId = $aiSeq->getAppMessageId();
            $appMessageId = $messageIdMapping[$originalAppMessageId] ?? '';

            // 创建新的 sequence 实体
            $newAiSeq = new MagicSeqEntity();
            $newAiSeq->setId($newSeqId);
            $newAiSeq->setOrganizationCode($aiSeq->getOrganizationCode());
            $newAiSeq->setObjectType($aiSeq->getObjectType());
            $newAiSeq->setObjectId($aiSeq->getObjectId());
            $newAiSeq->setSeqId($newSeqId);
            $newAiSeq->setSeqType($aiSeq->getSeqType());
            $newAiSeq->setContent($aiSeq->getContent());
            $newAiSeq->setMagicMessageId($newMagicMessageId);
            $newAiSeq->setMessageId($newSeqId);
            $newAiSeq->setReferMessageId('');
            $newAiSeq->setSenderMessageId($senderMessageId);
            $newAiSeq->setConversationId($imConversationResult['ai_conversation_id']);
            $newAiSeq->setStatus($aiSeq->getStatus());
            $newAiSeq->setReceiveList($aiSeq->getReceiveList());
            $newAiSeq->setExtra($newExtra);
            $newAiSeq->setAppMessageId($appMessageId);
            $newAiSeq->setCreatedAt($currentTime);
            $newAiSeq->setUpdatedAt($currentTime);

            $batchSeqInsertData[] = $newAiSeq;
        }

        // 5.5 批量插入 sequences
        $seqInsertResult = [];
        if (! empty($batchSeqInsertData)) {
            $seqInsertResult = $this->magicSeqRepository->batchCreateSeq($batchSeqInsertData);
        }

        // 6. 处理 magic_chat_messages 表
        // 6.1 将 $magicMessageIdMapping 的 key 转成数组 $originalMagicMessageIds
        $originalMagicMessageIds = array_keys($magicMessageIdMapping);

        // 6.2 查询原先的 magic_chat_messages 记录
        $originalMessages = $this->magicMessageRepository->getMessagesByMagicMessageIds($originalMagicMessageIds);

        $this->logger->info('查询到原始Messages', [
            'original_message_ids_count' => count($originalMagicMessageIds),
            'found_messages_count' => count($originalMessages),
        ]);

        // 6.3 生成新的 magic_chat_messages 记录
        // 直接使用 messageIdMapping，结构: [old_app_message_id] = new_message_id
        $batchMessageInsertData = [];
        foreach ($originalMessages as $originalMessage) {
            $originalMagicMessageId = $originalMessage->getMagicMessageId();
            $newMagicMessageId = $magicMessageIdMapping[$originalMagicMessageId] ?? null;

            if (! $newMagicMessageId) {
                continue;
            }

            $batchMessageInsertData[] = [
                'sender_id' => $originalMessage->getSenderId(),
                'sender_type' => $originalMessage->getSenderType(),
                'sender_organization_code' => $originalMessage->getSenderOrganizationCode(),
                'receive_id' => $originalMessage->getReceiveId(),
                'receive_type' => $originalMessage->getReceiveType(),
                'receive_organization_code' => $originalMessage->getReceiveOrganizationCode(),
                'message_type' => $originalMessage->getMessageType(),
                'content' => json_encode($originalMessage->getContent()->toArray(), JSON_UNESCAPED_UNICODE),
                'language' => $originalMessage->getLanguage(),
                'app_message_id' => $messageIdMapping[$originalMessage->getAppMessageId()] ?? '',
                'magic_message_id' => $newMagicMessageId,
                'send_time' => $originalMessage->getSendTime(),
                'current_version_id' => null,
                'created_at' => $currentTime,
                'updated_at' => $currentTime,
            ];
        }

        // 6.5 批量插入 magic_chat_messages
        $messageInsertResult = false;
        if (! empty($batchMessageInsertData)) {
            $messageInsertResult = $this->magicMessageRepository->batchCreateMessages($batchMessageInsertData);
        }

        $result = [
            'user_messages_count' => count($userTopicMessages),
            'ai_messages_count' => count($aiTopicMessages),
            'total_topic_messages_copied' => count($batchInsertData),
            'topic_messages_insert_success' => $insertResult,
            'user_sequences_count' => count($userSequences),
            'ai_sequences_count' => count($aiSequences),
            'total_sequences_copied' => count($batchSeqInsertData),
            'sequences_insert_success' => ! empty($seqInsertResult),
            'magic_message_id_mappings' => count($magicMessageIdMapping),
            'original_messages_found' => count($originalMessages),
            'total_messages_copied' => count($batchMessageInsertData),
            'messages_insert_success' => $messageInsertResult,
            'app_message_id_mappings' => count($messageIdMapping),
        ];

        $this->logger->info('IM消息复制完成', $result);

        return $result;
    }

    private function getSeqIdByMessageId(string $messageId): array
    {
        // 先通过 app_message_id 和 message_type 查询 magic_chat_messages， 获取 magic_message_id
        $magicMessageId = $this->magicMessageRepository->getMagicMessageIdByAppMessageId($messageId);

        // 再通过 magic_message_id 查询 magic_chat_sequences 获取 seq_id
        $seqList = $this->magicSeqRepository->getBothSeqListByMagicMessageId($magicMessageId);
        $result = [];
        foreach ($seqList as $seq) {
            if ($seq['object_type'] === UserType::Ai->value) {
                $result['ai_seq_id'] = $seq['seq_id'];
            } elseif ($seq['object_type'] === UserType::Human->value) {
                $result['user_seq_id'] = $seq['seq_id'];
            }
        }
        return $result;
    }

    private function copyAiChatHistoryFile(TopicEntity $sourceTopicEntity, TopicEntity $targetTopicEntity)
    {
        $sourcePath = WorkDirectoryUtil::getAgentChatHistoryFilePath($sourceTopicEntity->getUserId(), $sourceTopicEntity->getProjectId(), $sourceTopicEntity->getId());
        $targetPath = WorkDirectoryUtil::getAgentChatHistoryFilePath($targetTopicEntity->getUserId(), $targetTopicEntity->getProjectId(), $targetTopicEntity->getId());
        $prefix = $this->cloudFileRepository->getFullPrefix($sourceTopicEntity->getUserOrganizationCode());
        try {
            $sourceKey = rtrim($prefix, '/') . '/' . ltrim($sourcePath, '/');
            $destinationKey = rtrim($prefix, '/') . '/' . ltrim($targetPath, '/');
            $this->cloudFileRepository->copyObjectByCredential(
                prefix: '/',
                organizationCode: $sourceTopicEntity->getUserOrganizationCode(),
                sourceKey: $sourceKey,
                destinationKey: $destinationKey,
                bucketType: StorageBucketType::SandBox
            );
        } catch (Throwable $e) {
            $this->logger->error('复制IM消息文件失败', [
                'error_message' => $e->getMessage(),
                'source_path' => $sourcePath,
                'target_path' => $targetPath,
            ]);
        }
    }
}
