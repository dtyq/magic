<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;

class WorkspaceItemDTO extends AbstractDTO
{
    /**
     * Workspace ID.
     */
    public string $id;

    /**
     * Workspace name.
     */
    public string $name;

    /**
     * Whether archived 0=no 1=yes.
     */
    public int $isArchived;

    /**
     * Whether pinned 0=no 1=yes.
     */
    public int $isPinned = 0;

    /**
     * Current topic ID.
     */
    public ?string $currentTopicId;

    /**
     * Current project ID.
     */
    public ?string $currentProjectId;

    /**
     * Status 0:normal 1:hidden 2:deleted.
     */
    public int $status;

    /**
     * Workspace status: running or waiting.
     */
    public string $workspaceStatus;

    /**
     * Workspace type: default, finance, audio.
     */
    public string $workspaceType;

    /**
     * Project count in workspace.
     */
    public int $projectCount = 0;

    /**
     * Collaboration project count bound to workspace.
     */
    public int $cooperateProjectCount = 0;

    /**
     * Created time.
     */
    public ?string $createdAt = null;

    /**
     * Updated time.
     */
    public ?string $updatedAt = null;

    /**
     * Create DTO from entity.
     *
     * @param WorkspaceEntity $entity Workspace entity
     * @param null|string $workspaceStatus Workspace status
     * @param int $projectCount Project count in workspace
     * @param int $cooperateProjectCount Collaboration project count bound to workspace
     */
    public static function fromEntity(
        WorkspaceEntity $entity,
        ?string $workspaceStatus = null,
        int $projectCount = 0,
        int $cooperateProjectCount = 0
    ): self {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->name = $entity->getName();
        $dto->isArchived = $entity->getIsArchived();
        $dto->isPinned = $entity->getIsPinned();
        $dto->currentTopicId = $entity->getCurrentTopicId() ? (string) $entity->getCurrentTopicId() : null;
        $dto->currentProjectId = $entity->getCurrentProjectId() ? (string) $entity->getCurrentProjectId() : null;
        $dto->status = $entity->getStatus();
        $dto->workspaceStatus = $workspaceStatus ?? TaskStatus::WAITING->value;
        $dto->workspaceType = $entity->getWorkspaceType();
        $dto->projectCount = $projectCount;
        $dto->cooperateProjectCount = $cooperateProjectCount;
        $dto->createdAt = $entity->getCreatedAt();
        $dto->updatedAt = $entity->getUpdatedAt();

        return $dto;
    }

    public function getId(): string
    {
        return $this->id;
    }

    /**
     * Create DTO from array.
     *
     * @param array $data Workspace data
     * @param null|string $workspaceStatus Workspace status
     * @param int $projectCount Project count in workspace
     * @param int $cooperateProjectCount Collaboration project count bound to workspace
     */
    public static function fromArray(
        array $data,
        ?string $workspaceStatus = null,
        int $projectCount = 0,
        int $cooperateProjectCount = 0
    ): self {
        $dto = new self();
        $dto->id = (string) $data['id'];
        $dto->name = $data['name'];
        $dto->isArchived = $data['is_archived'];
        $dto->isPinned = (int) ($data['is_pinned'] ?? 0);
        $dto->currentTopicId = $data['current_topic_id'] ? (string) $data['current_topic_id'] : null;
        $dto->currentProjectId = $data['current_project_id'] ? (string) $data['current_project_id'] : null;
        $dto->status = $data['status'];
        $dto->workspaceStatus = $workspaceStatus ?? TaskStatus::WAITING->value;
        $dto->workspaceType = $data['workspace_type'] ?? WorkspaceType::Default->value;
        $dto->projectCount = $projectCount;
        $dto->cooperateProjectCount = $cooperateProjectCount;
        $dto->createdAt = $data['created_at'] ?? null;
        $dto->updatedAt = $data['updated_at'] ?? null;

        return $dto;
    }
}
