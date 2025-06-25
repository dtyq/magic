<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Project API.
 */
#[ApiResponse('low_code')]
class ProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService
    ) {
    }

    /**
     * Create project.
     */
    public function store(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CreateProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->createProject($requestContext, $requestDTO);
    }

    /**
     * Update project.
     */
    public function update(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateProjectRequestDTO::fromRequest($this->request);
        $requestDTO->id = $id;

        return $this->projectAppService->updateProject($requestContext, $requestDTO);
    }

    /**
     * Delete project.
     */
    public function destroy(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $this->projectAppService->deleteProject($requestContext, (int) $id);

        return ['id' => $id];
    }

    /**
     * Get project detail.
     */
    public function show(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $userId = $this->getAuthorization()->getId();

        $project = $this->projectAppService->getProject((int) $id, $userId);
        $projectDTO = ProjectItemDTO::fromEntity($project);

        return $projectDTO->toArray();
    }

    /**
     * Get project list.
     */
    public function index(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetProjectListRequestDTO::fromRequest($this->request);

        return $this->projectAppService->getProjectList($requestContext, $requestDTO);
    }

    /**
     * Get project topics.
     */
    public function getTopics(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取分页参数
        $page = (int) $this->request->input('page', 1);
        $pageSize = (int) $this->request->input('page_size', 10);

        return $this->projectAppService->getProjectTopics($requestContext, (int) $id, $page, $pageSize);
    }
}
