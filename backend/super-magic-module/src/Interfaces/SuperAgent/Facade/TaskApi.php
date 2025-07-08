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
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateTaskApiRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\AuthManager;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UserInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreateTaskApiResponseDTO;


#[ApiResponse('low_code')]
class TaskApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicTaskAppService $topicTaskAppService,
        protected TaskAppService $taskAppService,
        protected ProjectAppService $projectAppService,
        protected TopicAppService $topicAppService,
        protected UserDomainService $userDomainService,

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

    //创建一个任务，支持agent、tool、custom三种模式，鉴权使用api-key进行鉴权
    public function createOpenApiTask(RequestContext $requestContext, CreateTaskApiRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO
        $apiKey = $this->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
        }


        var_dump($apiKey,"=====apiKey");
        // $userInfoRequestDTO = new UserInfoRequestDTO(['uid' => $apiKey]);

        $userEntity = $this->taskAppService->getUserAuthorization($apiKey,"");

        $magicUserAuthorization=MagicUserAuthorization::fromUserEntity($userEntity);
        $requestContext->setUserAuthorization($magicUserAuthorization);
        // $workspaceId=$this->initWorkspace($requestContext, $requestDTO);
        // $requestDTO->setWorkspaceId($workspaceId);
        // $requestDTO->setWorkspaceId($this->initWorkspace($requestContext, $requestDTO));



        $createTaskApiResponseDTO = new CreateTaskApiResponseDTO();
        $createTaskApiResponseDTO->setTaskId("123123123");
        $createTaskApiResponseDTO->setAgentName($requestDTO->getAgentName());
        $createTaskApiResponseDTO->setToolName($requestDTO->getToolName());
        $createTaskApiResponseDTO->setCustomName($requestDTO->getCustomName());
        $createTaskApiResponseDTO->setModelId($requestDTO->getModelId());
        $createTaskApiResponseDTO->setWorkspaceId($requestDTO->getWorkspaceId());
        $createTaskApiResponseDTO->setProjectId($requestDTO->getProjectId());
        $createTaskApiResponseDTO->setProjectMode($requestDTO->getProjectMode());
        $createTaskApiResponseDTO->setTopicId($requestDTO->getTopicId());


        // $requestDTO->setProjectId($this->initProject($requestContext, $requestDTO, $userEntity->getId()));

        // $requestDTO->setTopicId($this->initTopic($requestContext, $requestDTO));

        return [];
    }

    public function initWorkspace(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO)
    {

           //判断工作区是否存在，不存在则初始化工作区
           $workspaceId = $requestDTO->getWorkspaceId();
           if ($workspaceId > 0) {
               $workspace = $this->workspaceAppService->getWorkspaceDetail(        $requestContext,    (int)$workspaceId);
               if (empty($workspace)) {
                   //抛异常，工作区不存在
                   ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace_not_found');
               }
           }else{
               $saveWorkspaceRequestDTO = new SaveWorkspaceRequestDTO();
               $saveWorkspaceRequestDTO->setWorkspaceName("默认工作区");
               $workspace = $this->workspaceAppService->createWorkspace($requestContext, $saveWorkspaceRequestDTO);
               $workspaceId = $workspace->getId();
           }

           $requestDTO->setWorkspaceId($workspaceId);
    }


    public function initProject(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO, string $userId): string
    {
                //判断项目是否存在，不存在则初始化项目
        $projectId = $requestDTO->getProjectId();

        if ($projectId > 0) {
            $project = $this->projectAppService->getProject((int)$projectId, $userEntity->getUserId());
            if (empty($project)) {
                //抛异常，项目不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        }else{
            $saveProjectRequestDTO = new CreateProjectRequestDTO();
            $saveProjectRequestDTO->setProjectName("默认项目");
            $saveProjectRequestDTO->setWorkspaceId((string)$workspaceId);
            $saveProjectRequestDTO->setProjectMode($requestDTO->getProjectMode());
            $project = $this->projectAppService->createProject($requestContext, $saveProjectRequestDTO);
            if(!empty($project['project'])){
                $projectId = $project['project']['id'];
            }else{
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        }

        $requestDTO->setProjectId($projectId);
    }


    public function initTopic(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO): string
    {
        //判断话题是否存在，不存在则初始化话题
        $topicId = $requestDTO->getTopicId();
        if ($topicId > 0) {
            $topic = $this->topicAppService->getTopic($requestContext, (int)$topicId);
            if (empty($topic)) {
                //抛异常，话题不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
        }else{
            $saveTopicRequestDTO = new SaveTopicRequestDTO();
            $saveTopicRequestDTO->setTopicName("默认话题");
            $saveTopicRequestDTO->setProjectId((string)$requestDTO->getProjectId());
            $saveTopicRequestDTO->setWorkspaceId((string)$requestDTO->getWorkspaceId());
            $topic = $this->topicAppService->createTopic($requestContext, $saveTopicRequestDTO);
            if(!empty($topic->getId())){
                $topicId = $topic->getId();
            }else{
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
        }
        $requestDTO->setTopicId($topicId);
    }

}
