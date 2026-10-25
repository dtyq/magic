<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\File\DTO\Request\CreateAudioProjectRequestDTO;
use App\Application\SuperMagic\File\DTO\Request\GetAudioProjectListRequestDTO;
use App\Application\SuperMagic\File\DTO\Request\ImportAudioFilesRequestDTO;
use App\Application\SuperMagic\File\DTO\Request\UpdateAudioProjectMetadataRequestDTO;
use App\Application\SuperMagic\File\DTO\Request\UpdateAudioProjectTagsRequestDTO;
use App\Application\SuperMagic\File\DTO\Response\AudioProjectExtraDTO;
use App\Application\SuperMagic\File\DTO\Response\AudioProjectListResponseDTO;
use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Application\SuperMagic\Project\DTO\Request\CreateAgentProjectRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\CreateMicroAppProjectRequestDTO;
use App\Application\SuperMagic\Project\Event\Publish\ProjectForkPublisher;
use App\Application\SuperMagic\Task\Event\Publish\StopRunningTaskPublisher;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Common\Entity\ValueObject\CreationSource;
use App\Domain\SuperMagic\Common\Entity\ValueObject\DeleteDataType;
use App\Domain\SuperMagic\Common\Entity\ValueObject\HiddenType;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinDomainService;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Event\BeforeCreateMicroAppEvent;
use App\Domain\SuperMagic\Project\Event\ForkProjectStartEvent;
use App\Domain\SuperMagic\Project\Event\ProjectCreatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectForkEvent;
use App\Domain\SuperMagic\Project\Event\ProjectHiddenStatusUpdatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectMovedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchMovedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectUpdatedEvent;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Task\Constant\AgentConstant;
use App\Domain\SuperMagic\Task\Event\StopRunningTaskEvent;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\ShareErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\AccessTokenUtil;
use App\Infrastructure\SuperMagic\Utils\FileMetadataUtil;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\DTO\Response\BatchDeleteResultItemDTO;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\BatchDeleteProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\BatchMoveProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateSpecialProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ForkProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\GetProjectListRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\MoveProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\UpdateProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\BatchDeleteProjectsResponseDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\ForkProjectResponseDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\ForkStatusResponseDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\ProjectItemDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\ProjectListResponseDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Request\GetSidebarTopicsRequestDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Response\SidebarTopicListResponseDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Response\TopicItemDTO;
use Closure;
use DirectoryIterator;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
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

    /**
     * Defensive runaway guard for V2 attachment tree traversal: the maximum number
     * of per-parent cursor queries a single request may issue.
     *
     * This is NOT a page-size limiter. The traversal keeps filling the current page
     * until page_size rows are emitted or the queue is drained, so a non-final page
     * is always full and the client-side call count stays predictable
     * (ceil(emittedItems / page_size)). This guard only trips on pathological,
     * extremely sparse trees (e.g. many empty directories) to bound worst-case work;
     * when it trips the queue is still non-empty, so has_more remains true and the
     * client simply continues paging.
     */
    private const ATTACHMENT_V2_MAX_PARENT_QUERIES = 1000;

    protected LoggerInterface $logger;

    public function __construct(
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly MicroAppRepositoryInterface $microAppRepository,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly PackageFilterInterface $packageFilterService,
        private readonly AudioProjectDomainService $audioProjectDomainService,
        private readonly RecycleBinDomainService $recycleBinDomainService,
        private readonly FileTreeBuilder $fileTreeBuilder,
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly LockerInterface $locker,
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

        $transactionOpen = false;
        try {
            $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
            Db::beginTransaction();
            $transactionOpen = true;
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
            $dynamicParams = ! empty($requestDTO->getDynamicParams()) ? $requestDTO->getDynamicParams() : null;
            ['topic' => $topicEntity, 'pending_default' => $pendingDefault] = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity, $conversationPair, $dynamicParams);

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

            $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
            Db::commit();
            $transactionOpen = false;

            // Dispatch project created event
            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            return [
                'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray(),
            ];
        } catch (Throwable $e) {
            if ($transactionOpen) {
                Db::rollBack();
            }
            $this->logger->error('Create Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, 'project.create_project_failed');
        }
    }

    /**
     * 创建或获取特殊项目.
     * 根据前端传入的 key 判断项目是否已存在，不存在则在 default 工作区下创建.
     * 项目 ID 通过 MagicUserSettingDomainService 存储映射关系.
     *
     * @return array 返回格式：['key' => string, 'project' => array, 'is_existing' => bool]
     */
    public function createOrGetSpecialProject(
        RequestContext $requestContext,
        CreateSpecialProjectRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $specialKey = $requestDTO->getKey();
        if (empty($specialKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project.special_key_required');
        }

        $settingKey = UserSettingKey::genSuperMagicSpecialProject($specialKey);

        // 1. 快速路径：无锁查询 UserSetting 是否已有 project_id
        $setting = $this->magicUserSettingDomainService->get($dataIsolation, $settingKey);

        if ($setting) {
            $projectId = (int) ($setting->getValue()['project_id'] ?? 0);
            if ($projectId > 0) {
                // 校验项目是否真实存在
                $projectEntity = $this->projectRepository->findById($projectId);
                if ($projectEntity && $projectEntity->getUserId() === $dataIsolation->getCurrentUserId()) {
                    $this->logger->info(sprintf('特殊项目已存在, key=%s, projectId=%d', $specialKey, $projectId));
                    return [
                        'key' => $specialKey,
                        'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                        'is_existing' => true,
                    ];
                }
            }
        }

        // 2. 获取分布式锁，防止并发为同一 key 创建多个项目
        $lockName = sprintf('special_project:create:%s:%s', $dataIsolation->getCurrentUserId(), $specialKey);
        $lockOwner = uniqid('special_project_', true);

        if (! $this->locker->mutexLock($lockName, $lockOwner, 10)) {
            ExceptionBuilder::throw(GenericErrorCode::TooManyRequests, 'project.create_project_too_frequent');
        }

        try {
            // 3. Double-check：获取锁后再次检查，防止并发请求重复创建
            $setting = $this->magicUserSettingDomainService->get($dataIsolation, $settingKey);
            if ($setting) {
                $projectId = (int) ($setting->getValue()['project_id'] ?? 0);
                if ($projectId > 0) {
                    $projectEntity = $this->projectRepository->findById($projectId);
                    if ($projectEntity && $projectEntity->getUserId() === $dataIsolation->getCurrentUserId()) {
                        $this->logger->info(sprintf('特殊项目已存在(并发检查), key=%s, projectId=%d', $specialKey, $projectId));
                        return [
                            'key' => $specialKey,
                            'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                            'is_existing' => true,
                        ];
                    }
                }
            }

            // 4. 获取或创建 UserSpecial 工作区
            $workspaceEntity = $this->workspaceDomainService->getOrCreateWorkspaceByType(
                $dataIsolation,
                WorkspaceType::UserSpecial
            );

            // 5. 创建项目
            $transactionOpen = false;
            try {
                $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
                Db::beginTransaction();
                $transactionOpen = true;
                $projectEntity = $this->projectDomainService->createProject(
                    $workspaceEntity->getId(),
                    $requestDTO->getProjectName(),
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    '',
                    '',
                    $requestDTO->getProjectMode() ?: null
                );
                $this->logger->info(sprintf('创建特殊项目, key=%s, projectId=%s', $specialKey, $projectEntity->getId()));

                // 6. 初始化项目
                $dynamicParams = ! empty($requestDTO->getDynamicParams()) ? $requestDTO->getDynamicParams() : null;
                ['pending_default' => $pendingDefault] = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity, $conversationPair, $dynamicParams, $requestDTO->getTopicMode());

                // 7. 创建项目根目录
                $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $projectEntity->getId(),
                    workDir: $projectEntity->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                );

                // 8. 保存 key → project_id 映射到 UserSetting
                $settingEntity = new MagicUserSettingEntity();
                $settingEntity->setKey($settingKey);
                $settingEntity->setValue(['project_id' => $projectEntity->getId()]);
                $this->magicUserSettingDomainService->save($dataIsolation, $settingEntity);

                $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
                Db::commit();
                $transactionOpen = false;

                // 触发项目创建事件
                $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
                $this->eventDispatcher->dispatch($projectCreatedEvent);

                return [
                    'key' => $specialKey,
                    'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                    'is_existing' => false,
                ];
            } catch (Throwable $e) {
                if ($transactionOpen) {
                    Db::rollBack();
                }
                $this->logger->error('Create Special Project Failed, err: ' . $e->getMessage(), ['key' => $specialKey]);
                ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, 'project.create_project_failed');
            }
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /** Query a user-scoped special project without creating it. */
    public function findSpecialProject(RequestContext $requestContext, string $specialKey): ?ProjectEntity
    {
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $setting = $this->magicUserSettingDomainService->get(
            $dataIsolation,
            UserSettingKey::genSuperMagicSpecialProject($specialKey),
        );
        $projectId = (int) ($setting?->getValue()['project_id'] ?? 0);
        if ($projectId <= 0) {
            return null;
        }

        $project = $this->projectRepository->findById($projectId);
        return $project !== null && $project->getUserId() === $dataIsolation->getCurrentUserId()
            ? $project
            : null;
    }

    /** Create or get a micro-app runtime project with server-owned defaults. */
    public function ensureMicroAppRuntimeProject(RequestContext $requestContext, string $specialKey): array
    {
        $requestDTO = new CreateSpecialProjectRequestDTO([
            'key' => $specialKey,
            'project_name' => $specialKey,
            'dynamic_params' => ['agent_mode' => 'micro-app', 'message_version' => 'v2'],
        ]);
        $result = $this->createOrGetSpecialProject($requestContext, $requestDTO);
        $projectId = (int) ($result['project']['id'] ?? 0);
        $project = $projectId > 0 ? $this->projectRepository->findById($projectId) : null;
        if ($project === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, 'project.create_project_failed');
        }

        $project = $this->normalizeMicroAppRuntimeProject($project);

        return [
            'project' => ProjectItemDTO::fromEntity($project)->toArray(),
            'is_existing' => (bool) ($result['is_existing'] ?? false),
        ];
    }

    public function normalizeMicroAppRuntimeProject(ProjectEntity $project): ProjectEntity
    {
        if (! $project->isHidden()
            || $project->getHiddenType() !== HiddenType::MICRO_APP_RUNTIME->value
            || $project->getSource() !== CreationSource::SYSTEM_CREATED->value) {
            $project->setIsHidden(true)
                ->setHiddenTypeEnum(HiddenType::MICRO_APP_RUNTIME)
                ->setSource(CreationSource::SYSTEM_CREATED->value)
                ->setUpdatedUid($project->getUserId())
                ->setUpdatedAt(date('Y-m-d H:i:s'));
            return $this->projectDomainService->saveProjectEntity($project);
        }

        return $project;
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

        $projectId = (int) $requestDTO->getId();

        // 获取项目信息，项目所有者和协作管理者均可更新项目基础信息
        $projectEntity = $this->getAccessibleProjectWithEditor(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        if (! is_null($requestDTO->getProjectName())) {
            $projectEntity->setProjectName($requestDTO->getProjectName());
        }
        if (! is_null($requestDTO->getProjectDescription())) {
            $projectEntity->setProjectDescription($requestDTO->getProjectDescription());
        }
        if (! is_null($requestDTO->getIsCollaborationEnabled())) {
            $projectEntity->setIsCollaborationEnabled($requestDTO->getIsCollaborationEnabled());
        }
        if (! is_null($requestDTO->getDefaultJoinPermission())) {
            $projectEntity->setDefaultJoinPermission(MemberRole::validatePermissionLevel($requestDTO->getDefaultJoinPermission()));
        }

        // Handle project mode change
        if (! is_null($requestDTO->getProjectMode())) {
            $newMode = $requestDTO->getProjectMode();
            if (ProjectMode::tryFrom($newMode) === null) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, "Invalid project_mode: {$newMode}");
            }
            $projectEntity->setProjectMode($newMode);
        }

        // TODO: Remove workspace changes from updateProject; clients should use the move API instead.
        // Handle target_workspace_id only during the transition period.
        if ($requestDTO->hasTargetWorkspaceId()) {
            $targetWorkspaceId = $requestDTO->getTargetWorkspaceId();

            if (! $requestDTO->isDetachingWorkspace() && ! is_null($targetWorkspaceId)) {
                // Moving to a specific workspace: validate access
                $targetWorkspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($targetWorkspaceId);
                if (empty($targetWorkspaceEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, 'workspace.workspace_not_found');
                }
                if ($targetWorkspaceEntity->getUserId() !== $userAuthorization->getId()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
                }
            }

            // Cascade workspace_id to topics and tasks via domain service
            $projectEntity = $this->projectDomainService->moveProject(
                $projectId,
                $targetWorkspaceId,
                $userAuthorization->getId()
            );
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

        // 先获取项目实体用于事件发布和回收站记录
        $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
        $microAppRecord = $this->microAppRepository->findByProjectId($projectId);

        $result = Db::transaction(function () use ($projectId, $dataIsolation, $projectEntity, $microAppRecord) {
            // 删除项目
            $result = $this->projectDomainService->deleteProject($projectId, $dataIsolation->getCurrentUserId());

            // 微应用映射和稳定分享链接与项目保持同一删除事务。
            $this->deleteMicroAppResources($projectId, $microAppRecord);

            // 删除项目协作关系
            $this->projectMemberDomainService->deleteByProjectId($projectId);

            // 获取工作区信息用于写入 extra_data
            $workspaceId = $projectEntity->getWorkspaceId();
            $workspace = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
            if ($workspaceId !== null && $workspace === null) {
                $this->logger->warning('项目关联的工作区不存在', [
                    'project_id' => $projectId,
                    'workspace_id' => $workspaceId,
                ]);
            }

            $parentInfo = $workspace === null ? null : [
                'workspace_id' => $workspaceId,
                'workspace_name' => $workspace->getName(),
            ];

            // 记录到回收站表
            $this->recycleBinDomainService->recordDeletion(
                resourceType: $microAppRecord === null ? RecycleBinResourceType::Project : RecycleBinResourceType::MicroApp,
                resourceId: $microAppRecord?->getId() ?? $projectId,
                resourceName: $projectEntity->getProjectName(),
                ownerId: $projectEntity->getUserId(),
                deletedBy: (string) $dataIsolation->getCurrentUserId(),
                parentId: $workspaceId,
                extraData: array_filter([
                    'parent_info' => $parentInfo,
                    'micro_app' => $microAppRecord === null ? null : [
                        'app_id' => (string) $microAppRecord->getId(),
                        'project_id' => (string) $projectId,
                        'organization_code' => $microAppRecord->getOrganizationCode(),
                        'resource_id' => $microAppRecord->getResourceId(),
                    ],
                ], static fn (mixed $value): bool => $value !== null)
            );

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
                    $this->deleteMicroAppResources($projectId);
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

    /**
     * 获取项目名称（带缓存），供公开免鉴权接口使用，避免高频请求直达数据库.
     */
    public function getProjectNameNotUserId(int $projectId): string
    {
        $cacheKey = 'super_magic:project:name:' . $projectId;
        $cache = di(CacheInterface::class);

        try {
            $cached = $cache->get($cacheKey);
            if ($cached !== null) {
                return (string) $cached;
            }
        } catch (Throwable $e) {
            $this->logger->warning('Failed to get project name cache', ['project_id' => $projectId, 'error' => $e->getMessage()]);
        }

        $projectName = $this->projectDomainService->getProjectNotUserId($projectId)->getProjectName() ?? '';

        try {
            $cache->set($cacheKey, $projectName, 60);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to set project name cache', ['project_id' => $projectId, 'error' => $e->getMessage()]);
        }

        return $projectName;
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
        // Exclude hidden projects from the list by default
        $conditions['is_hidden'] = 0;

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
            $requestDTO->getOrderBy(),
            $requestDTO->getSort(),
            $requestDTO->getPinPriority()
        );

        // 提取所有项目ID和工作区ID
        $projectIds = [];
        $workspaceIds = [];
        foreach ($result['list'] ?? [] as $project) {
            $projectIds[] = $project->getId();
            if ($project->getWorkspaceId() !== null) {
                $workspaceIds[] = $project->getWorkspaceId();
            }
        }
        $projectIds = array_values(array_unique($projectIds));
        $workspaceIds = array_values(array_unique($workspaceIds));

        // 批量获取项目状态
        $projectStatusMap = $this->topicDomainService->calculateProjectStatusBatch($projectIds, $dataIsolation->getCurrentUserId());

        // 批量获取当前用户在项目下的可见话题数量
        $topicCountMap = $this->topicDomainService->countUserVisibleTopicsByProjectIds($projectIds, $dataIsolation->getCurrentUserId());

        // 批量获取工作区名称
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 批量获取项目成员数量，判断是否存在协作成员
        $projectMemberCounts = $this->projectMemberDomainService->getProjectMembersCounts($projectIds);
        $projectIdsWithMember = [];
        foreach ($projectMemberCounts as $projectId => $count) {
            if ($count > 0) {
                $projectIdsWithMember[] = $projectId;
            }
        }

        // 创建响应DTO并传入项目状态映射和工作区名称映射
        $listResponseDTO = ProjectListResponseDTO::fromResult(
            $result,
            $workspaceNameMap,
            $projectIdsWithMember,
            $projectStatusMap,
            $topicCountMap
        );

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

    public function getProjectSidebarTopics(RequestContext $requestContext, GetSidebarTopicsRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $this->getAccessibleProject(
            $requestDTO->getProjectId(),
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        $result = $this->topicDomainService->getProjectSidebarTopics(
            $requestDTO->getProjectId(),
            $dataIsolation->getCurrentUserId(),
            $requestDTO->getQ(),
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getTopicTypes()
        );

        return SidebarTopicListResponseDTO::fromResult($result)->toArray();
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
        return $this->getProjectAttachmentList(
            $dataIsolation,
            $requestDTO,
            $projectEntity->getWorkDir() ?? '',
            $projectEntity
        );
    }

    /**
     * 获取项目附件列表 V2（登录用户模式，不返回树状结构，支持时间过滤）.
     */
    public function getProjectAttachmentsV2(RequestContext $requestContext, GetProjectAttachmentsV2RequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 验证项目存在性和所有权
        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        return $this->buildAttachmentListV2((int) $requestDTO->getProjectId(), $requestDTO, $dataIsolation, $projectEntity);
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

        return $this->getProjectAttachmentList(
            $dataIsolation,
            $requestDTO,
            $projectEntity->getWorkDir() ?? '',
            $projectEntity
        );
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

        $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
        if (empty($projectEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }
        $workDir = $projectEntity->getWorkDir() ?: $workDir;
        $requestDto->setProjectId($projectId);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');

        // 令牌模式不需要workDir处理，传空字符串
        return $this->getProjectAttachmentList($dataIsolation, $requestDto, $workDir, $projectEntity);
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
        $projectEntity = null;
        switch ($shareEntity->getResourceType()) {
            case ResourceType::Topic->value:
                $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                if (empty($topicEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                }
                $projectId = (string) $topicEntity->getProjectId();
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
                if (empty($projectEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
                }
                break;
            case ResourceType::Project->value:
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $shareEntity->getResourceId());
                if (empty($projectEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
                }
                $projectId = (string) $projectEntity->getId();
                break;
            default:
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }

        $requestDto->setProjectId($projectId);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        return $this->buildAttachmentListV2((int) $projectId, $requestDto, $dataIsolation, $projectEntity);
    }

    /**
     * 获取项目附件总数（临时灰度开关用：前端按此值决定走 V1 或 V2）.
     * 支持登录态与分享 token 两种鉴权模式。
     */
    public function getProjectAttachmentsCount(?RequestContext $requestContext, int $projectId, ?string $token = null): array
    {
        // 分享 token 模式
        if (! empty($token)) {
            if (! AccessTokenUtil::validate($token)) {
                ExceptionBuilder::throw(ShareErrorCode::PARAMETER_CHECK_FAILURE, 'share.parameter_check_failure');
            }
            $shareId = AccessTokenUtil::getShareId($token);
            $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
            if (! $shareEntity) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
            }
            $resolvedProjectId = 0;
            switch ($shareEntity->getResourceType()) {
                case ResourceType::Topic->value:
                    $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                    if (empty($topicEntity)) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                    }
                    $resolvedProjectId = (int) $topicEntity->getProjectId();
                    break;
                case ResourceType::Project->value:
                    $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $shareEntity->getResourceId());
                    if (empty($projectEntity)) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
                    }
                    $resolvedProjectId = (int) $projectEntity->getId();
                    break;
                default:
                    ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
            }
            return ['total' => $this->taskFileDomainService->countAttachmentsByProjectIdV2($resolvedProjectId)];
        }

        // 登录态
        $userAuthorization = $requestContext?->getUserAuthorization();
        if ($userAuthorization === null) {
            ExceptionBuilder::throw(ShareErrorCode::PARAMETER_CHECK_FAILURE, 'share.parameter_check_failure');
        }
        $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        return ['total' => $this->taskFileDomainService->countAttachmentsByProjectIdV2($projectId)];
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

        $transactionOpen = false;
        try {
            $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
            Db::beginTransaction();
            $transactionOpen = true;
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
            ['topic' => $topicEntity, 'pending_default' => $pendingDefault] = $this->initializeProject($dataIsolation, $workspaceEntity, $forkProjectEntity, $conversationPair);

            // Copy audio extension data for audio projects. The audio_file_id is
            // updated after async file migration resolves the new file ID.
            $this->audioProjectDomainService->copyAudioProjectForFork(
                $requestDTO->getSourceProjectId(),
                $forkProjectEntity->getId(),
                $topicEntity->getId()
            );

            // 7. Skip root directory initialization (fork uses async file migration)

            // Build the fork event for async file migration; it is published after the commit
            $event = new ProjectForkEvent(
                $requestDTO->getSourceProjectId(),
                $forkProjectEntity->getId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $forkProjectRecordEntity->getId()
            );

            $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
            Db::commit();
            $transactionOpen = false;

            $responseData = ForkProjectResponseDTO::fromEntity($forkProjectRecordEntity)->toArray();
        } catch (EventException $e) {
            if ($transactionOpen) {
                Db::rollBack();
            }
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_FORK_ACCESS_DENIED, $e->getMessage());
        } catch (Throwable $e) {
            if ($transactionOpen) {
                Db::rollBack();
            }
            $this->logger->error('Fork project failed, error: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            throw $e;
        }

        // The consumer reads the forked project on its own connection, so the event may only be
        // published once the transaction is committed and those rows are visible to it.
        $this->publishForkEvent($event);

        return $responseData;
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
            $dataIsolation = $this->createContactDataIsolationByUser($event->getOrganizationCode(), $event->getUserId());

            $sourceProjectEntity = $this->projectDomainService->getProjectNotUserId($event->getSourceProjectId());

            $forkProjectEntity = $this->projectDomainService->getProjectNotUserId($event->getForkProjectId());

            $forkProjectRecordEntity = $this->projectDomainService->getForkProjectRecordById($event->getForkRecordId());

            $sourceToForkFileIdMap = $this->taskFileDomainService->migrateProjectFile($dataIsolation, $sourceProjectEntity, $forkProjectEntity, $forkProjectRecordEntity, $this->createContactDataIsolationByUser($forkProjectEntity->getUserOrganizationCode(), $forkProjectEntity->getUserId()), $event->getFileIds());
            if (! empty($sourceToForkFileIdMap)) {
                $this->audioProjectDomainService->updateForkedAudioFileIdFromMigrationMap(
                    $sourceProjectEntity->getId(),
                    $forkProjectEntity->getId(),
                    $sourceToForkFileIdMap
                );
            }

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
            // Failures raised before the migration itself starts leave the record untouched,
            // so give it a terminal state instead of letting the client poll 0% forever.
            $this->projectDomainService->markForkRecordFailed($event->getForkRecordId(), 'File migration failed');
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

        // `pre_project_id` has priority only when both relative-position IDs
        // have a value. An explicitly null `pre_project_id` must not suppress
        // a valid `next_project_id`.
        $preProjectId = $requestDTO->getPreProjectId();
        $nextProjectId = $requestDTO->getNextProjectId();
        if ($preProjectId !== null && $nextProjectId !== null) {
            $this->logger->warning('Both pre_project_id and next_project_id were provided; pre_project_id wins', [
                'project_id' => $requestDTO->getSourceProjectId(),
            ]);
            $nextProjectId = null;
        }
        $sortProvided = ($preProjectId !== null || $nextProjectId !== null);

        // Call domain service to handle the move
        $movedProjectEntity = $this->projectDomainService->moveProject(
            $requestDTO->getSourceProjectId(),
            $targetWorkspaceId,
            $userAuthorization->getId(),
            $requestDTO->getTargetProjectName(),
            $requestDTO->getProjectMode(),
            $preProjectId,
            $nextProjectId,
            $sortProvided
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
        /** @var array<int, ProjectEntity> $projectMap */
        $projectMap = [];
        foreach ($projectEntities as $entity) {
            $projectMap[$entity->getId()] = $entity;
        }

        /** @var int[] $validProjectIds */
        $validProjectIds = [];
        /** @var int[] $workspaceChangeProjectIds */
        $workspaceChangeProjectIds = [];
        $invalidResults = [];

        foreach ($requestDTO->getProjectIds() as $projectId) {
            $projectIdInt = (int) $projectId;
            if (isset($projectMap[$projectIdInt])) {
                $project = $projectMap[$projectIdInt];
                // A same-workspace request is valid when it explicitly carries a
                // sorting parameter; otherwise preserve the legacy no-op rejection.
                if ($project->getWorkspaceId() === $targetWorkspaceId
                    && ! $requestDTO->preProjectIdProvided
                    && ! $requestDTO->nextProjectIdProvided
                ) {
                    $invalidResults[] = [
                        'project_id' => $projectId,
                        'success' => false,
                        'message' => 'Project is already in target workspace',
                    ];
                } else {
                    $validProjectIds[] = $projectIdInt;
                    if ($project->getWorkspaceId() !== $targetWorkspaceId) {
                        $workspaceChangeProjectIds[] = $projectIdInt;
                    }
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
                $successResults = Db::transaction(function () use ($validProjectIds, $workspaceChangeProjectIds, $targetWorkspaceId, $now, $userId, $organizationCode, $requestDTO) {
                    $preProjectId = $requestDTO->getPreProjectId();
                    $nextProjectId = $requestDTO->getNextProjectId();
                    if ($preProjectId !== null && $nextProjectId !== null) {
                        $this->logger->warning('Both pre_project_id and next_project_id were provided in batch move; pre_project_id wins');
                        $nextProjectId = null;
                    }
                    $relativeProjectId = $preProjectId ?? $nextProjectId;
                    if ($relativeProjectId !== null
                        && in_array($relativeProjectId, $validProjectIds, true)
                    ) {
                        throw new RuntimeException('Relative project cannot be included in the moved project list');
                    }

                    // Step 4.1: Batch update projects only when workspace changes.
                    $updatedCount = $workspaceChangeProjectIds === [] ? 0 : $this->projectRepository->batchUpdateWorkspace(
                        $workspaceChangeProjectIds,
                        $targetWorkspaceId,
                        $now
                    );

                    $this->logger->info('Batch updated projects workspace', [
                        'updated_count' => $updatedCount,
                    ]);

                    // Step 4.2: Batch update topics (1 query)
                    $topicUpdatedCount = $workspaceChangeProjectIds === [] ? 0 : $this->topicDomainService->batchUpdateWorkspaceByProjects(
                        $workspaceChangeProjectIds,
                        $targetWorkspaceId,
                        $now
                    );

                    $this->logger->info('Batch updated topics workspace', [
                        'updated_count' => $topicUpdatedCount,
                    ]);

                    // Step 4.3: Sync message schedule workspace.
                    $scheduleUpdatedCount = $this->messageScheduleDomainService->syncMovedProjectSchedules(
                        $workspaceChangeProjectIds,
                        $userId,
                        $organizationCode,
                        (int) ($targetWorkspaceId ?? 0),
                        $userId
                    );

                    $this->logger->info('Batch synced message schedule workspace', [
                        'updated_count' => $scheduleUpdatedCount,
                    ]);

                    // Step 4.4: Sync owner's personal workspace binding.
                    $settingUpdatedCount = $this->projectMemberDomainService->syncOwnerProjectWorkspaceBindings(
                        $userId,
                        $workspaceChangeProjectIds,
                        $targetWorkspaceId,
                        $organizationCode
                    );

                    $this->logger->info('Batch synced owner project workspace bindings', [
                        'updated_count' => $settingUpdatedCount,
                    ]);

                    if ($preProjectId !== null || $nextProjectId !== null) {
                        // For a `next_*_id` anchor, reverse processing keeps
                        // the caller's project order in the final list.
                        $sortProjectIds = $preProjectId !== null
                            ? $validProjectIds
                            : array_reverse($validProjectIds);
                        $currentPreProjectId = $preProjectId;
                        $currentNextProjectId = $nextProjectId;
                        foreach ($sortProjectIds as $projectId) {
                            $this->projectDomainService->applyProjectSortOrderForBatch(
                                $userId,
                                $organizationCode,
                                $projectId,
                                $targetWorkspaceId,
                                $currentPreProjectId,
                                $currentNextProjectId
                            );
                            if ($currentPreProjectId !== null) {
                                $currentPreProjectId = $projectId;
                            } else {
                                $currentNextProjectId = $projectId;
                            }
                        }
                    }

                    // Step 4.5: Build success results
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
                if (isset($projectMap[$projectId])) {
                    $movedProjects[] = $projectMap[$projectId];
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
    public function getProjectAttachmentList(
        DataIsolation $dataIsolation,
        GetProjectAttachmentsRequestDTO $requestDTO,
        string $workDir = '',
        ?ProjectEntity $projectEntity = null
    ): array {
        $parentId = $requestDTO->getParentId();
        if ($parentId === null || $parentId === '') {
            $parentId = $this->resolveRootDirectoryId($dataIsolation, $requestDTO, $projectEntity, $workDir);
            if ($parentId !== '') {
                $requestDTO->setParentId($parentId);
            }
        }

        // After resolveRootDirectoryId, $parentId is always a string (possibly empty)
        if ($parentId === '') {
            return [
                'total' => 0,
                'list' => [],
                'tree' => [],
            ];
        }

        // The project authorization above is bound to the route/token project. A
        // caller-supplied parent_id must belong to that same project before it can
        // be used as the root of a file-tree traversal.
        $parentFile = $this->magicFSFileDomainService->getFileById($parentId);
        if ((int) $parentFile->getProjectId() !== (int) $requestDTO->getProjectId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
        }

        // Only return project-space files; filter at DB level to avoid loading snapshot/other files
        $fileTree = $this->magicFSFileDomainService->getFileTree($parentId, -1, 0, FileSpaceType::PROJECT->value);
        /** @var TaskFileEntity[] $entities */
        $entities = $fileTree['children'] ?? [];
        $fileTypes = $requestDTO->getFileType();
        if (! empty($fileTypes)) {
            $entities = array_filter(
                $entities,
                static fn (TaskFileEntity $entity) => in_array($entity->getFileType(), $fileTypes, true)
            );
            $entities = array_values($entities);
        }

        $list = [];
        $fileKeySet = [];   // hash map for O(1) dedup instead of in_array O(N)
        $relativePathMap = $this->buildRelativePathsByParentIds($entities, (int) $requestDTO->getProjectId());
        foreach ($entities as $entity) {
            $fileKey = $entity->getFileKey();
            if (isset($fileKeySet[$fileKey])) {
                continue;
            }
            $fileKeySet[$fileKey] = true;

            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) $entity->getFileId();
            $dto->taskId = (string) $entity->getTaskId();
            $dto->fileType = $entity->getFileType();
            $dto->fileName = $entity->getFileName();
            $dto->fileExtension = $entity->getFileExtension();
            $dto->fileKey = $fileKey;
            $dto->fileSize = $entity->getFileSize();
            $dto->isHidden = $entity->getIsHidden();
            $dto->updatedAt = $entity->getUpdatedAt();
            $dto->topicId = (string) $entity->getTopicId();
            $dto->relativeFilePath = $relativePathMap[$entity->getFileId()] ?? '';
            $dto->isDirectory = $entity->getIsDirectory();
            $dto->displayConfig = FileMetadataUtil::decodeJsonObject($entity->getDisplayConfig());
            $dto->metadata = $dto->displayConfig;
            $dto->projectId = (string) $entity->getProjectId();
            $dto->sort = $entity->getSort();
            $dto->fileUrl = '';
            $dto->parentId = (string) $entity->getParentId();
            $dto->source = $entity->getSource();
            $list[] = $dto->toArray();
        }

        $tree = $this->fileTreeBuilder->buildTree($list, (int) $parentId, 'zh_CN');
        $total = count($list);

        if ($total > 3000) {
            $this->logger->error(sprintf('Project attachment list is too large, project ID: %d, total: %d', $requestDTO->getProjectId(), $total));
        }

        return [
            'total' => $total,
            'list' => $list,
            'tree' => $tree,
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
    /**
     * Prepare conversation identities before opening the business transaction.
     * @param null|Closure(ProjectEntity): void $beforeCommit bind the owning resource atomically with its project
     */
    public function createAgentProject(
        RequestContext $requestContext,
        CreateAgentProjectRequestDTO $requestDTO,
        ProjectMode $projectMode = ProjectMode::CUSTOM_AGENT,
        bool $setDefaultTopic = true,
        ?Closure $beforeCommit = null
    ) {
        $this->logger->info('Starting agent project creation');

        // Get user authorization and create data isolation
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $transactionOpen = false;
        try {
            $topicMode = '';
            $agentCode = '';
            if ($projectMode === ProjectMode::MAGICLAW) {
                $topicMode = ProjectMode::MAGICLAW->value;
                $agentCode = $requestDTO->getAgentCode();
                if ($agentCode === '') {
                    throw new InvalidArgumentException('MagicClaw agent code is required');
                }
            }

            $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
            Db::beginTransaction();
            $transactionOpen = true;
            // 1. Create project entity
            $this->logger->info(sprintf('Creating core project with mode=%s', $projectMode->value));
            $projectEntity = $this->projectDomainService->createProject(
                0,
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '',
                '',
                $projectMode->value,
                CreationSource::USER_CREATED->value,
                true,
                HiddenType::AGENT->value
            );
            $this->logger->info(sprintf('Created core project, projectId=%s', $projectEntity->getId()));

            // Standard initialization flow (steps 2-6 + 8) - workspace can be null for audio projects
            ['topic' => $topicEntity, 'pending_default' => $pendingDefault] = $this->initializeProject(
                dataIsolation: $dataIsolation,
                workspaceEntity: null,
                projectEntity: $projectEntity,
                conversationPair: $conversationPair,
                topicMode: $topicMode,
                agentCode: $agentCode,
            );

            // 2. Initialize root directory and optionally upload template files
            $this->initCustomTemplateFiles(
                $projectEntity,
                $dataIsolation,
                $projectMode,
                $requestDTO->getInitTemplateFiles()
            );

            // Resource creation/binding shares this transaction; no event escapes a failed binding.
            $beforeCommit?->__invoke($projectEntity);

            // A background skill draft must not redirect the conversation that requested it.
            if ($setDefaultTopic) {
                $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
            }
            Db::commit();
            $transactionOpen = false;

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
            if ($transactionOpen) {
                Db::rollBack();
            }
            $this->logger->error('Create Agent Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, trans('project.create_project_failed'));
        }
    }

    // ========================================
    // Micro App Project Methods
    // ========================================

    /**
     * Create micro app project in the current user's micro app workspace.
     */
    public function createMicroAppProject(
        RequestContext $requestContext,
        CreateMicroAppProjectRequestDTO $requestDTO
    ): array {
        $this->logger->info('Starting micro app project creation');

        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $lockKey = 'micro_app:create:' . $organizationCode;
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->spinLock($lockKey, $lockOwner, 120, 5)) {
            ExceptionBuilder::throw(GenericErrorCode::TooManyRequests, 'project.create_project_too_frequent');
        }

        try {
            $currentCount = $this->microAppRepository->countActiveByOrganization($organizationCode);
            $this->eventDispatcher->dispatch(new BeforeCreateMicroAppEvent(
                $organizationCode,
                $dataIsolation->getCurrentUserId(),
                $currentCount,
                $requestDTO->getProjectName()
            ));

            return $this->doCreateMicroAppProject($requestDTO, $dataIsolation, $userAuthorization);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
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

        $transactionOpen = false;
        try {
            $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
            Db::beginTransaction();
            $transactionOpen = true;
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
            ['topic' => $topicEntity, 'pending_default' => $pendingDefault] = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity, $conversationPair);

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

            $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
            Db::commit();
            $transactionOpen = false;

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
            if ($transactionOpen) {
                Db::rollBack();
            }
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
     * Update audio project metadata.
     */
    public function updateAudioProjectMetadata(
        RequestContext $requestContext,
        int $projectId,
        UpdateAudioProjectMetadataRequestDTO $requestDTO
    ): void {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $projectEntity = $this->getAccessibleProjectWithEditor(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        if ($projectEntity->getProjectMode() !== ProjectMode::AUDIO->value) {
            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('super_agent.invalid_project_mode_for_audio_import'),
                ['project_id' => $projectId, 'expected_mode' => ProjectMode::AUDIO->value]
            );
        }

        $audioProject = $this->audioProjectDomainService->getAudioProjectByProjectId($projectId);
        if ($audioProject === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        if (! $requestDTO->hasMetadataField()) {
            return;
        }

        $audioFileId = $requestDTO->hasAudioFileId() ? $requestDTO->getAudioFileId() : null;
        if ($audioFileId !== null) {
            $files = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, [$audioFileId]);
            if (count($files) !== 1) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
            }
        }

        $duration = $requestDTO->hasDuration() ? $requestDTO->getDuration() : null;
        $location = $requestDTO->hasLocation() ? $requestDTO->getLocation() : null;
        if ($audioFileId === null && $duration === null && $location === null) {
            return;
        }

        $this->audioProjectDomainService->updateRecordingMetadata(
            $projectId,
            $duration,
            null,
            null,
            $audioFileId,
            $location
        );
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
        if ($this->projectDomainService->deleteProject($projectId, $project->getUserId())) {
            $this->eventDispatcher->dispatch(new ProjectDeletedEvent(
                $project,
                $requestContext->getUserAuthorization()
            ));
        }
    }

    /**
     * 项目可访问性与资源侧上下文.
     */
    public function getProjectAccessibility(RequestContext $requestContext, int $projectId): ?ProjectEntity
    {
        $project = $this->projectDomainService->findProjectByIdOrNull($projectId);
        if ($project === null) {
            return null;
        }

        $userAuthorization = $requestContext->getUserAuthorization();
        $projectOrgCode = $project->getUserOrganizationCode();
        $magicId = trim($userAuthorization->getMagicId());
        $currentOrgCode = $userAuthorization->getOrganizationCode();

        if ($currentOrgCode === $projectOrgCode) {
            $effectiveUserId = $userAuthorization->getId();
        } else {
            $userInProjectOrg = $this->magicUserDomainService->getUserByMagicIdInOrganization($magicId, $projectOrgCode);
            if ($userInProjectOrg === null) {
                return null;
            }
            $effectiveUserId = $userInProjectOrg->getUserId();
        }

        try {
            $project = $this->getAccessibleProject($projectId, $effectiveUserId, $projectOrgCode);
        } catch (Throwable) {
            return null;
        }

        return $project;
    }

    /**
     * Publish the fork event, marking the fork record as failed when the message cannot be sent,
     * so the client stops polling a progress that would never advance.
     */
    private function publishForkEvent(ProjectForkEvent $event): void
    {
        try {
            $this->producer->produce(new ProjectForkPublisher($event));
            $this->logger->info(sprintf('Published fork event, event ID: %s', $event->getEventId()));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to publish fork event, fork record ID: %d, event ID: %s, error: %s',
                $event->getForkRecordId(),
                $event->getEventId(),
                $e->getMessage()
            ));
            $this->projectDomainService->markForkRecordFailed($event->getForkRecordId(), 'File migration failed');
        }
    }

    private function deleteMicroAppResources(int $projectId, ?MicroAppEntity $microAppRecord = null): void
    {
        $microAppRecord ??= $this->microAppRepository->findByProjectId($projectId);
        if ($microAppRecord === null) {
            return;
        }

        if (! $this->resourceShareDomainService->deleteAllSharesByResource(
            $microAppRecord->getResourceId(),
            ResourceType::Project->value
        )) {
            throw new RuntimeException(sprintf(
                'Failed to delete micro app share for project %d',
                $projectId
            ));
        }

        if (! $this->microAppRepository->deleteByProjectId($projectId)) {
            throw new RuntimeException(sprintf(
                'Failed to delete micro app record for project %d',
                $projectId
            ));
        }
    }

    private function doCreateMicroAppProject(
        CreateMicroAppProjectRequestDTO $requestDTO,
        DataIsolation $dataIsolation,
        MagicUserAuthorization $userAuthorization
    ): array {
        $workspaceId = $requestDTO->getWorkspaceId();
        if ($workspaceId !== '') {
            if (! ctype_digit($workspaceId)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Invalid workspace_id');
            }
            $workspaceIdInt = (int) $workspaceId;
            $workspaceEntity = $this->validateWorkspaceAccess($dataIsolation, $workspaceIdInt);
            $this->validateWorkspaceType($workspaceEntity, WorkspaceType::MicroApp, $workspaceIdInt);
        } else {
            $workspaceEntity = $this->workspaceDomainService->getOrCreateWorkspaceByType(
                $dataIsolation,
                WorkspaceType::MicroApp
            );
        }

        $transactionOpen = false;
        try {
            $conversationPair = $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation);
            Db::beginTransaction();
            $transactionOpen = true;
            $projectEntity = $this->projectDomainService->createProject(
                $workspaceEntity->getId(),
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '',
                '',
                ProjectMode::MICRO_APP->value
            );
            $this->logger->info(sprintf('Created micro app project, projectId=%s', $projectEntity->getId()));

            $dynamicParams = ! empty($requestDTO->getDynamicParams()) ? $requestDTO->getDynamicParams() : null;
            ['topic' => $topicEntity, 'pending_default' => $pendingDefault] = $this->initializeProject($dataIsolation, $workspaceEntity, $projectEntity, $conversationPair, $dynamicParams);

            $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                projectId: $projectEntity->getId(),
                workDir: $projectEntity->getWorkDir(),
                userId: $dataIsolation->getCurrentUserId(),
                organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            );

            $microAppRecord = $this->microAppRepository->ensureByProjectId(
                $projectEntity->getId(),
                $projectEntity->getUserOrganizationCode(),
                $projectEntity->getUserId(),
                $projectEntity->getCreatedUid(),
            );

            $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
            Db::commit();
            $transactionOpen = false;

            $projectCreatedEvent = new ProjectCreatedEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectCreatedEvent);

            return [
                'project' => ProjectItemDTO::fromEntity($projectEntity)->toArray(),
                'topic' => TopicItemDTO::fromEntity($topicEntity)->toArray(),
                'app_id' => (string) $microAppRecord->getId(),
            ];
        } catch (Throwable $e) {
            if ($transactionOpen) {
                Db::rollBack();
            }
            $this->logger->error('Create Micro App Project Failed, err: ' . $e->getMessage(), ['request' => $requestDTO->toArray()]);
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_PROJECT_FAILED, trans('project.create_project_failed'));
        }
    }

    /**
     * V2 attachment list using backend-managed breadth-first tree traversal.
     *
     * The client treats next_parent_ids as an opaque ordered queue and sends it
     * back unchanged. Each state points to a parent directory and, for very large
     * directories, the last emitted child position under that parent.
     */
    private function buildAttachmentListV2(
        int $projectId,
        GetProjectAttachmentsV2RequestDTO $requestDTO,
        ?DataIsolation $dataIsolation = null,
        ?ProjectEntity $projectEntity = null
    ): array {
        $pageSize = $requestDTO->getPageSize();
        $queue = $requestDTO->getNextParentIds();

        $list = [];
        $remaining = $pageSize;
        $parentQueryCount = 0;

        // An empty incoming queue marks the first page. Resolve the project root,
        // emit the root directory row itself as the very first item (keeps the list
        // consistent with countAttachmentsByProjectIdV2(), which also counts the
        // root), then seed the traversal queue with the root as a parent so its
        // descendants are paged afterwards.
        if (empty($queue)) {
            $rootEntity = $this->resolveAttachmentTraversalRoot($projectId, $requestDTO, $dataIsolation, $projectEntity);
            if ($rootEntity === null) {
                return [
                    'list' => [],
                    'next_parent_ids' => [],
                    'has_more' => false,
                ];
            }

            $list[] = $this->formatAttachmentRowV2($rootEntity->toArray());
            --$remaining;
            $queue[] = $this->makeAttachmentParentState((string) $rootEntity->getFileId());
        }

        while ($remaining > 0 && ! empty($queue) && $parentQueryCount < self::ATTACHMENT_V2_MAX_PARENT_QUERIES) {
            $state = array_shift($queue);
            $parentId = (int) ($state['parent_id'] ?? 0);
            if ($parentId <= 0) {
                continue;
            }

            ++$parentQueryCount;
            $rows = $this->taskFileDomainService->getProjectFileChildrenByParentCursor(
                $projectId,
                $parentId,
                StorageType::WORKSPACE->value,
                $state['after_sort'] ?? null,
                isset($state['after_file_id']) ? (int) $state['after_file_id'] : null,
                $remaining + 1,
                $requestDTO->getFileType()
            );

            $rowsToEmit = array_slice($rows, 0, $remaining);
            $lastEmittedRow = null;
            foreach ($rowsToEmit as $row) {
                $row = (array) $row;
                $lastEmittedRow = $row;

                $list[] = $this->formatAttachmentRowV2($row);
                --$remaining;

                if ((bool) ($row['is_directory'] ?? false)) {
                    $childParentId = (string) ($row['file_id'] ?? '');
                    if ($childParentId !== '' && $childParentId !== (string) $parentId) {
                        $queue[] = $this->makeAttachmentParentState($childParentId);
                    }
                }
            }

            // The current directory still has more children than we could emit on
            // this page (we fetched $remaining + 1 rows as a look-ahead). Push the
            // directory back to the FRONT of the queue carrying a (sort, file_id)
            // cursor so the NEXT request resumes this exact directory before
            // descending into any sibling/child directories discovered above. At
            // this point $remaining is always 0, so the returned page is full.
            if (count($rows) > count($rowsToEmit) && $lastEmittedRow !== null) {
                array_unshift(
                    $queue,
                    $this->makeAttachmentParentState(
                        (string) $parentId,
                        (int) ($lastEmittedRow['sort'] ?? 0),
                        (string) ($lastEmittedRow['file_id'] ?? '')
                    )
                );
                break;
            }
        }

        return [
            'list' => $list,
            'next_parent_ids' => array_values($queue),
            'has_more' => ! empty($queue),
        ];
    }

    /**
     * Resolve the project root directory entity used as the V2 traversal start.
     *
     * Returns the root TaskFileEntity (so the caller can emit it as the first list
     * item) or null when the project has no resolvable root. For the share/audit
     * paths (no project entity or no data isolation) the existing root is read
     * directly; for the login path the root is created on demand if missing.
     */
    private function resolveAttachmentTraversalRoot(
        int $projectId,
        GetProjectAttachmentsV2RequestDTO $requestDTO,
        ?DataIsolation $dataIsolation,
        ?ProjectEntity $projectEntity
    ): ?TaskFileEntity {
        $parentId = $requestDTO->getParentId();
        if ($parentId !== null) {
            $parentEntity = $this->taskFileDomainService->getById((int) $parentId);
            if (
                $parentEntity === null
                || $parentEntity->getProjectId() !== $projectId
                || ! $parentEntity->getIsDirectory()
                || $parentEntity->getStorageType() !== StorageType::WORKSPACE
            ) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }

            return $parentEntity;
        }

        if ($projectEntity === null || $dataIsolation === null) {
            return $this->taskFileDomainService->getRootFile($projectId);
        }

        $userId = $dataIsolation->getCurrentUserId() ?: $projectEntity->getUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode() ?: $organizationCode;

        $rootId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $requestDTO->getProjectId(),
            $projectEntity->getWorkDir() ?? '',
            (string) $userId,
            $organizationCode,
            $projectOrganizationCode
        );

        if ((int) $rootId <= 0) {
            return null;
        }

        return $this->taskFileDomainService->getById((int) $rootId);
    }

    /**
     * @return array{parent_id: string, after_sort: null|int, after_file_id: null|string}
     */
    private function makeAttachmentParentState(string $parentId, ?int $afterSort = null, ?string $afterFileId = null): array
    {
        return [
            'parent_id' => $parentId,
            'after_sort' => $afterSort,
            'after_file_id' => $afterFileId === '' ? null : $afterFileId,
        ];
    }

    private function formatAttachmentRowV2(array $row): array
    {
        $displayConfig = FileMetadataUtil::decodeJsonObject($row['display_config'] ?? null);

        return [
            'file_id' => (string) ($row['file_id'] ?? ''),
            'task_id' => (string) ($row['task_id'] ?? ''),
            'project_id' => (string) ($row['project_id'] ?? ''),
            'topic_id' => (string) ($row['topic_id'] ?? ''),
            'parent_id' => (string) ($row['parent_id'] ?? ''),
            'file_type' => (string) ($row['file_type'] ?? ''),
            'file_name' => (string) ($row['file_name'] ?? ''),
            'file_extension' => (string) ($row['file_extension'] ?? ''),
            'file_key' => (string) ($row['file_key'] ?? ''),
            'file_size' => (int) ($row['file_size'] ?? 0),
            'file_url' => '',
            'is_hidden' => (bool) ($row['is_hidden'] ?? false),
            'is_directory' => (bool) ($row['is_directory'] ?? false),
            'sort' => (int) ($row['sort'] ?? 0),
            'source' => (int) ($row['source'] ?? 0),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'display_config' => $displayConfig,
            // metadata 与 display_config 保持 V1/V2 旧行为一致（同源）
            'metadata' => $displayConfig,
        ];
    }

    /**
     * Resolve the root directory id for a project if parent_id is missing.
     */
    private function resolveRootDirectoryId(
        DataIsolation $dataIsolation,
        GetProjectAttachmentsRequestDTO $requestDTO,
        ?ProjectEntity $projectEntity,
        string $workDir
    ): string {
        if ($projectEntity === null) {
            return '';
        }

        $userId = $dataIsolation->getCurrentUserId() ?? $projectEntity->getUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode() ?: $organizationCode;

        $rootId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $requestDTO->getProjectId(),
            $workDir,
            (string) $userId,
            $organizationCode,
            $projectOrganizationCode
        );

        return (string) $rootId;
    }

    /**
     * Build relative paths based on parent_id chain instead of file_key.
     *
     * @param TaskFileEntity[] $entities
     * @param int $projectId Project ID from request context
     * @return array<int, string> [file_id => relative_path]
     */
    private function buildRelativePathsByParentIds(array $entities, int $projectId): array
    {
        if (empty($entities)) {
            return [];
        }

        $fileIds = array_values(array_unique(array_map(
            static fn (TaskFileEntity $entity): int => $entity->getFileId(),
            $entities
        )));

        $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds($fileIds, $projectId);
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);
        return RelativeFilePathUtil::buildPathMapByParentChain($entities, $fileMap);
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
        DataIsolation $dataIsolation,
        ProjectMode $projectMode = ProjectMode::CUSTOM_AGENT,
        bool $initTemplateFiles = true
    ): void {
        // Create (or locate) the project root directory
        $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            projectId: $projectEntity->getId(),
            workDir: $projectEntity->getWorkDir(),
            userId: $dataIsolation->getCurrentUserId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
        );

        if (! $initTemplateFiles) {
            $this->logger->info('Skip initializing template files for project', [
                'project_id' => $projectEntity->getId(),
                'project_mode' => $projectMode->value,
            ]);
            return;
        }

        $templateSubDir = match ($projectMode) {
            ProjectMode::MAGICLAW => 'magic_claw',
            default => 'custom_agent',
        };

        $templateRootDirId = $rootDirId;
        if ($projectMode === ProjectMode::MAGICLAW) {
            $templateRootDirId = $this->taskFileDomainService->createDirectory(
                projectId: $projectEntity->getId(),
                parentId: $rootDirId,
                dirName: '.magic',
                userId: $dataIsolation->getCurrentUserId(),
                organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
            );
        }

        $templateDir = BASE_PATH . '/storage/agent_template/' . $templateSubDir;

        if (! is_dir($templateDir)) {
            $this->logger->warning(sprintf('Agent template directory not found: %s', $templateDir));
            return;
        }

        $this->processTemplateDirectory($dataIsolation, $projectEntity, $templateDir, $templateRootDirId);
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
        // 将当前请求的动态参数写入话题
        if (! empty($requestDTO->getDynamicParams())) {
            $hiddenTopic->setDynamicParams($requestDTO->getDynamicParams());
        }

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
     * - Prepare IM topics for the committed conversation pair
     * - Create default topic
     * - Update workspace with current topic and project
     * - Update project with topic and work directory
     * - Initialize project members and settings
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param null|WorkspaceEntity $workspaceEntity Workspace entity (nullable for audio projects)
     * @param ProjectEntity $projectEntity Project entity (already created)
     * @param array{sender_conversation_id: string, receiver_conversation_id: string} $conversationPair Committed conversation identities
     * @return array{topic: TopicEntity, pending_default: array{chat_conversation_id: string, receive_conversation_id: string, chat_topic_id: string}}
     */
    private function initializeProject(
        DataIsolation $dataIsolation,
        ?WorkspaceEntity $workspaceEntity,
        ProjectEntity $projectEntity,
        array $conversationPair,
        ?array $dynamicParams = null,
        string $topicMode = '',
        string $agentCode = ''
    ): array {
        // 2. Get project work directory
        $workDir = WorkDirectoryUtil::getWorkDir(
            $dataIsolation->getCurrentUserId(),
            $projectEntity->getId()
        );

        // 3. Prepare IM topics; the transaction owner finalizes the returned default.
        $pendingDefault = $this->chatAppService->createMagicChatTopicForConversationPair($dataIsolation, $conversationPair);

        // 4. Create default topic
        $this->logger->info('开始创建默认话题');
        $topicEntity = $this->topicDomainService->createTopic(
            dataIsolation: $dataIsolation,
            workspaceId: $workspaceEntity?->getId(),
            projectId: $projectEntity->getId(),
            chatConversationId: $pendingDefault['chat_conversation_id'],
            chatTopicId: $pendingDefault['chat_topic_id'],
            topicName: '',
            workDir: $workDir,
            topicMode: $topicMode,
            source: CreationSource::USER_CREATED->value,
            sourceId: '',
            isHidden: false,
            hiddenType: null,
            dynamicParams: $dynamicParams,
            agentCode: $agentCode,
        );
        $this->taskFileDomainService->findOrCreateTopicRootDirectory(
            $projectEntity->getId(),
            $topicEntity->getId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $projectEntity->getUserOrganizationCode()
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

        return ['topic' => $topicEntity, 'pending_default' => $pendingDefault];
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
            $messageKey = match ($expectedType) {
                WorkspaceType::MicroApp => 'super_agent.invalid_workspace_type_for_micro_app_project',
                default => 'super_agent.invalid_workspace_type_for_audio_project',
            };

            ExceptionBuilder::throw(
                SuperAgentErrorCode::INVALID_WORKSPACE_TYPE,
                trans($messageKey),
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
