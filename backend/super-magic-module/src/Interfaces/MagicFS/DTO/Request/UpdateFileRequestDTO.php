<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Request DTO for PUT /api/v1/open-api/magicfs/files/{id}.
 *
 * 两类 metadata 的职责划分（与 agfs-server magicfs 插件对齐）：
 *
 * - message_metadata：一次请求的上下文，不持久化。对应 Go 侧
 *   magicfs.MessageMetadata。
 * - file_metadata：文件级的持久化 key/value 标记。null 表示"本次请求未
 *   携带该字段、保持现状"；非 null（哪怕是 []）表示"整体替换"，跟 Go 侧
 *   UpdateFileRequest.FileMetadata 的非 nil 即覆盖语义保持一致。
 */
class UpdateFileRequestDTO
{
    public ?string $name = null;

    public ?string $parent_id = null;

    public ?int $mode = null;

    public ?int $size = null;

    /** @var array<string, mixed> Per-request context (user/trace/authorization/...) */
    public array $message_metadata = [];

    /** @var null|array<string, string> Non-null means "replace the full file_metadata bag". */
    public ?array $file_metadata = null;

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

        $dto->message_metadata = $data['message_metadata'] ?? [];

        // 显式区分"未提供"和"提供空表"：array_key_exists 保留客户端"清空
        // file_metadata"的意图，这和 Go 侧 UpdateFileRequest.FileMetadata
        // 的 nil vs 空 map 语义一致。
        if (array_key_exists('file_metadata', $data)) {
            $dto->file_metadata = self::normalizeFileMetadata($data['file_metadata']);
        }

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

        if ($this->file_metadata !== null) {
            $updates['file_metadata'] = $this->file_metadata;
        }

        return $updates;
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
     * 获取持久化的 file_metadata 覆盖值；null 表示本次请求未修改该字段.
     *
     * @return null|array<string, string>
     */
    public function getFileMetadata(): ?array
    {
        return $this->file_metadata;
    }

    /**
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
