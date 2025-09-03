<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;

/**
 * 创建文件版本响应 DTO.
 */
class CreateFileVersionResponseDTO extends AbstractDTO
{
    protected int $version = 0;

    protected string $createdAt = '';

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): void
    {
        $this->version = $version;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    /**
     * 从实体创建响应DTO.
     */
    public static function fromEntity(TaskFileVersionEntity $entity): self
    {
        $dto = new self();
        $dto->setVersion($entity->getVersion());
        $dto->setCreatedAt($entity->getCreatedAt());
        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'created_at' => $this->createdAt,
        ];
    }
}
