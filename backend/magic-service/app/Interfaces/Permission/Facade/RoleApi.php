<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Permission\Service\RoleAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\Query\SubAdminQuery;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\Permission\Assembler\SubAdminAssembler;
use App\Interfaces\Permission\DTO\CreateSubAdminRequestDTO;
use App\Interfaces\Permission\DTO\UpdateSubAdminRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;

#[ApiResponse(version: 'low_code')]
class RoleApi extends AbstractPermissionApi
{
    #[Inject]
    protected RoleAppService $roleAppService;

    #[Inject]
    protected MagicUserInfoAppService $userInfoAppService;

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
    public function getSubAdminList(): array
    {
        // 获取认证信息
        $authorization = $this->getAuthorization();

        // 创建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 创建分页对象
        $page = $this->createPage();

        // 构建查询对象（自动过滤掉分页字段）
        $query = new SubAdminQuery($this->request->all());

        // 转换为仓储过滤数组
        $filters = $query->toFilters();

        // 查询角色列表
        $result = $this->roleAppService->queries($dataIsolation, $page, $filters);

        // 批量获取用户详情（每个角色仅取前5个userId）
        $contactIsolation = ContactDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 收集需要查询的用户ID
        $roleUserIdsMap = [];
        $allNeedUserIds = [];
        foreach ($result['list'] as $index => $roleEntity) {
            /** @var RoleEntity $roleEntity */
            $limitedIds = array_slice($roleEntity->getUserIds(), 0, 5);
            $limitedIds[] = $roleEntity->getUpdatedUid();
            $roleUserIdsMap[$index] = $limitedIds;
            $allNeedUserIds = array_merge($allNeedUserIds, $limitedIds);
        }
        $allNeedUserIds = array_values(array_unique($allNeedUserIds));

        // 批量查询用户信息
        $allUserInfo = [];
        if (! empty($allNeedUserIds)) {
            $allUserInfo = $this->userInfoAppService->getBatchUserInfo($allNeedUserIds, $contactIsolation);
        }

        // 重新组装列表数据
        $list = [];
        foreach ($result['list'] as $index => $roleEntity) {
            $limitedIds = $roleUserIdsMap[$index] ?? [];
            // Exclude the operator (updatedUid) from the user list that will be displayed
            $displayUserIds = array_diff($limitedIds, [$roleEntity->getUpdatedUid()]);
            $userDetailsForRole = array_intersect_key($allUserInfo, array_flip($displayUserIds));
            $list[] = SubAdminAssembler::assembleWithUserInfo(
                $roleEntity,
                $userDetailsForRole,
                $allUserInfo[$roleEntity->getUpdatedUid()] ?? null
            );
        }

        return (new PageDTO($page->getPage(), $result['total'], $list))->toArray();
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
    public function getSubAdminById(int $id): array
    {
        // 获取认证信息
        $authorization = $this->getAuthorization();

        // 创建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 获取角色详情
        $roleEntity = $this->roleAppService->show($dataIsolation, $id);

        // 获取角色关联的用户信息
        $contactIsolation = ContactDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );
        $userInfo = $this->userInfoAppService->getBatchUserInfo(
            $roleEntity->getUserIds(),
            $contactIsolation
        );

        return SubAdminAssembler::assembleWithUserInfo($roleEntity, $userInfo);
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function createSubAdmin(): array
    {
        // 获取认证信息
        $authorization = $this->getAuthorization();

        // 创建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 创建并验证请求DTO
        $requestDTO = new CreateSubAdminRequestDTO($this->request->all());
        if (! $requestDTO->validate()) {
            $errors = $requestDTO->getValidationErrors();
            throw new InvalidArgumentException('请求参数验证失败: ' . implode(', ', $errors));
        }

        // 创建角色实体
        $roleEntity = new RoleEntity();
        $roleEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setCreatedUid($dataIsolation->getCurrentUserId());
        $roleEntity->setName($requestDTO->getName());
        $roleEntity->setPermissions($requestDTO->getPermissions());
        $roleEntity->setUserIds($requestDTO->getUserIds());
        $roleEntity->setStatus($requestDTO->getStatus());

        $savedRole = $this->roleAppService->createRole(
            $dataIsolation,
            $roleEntity
        );

        return $savedRole->toArray();
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function updateSubAdmin(): array
    {
        // 获取认证信息
        $authorization = $this->getAuthorization();

        // 创建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 获取角色ID
        $roleId = (int) $this->request->route('id');

        // 创建并验证请求DTO
        $requestDTO = new UpdateSubAdminRequestDTO($this->request->all());

        if (! $requestDTO->validate()) {
            $errors = $requestDTO->getValidationErrors();
            throw new InvalidArgumentException('请求参数验证失败: ' . implode(', ', $errors));
        }
        if (! $requestDTO->hasUpdates()) {
            throw new InvalidArgumentException('至少需要提供一个要更新的字段');
        }

        // 获取现有角色
        $roleEntity = $this->roleAppService->show($dataIsolation, $roleId);

        $updateFields = $requestDTO->getUpdateFields();
        if (isset($updateFields['name'])) {
            $roleEntity->setName($updateFields['name']);
        }
        if (isset($updateFields['status'])) {
            $roleEntity->setStatus($updateFields['status']);
        }
        if (isset($updateFields['permissions'])) {
            $roleEntity->setPermissions($updateFields['permissions']);
        }
        if (isset($updateFields['userIds'])) {
            $roleEntity->setUserIds($requestDTO->getUserIds());
        }

        $savedRole = $this->roleAppService->updateRole($dataIsolation, $roleEntity);

        return $savedRole->toArray();
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function deleteSubAdmin(int $id): array
    {
        // 获取认证信息
        $authorization = $this->getAuthorization();

        // 创建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 删除角色
        $this->roleAppService->destroy($dataIsolation, $id);

        // 返回空数组以触发统一的 ApiResponse 封装
        return [];
    }
}
