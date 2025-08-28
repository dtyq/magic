<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleTaskMessageAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateAgentTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateScriptTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;

class OpenTaskApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicTaskAppService $topicTaskAppService,
        protected HandleTaskMessageAppService $handleTaskAppService,
        protected TaskAppService $taskAppService,
        protected ProjectAppService $projectAppService,
        protected TopicAppService $topicAppService,
        protected UserDomainService $userDomainService,
        protected HandleTaskMessageAppService $handleTaskMessageAppService,
        protected AgentAppService $agentAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Summary of updateTaskStatus.
     */
    #[ApiResponse('low_code')]
    public function updateTaskStatus(RequestContext $requestContext): array
    {
        $taskId = $this->request->input('task_id', '');
        $status = $this->request->input('status', '');
        $id=$this->request->input('id', '');
        /**
         * @var null|MagicUserEntity
         */
        $userEntity = null;

        $this->handApiKey($requestContext, $userEntity);

        // 如果task_id为空，则使用id
        if(empty($taskId)){
            $taskId=$id;
        }

        if (empty($taskId) || empty($status)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_id_or_status_is_required');
        }

        $taskEntity = $this->taskAppService->getTaskById((int) $taskId);
        if (empty($taskEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_not_found');
        }

        $dataIsolation = new DataIsolation();
        // 设置用户授权信息
        $dataIsolation->setCurrentUserId((string) $taskEntity->getUserId());
        $status = TaskStatus::from($status);

        $this->topicTaskAppService->updateTaskStatus($dataIsolation, $taskEntity, $status);
        return [];
    }

    public function handApiKey(RequestContext $requestContext, &$userEntity)
    {
        // 从请求中创建DTO
        $apiKey = $this->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
        }

        $userEntity = $this->handleTaskMessageAppService->getUserAuthorization($apiKey, '');

        if (empty($userEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_not_found');
        }

        $magicUserAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        $requestContext->setUserAuthorization($magicUserAuthorization);
    }

    /**
     * Summary of agentTask.
     */
    #[ApiResponse('low_code')]
    public function agentTask(RequestContext $requestContext, CreateAgentTaskRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateAgentTaskRequestDTO::fromRequest($this->request);

        /**
         * @var null|MagicUserEntity
         */
        $userEntity = null;

        $this->handApiKey($requestContext, $userEntity);

        // $magicUserId = $this->request->header('magic-user-id', '');

        if (empty($userEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_not_found');
        }
        $magicUserAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        // $taskEntity = $this->handleTaskAppService->getTask((int) $requestDTO->getTaskId());

        // 判断话题是否存在，不存在则初始化话题
        $topicId = $requestDTO->getTopicId();

        $topicDTO = $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $requestDTO->setConversationId((string) $topicId);

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $userEntity->getUserId());
        $dataIsolation->setThirdPartyOrganizationCode($userEntity->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($userEntity->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        //  $dataIsolation = new DataIsolation($userEntity->getId(), $userEntity->getOrganizationCode(), $userEntity->getWorkDir());
        $sandboxId = $topicDTO->getSandboxId();
        try {
            // 检查容器是否正常
            $result = $this->agentAppService->getSandboxStatus($sandboxId);

            if ($result->getStatus() !== SandboxStatus::RUNNING) {
                // 容器未正常运行，需要先运行容器
                $userMessage = [
                    'chat_topic_id' => $topicDTO->getChatTopicId(),
                    'topic_id' => (int) $topicDTO->getChatTopicId(),
                    'chat_conversation_id' => $requestDTO->getConversationId(),
                    'prompt' => $requestDTO->getPrompt(),
                    'attachments' => null,
                    'mentions' => null,
                    'agent_user_id' => (string) $magicUserAuthorization->getId(),
                    'agent_mode' => '',
                    'task_mode' => '',
                ];
                $userMessageDTO = UserMessageDTO::fromArray($userMessage);
                $result = $this->handleTaskMessageAppService->initSandbox($dataIsolation, $userMessageDTO);

                if (empty($result['sandbox_id'])) {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'the sandbox cannot running,please check the sandbox status');
                }
                $sandboxId = $result['sandbox_id'];
                $taskEntity = $this->handleTaskAppService->getTask((int) $result['task_id']);
            } else {
                $taskEntity = $this->handleTaskAppService->getTaskBySandboxId($sandboxId);
            }

            $userMessage = [
                'chat_topic_id' => (string) $topicDTO->getChatTopicId(),
                'chat_conversation_id' => (string) $topicDTO->getChatConversationId(),
                'prompt' => $requestDTO->getPrompt(),
                'attachments' => null,
                'mentions' => null,
                'agent_user_id' => (string) $userEntity->getId(),
                'agent_mode' => '',
                'task_mode' => $taskEntity->getTaskMode(),
            ];
            $userMessageDTO = UserMessageDTO::fromArray($userMessage);

            $this->handleTaskMessageAppService->sendChatMessage($dataIsolation, $userMessageDTO);
        } catch (Exception $e) {
            // $this->agentAppService->sendInterruptMessage($dataIsolation, $topicDTO->getSandboxId(), (string) $taskEntity->getId(), '任务已终止.');
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $e->getMessage());
        }

        return $taskEntity->toArray();
    }

    /**
     * Summary of scriptTask.
     */
    #[ApiResponse('low_code')]
    public function scriptTask(RequestContext $requestContext, CreateScriptTaskRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateScriptTaskRequestDTO::fromRequest($this->request);

        /**
         * @var null|MagicUserEntity
         */
        $userEntity = null;

        $this->handApiKey($requestContext, $userEntity);

        $taskEntity = $this->handleTaskAppService->getTask((int) $requestDTO->getTaskId());

        // 判断话题是否存在，不存在则初始化话题
        $topicId = $taskEntity->getTopicId();
        $topicDTO = $this->topicAppService->getTopic($requestContext, (int) $topicId);

        // 检查容器是否正常
        $result = $this->agentAppService->getSandboxStatus($topicDTO->getSandboxId());
        if ($result->getStatus() !== SandboxStatus::RUNNING) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_not_running');
        }

        $requestDTO->setSandboxId($topicDTO->getSandboxId());

        try {
            $this->handleTaskMessageAppService->executeScriptTask($requestDTO);
        } catch (Exception $e) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'execute_script_task_failed');
        }

        return [];
    }

    /**
     * Summary of getOpenApiTaskAttachments.
     */
    #[ApiResponse('low_code')]
    public function getOpenApiTaskAttachments(RequestContext $requestContext): array
    {
        // 获取任务文件请求DTO
        // $requestDTO = GetTaskFilesRequestDTO::fromRequest($this->request);
        $id = $this->request->input('id', '');
        if (empty($id)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'id is required');
        }

        // 从请求中创建DTO
        $apiKey = $this->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
        }

        $userEntity = $this->handleTaskMessageAppService->getUserAuthorization($apiKey, '');

        $userAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        return $this->workspaceAppService->getTaskAttachments($userAuthorization, (int) $id, 1, 100);
    }

    // 获取任务信息
    public function getTask(RequestContext $requestContext): array
    {
        $taskId = $this->request->input('task_id', '');
        if (empty($taskId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_id is required');
        }

        $task = $this->taskAppService->getTaskById((int) $taskId);
        if (empty($task)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_not_found');
        }

        return $task->toArray();
    }
}
