<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use DirectoryIterator;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAudioProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\GetAudioProjectListRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\ImportAudioFilesRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\UpdateAudioProjectTagsRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Response\AudioProjectExtraDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Response\AudioProjectListResponseDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\ProjectForkPublisher;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\HiddenType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ForkProjectStartEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectForkEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectHiddenStatusUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectsBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectsBatchMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AudioProjectDomainService;
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
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchDeleteProjectsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchMoveProjectsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ForkProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\MoveProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\BatchDeleteProjectsResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\BatchDeleteResultItemDTO;
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
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * 项目应用服务
 */
class ProjectAppService extends AbstractAppService
{
    /**
     * 每个工作区最多预启动的隐藏项目数量.
     */
    private const MAX_HIDDEN_PROJECTS_PER_WORKSPACE = 3;

    protected LoggerInterface $logger;

    public function __construct(
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly PackageFilterInterface $packageFilterService,
        private readonly AudioProjectDomainService $audioProjectDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 创建或复用项目（带预启动复用逻辑）.
     * 检查是否存在预启动的隐藏项目，如果存在则复用，否则创建新项目.
     */
    public function createOrReuseProject(RequestContext $requestContext, CreateProjectRequestDTO $requestDTO): array
    {
        $this->logger->info('开始创建或复用项目');

        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Check if workspace exists
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getWorkspaceId());
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
        }

        // Validate workspace ownership
        if ($workspaceEntity->getUserId() !== $dataIsolation->getCurrentUserId()
            || $workspaceEntity->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
        }

        // 如果传递了 workdir，则使用 workdir 中的项目 ID，不使用预启动项目
        if (! empty($requestDTO->getWorkdir())) {
            $this->logger->info(sprintf('请求中传递了 workdir=%s，将使用 workdir 中的项目 ID，跳过预启动项目复用', $requestDTO->getWorkdir()));
            return $this->createProject($requestContext, $requestDTO);
        }

        // 检查是否存在预启动的隐藏项目池
        $existingHiddenProjects = $this->projectDomainService->findAllHiddenProjectsByWorkspaceAndUser(
            $requestDTO->getWorkspaceId(),
            $dataIsolation->getCurrentUserId(),
            HiddenType::PRE_WARM->value
        );

        // 如果存在隐藏项目，取 ID 最小的项目直接复用（后续对话会保证项目就绪，无需在此检查工作区状态）
        if (! empty($existingHiddenProjects)) {
            // 列表已按 created_at asc 排序，第一个即为 ID 最小的项目
            $existingHiddenProject = $existingHiddenProjects[0];

            $this->logger->info(sprintf(
                '发现预启动隐藏项目池（共%d个），将复用 ID 最小的隐藏项目, projectId=%d',
                count($existingHiddenProjects),
                $existingHiddenProject->getId()
            ));

            // 获取复用的项目和话题实体
            $result = $this->reuseHiddenProject(
                $requestContext,
                $requestDTO,
                $existingHiddenProject,
                $workspaceEntity,
                $dataIsolation
            );

            // 将复用的实体传给 createProject 方法，走统一流程
            $projectResult = $this->createProject(
                $requestContext,
                $requestDTO,
                $result['projectEntity'],
                $result['topicEntity']
            );

            // 添加复用标记
            $projectResult['project']['is_reused'] = true;
            $projectResult['topic']['is_reused'] = true;

            return $projectResult;
        }

