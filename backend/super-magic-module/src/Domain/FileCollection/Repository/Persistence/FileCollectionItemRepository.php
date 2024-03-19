<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\FileCollection\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\FileCollection\Entity\FileCollectionItemEntity;
use Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade\FileCollectionItemRepositoryInterface;
use Dtyq\SuperMagic\Domain\FileCollection\Repository\Model\FileCollectionItemModel;
use Hyperf\DbConnection\Db;

/**
 * 文件集项仓储实现.
 */
class FileCollectionItemRepository extends AbstractRepository implements FileCollectionItemRepositoryInterface
{
    /**
     * 构造函数.
     */
    public function __construct(protected FileCollectionItemModel $model)
    {
    }

    /**
     * 通过文件集ID获取所有文件项.
     */
    public function getByCollectionId(int $collectionId): array
    {
        $models = $this->model->newQuery()
            ->where('collection_id', $collectionId)
            ->whereNull('deleted_at')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return $entities;
    }

    /**
     * 批量插入文件集项.
     */
    public function batchInsert(array $items): bool
    {
        if (empty($items)) {
            return true;
        }

        $dataList = [];
        foreach ($items as $item) {
            if (! $item instanceof FileCollectionItemEntity) {
                continue;
            }

            $data = $this->entityToArray($item);

            // 只做创建操作，不考虑更新
            if ($data['id'] === 0) {
                $data['id'] = IdGenerator::getSnowId();
                $item->setId($data['id']);
            }

            $dataList[] = $data;
        }

        if (! empty($dataList)) {
            $this->model::query()->insert($dataList);
        }

        return true;
    }

    /**
     * 删除文件集的所有文件项.
     */
    public function deleteByCollectionId(int $collectionId): bool
    {
        $this->model->newQuery()
            ->where('collection_id', $collectionId)
            ->delete();
        return true;
    }

    /**
     * 批量统计文件集的文件数量.
     */
    public function countByCollectionIds(array $collectionIds): array
    {
        if (empty($collectionIds)) {
            return [];
        }

        // 使用 GROUP BY 和 COUNT 一次性查询所有文件集的文件数量
        $results = $this->model->newQuery()
            ->selectRaw('collection_id, COUNT(*) as file_count')
            ->whereIn('collection_id', $collectionIds)
            ->whereNull('deleted_at')
            ->groupBy('collection_id')
            ->get();

        // 转换为数组格式 [collection_id => count]
        $countMap = [];
        foreach ($results as $result) {
            $countMap[$result->collection_id] = (int) $result->file_count;
        }

        return $countMap;
    }

    /**
     * 批量通过文件集ID获取所有文件项.
     *
     * @param array $collectionIds 文件集ID数组
     * @return array 文件集ID => FileCollectionItemEntity[] 的映射 [collection_id => [item1, item2, ...]]
     */
    public function getByCollectionIds(array $collectionIds): array
    {
        if (empty($collectionIds)) {
            return [];
        }

        // 过滤无效的collectionId
        $collectionIds = array_filter(array_map('intval', $collectionIds), fn ($id) => $id > 0);
        if (empty($collectionIds)) {
            return [];
        }

        // 批量查询所有文件集项
        $models = $this->model->newQuery()
            ->whereIn('collection_id', $collectionIds)
            ->whereNull('deleted_at')
            ->get();

        // 按collection_id分组
        $result = [];
        foreach ($models as $model) {
            $collectionId = (int) $model->collection_id;
            if (! isset($result[$collectionId])) {
                $result[$collectionId] = [];
            }
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $result[$collectionId][] = $entity;
            }
        }

