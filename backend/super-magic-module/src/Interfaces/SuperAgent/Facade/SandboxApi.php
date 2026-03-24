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
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
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
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\InitSandboxResponseDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

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
        protected AgentAppService $agentAppService,
    ) {
        parent::__construct($request);
    }

    #[ApiResponse('low_code')]
    public function getSandboxStatus(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $topicId = $this->request->input('topic_id', '');

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $topic = $this->topicAppService->getTopicById((int) $topicId);

        $sandboxId = $topic->getSandboxId();

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $result = $this->agentAppService->getSandboxStatus($sandboxId);
        if (! $result->isSuccess()) {
            ExceptionBuilder::throw(AgentErrorCode::SANDBOX_NOT_FOUND, $result->getMessage());
        }
        return $result->toArray();
    }

    #[ApiResponse('low_code')]
    public function upgradeSandbox(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $topicId = $this->request->input('topic_id', '');

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
        $sandboxId = $topic->getSandboxId();

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $project = $this->projectAppService->getProjectNotUserId((int) $topic->getProjectId());
        $workDir = $project->getWorkDir() ?? '';

        $authorization = $this->getAuthorization();
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($authorization->getId());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $result = $this->agentAppService->upgradeSandbox($dataIsolation, $sandboxId, (string) $topic->getProjectId(), $workDir);

        return $result->toArray();
    }

    // 创建一个任务，支持agent、tool、custom三种模式，鉴权使用api-key进行鉴权
    #[ApiResponse('low_code')]
    public function initSandboxByApiKey(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = InitSandboxRequestDTO::fromRequest($this->request);

        // 从协程上下文获取用户授权（已由中间件处理）
        $magicUserAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($magicUserAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 设置到 RequestContext
        $requestContext->setUserAuthorization($magicUserAuthorization);

        return $this->initSandbox($requestContext, $requestDTO, $magicUserAuthorization);
    }

    public function initSandboxByAuthorization(RequestContext $requestContext): array
    {
        $topicId = $this->request->input('topic_id', '');

        $requestContext->setUserAuthorization($this->getAuthorization());
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $projectId = $topic->getProjectId();

        $project = $this->projectAppService->getProjectNotUserId((int) $projectId);

        $workspaceId = (string) $project?->getWorkspaceId();

        $requestDTO = new InitSandboxRequestDTO();
        $requestDTO->setWorkspaceId($workspaceId);
        $requestDTO->setProjectId($projectId);
        $requestDTO->setTopicId($topicId);
        $requestDTO->setTopicMode($topic->getTopicMode());

        return $this->initSandbox($requestContext, $requestDTO, $this->getAuthorization());
    }

    protected function initSandbox(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO, MagicUserAuthorization $magicUserAuthorization): array
    {
        // 判断工作区是否存在，不存在则初始化工作区
        $this->initWorkspace($requestContext, $requestDTO);

        // 判断项目是否存在，不存在则初始化项目
        $this->initProject($requestContext, $requestDTO);

        // 判断话题是否存在，不存在则初始化话题
        $this->initTopic($requestContext, $requestDTO);

        $initSandboxResponseDTO = new InitSandboxResponseDTO();

        $initSandboxResponseDTO->setWorkspaceId($requestDTO->getWorkspaceId());
        $initSandboxResponseDTO->setProjectId($requestDTO->getProjectId());
        $initSandboxResponseDTO->setProjectMode($requestDTO->getProjectMode());
        $initSandboxResponseDTO->setTopicId($requestDTO->getTopicId());
        // $initSandboxResponseDTO->setChatTopicId($requestDTO->getChatTopicId());
        // $initSandboxResponseDTO->setConversationId($requestDTO->getTopicId());
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($magicUserAuthorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($magicUserAuthorization->getOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($magicUserAuthorization->getOrganizationCode());
        $dataIsolation->setUserType(UserType::Human);

        $userMessage = [
            'chat_topic_id' => $requestDTO->getChatTopicId(),
            'topic_id' => (int) $requestDTO->getTopicId(),
            'prompt' => $requestDTO->getPrompt(),
            'attachments' => null,
            'mentions' => null,
            'agent_user_id' => $magicUserAuthorization->getId(),
            'project_mode' => $requestDTO->getProjectMode(),
            'topic_mode' => $requestDTO->getTopicMode(),
            'task_mode' => '',
            'model_id' => $requestDTO->getModelId(),
        ];
        $userMessageDTO = UserMessageDTO::fromArray($userMessage);

        $result = $this->handleTaskMessageAppService->initSandbox($dataIsolation, $userMessageDTO);
        $initSandboxResponseDTO->setSandboxId($result['sandbox_id']);
        $initSandboxResponseDTO->setTaskId($result['task_id']);

        return $initSandboxResponseDTO->toArray();
    }

    private function initWorkspace(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO): void
    {
        // 判断工作区是否存在，不存在则初始化工作区
        $workspaceId = $requestDTO->getWorkspaceId();
        if ($workspaceId > 0) {
            $workspace = $this->workspaceAppService->getWorkspaceDetail($requestContext, (int) $workspaceId);
            if (empty($workspace->getId())) {
                // 抛异常，工作区不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace_not_found');
            }
        } else {
            $saveWorkspaceRequestDTO = new SaveWorkspaceRequestDTO();
            $saveWorkspaceRequestDTO->workspaceName = '默认工作区';
            $workspace = $this->workspaceAppService->createWorkspace($requestContext, $saveWorkspaceRequestDTO);
            $workspaceId = $workspace->getId();
        }

        $requestDTO->setWorkspaceId($workspaceId);
    }

    private function initProject(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO): void
    {
        // 判断项目是否存在，不存在则初始化项目
        $projectId = $requestDTO->getProjectId();

        if ($projectId > 0) {
            $project = $this->projectAppService->getProject($requestContext, (int) $projectId);
            if (empty($project->getId())) {
                // 抛异常，项目不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        } else {
            $saveProjectRequestDTO = new CreateProjectRequestDTO();
            $saveProjectRequestDTO->setProjectName('默认项目');
            $saveProjectRequestDTO->setWorkspaceId($requestDTO->getWorkspaceId());
            $saveProjectRequestDTO->setProjectMode($requestDTO->getProjectMode());
            $project = $this->projectAppService->createProject($requestContext, $saveProjectRequestDTO);
            if (! empty($project['project'])) {
                $projectId = $project['project']['id'];
            } else {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'project_not_found');
            }
        }

        $requestDTO->setProjectId($projectId);
    }

    private function initTopic(RequestContext $requestContext, InitSandboxRequestDTO $requestDTO): void
    {
        // 判断话题是否存在，不存在则初始化话题
        $topicId = $requestDTO->getTopicId();
        if ($topicId > 0) {
            $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
            if (empty($topic->getId())) {
                // 抛异常，话题不存在
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
            $chatTopicId = $topic->getChatTopicId();
        } else {
            $saveTopicRequestDTO = new SaveTopicRequestDTO();
            $saveTopicRequestDTO->setTopicName('默认话题');
            $saveTopicRequestDTO->setProjectId($requestDTO->getProjectId());
            $saveTopicRequestDTO->setWorkspaceId($requestDTO->getWorkspaceId());
            $saveTopicRequestDTO->setProjectMode($requestDTO->getProjectMode());
            $saveTopicRequestDTO->setTopicMode($requestDTO->getTopicMode());
            $topic = $this->topicAppService->createTopicNotValidateAccessibleProject($requestContext, $saveTopicRequestDTO);
            if (! empty($topic->getId())) {
                $topicId = $topic->getId();
                $chatTopicId = $topic->getChatTopicId();
            } else {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_not_found');
            }
        }

        $requestDTO->setChatTopicId($chatTopicId);
        $requestDTO->setTopicId($topicId);
    }
}
