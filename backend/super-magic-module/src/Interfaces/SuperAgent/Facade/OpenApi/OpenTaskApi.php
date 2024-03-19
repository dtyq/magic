<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Share\Service\ResourceShareAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleTaskMessageAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateAgentTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateOpenTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateScriptTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateTaskShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

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
        protected ResourceShareAppService $shareAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Summary of updateTaskStatus.
     * @throws Throwable
     */
    #[ApiResponse('low_code')]
    public function updateTaskStatus(RequestContext $requestContext): array
    {
        $taskId = $this->request->input('task_id', '');
        $status = $this->request->input('status', '');
        $id = $this->request->input('id', '');
        $this->handRequestContext($requestContext);

        // 如果task_id为空，则使用id
        if (empty($taskId)) {
            $taskId = $id;
        }

        if (empty($taskId) || empty($status)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_id_or_status_is_required');
        }

        $taskEntity = $this->taskAppService->getTaskById((int) $taskId);
        if ($taskEntity === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_not_found');
        }

        // 检查用户是否有权限更新任务状态
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if ($taskEntity->getUserId() !== $userAuthorization?->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_not_authorized');
        }

        $dataIsolation = new DataIsolation();
        // 设置用户授权信息
        $dataIsolation->setCurrentUserId($userAuthorization?->getId());
        $status = TaskStatus::from($status);

        $this->topicTaskAppService->updateTaskStatus($dataIsolation, $taskEntity, $status);
        return [];
    }

    /**
     * Summary of agentTask.
     */
    #[ApiResponse('low_code')]
    public function agentTask(RequestContext $requestContext): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateAgentTaskRequestDTO::fromRequest($this->request);

        $this->handRequestContext($requestContext);
        /** @var MagicUserAuthorization $magicUserAuthorization */
        $magicUserAuthorization = $this->getAuthorization();
        // 判断话题是否存在，不存在则初始化话题
        $topicId = $requestDTO->getTopicId();

        $topicDTO = $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $requestDTO->setConversationId($topicId);

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($magicUserAuthorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($magicUserAuthorization->getThirdPlatformOrganizationCode());
        $dataIsolation->setCurrentOrganizationCode($magicUserAuthorization->getOrganizationCode());
        $dataIsolation->setUserType($magicUserAuthorization->getUserType());
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
                    'agent_user_id' => $magicUserAuthorization->getId(),
                    'agent_mode' => '',
                    'task_mode' => '',
                ];
                $userMessageDTO = UserMessageDTO::fromArray($userMessage);
                $result = $this->handleTaskMessageAppService->initSandbox($dataIsolation, $userMessageDTO);

                if (empty($result['sandbox_id'])) {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'the sandbox cannot running,please check the sandbox status');
                }
                $taskEntity = $this->handleTaskAppService->getTask((int) $result['task_id']);
            } else {
                $taskEntity = $this->handleTaskAppService->getTaskBySandboxId($sandboxId);
            }

            $userMessage = [
                'chat_topic_id' => $topicDTO->getChatTopicId(),
                'chat_conversation_id' => $topicDTO->getChatConversationId(),
                'prompt' => $requestDTO->getPrompt(),
                'attachments' => null,
                'mentions' => null,
                'agent_user_id' => $magicUserAuthorization->getId(),
                'agent_mode' => '',
                'task_mode' => $taskEntity->getTaskMode(),
            ];
            $userMessageDTO = UserMessageDTO::fromArray($userMessage);

            $taskEntity = $this->handleTaskMessageAppService->sendChatMessage($dataIsolation, $userMessageDTO);
        } catch (Exception $e) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $e->getMessage());
        }

        return $taskEntity?->toArray() ?? [];
    }

    /**
     * Summary of scriptTask.
     */
    #[ApiResponse('low_code')]
    public function scriptTask(RequestContext $requestContext): array
    {
        // 从请求中创建DTO并验证参数
        $requestDTO = CreateScriptTaskRequestDTO::fromRequest($this->request);

        $this->handRequestContext($requestContext);

        $taskEntity = $this->handleTaskAppService->getTask((int) $requestDTO->getTaskId());

        // 判断话题是否存在，不存在则初始化话题
        $topicId = $taskEntity->getTopicId();
        $topicDTO = $this->topicAppService->getTopic($requestContext, $topicId);

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

        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }
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

        $userAuthorization = RequestCoContext::getUserAuthorization();
        if ($task->getUserId() !== $userAuthorization?->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_not_authorized');
        }

        return $task->toArray();
    }

    /**
     * Get task status (lightweight query for polling).
     * Returns only essential fields: id, task_status, err_msg, updated_at.
     *
     * @param RequestContext $requestContext Request context
     * @return array Task status information
     */
    #[ApiResponse('low_code')]
    public function getTaskStatus(RequestContext $requestContext): array
    {
        $taskId = $this->request->input('task_id', '');
        if (empty($taskId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_id is required');
        }

        // Get user authorization from coroutine context
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // Call TopicTaskAppService which includes permission check
        return $this->topicTaskAppService->getTaskStatusById($requestContext, (int) $taskId);
    }

    /**
     * Create task (send message to Agent).
     * Simplified interface for open API with automatic conversion to rich text format.
     *
     * @param RequestContext $requestContext Request context
     * @return array Created task information
     */
    #[ApiResponse('low_code')]
    public function createTask(RequestContext $requestContext): array
    {
        // 1. Get user authorization from coroutine context
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 2. Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // 3. Get simplified request DTO
        $openTaskDTO = CreateOpenTaskRequestDTO::fromRequest($this->request);

        // 4. Convert plain text to Tiptap format
        $tiptapContent = $this->convertTextToTiptap($openTaskDTO->getContent());

        // 5. Build complete message_content structure
        $messageContent = [
            'content' => json_encode($tiptapContent),
            'instructs' => [['value' => 'normal']],
            'extra' => [
                'super_agent' => [
                    'mentions' => [],
                    'chat_mode' => 'normal',
                    'topic_pattern' => $openTaskDTO->getAgentMode(),
                    'enable_web_search' => $openTaskDTO->getEnableWebSearch(),
                ],
            ],
        ];

        // Add model configuration if provided
        if (! empty($openTaskDTO->getModelId())) {
            $messageContent['extra']['super_agent']['model'] = [
                'model_id' => $openTaskDTO->getModelId(),
            ];
        }

        // Add image model configuration if provided
        if (! empty($openTaskDTO->getImageModelId())) {
            $messageContent['extra']['super_agent']['image_model'] = [
                'model_id' => $openTaskDTO->getImageModelId(),
            ];
        }

        // 6. Build complete CreateTaskRequestDTO
        $taskRequestData = [
            'project_id' => $openTaskDTO->getProjectId(),
            'topic_id' => $openTaskDTO->getTopicId(),
            'message_type' => 'rich_text',
            'message_content' => $messageContent,
        ];

        $taskDTO = new CreateTaskRequestDTO($taskRequestData);

        // 7. Call application service with converted DTO
        return $this->topicTaskAppService->createTask($requestContext, $taskDTO);
    }

    /**
     * Cancel task.
     * Suspends a running task.
     *
     * @param RequestContext $requestContext Request context
     * @return array Cancel result
     */
    #[ApiResponse('low_code')]
    public function cancelTask(RequestContext $requestContext): array
    {
        // 1. Get user authorization from coroutine context
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 2. Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // 3. Get task ID from route parameter
        $taskId = $this->request->route('id');
        if (empty($taskId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_id is required');
        }

        // 4. Call application service
        return $this->topicTaskAppService->cancelTask($requestContext, $taskId);
    }

    /**
     * Create task share.
     * Creates a permanent internet-accessible share for a completed task's topic.
     * If share already exists, updates the existing share.
     *
     * @param RequestContext $requestContext Request context
     * @return array Share information
     */
    #[ApiResponse('low_code')]
    public function createTaskShare(RequestContext $requestContext): array
    {
        // 1. Get user authorization from coroutine context
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 2. Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // 3. Get and validate request DTO
        $requestDTO = CreateTaskShareRequestDTO::fromRequest($this->request);

        // 4. Get task entity with permission check
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        $taskEntity = $this->taskAppService->getTaskById((int) $requestDTO->getTaskId());
        if (empty($taskEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_not_found');
        }

        // 5. Verify task ownership
        if ($taskEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TASK_ACCESS_DENIED,
                'Task does not belong to current user'
            );
        }

        // 6. Verify task is finished
        if ($taskEntity->getTaskStatus() !== TaskStatus::FINISHED->value) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                'Only completed tasks can be shared'
            );
        }

        // 7. Get topic ID from task
        $topicId = $taskEntity->getTopicId();

        // 8. Build CreateShareRequestDTO
        $shareDTO = new CreateShareRequestDTO();
        $shareDTO->resourceId = (string) $topicId;
        $shareDTO->resourceType = ResourceType::Topic->value;
        $shareDTO->shareType = ShareAccessType::TeamShare->value; // Organization internal access
        $shareDTO->shareRange = 'all'; // 全组织成员可访问
        $shareDTO->password = null; // No password
        $shareDTO->expireDays = null; // Permanent
        $shareDTO->extra = $requestDTO->getExtra();

        // 9. Create or update share
        $shareResult = $this->shareAppService->createShare($userAuthorization, $shareDTO);

        return $shareResult->toArray();
    }

    /**
     * Convert plain text to Tiptap JSON format.
     * Supports multi-line text (each line becomes a paragraph).
     *
     * @param string $text Plain text content
     * @return array Tiptap JSON structure
     */
    private function convertTextToTiptap(string $text): array
    {
        // Split text by newlines
        $lines = explode("\n", $text);

        $paragraphs = [];
        foreach ($lines as $line) {
            // Create paragraph for each line (including empty lines)
            $paragraphs[] = [
                'type' => 'paragraph',
                'attrs' => ['suggestion' => ''],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => $line,
                    ],
                ],
            ];
        }

        return [
            'type' => 'doc',
            'content' => $paragraphs,
        ];
    }

    private function handRequestContext(RequestContext $requestContext): void
    {
        /** @var MagicUserAuthorization $magicUserAuthorization */
        $magicUserAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($magicUserAuthorization);
    }
}
