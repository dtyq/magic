<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Open Workspace API.
 * Provides open API endpoints for workspace management.
 */
#[ApiResponse('low_code')]
class OpenWorkspaceApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Get workspace list.
     * Returns workspace list for the authenticated user.
     *
     * @param RequestContext $requestContext Request context
     * @return array Workspace list with pagination
     */
    public function getWorkspaceList(RequestContext $requestContext): array
    {
        // 1. Get user authorization from coroutine context (set by middleware)
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 2. Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // 3. Create request DTO from request
        $requestDTO = WorkspaceListRequestDTO::fromRequest($this->request);

        // 4. Call application service (reuse existing business logic)
        return $this->workspaceAppService->getWorkspaceList($requestContext, $requestDTO)->toArray();
    }
}
