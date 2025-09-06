<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Project API.
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

        return ['project_name' => $projectEntity->getProjectName()];
    }
}
