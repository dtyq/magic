<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

/**
 * Response DTO for a single MagicFS file / directory entry.
 *
 * file_metadata 回传契约（与 Go 侧 agfs-sdk 对齐）：
 *   - `mode` 是 POSIX 权限位，独立成字段（`$mode`），不重复放进 file_metadata。
 *   - `file_metadata` 只包含 task_files.metadata JSON 列里除 mode 以外的
 *     插件级 flag（例如 local_shadow=1）。空 map 时输出 {}，让 Go 侧能以
 *     稳定的结构反序列化为 map[string]string。
 */
class MagicFSFileDTO
{
    public string $id = '';

    public string $name = '';

    public string $parent_id = '';

    public bool $is_directory = false;

    public int $size = 0;

    public ?int $mode = null;

    /** @var array<string, string> Per-file persisted flags (see class doc) */
    public array $file_metadata = [];

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

        // 解析 metadata JSON 列：取出 mode 作独立字段，其余归入 file_metadata
        $metadataRaw = $entity->getMetadata();
        $metadataArray = [];
        if ($metadataRaw) {
            $decoded = json_decode($metadataRaw, true);
            if (is_array($decoded)) {
                $metadataArray = $decoded;
            }
        }

        if (isset($metadataArray['mode'])) {
            $dto->mode = (int) $metadataArray['mode'];
            unset($metadataArray['mode']);
        } else {
            $dto->mode = $entity->getIsDirectory() ? 0755 : 0644;
        }

        $fileMeta = [];
        foreach ($metadataArray as $k => $v) {
            if (! is_string($k) || $k === '') {
                continue;
            }
            if (is_scalar($v) || $v === null) {
                $fileMeta[$k] = (string) $v;
            }
        }
        $dto->file_metadata = $fileMeta;

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
        // json_encode 下 PHP 的空关联数组会变成 [] 而不是 {}，Go 侧
        // json.Unmarshal([]byte("[]"), &m) 会把 map[string]string 置 nil。
        // 用 (object) 转一下，确保永远序列化为 {}。
        $fileMetadataOut = $this->file_metadata === [] ? (object) [] : $this->file_metadata;

        $result = [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parent_id,
            'is_directory' => $this->is_directory,
            'size' => $this->size,
            'mode' => $this->mode,
            'file_metadata' => $fileMetadataOut,
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
