<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\AgentErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CheckpointRollbackCheckRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CheckpointRollbackRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CheckpointRollbackStartRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTopicAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTopicMessagesByTopicIdRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DuplicateTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DuplicateTopicCheckRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CheckpointRollbackCheckResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CheckpointRollbackResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicMessagesResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DuplicateTopicResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\DuplicateTopicStatusResponseDTO;
use Exception;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;
use Throwable;

#[ApiResponse('low_code')]
class TopicApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicAppService $topicAppService,
        protected TranslatorInterface $translator,
        protected AgentAppService $agentAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取话题信息.
     * @param mixed $id
     */
    public function getTopic(RequestContext $requestContext, $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->topicAppService->getTopic($requestContext, (int) $id)->toArray();
    }

    /**
     * 保存话题（创建或更新）
     * 接口层负责处理HTTP请求和响应，不包含业务逻辑.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果，包含话题ID
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Throwable
     */
    public function createTopic(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = SaveTopicRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        return $this->topicAppService->createTopic($requestContext, $requestDTO)->toArray();
    }

    /**
     * 保存话题（创建或更新）
     * 接口层负责处理HTTP请求和响应，不包含业务逻辑.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果，包含话题ID
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Throwable
     */
    public function updateTopic(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = SaveTopicRequestDTO::fromRequest($this->request);
        $requestDTO->id = $id;

        // 调用应用服务层处理业务逻辑
        return $this->topicAppService->updateTopic($requestContext, $requestDTO)->toArray();
    }

    /**
     * 删除话题（逻辑删除）
     * 接口层负责处理HTTP请求和响应，不包含业务逻辑.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果，包含被删除的话题ID
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function deleteTopic(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = DeleteTopicRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        return $this->topicAppService->deleteTopic($requestContext, $requestDTO)->toArray();
    }

    /**
     * 重命名话题.
     */
    public function renameTopic(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 话题 id
        $authorization = $requestContext->getUserAuthorization();

        $topicId = $this->request->input('id', 0);
        $userQuestion = $this->request->input('user_question', '');
        $language = $this->translator->getLocale();

        return $this->topicAppService->renameTopic($authorization, (int) $topicId, $userQuestion, $language);
    }

    /**
     * 获取话题的附件列表.
     */
    public function getTopicAttachments(RequestContext $requestContext): array
    {
        // 使用 fromRequest 方法从请求中创建 DTO，这样可以从路由参数中获取 topic_id
        $dto = GetTopicAttachmentsRequestDTO::fromRequest($this->request);
        if (! empty($dto->getToken())) {
            // 走令牌校验的逻辑
            return $this->topicAppService->getTopicAttachmentsByAccessToken($dto);
        }
        // 登录用户使用的场景
        $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());
        $userAuthorization = $requestContext->getUserAuthorization();

        return $this->topicAppService->getTopicAttachments($userAuthorization, $dto);
    }

    /**
     * 通过话题ID获取消息列表.x.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 消息列表及分页信息
     */
    public function getMessagesByTopicId(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $dto = GetTopicMessagesByTopicIdRequestDTO::fromRequest($this->request);

        // 校验话题消息是否是自己的
        $topicItemDTO = $this->topicAppService->getTopic($requestContext, $dto->getTopicId());
        if ($topicItemDTO->getUserId() !== $requestContext->getUserAuthorization()->getId()) {
            return ['list' => [], 'total' => 0];
        }

        // 调用应用服务
        $result = $this->workspaceAppService->getMessagesByTopicId(
            $dto->getTopicId(),
            $dto->getPage(),
            $dto->getPageSize(),
            $dto->getSortDirection()
        );

        // 构建响应
        $response = new TopicMessagesResponseDTO($result['list'], $result['total']);

        return $response->toArray();
    }

    /**
     * 回滚沙箱到指定的checkpoint.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 话题ID
     * @return array 回滚结果
     */
    #[ApiResponse('low_code')]
    public function rollbackCheckpoint(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CheckpointRollbackRequestDTO::fromRequest($this->request);

        $topicId = $id;
        $targetMessageId = $requestDTO->getTargetMessageId();

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        if (empty($targetMessageId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'target_message_id is required');
        }

        $authorization = $this->getAuthorization();

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        $dataIsolation->setLanguage(CoContext::getLanguage());

        $sandboxId = $this->agentAppService->ensureSandboxInitialized($dataIsolation, (int) $topicId);

        $result = $this->agentAppService->rollbackCheckpoint($sandboxId, $targetMessageId);

        if (! $result->isSuccess()) {
            ExceptionBuilder::throw(AgentErrorCode::SANDBOX_NOT_FOUND, $result->getMessage());
        }

        $responseDTO = new CheckpointRollbackResponseDTO();
        $responseDTO->setTargetMessageId($targetMessageId);
        $responseDTO->setMessage($result->getMessage());

        return $responseDTO->toArray();
    }

    /**
     * 开始回滚沙箱到指定的checkpoint（标记状态而非删除）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 话题ID
     * @return array 回滚结果
     */
    #[ApiResponse('low_code')]
    public function rollbackCheckpointStart(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CheckpointRollbackStartRequestDTO::fromRequest($this->request);

        $topicId = $id;
        $targetMessageId = $requestDTO->getTargetMessageId();

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        if (empty($targetMessageId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'target_message_id is required');
        }

        $authorization = $this->getAuthorization();

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        $dataIsolation->setLanguage(CoContext::getLanguage());

        // 调用应用服务层的rollbackCheckpointStart方法
        $this->agentAppService->rollbackCheckpointStart($dataIsolation, (int) $topicId, $targetMessageId);

        return [];
    }

    /**
     * 提交回滚沙箱到指定的checkpoint（物理删除撤回状态的消息）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 话题ID
     * @return array 提交结果
     */
    #[ApiResponse('low_code')]
    public function rollbackCheckpointCommit(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $topicId = $id;

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $authorization = $this->getAuthorization();

        // 创建数据隔离对象
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        $dataIsolation->setLanguage(CoContext::getLanguage());

        // 调用应用服务层的rollbackCheckpointCommit方法
        $this->agentAppService->rollbackCheckpointCommit($dataIsolation, (int) $topicId);

        return [];
    }

    /**
     * 撤销回滚沙箱checkpoint（将撤回状态的消息恢复为正常状态）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 话题ID
     * @return array 撤销结果
     */
    #[ApiResponse('low_code')]
    public function rollbackCheckpointUndo(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $topicId = $id;

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $authorization = $this->getAuthorization();

        // 创建数据隔离对象
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        $dataIsolation->setLanguage(CoContext::getLanguage());

        // 调用应用服务层的rollbackCheckpointUndo方法
        $this->agentAppService->rollbackCheckpointUndo($dataIsolation, (int) $topicId);

        return [];
    }

    /**
     * 检查回滚沙箱到指定checkpoint的可行性.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 话题ID
     * @return array 检查结果
     */
    #[ApiResponse('low_code')]
    public function rollbackCheckpointCheck(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CheckpointRollbackCheckRequestDTO::fromRequest($this->request);

        $topicId = $id;
        $targetMessageId = $requestDTO->getTargetMessageId();

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        if (empty($targetMessageId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'target_message_id is required');
        }

        $authorization = $this->getAuthorization();

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        $dataIsolation->setLanguage(CoContext::getLanguage());

        $result = $this->agentAppService->rollbackCheckpointCheck($dataIsolation, (int) $topicId, $targetMessageId);

        if (! $result->isSuccess()) {
            ExceptionBuilder::throw(AgentErrorCode::SANDBOX_NOT_FOUND, $result->getMessage());
        }

        $responseDTO = new CheckpointRollbackCheckResponseDTO();
        $responseDTO->setCanRollback((bool) $result->getDataValue('can_rollback', false));

        return $responseDTO->toArray();
    }

    /**
     * 复制话题
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 源话题ID
     * @return array 复制任务信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    #[ApiResponse('low_code')]
    public function duplicateChat(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 获取请求DTO
        $dto = DuplicateTopicRequestDTO::fromRequest($this->request);

        try {
            // 调用应用服务
            $result = $this->topicAppService->duplicateChat($requestContext, $id, $dto);
            
            $responseDTO = new DuplicateTopicResponseDTO(
                $result['task_key'],
                $result['status'],
                $result['topic_id'],
                $result['message']
            );

            return $responseDTO->toArray();
        } catch (Throwable $e) {
            // TODO: 添加错误日志记录
            throw $e;
        }
    }

    /**
     * 检查话题复制状态
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 源话题ID
     * @return array 复制状态信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    #[ApiResponse('low_code')]
    public function duplicateChatCheck(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 获取请求DTO
        $dto = DuplicateTopicCheckRequestDTO::fromRequest($this->request);

        try {
            // 调用应用服务
            $result = $this->topicAppService->checkDuplicateChatStatus($requestContext, $dto->getTaskKey());
            
            $responseDTO = new DuplicateTopicStatusResponseDTO(
                $result['status'],
                $result['progress'],
                $result['topic_id'],
                $result['message']
            );

            return $responseDTO->toArray();
        } catch (Throwable $e) {
            // TODO: 添加错误日志记录
            throw $e;
        }
    }
}
