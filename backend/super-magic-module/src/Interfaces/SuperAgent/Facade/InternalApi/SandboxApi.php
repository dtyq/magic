<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class SandboxApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly TopicAppService $topicAppService,
        private readonly ProjectAppService $projectAppService,
        private readonly AgentAppService $agentAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 检查沙箱镜像版本（当前版本 vs 最新版本）.
     * 沙箱调用此接口检查自身是否需要升级.
     */
    public function checkSandboxVersion(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $sandboxId = $this->request->input('sandbox_id', '');

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        // sandbox_id 即 topic_id，直接复用 getTopic（含权限校验）
        $this->topicAppService->getTopic($requestContext, (int) $sandboxId);

        return $this->agentAppService->checkSandboxVersion((int) $sandboxId);
    }

    /**
     * 沙箱自我升级接口.
     * 沙箱调用此接口将自身升级到最新 Agent 镜像.
     */
    public function upgradeSandbox(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $sandboxId = $this->request->input('sandbox_id', '');

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        // sandbox_id 即 topic_id，直接复用 getTopic（含权限校验）
        $topic = $this->topicAppService->getTopic($requestContext, (int) $sandboxId);

        $project = $this->projectAppService->getProjectNotUserId((int) $topic->getProjectId());
        $workDir = $project->getWorkDir() ?? '';

        $authorization = $this->getAuthorization();
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($authorization->getId());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $result = $this->agentAppService->upgradeSandbox(
            $dataIsolation,
            $sandboxId,
            (string) $topic->getProjectId(),
            $workDir
        );

        return $result->toArray();
    }
}
