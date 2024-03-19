<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 获取文件树响应 DTO.
 *
 * 对应 Python 客户端的 File 实体结构
 */
class GetFileTreeResponseDTO extends AbstractDTO
{
    /**
     * 文件ID（雪花ID转字符串）.
     */
    public string $id = '';

    /**
     * 文件/目录名称.
     */
    public string $name = '';

    /**
     * 父目录ID（雪花ID转字符串）.
     */
    public string $parentId = '';

    /**
     * 是否为目录.
     */
    public bool $isDirectory = false;

    /**
     * 文件大小（字节）.
     */
    public int $size = 0;

    /**
     * 创建时间.
     */
    public string $createdAt = '';

    /**
     * 更新时间.
     */
    public string $updatedAt = '';

    /**
     * 子文件/目录列表.
     */
    public array $children = [];

    /**
     * 从文件树数据创建响应 DTO.
     *
     * @param array $treeData 文件树数据
     */
    public static function fromTreeData(array $treeData): self
    {
        $dto = new self();

        // 雪花ID转字符串
        $dto->id = isset($treeData['file_id']) ? (string) $treeData['file_id'] : '';
        $dto->name = $treeData['name'] ?? '';
        $dto->parentId = isset($treeData['parent_id']) ? (string) $treeData['parent_id'] : '';
        $dto->isDirectory = (bool) ($treeData['is_directory'] ?? false);
        $dto->size = (int) ($treeData['file_size'] ?? 0);
        $dto->createdAt = $treeData['created_at'] ?? '';
        $dto->updatedAt = $treeData['updated_at'] ?? '';

        // 递归处理子节点
        if (isset($treeData['children']) && is_array($treeData['children'])) {
            foreach ($treeData['children'] as $child) {
                $dto->children[] = self::fromTreeData($child);
            }
        }

        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parentId,
            'is_directory' => $this->isDirectory,
            'size' => $this->size,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'children' => [],
        ];

        // 递归转换子节点
        foreach ($this->children as $child) {
            if ($child instanceof self) {
                $result['children'][] = $child->toArray();
            }
        }

        return $result;
    }
}
