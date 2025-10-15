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
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\TopicDuplicateConstant;
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
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DuplicateTopicRequestDTO;
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

use function Hyperf\Coroutine\go;

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
        protected TopicDuplicateStatusManager $topicDuplicateStatusManager,
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

        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

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

    /**
     * Duplicate topic (synchronous) - blocks until completion.
     * This method performs complete topic duplication synchronously without task management.
     *
     * @param RequestContext $requestContext Request context
     * @param string $sourceTopicId Source topic ID
     * @param DuplicateTopicRequestDTO $requestDTO Request DTO
     * @return array Complete result with topic info
     * @throws BusinessException If validation fails or operation fails
     */
    public function duplicateTopic(RequestContext $requestContext, string $sourceTopicId, DuplicateTopicRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        $this->logger->info('Topic duplication sync started', [
            'user_id' => $userAuthorization->getId(),
            'source_topic_id' => $sourceTopicId,
            'target_message_id' => $requestDTO->getTargetMessageId(),
            'new_topic_name' => $requestDTO->getNewTopicName(),
        ]);

        // Validate topic and permissions
        $sourceTopicEntity = $this->topicDomainService->getTopicById((int) $sourceTopicId);
        if (! $sourceTopicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        if ($sourceTopicEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.access_denied');
        }

        // Create data isolation
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Execute complete duplication in transaction
        Db::beginTransaction();
        try {
            // Call domain service - pure business logic
            $newTopicEntity = $this->topicDomainService->duplicateTopic(
                $dataIsolation,
                $sourceTopicEntity,
                $requestDTO->getNewTopicName(),
                (int) $requestDTO->getTargetMessageId()
            );

            Db::commit();

            $this->logger->info('Topic duplication sync completed', [
                'source_topic_id' => $sourceTopicId,
                'new_topic_id' => $newTopicEntity->getId(),
            ]);

            // Return complete result
            return [
                'status' => 'completed',
                'message' => 'Topic duplicated successfully',
                'topic' => TopicItemDTO::fromEntity($newTopicEntity)->toArray(),
            ];
        } catch (Throwable $e) {
            Db::rollBack();

            $this->logger->error('Topic duplication sync failed', [
                'source_topic_id' => $sourceTopicId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Duplicate topic (asynchronous) - returns immediately with task_id.
     * This method creates topic skeleton synchronously, then copies messages asynchronously.
     *
     * @param RequestContext $requestContext Request context
     * @param string $sourceTopicId Source topic ID
     * @param DuplicateTopicRequestDTO $requestDTO Request DTO
     * @return array Task info with task_id
     * @throws BusinessException If validation fails or operation fails
     */
    public function duplicateChatAsync(RequestContext $requestContext, string $sourceTopicId, DuplicateTopicRequestDTO $requestDTO): array
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        $this->logger->info('Starting topic duplication async (skeleton sync + message copy async)', [
            'user_id' => $userAuthorization->getId(),
            'source_topic_id' => $sourceTopicId,
            'target_message_id' => $requestDTO->getTargetMessageId(),
            'new_topic_name' => $requestDTO->getNewTopicName(),
        ]);

        // 验证话题存在和权限
        $sourceTopicEntity = $this->topicDomainService->getTopicById((int) $sourceTopicId);
        if (! $sourceTopicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 判断话题是否是本人
        if ($sourceTopicEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.access_denied');
        }

        // === 同步部分：创建话题骨架 ===
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 在事务中创建话题骨架
        Db::beginTransaction();
        try {
            // 调用 Domain 层创建话题骨架（包含 IM 会话）
            $duplicateResult = $this->topicDomainService->duplicateTopicSkeleton(
                $dataIsolation,
                $sourceTopicEntity,
                $requestDTO->getNewTopicName()
            );

            $newTopicEntity = $duplicateResult['topic_entity'];
            $imConversationResult = $duplicateResult['im_conversation'];

            // 提交事务
            Db::commit();

            $this->logger->info('Topic skeleton created successfully (sync)', [
                'source_topic_id' => $sourceTopicId,
                'new_topic_id' => $newTopicEntity->getId(),
            ]);
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Failed to create topic skeleton (sync)', [
                'source_topic_id' => $sourceTopicId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        // 将话题实体转换为 DTO
        $topicItemDTO = TopicItemDTO::fromEntity($newTopicEntity);

        // 生成任务键
        $taskKey = TopicDuplicateConstant::generateTaskKey($sourceTopicId, $userAuthorization->getId());

        // 初始化异步任务
        $taskData = [
            'source_topic_id' => $sourceTopicId,
            'target_message_id' => $requestDTO->getTargetMessageId(),
            'new_topic_name' => $requestDTO->getNewTopicName(),
            'user_id' => $userAuthorization->getId(),
            'new_topic_id' => $newTopicEntity->getId(), // 保存新话题ID
            'im_conversation' => $imConversationResult, // 保存 IM 会话信息
        ];

        $this->topicDuplicateStatusManager->initializeTask($taskKey, $userAuthorization->getId(), $taskData);

        // 获取当前请求ID
        $requestId = CoContext::getRequestId() ?: (string) IdGenerator::getSnowId();

        // === 异步部分：复制消息 ===
        go(function () use ($sourceTopicEntity, $newTopicEntity, $requestDTO, $imConversationResult, $taskKey, $requestId) {
            // 复制请求上下文
            CoContext::setRequestId($requestId);

            try {
                // 更新任务状态：开始复制消息
                $this->topicDuplicateStatusManager->setTaskProgress($taskKey, 10, 'Starting to copy messages');

                // 开始数据库事务
                Db::beginTransaction();
                try {
                    // 执行消息复制逻辑
                    $this->topicDomainService->copyTopicMessageFromOthers(
                        $sourceTopicEntity,
                        $newTopicEntity,
                        (int) $requestDTO->getTargetMessageId(),
                        $imConversationResult,
                        // 进度回调函数
                        function (string $status, int $progress, string $message) use ($taskKey) {
                            $this->topicDuplicateStatusManager->setTaskProgress($taskKey, $progress, $message);
                        }
                    );

                    // 提交事务
                    Db::commit();

                    // 任务完成
                    $this->topicDuplicateStatusManager->setTaskCompleted($taskKey, [
                        'topic_id' => $newTopicEntity->getId(),
                        'topic_name' => $newTopicEntity->getTopicName(),
                        'project_id' => $newTopicEntity->getProjectId(),
                        'workspace_id' => $newTopicEntity->getWorkspaceId(),
                    ]);

                    $this->logger->info('Topic message copy completed successfully (async)', [
                        'task_key' => $taskKey,
                        'source_topic_id' => $sourceTopicEntity->getId(),
                        'new_topic_id' => $newTopicEntity->getId(),
                    ]);
                } catch (Throwable $e) {
                    // 回滚事务
                    Db::rollBack();
                    throw $e; // 重新抛出异常，让外层catch处理
                }
            } catch (Throwable $e) {
                // 任务失败
                $this->topicDuplicateStatusManager->setTaskFailed($taskKey, $e->getMessage());

                $this->logger->error('Async topic message copy failed', [
                    'task_key' => $taskKey,
                    'source_topic_id' => $sourceTopicEntity->getId(),
                    'new_topic_id' => $newTopicEntity->getId(),
                    'error' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });

        // 立即返回任务信息和新创建的话题
        return [
            'task_id' => $taskKey,
            'status' => 'copying',
            'message' => 'Topic created, copying messages in background',
            'topic' => $topicItemDTO->toArray(), // 新增：立即返回话题信息
        ];
    }

    /**
     * 检查话题复制状态
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $taskKey 任务键
     * @return array 复制状态信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    public function checkDuplicateChatStatus(RequestContext $requestContext, string $taskKey): array
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        $this->logger->info('Checking topic duplication status', [
            'user_id' => $userAuthorization->getId(),
            'task_key' => $taskKey,
        ]);

        try {
            // 验证用户权限
            if (! $this->topicDuplicateStatusManager->verifyUserPermission($taskKey, $userAuthorization->getId())) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TASK_ACCESS_DENIED, 'Task access denied');
            }

            // 获取任务状态
            $taskStatus = $this->topicDuplicateStatusManager->getTaskStatus($taskKey);
            if (! $taskStatus) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'Task not found or expired');
            }

            // 构建返回结果
            $result = [
                'task_id' => $taskKey,
                'status' => $taskStatus['status'], // running, completed, failed
                'message' => $taskStatus['message'] ?? 'Topic duplication in progress',
            ];

            // 添加进度信息
            if (isset($taskStatus['progress'])) {
                $result['progress'] = [
                    'percentage' => $taskStatus['progress']['percentage'],
                    'message' => $taskStatus['progress']['message'] ?? '',
                ];
            }

            // 如果任务完成，返回结果信息
            if ($taskStatus['status'] === 'completed' && isset($taskStatus['result'])) {
                $topicEntity = $this->topicDomainService->getTopicById($taskStatus['result']['topic_id']);
                $result['result'] = TopicItemDTO::fromEntity($topicEntity)->toArray();
            }

            // 如果任务失败，返回错误信息
            if ($taskStatus['status'] === 'failed' && isset($taskStatus['error'])) {
                $result['error'] = $taskStatus['error'];
            }

            return $result;
        } catch (Throwable $e) {
            $this->logger->error('Failed to check topic duplication status', [
                'user_id' => $userAuthorization->getId(),
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
