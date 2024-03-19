<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use JsonSerializable;

/**
 * 用于透传给沙箱的结构化记忆 DTO（可按需拓展字段）.
 */
final readonly class SandboxMemoryDTO implements JsonSerializable
{
    public function __construct(
        private string $id,
        private string $content,
    ) {
    }

    public static function fromEntity(LongTermMemoryEntity $entity): self
    {
        return new self($entity->getId(), $entity->getContent());
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'content' => $this->content,
        ];
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
