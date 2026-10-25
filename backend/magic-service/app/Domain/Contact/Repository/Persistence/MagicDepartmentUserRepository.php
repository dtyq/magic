<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentUsersPageResponseDTO;
use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Event\DepartmentMembershipChanged;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentModel;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentUserModel;
use Hyperf\Context\Context;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\SimpleCache\CacheInterface;

class MagicDepartmentUserRepository implements MagicDepartmentUserRepositoryInterface
{
    public function __construct(
        protected DepartmentUserModel $departmentUserModel,
    ) {
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIds(array $userIds, string $organizationCode): array
    {
        $query = $this->departmentUserModel->newQuery()
            ->whereIn('user_id', $userIds)
            ->where('organization_code', $organizationCode);
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        return $this->getDepartmentUserEntities($departmentUsers);
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIdsInMagic(array $userIds): array
    {
        if (empty($userIds)) {
            return [];
        }
        $query = $this->departmentUserModel->newQuery()->whereIn('user_id', $userIds);
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        return $this->getDepartmentUserEntities($departmentUsers);
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIdsInActiveDepartments(array $userIds, ?string $organizationCode = null): array
    {
        if (empty($userIds)) {
            return [];
        }
        $query = $this->departmentUserModel->newQuery()
            ->select('magic_contact_department_users.*')
            ->join('magic_contact_departments as d', function ($join) {
                $join->on('d.department_id', '=', 'magic_contact_department_users.department_id')
                    ->on('d.organization_code', '=', 'magic_contact_department_users.organization_code')
                    ->whereNull('d.deleted_at');
            })
            ->whereIn('magic_contact_department_users.user_id', $userIds)
            ->whereNull('magic_contact_department_users.deleted_at');
        if ($organizationCode !== null && $organizationCode !== '') {
            $query->where('magic_contact_department_users.organization_code', $organizationCode);
        }
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        return $this->getDepartmentUserEntities($departmentUsers);
    }

    public function getDepartmentUsersByDepartmentId(string $departmentId, string $organizationCode, int $limit, int $offset): DepartmentUsersPageResponseDTO
    {
        $query = $this->departmentUserModel->newQuery()
            ->where('department_id', $departmentId)
            ->where('organization_code', $organizationCode)
            ->limit($limit)
            ->offset($offset);
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        $items = $this->getDepartmentUserEntities($departmentUsers);
        $hasMore = count($items) === $limit;
        $pageToken = $hasMore ? (string) ($limit + $offset) : '';
        return new DepartmentUsersPageResponseDTO([
            'items' => $items,
            'page_token' => $pageToken,
            'has_more' => $hasMore,
        ]);
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByDepartmentIds(array $departmentIds, string $organizationCode, int $limit, array $fields = ['*']): array
    {
        $query = $this->departmentUserModel->newQuery()
            ->select($fields)
            ->whereIn('department_id', $departmentIds)
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->limit($limit);
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        return $this->getDepartmentUserEntities($departmentUsers);
    }

    public function getDepartmentIdsByUserIds(DataIsolation $dataIsolation, array $userIds, bool $withAllParentIds = false, bool $useCache = true): array
    {
        $cache = di(CacheInterface::class);
        $key = 'MagicDepartmentUser:' . md5('department_ids_by_user_ids_' . implode('_', $userIds) . '_' . $dataIsolation->getCurrentOrganizationCode() . '_' . ($withAllParentIds ? 'all' : 'direct'));
        if ($useCache && $cache->has($key)) {
            return (array) $cache->get($key);
        }
        $builder = DepartmentUserModel::query();
        $builder->whereIn('user_id', $userIds);
        $builder->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $departmentUsers = Db::select($builder->toSql(), $builder->getBindings());
        $list = [];
        $departmentIds = [];
        foreach ($departmentUsers as $departmentUser) {
            $list[$departmentUser['user_id']][] = $departmentUser['department_id'];
            $departmentIds[] = $departmentUser['department_id'];
        }
        if ($withAllParentIds) {
            // 获取所有部门信息
            $departmentIds = array_values(array_unique($departmentIds));
            $departments = DepartmentModel::query()
                ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
                ->whereIn('department_id', $departmentIds)->pluck('path', 'department_id')->toArray();
            foreach ($list as $userId => $userDepartmentIds) {
                foreach ($userDepartmentIds as $departmentId) {
                    if (isset($departments[$departmentId])) {
                        $path = explode('/', $departments[$departmentId]);
                        $list[$userId] = array_merge($list[$userId], $path);
                    }
                }
                $list[$userId] = array_values(array_unique($list[$userId]));
            }
        }

        if ($useCache) {
            $cache->set($key, $list, 60);
        }

        return $list;
    }

    public function createDepartmentUsers(array $createDepartmentUserDTOs): bool
    {
        return Db::transaction(function () use ($createDepartmentUserDTOs): bool {
            $result = $this->departmentUserModel->newQuery()->insert($createDepartmentUserDTOs);
            foreach (array_unique(array_column($createDepartmentUserDTOs, 'organization_code')) as $organization) {
                $this->membershipChanged((string) $organization);
            }
            return $result;
        });
    }

    public function updateDepartmentUser(string $magicDepartmentUserPrimaryId, array $updateData): int
    {
        return Db::transaction(function () use ($magicDepartmentUserPrimaryId, $updateData): int {
            $old = $this->departmentUserModel->newQuery()->where('id', $magicDepartmentUserPrimaryId)->first();
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            $result = $this->departmentUserModel->newQuery()->where('id', $magicDepartmentUserPrimaryId)->update($updateData);
            if ($old !== null) {
                foreach (['department_id', 'organization_code', 'user_id', 'deleted_at'] as $field) {
                    if (array_key_exists($field, $updateData) && (string) $old->getAttribute($field) !== (string) $updateData[$field]) {
                        foreach (array_unique([(string) $old->getAttribute('organization_code'), (string) ($updateData['organization_code'] ?? $old->getAttribute('organization_code'))]) as $organization) {
                            $this->membershipChanged($organization);
                        }
                        break;
                    }
                }
            }
            return $result;
        });
    }

    public function deleteDepartmentUsersByMagicIds(array $magicIds, string $departmentId, string $magicOrganizationCode): int
    {
        return Db::transaction(function () use ($magicIds, $departmentId, $magicOrganizationCode): int {
            $result = (int) $this->departmentUserModel->newQuery()
                ->where('organization_code', $magicOrganizationCode)->whereIn('magic_id', $magicIds)
                ->where('department_id', $departmentId)->delete();
            if ($result > 0) {
                $this->membershipChanged($magicOrganizationCode);
            }
            return $result;
        });
    }

    public function deleteDepartmentUsersByDepartmentIds(array $departmentIds, string $magicOrganizationCode): int
    {
        if ($departmentIds === []) {
            return 0;
        }
        return Db::transaction(function () use ($departmentIds, $magicOrganizationCode): int {
            $result = (int) $this->departmentUserModel->newQuery()->where('organization_code', $magicOrganizationCode)
                ->whereIn('department_id', $departmentIds)->delete();
            if ($result > 0) {
                $this->membershipChanged($magicOrganizationCode);
            }
            return $result;
        });
    }

    public function getMagicIdsByDepartmentIds(array $departmentIds, string $organizationCode): array
    {
        if (empty($departmentIds)) {
            return [];
        }
        return $this->departmentUserModel->newQuery()
            ->where('organization_code', $organizationCode)
            ->whereIn('department_id', $departmentIds)
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('magic_id')
            ->toArray();
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function searchDepartmentUsersByEmployeeNo(string $employeeNo, string $organizationCode): array
    {
        $departmentUsers = $this->departmentUserModel::query()
            ->select(['user_id'])
            ->where('employee_no', '=', $employeeNo)
            ->where('organization_code', $organizationCode)
            ->distinct()
            ->get()
            ->toArray();

        return $this->getDepartmentUserEntities($departmentUsers);
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function searchDepartmentUsersByJobTitle(string $keyword, string $magicOrganizationCode): array
    {
        $res = $this->departmentUserModel::query()
            ->where('job_title', 'like', "%{$keyword}%")
            ->where('organization_code', $magicOrganizationCode)
            ->get()
            ->toArray();
        return array_map(fn ($item) => new MagicDepartmentUserEntity($item), $res);
    }

    private function membershipChanged(string $organization): void
    {
        // Bulk directory syncs notify once per organization in the originating coroutine.
        $key = 'department_membership_changed:' . Coroutine::id() . ':' . $organization;
        if (Context::get($key, false)) {
            return;
        }
        di(EventDispatcherInterface::class)->dispatch(new DepartmentMembershipChanged($organization));
        Context::set($key, true);
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    private function getDepartmentUserEntities(array $departmentUsers): array
    {
        $departmentUserEntities = [];
        foreach ($departmentUsers as $departmentUser) {
            $departmentUserEntities[] = new MagicDepartmentUserEntity($departmentUser);
        }
        return $departmentUserEntities;
    }
}
