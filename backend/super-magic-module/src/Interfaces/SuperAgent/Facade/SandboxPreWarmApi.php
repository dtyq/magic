<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\SandboxPreWarmAppService;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 沙箱预启动API门面
 * 负责处理预启动沙箱的HTTP请求.
 */
class SandboxPreWarmApi extends AbstractApi
{
    private LoggerInterface $logger;

    public function __construct(
        protected RequestInterface $request,
        protected SandboxPreWarmAppService $sandboxPreWarmAppService,
        LoggerFactory $loggerFactory
    ) {
        parent::__construct($request);
        $this->logger = $loggerFactory->get('sandbox-pre-warm-api');
    }

    /**
     * 预启动沙箱（三种场景三选一）.
     *
     * 为话题预热（topic_id）:
     * { "topic_id": "123" }
     *
     * 为工作区预热（workspace_id）:
     * { "workspace_id": "456" }
     *
     * 为项目预热（project_id）:
     * { "project_id": "789" }
     *
     * 响应示例:
     * {
     *   "topic_id": "123",
     *   "sandbox_id": "sandbox_xxx",
     *   "status": "ready",
     *   "is_new": true,
     *   "is_hidden": false
     * }
     */
    #[ApiResponse('low_code')]
    public function preWarmSandbox(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求参数
        $topicId = $this->request->input('topic_id');
        $workspaceId = $this->request->input('workspace_id');
        $projectId = $this->request->input('project_id');
        $languageHeader = $this->request->getHeader('language')[0] ?? null;
        $language = null;
        if (! empty($languageHeader)) {
            $language = str_replace('-', '_', $languageHeader);
        }

        // 参数验证：三者必须有且只有一个
        $providedCount = (empty($topicId) ? 0 : 1) + (empty($workspaceId) ? 0 : 1) + (empty($projectId) ? 0 : 1);
        if ($providedCount === 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id, workspace_id or project_id is required');
        }
        if ($providedCount > 1) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Only one of topic_id, workspace_id, project_id can be provided');
        }

        $this->logger->info('收到沙箱预启动请求', [
            'topic_id' => $topicId,
            'workspace_id' => $workspaceId,
            'project_id' => $projectId,
            'language' => $language,
        ]);

        // 根据参数判断场景
        if (! empty($topicId)) {
            // 为话题预热
            $result = $this->sandboxPreWarmAppService->preWarmForTopic(
                $requestContext,
                (int) $topicId,
                $language
            );
        } elseif (! empty($workspaceId)) {
            // 为工作区预热
            $result = $this->sandboxPreWarmAppService->preWarmForWorkspace(
                $requestContext,
                (int) $workspaceId,
                $language
            );
        } else {
            // 为项目预热
            $result = $this->sandboxPreWarmAppService->preWarmForProject(
                $requestContext,
                (int) $projectId,
                $language
            );
        }

        $this->logger->info('沙箱预启动请求处理完成', [
            'topic_id' => $result['topic_id'],
            'sandbox_id' => $result['sandbox_id'],
            'is_new' => $result['is_new'],
        ]);

        return $result;
    }
}
