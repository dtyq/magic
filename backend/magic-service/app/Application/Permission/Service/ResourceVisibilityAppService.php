<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 资源可见性应用服务.
 */
class ResourceVisibilityAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
    ) {
    }

    /**
     * 批量保存资源可见性配置.
     *
     * @param Authenticatable $authorization 当前用户
     * @param int $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @param array<ResourceVisibilityEntity> $entities 实体数组
     */
    public function batchSaveResourceVisibility(
        Authenticatable $authorization,
        int $resourceType,
        string $resourceCode,
        array $entities
    ): void {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);

        // 验证并转换枚举值
        $resourceTypeEnum = ResourceType::make($resourceType);

        // 权限检查
        $this->checkResourceVisibilityPermission($permissionDataIsolation, $resourceTypeEnum);

        // 调用领域服务保存
        $this->resourceVisibilityDomainService->batchSaveResourceVisibility(
            $permissionDataIsolation,
            $resourceTypeEnum,
            $resourceCode,
            $entities
        );
    }

    /**
     * 查询资源可见性列表.
     *
     * @param Authenticatable $authorization 当前用户
     * @param int $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @return array<ResourceVisibilityEntity>
     */
    public function listResourceVisibility(
        Authenticatable $authorization,
        int $resourceType,
        string $resourceCode
    ): array {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $resourceTypeEnum = ResourceType::make($resourceType);

        $this->checkResourceVisibilityPermission($permissionDataIsolation, $resourceTypeEnum);

        return $this->resourceVisibilityDomainService->listResourceVisibility(
            $permissionDataIsolation,
            $resourceTypeEnum,
            $resourceCode
        );
    }

    /**
     * 保存可见性配置(高层封装).
     *
     * @param Authenticatable $authorization 当前用户
     * @param int $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @param VisibilityConfig $visibilityConfig 可见性配置值对象
     */
    public function saveVisibilityConfig(
        Authenticatable $authorization,
        int $resourceType,
        string $resourceCode,
        VisibilityConfig $visibilityConfig
    ): void {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);

        // 验证并转换枚举值
        $resourceTypeEnum = ResourceType::make($resourceType);

        // 权限检查
        $this->checkResourceVisibilityPermission($permissionDataIsolation, $resourceTypeEnum);

        // 调用领域服务保存
        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $permissionDataIsolation,
            $resourceTypeEnum,
            $resourceCode,
            $visibilityConfig
        );
    }

    /**
     * 查询可见性配置(高层封装).
     *
     * @param Authenticatable $authorization 当前用户
     * @param int $resourceType 资源类型
     * @param string $resourceCode 资源编码
     */
    public function getVisibilityConfig(
        Authenticatable $authorization,
        int $resourceType,
        string $resourceCode
    ): VisibilityConfig {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $resourceTypeEnum = ResourceType::make($resourceType);

        $this->checkResourceVisibilityPermission($permissionDataIsolation, $resourceTypeEnum);

        // 调用领域服务获取可见性配置
        return $this->resourceVisibilityDomainService->getVisibilityConfig(
            $permissionDataIsolation,
            $resourceTypeEnum,
            $resourceCode
        );
    }

    /**
     * 检查资源可见性配置权限.
     * 根据不同的资源类型进行权限验证.
     */
    private function checkResourceVisibilityPermission(
        PermissionDataIsolation $permissionDataIsolation,
        ResourceType $resourceType
    ): void {
        switch ($resourceType) {
            case ResourceType::SUPER_MAGIC_AGENT:
                $this->checkOrgAdmin($permissionDataIsolation);
                break;
            default:
                break;
        }
    }
}
