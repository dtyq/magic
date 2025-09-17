<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentsPageResponseDTO;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Entity\ValueObject\PlatformType;

class MagicDepartmentDomainService extends AbstractContactDomainService
{
    public function getDepartmentById(DataIsolation $dataIsolation, string $departmentId): ?MagicDepartmentEntity
    {
        // -1 表示根部门信息.
        return $this->departmentRepository->getDepartmentById($departmentId, $dataIsolation->getCurrentOrganizationCode());
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentByIds(DataIsolation $dataIsolation, array $departmentIds, bool $keyById = false): array
    {
        return $this->departmentRepository->getDepartmentsByIds($departmentIds, $dataIsolation->getCurrentOrganizationCode(), $keyById);
    }

    /**
     * @return array<string, MagicDepartmentEntity[]>
     */
    public function getDepartmentFullPathByIds(DataIsolation $dataIsolation, array $departmentIds): array
    {
        // 对部门ids进行去重
        $departmentIds = array_values(array_unique($departmentIds));
        // 获取组织所有部门
        $departments = $this->departmentRepository->getOrganizationDepartments($dataIsolation->getCurrentOrganizationCode(), keyById: true);
        // 组装部门信息
        $res = [];
        foreach ($departmentIds as $departmentId) {
            $curDepartmentId = $departmentId;
            while (true) {
                $department = $departments[$curDepartmentId] ?? null;
                if ($department === null) {
                    break;
                }
                $res[$departmentId][] = $department;
                $curDepartmentId = $department->getParentDepartmentId();
                if ($department->getLevel() === 0) {
                    break;
                }
            }
            isset($res[$departmentId]) && $res[$departmentId] = array_reverse($res[$departmentId]);
        }
        return $res;
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentByIdsInMagic(array $departmentIds, bool $keyById = false): array
    {
        return $this->departmentRepository->getDepartmentsByIdsInMagic($departmentIds, $keyById);
    }

    public function updateDepartmentsOptionByIds(array $departmentIds, ?DepartmentOption $departmentOption = null): int
    {
        if (empty($departmentIds)) {
            return 0;
        }
        return $this->departmentRepository->updateDepartmentsOptionByIds($departmentIds, $departmentOption);
    }

    public function getSubDepartmentsByLevel(DataIsolation $dataIsolation, int $level, int $depth, int $size, int $offset): DepartmentsPageResponseDTO
    {
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $departmentsPageResponseDTO = $this->departmentRepository->getSubDepartmentsByLevel($level, $orgCode, $depth, $size, $offset);
        $departments = $departmentsPageResponseDTO->getItems();
        // 确定下级部门是否还有子部门
        $items = $this->getDepartmentsHasChild($departments, $orgCode);
        $departmentsPageResponseDTO->setItems($items);
        return $departmentsPageResponseDTO;
    }

    public function getSubDepartmentsById(DataIsolation $dataIsolation, string $departmentId, int $size, int $offset): DepartmentsPageResponseDTO
    {
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $departmentsPageResponseDTO = $this->departmentRepository->getSubDepartmentsById($departmentId, $orgCode, $size, $offset);
        $departments = $departmentsPageResponseDTO->getItems();
        // 确定下级部门是否还有子部门
        $items = $this->getDepartmentsHasChild($departments, $orgCode);
        $departmentsPageResponseDTO->setItems($items);
        return $departmentsPageResponseDTO;
    }

    /**
     * @param MagicDepartmentEntity[] $departments
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentsHasChild(array $departments, string $organizationCode): array
    {
        $departmentIds = array_column($departments, 'department_id');
        $childDepartments = $this->departmentRepository->hasChildDepartment($departmentIds, $organizationCode);
        $childDepartments = array_column($childDepartments, null, 'parent_department_id');
        $departmentsHasChild = [];
        foreach ($departments as $department) {
            $hasChild = isset($childDepartments[$department->getDepartmentId()]);
            $department->setHasChild($hasChild);
            // 移除不需要的字段
            $departmentsHasChild[] = $department;
        }
        return $departmentsHasChild;
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function searchDepartment(DataIsolation $dataIsolation, string $departmentName): array
    {
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $departments = $this->departmentRepository->searchDepartments($departmentName, $orgCode);
        return $this->getDepartmentsHasChild($departments, $orgCode);
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function searchDepartmentForPage(DataIsolation $dataIsolation, string $departmentName, string $pageToken = '', int $pageSize = 50): array
    {
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $departments = $this->departmentRepository->searchDepartments($departmentName, $orgCode, $pageToken, $pageSize);
        return $this->getDepartmentsHasChild($departments, $orgCode);
    }

    /**
     * 批量获取部门的所有子部门.
     * @return MagicDepartmentEntity[]
     */
    public function getAllChildrenByDepartmentIds(array $departmentIds, DataIsolation $dataIsolation): array
    {
        $departments = $this->departmentRepository->getOrganizationDepartments(
            $dataIsolation->getCurrentOrganizationCode(),
            ['department_id', 'parent_department_id', 'name', 'path']
        );

        $departmentsChildrenEntities = $this->getChildrenByDepartmentIds($departments, $departmentIds);
        // 合并 && 去重
        $departmentIds = array_column(array_merge(...$departmentsChildrenEntities), 'department_id');
        return array_values(array_unique($departmentIds));
    }

    public function addDepartmentDocument(string $departmentId, string $documentId): void
    {
        $this->departmentRepository->addDepartmentDocument($departmentId, $documentId);
    }

    public function getDepartmentChildrenEmployeeSum(MagicDepartmentEntity $departmentEntity): int
    {
        return $this->departmentRepository->getSelfAndChildrenEmployeeSum($departmentEntity);
    }

    /**
     * 根部门被抽象为 -1，所以这里需要转换为实际的根部门 id.
     */
    public function getDepartmentRootId(DataIsolation $dataIsolation): string
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        // 获取组织所属的平台类型
        $platformType = $this->organizationsPlatformRepository->getOrganizationPlatformType($organizationCode);
        if ($platformType === PlatformType::Magic) {
            // 获取根部门ID
            return $this->departmentRepository->getDepartmentRootId($organizationCode);
        }

        // 根据组织编码和平台类型获取根部门ID
        return $this->thirdPlatformIdMappingRepository->getDepartmentRootId($organizationCode, $platformType);
    }

    /**
     * 批量获取多个组织的根部门信息.
     * @param array $organizationCodes 组织代码数组
     * @return array<string,MagicDepartmentEntity> 以组织代码为键，根部门实体为值的关联数组
     */
    public function getOrganizationsRootDepartment(array $organizationCodes): array
    {
        $rootDepartments = $this->departmentRepository->getOrganizationsRootDepartment($organizationCodes);

        // 检查是否有根部门数据
        if (empty($rootDepartments)) {
            return [];
        }

        // 处理数据格式，以组织代码为键，根部门实体为值
        $result = [];
        foreach ($rootDepartments as $department) {
            $result[$department->getOrganizationCode()] = $department;
        }

        return $result;
    }

    /**
     * Get all organizations root departments with pagination support.
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param string $organizationName Organization name for fuzzy search (optional)
     * @return array Array containing total and list
     */
    public function getAllOrganizationsRootDepartments(int $page = 1, int $pageSize = 20, string $organizationName = ''): array
    {
        return $this->departmentRepository->getAllOrganizationsRootDepartments($page, $pageSize, $organizationName);
    }

    public function getOrganizationNameByCode(string $organizationCode): string
    {
        $entity = $this->departmentRepository->getDepartmentById('-1', $organizationCode);
        if (empty($entity)) {
            return '';
        }
        return $entity->getName();
    }

    /**
     * Batch get organization names by organization codes.
     *
     * @param array $organizationCodes Array of organization codes
     * @return array Array with structure [code => name]
     */
    public function batchGetOrganizationNamesByCodes(array $organizationCodes): array
    {
        if (empty($organizationCodes)) {
            return [];
        }

        $result = [];
        foreach ($organizationCodes as $organizationCode) {
            $entity = $this->departmentRepository->getDepartmentById('-1', $organizationCode);
            $result[$organizationCode] = $entity ? $entity->getName() : '';
        }

        return $result;
    }

    /**
     * 获取部门的所有子部门.
     * @param MagicDepartmentEntity[] $allDepartments
     */
    protected function getChildrenByDepartmentIds(array $allDepartments, array $departmentIds): array
    {
        $childrenDepartments = [];
        foreach ($allDepartments as $department) {
            foreach ($departmentIds as $departmentId) {
                if (str_contains($department->getPath(), $departmentId)) {
                    $childrenDepartments[$departmentId][] = $department;
                }
            }
        }
        return $childrenDepartments;
    }
}
