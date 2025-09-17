<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceCreationParams;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceVersionEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Exception;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class WorkspaceDomainService
{
    public function __construct(
        protected WorkspaceRepositoryInterface $workspaceRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected TaskDomainService $taskDomainService,
        protected WorkspaceVersionRepositoryInterface $workspaceVersionRepository,
        protected SandboxGatewayInterface $gateway,
        protected LoggerInterface $logger,
    ) {
    }

    /**
     * Create workspace only (without topic creation).
     *
     * @param DataIsolation $dataIsolation Data isolation object
     * @param string $chatConversationId Chat conversation ID
     * @param string $workspaceName Workspace name
     * @return WorkspaceEntity Created workspace entity
     */
    public function createWorkspace(DataIsolation $dataIsolation, string $chatConversationId, string $workspaceName): WorkspaceEntity
    {
        // Get current user info from DataIsolation
        $currentUserId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // Create workspace entity
        $currentTime = date('Y-m-d H:i:s');
        $workspaceEntity = new WorkspaceEntity();
        $workspaceEntity->setUserId($currentUserId);
        $workspaceEntity->setUserOrganizationCode($organizationCode);
        $workspaceEntity->setChatConversationId($chatConversationId);
        $workspaceEntity->setName($workspaceName);
        $workspaceEntity->setArchiveStatus(WorkspaceArchiveStatus::NotArchived);
        $workspaceEntity->setWorkspaceStatus(WorkspaceStatus::Normal);
        $workspaceEntity->setCreatedUid($currentUserId);
        $workspaceEntity->setUpdatedUid($currentUserId);
        $workspaceEntity->setCreatedAt($currentTime);
        $workspaceEntity->setUpdatedAt($currentTime);

        // Save workspace using repository
        return $this->workspaceRepository->createWorkspace($workspaceEntity);
    }

    /**
     * 创建工作区. 默认会初始化一个话题 (DEPRECATED - use createWorkspace + TopicDomainService::createTopic)
     * 遵循DDD风格，领域服务负责处理业务逻辑.
     * @return array 包含工作区实体和话题实体的数组 ['workspace' => WorkspaceEntity, 'topic' => TopicEntity|null]
     * @deprecated Use createWorkspace() and TopicDomainService::createTopic() separately
     */
    public function createWorkspaceWithTopic(DataIsolation $dataIsolation, WorkspaceCreationParams $creationParams): array
    {
        // 从DataIsolation获取当前用户ID作为创建者ID
        $currentUserId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 创建工作区实体
        $currentTime = date('Y-m-d H:i:s');
        $workspaceEntity = new WorkspaceEntity();
        $workspaceEntity->setUserId($currentUserId); // 使用当前用户ID
        $workspaceEntity->setUserOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $workspaceEntity->setChatConversationId($creationParams->getChatConversationId());
        $workspaceEntity->setName($creationParams->getWorkspaceName());
        $workspaceEntity->setArchiveStatus(WorkspaceArchiveStatus::NotArchived); // 默认未归档
        $workspaceEntity->setWorkspaceStatus(WorkspaceStatus::Normal); // 默认状态：正常
        $workspaceEntity->setCreatedUid($currentUserId); // 从DataIsolation获取
        $workspaceEntity->setUpdatedUid($currentUserId); // 创建时更新者与创建者相同
        $workspaceEntity->setCreatedAt($currentTime);
        $workspaceEntity->setUpdatedAt($currentTime);

        // 使用事务保证工作区和话题同时创建成功
        $topicEntity = null;
        // 调用仓储层保存工作区
        $savedWorkspaceEntity = $this->workspaceRepository->createWorkspace($workspaceEntity);

        // 创建话题
        if ($savedWorkspaceEntity->getId() && ! empty($creationParams->getChatConversationTopicId())) {
            // 创建话题实体
            $topicEntity = new TopicEntity();
            $topicEntity->setUserId($currentUserId);
            $topicEntity->setUserOrganizationCode($organizationCode);
            $topicEntity->setWorkspaceId($savedWorkspaceEntity->getId());
            $topicEntity->setChatTopicId($creationParams->getChatConversationTopicId());
            $topicEntity->setChatConversationId($creationParams->getChatConversationId());
            $topicEntity->setSandboxId(''); // 初始为空
            $topicEntity->setWorkDir(''); // 初始为空
            $topicEntity->setCurrentTaskId(0);
            $topicEntity->setTopicName($creationParams->getTopicName());
            $topicEntity->setCurrentTaskStatus(TaskStatus::WAITING); // 默认状态：等待中
            $topicEntity->setCreatedUid($currentUserId); // 设置创建者用户ID
            $topicEntity->setUpdatedUid($currentUserId); // 设置更新者用户ID

            // 使用 topicRepository 保存话题
            $savedTopicEntity = $this->topicRepository->createTopic($topicEntity);

            if ($savedTopicEntity->getId()) {
                // 设置工作区的当前话题ID为新创建的话题ID
                $savedWorkspaceEntity->setCurrentTopicId($savedTopicEntity->getId());
                // 更新工作区
                $this->workspaceRepository->save($savedWorkspaceEntity);
                // 更新工作目录
                $topicEntity->setWorkDir($this->generateWorkDir($currentUserId, $savedTopicEntity->getId()));
                $this->topicRepository->updateTopic($topicEntity);
            }

            $topicEntity = $savedTopicEntity;
        }

        $result = $savedWorkspaceEntity;
        return [
            'workspace' => $result,
            'topic' => $topicEntity,
        ];
    }

    /**
     * 更新工作区.
     * 遵循DDD风格，领域服务负责处理业务逻辑.
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $workspaceId 工作区ID
     * @param string $workspaceName 工作区名称
     * @return bool 是否更新成功
     */
    public function updateWorkspace(DataIsolation $dataIsolation, int $workspaceId, string $workspaceName = ''): bool
    {
        // 获取工作区实体
        $workspaceEntity = $this->workspaceRepository->getWorkspaceById($workspaceId);

        if (! $workspaceEntity) {
            throw new RuntimeException('Workspace not found');
        }

        if ($workspaceEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new RuntimeException('You are not allowed to update this workspace');
        }

        // 如果有传入工作区名称，则更新名称
        if (! empty($workspaceName)) {
            $workspaceEntity->setName($workspaceName);
            $workspaceEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $workspaceEntity->setUpdatedUid($dataIsolation->getCurrentUserId()); // 设置更新者用户ID
        }

        // 使用通用 save 方法保存
        $this->workspaceRepository->save($workspaceEntity);
        return true;
    }

    /**
     * 获取工作区详情.
     */
    public function getWorkspaceDetail(int $workspaceId): ?WorkspaceEntity
    {
        return $this->workspaceRepository->getWorkspaceById($workspaceId);
    }

    /**
     * 归档/解除归档工作区.
     */
    public function archiveWorkspace(RequestContext $requestContext, int $workspaceId, bool $isArchived): bool
    {
        $archiveStatus = $isArchived ? WorkspaceArchiveStatus::Archived : WorkspaceArchiveStatus::NotArchived;
        return $this->workspaceRepository->updateWorkspaceArchivedStatus($workspaceId, $archiveStatus->value);
    }

    /**
     * 删除工作区（逻辑删除）.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $workspaceId 工作区ID
     * @return bool 是否删除成功
     * @throws RuntimeException 如果工作区不存在则抛出异常
     */
    public function deleteWorkspace(DataIsolation $dataIsolation, int $workspaceId): bool
    {
        // 获取工作区实体
        $workspaceEntity = $this->workspaceRepository->getWorkspaceById($workspaceId);

        if (! $workspaceEntity) {
            // 使用ExceptionBuilder抛出"未找到"类型的错误
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // 如果不是自己的工作区，不能删除
        if ($workspaceEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
        }

        // 设置删除时间
        $workspaceEntity->setDeletedAt(date('Y-m-d H:i:s'));
        $workspaceEntity->setUpdatedUid($dataIsolation->getCurrentUserId());
        $workspaceEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // 保存更新
        $this->workspaceRepository->save($workspaceEntity);
        return true;
    }

    /**
     * 设置当前话题.
     */
    public function setCurrentTopic(RequestContext $requestContext, int $workspaceId, string $topicId): bool
    {
        return $this->workspaceRepository->updateWorkspaceCurrentTopic($workspaceId, $topicId);
    }

    /**
     * 根据条件获取工作区列表.
     */
    public function getWorkspacesByConditions(
        array $conditions,
        int $page,
        int $pageSize,
        string $orderBy,
        string $orderDirection,
        DataIsolation $dataIsolation
    ): array {
        // 应用数据隔离
        $conditions = $this->applyDataIsolation($conditions, $dataIsolation);

        // 调用仓储层获取数据
        return $this->workspaceRepository->getWorkspacesByConditions(
            $conditions,
            $page,
            $pageSize,
            $orderBy,
            $orderDirection
        );
    }

    /**
     * 获取工作区下的话题列表.
     * @param array $workspaceIds 工作区ID数组
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param bool $needPagination 是否需要分页
     * @param int $pageSize 每页数量
     * @param int $page 页码
     * @param string $orderBy 排序字段
     * @param string $orderDirection 排序方向
     * @return array 话题列表
     */
    public function getWorkspaceTopics(
        array $workspaceIds,
        DataIsolation $dataIsolation,
        bool $needPagination = true,
        int $pageSize = 20,
        int $page = 1,
        string $orderBy = 'id',
        string $orderDirection = 'desc'
    ): array {
        $conditions = [
            'workspace_id' => $workspaceIds,
            'user_id' => $dataIsolation->getCurrentUserId(),
        ];

        return $this->topicRepository->getTopicsByConditions(
            $conditions,
            $needPagination,
            $pageSize,
            $page,
            $orderBy,
            $orderDirection
        );
    }

    /**
     * 获取任务的附件列表.
     *
     * @param int $taskId 任务ID
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 附件列表和总数
     */
    public function getTaskAttachments(int $taskId, DataIsolation $dataIsolation, int $page = 1, int $pageSize = 20): array
    {
        // 调用TaskFileRepository获取文件列表
        return $this->taskFileRepository->getByTaskId($taskId, $page, $pageSize);
        // 直接返回实体对象列表，让应用层处理URL获取
    }

    /**
     * 创建话题.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $workspaceId 工作区ID
     * @param string $chatTopicId 会话的话题ID，存储在topic_id字段中
     * @param string $topicName 话题名称
     * @return TopicEntity 创建的话题实体
     * @throws Exception 如果创建失败
     */
    public function createTopic(DataIsolation $dataIsolation, int $workspaceId, string $chatTopicId, string $topicName): TopicEntity
    {
        // 获取当前用户ID
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 获取工作区详情，检查工作区是否存在
        $workspaceEntity = $this->workspaceRepository->getWorkspaceById($workspaceId);
        if (! $workspaceEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.not_found');
        }

        // 检查工作区是否已归档
        if ($workspaceEntity->getArchiveStatus() === WorkspaceArchiveStatus::Archived) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.archived');
        }

        // 获取会话ID
        $chatConversationId = $workspaceEntity->getChatConversationId();
        if (empty($chatConversationId)) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.conversation_id_not_found');
        }

        // 如果话题ID为空，抛出异常
        if (empty($chatTopicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic.id_required');
        }

        // 创建话题实体
        $topicEntity = new TopicEntity();
        $topicEntity->setUserId($userId);
        $topicEntity->setUserOrganizationCode($organizationCode);
        $topicEntity->setWorkspaceId($workspaceId);
        $topicEntity->setChatTopicId($chatTopicId);
        $topicEntity->setChatConversationId($chatConversationId);
        $topicEntity->setTopicName($topicName);
        $topicEntity->setSandboxId(''); // 初始为空
        $topicEntity->setWorkDir(''); // 初始为空
        $topicEntity->setCurrentTaskId(0);
        $topicEntity->setCurrentTaskStatus(TaskStatus::WAITING); // 默认状态：等待中
        $topicEntity->setCreatedUid($userId); // 设置创建者用户ID
        $topicEntity->setUpdatedUid($userId); // 设置更新者用户ID

        // 保存话题
        $topicEntity = $this->topicRepository->createTopic($topicEntity);
        // 更新工作区
        if ($topicEntity->getId()) {
            $topicEntity->setWorkDir($this->generateWorkDir($userId, $topicEntity->getId()));
            $this->topicRepository->updateTopic($topicEntity);
        }
        return $topicEntity;
    }

    /**
     * 通过ID获取话题实体.
     *
     * @param int $id 话题ID(主键)
     * @return null|TopicEntity 话题实体
     */
    public function getTopicById(int $id): ?TopicEntity
    {
        return $this->topicRepository->getTopicById($id);
    }

    /**
     * 批量获取话题.
     * @return TopicEntity[]
     */
    public function getTopicsByIds(array $topicIds): array
    {
        if (empty($topicIds)) {
            return [];
        }
        return $this->topicRepository->getTopicsByIds($topicIds);
    }

    /**
     * Update topic project association.
     *
     * @param int $topicId Topic ID
     * @param int $projectId Project ID
     * @return bool Whether the update was successful
     * @throws Exception If the update fails
     */
    public function updateTopicProject(int $topicId, int $projectId): bool
    {
        // Get topic entity by ID
        $topicEntity = $this->topicRepository->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'topic.not_found');
        }

        // Update project association
        $topicEntity->setProjectId($projectId);

        // Save update
        return $this->topicRepository->updateTopic($topicEntity);
    }

    public function getTopicBySandboxId(string $sandboxId): ?TopicEntity
    {
        $topics = $this->topicRepository->getTopicsByConditions(['sandbox_id' => $sandboxId], true, 1, 1);
        if (! isset($topics['list']) || empty($topics['list'])) {
            return null;
        }
        return $topics['list'][0];
    }

    /**
     * 保存工作区实体
     * 直接保存工作区实体，不需要重复查询.
     * @param WorkspaceEntity $workspaceEntity 工作区实体
     * @return WorkspaceEntity 保存后的工作区实体
     */
    public function saveWorkspaceEntity(WorkspaceEntity $workspaceEntity): WorkspaceEntity
    {
        return $this->workspaceRepository->save($workspaceEntity);
    }

    /**
     * 获取工作区的话题列表.
     *
     * @param array|int $workspaceIds 工作区ID或ID数组
     * @param string $userId 用户ID
     * @return array 话题列表，以工作区ID为键
     */
    public function getWorkspaceTopicsByWorkspaceIds(array|int $workspaceIds, string $userId): array
    {
        if (! is_array($workspaceIds)) {
            $workspaceIds = [$workspaceIds];
        }

        // 如果没有工作区ID，直接返回空数组
        if (empty($workspaceIds)) {
            return [];
        }

        // 定义查询条件
        $conditions = [
            'workspace_id' => $workspaceIds,
            'user_id' => $userId,
        ];

        // 获取所有符合条件的话题
        $result = $this->topicRepository->getTopicsByConditions(
            $conditions,
            false, // 不分页，获取所有
            100,
            1,
            'id',
            'asc'
        );

        // 重新按工作区 ID 分组
        $topics = [];
        foreach ($result['list'] as $topic) {
            $workspaceId = $topic->getWorkspaceId();
            if (! isset($topics[$workspaceId])) {
                $topics[$workspaceId] = [];
            }
            $topics[$workspaceId][] = $topic;
        }

        return $topics;
    }

    public function getUserTopics(string $userId): array
    {
        // 考虑是否需要组织 code
        $topics = $this->topicRepository->getTopicsByConditions(
            ['user_id' => $userId],
            false, // 不分页，获取所有
            100,
            1,
            'id',
            'asc'
        );
        if (empty($topics['list'])) {
            return [];
        }

        return $topics['list'];
    }

    public function getTopicList(int $page, int $pageSize): array
    {
        // 考虑是否需要组织 code
        // 不分页，获取所有
        $topics = $this->topicRepository->getTopicsByConditions([], true, $pageSize, $page);
        if (empty($topics['list'])) {
            return [];
        }

        return $topics['list'];
    }

    /**
     * 根据任务状态获取工作区的话题列表.
     *
     * @param array|int $workspaceIds 工作区ID或ID数组
     * @param string $userId 用户ID
     * @param null|TaskStatus $taskStatus 任务状态，如果为null则返回所有状态
     * @return array 话题列表，以工作区ID为键
     */
    public function getWorkspaceTopicsByTaskStatus(array|int $workspaceIds, string $userId, ?TaskStatus $taskStatus = null): array
    {
        // 获取所有话题
        $allTopics = $this->getWorkspaceTopicsByWorkspaceIds($workspaceIds, $userId);

        // 如果不需要过滤任务状态，直接返回所有话题
        if ($taskStatus === null) {
            return $allTopics;
        }

        // 根据任务状态过滤话题
        $filteredTopics = [];
        foreach ($allTopics as $workspaceId => $topics) {
            $filteredTopicList = [];
            foreach ($topics as $topic) {
                // 如果话题的当前任务状态与指定状态匹配，或者话题没有任务状态且指定的是等待状态
                if (($topic->getCurrentTaskStatus() === $taskStatus)
                    || ($topic->getCurrentTaskStatus() === null && $taskStatus === TaskStatus::WAITING)) {
                    $filteredTopicList[] = $topic;
                }
            }

            if (! empty($filteredTopicList)) {
                $filteredTopics[$workspaceId] = $filteredTopicList;
            }
        }

        return $filteredTopics;
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
     * 获取任务详情.
     *
     * @param int $taskId 任务ID
     * @return null|TaskEntity 任务实体
     */
    public function getTaskById(int $taskId): ?TaskEntity
    {
        return $this->taskRepository->getTaskById($taskId);
    }

    /**
     * 获取话题关联的任务列表.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param null|DataIsolation $dataIsolation 数据隔离对象
     * @return array{list: TaskEntity[], total: int} 任务列表和总数
     */
    public function getTasksByTopicId(int $topicId, int $page = 1, int $pageSize = 10, ?DataIsolation $dataIsolation = null): array
    {
        return $this->taskRepository->getTasksByTopicId($topicId, $page, $pageSize);
    }

    /**
     * 通过话题ID集合获取工作区信息.
     *
     * @param array $topicIds 话题ID集合
     * @return array 以话题ID为键，工作区信息为值的关联数组
     */
    public function getWorkspaceInfoByTopicIds(array $topicIds): array
    {
        if (empty($topicIds)) {
            return [];
        }

        return $this->topicRepository->getWorkspaceInfoByTopicIds($topicIds);
    }

    public function updateTopicSandboxConfig(DataIsolation $dataIsolation, int $topicId, array $sandboxConfig): bool
    {
        $topicEntity = $this->topicRepository->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'topic.not_found');
        }

        $topicEntity->setSandboxConfig(json_encode($sandboxConfig));
        return $this->topicRepository->updateTopic($topicEntity);
    }

    /**
     * 获取所有工作区的唯一组织代码列表.
     *
     * @return array 唯一的组织代码列表
     */
    public function getUniqueOrganizationCodes(): array
    {
        return $this->workspaceRepository->getUniqueOrganizationCodes();
    }

    /**
     * Create a new workspace version record.
     */
    public function createWorkspaceVersion(WorkspaceVersionEntity $versionEntity): void
    {
        $this->workspaceVersionRepository->create($versionEntity);
    }

    /**
     * Get workspace version by commit hash, topic ID and folder.
     *
     * @param string $commitHash The commit hash
     * @param int $projectId The project ID
     * @param string $folder The folder path
     * @return null|WorkspaceVersionEntity The workspace version entity or null if not found
     */
    public function getWorkspaceVersionByCommitAndProjectId(string $commitHash, int $projectId, string $folder = ''): ?WorkspaceVersionEntity
    {
        // Get all versions for the topic
        return $this->workspaceVersionRepository->findByCommitHashAndProjectId($commitHash, $projectId, $folder);
    }

    /**
     * Get workspace version by commit hash, topic ID and folder.
     *
     * @param int $projectId The project ID
     * @param string $folder The folder path
     * @return null|WorkspaceVersionEntity The workspace version entity or null if not found
     */
    public function getWorkspaceVersionByProjectId(int $projectId, string $folder = ''): ?WorkspaceVersionEntity
    {
        // Get all versions for the topic
        return $this->workspaceVersionRepository->findByProjectId($projectId, $folder);
    }

    public function getLatestVersionByProjectId(int $projectId): ?WorkspaceVersionEntity
    {
        return $this->workspaceVersionRepository->getLatestVersionByProjectId($projectId);
    }

    /**
     * 根据commit_hash 和project_id 获取tag号.
     */
    public function getTagByCommitHashAndProjectId(string $commitHash, int $projectId): int
    {
        return $this->workspaceVersionRepository->getTagByCommitHashAndProjectId($commitHash, $projectId);
    }

    /**
     * 批量获取工作区名称映射.
     *
     * @param array $workspaceIds 工作区ID数组
     * @return array ['workspace_id' => 'workspace_name'] 键值对
     */
    public function getWorkspaceNamesBatch(array $workspaceIds): array
    {
        if (empty($workspaceIds)) {
            return [];
        }

        return $this->workspaceRepository->getWorkspaceNamesBatch($workspaceIds);
    }

    /**
     * 通过commit hash 和话题id 获取版本后，根据dir 文件列表，过滤result.
     */
    public function filterResultByGitVersion(array $result, int $projectId, string $organizationCode, string $workDir = ''): array
    {
        $dir = '.workspace';
        $workspaceVersion = $this->getWorkspaceVersionByProjectId($projectId, $dir);
        if (empty($workspaceVersion)) {
            return $result;
        }

        if (empty($workspaceVersion->getDir())) {
            return $result;
        }

        # 遍历result的updatedAt ，如果updatedAt 小于workspaceVersion 的updated_at ，则保持在一个临时数组
        $fileResult = [];
        foreach ($result['list'] as $item) {
            if ($item['updated_at'] >= $workspaceVersion->getUpdatedAt()) {
                $fileResult[] = $item;
            }
        }
        $dir = json_decode($workspaceVersion->getDir(), true);
        # dir 是一个二维数组，遍历$dir, 判断是否是一个文件，如果没有文件后缀说明是一个目录，过滤掉目录
        # dir =["generated_images","generated_images\/cute-cartoon-cat.jpg","generated_images\/handdrawn-cute-cat.jpg","generated_images\/abstract-modern-generic.jpg","generated_images\/minimalist-cat-icon.jpg","generated_images\/realistic-elegant-cat.jpg","generated_images\/oilpainting-elegant-cat.jpg","generated_images\/anime-cute-cat.jpg","generated_images\/cute-cartoon-dog.jpg","generated_images\/universal-minimal-logo-3.jpg","generated_images\/universal-minimal-logo.jpg","generated_images\/universal-minimal-logo-2.jpg","generated_images\/realistic-cat-photo.jpg","generated_images\/minimal-tech-logo.jpg","logs","logs\/agentlang.log"]
        $dir = array_filter($dir, function ($item) {
            if (strpos($item, '.') === false) {
                return false;
            }
            return true;
        });

        $gitVersionResult = [];
        foreach ($result['list'] as $item) {
            foreach ($dir as $dirItem) {
                $fileKey = WorkDirectoryUtil::getRelativeFilePath($item['file_key'], $workDir);

                // 统一路径分隔符，将所有路径分隔符标准化为系统默认分隔符
                $fileKey = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $fileKey);
                $dirItem = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $dirItem);
                $dirItem = '/' . $dirItem;
                // 调整为完全匹配
                if ($dirItem == $fileKey) {
                    $gitVersionResult[] = $item;
                }
            }
        }

        $newResult = array_merge($fileResult, $gitVersionResult);

        # 对tempResult进行去重
        $result['list'] = array_unique($newResult, SORT_REGULAR);
        $result['total'] = count($result['list']);
        return $result;
    }

    public function diffFileListAndVersionFile(array $result, int $projectId, string $taskId, string $sandboxId, string $organizationCode = ''): bool
    {
        $dir = '.workspace';
        $workspaceVersion = $this->getWorkspaceVersionByProjectId($projectId, $dir);
        if (empty($workspaceVersion)) {
            return false;
        }
        if (empty($workspaceVersion->getDir())) {
            return false;
        }
        $dir = json_decode($workspaceVersion->getDir(), true);
        # dir 是一个二维数组，遍历$dir, 判断是否是一个文件，如果没有文件后缀说明是一个目录，过滤掉目录
        # dir =["generated_images","generated_images\/cute-cartoon-cat.jpg","generated_images\/handdrawn-cute-cat.jpg","generated_images\/abstract-modern-generic.jpg","generated_images\/minimalist-cat-icon.jpg","generated_images\/realistic-elegant-cat.jpg","generated_images\/oilpainting-elegant-cat.jpg","generated_images\/anime-cute-cat.jpg","generated_images\/cute-cartoon-dog.jpg","generated_images\/universal-minimal-logo-3.jpg","generated_images\/universal-minimal-logo.jpg","generated_images\/universal-minimal-logo-2.jpg","generated_images\/realistic-cat-photo.jpg","generated_images\/minimal-tech-logo.jpg","logs","logs\/agentlang.log"]

        $dir = array_filter($dir, function ($item) {
            if (strpos($item, '.') === false) {
                return false;
            }
            return true;
        });

        # 遍历$result ，如果$result 的file_key 在$dir 中， dir中保存的是file_key 中一部分，需要使用字符串匹配，如果存在则保持在一个临时数组
        $gitVersionNotExistResult = [];

        $fileKeys = [];
        foreach ($result['list'] as $item) {
            # Find the project_id pattern in the file_key and extract everything after it
            $projectPattern = 'project_' . $projectId;
            $pos = strpos($item['file_key'], $projectPattern);
            if ($pos !== false) {
                # Get the position after the project_id and the following slash
                $startPos = $pos + strlen($projectPattern) + 1; // +1 for the slash
                $fileKeys[] = substr($item['file_key'], $startPos);
            } else {
                # Fallback: if project_id pattern not found, keep original logic
                $fileKeys[] = substr($item['file_key'], strlen((string) $projectId) + 1);
            }
        }

        foreach ($dir as $dirItem) {
            if (! in_array($dirItem, $fileKeys)) {
                $gitVersionNotExistResult[] = $dirItem;
            }
        }

        if (empty($gitVersionNotExistResult)) {
            return false;
        }
        # 对gitVersionNotExistResult 进行去重
        $gitVersionNotExistResult = array_unique($gitVersionNotExistResult);

        # 重新排序
        $gitVersionNotExistResult = array_values($gitVersionNotExistResult);

        # gitVersionNotExistResult 不为空，说明有文件更新，但是没有触发suer-magic的文件上传，需要再调用suer-magic的 api 进行一次文件上传
        if (! empty($gitVersionNotExistResult)) {
            try {
                # 查看沙箱是否存活
                $sandboxStatus = $this->gateway->getSandboxStatus($sandboxId);
                if ($sandboxStatus->isRunning()) {
                    $gatewayResult = $this->gateway->uploadFile($sandboxId, $gitVersionNotExistResult, (string) $projectId, $organizationCode, $taskId);
                    if ($gatewayResult->isSuccess()) {
                        return true;
                    }
                } else {
                    return false;
                }
            } catch (Throwable $e) {
                $this->logger->error('[Sandbox][Domain] uploadFile failed', ['error' => $e->getMessage()]);
            }
        }
        return false;
    }

    /**
     * 应用数据隔离到查询条件.
     */
    private function applyDataIsolation(array $conditions, DataIsolation $dataIsolation): array
    {
        // 用户id 和 组织代码
        $conditions['user_id'] = $dataIsolation->getCurrentUserId();
        $conditions['user_organization_code'] = $dataIsolation->getCurrentOrganizationCode();
        return $conditions;
    }

    /**
     * 生成工作目录.
     */
    private function generateWorkDir(string $userId, int $topicId): string
    {
        return sprintf('/%s/%s/topic_%d', AgentConstant::SUPER_MAGIC_CODE, $userId, $topicId);
    }
}
