<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentUsersPageResponseDTO;
use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentModel;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentUserModel;
use Hyperf\DbConnection\Db;
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
        $query = $this->departmentUserModel->newQuery()->whereIn('user_id', $userIds);
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
            ->limit($limit);
        $departmentUsers = Db::select($query->toSql(), $query->getBindings());
        return $this->getDepartmentUserEntities($departmentUsers);
    }

    public function getDepartmentIdsByUserIds(DataIsolation $dataIsolation, array $userIds, bool $withAllParentIds = false): array
    {
        $cache = di(CacheInterface::class);
        $key = 'MagicDepartmentUser:' . md5('department_ids_by_user_ids_' . implode('_', $userIds) . '_' . $dataIsolation->getCurrentOrganizationCode() . '_' . ($withAllParentIds ? 'all' : 'direct'));
        if ($cache->has($key)) {
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

        $cache->set($key, $list, 60);

        return $list;
    }

    public function createDepartmentUsers(array $createDepartmentUserDTOs): bool
    {
        return $this->departmentUserModel->newQuery()->insert($createDepartmentUserDTOs);
    }

    public function updateDepartmentUser(string $magicDepartmentUserPrimaryId, array $updateData): int
    {
        $updateData['updated_at'] = date('Y-m-d H:i:s');
        return $this->departmentUserModel->newQuery()
            ->where('id', $magicDepartmentUserPrimaryId)
            ->update($updateData);
    }

    public function deleteDepartmentUsersByMagicIds(array $magicIds, string $departmentId, string $magicOrganizationCode): int
    {
        return (int) $this->departmentUserModel->newQuery()
            ->where('organization_code', $magicOrganizationCode)
            ->whereIn('magic_id', $magicIds)
            ->where('department_id', $departmentId)
            ->delete();
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