        // 否则创建新项目（不传入实体参数）
        $this->logger->info('未发现预启动隐藏项目，将创建新项目');
        return $this->createProject($requestContext, $requestDTO);
    }

    /**
     * 创建项目（统一的处理流程）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param CreateProjectRequestDTO $requestDTO 创建项目请求DTO
     * @param null|ProjectEntity $projectEntity 可选的项目实体（复用场景传入）
     * @param null|TopicEntity $topicEntity 可选的话题实体（复用场景传入）
     * @return array 返回格式：['project' => array, 'topic' => array]
     */
    public function createProject(
        RequestContext $requestContext,
        CreateProjectRequestDTO $requestDTO,
        ?ProjectEntity $projectEntity = null,
        ?TopicEntity $topicEntity = null
    ): array {
        $this->logger->info('开始初始化用户项目');
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Validate workspace access
        $workspaceEntity = $this->validateWorkspaceAccess($dataIsolation, $requestDTO->getWorkspaceId());

        // Extract project ID from work directory (for migration scenarios)
        $projectId = $this->extractProjectIdFromWorkDir($dataIsolation, $requestDTO->getWorkDir());

        Db::beginTransaction();
        try {
            // 1. Create project entity
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

            // Standard initialization flow (steps 2-6 + 8)
            $topicEntity = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity);

            // 7. Initialize project root directory or bind files
            if ($requestDTO->getFiles()) {
                $this->taskFileDomainService->bindProjectFiles(
                    $dataIsolation,
                    $projectEntity,
                    $requestDTO->getFiles(),
                    $projectEntity->getWorkDir()
                );
            } else {
                $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $projectEntity->getId(),
                    workDir: $projectEntity->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                );
            }

            Db::commit();

            // Dispatch project created event
            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            return [
                'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray(),
            ];
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

        // 获取项目信息
        $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getId(), $dataIsolation->getCurrentUserId());

        if (! is_null($requestDTO->getProjectName())) {
            $projectEntity->setProjectName($requestDTO->getProjectName());
        }
        if (! is_null($requestDTO->getProjectDescription())) {
            $projectEntity->setProjectDescription($requestDTO->getProjectDescription());
        }
        if (! is_null($requestDTO->getWorkspaceId())) {
            // 检查话题是否存在
            $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($requestDTO->getWorkspaceId());
            if (empty($workspaceEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
            }
            $projectEntity->setWorkspaceId($requestDTO->getWorkspaceId());
        }
        if (! is_null($requestDTO->getIsCollaborationEnabled())) {
            $projectEntity->setIsCollaborationEnabled($requestDTO->getIsCollaborationEnabled());
        }
        if (! is_null($requestDTO->getDefaultJoinPermission())) {
            $projectEntity->setDefaultJoinPermission(MemberRole::validatePermissionLevel($requestDTO->getDefaultJoinPermission()));
        }

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
        $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());

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
     * Batch delete projects.
     */
    public function batchDeleteProjects(
        RequestContext $requestContext,
        BatchDeleteProjectsRequestDTO $requestDTO
    ): BatchDeleteProjectsResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userId = $dataIsolation->getCurrentUserId();
        $orgCode = $dataIsolation->getCurrentOrganizationCode();

        // Convert to int and remove duplicates
        $projectIds = array_unique(array_map('intval', $requestDTO->getProjectIds()));
        $results = [];
        $deletedProjects = [];

        // Batch fetch projects (already filtered by userId and orgCode)
        $projectMap = [];
        foreach ($this->projectDomainService->getProjectsWithAuth($projectIds, $userId, $orgCode) as $entity) {
            $projectMap[$entity->getId()] = $entity;
        }

        // Process each project deletion
        foreach ($projectIds as $projectId) {
            if (! isset($projectMap[$projectId])) {
                $results[] = new BatchDeleteResultItemDTO($projectId, false, 'PROJECT_NOT_FOUND', 'Project not found');
                continue;
            }

            try {
                // All database operations in transaction for consistency
                Db::transaction(function () use ($projectId, $userId, $dataIsolation, $orgCode) {
                    // Delete project and members
                    $this->projectDomainService->deleteProject($projectId, $userId);
                    $this->projectMemberDomainService->deleteByProjectId($projectId);

                    // Delete topics
                    $this->topicDomainService->deleteTopicsByProjectId($dataIsolation, $projectId);

                    // Delete long-term memories
                    $this->longTermMemoryDomainService->deleteMemoriesByProjectIds(
                        $orgCode,
                        AgentConstant::SUPER_MAGIC_CODE,
                        $userId,
                        [(string) $projectId]
                    );
                });

                $deletedProjects[] = $projectMap[$projectId];
                $results[] = new BatchDeleteResultItemDTO($projectId, true);
            } catch (Throwable $e) {
                $this->logger->error('Batch delete project failed', ['id' => $projectId, 'error' => $e->getMessage()]);
                $results[] = new BatchDeleteResultItemDTO($projectId, false, 'DELETE_FAILED', $e->getMessage());
            }
        }

        // Post-transaction operations (event dispatch and message queue)
        if (! empty($deletedProjects)) {
            $deletedIds = [];
            try {
                $deletedIds = array_map(fn ($p) => $p->getId(), $deletedProjects);

                // Dispatch batch deleted event
                $this->eventDispatcher->dispatch(new ProjectsBatchDeletedEvent($deletedProjects, $userAuthorization));

                // Stop running tasks via message queue
                foreach ($deletedIds as $projectId) {
                    $event = new StopRunningTaskEvent(
                        DeleteDataType::PROJECT,
                        $projectId,
                        $userId,
                        $orgCode,
                        '项目已被批量删除'
                    );
                    $this->producer->produce(new StopRunningTaskPublisher($event));
                }
            } catch (Throwable $e) {
                $this->logger->error('Post-delete operations failed', ['ids' => $deletedIds, 'error' => $e->getMessage()]);
            }
        }

        $successCount = count($deletedProjects);
        return new BatchDeleteProjectsResponseDTO(count($results), $successCount, count($results) - $successCount, $results);
    }

    /**
     * 获取项目详情.
     */
    public function getProjectInfo(RequestContext $requestContext, int $projectId): ProjectEntity
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        $project = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 如果当前组织未付费套餐，则禁止项目协作
        if (! $this->packageFilterService->isPaidSubscription($project->getUserOrganizationCode())) {
            $project->setIsCollaborationEnabled(false);
        }

        return $project;
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
     * 获取项目附件列表 V2（登录用户模式，不返回树状结构，支持时间过滤）.
     */
    public function getProjectAttachmentsV2(RequestContext $requestContext, GetProjectAttachmentsV2RequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 验证项目存在性和所有权
        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 创建基于用户的数据隔离
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取附件列表，不返回树状结构，不使用 storage_type 过滤
        return $this->getProjectAttachmentListV2($dataIsolation, $requestDTO, $projectEntity->getWorkDir() ?? '');
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
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $shareEntity->getProjectId());
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

    /**
     * 通过访问令牌获取项目附件列表 V2（不返回树状结构）.
     */
    public function getProjectAttachmentsByAccessTokenV2(GetProjectAttachmentsV2RequestDTO $requestDto): array
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

        // 令牌模式不需要workDir处理，传空字符串，V2 不返回树状结构
        return $this->getProjectAttachmentListV2($dataIsolation, $requestDto, $workDir);
    }

    public function getCloudFiles(RequestContext $requestContext, int $projectId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $projectEntity = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
        return $this->taskFileDomainService->getProjectFilesFromCloudStorage($dataIsolation->getCurrentOrganizationCode(), $projectEntity->getWorkDir());
    }

    /**
     * Get user role in project, including department membership.
     *
     * Performance optimization:
     * 1. First check direct user membership (fast path, single table query with index)
     * 2. If not found and organizationCode provided, check department membership
     * 3. Return the highest priority role if multiple roles exist
     *
     * @param int $projectId Project ID
     * @param string $userId User ID
     * @param null|string $organizationCode Organization code (optional, required for department check)
     * @return string User role value (empty string if not found)
     */
    public function getProjectRoleByUserId(int $projectId, string $userId, ?string $organizationCode = null): string
    {
        // Step 1: Check direct user membership (fast path - single table query with index)
        $projectMemberEntity = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $userId);

        $roles = [];
        if ($projectMemberEntity) {
            $roles[] = $projectMemberEntity->getRole();
        }

        // Step 2: Check department membership if organizationCode provided and no direct membership found
        // Note: Even if direct membership exists, we still check departments to find the highest priority role
        if ($organizationCode !== null) {
            $dataIsolation = DataIsolation::create($organizationCode, $userId);

            // Get user's department IDs (including parent departments) - this has 60s cache
            $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

            if (! empty($departmentIds)) {
                // Get project members for these departments
                $departmentMemberEntities = $this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

                foreach ($departmentMemberEntities as $departmentMemberEntity) {
                    $roles[] = $departmentMemberEntity->getRole();
                }
            }
        }

        // Step 3: Return the highest priority role
        if (empty($roles)) {
            return '';
        }

        // Find the role with highest permission level
        $highestRole = $roles[0];
        foreach ($roles as $role) {
            if ($role->getPermissionLevel() > $highestRole->getPermissionLevel()) {
                $highestRole = $role;
            }
        }

        return $highestRole->getValue();
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

        // Validate fork permission
        $this->validateForkPermission($requestDTO->getSourceProjectId());

        // Get user authorization and create data isolation
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Validate target workspace access
        $workspaceEntity = $this->validateWorkspaceAccess($dataIsolation, $requestDTO->getTargetWorkspaceId());

        Db::beginTransaction();
        try {
            // Dispatch fork start check event
            AsyncEventUtil::dispatch(new ForkProjectStartEvent(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));
            $this->logger->info(sprintf(
                'Dispatched fork project start event, organization: %s, user: %s',
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));

            // 1. Create fork record and project
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

            // Standard initialization flow (steps 2-6 + 8)
            $this->initializeProject($dataIsolation, $workspaceEntity, $forkProjectEntity);

            // 7. Skip root directory initialization (fork uses async file migration)

            // Publish fork event for async file migration
            $event = new ProjectForkEvent(
                $requestDTO->getSourceProjectId(),
                $forkProjectEntity->getId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $forkProjectRecordEntity->getId()
            );
            $publisher = new ProjectForkPublisher($event);
            $this->producer->produce($publisher);
            $this->logger->info(sprintf('Published fork event, event ID: %s', $event->getEventId()));

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

            $this->taskFileDomainService->migrateProjectFile($dataIsolation, $sourceProjectEntity, $forkProjectEntity, $forkProjectRecordEntity, $event->getFileIds());

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

        // Get target workspace ID (null means no workspace)
        $targetWorkspaceId = $requestDTO->getTargetWorkspaceId();

        // Validate target workspace if not moving to no workspace
        if (! $requestDTO->isMovingToNoWorkspace()) {
            $targetWorkspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($targetWorkspaceId);
            if (empty($targetWorkspaceEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
            }

            if ($targetWorkspaceEntity->getUserId() !== $userAuthorization->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
            }
        } else {
            $this->logger->info('Moving project to no workspace (workspace_id will be null)');
        }

        // Validate source project exists and belongs to user (only project owner can move)
        $sourceProjectEntity = $this->projectDomainService->getProject(
            $requestDTO->getSourceProjectId(),
            $dataIsolation->getCurrentUserId()
        );

        // Call domain service to handle the move
        $movedProjectEntity = $this->projectDomainService->moveProject(
            $requestDTO->getSourceProjectId(),
            $targetWorkspaceId,
            $userAuthorization->getId()
        );

        $this->logger->info(sprintf(
            'Project moved successfully, project ID: %d, from workspace: %s to workspace: %s',
            $movedProjectEntity->getId(),
            $sourceProjectEntity->getWorkspaceId() ?? 'null',
            $targetWorkspaceId ?? 'null'
        ));

        if ($sourceProjectEntity->getWorkspaceId() !== $targetWorkspaceId) {
            // Dispatch project moved event
            $this->eventDispatcher->dispatch(new ProjectMovedEvent($movedProjectEntity, $userAuthorization));
        }

        return [
            'project_id' => (string) $movedProjectEntity->getId(),
        ];
    }

    /**
     * Batch move projects to target workspace.
     */
    public function batchMoveProjects(RequestContext $requestContext, BatchMoveProjectsRequestDTO $requestDTO): array
    {
        $this->logger->info('Starting batch project move process', [
            'project_count' => count($requestDTO->getProjectIds()),
        ]);

        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // Get target workspace ID (null means no workspace)
        $targetWorkspaceId = $requestDTO->getTargetWorkspaceId();

        // Step 1: Validate target workspace if not moving to no workspace
        if (! $requestDTO->isMovingToNoWorkspace()) {
            $targetWorkspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($targetWorkspaceId);
            if (empty($targetWorkspaceEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
            }

            if ($targetWorkspaceEntity->getUserId() !== $userId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
            }
        } else {
            $this->logger->info('Batch moving projects to no workspace (workspace_id will be null)');
        }

        // Step 2: Batch query projects and filter by user_id (permission check)
        $projectEntities = $this->projectRepository->findByUserIdAndIds(
            $requestDTO->getProjectIds(),
            $userId
        );

        if (empty($projectEntities)) {
            return [
                'total' => 0,
                'success' => 0,
                'failed' => count($requestDTO->getProjectIds()),
                'results' => array_map(function ($projectId) {
                    return [
                        'project_id' => $projectId,
                        'success' => false,
                        'message' => 'Project not found or access denied',
                    ];
                }, $requestDTO->getProjectIds()),
            ];
        }

        // Step 3: Separate valid and invalid projects
        $projectMap = [];
        foreach ($projectEntities as $entity) {
            $projectMap[(string) $entity->getId()] = $entity;
        }

        $validProjectIds = [];
        $invalidResults = [];

        foreach ($requestDTO->getProjectIds() as $projectId) {
            if (isset($projectMap[$projectId])) {
                $project = $projectMap[$projectId];
                // Check if project is already in target workspace
                if ($project->getWorkspaceId() === $targetWorkspaceId) {
                    $invalidResults[] = [
                        'project_id' => $projectId,
                        'success' => false,
                        'message' => 'Project is already in target workspace',
                    ];
                } else {
                    $validProjectIds[] = (int) $projectId;
                }
            } else {
                $invalidResults[] = [
                    'project_id' => $projectId,
                    'success' => false,
                    'message' => 'Project not found or access denied',
                ];
            }
        }

        // Step 4: Perform batch move in single transaction
        $now = date('Y-m-d H:i:s');
        $successResults = [];

        if (! empty($validProjectIds)) {
            try {
                $successResults = Db::transaction(function () use ($validProjectIds, $targetWorkspaceId, $now) {
                    // Step 4.1: Batch update projects (1 query)
                    $updatedCount = $this->projectRepository->batchUpdateWorkspace(
                        $validProjectIds,
                        $targetWorkspaceId,
                        $now
                    );

                    $this->logger->info('Batch updated projects workspace', [
                        'updated_count' => $updatedCount,
                    ]);

                    // Step 4.2: Batch update topics (1 query)
                    $topicUpdatedCount = $this->topicDomainService->batchUpdateWorkspaceByProjects(
                        $validProjectIds,
                        $targetWorkspaceId,
                        $now
                    );

                    $this->logger->info('Batch updated topics workspace', [
                        'updated_count' => $topicUpdatedCount,
                    ]);

                    // Step 4.3: Build success results
                    $results = [];
                    foreach ($validProjectIds as $projectId) {
                        $projectIdStr = (string) $projectId;
                        $results[] = [
                            'project_id' => $projectIdStr,
                            'success' => true,
                            'message' => 'Project moved successfully',
                        ];
                    }

                    return $results;
                });
            } catch (Throwable $e) {
                $this->logger->error('Batch move projects transaction failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                // Mark all valid projects as failed
                foreach ($validProjectIds as $projectId) {
                    $invalidResults[] = [
                        'project_id' => (string) $projectId,
                        'success' => false,
                        'message' => 'Failed to move project: ' . $e->getMessage(),
                    ];
                }
                $successResults = [];
            }
        }

        // Step 6: Merge results
        $allResults = array_merge($successResults, $invalidResults);

        $totalCount = count($requestDTO->getProjectIds());
        $successCount = count($successResults);
        $failedCount = count($invalidResults);

        $this->logger->info('Batch project move completed', [
            'total' => $totalCount,
            'success' => $successCount,
            'failed' => $failedCount,
        ]);

        if ($successCount > 0) {
            $movedProjects = [];
            foreach ($validProjectIds as $projectId) {
                $projectKey = (string) $projectId;
                if (isset($projectMap[$projectKey])) {
                    $movedProjects[] = $projectMap[$projectKey];
                }
            }

            if (! empty($movedProjects)) {
                // Dispatch batch moved event
                $this->eventDispatcher->dispatch(new ProjectsBatchMovedEvent($movedProjects, $userAuthorization));
            }
        }

        return [
            'total' => $totalCount,
            'success' => $successCount,
            'failed' => $failedCount,
            'results' => $allResults,
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

        // Build tree structure with VS Code-style sorting (always use zh_CN for pinyin sorting)
        $tree = FileTreeUtil::assembleFilesTreeByParentId($list, 'zh_CN');

        if ($result['total'] > 3000) {
            $this->logger->error(sprintf('Project attachment list is too large, project ID: %d, total: %d', $requestDTO->getProjectId(), $result['total']));
        }

        return [
            'total' => $result['total'],
            'list' => $list,
            'tree' => $tree,
        ];
    }

    /**
     * 获取项目附件列表的核心逻辑 V2（不返回树状结构，支持数据库级别的更新时间过滤）.
     */
    public function getProjectAttachmentListV2(DataIsolation $dataIsolation, GetProjectAttachmentsV2RequestDTO $requestDTO, string $workDir = ''): array
    {
        // 通过任务领域服务获取项目下的附件列表，使用数据库级别的时间过滤
        $result = $this->taskDomainService->getTaskAttachmentsByProjectId(
            (int) $requestDTO->getProjectId(),
            $dataIsolation,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getFileType(),
            StorageType::WORKSPACE->value,  // V2 固定使用 workspace 存储类型
            $requestDTO->getUpdatedAfter()  // 数据库级别的时间过滤
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

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * 确保隐藏项目存在（如果不存在则创建）.
     * 用于沙箱预启动等场景，每个用户在每个工作区只能有一个指定类型的隐藏项目.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $workspaceId 工作区ID
     * @param int $hiddenType 隐藏类型（HiddenType枚举的值）
     * @return ProjectEntity 返回隐藏项目实体
     */
    public function ensureHiddenProject(
        RequestContext $requestContext,
        int $workspaceId,
        int $hiddenType
    ): ProjectEntity {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 查找该工作区下所有已存在的隐藏项目
        $existingProjects = $this->projectDomainService->findAllHiddenProjectsByWorkspaceAndUser(
            $workspaceId,
            $userId,
            $hiddenType
        );

        $existingCount = count($existingProjects);

        // 如果已有隐藏项目数量达到上限，返回最早创建的一个
        if ($existingCount >= self::MAX_HIDDEN_PROJECTS_PER_WORKSPACE) {
            $project = $existingProjects[0]; // 已按创建时间排序，取第一个
            $this->logger->info(sprintf(
                '隐藏项目池已满（%d/%d），返回最早创建的隐藏项目, workspaceId=%d, userId=%s, hiddenType=%d, projectId=%d',
                $existingCount,
                self::MAX_HIDDEN_PROJECTS_PER_WORKSPACE,
                $workspaceId,
                $userId,
                $hiddenType,
                $project->getId()
            ));
            return $project;
        }

        // 未达到上限，创建新的隐藏项目
        $this->logger->info(sprintf(
            '创建新的隐藏项目（当前%d/%d）, workspaceId=%d, userId=%s, hiddenType=%d',
            $existingCount,
            self::MAX_HIDDEN_PROJECTS_PER_WORKSPACE,
            $workspaceId,
            $userId,
            $hiddenType
        ));

        // 创建隐藏项目（不创建默认话题，因为会在后续单独创建）
        $projectEntity = $this->projectDomainService->createProject(
            workspaceId: $workspaceId,
            projectName: '', // 隐藏项目名称为空
            userId: $userId,
            userOrganizationCode: $organizationCode,
            projectId: '',
            workDir: '', // 工作目录稍后设置
            projectMode: null,
            source: CreationSource::SYSTEM_CREATED->value, // 系统创建
            isHidden: true,
            hiddenType: $hiddenType
        );

        // 设置工作目录
        $workDir = WorkDirectoryUtil::getWorkDir($userId, $projectEntity->getId());
        $projectEntity->setWorkDir($workDir);
        $this->projectDomainService->saveProjectEntity($projectEntity);

        // 初始化项目根目录文件
        $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            projectId: $projectEntity->getId(),
            workDir: $workDir,
            userId: $userId,
            organizationCode: $organizationCode,
            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
        );

        // 注意：不在预启动时初始化项目成员和设置
        // 这些初始化会在 /api/v1/super-agent/projects 接口复用或创建项目时统一处理
        // 避免重复插入导致唯一键冲突

        $this->logger->info(sprintf(
            '隐藏项目创建成功（仅项目本身，不含成员和设置）, projectId=%d, workDir=%s',
            $projectEntity->getId(),
            $workDir
        ));

        return $projectEntity;
    }

    // ========================================
    // Agent Project Methods
    // ========================================
    public function createAgentProject(RequestContext $requestContext, CreateAgentProjectRequestDTO $requestDTO)
    {
        $this->logger->info('Starting agent project creation');

        // Get user authorization and create data isolation
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        Db::beginTransaction();
        try {
            // 1. Create project entity (audio mode)
            $this->logger->info('Creating core project for audio');
            $projectEntity = $this->projectDomainService->createProject(
                0,
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '',
                '',
                ProjectMode::CUSTOM_AGENT->value,
                CreationSource::USER_CREATED->value,
                true,
                HiddenType::AGENT->value
            );
            $this->logger->info(sprintf('Created core project, projectId=%s', $projectEntity->getId()));

            // Standard initialization flow (steps 2-6 + 8) - workspace can be null for audio projects
            $topicEntity = $this->initializeProject($dataIsolation, null, $projectEntity);

            // 2. Initialize root directory and upload custom agent template files
            $this->initCustomTemplateFiles($projectEntity, $dataIsolation);

            Db::commit();

            // Dispatch project created event
            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            // Build project DTO with extra audio info
            $projectDTO = ProjectItemDTO::fromEntity($projectEntity);
            $projectArray = $projectDTO->toArray();

            return [
                'project' => $projectArray,
                'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray(),
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Create Agent Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, trans('project.create_project_failed'));
        }
    }

    // ========================================
    // Audio Project Methods
    // ========================================

    /**
     * Create audio project (including core project + audio extension).
     */
    public function createAudioProject(
        RequestContext $requestContext,
        CreateAudioProjectRequestDTO $requestDTO
    ): array {
        $this->logger->info('Starting audio project creation');

        // Get user authorization and create data isolation
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Validate workspace access and type (if workspace_id is provided)
        $workspaceEntity = null;
        if (! empty($requestDTO->getWorkspaceId())) {
            $workspaceEntity = $this->validateWorkspaceAccess($dataIsolation, (int) $requestDTO->getWorkspaceId());
            $this->validateWorkspaceType($workspaceEntity, WorkspaceType::Audio, (int) $requestDTO->getWorkspaceId());
        }

        Db::beginTransaction();
        try {
            // 1. Create project entity (audio mode)
            $this->logger->info('Creating core project for audio');
            $projectEntity = $this->projectDomainService->createProject(
                $workspaceEntity?->getId() ?? 0,
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '',
                '',
                ProjectMode::AUDIO->value,
                CreationSource::USER_CREATED->value,
                $requestDTO->getIsHidden(),
                null
            );
            $this->logger->info(sprintf('Created core project, projectId=%s', $projectEntity->getId()));

            // Standard initialization flow (steps 2-6 + 8) - workspace can be null for audio projects
            $topicEntity = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity);

            // 7. Initialize project root directory (audio project only creates root)
            $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                projectId: $projectEntity->getId(),
                workDir: $projectEntity->getWorkDir(),
                userId: $dataIsolation->getCurrentUserId(),
                organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            );

            // Post-process: Create audio extension with auto-summary configuration
            $this->logger->info('Creating audio project extension');
            $audioProjectEntity = $this->audioProjectDomainService->createAudioProject(
                projectId: $projectEntity->getId(),
                source: $requestDTO->getSource(),
                deviceId: $requestDTO->getDeviceId() ?: null,
                autoSummary: $requestDTO->getAutoSummary(),
                taskKey: $requestDTO->getTaskKey(),
                modelId: $requestDTO->getModelId() ?: null,
                topicId: $topicEntity->getId(),
                audioSource: $requestDTO->getAudioSource()
            );
            $this->logger->info(sprintf('Created audio extension, audioProjectId=%s', $audioProjectEntity->getId()));

            Db::commit();

            // Dispatch project created event
            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            // Build project DTO with extra audio info
            $projectDTO = ProjectItemDTO::fromEntity($projectEntity);
            $projectArray = $projectDTO->toArray();
            $projectArray['extra'] = AudioProjectExtraDTO::fromEntity($audioProjectEntity)->toArray();

            return [
                'project' => $projectArray,
                'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray(),
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Create Audio Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, trans('project.create_project_failed'));
        }
    }

    /**
     * Get audio project list with filters.
     *
     * Following DDD principles: Application Layer delegates to Domain Layer.
     */
    public function getAudioProjectList(
        RequestContext $requestContext,
        GetAudioProjectListRequestDTO $requestDTO
    ): array {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $filters = [
            'project_ids' => $requestDTO->getProjectIds(),
            'current_phase' => $requestDTO->getCurrentPhase(),
            'source' => $requestDTO->getSource(),
            'device_id' => $requestDTO->getDeviceId(),
            'keyword' => $requestDTO->getKeyword(),
            'created_at_start' => $requestDTO->getCreatedAtStartFormatted(),
            'created_at_end' => $requestDTO->getCreatedAtEndFormatted(),
            'is_hidden' => $requestDTO->getIsHidden(),
        ];

        // Handle workspace_id filtering based on special values:
        // '-1' = Get all (no filter applied)
        // ''   = Get ungrouped (workspace_id IS NULL)
        // other = Get specific workspace (workspace_id = value)
        $workspaceId = $requestDTO->getWorkspaceId();
        if ($workspaceId === '') {
            // Empty string: get ungrouped projects (workspace_id IS NULL)
            $filters['workspace_id'] = null;
        } elseif ($workspaceId !== '-1') {
            // Specific workspace ID: filter by exact match
            // '-1' is special value for "all projects", so we skip adding filter
            $filters['workspace_id'] = $workspaceId;
        }
        // If $workspaceId === '-1', don't add workspace_id to filters (get all)

        // Get data from repository (returns datetime format)
        $result = $this->audioProjectDomainService->getAudioProjectsWithFilters(
            userId: $dataIsolation->getCurrentUserId(),
            orgCode: $dataIsolation->getCurrentOrganizationCode(),
            filters: $filters,
            page: $requestDTO->getPage(),
            pageSize: $requestDTO->getPageSize(),
            sortBy: $requestDTO->getSortBy(),
            sortOrder: $requestDTO->getSortOrder()
        );

        // Use Response DTO to transform data (datetime → timestamp)
        $responseDTO = AudioProjectListResponseDTO::fromRepositoryResult($result);

        return $responseDTO->toArray();
    }

    /**
     * Get ungrouped audio projects count.
     *
     * @param RequestContext $requestContext Request context
     * @return int Count of ungrouped audio projects
     */
    public function getUngroupedAudioProjectCount(RequestContext $requestContext): int
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Delegate to domain service with cache
        return $this->projectDomainService->countUngroupedProjectsByMode(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            ProjectMode::AUDIO
        );
    }

    /**
     * Update audio project summary status.
     */
    public function updateAudioProjectSummaryStatus(
        RequestContext $requestContext,
        int $projectId,
        int $status
    ): void {
        // Verify project ownership
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project || $project->getUserId() !== $requestContext->getUserId()) {
            throw new RuntimeException('Project not found or access denied');
        }

        // Get audio project entity
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
        if ($audioProject === null) {
            throw new RuntimeException('Audio project extension not found');
        }

        // Map old status codes to entity methods
        match ($status) {
            1 => $audioProject->completeSummarizingPhase(),
            2 => $audioProject->startSummarizingPhase(),
            3 => $audioProject->failSummarizingPhase('Manual failure'),
            default => throw new RuntimeException("Invalid status: {$status}"),
        };

        // Save changes
        $this->audioProjectDomainService->save($audioProject);
    }

    /**
     * Mark audio project as completed.
     */
    public function markAudioProjectAsCompleted(RequestContext $requestContext, int $projectId): void
    {
        $this->updateAudioProjectSummaryStatus($requestContext, $projectId, 1);
    }

    /**
     * Mark audio project as in progress.
     */
    public function markAudioProjectAsInProgress(RequestContext $requestContext, int $projectId): void
    {
        $this->updateAudioProjectSummaryStatus($requestContext, $projectId, 2);
    }

    /**
     * Mark audio project as failed.
     */
    public function markAudioProjectAsFailed(RequestContext $requestContext, int $projectId): void
    {
        $this->updateAudioProjectSummaryStatus($requestContext, $projectId, 3);
    }

    /**
     * Update audio project recording duration and file size.
     */
    public function updateAudioRecordingDuration(
        RequestContext $requestContext,
        int $projectId,
        int $duration,
        int $fileSize
    ): void {
        // Verify project ownership
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project || $project->getUserId() !== $requestContext->getUserId()) {
            throw new RuntimeException('Project not found or access denied');
        }

        // Get audio project
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
        if (! $audioProject) {
            throw new RuntimeException('Audio project extension not found');
        }

        // Update duration and file size
        $this->audioProjectDomainService->updateRecordingDuration($audioProject, $duration, $fileSize);
    }

    /**
     * Update audio project tags.
     */
    public function updateAudioProjectTags(
        RequestContext $requestContext,
        int $projectId,
        UpdateAudioProjectTagsRequestDTO $requestDTO
    ): void {
        // Verify project ownership
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project || $project->getUserId() !== $requestContext->getUserId()) {
            throw new RuntimeException('Project not found or access denied');
        }

        // Get audio project
        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
        if (! $audioProject) {
            throw new RuntimeException('Audio project extension not found');
        }

        // Update tags
        $this->audioProjectDomainService->updateTags($projectId, $requestDTO->getTags());
    }

    /**
     * Import existing audio files to project.
     */
    public function importAudioFiles(
        RequestContext $requestContext,
        ImportAudioFilesRequestDTO $requestDTO
    ): array {
        $this->logger->info('Starting import audio files to project');

        // Get user authorization and create data isolation
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $projectId = (int) $requestDTO->getProjectId();

        // Verify project access with editor permission
        $projectEntity = $this->getAccessibleProjectWithEditor(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        // Verify project is audio type
        if ($projectEntity->getProjectMode() !== ProjectMode::AUDIO->value) {
            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('super_agent.invalid_project_mode_for_audio_import'),
                ['project_id' => $projectId, 'expected_mode' => ProjectMode::AUDIO->value]
            );
        }

        Db::beginTransaction();
        try {
            // ===== Step 1: Get audio project and start merging phase =====
            $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
            if ($audioProject !== null) {
                $audioProject->startMergingPhase();
                $this->audioProjectDomainService->save($audioProject);
                $this->logger->info('Audio project merging phase started', [
                    'project_id' => $projectId,
                    'phase' => 'merging',
                    'status' => 'in_progress',
                ]);
            }

            $files = $requestDTO->getFiles();
            $savedFileIds = [];

            // ===== Step 2: Save files to task_file table =====
            $this->logger->info(sprintf('Saving %d files to task_file table', count($files)));
            foreach ($files as $fileData) {
                try {
                    // Validate basic parameters
                    if (empty($fileData['file_key']) || empty($fileData['file_name'])) {
                        $this->logger->warning('Skipping file with missing key or name', $fileData);
                        continue;
                    }

                    // Create task file entity
                    $taskFileEntity = new TaskFileEntity();
                    $taskFileEntity->setProjectId($projectId);
                    $taskFileEntity->setTopicId(0);
                    $taskFileEntity->setTaskId(0);
                    $taskFileEntity->setFileKey($fileData['file_key']);
                    $taskFileEntity->setFileName($fileData['file_name']);
                    $taskFileEntity->setFileSize((int) $fileData['file_size']);
                    $taskFileEntity->setFileType(FileType::USER_UPLOAD->value);
                    $taskFileEntity->setStorageType(StorageType::WORKSPACE->value);
                    $taskFileEntity->setSource(TaskFileSource::PROJECT_DIRECTORY->value);
                    $taskFileEntity->setParentId(! empty($requestDTO->getParentId()) ? (int) $requestDTO->getParentId() : 0);
                    $taskFileEntity->setIsDirectory(false);
                    $taskFileEntity->setIsHidden(false);

                    // Save file
                    $savedEntity = $this->taskFileDomainService->saveProjectFile(
                        $dataIsolation,
                        $projectEntity,
                        $taskFileEntity,
                        StorageType::WORKSPACE->value
                    );

                    $savedFileIds[] = (string) $savedEntity->getFileId();

                    $this->logger->info(sprintf(
                        'Saved file: %s, fileId=%d',
                        $fileData['file_name'],
                        $savedEntity->getFileId()
                    ));
                } catch (Throwable $e) {
                    $this->logger->warning(sprintf(
                        'Single file save failed: %s, Error: %s',
                        $fileData['file_key'] ?? 'unknown',
                        $e->getMessage()
                    ));
                    // Continue processing other files
                }
            }

            // ===== Step 3: Update project hidden status to false =====
            $this->logger->info('Updating project hidden status to false');
            $hiddenStatusUpdated = $this->projectDomainService->updateHiddenStatus($projectId, false);
            if ($hiddenStatusUpdated) {
                $this->eventDispatcher->dispatch(new ProjectHiddenStatusUpdatedEvent(
                    $projectId,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $projectEntity->getProjectMode(),
                    false
                ));
            }

            // ===== Step 4: Update audio project metadata =====
            // Temporarily get duration and file_size from the first file
            $firstFile = $files[0] ?? null;
            if ($firstFile) {
                $duration = $firstFile['duration'] ?? null;
                $fileSize = $firstFile['file_size'] ?? null;
                // Get first saved file ID for audio_file_id
                $audioFileId = ! empty($savedFileIds) ? (int) $savedFileIds[0] : null;

                $this->logger->info(sprintf(
                    'Updating audio project metadata: duration=%s, fileSize=%s, audioSource=imported, audioFileId=%s (from first file)',
                    $duration ?? 'null',
                    $fileSize ?? 'null',
                    $audioFileId ?? 'null'
                ));

                $this->audioProjectDomainService->updateRecordingMetadata(
                    $projectId,
                    $duration,
                    $fileSize,
                    'imported',
                    $audioFileId
                );
            }

            // ===== Step 5: Complete merging phase =====
            if ($audioProject !== null) {
                // Reload entity to get latest data
                $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
                if ($audioProject !== null) {
                    $audioProject->completeMergingPhase();
                    $this->audioProjectDomainService->save($audioProject);
                    $this->logger->info('Audio project merging phase completed', [
                        'project_id' => $projectId,
                        'phase' => 'merging',
                        'status' => 'completed',
                    ]);
                }
            }

            Db::commit();

            $this->logger->info(sprintf(
                'Successfully imported %d files to project %d',
                count($savedFileIds),
                $projectId
            ));

            return [
                'file_ids' => $savedFileIds,
                'total' => count($savedFileIds),
            ];
        } catch (Throwable $e) {
            Db::rollBack();

            // ===== Exception handling: Mark merging phase as failed =====
            try {
                $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
                if ($audioProject !== null) {
                    $audioProject->failMergingPhase($e->getMessage());
                    $this->audioProjectDomainService->save($audioProject);
                    $this->logger->warning('Audio project merging phase failed', [
                        'project_id' => $projectId,
                        'phase' => 'merging',
                        'status' => 'failed',
                        'error' => $e->getMessage(),
                    ]);
                }
            } catch (Throwable $saveError) {
                $this->logger->error('Failed to mark merging phase as failed', [
                    'project_id' => $projectId,
                    'error' => $saveError->getMessage(),
                ]);
            }

            $this->logger->error('Import audio files failed', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Delete audio project (including core project + audio extension).
     */
    public function deleteAudioProject(RequestContext $requestContext, int $projectId): void
    {
        // Verify project ownership
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project || $project->getUserId() !== $requestContext->getUserId()) {
            throw new RuntimeException('Project not found or access denied');
        }

        // Delete audio extension first
        $this->audioProjectDomainService->deleteAudioProjectByProjectId($projectId);

        // Delete core project
        $this->projectDomainService->deleteProject($projectId, $project->getUserId());
    }

    /**
     * Initialize the project root directory and upload all template files from the
     * custom_agent template directory into the project workspace.
     *
     * This method is called during agent project creation to pre-populate the project
     * with the standard set of agent definition files (AGENTS.md, IDENTITY.md, etc.).
     * It is always executed inside the outer database transaction of createAgentProject.
     */
    private function initCustomTemplateFiles(
        ProjectEntity $projectEntity,
        DataIsolation $dataIsolation
    ): void {
        // Create (or locate) the project root directory
        $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            projectId: $projectEntity->getId(),
            workDir: $projectEntity->getWorkDir(),
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
        );

        // @phpstan-ignore-next-line
        $templateDir = SUPER_MAGIC_MODULE_PATH . '/storage/agent_template/custom_agent';

        if (! is_dir($templateDir)) {
            $this->logger->warning(sprintf('Custom agent template directory not found: %s', $templateDir));
            return;
        }

        $this->processTemplateDirectory($dataIsolation, $projectEntity, $templateDir, $rootDirId);
    }

    /**
     * Recursively upload all files (and subdirectories) found under $templateDir
     * into the project workspace, rooted at the file entry identified by $parentId.
     */
    private function processTemplateDirectory(
        DataIsolation $dataIsolation,
        ProjectEntity $projectEntity,
        string $templateDir,
        int $parentId
    ): void {
        $iterator = new DirectoryIterator($templateDir);
        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isDot()) {
                continue;
            }

            $fileName = $fileInfo->getFilename();

            if ($fileInfo->isDir()) {
                $dirEntity = $this->taskFileDomainService->createProjectFile(
                    $dataIsolation,
                    $projectEntity,
                    $parentId,
                    $fileName,
                    true
                );
                $this->processTemplateDirectory(
                    $dataIsolation,
                    $projectEntity,
                    $fileInfo->getPathname(),
                    $dirEntity->getFileId()
                );
                continue;
            }

            $content = file_get_contents($fileInfo->getPathname());
            if ($content === false) {
                $this->logger->warning(sprintf('Failed to read template file: %s', $fileInfo->getPathname()));
                continue;
            }

            $this->taskFileDomainService->createProjectFileWithContent(
                $dataIsolation,
                $projectEntity,
                $parentId,
                $fileName,
                $content
            );
        }
    }

    /**
     * 复用预启动的隐藏项目和话题
     * 只负责查找隐藏资源并更新其状态（取消隐藏），不处理其他业务逻辑.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param CreateProjectRequestDTO $requestDTO 创建项目请求DTO
     * @param ProjectEntity $hiddenProject 隐藏项目实体
     * @param WorkspaceEntity $workspaceEntity 工作区实体
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @return array 包含 projectEntity 和 topicEntity，格式：['projectEntity' => ProjectEntity, 'topicEntity' => TopicEntity]
     */
    private function reuseHiddenProject(
        RequestContext $requestContext,
        CreateProjectRequestDTO $requestDTO,
        ProjectEntity $hiddenProject,
        WorkspaceEntity $workspaceEntity,
        DataIsolation $dataIsolation
    ): array {
        $this->logger->info(sprintf(
            '开始复用隐藏项目, projectId=%d',
            $hiddenProject->getId()
        ));

        // 1. 查找隐藏话题
        $hiddenTopic = $this->topicDomainService->findHiddenTopicByProjectUserAndType(
            $hiddenProject->getId(),
            $dataIsolation->getCurrentUserId(),
            HiddenType::PRE_WARM->value
        );

        if ($hiddenTopic === null) {
            // 理论上不应该发生，但做保护处理
            $this->logger->warning(sprintf(
                '隐藏项目存在但隐藏话题不存在, projectId=%d',
                $hiddenProject->getId()
            ));
            throw new RuntimeException('Hidden topic not found for hidden project');
        }

        $this->logger->info(sprintf(
            '找到隐藏话题, topicId=%d, sandboxId=%s',
            $hiddenTopic->getId(),
            $hiddenTopic->getSandboxId()
        ));

        // 2. 更新项目状态（取消隐藏）
        $hiddenProject->setProjectName($requestDTO->getProjectName());
        $hiddenProject->setIsHidden(false);
        $hiddenProject->setHiddenType(null);
        $hiddenProject->setUpdatedUid($dataIsolation->getCurrentUserId());
        $hiddenProject->setUpdatedAt(date('Y-m-d H:i:s'));

        // 如果有项目模式，设置项目模式
        if ($requestDTO->getProjectMode()) {
            $hiddenProject->setProjectMode($requestDTO->getProjectMode());
        }

        $this->projectDomainService->saveProjectEntity($hiddenProject);

        $this->eventDispatcher->dispatch(new ProjectHiddenStatusUpdatedEvent(
            $hiddenProject->getId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $hiddenProject->getProjectMode(),
            false
        ));

        $this->logger->info(sprintf(
            '隐藏项目已转正, projectId=%d, projectName=%s',
            $hiddenProject->getId(),
            $requestDTO->getProjectName()
        ));

        // 3. 更新话题状态（取消隐藏）
        $hiddenTopic->setIsHidden(false);
        $hiddenTopic->setHiddenType(null);
        $hiddenTopic->setUpdatedUid($dataIsolation->getCurrentUserId());
        $hiddenTopic->setUpdatedAt(date('Y-m-d H:i:s'));

        $this->topicDomainService->saveTopicEntity($hiddenTopic);

        $this->logger->info(sprintf(
            '隐藏话题已转正, topicId=%d',
            $hiddenTopic->getId()
        ));

        // 4. 返回项目和话题实体（其他逻辑由调用方的主流程处理）
        return [
            'projectEntity' => $hiddenProject,
            'topicEntity' => $hiddenTopic,
        ];
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    /**
     * Initialize project standard flow (steps 2-6 + 8).
     *
     * This is the core initialization logic shared by all project creation methods:
     * - Get project work directory
     * - Initialize Magic Chat Conversation
     * - Create default topic
     * - Update workspace with current topic and project
     * - Update project with topic and work directory
     * - Initialize project members and settings
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param null|WorkspaceEntity $workspaceEntity Workspace entity (nullable for audio projects)
     * @param ProjectEntity $projectEntity Project entity (already created)
     * @return TopicEntity Created topic entity
     */
    private function initializeProject(
        DataIsolation $dataIsolation,
        ?WorkspaceEntity $workspaceEntity,
        ProjectEntity $projectEntity
    ): TopicEntity {
        // 2. Get project work directory
        $workDir = WorkDirectoryUtil::getWorkDir(
            $dataIsolation->getCurrentUserId(),
            $projectEntity->getId()
        );

        // 3. Initialize Magic Chat Conversation
        [$chatConversationId, $chatConversationTopicId] = $this->chatAppService
            ->initMagicChatConversation($dataIsolation);

        // 4. Create default topic
        $this->logger->info('开始创建默认话题');
        $topicEntity = $this->topicDomainService->createTopic(
            $dataIsolation,
            $workspaceEntity?->getId(),
            $projectEntity->getId(),
            $chatConversationId,
            $chatConversationTopicId,
            '',
            $workDir
        );
        $this->logger->info(sprintf('创建默认话题成功, topicId=%s', $topicEntity->getId()));

        // 5. Update workspace with current topic and project (only if workspace exists)
        if ($workspaceEntity !== null) {
            $workspaceEntity->setCurrentTopicId($topicEntity->getId());
            $workspaceEntity->setCurrentProjectId($projectEntity->getId());
            $this->workspaceDomainService->saveWorkspaceEntity($workspaceEntity);
            $this->logger->info(sprintf(
                '工作区%s已设置当前话题%s',
                $workspaceEntity->getId(),
                $topicEntity->getId()
            ));
        }

        // 6. Update project with topic and work directory
        $projectEntity->setCurrentTopicId($topicEntity->getId());
        $projectEntity->setWorkspaceId($workspaceEntity?->getId());
        $projectEntity->setWorkDir($workDir);
        $this->projectDomainService->saveProjectEntity($projectEntity);
        $this->logger->info(sprintf(
            '项目%s已设置当前话题%s',
            $projectEntity->getId(),
            $topicEntity->getId()
        ));

        // 8. Initialize project members and settings (workspace_id can be null)
        $this->projectMemberDomainService->initializeProjectMemberAndSettings(
            $dataIsolation->getCurrentUserId(),
            $projectEntity->getId(),
            $workspaceEntity?->getId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        return $topicEntity;
    }

    /**
     * Validate workspace access (existence and ownership).
     *
     * @throws BusinessException
     */
    private function validateWorkspaceAccess(
        DataIsolation $dataIsolation,
        int $workspaceId
    ): WorkspaceEntity {
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::WORKSPACE_NOT_FOUND,
                trans('workspace.workspace_not_found')
            );
        }

        // Validate workspace ownership
        if ($workspaceEntity->getUserId() !== $dataIsolation->getCurrentUserId()
            || $workspaceEntity->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED,
                trans('workspace.access_denied')
            );
        }

        return $workspaceEntity;
    }

    /**
     * Validate workspace type matches expected type.
     *
     * @throws BusinessException
     */
    private function validateWorkspaceType(
        WorkspaceEntity $workspaceEntity,
        WorkspaceType $expectedType,
        int $workspaceId
    ): void {
        if ($workspaceEntity->getWorkspaceType() !== $expectedType->value) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::INVALID_WORKSPACE_TYPE,
                trans('super_agent.invalid_workspace_type_for_audio_project'),
                [
                    'workspace_id' => $workspaceId,
                    'expected_type' => $expectedType->value,
                    'actual_type' => $workspaceEntity->getWorkspaceType(),
                ]
            );
        }
    }

    /**
     * Extract project ID from work directory (for migration scenarios).
     */
    private function extractProjectIdFromWorkDir(
        DataIsolation $dataIsolation,
        ?string $workDir
    ): string {
        if (empty($workDir)) {
            return '';
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix(
            $dataIsolation->getCurrentOrganizationCode()
        );

        if (WorkDirectoryUtil::isValidWorkDirectory($fullPrefix, $workDir)) {
            return WorkDirectoryUtil::extractProjectIdFromAbsolutePath($workDir);
        }

        return '';
    }

    /**
     * Validate fork permission (check if source project allows forking).
     *
     * @throws BusinessException
     */
    private function validateForkPermission(int $sourceProjectId): void
    {
        $resourceShareEntity = $this->resourceShareDomainService->getShareByResourceId((string) $sourceProjectId);
        if (empty($resourceShareEntity) || $resourceShareEntity->getResourceType() != ResourceType::Project->value) {
            ExceptionBuilder::throw(
                ShareErrorCode::RESOURCE_NOT_FOUND,
                trans('share.resource_not_found')
            );
        }

        // Check if project files can be copied
        $allowCopyProjectFiles = $resourceShareEntity->getExtraAttribute(
            CreateShareRequestDTO::EXTRA_FIELD_ALLOW_COPY_PROJECT_FILES,
            true
        );

        if (! $allowCopyProjectFiles) {
            ExceptionBuilder::throw(
                ShareErrorCode::COPY_PROJECT_FILES_NOT_ALLOWED,
                trans('share.copy_project_files_not_allowed')
            );
        }
    }
}