        return $result;
    }

    /**
     * 查找包含指定文件的单文件文件集ID（文件集中只有这一个文件）.
     *
     * @param int $fileId 文件ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return array 文件集ID数组
     */
    public function getSingleFileCollectionIdsByFileId(int $fileId, string $userId, string $organizationCode): array
    {
        $results = Db::select('
            SELECT 
                items.collection_id
            FROM magic_file_collection_items items
            INNER JOIN magic_file_collections collections 
                ON items.collection_id = collections.id
            WHERE items.file_id = ?
              AND items.deleted_at IS NULL
              AND collections.created_uid = ?
              AND collections.organization_code = ?
              AND collections.deleted_at IS NULL
            GROUP BY items.collection_id
            HAVING COUNT(DISTINCT items.file_id) = 1
        ', [$fileId, $userId, $organizationCode]);

        $collectionIds = [];
        foreach ($results as $row) {
            $rowArray = is_array($row) ? $row : (array) $row;
            $collectionId = (int) ($rowArray['collection_id'] ?? 0);
            if ($collectionId > 0) {
                $collectionIds[] = $collectionId;
            }
        }

        return $collectionIds;
    }

    /**
     * 查找与指定文件列表完全匹配的文件集ID.
     * 完全匹配定义：文件集中的文件数量和内容与传入的文件列表完全一致。
     * 使用单次 SQL 查询完成验证，避免二次查询和应用层验证。
     *
     * @param array $fileIds 文件ID数组
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param int $exactFileCount 精确的文件数量（用于双重验证）
     * @return array 文件集ID数组（简化返回，只包含 collection_id）
     */
    public function getCollectionIdsByFileIds(array $fileIds, string $userId, string $organizationCode, int $exactFileCount): array
    {
        if (empty($fileIds)) {
            return [];
        }

        $fileIdsInt = array_map('intval', $fileIds);
        $fileIdsInt = array_filter(array_unique($fileIdsInt), fn ($id) => $id > 0);

        if (empty($fileIdsInt)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($fileIdsInt), '?'));

        // 使用单次 SQL 查询完成完全匹配验证
        // 核心逻辑：
        // 1. 文件集中的所有文件都在传入的文件列表中（没有额外的文件）
        // 2. 文件集的文件数量等于传入的文件数量（确保没有遗漏）
        // 这两个条件组合 = 完全匹配
        $results = Db::select("
            SELECT items.collection_id
            FROM magic_file_collection_items items
            INNER JOIN magic_file_collections collections 
                ON items.collection_id = collections.id
            WHERE items.deleted_at IS NULL
              AND collections.created_uid = ?
              AND collections.organization_code = ?
              AND collections.deleted_at IS NULL
            GROUP BY items.collection_id
            HAVING 
                -- 条件1：文件集中所有文件都在传入列表中（没有额外文件）
                SUM(CASE WHEN items.file_id NOT IN ({$placeholders}) THEN 1 ELSE 0 END) = 0
                -- 条件2：文件数量完全匹配
                AND COUNT(DISTINCT items.file_id) = ?
        ", array_merge([$userId, $organizationCode], $fileIdsInt, [$exactFileCount]));

        $collectionIds = [];
        foreach ($results as $row) {
            $rowArray = is_array($row) ? $row : (array) $row;
            $collectionId = (int) ($rowArray['collection_id'] ?? 0);
            if ($collectionId > 0) {
                // 简化返回格式，只返回 collection_id
                $collectionIds[] = [
                    'collection_id' => $collectionId,
                ];
            }
        }

        return $collectionIds;
    }

    /**
     * 将PO模型转换为实体.
     */
    protected function modelToEntity(FileCollectionItemModel $model): ?FileCollectionItemEntity
    {
        $entity = new FileCollectionItemEntity();
        $entity->setId((int) $model->id);
        $entity->setCollectionId((int) $model->collection_id);
        $entity->setFileId((string) $model->file_id);

        if ($model->created_at) {
            $entity->setCreatedAt($model->created_at);
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt($model->updated_at);
        }

        if ($model->deleted_at) {
            $entity->setDeletedAt($model->deleted_at);
        }

        return $entity;
    }

    /**
     * 将实体转换为数组.
     */
    protected function entityToArray(FileCollectionItemEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'collection_id' => $entity->getCollectionId(),
            'file_id' => $entity->getFileId(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
            'deleted_at' => $entity->getDeletedAt(),
        ];
    }
}
