<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;

/**
 * Magic用户信息应用服务.
 *
 * 聚合用户的基本信息、账户信息和部门信息，提供完整的用户信息。
 */
class MagicUserInfoAppService extends AbstractAppService
{
    public function __construct(
        protected readonly MagicUserDomainService $userDomainService,
        protected readonly MagicAccountDomainService $accountDomainService,
        protected readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        protected readonly MagicDepartmentDomainService $departmentDomainService,
    ) {
    }

    /**
     * 获取完整的用户信息.
     *
     * @param string $userId 用户ID
     * @param ContactDataIsolation $dataIsolation 数据隔离对象
     * @return array 包含用户完整信息的数组
     */
    public function getUserInfo(string $userId, ContactDataIsolation $dataIsolation): array
    {
        // 获取基本用户信息
        $userEntity = $this->userDomainService->getUserById($userId);
        if (! $userEntity) {
            return $this->getEmptyUserInfo($userId);
        }

        // 获取账户信息
        $accountEntity = null;
        if ($userEntity->getMagicId()) {
            $accountEntity = $this->accountDomainService->getAccountInfoByMagicId($userEntity->getMagicId());
        }

        // 获取部门用户关联信息
        $departmentUserEntities = $this->departmentUserDomainService->getDepartmentUsersByUserIds([$userId], $dataIsolation);

        // 提取工号和职位
        $workNumber = '';
        $position = '';
        if (! empty($departmentUserEntities)) {
            $firstDepartmentUser = $departmentUserEntities[0];
            $workNumber = $firstDepartmentUser->getEmployeeNo() ?? '';
            $position = $firstDepartmentUser->getJobTitle() ?? '';
        }

        // 获取部门详细信息
        $departments = $this->getDepartmentsInfo($departmentUserEntities, $dataIsolation);

        return [
            'id' => $userId,
            'nickname' => $userEntity->getNickname() ?? '',
            'real_name' => $accountEntity?->getRealName() ?? '',
            'avatar_url' => $userEntity->getAvatarUrl() ?? '',
            'work_number' => $workNumber,
            'position' => $position,
            'departments' => $departments,
        ];
    }

    /**
     * 批量获取用户信息.
     *
     * @param array $userIds 用户ID数组
     * @param ContactDataIsolation $dataIsolation 数据隔离对象
     * @return array 用户信息数组，键为用户ID
     */
    public function getBatchUserInfo(array $userIds, ContactDataIsolation $dataIsolation): array
    {
        $result = [];
        foreach ($userIds as $userId) {
            $result[$userId] = $this->getUserInfo($userId, $dataIsolation);
        }
        return $result;
    }

    /**
     * 检查用户是否存在.
     *
     * @param string $userId 用户ID
     * @return bool 用户是否存在
     */
    public function userExists(string $userId): bool
    {
        $userEntity = $this->userDomainService->getUserById($userId);
        return $userEntity !== null;
    }

    /**
     * 获取用户的主要部门信息.
     *
     * @param string $userId 用户ID
     * @param ContactDataIsolation $dataIsolation 数据隔离对象
     * @return null|array 主要部门信息，如果没有则返回null
     */
    public function getUserPrimaryDepartment(string $userId, ContactDataIsolation $dataIsolation): ?array
    {
        $userInfo = $this->getUserInfo($userId, $dataIsolation);
        return $userInfo['departments'][0] ?? null;
    }

    /**
     * 获取部门信息.
     *
     * @param array $departmentUserEntities 部门用户关联信息
     * @param ContactDataIsolation $dataIsolation 数据隔离对象
     * @return array 部门信息数组
     */
    private function getDepartmentsInfo(array $departmentUserEntities, ContactDataIsolation $dataIsolation): array
    {
        if (empty($departmentUserEntities)) {
            return [];
        }

        // 获取部门ID
        $departmentIds = array_column($departmentUserEntities, 'department_id');
        $departments = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds, true);

        // 构建部门数组
        $departmentArray = [];
        foreach ($departmentUserEntities as $departmentUserEntity) {
            $departmentEntity = $departments[$departmentUserEntity->getDepartmentId()] ?? null;
            if (! $departmentEntity) {
                continue;
            }

            // 获取路径部门
            $pathNames = [];
            $pathDepartments = explode('/', $departmentEntity->getPath());
            $pathDepartmentEntities = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $pathDepartments, true);

            foreach ($pathDepartments as $pathDepartmentId) {
                if (isset($pathDepartmentEntities[$pathDepartmentId]) && $pathDepartmentEntities[$pathDepartmentId]->getName() !== '') {
                    $pathNames[] = $pathDepartmentEntities[$pathDepartmentId]->getName();
                }
            }

            $departmentArray[] = [
                'id' => $departmentEntity->getDepartmentId(),
                'name' => $departmentEntity->getName(),
                'path' => implode('/', $pathNames),
            ];
        }

        return $departmentArray;
    }

    /**
     * 构建空的用户信息.
     *
     * @param string $userId 用户ID
     * @return array 空的用户信息数组
     */
    private function getEmptyUserInfo(string $userId): array
    {
        return [
            'id' => $userId,
            'nickname' => '',
            'real_name' => '',
            'work_number' => '',
            'position' => '',
            'departments' => [],
        ];
    }
}
