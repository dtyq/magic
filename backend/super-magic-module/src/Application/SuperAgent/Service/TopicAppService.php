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
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\CreateTopicBeforeEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DeleteTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveTopicResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicItemDTO;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class TopicAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected WorkspaceDomainService $workspaceDomainService,
        protected TopicDomainService $topicDomainService,
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected ChatAppService $chatAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function getTopic(RequestContext $requestContext, int $id): TopicItemDTO
    {
        // 获取话题内容
        $topicEntity = $this->topicDomainService->getTopicById($id);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
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

        // 判断工作区是否是本人
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail((int) $requestDTO->getWorkspaceId());
        if ($workspaceEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, 'workspace.access_denied');
        }

        // 如果有ID，表示更新；否则是创建
        if ($requestDTO->isUpdate()) {
            return $this->updateTopic($dataIsolation, $requestDTO);
        }

        return $this->createNewTopic($dataIsolation, $requestDTO);
    }

    public function renameTopic(MagicUserAuthorization $authorization, int $topicId, string $userQuestion): array
    {
        // 获取话题内容
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
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
            // 触发话题创建前事件
            AsyncEventUtil::dispatch(new CreateTopicBeforeEvent($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), (int) $requestDTO->getWorkspaceId(), $requestDTO->getTopicName()));

            // 1. 初始化 chat 的会话和话题
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

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
        } catch (EventException $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new topic event: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, $e->getMessage());
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new topic: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, 'topic.create_topic_failed');
        }
    }
}
