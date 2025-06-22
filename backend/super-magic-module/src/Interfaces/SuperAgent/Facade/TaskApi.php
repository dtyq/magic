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
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTaskFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse('low_code')]
class TaskApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicTaskAppService $topicTaskAppService,
        protected TaskAppService $taskAppService,
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

        // 从请求中创建DTO
        $messageDTO = TopicTaskMessageDTO::fromArray($this->request->all());
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
        if (! $dto->getCache()) {
            $options['cache'] = false;
        }

        // 调用应用服务
        return $this->workspaceAppService->getFileUrls(
            $userAuthorization,
            $dto->getFileIds(),
            $dto->getDownloadMode(),
            $options
        );
    }
}
