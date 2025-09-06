<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Exception;

class OrganizationAdminAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly OrganizationAdminDomainService $organizationAdminDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly MagicDepartmentDomainService $departmentDomainService
    ) {
    }

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: array}
     */
    public function queries(DataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        $result = $this->organizationAdminDomainService->queries($dataIsolation, $page, $filters);

        // 获取用户信息
        $organizationAdmins = $result['list'];
        $enrichedList = [];

        foreach ($organizationAdmins as $organizationAdmin) {
            $enrichedData = $this->enrichOrganizationAdminWithUserInfo($dataIsolation, $organizationAdmin);
            $enrichedList[] = $enrichedData;
        }

        return [
            'total' => $result['total'],
            'list' => $enrichedList,
        ];
    }

    /**
     * 获取组织管理员详情.
     */
    public function show(DataIsolation $dataIsolation, int $id): array
    {
        $organizationAdmin = $this->organizationAdminDomainService->show($dataIsolation, $id);
        return $this->enrichOrganizationAdminWithUserInfo($dataIsolation, $organizationAdmin);
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(DataIsolation $dataIsolation, string $userId): ?OrganizationAdminEntity
    {
        return $this->organizationAdminDomainService->getByUserId($dataIsolation, $userId);
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(DataIsolation $dataIsolation, string $userId, string $grantorUserId, ?string $remarks = null): OrganizationAdminEntity
    {
        return $this->organizationAdminDomainService->grant($dataIsolation, $userId, $grantorUserId, $remarks);
    }

    /**
     * 删除组织管理员.
     */
    public function destroy(DataIsolation $dataIsolation, int $id): void
    {
        $organizationAdmin = $this->organizationAdminDomainService->show($dataIsolation, $id);
        $this->organizationAdminDomainService->destroy($dataIsolation, $organizationAdmin);
    }

    /**
     * 转让组织创建人身份.
     */
    public function transferOwnership(DataIsolation $dataIsolation, string $newOwnerUserId, string $currentOwnerUserId): void
    {
        $this->organizationAdminDomainService->transferOrganizationCreator(
            $dataIsolation,
            $currentOwnerUserId,
            $newOwnerUserId,
            $currentOwnerUserId // 操作者就是当前创建者
        );
    }

    /**
     * 丰富组织管理员实体的用户信息.
     */
    private function enrichOrganizationAdminWithUserInfo(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdmin): array
    {
        // 获取用户基本信息
        $userInfo = $this->getUserInfo($organizationAdmin->getUserId());

        // 获取授权人信息
        $grantorInfo = [];
        if ($organizationAdmin->getGrantorUserId()) {
            $grantorInfo = $this->getUserInfo($organizationAdmin->getGrantorUserId());
        }

        // 获取部门信息
        $departmentInfo = $this->getDepartmentInfo($dataIsolation, $organizationAdmin->getUserId());

        return [
            'organization_admin' => $organizationAdmin,
            'user_info' => $userInfo,
            'grantor_info' => $grantorInfo,
            'department_info' => $departmentInfo,
        ];
    }

    /**
     * 获取用户信息.
     */
    private function getUserInfo(string $userId): array
    {
        $user = $this->userDomainService->getUserById($userId);
        if (! $user) {
            return [];
        }

        return [
            'user_id' => $user->getUserId(),
            'nickname' => $user->getNickname(),
            'avatar_url' => $user->getAvatarUrl(),
        ];
    }

    /**
     * 获取用户部门信息.
     */
    private function getDepartmentInfo(DataIsolation $dataIsolation, string $userId): array
    {
        try {
            $departmentUsers = $this->departmentUserDomainService->getDepartmentUsersByUserIds(
                [$userId],
                $dataIsolation
            );

            if (empty($departmentUsers)) {
                return [];
            }

            $departmentUser = $departmentUsers[0];

            // 获取部门详细信息
            $department = $this->departmentDomainService->getDepartmentById(
                $dataIsolation,
                $departmentUser->getDepartmentId()
            );

            return [
                'name' => $department ? $department->getName() : '',
                'job_title' => $departmentUser->getJobTitle(),
            ];
        } catch (Exception $e) {
            // 如果获取部门信息失败，返回空数组
            return [];
        }
    }
}
