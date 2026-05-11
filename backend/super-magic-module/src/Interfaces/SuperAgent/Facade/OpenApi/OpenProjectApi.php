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
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Open Project API.
 * Provides open API endpoints for project management.
 */
#[ApiResponse('low_code')]
class OpenProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Get project basic info (name, etc.) - no authentication required.
     */
    public function show(string $id): array
    {
        $projectEntity = $this->projectAppService->getProjectNotUserId((int) $id);

        return ['project_name' => $projectEntity?->getProjectName()];
    }

    /**
     * Create project.
     * Creates a new project for the authenticated user.
     *
     * @param RequestContext $requestContext Request context
     * @return array Created project information
     */
    public function createProject(RequestContext $requestContext): array
    {
        // 1. Get user authorization from coroutine context (set by middleware)
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        // 2. Set user authorization to RequestContext
        $requestContext->setUserAuthorization($userAuthorization);

        // 3. Create request DTO from request
        $requestDTO = CreateProjectRequestDTO::fromRequest($this->request);

        // 4. Call application service (reuse existing business logic)
        return $this->projectAppService->createProject($requestContext, $requestDTO);
    }

    /**
     * Get project list.
     * Returns projects for the authenticated user with pagination and filters.
     */
    public function index(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $requestContext->setUserAuthorization($userAuthorization);

        $requestDTO = GetProjectListRequestDTO::fromRequest($this->request);

        return $this->projectAppService->getProjectList($requestContext, $requestDTO);
    }

    /**
     * Get project attachments.
     * Supports access-token mode and optional logged-in user mode.
     */
    public function getProjectAttachments(RequestContext $requestContext): array
    {
        $requestDTO = GetProjectAttachmentsRequestDTO::fromRequest($this->request);
        $requestDTO->setPageSize(10000);

        if (! empty($requestDTO->getToken())) {
            return $this->projectAppService->getProjectAttachmentsByAccessToken($requestDTO);
        }

        $requestContext->setUserAuthorization($this->checkAndGetAuthorization());

        return $this->projectAppService->getProjectAttachments($requestContext, $requestDTO);
    }
}
