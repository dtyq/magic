<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\FileTreeIndexEntity;

interface FileTreeIndexRepositoryInterface
{
    /**
     * 插入一条闭包表记录.
     */
    public function insert(FileTreeIndexEntity $entity): FileTreeIndexEntity;

    /**
     * 批量插入闭包表记录.
     *
     * @param array $data 包含多条记录的数组
     */
    public function batchInsert(array $data): bool;

    /**
     * 为新节点创建闭包表记录
     * 包括：节点到自己的记录 + 所有祖先到该节点的记录.
     *
     * @param int $nodeId 新节点ID
     * @param null|int $parentId 父节点ID，null表示根节点
     * @param string $organizationCode 组织编码
     */
    public function createNodeIndexes(int $nodeId, ?int $parentId, string $organizationCode): void;

    /**
     * 移动节点（修改父节点）
     * 1. 删除旧的祖先关系
     * 2. 创建新的祖先关系.
     *
     * @param int $nodeId 要移动的节点ID
     * @param null|int $oldParentId 原父节点ID
     * @param null|int $newParentId 新父节点ID
     * @param string $organizationCode 组织编码
     */
    public function moveNode(int $nodeId, ?int $oldParentId, ?int $newParentId, string $organizationCode): void;

    /**
     * 删除节点及其所有子孙节点的闭包表记录.
     *
     * @param int $nodeId 节点ID
     * @param string $organizationCode 组织编码
     */
    public function deleteNodeIndexes(int $nodeId, string $organizationCode): void;

    /**
     * 获取某节点的所有子孙节点ID（不包括自己）.
     *
     * @param int $nodeId 节点ID
     * @param string $organizationCode 组织编码
     * @param null|int $maxDistance 最大距离，null表示不限制
     * @param bool $includeSoftDeleted 是否包含软删除节点，默认false
     * @return array 子孙节点ID数组
     */
    public function getDescendantIds(int $nodeId, string $organizationCode, ?int $maxDistance = null, bool $includeSoftDeleted = false): array;

    /**
     * 获取某节点的所有祖先节点ID（不包括自己）.
     *
     * @param int $nodeId 节点ID
     * @param string $organizationCode 组织编码
     * @param bool $includeSoftDeleted 是否包含软删除节点，默认false
     * @return array 祖先节点ID数组
     */
    public function getAncestorIds(int $nodeId, string $organizationCode, bool $includeSoftDeleted = false): array;

    /**
     * 批量获取多个节点的所有祖先节点ID（不包括自己）.
     *
     * 一次查询获取多个节点的祖先，避免 N+1 查询问题。
     *
     * @param array $nodeIds 节点ID数组
     * @param string $organizationCode 组织编码
     * @param bool $includeSoftDeleted 是否包含软删除节点，默认false
     * @return array 以节点ID为键的祖先ID数组映射，格式：[nodeId => [ancestorId1, ancestorId2, ...]]
     */
    public function batchGetAncestorIds(array $nodeIds, string $organizationCode, bool $includeSoftDeleted = false): array;

    /**
     * 批量获取多个节点的所有祖先节点ID（扁平化数组，包括输入节点本身）.
     *
     * 一次查询获取多个节点的所有祖先，并自动去重，返回扁平化的ID数组。
     * 适用于需要更新所有相关节点的场景（如批量删除时更新版本号）。
     *
     * @param array $nodeIds 节点ID数组
     * @param string $organizationCode 组织编码
     * @param bool $includeSoftDeleted 是否包含软删除节点，默认false
     * @param bool $includeInputNodes 是否包含输入节点本身，默认true
     * @return array 所有祖先节点ID的扁平化数组（已去重）
     */
    public function getAllAncestorIdsFlattened(array $nodeIds, string $organizationCode, bool $includeSoftDeleted = false, bool $includeInputNodes = true): array;

    /**
     * 获取某节点的直接子节点ID.
     *
     * @param int $nodeId 节点ID
     * @param string $organizationCode 组织编码
     * @param bool $includeSoftDeleted 是否包含软删除节点，默认false
     * @return array 直接子节点ID数组
     */
    public function getDirectChildrenIds(int $nodeId, string $organizationCode, bool $includeSoftDeleted = false): array;

    /**
     * 检查节点A是否是节点B的祖先.
     *
     * @param int $ancestorId 潜在祖先节点ID
     * @param int $descendantId 潜在后代节点ID
     * @param string $organizationCode 组织编码
     */
    public function isAncestor(int $ancestorId, int $descendantId, string $organizationCode): bool;
}
