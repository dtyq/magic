<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\StopRunningTaskPublisher;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DeleteTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveTopicResultDTO;
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
        protected WorkspaceDomainService $workspaceDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TopicDomainService $topicDomainService,
        protected MagicChatMessageAppService $magicChatMessageAppService,
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

        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

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
}
