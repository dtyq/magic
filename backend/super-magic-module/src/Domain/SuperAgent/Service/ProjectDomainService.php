<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ForkStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TopicMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

use function Hyperf\Translation\trans;

/**
 * Project Domain Service.
 */
class ProjectDomainService
{
    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly ProjectForkRepositoryInterface $projectForkRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
    ) {
    }

    /**
     * Create project.
     */
    public function createProject(
        int $workspaceId,
        string $projectName,
        string $userId,
        string $userOrganizationCode,
        string $projectId = '',
        string $workDir = '',
        ?string $projectMode = null
    ): ProjectEntity {
        $currentTime = date('Y-m-d H:i:s');
        $project = new ProjectEntity();
        if (! empty($projectId)) {
            $project->setId((int) $projectId);
        }
        $project->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setWorkspaceId($workspaceId)
            ->setProjectName($projectName)
            ->setWorkDir($workDir)
            ->setProjectMode($projectMode)
            ->setProjectStatus(ProjectStatus::ACTIVE->value)
            ->setCurrentTopicId(null)
            ->setCurrentTopicStatus('')
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $this->projectRepository->create($project);
    }

    /**
     * Delete project.
     */
    public function deleteProject(int $projectId, string $userId): bool
    {
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
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
     * Get project details.
     */
    public function getProject(int $projectId, string $userId): ProjectEntity
    {
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Check permissions
        if ($project->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        return $project;
    }

    public function getProjectNotUserId(int $projectId): ?ProjectEntity
    {
        $project = $this->projectRepository->findById($projectId);
        if ($project === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }
        return $project;
    }

    /**
     * Get projects by conditions
     * 根据条件获取项目列表，支持分页和排序.
     */
    public function getProjectsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array {
        return $this->projectRepository->getProjectsByConditions($conditions, $page, $pageSize, $orderBy, $orderDirection);
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

    public function updateProjectStatus(int $id, int $topicId, TaskStatus $taskStatus)
    {
        $conditions = [
            'id' => $id,
        ];
        $data = [
            'current_topic_id' => $topicId,
            'current_topic_status' => $taskStatus->value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        return $this->projectRepository->updateProjectByCondition($conditions, $data);
    }

    public function updateProjectMode(int $id, TopicMode $topicMode): bool
    {
        $projectEntity = $this->projectRepository->findById($id);
        if (! $projectEntity || ! empty($projectEntity->getProjectMode())) {
            return false;
        }
        $projectEntity->setProjectMode($topicMode->value);
        $projectEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->projectRepository->save($projectEntity);
        return true;
    }

    public function getProjectForkCount(int $projectId): int
    {
        return $this->projectForkRepository->getForkCountByProjectId($projectId);
    }

    public function findByForkProjectId(int $forkProjectId): ?ProjectForkEntity
    {
        return $this->projectForkRepository->findByForkProjectId($forkProjectId);
    }

    /**
     * Fork project.
     */
    public function forkProject(
        int $sourceProjectId,
        int $targetWorkspaceId,
        string $targetProjectName,
        string $userId,
        string $userOrganizationCode
    ): array {
        // Check if user already has a running fork for this project
        if ($this->projectForkRepository->hasRunningFork($userId, $sourceProjectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_FORK_ALREADY_RUNNING, trans('project.fork_already_running'));
        }

        // Get source project entity
        $sourceProject = $this->projectRepository->findById($sourceProjectId);
        if (! $sourceProject) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        $currentTime = date('Y-m-d H:i:s');

        // Create forked project entity
        $forkedProject = $this->createForkedProjectFromSource(
            $sourceProject,
            $targetWorkspaceId,
            $targetProjectName,
            $userId,
            $userOrganizationCode,
            $currentTime
        );

        // Save forked project
        $forkedProject = $this->projectRepository->create($forkedProject);

        // Count total files in source project
        $totalFiles = $this->taskFileRepository->countFilesByProjectId($sourceProjectId);

        // Create fork record
        $projectFork = new ProjectForkEntity();
        $projectFork->setSourceProjectId($sourceProjectId)
            ->setForkProjectId($forkedProject->getId())
            ->setTargetWorkspaceId($targetWorkspaceId)
            ->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setStatus(ForkStatus::RUNNING->value)
            ->setProgress(0)
            ->setTotalFiles($totalFiles)
            ->setProcessedFiles(0)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        $projectFork = $this->projectForkRepository->create($projectFork);

        return [$forkedProject, $projectFork];
    }

    public function getForkProjectRecordById(int $forkId): ?ProjectForkEntity
    {
        return $this->projectForkRepository->findById($forkId);
    }

    /**
     * Create forked project from source project.
     */
    private function createForkedProjectFromSource(
        ProjectEntity $sourceProject,
        int $targetWorkspaceId,
        string $targetProjectName,
        string $userId,
        string $userOrganizationCode,
        string $currentTime
    ): ProjectEntity {
        $forkedProject = new ProjectEntity();
        $forkedProject->setUserId($userId)
            ->setUserOrganizationCode($userOrganizationCode)
            ->setWorkspaceId($targetWorkspaceId)
            ->setProjectName($targetProjectName)
            ->setProjectDescription($sourceProject->getProjectDescription())
            ->setWorkDir('') // Will be set later during file migration
            ->setProjectMode($sourceProject->getProjectMode())
            ->setProjectStatus(ProjectStatus::ACTIVE->value)
            ->setCurrentTopicId(null)
            ->setCurrentTopicStatus('')
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $forkedProject;
    }
}
