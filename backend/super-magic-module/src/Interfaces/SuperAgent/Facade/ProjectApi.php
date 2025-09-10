<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectMemberAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ForkProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetParticipatedProjectsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\MoveProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SetProjectShortcutRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectItemDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

/**
 * Project API.
 */
#[ApiResponse('low_code')]
class ProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService,
        private readonly ProjectMemberAppService $projectMemberAppService,
    ) {
        parent::__construct($request);
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

        $project = $this->projectAppService->getProject($requestContext, (int) $id);

        $hasProjectMember = $this->projectAppService->hasProjectMember($project->getId());

        $projectDTO = ProjectItemDTO::fromEntity($project, null, null, $hasProjectMember);

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

    public function checkFileListUpdate(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $dataIsolation = DataIsolation::create(
            $requestContext->getUserAuthorization()->getOrganizationCode(),
            $requestContext->getUserAuthorization()->getId()
        );

        return $this->projectAppService->checkFileListUpdate($requestContext, (int) $id, $dataIsolation);
    }

    /**
     * Get project attachments.
     */
    public function getProjectAttachments(RequestContext $requestContext, string $id): array
    {
        // 使用 fromRequest 方法从请求中创建 DTO，这样可以从路由参数中获取 project_id
        $dto = GetProjectAttachmentsRequestDTO::fromRequest($this->request);
        if (! empty($dto->getToken())) {
            // 走令牌校验的逻辑
            return $this->projectAppService->getProjectAttachmentsByAccessToken($dto);
        }

        // 登录用户使用的场景
        $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());
        return $this->projectAppService->getProjectAttachments($requestContext, $dto);
    }

    public function getCloudFiles(RequestContext $requestContext, string $id)
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->projectAppService->getCloudFiles($requestContext, (int) $id);
    }

    /**
     * Fork project.
     */
    public function fork(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = ForkProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->forkProject($requestContext, $requestDTO);
    }

    /**
     * Check fork project status.
     */
    public function forkStatus(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->projectAppService->checkForkProjectStatus($requestContext, (int) $id);
    }

    /**
     * Move project to another workspace.
     */
    public function moveProject(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = MoveProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->moveProject($requestContext, $requestDTO);
    }

    /**
     * Set project shortcut.
     */
    public function setProjectShortcut(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = SetProjectShortcutRequestDTO::fromRequest($this->request);

        $this->projectMemberAppService->setProjectShortcut($requestContext, (int) $id, $requestDTO);

        return [
            'success' => true,
        ];
    }

    /**
     * Cancel project shortcut.
     */
    public function cancelProjectShortcut(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $this->projectMemberAppService->cancelProjectShortcut($requestContext, (int) $id);

        return [
            'success' => true,
        ];
    }

    /**
     * Get participated projects.
     */
    public function getParticipatedProjects(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetParticipatedProjectsRequestDTO::fromRequest($this->request);

        return $this->projectMemberAppService->getParticipatedProjects($requestContext, $requestDTO);
    }
}
