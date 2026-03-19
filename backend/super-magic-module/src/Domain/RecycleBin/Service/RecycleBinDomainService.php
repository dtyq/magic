<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Service;

use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\RecycleBin\Handler\FilePermanentDeleteHandler;
use Dtyq\SuperMagic\Domain\RecycleBin\Handler\PermanentDeleteHandlerInterface;
use Dtyq\SuperMagic\Domain\RecycleBin\Handler\ProjectPermanentDeleteHandler;
use Dtyq\SuperMagic\Domain\RecycleBin\Handler\TopicPermanentDeleteHandler;
use Dtyq\SuperMagic\Domain\RecycleBin\Handler\WorkspacePermanentDeleteHandler;
use Dtyq\SuperMagic\Domain\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;

/**
 * 回收站领域服务.
 */
class RecycleBinDomainService
{
    /**
     * @var array<PermanentDeleteHandlerInterface> 彻底删除处理器数组
     */
    protected array $permanentDeleteHandlers;

    public function __construct(
        protected RecycleBinRepositoryInterface $recycleBinRepository,
        WorkspacePermanentDeleteHandler $workspaceHandler,
        ProjectPermanentDeleteHandler $projectHandler,
        TopicPermanentDeleteHandler $topicHandler,
        FilePermanentDeleteHandler $fileHandler
    ) {
        $this->permanentDeleteHandlers = [
            $workspaceHandler,
            $projectHandler,
            $topicHandler,
            $fileHandler,
        ];
    }

    /**
     * 记录删除操作到回收站表.
     *
     * @param RecycleBinResourceType $resourceType 资源类型枚举
     * @param int $resourceId 资源ID
     * @param string $resourceName 资源名称(从业务表快照)
     * @param string $ownerId 资源创建者ID(与业务表 user_id 一致，string)
     * @param string $deletedBy 删除人ID(与业务表 user_id 一致，string)
     * @param null|int $parentId 父级资源ID(可选)
     * @param null|array $extraData 扩展数据(可选)
     * @param int $retainDays 有效期(天)，默认30天
     */
    public function recordDeletion(
        RecycleBinResourceType $resourceType,
        int $resourceId,
        string $resourceName,
        string $ownerId,
        string $deletedBy,
        ?int $parentId = null,
        ?array $extraData = null,
        int $retainDays = 30
    ): RecycleBinEntity {
        $entity = new RecycleBinEntity();
        $entity->setResourceType($resourceType)
            ->setResourceId($resourceId)
            ->setResourceName($resourceName)
            ->setOwnerId($ownerId)
            ->setDeletedBy($deletedBy)
            ->setDeletedAt(date('Y-m-d H:i:s'))
            ->setRetainDays($retainDays)
            ->setParentId($parentId)
            ->setExtraData($extraData);

        return $this->recycleBinRepository->insert($entity);
    }

    /**
     * 根据资源查找回收站记录.
     *
     * @param RecycleBinResourceType $resourceType 资源类型
     * @param int $resourceId 资源ID
     */
    public function findByResource(
        RecycleBinResourceType $resourceType,
        int $resourceId
    ): ?RecycleBinEntity {
        return $this->recycleBinRepository->findByResource($resourceType, $resourceId);
    }

    /**
     * 根据ID删除回收站记录(物理删除).
     *
     * @param int $id 回收站记录ID
     */
    public function deleteById(int $id): bool
    {
        return $this->recycleBinRepository->deleteById($id);
    }

    /**
     * 查询某个父级下在回收站有记录的资源ID列表.
     * 用于恢复项目/工作区时排除用户曾删的子资源.
     *
     * @param int $parentId 父级资源ID
     * @param RecycleBinResourceType $resourceType 子资源类型
     * @return array 资源ID数组
     */
    public function findResourceIdsByParent(
        int $parentId,
        RecycleBinResourceType $resourceType
    ): array {
        return $this->recycleBinRepository->findResourceIdsByParent($parentId, $resourceType);
    }

    /**
     * 获取回收站列表.
     *
     * @param string $userId 用户ID
     * @param null|int $resourceType 资源类型
     * @param null|string $keyword 关键词
     * @param string $order 排序方式
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 回收站列表结果
     */
    public function getRecycleBinList(
        string $userId,
        ?int $resourceType = null,
        ?string $keyword = null,
        string $order = 'desc',
        int $page = 1,
        int $pageSize = 20
    ): array {
        return $this->recycleBinRepository->getRecycleBinList(
            userId: $userId,
            resourceType: $resourceType,
            keyword: $keyword,
            order: $order,
            page: $page,
            pageSize: $pageSize
        );
    }

