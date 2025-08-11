<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Repository;

use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\Model\RoleModel;
use App\Domain\Permission\Repository\Persistence\Model\RoleUserModel;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;

use function Hyperf\Support\now;

/**
 * 角色仓库实现.
 */
class RoleRepository implements RoleRepositoryInterface
{
    /**
     * 保存角色.
     */
    public function save(string $organizationCode, RoleEntity $roleEntity): RoleEntity
    {
        $data = [
            'name' => $roleEntity->getName(),
            'permission_key' => $roleEntity->getPermissions(),
            'organization_code' => $organizationCode,
            'permission_tag' => $roleEntity->getPermissionTag(),
            'is_display' => $roleEntity->getIsDisplay(),
            'status' => $roleEntity->getStatus(),
            'created_uid' => $roleEntity->getCreatedUid(),
            'updated_uid' => $roleEntity->getUpdatedUid(),
            'updated_at' => $roleEntity->getUpdatedAt() ?? now(),
        ];

        if ($roleEntity->shouldCreate()) {
            $data['created_at'] = $roleEntity->getCreatedAt() ?? now();

            $model = RoleModel::create($data);
            $roleEntity->setId($model->id);
        } else {
            // 使用模型更新以便使用 casts 处理 JSON 与日期字段
            $model = $this->roleQuery($organizationCode)
                ->where('id', $roleEntity->getId())
                ->first();
            if ($model) {
                $model->fill($data);
                $model->save();
            }
        }

        return $roleEntity;
    }

    /**
     * 根据ID获取角色.
     */
    public function getById(string $organizationCode, int $id): ?RoleEntity
    {
        $model = $this->roleQuery($organizationCode)
            ->where('id', $id)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 根据名称获取角色.
     */
    public function getByName(string $organizationCode, string $name): ?RoleEntity
    {
        $model = $this->roleQuery($organizationCode)
            ->where('name', $name)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 查询角色列表.
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        $query = $this->roleQuery($organizationCode);
        // 默认只查询需要展示的角色
        $query->where('is_display', 1);

        // 应用过滤条件
        if ($filters) {
            if (isset($filters['name']) && ! empty($filters['name'])) {
                $query->where('name', 'like', '%' . $filters['name'] . '%');
            }
            if (isset($filters['status'])) {
                $query->where('status', $filters['status']);
            }
        }

        // 获取总数
        $total = $query->count();

        // 分页查询
        $models = $query->orderBy('created_at', 'desc')
            ->forPage($page->getPage(), $page->getPageNum())
            ->get();

        $roles = [];
        foreach ($models as $model) {
            $roles[] = $this->mapToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $roles,
        ];
    }

    /**
     * 删除角色.
     */
    public function delete(string $organizationCode, RoleEntity $roleEntity): void
    {
        $model = $this->roleQuery($organizationCode)
            ->where('id', $roleEntity->getId())
            ->first();

        if ($model) {
            $model->delete();
        }
    }

    /**
     * 为角色分配用户.
     */
    public function assignUsers(string $organizationCode, int $roleId, array $userIds, ?string $assignedBy = null): void
    {
        // 获取当前已分配的用户列表
        $existingUserIds = $this->roleUserQuery($organizationCode)
            ->where('role_id', $roleId)
            ->pluck('user_id')
            ->toArray();

        // 计算需要添加和移除的用户
        $toAdd = array_diff($userIds, $existingUserIds);
        $toRemove = array_diff($existingUserIds, $userIds);

        // 移除不再属于该角色的用户
        if (! empty($toRemove)) {
            $this->roleUserQuery($organizationCode)
                ->where('role_id', $roleId)
                ->whereIn('user_id', $toRemove)
                ->delete();
        }

        // 插入新的关系
        $data = [];
        foreach ($toAdd as $userId) {
            $data[] = [
                'role_id' => $roleId,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'assigned_by' => $assignedBy,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (! empty($data)) {
            RoleUserModel::insert($data);
        }
    }

    /**
     * 移除角色用户.
     */
    public function removeUsers(string $organizationCode, int $roleId, array $userIds): void
    {
        $this->roleUserQuery($organizationCode)
            ->where('role_id', $roleId)
            ->whereIn('user_id', $userIds)
            ->delete();
    }

    /**
     * 获取角色的用户列表.
     */
    public function getRoleUsers(string $organizationCode, int $roleId): array
    {
        return $this->roleUserQuery($organizationCode)
            ->where('role_id', $roleId)
            ->pluck('user_id')
            ->toArray();
    }

    /**
     * 批量获取角色的用户列表，返回 [roleId => userIds[]]。
     */
    public function getRoleUsersMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $rows = $this->roleUserQuery($organizationCode)
            ->whereIn('role_id', $roleIds)
            ->get(['role_id', 'user_id'])
            ->toArray();

        $map = [];
        foreach ($rows as $row) {
            $rid = (int) $row['role_id'];
            $map[$rid][] = $row['user_id'];
        }

        // 确保所有 roleIds 都有 key
        foreach ($roleIds as $rid) {
            $map[$rid] = $map[$rid] ?? [];
        }

        return $map;
    }

    /**
     * 获取用户的角色列表.
     */
    public function getUserRoles(string $organizationCode, string $userId): array
    {
        $roleIds = $this->roleUserQuery($organizationCode)
            ->where('user_id', $userId)
            ->pluck('role_id')
            ->toArray();

        if (empty($roleIds)) {
            return [];
        }

        $models = $this->roleQuery($organizationCode)
            ->whereIn('id', $roleIds)
            ->where('status', RoleModel::STATUS_ENABLED) // 只返回启用的角色
            ->get();

        $roles = [];
        foreach ($models as $model) {
            $roles[] = $this->mapToEntity($model);
        }

        return $roles;
    }

    /**
     * 获取用户的所有权限.
     */
    public function getUserPermissions(string $organizationCode, string $userId): array
    {
        $roles = $this->getUserRoles($organizationCode, $userId);

        $permissions = [];
        foreach ($roles as $role) {
            $permissions = array_merge($permissions, $role->getPermissions());
        }

        return array_unique($permissions);
    }

    /**
     * 基于组织编码获取 RoleModel 查询构造器.
     */
    private function roleQuery(string $organizationCode)
    {
        return RoleModel::query()->where('organization_code', $organizationCode);
    }

    /**
     * 基于组织编码获取 RoleUserModel 查询构造器.
     */
    private function roleUserQuery(string $organizationCode)
    {
        return RoleUserModel::query()->where('organization_code', $organizationCode);
    }

    /**
     * 映射模型到实体.
     */
    private function mapToEntity(RoleModel $model): RoleEntity
    {
        $entity = new RoleEntity();
        $entity->setId($model->id);
        $entity->setName($model->name);
        $entity->setOrganizationCode($model->organization_code);

        // 从模型获取权限数组
        $entity->setPermissions($model->getPermissions());

        // 获取权限标签
        $entity->setPermissionTag($model->getPermissionTag());

        // is_display
        $entity->setIsDisplay($model->is_display);

        $entity->setStatus($model->status);
        $entity->setCreatedUid($model->created_uid);
        $entity->setUpdatedUid($model->updated_uid);

        if ($model->created_at) {
            $entity->setCreatedAt(DateTime::createFromInterface($model->created_at));
        }
        if ($model->updated_at) {
            $entity->setUpdatedAt(DateTime::createFromInterface($model->updated_at));
        }

        return $entity;
    }
}
