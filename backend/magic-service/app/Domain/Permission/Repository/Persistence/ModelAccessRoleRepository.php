<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentUserModel;
use App\Domain\Contact\Repository\Persistence\Model\UserModel;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\ModelAccessRoleBindingMode;
use App\Domain\Permission\Entity\ValueObject\ModelAccessRuleEffect;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
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

        $builder->orderByDesc('id');

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
        $id = $entity->getId();
        if ($id) {
            $model = $this->findModelById($entity->getOrganizationCode(), $id);
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
        $model = $this->findModelById($organizationCode, $id);

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

    public function replaceBindings(
        string $organizationCode,
        int $roleId,
        array $userIds,
        array $departmentIds,
        array $excludedUserIds,
        array $excludedDepartmentIds,
        bool $allUsers,
        string $assignedBy
    ): void {
        ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->delete();

        if (empty($userIds) && empty($departmentIds) && empty($excludedUserIds) && empty($excludedDepartmentIds) && ! $allUsers) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($userIds as $userId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'binding_mode' => ModelAccessRoleBindingMode::INCLUDE->value,
                'principal_type' => PrincipalType::USER->value,
                'principal_id' => $userId,
                'user_id' => $userId,
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach ($departmentIds as $departmentId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'binding_mode' => ModelAccessRoleBindingMode::INCLUDE->value,
                'principal_type' => PrincipalType::DEPARTMENT->value,
                'principal_id' => $departmentId,
                'user_id' => '',
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($allUsers) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'binding_mode' => ModelAccessRoleBindingMode::INCLUDE->value,
                'principal_type' => PrincipalType::ORGANIZATION->value,
                'principal_id' => $organizationCode,
                'user_id' => '',
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach ($excludedUserIds as $userId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'binding_mode' => ModelAccessRoleBindingMode::EXCLUDE->value,
                'principal_type' => PrincipalType::USER->value,
                'principal_id' => $userId,
                'user_id' => $userId,
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach ($excludedDepartmentIds as $departmentId) {
            $rows[] = [
                'organization_code' => $organizationCode,
                'role_id' => $roleId,
                'binding_mode' => ModelAccessRoleBindingMode::EXCLUDE->value,
                'principal_type' => PrincipalType::DEPARTMENT->value,
                'principal_id' => $departmentId,
                'user_id' => '',
                'assigned_by' => $assignedBy,
                'assigned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        ModelAccessRoleUserModel::insert($rows);
    }

    public function replaceDeniedModels(string $organizationCode, int $roleId, array $modelIds, string $operator): void
    {
        ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->where('effect', ModelAccessRuleEffect::DENY->value)
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
                'effect' => ModelAccessRuleEffect::DENY->value,
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
            ->where(static fn ($query) => $query
                ->where('binding_mode', ModelAccessRoleBindingMode::INCLUDE->value)
                ->orWhereNull('binding_mode'))
            ->where('principal_type', PrincipalType::USER->value)
            ->pluck('user_id')
            ->toArray();
    }

    public function getDeniedModelIdsByRoleId(string $organizationCode, int $roleId): array
    {
        return ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->where('effect', ModelAccessRuleEffect::DENY->value)
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
            ->where(static fn ($query) => $query
                ->where('binding_mode', ModelAccessRoleBindingMode::INCLUDE->value)
                ->orWhereNull('binding_mode'))
            ->where('principal_type', PrincipalType::USER->value)
            ->groupBy('role_id')
            ->pluck('aggregate', 'role_id')
            ->map(static fn ($count) => (int) $count)
            ->toArray();
    }

    /**
     * @return array<int,int>
     */
    public function getDeniedModelCountMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        return ModelAccessRoleModelBindingModel::query()
            ->selectRaw('role_id, count(*) as aggregate')
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->where('effect', ModelAccessRuleEffect::DENY->value)
            ->groupBy('role_id')
            ->pluck('aggregate', 'role_id')
            ->map(static fn ($count) => (int) $count)
            ->toArray();
    }

    /**
     * @return array<int, array{
     *     user_ids:array<string>,
     *     department_ids:array<string>,
     *     excluded_user_ids:array<string>,
     *     excluded_department_ids:array<string>,
     *     all_users:bool
     * }>
     */
    public function getRoleBindingMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $rows = ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->get(['role_id', 'binding_mode', 'principal_type', 'principal_id', 'user_id']);

        $result = [];
        foreach ($rows as $row) {
            $roleId = (int) $row->role_id;
            $result[$roleId] ??= [
                'user_ids' => [],
                'department_ids' => [],
                'excluded_user_ids' => [],
                'excluded_department_ids' => [],
                'all_users' => false,
            ];

            $principalType = PrincipalType::tryFrom((int) $row->principal_type);
            $bindingMode = ModelAccessRoleBindingMode::tryFrom((int) ($row->binding_mode ?? ModelAccessRoleBindingMode::INCLUDE->value))
                ?? ModelAccessRoleBindingMode::INCLUDE;
            if ($principalType === PrincipalType::USER) {
                $targetKey = $bindingMode === ModelAccessRoleBindingMode::EXCLUDE ? 'excluded_user_ids' : 'user_ids';
                $result[$roleId][$targetKey][] = (string) $row->principal_id;
                continue;
            }

            if ($principalType === PrincipalType::DEPARTMENT) {
                $targetKey = $bindingMode === ModelAccessRoleBindingMode::EXCLUDE ? 'excluded_department_ids' : 'department_ids';
                $result[$roleId][$targetKey][] = (string) $row->principal_id;
                continue;
            }

            if ($principalType === PrincipalType::ORGANIZATION && $bindingMode === ModelAccessRoleBindingMode::INCLUDE) {
                $result[$roleId]['all_users'] = true;
            }
        }

        foreach ($result as $roleId => $bindings) {
            $result[$roleId]['user_ids'] = array_values(array_unique($bindings['user_ids']));
            $result[$roleId]['department_ids'] = array_values(array_unique($bindings['department_ids']));
            $result[$roleId]['excluded_user_ids'] = array_values(array_unique($bindings['excluded_user_ids']));
            $result[$roleId]['excluded_department_ids'] = array_values(array_unique($bindings['excluded_department_ids']));
        }

        return $result;
    }

    /**
     * @return array<int, array<string>>
     */
    public function getRoleDeniedModelMap(string $organizationCode, array $roleIds): array
    {
        if (empty($roleIds)) {
            return [];
        }

        $rows = ModelAccessRoleModelBindingModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('role_id', $roleIds)
            ->where('effect', ModelAccessRuleEffect::DENY->value)
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
    public function getUserAssignedRoles(string $organizationCode, string $userId, array $departmentIds = []): array
    {
        $includeRoleIds = ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where(static fn ($query) => $query
                ->where('binding_mode', ModelAccessRoleBindingMode::INCLUDE->value)
                ->orWhereNull('binding_mode'))
            ->where(static function ($query) use ($organizationCode, $userId, $departmentIds) {
                $query->where(static function ($subQuery) use ($userId) {
                    $subQuery->where('principal_type', PrincipalType::USER->value)
                        ->where('principal_id', $userId);
                })->orWhere(static function ($subQuery) use ($organizationCode) {
                    $subQuery->where('principal_type', PrincipalType::ORGANIZATION->value)
                        ->where('principal_id', $organizationCode);
                });

                if (! empty($departmentIds)) {
                    $query->orWhere(static function ($subQuery) use ($departmentIds) {
                        $subQuery->where('principal_type', PrincipalType::DEPARTMENT->value)
                            ->whereIn('principal_id', $departmentIds);
                    });
                }
            })
            ->pluck('role_id')
            ->map(static fn ($id) => (int) $id)
            ->toArray();

        if (empty($includeRoleIds)) {
            return [];
        }

        $excludeRoleIds = ModelAccessRoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('binding_mode', ModelAccessRoleBindingMode::EXCLUDE->value)
            ->where(static function ($query) use ($userId, $departmentIds) {
                $query->where(static function ($subQuery) use ($userId) {
                    $subQuery->where('principal_type', PrincipalType::USER->value)
                        ->where('principal_id', $userId);
                });

                if (! empty($departmentIds)) {
                    $query->orWhere(static function ($subQuery) use ($departmentIds) {
                        $subQuery->where('principal_type', PrincipalType::DEPARTMENT->value)
                            ->whereIn('principal_id', $departmentIds);
                    });
                }
            })
            ->pluck('role_id')
            ->map(static fn ($id) => (int) $id)
            ->toArray();

        $roleIds = array_values(array_diff(array_unique($includeRoleIds), array_unique($excludeRoleIds)));
        return array_values($this->getByIds($organizationCode, $roleIds));
    }

    public function countOrganizationUsers(string $organizationCode): int
    {
        return UserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('status', AccountStatus::Normal->value)
            ->distinct()
            ->count('user_id');
    }

    /**
     * @return array<string>
     */
    public function getDistinctUserIdsByDepartmentIds(string $organizationCode, array $departmentIds): array
    {
        if (empty($departmentIds)) {
            return [];
        }

        $departmentUserIds = DepartmentUserModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('department_id', $departmentIds)
            ->distinct()
            ->pluck('user_id')
            ->map(static fn ($userId) => (string) $userId)
            ->toArray();

        if (empty($departmentUserIds)) {
            return [];
        }

        return UserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('status', AccountStatus::Normal->value)
            ->whereIn('user_id', $departmentUserIds)
            ->distinct()
            ->pluck('user_id')
            ->map(static fn ($userId) => (string) $userId)
            ->toArray();
    }

    private function toEntity(ModelAccessRoleModel $model): ModelAccessRoleEntity
    {
        $entity = new ModelAccessRoleEntity();
        $entity->setId((int) $model->id);
        $entity->setOrganizationCode((string) $model->organization_code);
        $entity->setName((string) $model->name);
        $entity->setDescription($model->description === null ? null : (string) $model->description);
        $entity->setCreatedUid($model->created_uid === null ? null : (string) $model->created_uid);
        $entity->setUpdatedUid($model->updated_uid === null ? null : (string) $model->updated_uid);
        $entity->setCreatedAt($model->created_at?->toDateTime());
        $entity->setUpdatedAt($model->updated_at?->toDateTime());
        return $entity;
    }

    private function findModelById(string $organizationCode, int $id): ?ModelAccessRoleModel
    {
        $model = ModelAccessRoleModel::query()
            ->where('organization_code', $organizationCode)
            ->find($id);

        return $model instanceof ModelAccessRoleModel ? $model : null;
    }
}
