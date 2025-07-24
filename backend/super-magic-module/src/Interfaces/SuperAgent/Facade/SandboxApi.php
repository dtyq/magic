<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleTaskMessageAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\InitSandboxRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveTopicRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UserInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\InitSandboxResponseDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class SandboxApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicTaskAppService $topicTaskAppService,
        protected HandleTaskMessageAppService $taskAppService,
        protected ProjectAppService $projectAppService,
        protected TopicAppService $topicAppService,
        protected UserDomainService $userDomainService,
        protected HandleTaskMessageAppService $handleTaskMessageAppService,
    ) {
    }

    // 创建一个任务，支持agent、tool、custom三种模式，鉴权使用api-key进行鉴权
    public function initSandbox(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = InitSandboxRequestDTO::fromRequest($this->request);

        // 从请求中创建DTO
        $apiKey = $this->getApiKey();

        var_dump($apiKey, 'apiKey======');
        if (empty($apiKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'The api key of header is required');
        }
        // $userInfoRequestDTO = new UserInfoRequestDTO(['uid' => $apiKey]);

        $userEntity = $this->handleTaskMessageAppService->getUserAuthorization($apiKey, '');

        if (empty($userEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_not_found');
        }
        $magicUserAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        $requestContext->setUserAuthorization($magicUserAuthorization);

        // 判断工作区是否存在，不存在则初始化工作区
        $workspaceId = $requestDTO->getWorkspaceId();
        if ($workspaceId > 0) {
            try {
                $workspace = $this->workspaceAppService->getWorkspaceDetail($requestContext, (int) $workspaceId);
            } catch (Throwable $e) {
                // 抛异常，工作区不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace_not_found');
            }
        } else {
            $saveWorkspaceRequestDTO = new SaveWorkspaceRequestDTO();
            $saveWorkspaceRequestDTO->setWorkspaceName('默认工作区');
            $workspace = $this->workspaceAppService->createWorkspace($requestContext, $saveWorkspaceRequestDTO);
            $workspaceId = $workspace->getId();
        }

        $requestDTO->setWorkspaceId($workspaceId);

        // 判断项目是否存在，不存在则初始化项目
        $projectId = $requestDTO->getProjectId();

        if ($projectId > 0) {
            try {
                $project = $this->projectAppService->getProject((int) $projectId, (string) $userEntity->getUserId());
            } catch (Throwable $e) {
                // 抛异常，项目不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        } else {
            $saveProjectRequestDTO = new CreateProjectRequestDTO();
            $saveProjectRequestDTO->setProjectName('默认项目');
            $saveProjectRequestDTO->setWorkspaceId((string) $requestDTO->getWorkspaceId());
            $saveProjectRequestDTO->setProjectMode($requestDTO->getProjectMode());
            $project = $this->projectAppService->createProject($requestContext, $saveProjectRequestDTO);
            if (! empty($project['project'])) {
                $projectId = $project['project']['id'];
            } else {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        }

        $requestDTO->setProjectId($projectId);

        // 判断话题是否存在，不存在则初始化话题
        $topicId = $requestDTO->getTopicId();
        if ($topicId > 0) {
            try {
                $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
            } catch (Throwable $e) {
                // 抛异常，话题不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
        } else {
            $saveTopicRequestDTO = new SaveTopicRequestDTO();
            $saveTopicRequestDTO->setTopicName('默认话题');
            $saveTopicRequestDTO->setProjectId((string) $requestDTO->getProjectId());
            $saveTopicRequestDTO->setWorkspaceId((string) $requestDTO->getWorkspaceId());
            $topic = $this->topicAppService->createTopic($requestContext, $saveTopicRequestDTO);
            if (! empty($topic->getId())) {
                $topicId = $topic->getId();
            } else {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
        }

        $requestDTO->setTopicId($topicId);
        $requestDTO->setConversationId($topicId);

        $initSandboxResponseDTO = new InitSandboxResponseDTO();

        $initSandboxResponseDTO->setWorkspaceId($requestDTO->getWorkspaceId());
        $initSandboxResponseDTO->setProjectId($requestDTO->getProjectId());
        $initSandboxResponseDTO->setProjectMode($requestDTO->getProjectMode());
        $initSandboxResponseDTO->setTopicId($requestDTO->getTopicId());
        $initSandboxResponseDTO->setConversationId($requestDTO->getTopicId());
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId((string) $userEntity->getUserId());
        $dataIsolation->setThirdPartyOrganizationCode($userEntity->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($userEntity->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);
        //  $dataIsolation = new DataIsolation($userEntity->getId(), $userEntity->getOrganizationCode(), $userEntity->getWorkDir());

        $userMessage = [
            'chat_topic_id' => $requestDTO->getTopicId(),
            'topic_id' => (int) $requestDTO->getTopicId(),
            'chat_conversation_id' => $requestDTO->getConversationId(),
            'prompt' => $requestDTO->getPrompt(),
            'attachments' => null,
            'mentions' => null,
            'agent_user_id' => (string) $userEntity->getId(),
            'agent_mode' => '',
            'task_mode' => '',
        ];
        $userMessageDTO = UserMessageDTO::fromArray($userMessage);
        // $this->handleApiMessageAppService->handleApiMessage($dataIsolation, $userMessageDTO);
        // $userMessageDTO->setAgentMode($requestDTO->getProjectMode());
        $result = $this->handleTaskMessageAppService->initSandbox($dataIsolation, $userMessageDTO);
        $initSandboxResponseDTO->setSandboxId($result['sandbox_id']);
        $initSandboxResponseDTO->setTaskId($result['task_id']);

        return $initSandboxResponseDTO->toArray();
    }

    // public function initWorkspace(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO)
    // {

    //        //判断工作区是否存在，不存在则初始化工作区
    //        $workspaceId = $requestDTO->getWorkspaceId();
    //        if ($workspaceId > 0) {
    //            $workspace = $this->workspaceAppService->getWorkspaceDetail(        $requestContext,    (int)$workspaceId);
    //            if (empty($workspace)) {
    //                //抛异常，工作区不存在
    //                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace_not_found');
    //            }
    //        }else{
    //            $saveWorkspaceRequestDTO = new SaveWorkspaceRequestDTO();
    //            $saveWorkspaceRequestDTO->setWorkspaceName("默认工作区");
    //            $workspace = $this->workspaceAppService->createWorkspace($requestContext, $saveWorkspaceRequestDTO);
    //            $workspaceId = $workspace->getId();
    //        }

    //        $requestDTO->setWorkspaceId($workspaceId);
    // }

    // public function initProject(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO, string $userId): void
    // {
    //             //判断项目是否存在，不存在则初始化项目
    //     $projectId = $requestDTO->getProjectId();

    //     if ($projectId > 0) {
    //         $project = $this->projectAppService->getProject((int)$projectId, $userId);
    //         if (empty($project)) {
    //             //抛异常，项目不存在
    //             ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
    //         }
    //     }else{
    //         $saveProjectRequestDTO = new CreateProjectRequestDTO();
    //         $saveProjectRequestDTO->setProjectName("默认项目");
    //         $saveProjectRequestDTO->setWorkspaceId((string)$requestDTO->getWorkspaceId());
    //         $saveProjectRequestDTO->setProjectMode($requestDTO->getProjectMode());
    //         $project = $this->projectAppService->createProject($requestContext, $saveProjectRequestDTO);
    //         if(!empty($project['project'])){
    //             $projectId = $project['project']['id'];
    //         }else{
    //             ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
    //         }
    //     }

    //     $requestDTO->setProjectId($projectId);
    // }

    // public function initTopic(RequestContext $requestContext, CreateTaskApiRequestDTO &$requestDTO): void
    // {
    //     //判断话题是否存在，不存在则初始化话题
    //     $topicId = $requestDTO->getTopicId();
    //     if ($topicId > 0) {
    //         $topic = $this->topicAppService->getTopic($requestContext, (int)$topicId);
    //         if (empty($topic)) {
    //             //抛异常，话题不存在
    //             ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
    //         }
    //     }else{
    //         $saveTopicRequestDTO = new SaveTopicRequestDTO();
    //         $saveTopicRequestDTO->setTopicName("默认话题");
    //         $saveTopicRequestDTO->setProjectId((string)$requestDTO->getProjectId());
    //         $saveTopicRequestDTO->setWorkspaceId((string)$requestDTO->getWorkspaceId());
    //         $topic = $this->topicAppService->createTopic($requestContext, $saveTopicRequestDTO);
    //         if(!empty($topic->getId())){
    //             $topicId = $topic->getId();
    //         }else{
    //             ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
    //         }
    //     }
    //     $requestDTO->setTopicId($topicId);
    // }
}
