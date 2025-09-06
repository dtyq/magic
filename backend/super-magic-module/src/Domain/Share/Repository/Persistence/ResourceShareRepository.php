<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\Model\ResourceShareModel;
use Exception;

/**
 * 资源分享仓储实现.
 */
class ResourceShareRepository extends AbstractRepository implements ResourceShareRepositoryInterface
{
    /**
     * 构造函数.
     */
    public function __construct(protected ResourceShareModel $model)
    {
    }

    /**
     * 通过ID获取分享.
     *
     * @param int $shareId 分享ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareById(int $shareId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()->where('id', $shareId)->whereNull('deleted_at')->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 通过分享码获取分享.
     *
     * @param string $shareCode 分享码
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareByCode(string $shareCode): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()->where('share_code', $shareCode)->orderBy('id', 'desc')->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    public function getShareByResourceId(string $resourceId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()->where('resource_id', $resourceId)->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 查找资源对应的分享.
     *
     * @param string $resourceId 资源ID
     * @param ResourceType $resourceType 资源类型
     * @param string $userId 用户ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function findByResource(string $resourceId, ResourceType $resourceType, string $userId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()
            ->where('resource_id', $resourceId)
            ->where('resource_type', $resourceType->value)
            ->where('creator', $userId)
            ->first();

        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 创建分享记录.
     *
     * @param array $data 分享数据
     * @return string 分享ID
     */
    public function create(array $data): string
    {
        $model = new $this->model();
        $model->fill($data);
        $model->save();

        return (string) $model->id;
    }

    /**
     * 保存分享实体.
     *
     * @param ResourceShareEntity $shareEntity 资源分享实体
     * @return ResourceShareEntity 保存后的资源分享实体
     * @throws Exception
     */
    public function save(ResourceShareEntity $shareEntity): ResourceShareEntity
    {
        $data = $this->entityToArray($shareEntity);

        try {
            if ($shareEntity->getId() === 0) {
                // 创建新记录
                $data['id'] = IdGenerator::getSnowId();
                $model = $this->model::query()->create($data);
                $shareEntity->setId((int) $model->id);
            } else {
                // 更新现有记录
                $this->model->query()->withTrashed()->where('id', $shareEntity->getId())->update($data);
            }
            return $shareEntity;
        } catch (Exception $e) {
            throw new Exception('保存分享失败：' . $e->getMessage());
        }
    }

    /**
     * 删除分享.
     *
     * @param int $shareId 分享ID
     * @return bool 是否成功
     */
    public function delete(int $shareId): bool
    {
        $model = $this->model->newQuery()->find($shareId);
        if ($model) {
            return $model->delete();
        }
        return false;
    }

    /**
     * 增加分享查看次数.
     *
     * @param string $shareCode 分享码
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareCode): bool
    {
        $result = $this->model->newQuery()
            ->where('share_code', $shareCode)
            ->increment('view_count');

        return $result > 0;
    }

    /**
     * 检查分享码是否已存在.
     *
     * @param string $shareCode 分享码
     * @return bool 是否已存在
     */
    public function isShareCodeExists(string $shareCode): bool
    {
        return $this->model->newQuery()->where('share_code', $shareCode)->exists();
    }

    /**
     * 获取分享记录列表.
     *
     * @param array $conditions 条件
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 分页数据 [total, list]
     */
    public function paginate(array $conditions, int $page = 1, int $pageSize = 20): array
    {
        $query = $this->model->newQuery();

        // 添加查询条件
        foreach ($conditions as $field => $value) {
            if ($field == 'keyword') {
                $query->where($field, 'LIKE', '%' . $value . '%');
            } else {
                if ($value !== null) {
                    $query->where($field, $value);
                }
            }
        }

        // 按创建时间倒序排序
        $query->orderBy('id', 'desc');

        $query->whereNull('deleted_at');

        // 计算总数
        $total = $query->count();

        // 获取分页数据
        $models = $query->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // 将模型转换为实体
        $items = [];
        foreach ($models as $model) {
            $items[] = $this->modelToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $items,
        ];
    }

    public function getShareByResource(string $userId, string $resourceId, int $resourceType): ?ResourceShareEntity
    {
        $query = ResourceShareModel::query();
        $model = $query->withTrashed()
            ->where('created_uid', $userId)
            ->where('resource_id', $resourceId)
            ->where('resource_type', $resourceType)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 将PO模型转换为实体.
     *
     * @param ResourceShareModel $model 模型
     * @return ResourceShareEntity 实体
     */
    protected function modelToEntity(ResourceShareModel $model): ?ResourceShareEntity
    {
        $entity = new ResourceShareEntity();
        $entity->setId((int) $model->id);
        $entity->setResourceId((string) $model->resource_id);
        $entity->setResourceType((int) $model->resource_type);
        $entity->setResourceName((string) $model->resource_name);
        $entity->setShareCode(htmlspecialchars($model->share_code, ENT_QUOTES, 'UTF-8'));
        $entity->setShareType((int) $model->share_type);
        $entity->setPassword($model->password);

        // 安全处理日期 - 确保格式正确
        if ($model->expire_at) {
            $entity->setExpireAt($model->expire_at);
        }

        $entity->setViewCount($model->view_count);
        $entity->setCreatedUid($model->created_uid);
        $entity->setOrganizationCode(htmlspecialchars($model->organization_code, ENT_QUOTES, 'UTF-8'));

        // 处理目标ID，如果实体中有此字段
        /* @phpstan-ignore-next-line */
        if (property_exists($model, 'target_ids') && method_exists($entity, 'setTargetIds')) {
            $entity->setTargetIds($model->target_ids ?? '[]');
        }

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
     *
     * @param ResourceShareEntity $entity 实体
     * @return array 数组
     */
    protected function entityToArray(ResourceShareEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'resource_id' => $entity->getResourceId(),
            'resource_type' => $entity->getResourceType(),
            'resource_name' => $entity->getResourceName(),
            'share_code' => $entity->getShareCode(),
            'share_type' => $entity->getShareType(),
            'password' => $entity->getPassword(),
            'expire_at' => $entity->getExpireAt(),
            'view_count' => $entity->getViewCount(),
            'created_uid' => $entity->getCreatedUid(),
            'organization_code' => $entity->getOrganizationCode(),
            'updated_at' => $entity->getUpdatedAt(),
            'deleted_at' => $entity->getDeletedAt(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }
}