    /**
     * 批量查询当前用户可访问的回收站记录（带类型过滤）.
     * 与列表使用同一套可访问条件，供检查父级/恢复等使用.
     *
     * @param array $ids 回收站记录ID数组
     * @param int $resourceType 资源类型（RecycleBinResourceType->value）
     * @param string $userId 当前用户ID
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIdsAndTypeVisibleToUser(array $ids, int $resourceType, string $userId): array
    {
        return $this->recycleBinRepository->findByIdsAndTypeVisibleToUser($ids, $resourceType, $userId);
    }

    /**
     * 根据资源ID批量查询回收站记录（用于检查父级/恢复）.
     * 与恢复接口使用同一套查询，按 resource_ids + resource_type + 当前用户 查出一条记录.
     *
     * @param array $resourceIds 资源ID数组
     * @param RecycleBinResourceType $resourceType 资源类型
     * @param string $userId 当前用户ID
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findLatestByResourceIds(array $resourceIds, RecycleBinResourceType $resourceType, string $userId): array
    {
        return $this->recycleBinRepository->findLatestByResourceIds($resourceIds, $resourceType, $userId);
    }

    /**
     * 查找过期的回收站记录ID（系统定时任务使用）.
     *
     * @param int $limit 查询数量限制
     * @return array 过期记录ID数组
     */
    public function findExpiredRecordIds(int $limit): array
    {
        return $this->recycleBinRepository->findExpiredRecordIds($limit);
    }

    /**
     * 彻底删除回收站记录.
     *
     * @param array $ids 回收站记录ID数组
     * @param string $userId 当前用户ID
     * @return array ['failed' => [...]] 只返回失败项
     */
    public function permanentDelete(array $ids, string $userId): array
    {
        $entities = $this->recycleBinRepository->findByIds($ids, $userId);

        if (empty($entities)) {
            return ['failed' => []];
        }

        $grouped = [];
        foreach ($entities as $entity) {
            $type = $entity->getResourceType();
            $grouped[$type->value] = $grouped[$type->value] ?? [];
            $grouped[$type->value][] = $entity;
        }

        $allFailed = [];
        foreach ($grouped as $typeValue => $list) {
            $type = RecycleBinResourceType::from($typeValue);
            $handler = $this->resolveHandler($type);

            if ($handler === null) {
                foreach ($list as $e) {
                    $allFailed[] = [
                        'id' => (string) $e->getId(),
                        'resource_type' => $e->getResourceType()->value,
                        'resource_id' => (string) $e->getResourceId(),
                        'resource_name' => $e->getResourceName(),
                    ];
                }
                continue;
            }

            $partial = $handler->handleBatch($list);
            $allFailed = array_merge($allFailed, $partial['failed']);
        }

        return ['failed' => $allFailed];
    }

    /**
     * 系统定时任务彻底删除回收站记录（不校验用户权限）.
     * 仅用于系统定时任务清理过期记录，不可用于用户请求.
     *
     * @param array $ids 回收站记录ID数组
     * @return array ['failed' => [...]] 只返回失败项
     */
    public function permanentDeleteBySystem(array $ids): array
    {
        $entities = $this->recycleBinRepository->findByIdsWithoutPermission($ids);

        if (empty($entities)) {
            return ['failed' => []];
        }

        $grouped = [];
        foreach ($entities as $entity) {
            $type = $entity->getResourceType();
            $grouped[$type->value] = $grouped[$type->value] ?? [];
            $grouped[$type->value][] = $entity;
        }

        $allFailed = [];
        foreach ($grouped as $typeValue => $list) {
            $type = RecycleBinResourceType::from($typeValue);
            $handler = $this->resolveHandler($type);

            if ($handler === null) {
                foreach ($list as $e) {
                    $allFailed[] = [
                        'id' => (string) $e->getId(),
                        'resource_type' => $e->getResourceType()->value,
                        'resource_id' => (string) $e->getResourceId(),
                        'resource_name' => $e->getResourceName(),
                    ];
                }
                continue;
            }

            $partial = $handler->handleBatch($list);
            $allFailed = array_merge($allFailed, $partial['failed']);
        }

        return ['failed' => $allFailed];
    }

    /**
     * 根据资源类型解析对应的处理器.
     */
    private function resolveHandler(RecycleBinResourceType $type): ?PermanentDeleteHandlerInterface
    {
        foreach ($this->permanentDeleteHandlers as $handler) {
            if ($handler->supports($type)) {
                return $handler;
            }
        }

        return null;
    }
}
