<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectStatus;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * Project Domain Service
 */
class ProjectDomainService
{
    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository,
    ) {}

    /**
     * Create project
     */
    public function createProject(
        int $workspaceId,
        string $projectName,
        string $userId,
        string $userOrganizationCode,
        string $workDir = ''
    ): ProjectEntity {
        $currentTime = date('Y-m-d H:i:s');
        $project = new ProjectEntity();
        $project->setUserId($userId)
                ->setUserOrganizationCode($userOrganizationCode)
                ->setWorkspaceId($workspaceId)
                ->setProjectName($projectName)
                ->setWorkDir($workDir)
                ->setProjectStatus(ProjectStatus::ACTIVE->value)
                ->setCurrentTopicId(null)
                ->setCurrentTopicStatus('')
                ->setCreatedUid($userId)
                ->setUpdatedUid($userId)
                ->setCreatedAt($currentTime)
                ->setUpdatedAt($currentTime);

        return $this->projectRepository->save($project);
    }

    /**
     * Update project
     */
    public function updateProject(
        int $projectId,
        string $userId,
        ?string $projectName = null,
        ?string $workDir = null,
        ?string $currentTopicId = null,
        ?string $currentTopicStatus = null
    ): ProjectEntity {
        $project = $this->projectRepository->findById($projectId);
        if (!$project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        $project->setUpdatedUid($userId);

        return $this->projectRepository->save($project);
    }

    /**
     * Delete project
     */
    public function deleteProject(int $projectId, string $userId): bool
    {
        $project = $this->projectRepository->findById($projectId);
        if (!$project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        return $this->projectRepository->delete($project);
    }

    public function deleteProjectsByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId): bool
    {
        $conditions = [
            'workspace_id' => $workspaceId,
        ];

        $data = [
            'deleted_at' => date('Y-m-d H:i:s'),
            'updated_uid' => $dataIsolation->getCurrentUserId(),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        return $this->projectRepository->updateProjectByCondition($conditions, $data);
    }

    /**
     * Get project details
     */
    public function getProject(int $projectId, string $userId): ProjectEntity
    {
        $project = $this->projectRepository->findById($projectId);
        if (!$project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        return $project;
    }

    /**
     * Get user's project list
     */
    public function getUserProjects(
        string $userId,
        ?string $organizationCode = null,
        ?Page $page = null
    ): array {
        if ($organizationCode) {
            return $this->projectRepository->findByUserIdAndOrganizationCode($userId, $organizationCode, $page);
        }

        return $this->projectRepository->findByUserId($userId, $page);
    }

    /**
     * Get project list under workspace
     */
    public function getWorkspaceProjects(int $workspaceId, string $userId): array
    {
        return $this->projectRepository->findByWorkspaceIdAndUserId($workspaceId, $userId);
    }

    /**
     * Get user's recently used project list
     */
    public function getRecentProjects(string $userId, int $limit = 10): array
    {
        return $this->projectRepository->findRecentProjectsByUserId($userId, $limit);
    }

    /**
     * Check if project exists
     */
    public function existsProject(int $projectId): bool
    {
        return $this->projectRepository->exists($projectId);
    }

    /**
     * Count user's projects
     */
    public function countUserProjects(string $userId): int
    {
        return $this->projectRepository->countByUserId($userId);
    }

    /**
     * Save project entity
     * Directly save project entity without redundant queries.
     * @param ProjectEntity $projectEntity Project entity
     * @return ProjectEntity Saved project entity
     */
    public function saveProjectEntity(ProjectEntity $projectEntity): ProjectEntity
    {
        return $this->projectRepository->save($projectEntity);
    }
}