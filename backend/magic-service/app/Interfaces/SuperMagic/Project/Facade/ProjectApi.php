<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\Facade;

use App\Application\SuperMagic\File\FileScope\FileScopeHandlerResolver;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Application\SuperMagic\Project\Service\ProjectMemberAppService;
use App\Application\SuperMagic\Project\Service\TransferAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\BatchDeleteProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\BatchMoveProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\CreateSpecialProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ForkProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\GetParticipatedProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\GetProjectListRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\MoveProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\TransferProjectsRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\UpdateProjectPinRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\UpdateProjectRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Response\ProjectItemDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Request\GetSidebarTopicsRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

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
        private readonly TransferAppService $transferAppService,
        private readonly FileScopeHandlerResolver $fileScopeHandlerResolver,
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

        $result = $this->projectAppService->createProject($requestContext, $requestDTO);

        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $projectId = (int) ($result['project']['id'] ?? 0);

        $userRole = $this->projectAppService->getProjectRoleByUserId($projectId, $userId, $organizationCode);
        $memberSetting = $this->projectMemberAppService->getProjectMemberSetting($userId, $projectId);

        $result['project'] = array_merge($result['project'], [
            'user_role' => $userRole,
            'is_bind_workspace' => $memberSetting?->isBindWorkspace() ?? false,
            'bind_workspace_id' => (string) ($memberSetting?->getBindWorkspaceId() ?? 0),
        ]);

        return $result;
    }

    /**
     * Create or get special project by key.
     */
    public function storeSpecial(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CreateSpecialProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->createOrGetSpecialProject($requestContext, $requestDTO);
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
     * Batch delete projects.
     */
    public function batchDelete(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Validate and create DTO
        $requestDTO = BatchDeleteProjectsRequestDTO::fromRequest($this->request);

        // Execute batch delete
        $responseDTO = $this->projectAppService->batchDeleteProjects($requestContext, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * Pin project.
     */
    public function pin(RequestContext $requestContext, string $id): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // 1. 转换为RequestDTO并自动验证
        $requestDTO = UpdateProjectPinRequestDTO::fromRequest($this->request);
        $requestDTO->preProjectIdProvided = $this->request->has('pre_project_id');
        $requestDTO->nextProjectIdProvided = $this->request->has('next_project_id');

        // 2. 委托给Application层处理
        $this->projectMemberAppService->updateProjectPin($requestContext, (int) $id, $requestDTO);

        return [];
    }

    /**
     * Get project detail.
     */
    public function show(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        $project = $this->projectAppService->getProjectInfo($requestContext, (int) $id);

        $hasProjectMember = $this->projectAppService->hasProjectMember($project->getId());

        $userRole = $this->projectAppService->getProjectRoleByUserId($project->getId(), $userId, $organizationCode);

        $memberSetting = $this->projectMemberAppService->getProjectMemberSetting($userId, $project->getId());

        $projectDTO = ProjectItemDTO::fromEntity($project, null, null, $hasProjectMember);

        return array_merge($projectDTO->toArray(), [
            'user_role' => $userRole,
            'is_pinned' => $memberSetting?->isPinned() ?? false,
            'pinned_at' => $memberSetting?->getPinnedAt(),
            'is_bind_workspace' => $memberSetting?->isBindWorkspace() ?? false,
            'bind_workspace_id' => (string) ($memberSetting?->getBindWorkspaceId() ?? 0),
        ]);
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

    public function getSidebarTopics(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetSidebarTopicsRequestDTO::fromRequest($this->request);
        $requestDTO->setProjectId((int) $id);

        return $this->projectAppService->getProjectSidebarTopics($requestContext, $requestDTO);
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
    public function getProjectAttachments(RequestContext $requestContext): array
    {
        // 使用 fromRequest 方法从请求中创建 DTO，这样可以从路由参数中获取 project_id
        $dto = GetProjectAttachmentsRequestDTO::fromRequest($this->request);
        // 临时解决用户使用上限问题
        $dto->setPageSize(10000);
        if ($dto->hasScope()) {
            $authorization = $this->checkAndGetAuthorization();
            return $this->fileScopeHandlerResolver
                ->resolve($dto->getScope())
                ->listProjectAttachments($authorization, $dto);
        }

        if (! empty($dto->getToken())) {
            // 走令牌校验的逻辑
            return $this->projectAppService->getProjectAttachmentsByAccessToken($dto);
        }

        // 登录用户使用的场景
        $requestContext->setUserAuthorization($this->checkAndGetAuthorization());
        return $this->projectAppService->getProjectAttachments($requestContext, $dto);
    }

    /**
     * V2 project attachments: backend-managed parent traversal, raw rows, no tree.
     */
    public function getProjectAttachmentsV2(RequestContext $requestContext): array
    {
        $dto = GetProjectAttachmentsV2RequestDTO::fromRequest($this->request);

        if ($dto->hasScope()) {
            $authorization = $this->checkAndGetAuthorization();
            return $this->fileScopeHandlerResolver
                ->resolve($dto->getScope())
                ->listProjectAttachmentsV2($authorization, $dto);
        }

        if (! empty($dto->getToken())) {
            return $this->projectAppService->getProjectAttachmentsByAccessTokenV2($dto);
        }

        $requestContext->setUserAuthorization($this->checkAndGetAuthorization());
        return $this->projectAppService->getProjectAttachmentsV2($requestContext, $dto);
    }

    /**
     * 项目附件总数（临时灰度开关）。
     * 前端根据返回的 total 决定走 V1（≤500）或 V2（>500）。
     */
    public function getProjectAttachmentsCount(RequestContext $requestContext, string $id): array
    {
        $scope = trim((string) $this->request->input('scope', ''));
        if ($scope !== '') {
            $authorization = $this->checkAndGetAuthorization();
            return $this->fileScopeHandlerResolver
                ->resolve($scope)
                ->countProjectAttachments($authorization);
        }

        $token = (string) $this->request->input('token', '');

        if ($token !== '') {
            return $this->projectAppService->getProjectAttachmentsCount(null, (int) $id, $token);
        }

        $requestContext->setUserAuthorization($this->checkAndGetAuthorization());
        return $this->projectAppService->getProjectAttachmentsCount($requestContext, (int) $id, null);
    }

    public function getCloudFiles(RequestContext $requestContext, string $id): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->projectAppService->getCloudFiles($requestContext, (int) $id);
    }

    /**
     * Fork project.
     * @throws Throwable
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
        $requestDTO->preProjectIdProvided = $this->request->has('pre_project_id');
        $requestDTO->nextProjectIdProvided = $this->request->has('next_project_id');

        return $this->projectAppService->moveProject($requestContext, $requestDTO);
    }

    /**
     * Batch move projects to target workspace.
     */
    public function batchMoveProjects(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = BatchMoveProjectsRequestDTO::fromRequest($this->request);
        $requestDTO->preProjectIdProvided = $this->request->has('pre_project_id');
        $requestDTO->nextProjectIdProvided = $this->request->has('next_project_id');

        return $this->projectAppService->batchMoveProjects($requestContext, $requestDTO);
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

    public function visit(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->projectMemberAppService->recordProjectVisit($requestContext, (int) $id);
    }

    /**
     * Transfer projects to another user.
     *
     * Batch transfer ownership of multiple projects to a specified user.
     * Original owner can optionally retain access with reduced permissions.
     */
    public function transferProjects(RequestContext $requestContext): array
    {
        // Set user authorization
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = TransferProjectsRequestDTO::fromRequest($this->request);

        return $this->transferAppService->transferProjects($requestContext, $requestDTO);
    }

    /**
     * GET /projects/{project_id}/accessibility：可访问时返回 project_id 与归属 magic 组织编码；否则 null.
     */
    public function getProjectAccessibility(RequestContext $requestContext, string $project_id): ?array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $project = $this->projectAppService->getProjectAccessibility($requestContext, (int) $project_id);
        if ($project === null) {
            return null;
        }

        return [
            'project_id' => $project->getId(),
            'required_magic_organization_code' => $project->getUserOrganizationCode(),
        ];
    }
}
