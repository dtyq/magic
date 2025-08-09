<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
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

        // 获取查询过滤参数
        $filters = $this->request->all();
        // 移除分页参数，只保留过滤参数
        unset($filters['page'], $filters['page_size']);

        // 查询角色列表
        $result = $this->roleAppService->queries($dataIsolation, $page, $filters);

        return [
            'total' => $result['total'],
            'list' => array_map(fn(RoleEntity $role) => $role->toArray(), $result['list']),
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum()
        ];
    }

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

        return $roleEntity->toArray();
    }

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
}
