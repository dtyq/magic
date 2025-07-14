<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\AuthManager;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;

use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleTaskMessageAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use App\Domain\Contact\Entity\ValueObject\UserType;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateAgentTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateScriptTaskRequestDTO;
use App\Domain\Contact\Entity\MagicUserEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskStatus;

#[ApiResponse('low_code')]
class TaskApi extends AbstractApi
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
    }

    /**
     * 投递话题任务消息.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    public function deliverMessage(RequestContext $requestContext): array
    {
        // 从 header 中获取 token 字段
        $token = $this->request->header('token', '');
        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        // 从 env 获取沙箱 token ，然后对比沙箱 token 和请求 token 是否一致
        $sandboxToken = config('super-magic.sandbox.token', '');
        if ($sandboxToken !== $token) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_invalid');
        }

        // 查看是否混淆
        $isConfusion = $this->request->input('obfuscated', false);
        if ($isConfusion) {
            // 混淆处理
            $rawData = ShadowCode::unShadow($this->request->input('data', ''));
            $requestData = json_decode($rawData, true);
        } else {
            $requestData = $this->request->all();
        }

        // 从请求中创建DTO
        $messageDTO = TopicTaskMessageDTO::fromArray($requestData);
        // 调用应用服务进行消息投递
        return $this->topicTaskAppService->deliverTopicTaskMessage($messageDTO);
    }

    public function resumeTask(RequestContext $requestContext): array
    {
        // 从 header 中获取 token 字段
        $token = $this->request->header('token', '');
        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        // 从 env 获取沙箱 token ，然后对比沙箱 token 和请求 token 是否一致
        $sandboxToken = config('super-magic.sandbox.token', '');
        if ($sandboxToken !== $token) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_invalid');
        }
        $sandboxId = $this->request->input('sandbox_id', '');
        $isInit = $this->request->input('is_init', false);

        $this->taskAppService->sendContinueMessageToSandbox($sandboxId, $isInit);

        return [];
    }

    /**
     * 获取任务下的所有附件.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 附件列表及分页信息
     * @throws BusinessException 如果参数无效则抛出异常
     */
    public function getTaskAttachments(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 获取任务文件请求DTO
        $dto = GetTaskFilesRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->workspaceAppService->getTaskAttachments(
            $userAuthorization,
            $dto->getId(),
            $dto->getPage(),
            $dto->getPageSize()
        );
    }

    /**
     * 获取文件URL列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 文件URL列表
     * @throws BusinessException 如果参数无效则抛出异常
     */
    public function getFileUrls(RequestContext $requestContext): array
    {
        // 获取请求DTO
        $dto = GetFileUrlsRequestDTO::fromRequest($this->request);
        if (! empty($dto->getToken())) {
            // 走令牌校验逻辑
            return $this->workspaceAppService->getFileUrlsByAccessToken($dto->getFileIds(), $dto->getToken(), $dto->getDownloadMode());
        }
        // 设置用户授权信息
        $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 构建options参数
        $options = [];
        //        if (! $dto->getCache()) {
        //            $options['cache'] = false;
        //        }
        $options['cache'] = false;

        // 调用应用服务
        return $this->workspaceAppService->getFileUrls(
            $userAuthorization,
            $dto->getFileIds(),
            $dto->getDownloadMode(),
            $options
        );
    }

    public function updateTaskStatus(RequestContext $requestContext): array
    {
        $taskId = $this->request->input('task_id', '');
        $status = $this->request->input('status', '');

        $taskEntity = $this->taskAppService->getTaskById((int)$taskId);
        if (empty($taskEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_not_found');
        }

        $dataIsolation = new DataIsolation();
         // 设置用户授权信息
        $dataIsolation->setCurrentUserId((string)$taskEntity->getUserId());
        $status = TaskStatus::from($status);

        $this->topicTaskAppService->updateTaskStatus($dataIsolation,$taskEntity, $status);
        return [];
    }


    public function handApiKey(RequestContext $requestContext,&$userEntity)
    {
          // 从请求中创建DTO
        $apiKey = $this->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
        }

        $userEntity = $this->handleTaskMessageAppService->getUserAuthorization($apiKey,"");

        $magicUserAuthorization=MagicUserAuthorization::fromUserEntity($userEntity);

        $requestContext->setUserAuthorization($magicUserAuthorization);

    }
    //创建一个agent任务，鉴权使用api-key进行鉴权
    public function agentTask(RequestContext $requestContext, CreateAgentTaskRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateAgentTaskRequestDTO::fromRequest($this->request);

        /**
         * @var MagicUserEntity
         */
        $userEntity = null;

        $this->handApiKey($requestContext,$userEntity);

        $taskEntity = $this->handleTaskAppService->getTask((int)$requestDTO->getTaskId());


         //判断话题是否存在，不存在则初始化话题
        $topicId = $taskEntity->getTopicId();

        var_dump($topicId,"=====topicId");

        $topicDTO = $this->topicAppService->getTopic($requestContext, (int)$topicId);

         $requestDTO->setConversationId((string)$topicId);

         $dataIsolation = new DataIsolation();
         $dataIsolation->setCurrentUserId((string)$userEntity->getUserId());
         $dataIsolation->setThirdPartyOrganizationCode($userEntity->getOrganizationCode());
         $dataIsolation->setCurrentOrganizationCode($userEntity->getOrganizationCode());
         $dataIsolation->setUserType(UserType::Human);
        //  $dataIsolation = new DataIsolation($userEntity->getId(), $userEntity->getOrganizationCode(), $userEntity->getWorkDir());


        //检查容器是否正常
        $result = $this->agentAppService->getSandboxStatus($topicDTO->getSandboxId());
        if ($result->getStatus() !== SandboxStatus::RUNNING) {
            $this->agentAppService->sendInterruptMessage($dataIsolation, $topicDTO->getSandboxId(), (string) $topicDTO->getId(), '任务已终止.');
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_not_running');
        }

        $userMessage=[
            'chat_topic_id'=>(string)$topicDTO->getChatTopicId(),
            'chat_conversation_id'=>(string)$topicDTO->getChatConversationId(),
            'prompt'=>$requestDTO->getPrompt(),
            'attachments'=>null,
            'mentions'=>null,
            'agent_user_id'=>(string)$userEntity->getId(),
            'agent_mode'=> '',
            'task_mode'=> $taskEntity->getTaskMode(),
        ];
        var_dump($userMessage,"=====userMessage");
        var_dump($dataIsolation,"=====dataIsolation");
        var_dump($userEntity,"=====userEntity");
        $userMessageDTO = UserMessageDTO::fromArray($userMessage);
        try{
            $this->handleTaskMessageAppService->sendChatMessage($dataIsolation, $userMessageDTO);
        }catch(\Exception $e){
            $this->agentAppService->sendInterruptMessage($dataIsolation, $topicDTO->getSandboxId(), (string) $taskEntity->getId(), '任务已终止.');
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'send_message_failed');
        }

        return [];
    }

    //创建一个script任务，鉴权使用api-key进行鉴权
    public function scriptTask(RequestContext $requestContext, CreateScriptTaskRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateScriptTaskRequestDTO::fromRequest($this->request);


        /**
         * @var MagicUserEntity
         */
        $userEntity = null;

        $this->handApiKey($requestContext,$userEntity);

        $taskEntity = $this->handleTaskAppService->getTask((int)$requestDTO->getTaskId());

        //判断话题是否存在，不存在则初始化话题
        $topicId = $taskEntity->getTopicId();
        $topicDTO = $this->topicAppService->getTopic($requestContext, (int)$topicId);

        //检查容器是否正常
        $result = $this->agentAppService->getSandboxStatus($topicDTO->getSandboxId());
        if ($result->getStatus() !== SandboxStatus::RUNNING) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_not_running');
        }

        $requestDTO->setSandboxId($topicDTO->getSandboxId());

        var_dump($requestDTO,"=====requestDTO");
        try{
            $this->handleTaskMessageAppService->executeScriptTask($requestDTO);
        }catch(\Exception $e){
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'execute_script_task_failed');
        }

        return [];
    }


    public function getOpenApiTaskAttachments(RequestContext $requestContext): array
    {
           // 获取任务文件请求DTO
        $requestDTO = GetTaskFilesRequestDTO::fromRequest($this->request);

         // 从请求中创建DTO
         $apiKey = $this->getApiKey();
         if (empty($apiKey)) {
             ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
         }

         $userEntity = $this->handleTaskMessageAppService->getUserAuthorization($apiKey,"");

         $userAuthorization=MagicUserAuthorization::fromUserEntity($userEntity);

        return $this->workspaceAppService->getTaskAttachments($userAuthorization, $requestDTO->getId(), $requestDTO->getPage(), $requestDTO->getPageSize());
    }


}
