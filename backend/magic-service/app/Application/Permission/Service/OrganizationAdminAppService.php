<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
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
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService
    ) {
    }

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: array}
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        $result = $this->organizationAdminDomainService->queries($organizationCode, $page, $filters);

        // 获取用户信息
        $organizationAdmins = $result['list'];
        $enrichedList = [];

        foreach ($organizationAdmins as $organizationAdmin) {
            $enrichedData = $this->enrichOrganizationAdminWithUserInfo($organizationCode, $organizationAdmin);
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
    public function show(string $organizationCode, int $id): array
    {
        $organizationAdmin = $this->organizationAdminDomainService->show($organizationCode, $id);
        return $this->enrichOrganizationAdminWithUserInfo($organizationCode, $organizationAdmin);
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(string $organizationCode, string $userId): ?OrganizationAdminEntity
    {
        return $this->organizationAdminDomainService->getByUserId($organizationCode, $userId);
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(string $organizationCode, string $userId, string $grantorUserId, ?string $remarks = null): OrganizationAdminEntity
    {
        return $this->organizationAdminDomainService->grant($organizationCode, $userId, $grantorUserId, $remarks);
    }

    /**
     * 删除组织管理员.
     */
    public function destroy(string $organizationCode, int $id): void
    {
        $organizationAdmin = $this->organizationAdminDomainService->show($organizationCode, $id);
        $this->organizationAdminDomainService->destroy($organizationCode, $organizationAdmin);
    }

    /**
     * 启用组织管理员.
     */
    public function enable(string $organizationCode, int $id): void
    {
        $this->organizationAdminDomainService->enable($organizationCode, $id);
    }

    /**
     * 禁用组织管理员.
     */
    public function disable(string $organizationCode, int $id): void
    {
        $this->organizationAdminDomainService->disable($organizationCode, $id);
    }

    /**
     * 丰富组织管理员实体的用户信息.
     */
    private function enrichOrganizationAdminWithUserInfo(string $organizationCode, OrganizationAdminEntity $organizationAdmin): array
    {
        // 获取用户基本信息
        $userInfo = $this->getUserInfo($organizationAdmin->getUserId());

        // 获取授权人信息
        $grantorInfo = [];
        if ($organizationAdmin->getGrantorUserId()) {
            $grantorInfo = $this->getUserInfo($organizationAdmin->getGrantorUserId());
        }

        // 获取部门信息
        $departmentInfo = $this->getDepartmentInfo($organizationCode, $organizationAdmin->getUserId());

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
    private function getDepartmentInfo(string $organizationCode, string $userId): array
    {
        try {
            $dataIsolation = new DataIsolation(['organization_code' => $organizationCode]);
            $departmentUsers = $this->departmentUserDomainService->getDepartmentUsersByUserIds(
                [$userId],
                $dataIsolation
            );

            if (empty($departmentUsers)) {
                return [];
            }

            $departmentUser = $departmentUsers[0];

            // 获取部门详细信息
            $department = $this->departmentUserDomainService->getDepartmentById(
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
