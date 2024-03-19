<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\PageResponseDTO\DepartmentsPageResponseDTO;
use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Contact\DTO\DepartmentQueryDTO;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Entity\ValueObject\DepartmentSumType;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicThirdPlatformDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\PageListAssembler;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class MagicDepartmentAppService extends AbstractAppService
{
    public LoggerInterface $logger;

    public function __construct(
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected MagicOrganizationEnvDomainService $organizationEnvDomainService,
        protected MagicAccountDomainService $magicAccountDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected LockerInterface $locker,
        protected LoggerFactory $loggerFactory,
        protected MagicAgentDomainService $magicAgentDomainService,
        protected MagicThirdPlatformDomainService $thirdPlatformDomainService,
    ) {
        try {
            $this->logger = $loggerFactory->get(get_class($this));
        } catch (Throwable) {
        }
    }

    // 查询部门详情,需要返回是否有子部门
    public function getDepartmentById(DepartmentQueryDTO $queryDTO, MagicUserAuthorization $userAuthorization): ?MagicDepartmentEntity
    {
        // 对于前端来说, -1 表示根部门信息.
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $departmentEntity = $this->magicDepartmentDomainService->getDepartmentById($dataIsolation, $queryDTO->getDepartmentId());
        if ($departmentEntity === null) {
            return null;
        }
        $this->setChildrenEmployeeSum($queryDTO, $departmentEntity);
        // 判断是否有下级部门
        $departmentEntity = $this->magicDepartmentDomainService->getDepartmentsHasChild([$departmentEntity], $dataIsolation->getCurrentOrganizationCode())[0];
        return $this->filterDepartmentsHidden([$departmentEntity])[0] ?? null;
    }

    /**
     * 查询部门详情.
     * @return array<MagicDepartmentEntity>
     */
    public function getDepartmentByIds(DepartmentQueryDTO $queryDTO, MagicUserAuthorization $userAuthorization): array
    {
        // 对于前端来说, -1 表示根部门信息.
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $departmentEntities = $this->magicDepartmentDomainService->getDepartmentByIds($dataIsolation, $queryDTO->getDepartmentIds(), true);
        return $this->filterDepartmentsHidden($departmentEntities);
    }

    public function getSubDepartments(DepartmentQueryDTO $queryDTO, MagicUserAuthorization $userAuthorization): DepartmentsPageResponseDTO
    {
        $offset = 0;
        $pageSize = 50;
        $pageToken = $queryDTO->getPageToken();
        $departmentId = $queryDTO->getDepartmentId();
        if (is_numeric($pageToken)) {
            $offset = (int) $pageToken;
        }
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // departmentId 为-1 表示获取根部门下的第一级部门
        if ($departmentId === PlatformRootDepartmentId::Magic) {
            $departmentsPageResponseDTO = $this->magicDepartmentDomainService->getSubDepartmentsByLevel($dataIsolation, 0, 1, $pageSize, $offset);
        } else {
            // 获取部门
            $departmentsPageResponseDTO = $this->magicDepartmentDomainService->getSubDepartmentsById($dataIsolation, $departmentId, $pageSize, $offset);
        }
        $departments = $departmentsPageResponseDTO->getItems();
        // 设置部门以及所有子部门的人员数量.
        foreach ($departments as $magicDepartmentEntity) {
            $this->setChildrenEmployeeSum($queryDTO, $magicDepartmentEntity);
        }
        // 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
        $departments = $this->filterDepartmentsHidden($departments);
        $departmentsPageResponseDTO->setItems($departments);
        return $departmentsPageResponseDTO;
    }

    public function searchDepartment(DepartmentQueryDTO $queryDTO, MagicUserAuthorization $userAuthorization): array
    {
        $pageToken = $queryDTO->getPageToken();
        $departmentName = $queryDTO->getQuery();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $departments = $this->magicDepartmentDomainService->searchDepartment($dataIsolation, $departmentName);
        foreach ($departments as $magicDepartmentEntity) {
            $this->setChildrenEmployeeSum($queryDTO, $magicDepartmentEntity);
        }
        // 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
        $departments = $this->filterDepartmentsHidden($departments);
        // 全量查找，没有更多
        return PageListAssembler::pageByMysql($departments);
    }

    public function updateDepartmentsOptionByIds(array $userIds, ?DepartmentOption $departmentOption = null): int
    {
        return $this->magicDepartmentDomainService->updateDepartmentsOptionByIds($userIds, $departmentOption);
    }

    /**
     * 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
     * @param MagicDepartmentEntity[] $magicDepartments
     */
    protected function filterDepartmentsHidden(array $magicDepartments): array
    {
        foreach ($magicDepartments as $key => $departmentEntity) {
            if ($departmentEntity->getOption() === DepartmentOption::Hidden) {
                unset($magicDepartments[$key]);
            }
        }
        return array_values($magicDepartments);
    }

    /**
     * 设置部门以及所有子部门的人员数量.
     */
    protected function setChildrenEmployeeSum(DepartmentQueryDTO $queryDTO, MagicDepartmentEntity $departmentEntity): void
    {
        // 部门以及所有子部门的人员数量
        if ($queryDTO->getSumType() === DepartmentSumType::All) {
            $employeeSum = $this->magicDepartmentDomainService->getDepartmentChildrenEmployeeSum($departmentEntity);
            $departmentEntity->setEmployeeSum($employeeSum);
        }
    }
}
