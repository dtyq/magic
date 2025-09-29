<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileCleanupAppService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService as MagicChatTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetWorkspaceTopicsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveWorkspaceResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\WorkspaceItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\WorkspaceListResponseDTO;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
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
        protected SandboxService $sandboxService,
        protected LockerInterface $locker,
        protected ChatAppService $chatAppService,
        protected ProjectDomainService $projectDomainService,
        protected TopicDomainService $topicDomainService,
        protected Producer $producer,
        protected LoggerFactory $loggerFactory,
        protected FileCleanupAppService $fileCleanupAppService,
        protected FileDomainService $fileDomainService,
        protected LongTermMemoryDomainService $longTermMemoryDomainService
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
            'id',
            'desc',
            $dataIsolation
        );

        // 设置默认值
        $result['auto_create'] = false;

        if (empty($result['list'])) {
            $workspaceEntity = $this->workspaceDomainService->createWorkspace(
                $dataIsolation,
                '',
                ''
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
        $workspaceStatusMap = $this->topicDomainService->calculateWorkspaceStatusBatch($workspaceIds);

        // 转换为响应DTO并传入状态映射
        return WorkspaceListResponseDTO::fromResult($result, $workspaceStatusMap);
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

    public function createWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): SaveWorkspaceResultDTO
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $workspaceEntity = $this->workspaceDomainService->createWorkspace(
            $dataIsolation,
            '',
            $requestDTO->getWorkspaceName()
        );

        return SaveWorkspaceResultDTO::fromId((int) $workspaceEntity->getId());
    }

    public function updateWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): SaveWorkspaceResultDTO
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();

        // Create data isolation object
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        if (empty($requestDTO->getWorkspaceId())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND);
        }

        $this->workspaceDomainService->updateWorkspace($dataIsolation, (int) $requestDTO->getWorkspaceId(), $requestDTO->getWorkspaceName());

        return SaveWorkspaceResultDTO::fromId((int) $requestDTO->getWorkspaceId());
    }

    /**
     * Save workspace (create or update).
     * @return SaveWorkspaceResultDTO Operation result, including workspace ID
     * @throws BusinessException Throws an exception if saving fails
     * @throws Throwable
     */
    public function saveWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): SaveWorkspaceResultDTO
    {
        Db::beginTransaction();
        try {
            // Get user authorization information
            $userAuthorization = $requestContext->getUserAuthorization();

            // Create data isolation object
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            // Prepare workspace entity
            if ($requestDTO->getWorkspaceId()) {
                // Update, currently only updates workspace name
                $this->workspaceDomainService->updateWorkspace($dataIsolation, (int) $requestDTO->getWorkspaceId(), $requestDTO->getWorkspaceName());
                Db::commit();
                return SaveWorkspaceResultDTO::fromId((int) $requestDTO->getWorkspaceId());
            }

            // 提交事务
            Db::commit();

            // Create, use provided workspace name if available; otherwise use default name
            $result = $this->initUserWorkspace($dataIsolation, $requestDTO->getWorkspaceName());
            return SaveWorkspaceResultDTO::fromId($result['workspace']->getId());
        } catch (EventException $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new workspace event: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, $e->getMessage());
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new workspace: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, 'topic.create_topic_failed');
        }
    }

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
        Db::beginTransaction();
        try {
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

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('删除工作区失败：' . $e->getMessage());
            throw $e;
        }

        return true;
    }

    /**
     * 获取任务详情.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $taskId 任务ID
     * @return array 任务详情
     * @throws BusinessException 如果用户无权限或任务不存在则抛出异常
     */
    public function getTaskDetail(RequestContext $requestContext, int $taskId): array
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取任务详情
        $taskEntity = $this->workspaceDomainService->getTaskById($taskId);
        if (! $taskEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'task.not_found');
        }

        return $taskEntity->toArray();
    }

    /**
     * 获取话题的消息列表.
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

    /**
     * 获取文件URL列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param array $fileIds 文件ID列表
     * @param string $downloadMode 下载模式（download:下载, preview:预览）
     * @param array $options 其他选项
     * @return array 文件URL列表
     */
    public function getFileUrls(MagicUserAuthorization $userAuthorization, array $fileIds, string $downloadMode, array $options = []): array
    {
        // 创建数据隔离对象
        $organizationCode = $userAuthorization->getOrganizationCode();
        $result = [];

        foreach ($fileIds as $fileId) {
            // 获取文件实体
            $fileEntity = $this->taskDomainService->getTaskFile((int) $fileId);
            if (empty($fileEntity)) {
                // 如果文件不存在，跳过
                continue;
            }

            // 验证文件是否属于当前用户
            $projectEntity = $this->getAccessibleProject($fileEntity->getProjectId(), $userAuthorization->getId(), $organizationCode);

            $downloadNames = [];
            if ($downloadMode === 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            $fileLink = $this->fileAppService->getLink($organizationCode, $fileEntity->getFileKey(), StorageBucketType::SandBox, $downloadNames, $options);
            if (empty($fileLink)) {
                // 如果获取URL失败，跳过
                continue;
            }

            // 只添加成功的结果
            $result[] = [
                'file_id' => $fileId,
                'url' => $fileLink->getUrl(),
            ];
        }

        return $result;
    }

    public function getTopicDetail(int $topicId): string
    {
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if (empty($topicEntity)) {
            return '';
        }
        return $topicEntity->getTopicName();
    }

    /**
     * 获取工作区信息通过话题ID集合.
     *
     * @param array $topicIds 话题ID集合（字符串数组）
     * @return array 以话题ID为键，工作区信息为值的关联数组
     */
    public function getWorkspaceInfoByTopicIds(array $topicIds): array
    {
        // 转换字符串ID为整数
        $intTopicIds = array_map('intval', $topicIds);

        // 调用领域服务获取工作区信息
        return $this->workspaceDomainService->getWorkspaceInfoByTopicIds($intTopicIds);
    }

    /**
     * 注册转换后的PDF文件以供定时清理.
     */
    public function registerConvertedPdfsForCleanup(MagicUserAuthorization $userAuthorization, array $convertedFiles): void
    {
        if (empty($convertedFiles)) {
            return;
        }

        $filesForCleanup = [];
        foreach ($convertedFiles as $file) {
            if (empty($file['oss_key']) || empty($file['filename'])) {
                continue;
            }

            $filesForCleanup[] = [
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'file_key' => $file['oss_key'],
                'file_name' => $file['filename'],
                'file_size' => $file['size'] ?? 0, // 如果响应中没有size，默认为0
                'source_type' => 'pdf_conversion',
                'source_id' => $file['batch_id'] ?? null,
                'expire_after_seconds' => 7200, // 2 小时后过期
                'bucket_type' => 'private',
            ];
        }

        if (! empty($filesForCleanup)) {
            $this->fileCleanupAppService->registerFilesForCleanup($filesForCleanup);
            $this->logger->info('[PDF Converter] Registered converted PDF files for cleanup', [
                'user_id' => $userAuthorization->getId(),
                'files_count' => count($filesForCleanup),
            ]);
        }
    }

    /**
     * 初始化用户工作区.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param string $workspaceName 工作区名称，默认为"我的工作区"
     * @return array 创建结果，包含workspace和topic实体对象，以及auto_create标志
     * @throws BusinessException 如果创建失败则抛出异常
     * @throws Throwable
     */
    private function initUserWorkspace(
        DataIsolation $dataIsolation,
        string $workspaceName = ''
    ): array {
        $this->logger->info('开始初始化用户工作区');
        Db::beginTransaction();
        try {
            // Step 1: Initialize Magic Chat Conversation
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);
            $this->logger->info(sprintf('初始化超级麦吉, chatConversationId=%s, chatConversationTopicId=%s', $chatConversationId, $chatConversationTopicId));

            // Step 2: Create workspace
            $this->logger->info('开始创建默认工作区');
            $workspaceEntity = $this->workspaceDomainService->createWorkspace(
                $dataIsolation,
                $chatConversationId,
                $workspaceName
            );
            $this->logger->info(sprintf('创建默认工作区成功, workspaceId=%s', $workspaceEntity->getId()));
            if (! $workspaceEntity->getId()) {
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.create_workspace_failed');
            }

            // 创建默认项目
            $this->logger->info('开始创建默认项目');
            $projectEntity = $this->projectDomainService->createProject(
                $workspaceEntity->getId(),
                '',
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '',
                '',
                null,
                CreationSource::USER_CREATED->value
            );
            $this->logger->info(sprintf('创建默认项目成功, projectId=%s', $projectEntity->getId()));
            // 获取工作区目录
            $workDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $projectEntity->getId());

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

            // Step 5: Update workspace current topic
            if ($topicEntity->getId()) {
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
            }
            Db::commit();

            // Return creation result
            return [
                'workspace' => $workspaceEntity,
                'topic' => $topicEntity,
                'project' => $projectEntity,
                'auto_create' => true,
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }
}
