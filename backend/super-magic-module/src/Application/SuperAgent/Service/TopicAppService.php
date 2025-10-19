<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTopicAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DeleteTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicItemDTO;
use Exception;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class TopicAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected TaskDomainService $taskDomainService,
        protected WorkspaceDomainService $workspaceDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TopicDomainService $topicDomainService,
        protected ResourceShareDomainService $resourceShareDomainService,
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected FileAppService $fileAppService,
        protected ChatAppService $chatAppService,
        protected Producer $producer,
        protected EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function getTopic(RequestContext $requestContext, int $id): TopicItemDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取话题内容
        $topicEntity = $this->topicDomainService->getTopicById($id);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 判断话题是否是本人
        if ($topicEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.access_denied');
        }

        return TopicItemDTO::fromEntity($topicEntity);
    }

    public function getTopicById(int $id): TopicItemDTO
    {
        // 获取话题内容
        $topicEntity = $this->topicDomainService->getTopicById($id);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        return TopicItemDTO::fromEntity($topicEntity);
    }

    public function createTopic(RequestContext $requestContext, SaveTopicRequestDTO $requestDTO): TopicItemDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $requestDTO->getProjectId());
        $this->validateEditorPermission($userAuthorization, (int) $requestDTO->getProjectId());

        // 创建新话题，使用事务确保原子性
        Db::beginTransaction();
        try {
            // 1. 初始化 chat 的会话和话题
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

            // 2. 创建话题
            $topicEntity = $this->topicDomainService->createTopic(
                $dataIsolation,
                $projectEntity->getWorkspaceId(),
                (int) $requestDTO->getProjectId(),
                $chatConversationId,
                $chatConversationTopicId, // 会话的话题ID
                $requestDTO->getTopicName(),
                $projectEntity->getWorkDir(),
            );

            // 3. 如果传入了 project_mode，更新项目的模式
            if (! empty($requestDTO->getProjectMode())) {
                $projectEntity->setProjectMode($requestDTO->getProjectMode());
                $projectEntity->setUpdatedAt(date('Y-m-d H:i:s'));
                $this->projectDomainService->saveProjectEntity($projectEntity);
            }
            // 提交事务
            Db::commit();

            // 发布话题已创建事件
            $topicCreatedEvent = new TopicCreatedEvent($topicEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($topicCreatedEvent);

            // 返回结果
            return TopicItemDTO::fromEntity($topicEntity);
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new topic: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, 'topic.create_topic_failed');
        }
    }

    public function createTopicNotValidateAccessibleProject(RequestContext $requestContext, SaveTopicRequestDTO $requestDTO): ?TopicItemDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $requestDTO->getProjectId());

        // 创建新话题，使用事务确保原子性
        Db::beginTransaction();
        try {
            // 1. 初始化 chat 的会话和话题
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

            // 2. 创建话题
            $topicEntity = $this->topicDomainService->createTopic(
                $dataIsolation,
                (int) $requestDTO->getWorkspaceId(),
                (int) $requestDTO->getProjectId(),
                $chatConversationId,
                $chatConversationTopicId, // 会话的话题ID
                $requestDTO->getTopicName(),
                $projectEntity->getWorkDir(),
                $requestDTO->getTopicMode(),
            );

            // 3. 如果传入了 project_mode，更新项目的模式
            if (! empty($requestDTO->getProjectMode())) {
                $projectEntity->setProjectMode($requestDTO->getProjectMode());
                $projectEntity->setUpdatedAt(date('Y-m-d H:i:s'));
                $this->projectDomainService->saveProjectEntity($projectEntity);
            }
            // 提交事务
            Db::commit();
            // 返回结果
            return TopicItemDTO::fromEntity($topicEntity);
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new topic: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, 'topic.create_topic_failed');
        }
    }

    public function updateTopic(RequestContext $requestContext, SaveTopicRequestDTO $requestDTO): SaveTopicResultDTO
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $this->topicDomainService->updateTopic($dataIsolation, (int) $requestDTO->getId(), $requestDTO->getTopicName());

        // 获取更新后的话题实体用于事件发布
        $topicEntity = $this->topicDomainService->getTopicById((int) $requestDTO->getId());

        // 发布话题已更新事件
        if ($topicEntity) {
            $topicUpdatedEvent = new TopicUpdatedEvent($topicEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($topicUpdatedEvent);
        }

        return SaveTopicResultDTO::fromId((int) $requestDTO->getId());
    }

    public function renameTopic(MagicUserAuthorization $authorization, int $topicId, string $userQuestion, string $language = 'zh_CN'): array
    {
        // 获取话题内容
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 调用领域服务执行重命名（这一步与magic-service进行绑定）
        try {
            $text = $this->magicChatMessageAppService->summarizeText($authorization, $userQuestion, $language);
            // 更新话题名称
            $dataIsolation = $this->createDataIsolation($authorization);
            $this->topicDomainService->updateTopicName($dataIsolation, $topicId, $text);

            // 获取更新后的话题实体并发布重命名事件
            $updatedTopicEntity = $this->topicDomainService->getTopicById($topicId);
            if ($updatedTopicEntity) {
                $topicRenamedEvent = new TopicRenamedEvent($updatedTopicEntity, $authorization);
                $this->eventDispatcher->dispatch($topicRenamedEvent);
            }
        } catch (Exception $e) {
            $this->logger->error('rename topic error: ' . $e->getMessage());
            $text = $topicEntity->getTopicName();
        }

        return ['topic_name' => $text];
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

        // 先获取话题实体用于事件发布
        $topicEntity = $this->topicDomainService->getTopicById((int) $topicId);

        // 调用领域服务执行删除
        $result = $this->topicDomainService->deleteTopic($dataIsolation, (int) $topicId);

        // 投递事件，停止服务
        if ($result) {
            // 发布话题已删除事件
            if ($topicEntity) {
                $topicDeletedEvent = new TopicDeletedEvent($topicEntity, $userAuthorization);
                $this->eventDispatcher->dispatch($topicDeletedEvent);
            }

            $event = new StopRunningTaskEvent(
                DeleteDataType::TOPIC,
                (int) $topicId,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                '话题已被删除'
            );
            $publisher = new StopRunningTaskPublisher($event);
            $this->producer->produce($publisher);
        }

        // 如果删除失败，抛出异常
        if (! $result) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'topic.delete_failed');
        }

        // 返回删除结果
        return DeleteTopicResultDTO::fromId((int) $topicId);
    }

    /**
     * 获取最近更新时间超过指定时间的话题列表.
     *
     * @param string $timeThreshold 时间阈值，如果话题的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TopicEntity> 话题实体列表
     */
    public function getTopicsExceedingUpdateTime(string $timeThreshold, int $limit = 100): array
    {
        return $this->topicDomainService->getTopicsExceedingUpdateTime($timeThreshold, $limit);
    }

    public function getTopicByChatTopicId(DataIsolation $dataIsolation, string $chatTopicId): ?TopicEntity
    {
        return $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $chatTopicId);
    }

    public function getTopicAttachmentsByAccessToken(GetTopicAttachmentsRequestDTO $requestDto): array
    {
        $token = $requestDto->getToken();
        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }
        // 从token 获取内容
        $shareId = AccessTokenUtil::getShareId($token);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
        }
        if ($shareEntity->getResourceType() != ResourceType::Topic->value) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $requestDto->setTopicId($shareEntity->getResourceId());

        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
    }

    public function getTopicAttachmentList(DataIsolation $dataIsolation, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 判断话题是否存在
        $topicEntity = $this->topicDomainService->getTopicById((int) $requestDto->getTopicId());
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
            $dto->isHidden = $entity->getIsHidden();
            $dto->topicId = (string) $entity->getTopicId();

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
                $fileLink = $this->fileAppService->getLink($organizationCode, $fileKey, StorageBucketType::SandBox);
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
        $tree = FileTreeUtil::assembleFilesTree($list);

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $result['total'],
        ];
    }

    /**
     * 获取话题的附件列表.(管理后台使用).
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param GetTopicAttachmentsRequestDTO $requestDto 话题附件请求DTO
     * @return array 附件列表
     */
    public function getTopicAttachments(MagicUserAuthorization $userAuthorization, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 获取当前话题的创建者
        $topicEntity = $this->topicDomainService->getTopicById((int) $requestDto->getTopicId());
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
    }

    /**
     * 获取用户话题消息列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param string $sortDirection 排序方向
     * @return array 消息列表及总数
     */
    public function getUserTopicMessage(MagicUserAuthorization $userAuthorization, int $topicId, int $page, int $pageSize, string $sortDirection): array
    {
        // 获取消息列表
        $result = $this->taskDomainService->getMessagesByTopicId($topicId, $page, $pageSize, true, $sortDirection);

        // 转换为响应格式
        $messages = [];
        foreach ($result['list'] as $message) {
            $messages[] = new MessageItemDTO($message->toArray());
        }

        return [
            'list' => $messages,
            'total' => $result['total'],
        ];
    }

    /**
     * 获取用户话题附件 URL. (管理后台使用).
     *
     * @param string $topicId 话题 ID
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param array $fileIds 文件ID列表
     * @return array 包含附件 URL 的数组
     */
    public function getTopicAttachmentUrl(MagicUserAuthorization $userAuthorization, string $topicId, array $fileIds, string $downloadMode): array
    {
        $result = [];
        foreach ($fileIds as $fileId) {
            // 获取文件实体
            $fileEntity = $this->taskDomainService->getTaskFile((int) $fileId);
            if (empty($fileEntity)) {
                // 如果文件不存在，跳过
                continue;
            }
            $downloadNames = [];
            if ($downloadMode == 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }

            $fileLink = $this->fileAppService->getLink($fileEntity->getOrganizationCode(), $fileEntity->getFileKey(), StorageBucketType::SandBox, $downloadNames);
            if (empty($fileLink)) {
                // 如果获取链接失败，跳过
                continue;
            }

            $result[] = [
                'file_id' => (string) $fileEntity->getFileId(),
                'url' => $fileLink->getUrl(),
            ];
        }
        return $result;
    }
}
