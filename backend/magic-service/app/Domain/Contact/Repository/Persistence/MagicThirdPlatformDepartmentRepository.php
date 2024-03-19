<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Contact\Entity\MagicThirdPlatformDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Repository\Facade\MagicThirdPlatformDepartmentRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\ThirdPlatformDepartmentModel;
use App\Interfaces\Chat\Assembler\DepartmentAssembler;
use Hyperf\Database\Model\Builder;
use JetBrains\PhpStorm\ArrayShape;

/**
 * @deprecated
 */
class MagicThirdPlatformDepartmentRepository implements MagicThirdPlatformDepartmentRepositoryInterface
{
    public function __construct(
        protected ThirdPlatformDepartmentModel $model,
    ) {
    }

    public function getDepartmentById(string $thirdDepartmentId, string $organizationCode, PlatformType $thirdPlatformType): ?MagicThirdPlatformDepartmentEntity
    {
        $department = $this->model::query()
            ->where('magic_organization_code', $organizationCode)
            ->where('third_department_id', $thirdDepartmentId)
            ->where('third_platform_type', $thirdPlatformType->value)
            ->first();
        if ($department === null) {
            return null;
        }
        return DepartmentAssembler::getThirdPlatformDepartmentEntity($department->toArray());
    }

    /**
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getDepartmentByIds(array $departmentIds, string $organizationCode, bool $keyById = false): array
    {
        if (empty($departmentIds)) {
            return [];
        }
        $departments = $this->model::query()
            ->where('magic_organization_code', $organizationCode)
            ->whereIn('third_department_id', $departmentIds)
            ->get()
            ->toArray();
        return $this->getDepartmentsEntity($departments, $keyById);
    }

    /**
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getSubDepartmentsById(string $departmentId, string $organizationCode, int $size, int $offset): array
    {
        $departments = $this->model::query()
            ->where('magic_organization_code', $organizationCode)
            ->where('third_parent_department_id', $departmentId)
            ->limit($size)
            ->offset($offset)
            ->orderBy('id')
            ->get()
            ->toArray();
        return $this->getDepartmentsEntity($departments);
    }

    /**
     * 获取某一层级的部门.
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getSubDepartmentsByLevel(int $currentDepartmentLevel, string $organizationCode, int $depth, int $size, int $offset): array
    {
        $minDepth = $currentDepartmentLevel + 1;
        $maxDepth = $currentDepartmentLevel + $depth;
        if ($minDepth > $maxDepth) {
            return [];
        }
        $query = $this->model::query()
            ->where('magic_organization_code', $organizationCode);
        if ($minDepth === $maxDepth) {
            $query->where('level', $minDepth);
        } else {
            $query->whereBetween('level', [$minDepth, $maxDepth])->get()->toArray();
        }
        $departments = $query
            ->limit($size)
            ->offset($offset)
            ->orderBy('id')
            ->get()
            ->toArray();
        return $this->getDepartmentsEntity($departments);
    }

    // 给定的部门id是否有下级部门
    #[ArrayShape([
        'third_parent_department_id' => 'string',
    ])]
    public function hasChildDepartment(array $departmentIds, string $organizationCode): array
    {
        return $this->model::query()
            ->where('magic_organization_code', $organizationCode)
            ->whereIn('third_parent_department_id', $departmentIds)
            ->groupBy(['third_parent_department_id'])
            ->get(['third_parent_department_id'])
            ->toArray();
    }

    public function getDepartmentByParentId(string $departmentId, string $organizationCode): ?MagicThirdPlatformDepartmentEntity
    {
        // 对于前端来说, -1 表示根部门信息.
        $query = $this->model::query()->where('magic_organization_code', $organizationCode);
        if ($departmentId === PlatformRootDepartmentId::Magic) {
            $query->where(function (Builder $query) {
                $query->where('third_parent_department_id', '=', '')->orWhereNull('third_parent_department_id');
            });
        } else {
            $query->whereIn('third_parent_department_id', $departmentId);
        }
        $department = $query->first()?->toArray();
        if (empty($department)) {
            return null;
        }
        return DepartmentAssembler::getThirdPlatformDepartmentEntity($department);
    }

    /**
     * 获取组织的所有部门.
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getOrganizationDepartments(string $organizationCode, array $fields = ['*']): array
    {
        $departments = $this->model::query()
            ->where('magic_organization_code', $organizationCode)
            ->get($fields)
            ->toArray();
        return $this->getDepartmentsEntity($departments);
    }

    /**
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    protected function getDepartmentsEntity(array $departments, bool $keyById = false): array
    {
        $departmentsEntity = [];
        foreach ($departments as $department) {
            $departmentEntity = DepartmentAssembler::getThirdPlatformDepartmentEntity($department);
            if ($keyById) {
                $departmentsEntity[$departmentEntity->getThirdDepartmentId()] = $departmentEntity;
            } else {
                $departmentsEntity[] = $departmentEntity;
            }
        }
        return $departmentsEntity;
    }
}
