<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
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
        private readonly ChatAppService $chatAppService,
        private readonly FileAppService $fileAppService,
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

        Db::beginTransaction();
        try {
            // 创建默认项目
            $this->logger->info('创建默认项目');
            $projectEntity = $this->projectDomainService->createProject(
                $workspaceEntity->getId(),
                $requestDTO->getProjectName(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
            $this->logger->info(sprintf('创建默认项目, projectId=%s', $projectEntity->getId()));
            // 获取项目目录
            $workDir = WorkDirectoryUtil::generateWorkDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());

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
        $projectEntity->setWorkspaceId($requestDTO->getWorkspaceId());
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
            // todo 投递消息，停止正在运行的话题
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
        $projectIds = array_unique(array_map(fn ($project) => $project->getId(), $result['list'] ?? []));

        // 提取所有工作区ID
        $workspaceIds = array_unique(array_map(fn ($project) => $project->getWorkspaceId(), $result['list'] ?? []));

        // 批量获取项目状态
        $projectStatusMap = $this->topicDomainService->calculateProjectStatusBatch($projectIds);

        // 批量获取工作区名称
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 创建响应DTO并传入项目状态映射和工作区名称映射
        $listResponseDTO = ProjectListResponseDTO::fromResult($result, $projectStatusMap, $workspaceNameMap);

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

    /**
     * 获取项目附件列表.
     */
    public function getProjectAttachments(RequestContext $requestContext, GetProjectAttachmentsRequestDTO $requestDTO): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 验证项目权限
        $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getProjectId(), $dataIsolation->getCurrentUserId());

        // 通过任务领域服务获取项目下的附件列表
        $result = $this->taskDomainService->getTaskAttachmentsByProjectId(
            (int) $requestDTO->getProjectId(),
            $dataIsolation,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getFileType()
        );

        // 处理文件 URL
        $list = [];
        $organizationCode = $userAuthorization->getOrganizationCode();

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
            $dto->isHidden = $entity->getIsHidden();

            // 添加 project_id 字段
            $dto->projectId = (string) $entity->getProjectId();

            // Calculate relative file path by removing workDir from fileKey
            $fileKey = $entity->getFileKey();
            $workDir = $projectEntity->getWorkDir();
            if (! empty($workDir)) {
                $workDirPos = strpos($fileKey, $workDir);
                if ($workDirPos !== false) {
                    $dto->relativeFilePath = substr($fileKey, $workDirPos + strlen($workDir));
                } else {
                    $dto->relativeFilePath = $fileKey; // If workDir not found, use original fileKey
                }
            } else {
                $dto->relativeFilePath = $fileKey;
            }

            // 添加 file_url 字段
            if (! empty($fileKey)) {
                $fileLink = $this->fileAppService->getLink($organizationCode, $fileKey);
                if ($fileLink) {
                    $dto->fileUrl = $fileLink->getUrl();
                } else {
                    $dto->fileUrl = '';
                }
            } else {
                $dto->fileUrl = '';
            }

            $list[] = $dto->toArray();
        }

        // 构建树状结构
        $tree = FileTreeUtil::assembleFilesTree($projectEntity->getWorkDir() ?? '', $list);

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $result['total'],
        ];
    }
}
