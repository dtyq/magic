<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
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
     * Create DTO from entity.
     *
     * @param WorkspaceEntity $entity Workspace entity
     */
    public static function fromEntity(WorkspaceEntity $entity): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->name = $entity->getName();
        $dto->isArchived = $entity->getIsArchived();
        $dto->currentTopicId = $entity->getCurrentTopicId() ? (string) $entity->getCurrentTopicId() : null;
        $dto->currentProjectId = $entity->getCurrentProjectId() ? (string) $entity->getCurrentProjectId() : null;
        $dto->status = $entity->getStatus();

        return $dto;
    }

    /**
     * Create DTO from array.
     *
     * @param array $data Workspace data
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) $data['id'];
        $dto->name = $data['name'];
        $dto->isArchived = $data['is_archived'];
        $dto->currentTopicId = $data['current_topic_id'] ? (string) $data['current_topic_id'] : null;
        $dto->currentProjectId = $data['current_project_id'] ? (string) $data['current_project_id'] : null;
        $dto->status = $data['status'];

        return $dto;
    }
}
