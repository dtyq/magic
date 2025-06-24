<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectListResponseDTO;

/**
 * Project API
 */
#[ApiResponse('low_code')]
class ProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService
    ) {}

    /**
     * Create project
     */
    public function store(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CreateProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->createProject($requestContext, $requestDTO);
    }

    /**
     * Update project
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
     * Delete project
     */
    public function destroy(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());
        
        $userId = $this->getAuthorization()->getId();

        $result = $this->projectAppService->deleteProject($id, $userId);

        return ['deleted' => $result];
    }

    /**
     * Get project detail
     */
    public function show(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());
        
        $userId = $this->getAuthorization()->getId();

        $project = $this->projectAppService->getProject((int)$id, $userId);
        $projectDTO = ProjectItemDTO::fromEntity($project);

        return $projectDTO->toArray();
    }

    /**
     * Get project list
     */
    public function index(RequestContext $requestContext, array $requestData = []): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());
        
        $userId = $this->getAuthorization()->getId();
        $userOrganizationCode = $this->getAuthorization()->getOrganizationCode();
        
        $requestDTO = GetProjectListRequestDTO::fromArray(array_merge($requestData, [
            'user_id' => $userId,
            'user_organization_code' => $userOrganizationCode,
        ]));

        $page = new Page($requestDTO->page, $requestDTO->pageSize);
        
        $result = $this->projectAppService->getProjectList(
            userId: $requestDTO->userId,
            userOrganizationCode: $requestDTO->userOrganizationCode,
            workspaceId: $requestDTO->workspaceId,
            page: $page
        );

        $listResponseDTO = ProjectListResponseDTO::fromResult($result);

        return $listResponseDTO->toArray();
    }

    /**
     * Get recent projects
     */
    public function getRecentProjects(RequestContext $requestContext, int $limit = 10): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());
        
        $userId = $this->getAuthorization()->getId();

        $projects = $this->projectAppService->getRecentProjects($userId, $limit);
        
        $projectDTOs = [];
        foreach ($projects as $project) {
            $projectDTOs[] = ProjectItemDTO::fromEntity($project)->toArray();
        }

        return ['list' => $projectDTOs];
    }

    /**
     * Get workspace projects
     */
    public function getWorkspaceProjects(RequestContext $requestContext, int $workspaceId): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());
        
        $userId = $this->getAuthorization()->getId();

        $projects = $this->projectAppService->getWorkspaceProjects($workspaceId, $userId);
        
        $projectDTOs = [];
        foreach ($projects as $project) {
            $projectDTOs[] = ProjectItemDTO::fromEntity($project)->toArray();
        }

        return ['list' => $projectDTOs];
    }
}