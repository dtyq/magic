<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TopicMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

/**
 * Project Domain Service.
 */
class ProjectDomainService
{
    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository,
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

    public function getProjectNotUserId(int $projectId): ProjectEntity
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

    /**
     * 更新项目的updated_at时间.
     */
    public function updateUpdatedAtToNow(int $projectId): bool
    {
        return $this->projectRepository->updateUpdatedAtToNow($projectId);
    }
}
