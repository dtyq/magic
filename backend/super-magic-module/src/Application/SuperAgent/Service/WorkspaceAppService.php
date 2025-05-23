<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceCreationParams;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTopicAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetWorkspaceTopicsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DeleteTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveWorkspaceResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\WorkspaceListResponseDTO;
use Exception;
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
        protected MagicTopicDomainService $topicDomainService,
        protected FileAppService $fileAppService,
        protected TaskDomainService $taskDomainService,
        protected AccountAppService $accountAppService,
        protected SandboxService $sandboxService,
        protected LockerInterface $locker,
        LoggerFactory $loggerFactory
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
            $dataIsolation
        );

        // 设置默认值
        $result['auto_create'] = false;

        // 如果有工作区列表，获取所有工作区的话题列表
        if (! empty($result['list'])) {
            $workspaceIds = [];
            foreach ($result['list'] as $workspace) {
                $workspaceIds[] = $workspace->getId();
            }

            // 获取所有工作区的话题列表，以工作区ID为键
            $topicList = $this->workspaceDomainService->getWorkspaceTopics($workspaceIds, $dataIsolation, false);
            $topics = [];
            // 重新按工作区 ID 分组
            foreach ($topicList['list'] as $topic) {
                $workspaceId = (int) $topic->getWorkspaceId();
                if (! isset($topics[$workspaceId])) {
                    $topics[$workspaceId] = [];
                }
                $topics[$workspaceId][] = $topic;
            }
            $result['topics'] = $topics;
        } else {
            // 如果 result 为空则创建一个默认会话和话题，并新建一个工作区和目录与其绑定
            // 使用默认的工作区名称和话题名称创建工作区
            $creationResult = $this->initUserWorkspace($dataIsolation);

            // 将新创建的工作区添加到结果中
            if (! empty($creationResult['workspace'])) {
                $result['list'] = [$creationResult['workspace']];
                $result['total'] = 1;
                $result['auto_create'] = $creationResult['auto_create']; // 使用创建结果中的auto_create
                // 使用创建时返回的任务状态信息
                $workspaceId = $creationResult['workspace']->getId();
                $result['topics'][$workspaceId] = [$creationResult['topic']];
            }
        }
        // 转换为响应DTO
        return WorkspaceListResponseDTO::fromResult($result);
    }

    /**
     * 保存工作区（创建或更新）.
     * @return SaveWorkspaceResultDTO 操作结果，包含工作区ID
     * @throws BusinessException 如果保存失败则抛出异常
     * @throws Throwable
     */
    public function saveWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): SaveWorkspaceResultDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 准备工作区实体
        if ($requestDTO->getWorkspaceId()) {
            // 更新, 目前只更新工作区名称
            $this->workspaceDomainService->updateWorkspace($dataIsolation, (int) $requestDTO->getWorkspaceId(), $requestDTO->getWorkspaceName());
            return SaveWorkspaceResultDTO::fromId((int) $requestDTO->getWorkspaceId());
        }

        // 创建，如果有提供工作区名称，则使用；否则使用默认名称
        $result = $this->initUserWorkspace($dataIsolation, $requestDTO->getWorkspaceName());
        return SaveWorkspaceResultDTO::fromId($result['workspace']->getId());
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
     * 获取话题的附件列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param GetTopicAttachmentsRequestDTO $requestDto 话题附件请求DTO
     * @return array 附件列表
     */
    public function getTopicAttachments(MagicUserAuthorization $userAuthorization, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 获取当前话题的创建者
        $topicEntity = $this->workspaceDomainService->getTopicById((int) $requestDto->getTopicId());
        if (empty($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        if ($topicEntity->getCreatedUid() != $userAuthorization->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'topic.access_topic_attachment_denied');
        }
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
    }

    public function getTopicAttachmentsByAccessToken(GetTopicAttachmentsRequestDTO $requestDto): array
    {
        $token = $requestDto->getToken();
        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }
        // 从token 获取内容
        $topicId = AccessTokenUtil::getResource($token);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $requestDto->setTopicId($topicId);

        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
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

            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
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
        return $this->workspaceDomainService->deleteWorkspace($dataIsolation, $workspaceId);
    }

    public function getTopic(RequestContext $requestContext, int $id): TopicItemDTO
    {
        // 获取话题内容
        $topicEntity = $this->workspaceDomainService->getTopicById($id);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic.not_found');
        }

        return TopicItemDTO::fromEntity($topicEntity);
    }

    /**
     * 保存话题（创建或更新）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param SaveTopicRequestDTO $requestDTO 请求DTO
     * @return SaveTopicResultDTO 保存结果
     * @throws BusinessException|Exception 如果保存失败则抛出异常
     */
    public function saveTopic(RequestContext $requestContext, SaveTopicRequestDTO $requestDTO): SaveTopicResultDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 如果有ID，表示更新；否则是创建
        if ($requestDTO->isUpdate()) {
            return $this->updateTopic($dataIsolation, $requestDTO);
        }

        return $this->createNewTopic($dataIsolation, $requestDTO);
    }

    /**
     * 删除话题.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param DeleteTopicRequestDTO $requestDTO 请求DTO
     * @return DeleteTopicResultDTO 删除结果
     * @throws BusinessException|Exception 如果用户无权限、话题不存在或任务正在运行
     */
    public function deleteTopic(RequestContext $requestContext, DeleteTopicRequestDTO $requestDTO): DeleteTopicResultDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取话题ID
        $topicId = $requestDTO->getId();

        // 调用领域服务执行删除
        $result = $this->workspaceDomainService->deleteTopic($dataIsolation, (int) $topicId);

        // 如果删除失败，抛出异常
        if (! $result) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic.delete_failed');
        }

        // 返回删除结果
        return DeleteTopicResultDTO::fromId((int) $topicId);
    }

    public function renameTopic(MagicUserAuthorization $authorization, int $topicId, string $userQuestion): array
    {
        // 获取话题内容
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic.not_found');
        }

        // 如果当前话题已经被命名，则不进行重命名
        if ($topicEntity->getTopicName() !== AgentConstant::DEFAULT_TOPIC_NAME) {
            return ['topic_name' => $topicEntity->getTopicName()];
        }

        // 调用领域服务执行重命名（这一步与magic-service进行绑定）
        try {
            $text = $this->magicChatMessageAppService->summarizeText($authorization, $userQuestion);
            // 更新话题名称
            $dataIsolation = $this->createDataIsolation($authorization);
            $this->workspaceDomainService->updateTopicName($dataIsolation, $topicId, $text);
        } catch (Exception $e) {
            $this->logger->error('rename topic error: ' . $e->getMessage());
            $text = $topicEntity->getTopicName();
        }

        return ['topic_name' => $text];
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
     * 获取话题下的任务列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 任务列表
     */
    public function getTasksByTopicId(RequestContext $requestContext, string $topicId, int $page = 1, int $pageSize = 10): array
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 获取任务列表
        return $this->workspaceDomainService->getTasksByTopicId((int) $topicId, $page, $pageSize, $dataIsolation);
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
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if ($topicEntity != null) {
            $data['sandbox_id'] = $topicEntity->getSandboxId();
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
     * @return array 文件URL列表
     */
    public function getFileUrls(MagicUserAuthorization $userAuthorization, array $fileIds, string $downloadMode): array
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
            $topicEntity = $this->workspaceDomainService->getTopicById($fileEntity->getTopicId());
            if (empty($topicEntity) || $topicEntity->getUserId() !== $userAuthorization->getId()) {
                // 如果这个话题不是本人的，不处理
                continue;
            }

            $downloadNames = [];
            if ($downloadMode == 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            $fileLink = $this->fileAppService->getLink($organizationCode, $fileEntity->getFileKey(), null, $downloadNames);
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

    /**
     * 通过访问令牌获取文件URL列表.
     *
     * @param array $fileIds 文件ID列表
     * @param string $token 访问令牌
     * @param string $downloadMode 下载模式 默认下载 download 预览 preview
     * @return array 文件URL列表
     */
    public function getFileUrlsByAccessToken(array $fileIds, string $token, string $downloadMode): array
    {
        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }

        // 从token获取内容
        $topicId = AccessTokenUtil::getResource($token);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $result = [];

        foreach ($fileIds as $fileId) {
            $fileEntity = $this->taskDomainService->getTaskFile((int) $fileId);
            if (empty($fileEntity) || $fileEntity->getTopicId() != $topicId) {
                // 如果文件不存在或不属于该话题，跳过
                continue;
            }

            $downloadNames = [];
            if ($downloadMode == 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            $fileLink = $this->fileAppService->getLink($organizationCode, $fileEntity->getFileKey(), null, $downloadNames);
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

    public function getTopicAttachmentList(DataIsolation $dataIsolation, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 判断话题是否存在
        $topicEntity = $this->workspaceDomainService->getTopicById((int) $requestDto->getTopicId());
        if (empty($topicEntity)) {
            return [];
        }
        $sandboxId = $topicEntity->getSandboxId();
        $workDir = $topicEntity->getWorkDir();

        // 通过领域服务获取话题附件列表
        $result = $this->taskDomainService->getTaskAttachmentsByTopicId(
            (int) $requestDto->getTopicId(),
            $dataIsolation,
            $requestDto->getPage(),
            $requestDto->getPageSize(),
            $requestDto->getFileType()
        );

        // 处理文件 URL
        $list = [];
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

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
            
            // Calculate relative file path by removing workDir from fileKey
            $fileKey = $entity->getFileKey();
            $workDirPos = strpos($fileKey, $workDir);
            if ($workDirPos !== false) {
                $dto->relativeFilePath = substr($fileKey, $workDirPos + strlen($workDir));
            } else {
                $dto->relativeFilePath = $fileKey; // If workDir not found, use original fileKey
            }
            
            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
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
        $tree = $this->assembleTaskFilesTree($sandboxId, $workDir, $list);

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $result['total'],
        ];
    }

    /**
     * 将文件列表组装成树状结构，支持无限极嵌套.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $workDir 工作目录
     * @param array $files 文件列表数据
     * @return array 组装后的树状结构数据
     */
    private function assembleTaskFilesTree(string $sandboxId, string $workDir, array $files): array
    {
        if (empty($files)) {
            return [];
        }

        // 文件树根节点
        $root = [
            'type' => 'root',
            'is_directory' => true,
            'children' => [],
        ];

        // 目录映射，用于快速查找目录节点
        $directoryMap = ['' => &$root]; // 根目录的引用

        // 去掉workDir开头可能的斜杠，确保匹配
        $workDir = ltrim($workDir, '/');

        // 遍历所有文件路径，确定根目录
        $rootDir = '';
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 查找workDir在文件路径中的位置
            $workDirPos = strpos($filePath, $workDir);
            if ($workDirPos === false) {
                continue; // 找不到workDir，跳过
            }

            // 获取workDir结束的位置
            $rootDir = substr($filePath, 0, $workDirPos + strlen($workDir));
            break;
        }

        // 如果没有找到有效的根目录，创建一个扁平的目录结构
        if (empty($rootDir)) {
            // 直接将所有文件作为根节点的子节点
            foreach ($files as $file) {
                if (empty($file['file_key'])) {
                    continue; // 跳过没有文件路径的记录
                }

                // 提取文件名，通常是路径最后一部分
                $pathParts = explode('/', $file['file_key']);
                $fileName = end($pathParts);

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];
                $fileNode['name'] = $fileName;

                // 添加到根节点
                $root['children'][] = $fileNode;
            }

            return $root['children'];
        }

        // 处理所有文件
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 提取相对路径
            if (strpos($filePath, $rootDir) === 0) {
                // 移除根目录前缀，获取相对路径
                $relativePath = substr($filePath, strlen($rootDir));
                $relativePath = ltrim($relativePath, '/');

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];

                // 如果相对路径为空，表示文件直接位于根目录
                if (empty($relativePath)) {
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 分析相对路径，提取目录部分和文件名
                $pathParts = explode('/', $relativePath);
                $fileName = array_pop($pathParts); // 移除并获取最后一部分作为文件名

                if (empty($pathParts)) {
                    // 没有目录部分，文件直接位于根目录下
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 逐级构建目录
                $currentPath = '';
                $parent = &$root;

                foreach ($pathParts as $dirName) {
                    if (empty($dirName)) {
                        continue; // 跳过空目录名
                    }

                    // 更新当前路径
                    $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";

                    // 如果当前路径的目录不存在，创建它
                    if (! isset($directoryMap[$currentPath])) {
                        // 创建新目录节点
                        $newDir = [
                            'name' => $dirName,
                            'path' => $currentPath,
                            'type' => 'directory',
                            'is_directory' => true,
                            'children' => [],
                        ];

                        // 将新目录添加到父目录的子项中
                        $parent['children'][] = $newDir;

                        // 保存目录引用到映射中
                        $directoryMap[$currentPath] = &$parent['children'][count($parent['children']) - 1];
                    }

                    // 更新父目录引用为当前目录
                    $parent = &$directoryMap[$currentPath];
                }

                // 将文件添加到最终目录的子项中
                $parent['children'][] = $fileNode;
            }
        }

        // 返回根目录的子项作为结果
        return $root['children'];
    }

    /**
     * 更新话题.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param SaveTopicRequestDTO $requestDTO 请求DTO
     * @return SaveTopicResultDTO 更新结果
     * @throws BusinessException 如果更新失败则抛出异常
     */
    private function updateTopic(DataIsolation $dataIsolation, SaveTopicRequestDTO $requestDTO): SaveTopicResultDTO
    {
        // 更新话题名称
        $result = $this->workspaceDomainService->updateTopicName(
            $dataIsolation,
            (int) $requestDTO->getId(), // 传递主键ID
            $requestDTO->getTopicName()
        );

        if (! $result) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic.update_failed');
        }

        return SaveTopicResultDTO::fromId((int) $requestDTO->getId());
    }

    /**
     * 创建新话题.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param SaveTopicRequestDTO $requestDTO 请求DTO
     * @return SaveTopicResultDTO 创建结果
     * @throws BusinessException|Throwable 如果创建失败则抛出异常
     */
    private function createNewTopic(DataIsolation $dataIsolation, SaveTopicRequestDTO $requestDTO): SaveTopicResultDTO
    {
        // 创建新话题，使用事务确保原子性
        Db::beginTransaction();
        try {
            // 1. 初始化 chat 的会话和话题
            [$chatConversationId, $chatConversationTopicId] = $this->initMagicChatConversation($dataIsolation);

            // 2. 创建话题
            $topicEntity = $this->workspaceDomainService->createTopic(
                $dataIsolation,
                (int) $requestDTO->getWorkspaceId(),
                $chatConversationTopicId, // 会话的话题ID
                $requestDTO->getTopicName()
            );

            // 提交事务
            Db::commit();

            // 返回结果
            return SaveTopicResultDTO::fromId((int) $topicEntity->getId());
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            throw $e;
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
        string $workspaceName = AgentConstant::DEFAULT_WORKSPACE_NAME
    ): array {
        $this->logger->info('开始初始化用户工作区');
        // 获取超级麦吉用户
        [$chatConversationId, $chatConversationTopicId] = $this->initMagicChatConversation($dataIsolation);
        $this->logger->info(sprintf('初始化超级麦吉, chatConversationId=%s, chatConversationTopicId=%s', $chatConversationId, $chatConversationTopicId));
        // 新建工作区，绑定会话id
        $result = $this->workspaceDomainService->createWorkspace(
            $dataIsolation,
            new WorkspaceCreationParams(
                $chatConversationId,
                $workspaceName, // 使用参数中的工作区名称
                $chatConversationTopicId,
                AgentConstant::DEFAULT_TOPIC_NAME // 使用固定的话题名称
            )
        );
        $workspaceEntity = $result['workspace'];
        $topicEntity = $result['topic'];

        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.create_workspace_failed');
        }
        // 返回创建的结果，包含实体对象和auto_create=true
        return [
            'workspace' => $workspaceEntity,  // 直接返回实体对象
            'topic' => $topicEntity,  // 直接返回实体对象
            'auto_create' => true,  // 添加auto_create字段
        ];
    }

    /**
     * 初始化麦吉聊天记录.
     * @throws Throwable
     */
    private function initMagicChatConversation(DataIsolation $dataIsolation): array
    {
        $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
        if (empty($aiUserEntity)) {
            // 手动做一次初始化
            $this->accountAppService->initAccount($dataIsolation->getCurrentOrganizationCode());
            // 再查一次
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
            if (empty($aiUserEntity)) {
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.super_magic_user_not_found');
            }
        }
        // 为用户初始化会话和话题
        $senderConversationEntity = $this->magicConversationDomainService->getOrCreateConversation(
            $dataIsolation->getCurrentUserId(),
            $aiUserEntity->getUserId(),
            ConversationType::Ai
        );
        // 为收发双方创建相同的话题 id
        $topicId = $this->topicDomainService->agentSendMessageGetTopicId($senderConversationEntity, 3);
        return [$senderConversationEntity->getId(), $topicId];
    }
}
