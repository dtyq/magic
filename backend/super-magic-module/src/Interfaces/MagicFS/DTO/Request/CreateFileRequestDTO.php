<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Request DTO for POST /api/v1/open-api/magicfs/files.
 *
 * 两类 metadata 的职责划分（与 agfs-server magicfs 插件对齐）：
 *
 * - message_metadata：一次请求的上下文（user / trace / authorization / …），
 *   不持久化在文件上。对应 Go 侧 magicfs.MessageMetadata。
 * - file_metadata：文件级的持久化 key/value 标记，会落到 task_files.metadata
 *   JSON 列里和 mode 并存。对应 Go 侧 File.FileMetadata，当前已知 key：
 *     * "local_shadow" = "1"  → agfs-fuse 把该目录子树本地化，不上云。
 */
class CreateFileRequestDTO
{
    public string $name = '';

    public string $parent_id = '';

    public bool $is_directory = false;

    /**
     * 同名文件若已被软删除，是否复用其原 file_id.
     *
     * 由 agfs magicfs 插件在 checkpoint 回滚重放（rollback_in_progress=true）
     * 时置为 true，保证引用该 file_id 的外链在撤回/取消撤回前后保持稳定。
     * 语义：
     *   - true  → 命中已软删除的同名记录则复用其 file_id / file_key；命中
     *     活跃同名则按冲突抛错；都没有则按常规分配新雪花 ID。
     *   - false → 命中活跃同名按冲突抛错；命中软删除记录忽略，分配新雪花 ID。
     *
     * 非 rollback 场景（手工 create、批量移动/复制等）不会传该字段，
     * 默认 false，与历史行为一致。
     */
    public bool $reuse_deleted_file_id = false;

    /** @var array<string, mixed> Per-request context (user/trace/authorization/...) */
    public array $message_metadata = [];

    /** @var array<string, string> Per-file persisted flags (e.g. local_shadow=1) */
    public array $file_metadata = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();
        $dto->name = trim($data['name'] ?? '');
        $dto->parent_id = $data['parent_id'] ?? '';
        $dto->is_directory = (bool) ($data['is_directory'] ?? false);
        $dto->reuse_deleted_file_id = (bool) ($data['reuse_deleted_file_id'] ?? false);
        $dto->message_metadata = $data['message_metadata'] ?? [];
        $dto->file_metadata = self::normalizeFileMetadata($data['file_metadata'] ?? []);

        // 验证必填字段
        if (empty($dto->name)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_FILE_NAME,
                'magicfs.name_is_required'
            );
        }

        return $dto;
    }

    /**
     * 获取 MessageMetadata 值对象（per-request 上下文）.
     */
    public function getMessageMetadataValueObject(): MessageMetadata
    {
        return MessageMetadata::fromArray($this->message_metadata);
    }

    /**
     * 获取原始 message_metadata 数组.
     */
    public function getMessageMetadata(): array
    {
        return $this->message_metadata;
    }

    /**
     * 获取持久化的 file_metadata 数组.
     *
     * @return array<string, string>
     */
    public function getFileMetadata(): array
    {
        return $this->file_metadata;
    }

    /**
     * 是否复用已软删除同名文件的 file_id（rollback 重放语义）.
     */
    public function getReuseDeletedFileId(): bool
    {
        return $this->reuse_deleted_file_id;
    }

    /**
     * Normalize incoming file_metadata: only scalar / stringifiable values
     * are kept, matching the Go-side `map[string]string` contract. Any
     * non-scalar value is silently dropped to avoid persisting junk.
     *
     * @param mixed $raw
     * @return array<string, string>
     */
    private static function normalizeFileMetadata($raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $k => $v) {
            if (! is_string($k) || $k === '') {
                continue;
            }
            if (is_scalar($v) || $v === null) {
                $out[$k] = (string) $v;
            }
        }
        return $out;
    }
}
