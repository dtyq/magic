<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Repository;

use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\Model\OrganizationAdminModel;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;
use Hyperf\Database\Model\Builder;

use function Hyperf\Support\now;

/**
 * 组织管理员仓库实现.
 */
class OrganizationAdminRepository implements OrganizationAdminRepositoryInterface
{
    /**
     * 保存组织管理员.
     */
    public function save(string $organizationCode, OrganizationAdminEntity $organizationAdminEntity): OrganizationAdminEntity
    {
        $data = [
            'user_id' => $organizationAdminEntity->getUserId(),
            'organization_code' => $organizationCode,
            'grantor_user_id' => $organizationAdminEntity->getGrantorUserId(),
            'granted_at' => $organizationAdminEntity->getGrantedAt(),
            'status' => $organizationAdminEntity->getStatus(),
            'remarks' => $organizationAdminEntity->getRemarks(),
            'updated_at' => $organizationAdminEntity->getUpdatedAt() ?? now(),
        ];

        if ($organizationAdminEntity->shouldCreate()) {
            $data['created_at'] = $organizationAdminEntity->getCreatedAt() ?? now();
            $model = OrganizationAdminModel::create($data);
            $organizationAdminEntity->setId($model->id);
        } else {
            $model = $this->organizationAdminQuery($organizationCode)
                ->where('id', $organizationAdminEntity->getId())
                ->first();
            if ($model) {
                $model->fill($data);
                $model->save();
            }
        }

        return $organizationAdminEntity;
    }

    /**
     * 根据ID获取组织管理员.
     */
    public function getById(string $organizationCode, int $id): ?OrganizationAdminEntity
    {
        $model = $this->organizationAdminQuery($organizationCode)
            ->where('id', $id)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(string $organizationCode, string $userId): ?OrganizationAdminEntity
    {
        $model = $this->organizationAdminQuery($organizationCode)
            ->where('user_id', $userId)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 查询组织管理员列表.
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        $query = $this->organizationAdminQuery($organizationCode);

        // 应用过滤器
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', 'like', '%' . $filters['user_id'] . '%');
        }

        // 排序
        $query->orderBy('granted_at', 'desc');

        // 分页
        $total = $query->count();
        $models = $query->forPage($page->getPage(), $page->getPageNum())->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->mapToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 删除组织管理员.
     */
    public function delete(string $organizationCode, OrganizationAdminEntity $organizationAdminEntity): void
    {
        $this->organizationAdminQuery($organizationCode)
            ->where('id', $organizationAdminEntity->getId())
            ->delete();
    }

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(string $organizationCode, string $userId): bool
    {
        return $this->organizationAdminQuery($organizationCode)
            ->where('user_id', $userId)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->exists();
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(string $organizationCode, string $userId, string $grantorUserId, ?string $remarks = null): OrganizationAdminEntity
    {
        // 检查是否已存在
        $existing = $this->getByUserId($organizationCode, $userId);
        if ($existing) {
            // 如果已存在，更新状态和授权信息
            $existing->grant($grantorUserId);
            $existing->setRemarks($remarks);
            return $this->save($organizationCode, $existing);
        }

        // 创建新的组织管理员
        $entity = new OrganizationAdminEntity();
        $entity->setUserId($userId);
        $entity->setOrganizationCode($organizationCode);
        $entity->setGrantorUserId($grantorUserId);
        $entity->setGrantedAt(new DateTime());
        $entity->setStatus(OrganizationAdminModel::STATUS_ENABLED);
        $entity->setRemarks($remarks);

        return $this->save($organizationCode, $entity);
    }

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(string $organizationCode, string $userId): void
    {
        $entity = $this->getByUserId($organizationCode, $userId);
        if ($entity) {
            $entity->revoke();
            $this->save($organizationCode, $entity);
        }
    }

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(string $organizationCode): array
    {
        $models = $this->organizationAdminQuery($organizationCode)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->mapToEntity($model);
        }

        return $entities;
    }

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(string $organizationCode, array $userIds): array
    {
        $organizationAdminUserIds = $this->organizationAdminQuery($organizationCode)
            ->whereIn('user_id', $userIds)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->pluck('user_id')
            ->toArray();

        $result = [];
        foreach ($userIds as $userId) {
            $result[$userId] = in_array($userId, $organizationAdminUserIds);
        }

        return $result;
    }

    /**
     * 基于组织编码获取 OrganizationAdminModel 查询构造器.
     */
    private function organizationAdminQuery(string $organizationCode): Builder
    {
        return OrganizationAdminModel::query()->where('organization_code', $organizationCode);
    }

    /**
     * 映射模型到实体.
     */
    private function mapToEntity(OrganizationAdminModel $model): OrganizationAdminEntity
    {
        $entity = new OrganizationAdminEntity();
        $entity->setId($model->id);
        $entity->setUserId($model->user_id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setGrantorUserId($model->grantor_user_id);
        $entity->setStatus($model->status);
        $entity->setRemarks($model->remarks);

        if ($model->granted_at) {
            $entity->setGrantedAt(DateTime::createFromInterface($model->granted_at));
        }
        if ($model->created_at) {
            $entity->setCreatedAt(DateTime::createFromInterface($model->created_at));
        }
        if ($model->updated_at) {
            $entity->setUpdatedAt(DateTime::createFromInterface($model->updated_at));
        }

        return $entity;
    }
}
