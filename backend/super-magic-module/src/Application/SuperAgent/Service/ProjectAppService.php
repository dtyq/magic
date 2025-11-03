<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\ProjectForkPublisher;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ForkProjectStartEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectForkEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ForkProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\MoveProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ForkProjectResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ForkStatusResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicItemDTO;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * 项目应用服务
 */
class ProjectAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 创建项目.
     */
    public function createProject(RequestContext $requestContext, CreateProjectRequestDTO $requestDTO): array
    {
        $this->logger->info('开始初始化用户项目');
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 检查话题是否存在
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getWorkspaceId());
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // 如果指定了工作目录，需要从工作目录里提取项目id
        $projectId = '';
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        if (! empty($requestDTO->getWorkDir()) && WorkDirectoryUtil::isValidWorkDirectory($fullPrefix, $requestDTO->getWorkDir())) {
            $projectId = WorkDirectoryUtil::extractProjectIdFromAbsolutePath($requestDTO->getWorkDir());
        }

        Db::beginTransaction();
        try {
            // 创建默认项目
            $this->logger->info('创建默认项目');
            $projectEntity = $this->projectDomainService->createProject(
                $workspaceEntity->getId(),
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $projectId,
                '',
                $requestDTO->getProjectMode() ?: null
            );
            $this->logger->info(sprintf('创建默认项目, projectId=%s', $projectEntity->getId()));
            // 获取项目目录
            $workDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());

            // Initialize Magic Chat Conversation
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

            // 创建会话
            // Step 4: Create default topic
            $this->logger->info('开始创建默认话题');
            $topicEntity = $this->topicDomainService->createTopic(
                $dataIsolation,
                $workspaceEntity->getId(),
                $projectEntity->getId(),
                $chatConversationId,
                $chatConversationTopicId,
                '',
                $workDir
            );
            $this->logger->info(sprintf('创建默认话题成功, topicId=%s', $topicEntity->getId()));

            // 设置工作区信息
            $workspaceEntity->setCurrentTopicId($topicEntity->getId());
            $workspaceEntity->setCurrentProjectId($projectEntity->getId());
            $this->workspaceDomainService->saveWorkspaceEntity($workspaceEntity);
            $this->logger->info(sprintf('工作区%s已设置当前话题%s', $workspaceEntity->getId(), $topicEntity->getId()));

            // 设置项目信息
            $projectEntity->setCurrentTopicId($topicEntity->getId());
            $projectEntity->setWorkspaceId($workspaceEntity->getId());
            $projectEntity->setWorkDir($workDir);
            $this->projectDomainService->saveProjectEntity($projectEntity);
            $this->logger->info(sprintf('项目%s已设置当前话题%s', $projectEntity->getId(), $topicEntity->getId()));

            // 如果附件不为空，且附件是未绑定的状态，则保存附件， 并初始化目录
            if ($requestDTO->getFiles()) {
                $this->taskFileDomainService->bindProjectFiles(
                    $dataIsolation,
                    $projectEntity->getId(),
                    $requestDTO->getFiles(),
                    $projectEntity->getWorkDir()
                );
            } else {
                // 如果没有附件，就只初始化项目根目录文件
                $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $projectEntity->getId(),
                    workDir: $projectEntity->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                );
            }

            // 初始化项目成员和设置
            $this->projectMemberDomainService->initializeProjectMemberAndSettings(
                $dataIsolation->getCurrentUserId(),
                $projectEntity->getId(),
                $workspaceEntity->getId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            Db::commit();

            // 发布项目已创建事件
            $userAuthorization = $requestContext->getUserAuthorization();
            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            return ['project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(), 'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray()];
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Create Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, 'project.create_project_failed');
        }
    }

    /**
     * 更新项目.
     */
    public function updateProject(RequestContext $requestContext, UpdateProjectRequestDTO $requestDTO): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 检查话题是否存在
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getWorkspaceId());
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // 获取项目信息
        $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getId(), $dataIsolation->getCurrentUserId());
        $projectEntity->setProjectName($requestDTO->getProjectName());
        $projectEntity->setProjectDescription($requestDTO->getProjectDescription());
        $projectEntity->setWorkspaceId($requestDTO->getWorkspaceId());

        $this->projectDomainService->saveProjectEntity($projectEntity);

        // 发布项目已更新事件
        $userAuthorization = $requestContext->getUserAuthorization();
        $projectUpdatedEvent = new ProjectUpdatedEvent($projectEntity, $userAuthorization);
        $this->eventDispatcher->dispatch($projectUpdatedEvent);

        return ProjectItemDTO::fromEntity($projectEntity)->toArray();
    }

    /**
     * 删除项目.
     */
    #[Transactional]
    public function deleteProject(RequestContext $requestContext, int $projectId): bool
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 先获取项目实体用于事件发布
        $projectEntity = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        $result = Db::transaction(function () use ($projectId, $dataIsolation) {
            // 删除项目
            $result = $this->projectDomainService->deleteProject($projectId, $dataIsolation->getCurrentUserId());

            // 删除项目协作关系
            $this->projectMemberDomainService->deleteByProjectId($projectId);
            return $result;
        });

        if ($result) {
            // 删除项目相关的长期记忆
            $this->longTermMemoryDomainService->deleteMemoriesByProjectIds(
                $dataIsolation->getCurrentOrganizationCode(),
                AgentConstant::SUPER_MAGIC_CODE, // app_id 固定为 super-magic
                $dataIsolation->getCurrentUserId(),
                [(string) $projectId]
            );

            // 发布项目已删除事件
            $projectDeletedEvent = new ProjectDeletedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectDeletedEvent);

            $this->topicDomainService->deleteTopicsByProjectId($dataIsolation, $projectId);
            $event = new StopRunningTaskEvent(
                DeleteDataType::PROJECT,
                $projectId,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '项目已被删除'
            );
            $publisher = new StopRunningTaskPublisher($event);
            $this->producer->produce($publisher);

            $this->logger->info(sprintf(
                '已投递停止任务消息，项目ID: %d, 事件ID: %s',
                $projectId,
                $event->getEventId()
            ));
        }

        return $result;
    }

    /**
     * 获取项目详情.
     */
    public function getProject(RequestContext $requestContext, int $projectId): ProjectEntity
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        return $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
    }

    /**
     * 获取项目详情.
     */
    public function getProjectNotUserId(int $projectId): ?ProjectEntity
    {
        return $this->projectDomainService->getProjectNotUserId($projectId);
    }

    public function getProjectForkCount(int $projectId): int
    {
        return $this->projectDomainService->getProjectForkCount($projectId);
    }

    /**
     * 获取项目列表（带分页）.
     */
    public function getProjectList(RequestContext $requestContext, GetProjectListRequestDTO $requestDTO): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $conditions = [];
        $conditions['user_id'] = $dataIsolation->getCurrentUserId();
        $conditions['user_organization_code'] = $dataIsolation->getCurrentOrganizationCode();

        if ($requestDTO->getWorkspaceId()) {
            $conditions['workspace_id'] = $requestDTO->getWorkspaceId();
        }

        // Add project name fuzzy search condition
        if (! empty($requestDTO->getProjectName())) {
            $conditions['project_name_like'] = $requestDTO->getProjectName();
        }

        $result = $this->projectDomainService->getProjectsByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            'updated_at',
            'desc'
        );

        // 提取所有项目ID和工作区ID
        $projectIds = array_unique(array_map(fn ($project) => $project->getId(), $result['list'] ?? []));
        $workspaceIds = array_unique(array_map(fn ($project) => $project->getWorkspaceId(), $result['list'] ?? []));

        // 批量获取项目状态
        $projectStatusMap = $this->topicDomainService->calculateProjectStatusBatch($projectIds, $dataIsolation->getCurrentUserId());

        // 批量获取工作区名称
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 批量获取项目成员数量，判断是否存在协作成员
        $projectMemberCounts = $this->projectMemberDomainService->getProjectMembersCounts($projectIds);
        $projectIdsWithMember = array_keys(array_filter($projectMemberCounts, fn ($count) => $count > 0));

        // 创建响应DTO并传入项目状态映射和工作区名称映射
        $listResponseDTO = ProjectListResponseDTO::fromResult($result, $workspaceNameMap, $projectIdsWithMember, $projectStatusMap);

        return $listResponseDTO->toArray();
    }

    /**
     * 获取项目下的话题列表.
     */
    public function getProjectTopics(RequestContext $requestContext, int $projectId, int $page = 1, int $pageSize = 10): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 验证项目权限
        $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 通过话题领域服务获取项目下的话题列表
        $result = $this->topicDomainService->getProjectTopicsWithPagination(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $page,
            $pageSize
        );

        // 转换为 TopicItemDTO
        $topicDTOs = [];
        foreach ($result['list'] as $topic) {
            $topicDTOs[] = TopicItemDTO::fromEntity($topic)->toArray();
        }

        return [
            'total' => $result['total'],
            'list' => $topicDTOs,
        ];
    }

    public function checkFileListUpdate(RequestContext $requestContext, int $projectId, DataIsolation $dataIsolation): array
    {
        //        $userAuthorization = $requestContext->getUserAuthorization();

        //        $projectEntity = $this->projectDomainService->getProject($projectId, $userAuthorization->getId());

        // 通过领域服务获取话题附件列表
        //        $result = $this->taskDomainService->getTaskAttachmentsByTopicId(
        //            (int) $projectEntity->getCurrentTopicId(),
        //            $dataIsolation,
        //            1,
        //            2000
        //        );
        //
        //        $lastUpdatedAt = $this->taskFileDomainService->getLatestUpdatedByProjectId($projectId);
        //        $topicEntity = $this->topicDomainService->getTopicById($projectEntity->getCurrentTopicId());
        //        $taskEntity = $this->taskDomainService->getTaskBySandboxId($topicEntity->getSandboxId());
        //        # #检测git version 跟database 的files表是否匹配
        //        $result = $this->workspaceDomainService->diffFileListAndVersionFile($result, $projectId, $dataIsolation->getCurrentOrganizationCode(), (string) $taskEntity->getId(), $topicEntity->getSandboxId());
        //        if ($result) {
        //            $lastUpdatedAt = date('Y-m-d H:i:s');
        //        }

        $lastUpdatedAt = $this->taskFileDomainService->getLatestUpdatedByProjectId($projectId);

        return [
            'last_updated_at' => $lastUpdatedAt,
        ];
    }

    /**
     * 获取项目附件列表（登录用户模式）.
     */
    public function getProjectAttachments(RequestContext $requestContext, GetProjectAttachmentsRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 验证项目存在性和所有权
        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 创建基于用户的数据隔离
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取附件列表（传入workDir用于相对路径计算）
        return $this->getProjectAttachmentList($dataIsolation, $requestDTO, $projectEntity->getWorkDir() ?? '');
    }

    /**
     * 审查页面获取的项目附件列表.
     */
    public function getProjectAttachmentsFromAudit(RequestContext $requestContext, GetProjectAttachmentsRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $requestDTO->getProjectId());

        // 创建基于用户的数据隔离
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        return $this->getProjectAttachmentList($dataIsolation, $requestDTO, $projectEntity->getWorkDir() ?? '');
    }

    /**
     * 通过访问令牌获取项目附件列表.
     */
    public function getProjectAttachmentsByAccessToken(GetProjectAttachmentsRequestDTO $requestDto): array
    {
        $token = $requestDto->getToken();

        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(ShareErrorCode::PARAMETER_CHECK_FAILURE, 'share.parameter_check_failure');
        }

        $shareId = AccessTokenUtil::getShareId($token);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
        }

        // 由于前端当前的分享话题也会获取项目列表的接口，所以这里需要兼容分享类型是话题的情况，否则直接处理 ResourceType::Project 即可
        $projectId = '';
        $workDir = '';
        switch ($shareEntity->getResourceType()) {
            case ResourceType::Topic->value:
                $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                if (empty($topicEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                }
                $projectId = (string) $topicEntity->getProjectId();
                $workDir = $topicEntity->getWorkDir();
                break;
            case ResourceType::Project->value:
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $shareEntity->getResourceId());
                if (empty($projectEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
                }
                $projectId = (string) $projectEntity->getId();
                $workDir = $projectEntity->getWorkDir();
                break;
            default:
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }

        $requestDto->setProjectId($projectId);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');

        // 令牌模式不需要workDir处理，传空字符串
        return $this->getProjectAttachmentList($dataIsolation, $requestDto, $workDir);
    }

    public function getCloudFiles(RequestContext $requestContext, int $projectId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $projectEntity = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
        return $this->taskFileDomainService->getProjectFilesFromCloudStorage($dataIsolation->getCurrentOrganizationCode(), $projectEntity->getWorkDir());
    }

    public function hasProjectMember(int $projectId): bool
    {
        $projectIdMapMemberCounts = $this->projectMemberDomainService->getProjectMembersCounts([$projectId]);

        return (bool) ($projectIdMapMemberCounts[$projectId] ?? 0) > 0;
    }

    /**
     * Fork project.
     */
    public function forkProject(RequestContext $requestContext, ForkProjectRequestDTO $requestDTO): array
    {
        $this->logger->info('Starting project fork process');
        // Check resource is allow fork
        $resourceShareEntity = $this->resourceShareDomainService->getShareByResourceId($requestDTO->sourceProjectId);
        if (empty($resourceShareEntity) || $resourceShareEntity->getResourceType() != ResourceType::Project->value) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, trans('share.resource_not_found'));
        }
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Validate target workspace exists
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getTargetWorkspaceId());
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
        }

        // Validate target workspace belongs to user
        if ($workspaceEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
        }

        Db::beginTransaction();
        try {
            // Trigger fork start check event
            AsyncEventUtil::dispatch(new ForkProjectStartEvent(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));
            $this->logger->info(sprintf(
                'Dispatched fork project start event, organization: %s, user: %s',
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));

            // Create fork record and project
            /**
             * @var ProjectEntity $forkProjectEntity
             * @var ProjectForkEntity $forkProjectRecordEntity
             */
            [$forkProjectEntity, $forkProjectRecordEntity] = $this->projectDomainService->forkProject(
                $requestDTO->getSourceProjectId(),
                $requestDTO->getTargetWorkspaceId(),
                $requestDTO->getTargetProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            $this->logger->info(sprintf(
                'Created fork record, fork project ID: %d, fork record ID: %d',
                $forkProjectEntity->getId(),
                $forkProjectRecordEntity->getId()
            ));

            $this->logger->info(sprintf('创建默认项目, projectId=%s', $forkProjectEntity->getId()));
            $workDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $forkProjectEntity->getId());

            // Initialize Magic Chat Conversation
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

            // Step 4: Create default topic
            $this->logger->info('开始创建默认话题');
            $topicEntity = $this->topicDomainService->createTopic(
                $dataIsolation,
                $workspaceEntity->getId(),
                $forkProjectEntity->getId(),
                $chatConversationId,
                $chatConversationTopicId,
                '',
                $workDir
            );
            $this->logger->info(sprintf('创建默认话题成功, topicId=%s', $topicEntity->getId()));

            // 设置工作区信息
            $workspaceEntity->setCurrentTopicId($topicEntity->getId());
            $workspaceEntity->setCurrentProjectId($forkProjectEntity->getId());
            $this->workspaceDomainService->saveWorkspaceEntity($workspaceEntity);
            $this->logger->info(sprintf('工作区%s已设置当前话题%s', $workspaceEntity->getId(), $topicEntity->getId()));

            $forkProjectEntity->setCurrentTopicId($topicEntity->getId());
            $forkProjectEntity->setWorkspaceId($workspaceEntity->getId());
            $forkProjectEntity->setWorkDir($workDir);
            $this->projectDomainService->saveProjectEntity($forkProjectEntity);
            $this->logger->info(sprintf('项目%s已设置当前话题%s', $forkProjectEntity->getId(), $topicEntity->getId()));

            // Publish fork event for file migration
            $event = new ProjectForkEvent(
                $requestDTO->getSourceProjectId(),
                $forkProjectEntity->getId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $forkProjectRecordEntity->getId()
            );
            $publisher = new ProjectForkPublisher($event);
            $this->producer->produce($publisher);

            $this->logger->info(sprintf(
                'Published fork event, event ID: %s',
                $event->getEventId()
            ));

            Db::commit();

            return ForkProjectResponseDTO::fromEntity($forkProjectRecordEntity)->toArray();
        } catch (EventException $e) {
            Db::rollBack();
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_FORK_ACCESS_DENIED, $e->getMessage());
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Fork project failed, error: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            throw $e;
        }
    }

    /**
     * Check fork project status.
     */
    public function checkForkProjectStatus(RequestContext $requestContext, int $projectId): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Find fork record by fork project ID
        $projectFork = $this->projectDomainService->findByForkProjectId($projectId);
        if (! $projectFork) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        // Check if user has access to this fork
        if ($projectFork->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, trans('project.project_access_denied'));
        }

        return ForkStatusResponseDTO::fromEntity($projectFork)->toArray();
    }

    /**
     * Migrate project file (called by subscriber).
     */
    public function migrateProjectFile(ProjectForkEvent $event): void
    {
        $this->logger->info(sprintf(
            'Starting file migration for fork record ID: %d',
            $event->getForkRecordId()
        ));

        try {
            // Call file domain service to handle file migration
            $dataIsolation = DataIsolation::simpleMake($event->getOrganizationCode(), $event->getUserId());

            $sourceProjectEntity = $this->projectDomainService->getProjectNotUserId($event->getSourceProjectId());

            $forkProjectEntity = $this->projectDomainService->getProjectNotUserId($event->getForkProjectId());

            $forkProjectRecordEntity = $this->projectDomainService->getForkProjectRecordById($event->getForkRecordId());

            $this->taskFileDomainService->migrateProjectFile($dataIsolation, $sourceProjectEntity, $forkProjectEntity, $forkProjectRecordEntity);

            $this->logger->info(sprintf(
                'File migration batch completed for fork record ID: %d',
                $event->getForkRecordId()
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'File migration failed for fork record ID: %d, error: %s',
                $event->getForkRecordId(),
                $e->getMessage()
            ));
            throw $e;
        }
    }

    /**
     * Move project to another workspace.
     */
    public function moveProject(RequestContext $requestContext, MoveProjectRequestDTO $requestDTO): array
    {
        $this->logger->info('Starting project move process');

        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Validate target workspace exists and belongs to user
        $targetWorkspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getTargetWorkspaceId());
        if (empty($targetWorkspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
        }

        if ($targetWorkspaceEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
        }

        // Validate source project exists and belongs to user (only project owner can move)
        $sourceProjectEntity = $this->projectDomainService->getProject(
            $requestDTO->getSourceProjectId(),
            $dataIsolation->getCurrentUserId()
        );

        // Call domain service to handle the move
        $movedProjectEntity = $this->projectDomainService->moveProject(
            $requestDTO->getSourceProjectId(),
            $requestDTO->getTargetWorkspaceId(),
            $userAuthorization->getId()
        );

        $this->logger->info(sprintf(
            'Project moved successfully, project ID: %d, from workspace: %d to workspace: %d',
            $movedProjectEntity->getId(),
            $sourceProjectEntity->getWorkspaceId(),
            $requestDTO->getTargetWorkspaceId()
        ));

        return [
            'project_id' => (string) $movedProjectEntity->getId(),
        ];
    }

    /**
     * 获取项目附件列表的核心逻辑.
     */
    public function getProjectAttachmentList(DataIsolation $dataIsolation, GetProjectAttachmentsRequestDTO $requestDTO, string $workDir = ''): array
    {
        // 通过任务领域服务获取项目下的附件列表
        $result = $this->taskDomainService->getTaskAttachmentsByProjectId(
            (int) $requestDTO->getProjectId(),
            $dataIsolation,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getFileType(),
            StorageType::WORKSPACE->value,
        );

        // 处理文件 URL
        $list = [];
        $fileKeys = [];
        // 遍历附件列表，使用TaskFileItemDTO处理
        foreach ($result['list'] as $entity) {
            /**
             * @var TaskFileEntity $entity
             */
            // 创建DTO
            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) $entity->getFileId();
            $dto->taskId = (string) $entity->getTaskId();
            $dto->fileType = $entity->getFileType();
            $dto->fileName = $entity->getFileName();
            $dto->fileExtension = $entity->getFileExtension();
            $dto->fileKey = $entity->getFileKey();
            $dto->fileSize = $entity->getFileSize();
            $dto->isHidden = $entity->getIsHidden();
            $dto->updatedAt = $entity->getUpdatedAt();
            $dto->topicId = (string) $entity->getTopicId();
            $dto->relativeFilePath = WorkDirectoryUtil::getRelativeFilePath($entity->getFileKey(), $workDir);
            $dto->isDirectory = $entity->getIsDirectory();
            $dto->metadata = FileMetadataUtil::getMetadataObject($entity->getMetadata());
            // 添加 project_id 字段
            $dto->projectId = (string) $entity->getProjectId();
            // 设置排序字段
            $dto->sort = $entity->getSort();
            $dto->fileUrl = '';
            $dto->parentId = (string) $entity->getParentId();
            $dto->source = $entity->getSource();
            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
            // 判断file key是否重复，如果重复，则跳过
            // 如果根目录，也跳过
            if (in_array($fileKey, $fileKeys) || empty($entity->getParentId())) {
                continue;
            }
            $fileKeys[] = $fileKey;
            $list[] = $dto->toArray();
        }

        // 构建树状结构（登录用户模式特有功能）
        $tree = FileTreeUtil::assembleFilesTreeByParentId($list);

        if ($result['total'] > 3000) {
            $this->logger->error(sprintf('Project attachment list is too large, project ID: %d, total: %d', $requestDTO->getProjectId(), $result['total']));
        }

        return [
            'total' => $result['total'],
            'list' => $list,
            'tree' => $tree,
        ];
    }
}
