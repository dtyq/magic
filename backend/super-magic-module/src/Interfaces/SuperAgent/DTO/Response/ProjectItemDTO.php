<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;

/**
 * 项目条目DTO.
 */
class ProjectItemDTO
{
    public function __construct(
        public readonly string $id,
        public readonly string $workspaceId,
        public readonly string $projectName,
        public readonly string $workDir,
        public readonly string $currentTopicId,
        public readonly string $currentTopicStatus,
        public readonly string $projectStatus,
        public readonly ?string $projectMode,
        public readonly ?string $workspaceName,
        public readonly ?string $createdAt,
        public readonly ?string $updatedAt
    ) {
    }

    public static function fromEntity(ProjectEntity $project, ?string $projectStatus = null, ?string $workspaceName = null): self
    {
        return new self(
            id: (string) $project->getId(),
            workspaceId: (string) $project->getWorkspaceId(),
            projectName: $project->getProjectName(),
            workDir: $project->getWorkDir(),
            currentTopicId: (string) $project->getCurrentTopicId(),
            currentTopicStatus: $project->getCurrentTopicStatus(),
            projectStatus: $projectStatus ?? TaskStatus::WAITING->value,
            projectMode: $project->getProjectMode(),
            workspaceName: $workspaceName,
            createdAt: $project->getCreatedAt(),
            updatedAt: $project->getUpdatedAt()
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspaceId,
            'project_name' => $this->projectName,
            'work_dir' => $this->workDir,
            'current_topic_id' => $this->currentTopicId,
            'current_topic_status' => $this->currentTopicStatus,
            'project_status' => $this->projectStatus,
            'project_mode' => $this->projectMode,
            'workspace_name' => $this->workspaceName,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
