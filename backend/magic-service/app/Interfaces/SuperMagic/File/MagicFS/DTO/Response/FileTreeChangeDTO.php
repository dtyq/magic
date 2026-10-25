<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Response;

use stdClass;

/** A single precise file-tree mutation. */
class FileTreeChangeDTO
{
    public int $revision = 0;

    public string $operation = '';

    public string $file_id = '';

    public string $parent_id = '';

    public string $old_parent_id = '';

    public string $name = '';

    public ?string $old_name = null;

    /** @var array<string, mixed> */
    public array $file = [];

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        $dto = new self();
        // revision is the root_file_id-local cursor. change_id is an internal
        // audit identifier and must never leak into filesystem synchronization.
        $dto->revision = (int) ($row['revision'] ?? 0);
        $dto->operation = (string) ($row['operation'] ?? '');
        $dto->file_id = (string) ($row['file_id'] ?? '');
        $dto->parent_id = (string) ($row['parent_id'] ?? '');
        $dto->old_parent_id = (string) ($row['old_parent_id'] ?? '');
        $dto->name = (string) ($row['name'] ?? '');
        $dto->old_name = isset($row['old_name']) ? (string) $row['old_name'] : null;

        $snapshot = $row['file_snapshot'] ?? null;
        if (is_string($snapshot) && $snapshot !== '') {
            $decoded = json_decode($snapshot, true);
            if (is_array($decoded)) {
                $dto->file = $decoded;
            }
        } elseif (is_array($snapshot)) {
            $dto->file = $snapshot;
        }

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'revision' => $this->revision,
            'operation' => $this->operation,
            'file_id' => $this->file_id,
            'parent_id' => $this->parent_id,
            'old_parent_id' => $this->old_parent_id,
            'name' => $this->name,
            'old_name' => $this->old_name,
            'file' => $this->normalizedFileSnapshot(),
        ];
    }

    /**
     * 出参形状：file 必须是 JSON object，且空 file_metadata 必须是 {}。
     *
     * 快照在库里是 JSON 文本（写入侧 TaskFileRepository::fileTreeChangeSnapshot()
     * 已把空 map 归一化成 {}），但读取时 json_decode($snapshot, true) 解成关联数组，
     * PHP 分不清 JSON 的 {} 和 []，空对象变成空数组，再 json_encode 又写回 []。
     * Go 挂载端 File.FileMetadata 是 map[string]string，收到数组会让整页 changes
     * 解码失败（cannot unmarshal array into ... file_metadata）；客户端不推进游标，
     * 每个轮询周期重试同一页，挂载端文件树再也同步不到远端变更。
     *
     * 例：库里 {"file_metadata":{}} → 不归一化出参是 []，归一化后是 {}。
     * 历史行（当时把空 map 写成 [] 的那些）在这里一并治好，不需要数据迁移；与
     * MagicFSFileDTO::toArray() 对同一字段的处理保持一致。
     */
    private function normalizedFileSnapshot(): array|stdClass
    {
        if ($this->file === []) {
            // 快照缺失（file_snapshot 为 NULL）：出参必须是 object，否则 Go 侧解析
            // change.File 时同样让整页失败。空对象在客户端等价于"没有快照"，
            // 只会用行上的 file_id / name，不会污染已驻留节点。
            return (object) [];
        }

        $file = $this->file;
        if (($file['file_metadata'] ?? null) === []) {
            $file['file_metadata'] = (object) [];
        }

        return $file;
    }
}
