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
     * 预启动沙箱.
     *
     * 话题内场景请求示例:
     * {
     *   "topic_id": "123"
     * }
     *
     * 话题外场景请求示例:
     * {
     *   "workspace_id": "456"
     * }
     *
     * 响应示例:
     * {
     *   "topic_id": "123",
     *   "sandbox_id": "sandbox_xxx",
     *   "status": "creating",
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
        $languageHeader = $this->request->getHeader('language')[0] ?? null;
        $language = null;
        if (! empty($languageHeader)) {
            $language = str_replace('-', '_', $languageHeader);
        }

        // 参数验证：两者必须有且只有一个
        if (empty($topicId) && empty($workspaceId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id or workspace_id is required');
        }

        if (! empty($topicId) && ! empty($workspaceId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'topic_id and workspace_id cannot be both provided');
        }

        $this->logger->info('收到沙箱预启动请求', [
            'topic_id' => $topicId,
            'workspace_id' => $workspaceId,
            'language' => $language,
        ]);

        // 根据参数判断场景
        if (! empty($topicId)) {
            // 话题内场景
            $result = $this->sandboxPreWarmAppService->preWarmInTopic(
                $requestContext,
                (int) $topicId,
                $language
            );
        } else {
            // 话题外场景
            $result = $this->sandboxPreWarmAppService->preWarmOutsideTopic(
                $requestContext,
                (int) $workspaceId,
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
