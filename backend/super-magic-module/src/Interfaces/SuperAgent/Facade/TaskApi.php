<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AccessTokenAuthorizationService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileConverterAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleTaskMessageAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\UserDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ConvertFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateTaskRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\Codec\Json;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[ApiResponse('low_code')]
class TaskApi extends AbstractApi
{
    protected LoggerInterface $logger;

    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicTaskAppService $topicTaskAppService,
        protected HandleTaskMessageAppService $handleTaskAppService,
        protected TaskAppService $taskAppService,
        protected FileConverterAppService $fileConverterAppService,
        LoggerFactory $loggerFactory,
        protected ProjectAppService $projectAppService,
        protected TopicAppService $topicAppService,
        protected UserDomainService $userDomainService,
        protected HandleTaskMessageAppService $handleTaskMessageAppService,
        protected AgentAppService $agentAppService,
        private readonly AccessTokenAuthorizationService $accessTokenAuthorizationService,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
        parent::__construct($request);
    }

    /**
     * 投递话题任务消息.
     *
     * @return array 操作结果
     * @throws BusinessException|Throwable 如果参数无效或操作失败则抛出异常
     */
    public function deliverMessage(): array
    {
        // 查看是否混淆
        $isConfusion = $this->request->input('obfuscated', false);
        if ($isConfusion) {
            // 混淆处理
            $rawData = ShadowCode::unShadow($this->request->input('data', ''));
        } else {
            $rawData = $this->request->input('data', '');
        }
        $requestData = Json::decode($rawData);
        simple_log('DeliverMessageReceived', $requestData);

        // 从请求中创建DTO
        $messageDTO = TopicTaskMessageDTO::fromArray($requestData);
        // 调用应用服务进行消息投递
        if (config('super-magic.message.process_mode') === 'direct') {
            return $this->topicTaskAppService->handleTopicTaskMessage($messageDTO);
        }
        return $this->topicTaskAppService->deliverTopicTaskMessage($messageDTO);
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
     * 批量转换文件.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 转换结果
     * @throws Throwable
     */
    public function convertFiles(RequestContext $requestContext): array
    {
        // 获取请求DTO
        $dto = ConvertFilesRequestDTO::fromRequest($this->request);

        if (! empty($dto->token)) {
            // 先进行下载权限校验
            $this->accessTokenAuthorizationService->validateTokenAndCheckDownloadPermission($dto->token);

            // 走token鉴权逻辑：验证token并创建临时用户授权（基于分享创建者信息）
            $userAuthorization = $this->accessTokenAuthorizationService->validateTokenAndCreateUserAuthorization($dto->token);
        } else {
            // 原有的用户鉴权流程
            // 设置用户授权信息
            $requestContext->setUserAuthorization($this->getAuthorization());
            $userAuthorization = $requestContext->getUserAuthorization();
        }
        try {
            // 调用应用服务
            return $this->fileConverterAppService->convertFiles($userAuthorization, $dto);
        } catch (Throwable $e) {
            $this->logger->error('Convert files API failed', [
                'user_id' => $userAuthorization->getId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'project_id' => $dto->project_id,
                'file_ids_count' => count($dto->file_ids),
                'convert_type' => $dto->convert_type,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * 检查文件转换状态.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 状态检查结果
     * @throws Throwable
     */
    public function checkFileConvertStatus(RequestContext $requestContext): array
    {
        $taskKey = $this->request->input('task_key');

        if (empty($taskKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'validation.required');
        }

        $token = $this->request->input('token');
        if (! empty($token)) {
            // 先进行下载权限校验
            $this->accessTokenAuthorizationService->validateTokenAndCheckDownloadPermission($token);

            // 走token鉴权逻辑：验证token并创建临时用户授权（基于分享创建者信息）
            $userAuthorization = $this->accessTokenAuthorizationService->validateTokenAndCreateUserAuthorization($token);
        } else {
            // 原有的用户鉴权流程
            // 设置用户授权信息
            $requestContext->setUserAuthorization($this->getAuthorization());
            $userAuthorization = $requestContext->getUserAuthorization();
        }

        try {
            $result = $this->fileConverterAppService->checkFileConvertStatus($userAuthorization, $taskKey);

            // 如果状态是 FAILED，抛出异常
            if ($result->getStatus() === ConvertStatusEnum::FAILED->value) {
                $this->logger->error('File conversion failed', [
                    'task_key' => $taskKey,
                    'user_id' => $userAuthorization->getId(),
                    'organization_code' => $userAuthorization->getOrganizationCode(),
                    'status' => $result->getStatus(),
                    'total_files' => $result->getTotalFiles(),
                    'success_count' => $result->getSuccessCount(),
                    'batch_id' => $result->getBatchId(),
                    'convert_type' => $result->getConvertType(),
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_CONVERT_FAILED, 'file.convert_failed');
            }

            // 如果状态是 COMPLETED 但是没有下载地址，说明任务发生了错误
            if ($result->getStatus() === ConvertStatusEnum::COMPLETED->value && empty($result->getDownloadUrl())) {
                $this->logger->error('File conversion completed but no download URL available', [
                    'task_key' => $taskKey,
                    'user_id' => $userAuthorization->getId(),
                    'organization_code' => $userAuthorization->getOrganizationCode(),
                    'status' => $result->getStatus(),
                    'total_files' => $result->getTotalFiles(),
                    'success_count' => $result->getSuccessCount(),
                    'batch_id' => $result->getBatchId(),
                    'convert_type' => $result->getConvertType(),
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_CONVERT_FAILED, 'file.convert_failed');
            }

            return $result->toArray();
        } catch (Throwable $e) {
            $this->logger->error('Check file convert status failed', [
                'task_key' => $taskKey,
                'user_id' => $userAuthorization->getId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Create task (send message to agent).
     *
     * @param RequestContext $requestContext Request context
     * @return array Task creation result
     */
    public function createTask(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = CreateTaskRequestDTO::fromRequest($this->request);

        return $this->topicTaskAppService->createTask($requestContext, $requestDTO);
    }

    /**
     * Cancel task.
     *
     * @param RequestContext $requestContext Request context
     * @return array Cancel result
     */
    public function cancelTask(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $taskId = $this->request->route('id');

        return $this->topicTaskAppService->cancelTask($requestContext, $taskId);
    }

    /**
     * Get task status (lightweight query for polling).
     * Returns only essential fields for status checking.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Task ID
     * @return array Task status information
     */
    public function getTaskStatus(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Call TopicTaskAppService which includes permission check
        return $this->topicTaskAppService->getTaskStatusById($requestContext, (int) $id);
    }
}
