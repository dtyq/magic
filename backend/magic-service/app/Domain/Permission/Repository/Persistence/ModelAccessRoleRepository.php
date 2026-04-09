<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence;

use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Repository\Persistence\Model\ModelAccessRoleModel;
use App\Domain\Permission\Repository\Persistence\Model\ModelAccessRoleModelBindingModel;
use App\Domain\Permission\Repository\Persistence\Model\ModelAccessRoleUserModel;
use App\Infrastructure\Core\ValueObject\Page;

class ModelAccessRoleRepository
{
    /**
     * @return array{total:int,list:ModelAccessRoleEntity[]}
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        $builder = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode);

        if (! empty($filters['keyword'])) {
            $builder->where('name', 'like', '%' . trim((string) $filters['keyword']) . '%');
        }
        if (array_key_exists('is_default', $filters ?? []) && $filters['is_default'] !== null) {
            $builder->where('is_default', (bool) $filters['is_default'] ? 1 : 0);
        }

        $builder->orderByDesc('is_default')->orderByDesc('id');

        $total = $builder->count();
        $models = $builder->forPage($page->getPage(), $page->getPageNum())->get();

        $list = [];
        foreach ($models as $model) {
            $list[] = $this->toEntity($model);
        }

        return ['total' => $total, 'list' => $list];
    }

    public function save(ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        if ($entity->getId()) {
            $model = ModelAccessRoleModel::query()
                ->where('organization_code', $entity->getOrganizationCode())
                ->find($entity->getId());
            if (! $model) {
                return $entity;
            }
        } else {
            $model = new ModelAccessRoleModel();
        }

        $model->fill([
            'organization_code' => $entity->getOrganizationCode(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'is_default' => $entity->isDefault() ? 1 : 0,
            'parent_role_id' => $entity->getParentRoleId(),
            'created_uid' => $entity->getCreatedUid(),
            'updated_uid' => $entity->getUpdatedUid(),
        ]);
        $model->save();

        $entity->setId((int) $model->id);
        $entity->setCreatedAt($model->created_at?->toDateTime());
        $entity->setUpdatedAt($model->updated_at?->toDateTime());

        return $entity;
    }

    public function getById(string $organizationCode, int $id): ?ModelAccessRoleEntity
    {
        $model = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->find($id);

        return $model ? $this->toEntity($model) : null;
    }

    public function getByName(string $organizationCode, string $name): ?ModelAccessRoleEntity
    {
        $model = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('name', $name)
            ->first();

        return $model ? $this->toEntity($model) : null;
    }

    public function getDefaultRole(string $organizationCode): ?ModelAccessRoleEntity
    {
        $model = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('is_default', 1)
            ->first();

        return $model ? $this->toEntity($model) : null;
    }

    /**
     * @return array<int, ModelAccessRoleEntity>
     */
    public function getByIds(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $list = [];
        $models = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('id', $roleIds)
            ->get();

        foreach ($models as $model) {
            $list[(int) $model->id] = $this->toEntity($model);
        }

        return $list;
    }

    public function delete(string $organizationCode, int $roleId): void
    {
        ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('id', $roleId)
            ->delete();
    }

    public function replaceUsers(string $organizationCode, int $roleId, array $userIds, string $assignedBy): void
    {
        ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->delete();

        if (empty($userIds)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($userIds as $userId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'user_id' => $userId,
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        ModelAccessRoleUserModel::insert($rows);
    }

    public function replaceModels(string $organizationCode, int $roleId, array $modelIds, string $operator): void
    {
        ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->delete();

        if (empty($modelIds)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($modelIds as $modelId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'model_id' => $modelId,
                'created_uid' => $operator,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        ModelAccessRoleModelBindingModel::insert($rows);
    }

    public function getUserIdsByRoleId(string $organizationCode, int $roleId): array
    {
        return ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->pluck('user_id')
            ->toArray();
    }

    public function getModelIdsByRoleId(string $organizationCode, int $roleId): array
    {
        return ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->pluck('model_id')
            ->toArray();
    }

    /**
     * @return array<int,int>
     */
    public function getUserCountMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        return ModelAccessRoleUserModel::query()
            ->selectRaw('role_id, count(*) as aggregate')
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->groupBy('role_id')
            ->pluck('aggregate', 'role_id')
            ->map(static fn ($count) => (int) $count)
            ->toArray();
    }

    /**
     * @return array<int,int>
     */
    public function getModelCountMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        return ModelAccessRoleModelBindingModel::query()
            ->selectRaw('role_id, count(*) as aggregate')
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->groupBy('role_id')
            ->pluck('aggregate', 'role_id')
            ->map(static fn ($count) => (int) $count)
            ->toArray();
    }

    /**
     * @return array<int, array<string>>
     */
    public function getRoleUserMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $rows = ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->get(['role_id', 'user_id']);

        $result = [];
        foreach ($rows as $row) {
            $result[(int) $row->role_id][] = (string) $row->user_id;
        }
        return $result;
    }

    /**
     * @return array<int, array<string>>
     */
    public function getRoleModelMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $rows = ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->get(['role_id', 'model_id']);

        $result = [];
        foreach ($rows as $row) {
            $result[(int) $row->role_id][] = (string) $row->model_id;
        }
        return $result;
    }

    /**
     * @return ModelAccessRoleEntity[]
     */
    public function getUserAssignedRoles(string $organizationCode, string $userId): array
    {
        $roleIds = ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId)
            ->pluck('role_id')
            ->map(static fn ($id) => (int) $id)
            ->toArray();

        return array_values($this->getByIds($organizationCode, $roleIds));
    }

    public function countChildren(string $organizationCode, int $roleId): int
    {
        return ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('parent_role_id', $roleId)
            ->count();
    }

    public function hasOtherRoles(string $organizationCode, int $excludeRoleId): bool
    {
        return ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('id', '!=', $excludeRoleId)
            ->exists();
    }

    private function toEntity(ModelAccessRoleModel $model): ModelAccessRoleEntity
    {
        $entity = new ModelAccessRoleEntity();
        $entity->setId((int) $model->id);
        $entity->setOrganizationCode((string) $model->organization_code);
        $entity->setName((string) $model->name);
        $entity->setDescription($model->description === null ? null : (string) $model->description);
        $entity->setIsDefault((int) $model->is_default === 1);
        $entity->setParentRoleId($model->parent_role_id === null ? null : (int) $model->parent_role_id);
        $entity->setCreatedUid($model->created_uid === null ? null : (string) $model->created_uid);
        $entity->setUpdatedUid($model->updated_uid === null ? null : (string) $model->updated_uid);
        $entity->setCreatedAt($model->created_at?->toDateTime());
        $entity->setUpdatedAt($model->updated_at?->toDateTime());
        return $entity;
    }
}
