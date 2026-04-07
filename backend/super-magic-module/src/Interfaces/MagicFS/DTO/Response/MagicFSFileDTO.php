<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

class MagicFSFileDTO
{
    public string $id = '';

    public string $name = '';

    public string $parent_id = '';

    public bool $is_directory = false;

    public int $size = 0;

    public ?int $mode = null;

    public S3InfoDTO $s3_info;

    public string $created_at = '';

    public string $updated_at = '';

    public int $version = 1;

    /**
     * @var array<MagicFSFileDTO>
     */
    public array $children = [];

    public function __construct()
    {
        $this->s3_info = new S3InfoDTO();
    }

    /**
     * 添加子节点（用于构建文件树）.
     */
    public function addChild(self $child): void
    {
        $this->children[] = $child;
    }

    /**
     * 从 TaskFileEntity 创建.
     */
    public static function fromTaskFileEntity(TaskFileEntity $entity): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getFileId();
        $dto->name = $entity->getFileName();
        $dto->parent_id = (string) ($entity->getParentId() ?? '');
        $dto->is_directory = $entity->getIsDirectory();
        $dto->size = $entity->getFileSize();

        // mode 字段：从 metadata 中获取，如果没有则使用默认值
        $metadata = $entity->getMetadata();
        if ($metadata) {
            $metadataArray = json_decode($metadata, true);
            $dto->mode = $metadataArray['mode'] ?? ($entity->getIsDirectory() ? 0755 : 0644);
        } else {
            $dto->mode = $entity->getIsDirectory() ? 0755 : 0644;
        }

        // S3 信息
        $dto->s3_info = new S3InfoDTO($entity->getFileKey());

        $dto->created_at = $entity->getCreatedAt();
        $dto->updated_at = $entity->getUpdatedAt();
        // 改为使用 metadata_version，用于 MagicFS 缓存失效检测
        $dto->version = $entity->getMetadataVersion();

        return $dto;
    }

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parent_id,
            'is_directory' => $this->is_directory,
            'size' => $this->size,
            'mode' => $this->mode,
            's3_info' => $this->s3_info->toArray(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'version' => $this->version,
        ];

        // 如果有子节点，则包含 children 字段
        if (! empty($this->children)) {
            $result['children'] = array_map(fn ($child) => $child->toArray(), $this->children);
        }

        return $result;
    }
}
