<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\CleanupFileKeysRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileKeyCleanupAppService;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * File Key Cleanup API.
 */
class FileKeyCleanupApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected FileKeyCleanupAppService $service
    ) {
        parent::__construct($request);
    }

    /**
     * Get cleanup statistics.
     *
     * GET /api/v1/super-agent/file-keys/cleanup/statistics
     * Query parameters:
     *   - project_id (optional): Filter by project ID
     *   - file_key (optional): Filter by specific file key
     */
    public function getStatistics(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setAuthorization($this->request->header('authorization', ''));
        $requestContext->setUserAuthorization($this->getAuthorization());

        $projectId = $this->request->input('project_id')
            ? (int) $this->request->input('project_id')
            : null;
        $fileKey = $this->request->input('file_key');

        return $this->service->getStatistics($projectId, $fileKey);
    }

    /**
     * Execute cleanup process.
     *
     * POST /api/v1/super-agent/file-keys/cleanup
     * Request body:
     *   - project_id (optional): Filter by project ID
     *   - file_key (optional): Filter by specific file key
     *   - dry_run (optional): Preview mode, default false
     */
    public function cleanup(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setAuthorization($this->request->header('authorization', ''));
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CleanupFileKeysRequestDTO::fromRequest($this->request);

        return $this->service->executeCleanup($requestDTO);
    }

    /**
     * Preview cleanup (dry run mode).
     *
     * POST /api/v1/super-agent/file-keys/cleanup/preview
     * Request body:
     *   - project_id (optional): Filter by project ID
     *   - file_key (optional): Filter by specific file key
     */
    public function preview(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setAuthorization($this->request->header('authorization', ''));
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CleanupFileKeysRequestDTO::fromRequest($this->request);

        // Force dry-run mode for preview
        $requestDTO->dryRun = true;

        return $this->service->executeCleanup($requestDTO);
    }
}
