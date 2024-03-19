<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioMarkerEntity;

/**
 * Audio marker item DTO.
 */
class AudioMarkerItemDTO
{
    public string $id = '';

    public string $projectId = '';

    public int $positionSeconds = 0;

    public string $content = '';

    public string $userId = '';

    public string $createdAt = '';

    public string $updatedAt = '';

    public static function fromEntity(AudioMarkerEntity $entity): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->projectId = (string) $entity->getProjectId();
        $dto->positionSeconds = $entity->getPositionSeconds();
        $dto->content = $entity->getContent();
        $dto->userId = $entity->getUserId();
        $dto->createdAt = $entity->getCreatedAt() ?? '';
        $dto->updatedAt = $entity->getUpdatedAt() ?? '';

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->projectId,
            'position_seconds' => $this->positionSeconds,
            'content' => $this->content,
            'user_id' => $this->userId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
