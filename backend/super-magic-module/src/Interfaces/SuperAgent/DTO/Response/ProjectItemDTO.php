<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * 项目条目DTO.
 */
class ProjectItemDTO
{
    public function __construct(
        public readonly string $id,
        public readonly string $workspaceId,
        public readonly string $projectName,
        public readonly string $projectDescription,
        public readonly string $workDir,
        public readonly string $currentTopicId,
        public readonly string $currentTopicStatus,
        public readonly string $projectStatus,
        public readonly ?string $projectMode,
        public readonly ?string $workspaceName,
        public readonly ?string $createdAt,
        public readonly ?string $updatedAt,
        public readonly ?string $tag,
        public readonly ?string $userId,
        public readonly ?bool $isCollaborationEnabled,
        public readonly ?string $permission,
    ) {
    }

    public static function fromEntity(ProjectEntity $project, ?string $projectStatus = null, ?string $workspaceName = null, bool $hasProjectMember = false): self
    {
        $tag = $hasProjectMember ? 'collaboration' : '';
        return new self(
            id: (string) $project->getId(),
            workspaceId: (string) $project->getWorkspaceId(),
            projectName: $project->getProjectName(),
            projectDescription: $project->getProjectDescription(),
            workDir: $project->getWorkDir(),
            currentTopicId: (string) $project->getCurrentTopicId(),
            currentTopicStatus: $project->getCurrentTopicStatus(),
            projectStatus: $projectStatus ?? $project->getCurrentTopicStatus(),
            projectMode: $project->getProjectMode(),
            workspaceName: $workspaceName,
            createdAt: $project->getCreatedAt(),
            updatedAt: $project->getUpdatedAt(),
            tag: $tag,
            userId: $project->getUserId(),
            isCollaborationEnabled: $project->getIsCollaborationEnabled(),
            permission: $project->getPermission()->value,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspaceId,
            'project_name' => $this->projectName,
            'project_description' => $this->projectDescription,
            'work_dir' => $this->workDir,
            'current_topic_id' => $this->currentTopicId,
            'current_topic_status' => $this->currentTopicStatus,
            'project_status' => $this->projectStatus,
            'project_mode' => $this->projectMode,
            'workspace_name' => $this->workspaceName,
            'is_collaboration_enabled' => $this->isCollaborationEnabled,
            'permission' => $this->permission,
            'tag' => $this->tag,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'user_id' => $this->userId,
        ];
    }
}
