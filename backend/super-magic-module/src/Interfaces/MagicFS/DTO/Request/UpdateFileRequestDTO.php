<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Hyperf\HttpServer\Contract\RequestInterface;

class UpdateFileRequestDTO
{
    public ?string $name = null;

    public ?string $parent_id = null;

    public ?int $mode = null;

    public ?int $size = null;

    public array $metadata = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();

        // 只有明确提供的字段才会设置（用于部分更新）
        if (isset($data['name'])) {
            $dto->name = trim((string) $data['name']);
        }

        if (isset($data['parent_id'])) {
            $dto->parent_id = (string) $data['parent_id'];
        }

        if (isset($data['mode'])) {
            $dto->mode = (int) $data['mode'];
        }

        if (isset($data['size'])) {
            $dto->size = (int) $data['size'];
        }

        $dto->metadata = $data['metadata'] ?? [];

        return $dto;
    }

    /**
     * 将 DTO 转换为 updates 数组.
     */
    public function toUpdates(): array
    {
        $updates = [];

        if ($this->name !== null) {
            $updates['name'] = $this->name;
        }

        if ($this->parent_id !== null) {
            $updates['parent_id'] = $this->parent_id;
        }

        if ($this->mode !== null) {
            $updates['mode'] = $this->mode;
        }

        if ($this->size !== null) {
            $updates['size'] = $this->size;
        }

        return $updates;
    }

    /**
     * 获取 MessageMetadata 值对象.
     */
    public function getMetadataValueObject(): MessageMetadata
    {
        return MessageMetadata::fromArray($this->metadata);
    }

    /**
     * 获取 metadata 数组.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
