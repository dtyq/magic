<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Workspace\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileCleanupAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Common\Service\AccountAppService;
use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Application\SuperMagic\Project\Service\ProjectMemberAppService;
use App\Application\SuperMagic\Task\Event\Publish\StopRunningTaskPublisher;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService as MagicChatTopicDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\DeleteDataType;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinDomainService;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchMovedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Task\Constant\AgentConstant;
use App\Domain\SuperMagic\Task\Event\StopRunningTaskEvent;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceArchiveStatus;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use App\Interfaces\SuperMagic\Message\DTO\Response\MessageItemDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Response\TopicListResponseDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Request\GetWorkspaceTopicsRequestDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Request\SaveWorkspaceRequestDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Request\WorkspaceListRequestDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Response\SaveWorkspaceResultDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Response\WorkspaceItemDTO;
use App\Interfaces\SuperMagic\Workspace\DTO\Response\WorkspaceListResponseDTO;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class WorkspaceAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected WorkspaceDomainService $workspaceDomainService,
        protected MagicConversationDomainService $magicConversationDomainService,
        protected MagicUserDomainService $userDomainService,
        protected MagicChatTopicDomainService $magicTopicDomainService,
        protected FileAppService $fileAppService,
        protected TaskDomainService $taskDomainService,
        protected AccountAppService $accountAppService,
        protected LockerInterface $locker,
        protected ChatAppService $chatAppService,
        protected ProjectDomainService $projectDomainService,
        protected ProjectMemberDomainService $projectMemberDomainService,
        protected ProjectMemberAppService $projectMemberAppService,
        protected TopicDomainService $topicDomainService,
        protected Producer $producer,
        protected LoggerFactory $loggerFactory,
        protected FileCleanupAppService $fileCleanupAppService,
        protected FileDomainService $fileDomainService,
        protected LongTermMemoryDomainService $longTermMemoryDomainService,
        protected RecycleBinDomainService $recycleBinDomainService,
        protected EventDispatcherInterface $eventDispatcher
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 获取工作区列表.
     */
    public function getWorkspaceList(RequestContext $requestContext, WorkspaceListRequestDTO $requestDTO): WorkspaceListResponseDTO
    {
        // 构建查询条件
        $conditions = $requestDTO->buildConditions();

        // 如果没有指定用户ID且有用户授权信息，使用当前用户ID
        if (empty($conditions['user_id'])) {
            $conditions['user_id'] = $requestContext->getUserAuthorization()->getId();
        }

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 通过领域服务获取工作区列表
        $result = $this->workspaceDomainService->getWorkspacesByConditions(
            $conditions,
            $requestDTO->page,
            $requestDTO->pageSize,
            $requestDTO->orderBy,
            $requestDTO->sort,
            $dataIsolation,
            true,
            $requestDTO->getPinPriority()
        );

        // 设置默认值
        $result['auto_create'] = false;

        // Only auto-create when the user truly has no workspace (total === 0),
        // not just when the current page happens to be empty (e.g. page beyond range).
        if (empty($result['list']) && ($result['total'] ?? 0) === 0 && $requestDTO->getAutoCreate() && ! $requestDTO->hasWorkspaceNameSearch()) {
            // Auto-create workspace with the requested type (use default if not specified)
            $workspaceType = $requestDTO->workspaceType ?: WorkspaceType::Default->value;
            $workspaceEntity = $this->workspaceDomainService->createWorkspace(
                $dataIsolation,
                '',
                '',
                $workspaceType
            );
            $result['list'] = [$workspaceEntity->toArray()];
            $result['total'] = 1;
            $result['auto_create'] = true;
        }

        // 提取所有工作区ID
        $workspaceIds = [];
        foreach ($result['list'] as $workspace) {
            if (is_array($workspace)) {
                $workspaceIds[] = $workspace['id'];
            } else {
                $workspaceIds[] = $workspace->getId();
            }
        }
        $workspaceIds = array_unique($workspaceIds);

        // 批量获取工作区状态
        $currentUserId = $dataIsolation->getCurrentUserId();
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch($workspaceIds, $currentUserId);

        // 批量获取工作区项目数量（性能优化：单次 GROUP BY 查询）
        $projectCountMap = $this->projectDomainService->getProjectCountByWorkspaceIds($workspaceIds, $dataIsolation);

        // 批量获取参与项目数量（与 participated 接口 show_collaboration=1 的 total 口径一致）
        $collaborationPaidOrganizationCodes = $this->projectMemberAppService->getUserCollaborationPaidOrganizationCodes($requestContext);
        $paidOrganizationCodes = array_unique(array_merge($collaborationPaidOrganizationCodes, [$dataIsolation->getCurrentOrganizationCode()]));
        $cooperateProjectCountMap = $this->projectMemberDomainService->countCooperateProjectsByWorkspaceIds(
            $currentUserId,
            $workspaceIds,
            $paidOrganizationCodes
        );

        // 转换为响应DTO并传入状态映射和项目数量映射
        return WorkspaceListResponseDTO::fromResult($result, $workspaceStatusMap, $projectCountMap, $cooperateProjectCountMap);
    }

    /**
     * Get or create a system-managed workspace by its type code.
     * Only internal workspace types (not in getPublicTypes()) are allowed.
     *
     * @param string $code WorkspaceType value, e.g. "chat"
     * @throws BusinessException if code is invalid or refers to a public workspace type
     */
    public function getAppWorkspace(RequestContext $requestContext, string $code): WorkspaceItemDTO
    {
        $type = WorkspaceType::tryFrom($code);
        if ($type === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, "Invalid workspace code: {$code}");
        }
        if (in_array($type->value, WorkspaceType::getPublicTypes(), true)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, "Workspace code '{$code}' is a user-managed type and cannot be auto-created via this endpoint");
        }

        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $workspaceEntity = $this->workspaceDomainService->getOrCreateWorkspaceByType($dataIsolation, $type);

        $workspaceId = (int) $workspaceEntity->getId();
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch([$workspaceId], $dataIsolation->getCurrentUserId());
        $workspaceStatus = $workspaceStatusMap[$workspaceId] ?? null;

        return WorkspaceItemDTO::fromEntity($workspaceEntity, $workspaceStatus);
    }

    /**
     * 获取工作区详情.
     */
    public function getWorkspaceDetail(RequestContext $requestContext, int $workspaceId): WorkspaceItemDTO
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 获取工作区详情
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
        if ($workspaceEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // 验证工作区是否属于当前用户
        if ($workspaceEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
        }

        // 计算工作区状态
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch([$workspaceId]);
        $workspaceStatus = $workspaceStatusMap[$workspaceId] ?? null;

        // 返回工作区详情DTO
        return WorkspaceItemDTO::fromEntity($workspaceEntity, $workspaceStatus);
    }

    public function createWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): WorkspaceItemDTO
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Use default workspace type if not provided
        $workspaceType = $requestDTO->getWorkspaceType() ?: WorkspaceType::Default->value;

        $workspaceEntity = $this->workspaceDomainService->createWorkspace(
            $dataIsolation,
            '',
            $requestDTO->getWorkspaceName(),
            $workspaceType
        );

        // Calculate workspace status
        $workspaceId = (int) $workspaceEntity->getId();
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch([$workspaceId]);
        $workspaceStatus = $workspaceStatusMap[$workspaceId] ?? null;

        // Return workspace detail DTO
        return WorkspaceItemDTO::fromEntity($workspaceEntity, $workspaceStatus);
    }

    public function updateWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): WorkspaceItemDTO
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        if (empty($requestDTO->getWorkspaceId())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        $workspaceId = (int) $requestDTO->getWorkspaceId();
        if ($requestDTO->getWorkspaceName() !== '' || $requestDTO->getIsPinned() !== null) {
            $this->workspaceDomainService->updateWorkspace(
                $dataIsolation,
                $workspaceId,
                $requestDTO->getWorkspaceName(),
                $requestDTO->getIsPinned()
            );
        }

        // Keep the legacy `pre_workspace_id: null` first-position behavior,
        // while treating an explicitly null `next_workspace_id` as a no-op.
        if ($requestDTO->preWorkspaceIdProvided && $requestDTO->nextWorkspaceIdProvided) {
            $this->logger->warning('Both pre_workspace_id and next_workspace_id were provided; pre_workspace_id wins', [
                'workspace_id' => $workspaceId,
            ]);
        }
        if ($requestDTO->preWorkspaceIdProvided
            || ($requestDTO->nextWorkspaceIdProvided && $requestDTO->getNextWorkspaceId() !== null)
        ) {
            $this->workspaceDomainService->moveWorkspace(
                $dataIsolation,
                $workspaceId,
                $requestDTO->getPreWorkspaceId(),
                $requestDTO->preWorkspaceIdProvided ? null : $requestDTO->getNextWorkspaceId()
            );
        }

        // Get updated workspace entity
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
        if ($workspaceEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // Calculate workspace status
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch([$workspaceId]);
        $workspaceStatus = $workspaceStatusMap[$workspaceId] ?? null;

        // Return workspace detail DTO
        return WorkspaceItemDTO::fromEntity($workspaceEntity, $workspaceStatus);
    }

    /**
     * Save workspace (create or update).
     * @return SaveWorkspaceResultDTO Operation result, including workspace ID
     * @throws BusinessException Throws an exception if saving fails
     * @throws Throwable
     */
    /**
     * 获取工作区下的话题列表.
     */
    public function getWorkspaceTopics(RequestContext $requestContext, GetWorkspaceTopicsRequestDTO $dto): TopicListResponseDTO
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 通过领域服务获取工作区话题列表
        $result = $this->workspaceDomainService->getWorkspaceTopics(
            [$dto->getWorkspaceId()],
            $dataIsolation,
            true,
            $dto->getPageSize(),
            $dto->getPage(),
            $dto->getOrderBy(),
            $dto->getOrderDirection()
        );

        // 转换为响应 DTO
        return TopicListResponseDTO::fromResult($result);
    }

    /**
     * 获取任务的附件列表.
     */
    public function getTaskAttachments(MagicUserAuthorization $userAuthorization, int $taskId, int $page = 1, int $pageSize = 10): array
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取任务附件列表
        $result = $this->workspaceDomainService->getTaskAttachments($taskId, $dataIsolation, $page, $pageSize);

        // 处理文件 URL
        $list = [];
        $organizationCode = $userAuthorization->getOrganizationCode();
        $fileKeys = [];
        // 遍历附件列表，使用TaskFileItemDTO处理
        foreach ($result['list'] as $entity) {
            // 创建DTO
            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) $entity->getFileId();
            $dto->taskId = (string) $entity->getTaskId();
            $dto->fileType = $entity->getFileType();
            $dto->fileName = $entity->getFileName();
            $dto->fileExtension = $entity->getFileExtension();
            $dto->fileKey = $entity->getFileKey();
            $dto->fileSize = $entity->getFileSize();
            $dto->topicId = (string) $entity->getTopicId();

            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
            if (! empty($fileKey)) {
                $fileLink = $this->fileAppService->getLink($organizationCode, $fileKey, StorageBucketType::SandBox);
                if ($fileLink) {
                    $dto->fileUrl = $fileLink->getUrl();
                } else {
                    $dto->fileUrl = '';
                }
            } else {
                $dto->fileUrl = '';
            }
            // 判断filekey是否重复，如果重复，则跳过
            if (in_array($fileKey, $fileKeys)) {
                continue;
            }
            $fileKeys[] = $fileKey;
            $list[] = $dto->toArray();
        }

        return [
            'list' => $list,
            'total' => $result['total'],
        ];
    }

    /**
     * 删除工作区.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $workspaceId 工作区ID
     * @return bool 是否删除成功
     * @throws BusinessException 如果用户无权限或工作区不存在则抛出异常
     */
    public function deleteWorkspace(RequestContext $requestContext, int $workspaceId): bool
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 调用领域服务执行删除
        $deletedProjects = [];
        Db::beginTransaction();
        try {
            // 先获取工作区信息(用于记录到回收站)
            $workspace = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
            if ($workspace === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
            }

            // 先获取工作区下的所有项目ID，用于删除长期记忆
            $projectIds = $this->projectDomainService->getProjectIdsByWorkspaceId($dataIsolation, $workspaceId);

            // 批量删除项目相关的长期记忆
            if (! empty($projectIds)) {
                $this->longTermMemoryDomainService->deleteMemoriesByProjectIds(
                    $dataIsolation->getCurrentOrganizationCode(),
                    AgentConstant::SUPER_MAGIC_CODE,
                    $dataIsolation->getCurrentUserId(),
                    $projectIds
                );
            }

            // 删除工作区
            $this->workspaceDomainService->deleteWorkspace($dataIsolation, $workspaceId);

            // 删除工作区下的项目
            $deletedProjects = $this->projectDomainService->getProjectsForWorkspaceDeletion($workspaceId);
            $this->projectDomainService->deleteProjectsByWorkspaceId($dataIsolation, $workspaceId);

            // 删除工作的话题
            $this->topicDomainService->deleteTopicsByWorkspaceId($dataIsolation, $workspaceId);

            // 投递消息，停止所有运行中的任务
            $event = new StopRunningTaskEvent(
                DeleteDataType::WORKSPACE,
                $workspaceId,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '工作区已被删除'
            );
            $publisher = new StopRunningTaskPublisher($event);
            $this->producer->produce($publisher);

            $this->logger->info(sprintf(
                '已投递停止任务消息，工作区ID: %d, 事件ID: %s',
                $workspaceId,
                $event->getEventId()
            ));

            // 记录到回收站表
            $this->recycleBinDomainService->recordDeletion(
                resourceType: RecycleBinResourceType::Workspace,
                resourceId: $workspaceId,
                resourceName: $workspace->getName(),
                ownerId: (string) $workspace->getUserId(),
                deletedBy: (string) $dataIsolation->getCurrentUserId(),
                parentId: null,
                extraData: null
            );

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('删除工作区失败：' . $e->getMessage());
            throw $e;
        }

        // Publish only after commit so cleanup cannot act on rolled-back deletions.
        if ($deletedProjects !== []) {
            $this->eventDispatcher->dispatch(new ProjectsBatchDeletedEvent($deletedProjects, $userAuthorization));
        }

        return true;
    }

    /**
     * Detach workspace.
     * Logically delete workspace but keep projects and topics by setting their workspace_id to null.
     *
     * @param RequestContext $requestContext Request context
     * @param int $workspaceId Workspace ID
     * @return bool Whether the operation succeeded
     * @throws BusinessException If user has no permission or workspace does not exist
     */
    public function detachWorkspace(RequestContext $requestContext, int $workspaceId): bool
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Execute detach within transaction
        $projects = [];
        Db::beginTransaction();
        try {
            $projectIds = $this->projectDomainService->getProjectIdsByWorkspaceId($dataIsolation, $workspaceId);
            $projects = $projectIds === []
                ? []
                : $this->projectDomainService->getProjectsWithAuth(
                    $projectIds,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode()
                );

            // Delete workspace (with permission validation inside)
            $this->workspaceDomainService->deleteWorkspace($dataIsolation, $workspaceId);

            // Detach projects (set workspace_id to null)
            $this->projectDomainService->detachWorkspaceFromProjects($dataIsolation, $workspaceId);

            // Detach topics (set workspace_id to null)
            $this->topicDomainService->detachWorkspaceFromTopics($dataIsolation, $workspaceId);

            // Note: Do NOT delete long-term memory, do NOT publish stop task event

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Detach workspace failed: ' . $e->getMessage());
            throw $e;
        }

        foreach ($projects as $project) {
            $project->setWorkspaceId(null);
        }
        if ($projects !== []) {
            $this->eventDispatcher->dispatch(new ProjectsBatchMovedEvent($projects, $userAuthorization));
        }

        return true;
    }

    /**
     * 获取任务详情.
     *
     * @return array 任务详情
     * @throws BusinessException 如果用户无权限或任务不存在则抛出异常
     */
    /**
     * 获取话题的消息列表.
     *
     * @deprecated Use TopicAppService::getMessagesByTopicId() instead. Kept for existing callers.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param string $sortDirection 排序方向，支持asc和desc
     * @return array 消息列表和总数
     */
    public function getMessagesByTopicId(int $topicId, int $page = 1, int $pageSize = 20, string $sortDirection = 'asc'): array
    {
        // 获取消息列表
        $result = $this->taskDomainService->getMessagesByTopicId($topicId, $page, $pageSize, true, $sortDirection);

        // 转换为响应格式
        $messages = [];
        foreach ($result['list'] as $message) {
            $messages[] = new MessageItemDTO($message->toArray());
        }

        $data = [
            'list' => $messages,
            'total' => $result['total'],
        ];

        // 获取 topic 信息
        $topicEntity = $this->topicDomainService->getTopicWithDeleted($topicId);
        if ($topicEntity != null) {
            $data['project_id'] = (string) $topicEntity->getProjectId();
            $projectEntity = $this->getAccessibleProject($topicEntity->getProjectId(), $topicEntity->getUserId(), $topicEntity->getUserOrganizationCode());
            $data['project_name'] = $projectEntity->getProjectName();
        }
        return $data;
    }

    /**
     * 设置工作区归档状态.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param array $workspaceIds 工作区ID数组
     * @param int $isArchived 归档状态（0:未归档, 1:已归档）
     * @return bool 是否操作成功
     */
    public function setWorkspaceArchived(RequestContext $requestContext, array $workspaceIds, int $isArchived): bool
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $currentUserId = $dataIsolation->getCurrentUserId();

        // 参数验证
        if (empty($workspaceIds)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace.ids_required');
        }

        // 验证归档状态值是否有效
        if (! in_array($isArchived, [
            WorkspaceArchiveStatus::NotArchived->value,
            WorkspaceArchiveStatus::Archived->value,
        ])) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.invalid_archive_status');
        }

        // 批量更新工作区归档状态
        $success = true;
        foreach ($workspaceIds as $workspaceId) {
            // 获取工作区详情，验证所有权
            $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail((int) $workspaceId);

            // 如果工作区不存在，跳过
            if (! $workspaceEntity) {
                $success = false;
                continue;
            }

            // 验证工作区是否属于当前用户
            if ($workspaceEntity->getUserId() !== $currentUserId) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'workspace.not_owner');
            }

            // 调用领域服务设置归档状态
            $result = $this->workspaceDomainService->archiveWorkspace(
                $requestContext,
                (int) $workspaceId,
                $isArchived === WorkspaceArchiveStatus::Archived->value
            );
            if (! $result) {
                $success = false;
            }
        }

        return $success;
    }
}
