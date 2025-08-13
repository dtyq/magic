<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicItemDTO;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 项目应用服务
 */
class ProjectAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly Producer $producer,
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

            Db::commit();
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

        return ProjectItemDTO::fromEntity($projectEntity)->toArray();
    }

    /**
     * 删除项目.
     */
    public function deleteProject(RequestContext $requestContext, int $projectId): bool
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 删除话题
        $result = $this->projectDomainService->deleteProject($projectId, $dataIsolation->getCurrentUserId());

        if ($result) {
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
    public function getProject(int $projectId, string $userId): ProjectEntity
    {
        return $this->projectDomainService->getProject($projectId, $userId);
    }

    /**
     * 获取项目详情.
     */
    public function getProjectNotUserId(int $projectId): ProjectEntity
    {
        return $this->projectDomainService->getProjectNotUserId($projectId);
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

        $result = $this->projectDomainService->getProjectsByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            'updated_at',
            'desc'
        );

        // 提取所有项目ID
        // $projectIds = array_unique(array_map(fn ($project) => $project->getId(), $result['list'] ?? []));

        // 提取所有工作区ID
        $workspaceIds = array_unique(array_map(fn ($project) => $project->getWorkspaceId(), $result['list'] ?? []));

        // 批量获取项目状态
        // $projectStatusMap = $this->topicDomainService->calculateProjectStatusBatch($projectIds);

        // 批量获取工作区名称
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 创建响应DTO并传入项目状态映射和工作区名称映射
        $listResponseDTO = ProjectListResponseDTO::fromResult($result, $workspaceNameMap);

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
        $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());

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
        $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getProjectId(), $userAuthorization->getId());

        // 验证项目所有权
        if ($projectEntity->getCreatedUid() != $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        // 创建基于用户的数据隔离
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取附件列表（传入workDir用于相对路径计算）
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
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        $topicId = AccessTokenUtil::getResource($token);
        $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $requestDto->setProjectId((string) $topicEntity->getProjectId());

        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');

        // 令牌模式不需要workDir处理，传空字符串
        return $this->getProjectAttachmentList($dataIsolation, $requestDto, $topicEntity->getWorkDir());
    }

    public function getCloudFiles(RequestContext $requestContext, int $projectId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
        return $this->taskFileDomainService->getProjectFilesFromCloudStorage($dataIsolation->getCurrentOrganizationCode(), $projectEntity->getWorkDir());
    }

    /**
     * 获取项目附件列表的核心逻辑.
     */
    private function getProjectAttachmentList(DataIsolation $dataIsolation, GetProjectAttachmentsRequestDTO $requestDTO, string $workDir = ''): array
    {
        // 通过任务领域服务获取项目下的附件列表
        $result = $this->taskDomainService->getTaskAttachmentsByProjectId(
            (int) $requestDTO->getProjectId(),
            $dataIsolation,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getFileType(),
            StorageType::WORKSPACE->value
        );

        //        $workDir = $this->fileDomainService->getFullWorkDir(
        //            $dataIsolation->getCurrentOrganizationCode(),
        //            $dataIsolation->getCurrentUserId(),
        //            (int) $requestDTO->getProjectId(),
        //            AgentConstant::SUPER_MAGIC_CODE,
        //            AgentConstant::DEFAULT_PROJECT_DIR
        //        );

        // $result = $this->workspaceDomainService->filterResultByGitVersion($result, (int) $requestDTO->getProjectId(), $dataIsolation->getCurrentOrganizationCode(), $workDir);

        // 处理文件 URL
        $list = [];
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
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

            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
            // 判断file key是否重复，如果重复，则跳过
            if (in_array($fileKey, $fileKeys)) {
                continue;
            }
            $fileKeys[] = $fileKey;
            $list[] = $dto->toArray();
        }

        // 构建树状结构（登录用户模式特有功能）
        $tree = FileTreeUtil::assembleFilesTree($list);

        return [
            'total' => $result['total'],
            'list' => $list,
            'tree' => $tree,
        ];
    }
}
