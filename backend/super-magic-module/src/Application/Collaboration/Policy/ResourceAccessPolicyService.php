<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Collaboration\Policy;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 资源访问策略服务。
 *
 * 负责统一封装 Agent / Skill 这类对外资源的读、写、管理、删除权限判定，
 * 对上层屏蔽 operation_permissions 与 resource_visibility 的组合细节。
 */
class ResourceAccessPolicyService extends AbstractKernelAppService
{
    /**
     * 聚合权限域与可见域能力，对上层暴露统一的资源访问策略。
     */
    public function __construct(
        private readonly OperationPermissionDomainService $operationPermissionDomainService,
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
    ) {
    }

    /**
     * 校验当前用户是否对指定资源具备读取权限。
     *
     * 读取权限采用 V ∪ O：
     * - V：资源可见性配置
     * - O：operation_permissions 显式授权
     *
     * @param array<string> $skipReadableCodes
     */
    public function assertReadable(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $operationResourceType,
        ResourceVisibilityResourceType $visibilityResourceType,
        string $code,
        array $skipReadableCodes = []
    ): void {
        // 内置资源等少数场景不走 op/visibility 判定，这里允许调用方透传白名单跳过。
        if (in_array($code, $skipReadableCodes, true)) {
            return;
        }

        $readableCodes = $this->getReadableResourceCodes($authorization, $operationResourceType, $visibilityResourceType, [$code]);
        if (in_array($code, $readableCodes['all_codes'], true)) {
            return;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
    }

    /**
     * 校验当前用户是否对资源具备编辑权限。
     */
    public function assertEditable(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $resourceType,
        string $code
    ): void {
        $this->assertOperation($authorization, $resourceType, $code, 'edit');
    }

    /**
     * 校验当前用户是否对资源具备协作者管理权限。
     */
    public function assertManageable(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $resourceType,
        string $code
    ): void {
        $this->assertOperation($authorization, $resourceType, $code, 'manage');
    }

    /**
     * 校验当前用户是否对资源具备删除权限。
     */
    public function assertDeletable(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $resourceType,
        string $code
    ): void {
        $this->assertOperation($authorization, $resourceType, $code, 'delete');
    }

    /**
     * 获取当前用户可读取的资源 code 集合。
     *
     * 该方法是列表场景的基础能力，用于把 visibility 与 operation_permissions
     * 合并成统一的可读资源集合。
     *
     * @param array<string> $resourceCodes
     * @return array{
     *     operation_codes: array<string>,
     *     visibility_codes: array<string>,
     *     all_codes: array<string>
     * }
     */
    public function getReadableResourceCodes(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $operationResourceType,
        ResourceVisibilityResourceType $visibilityResourceType,
        array $resourceCodes = []
    ): array {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $currentUserId = $permissionDataIsolation->getCurrentUserId();

        // 读权限采用 V ∪ O：visibility 负责公开可见，operation_permissions 负责显式协作授权。
        $visibilityCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionDataIsolation,
            $currentUserId,
            $visibilityResourceType,
            $resourceCodes
        );
        /** @var array<string> $visibilityCodes */
        $operationMap = $this->operationPermissionDomainService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            $operationResourceType,
            [$currentUserId],
            $resourceCodes
        );
        /** @var array<string> $operationCodes */
        $operationCodes = array_keys($operationMap[$currentUserId] ?? []);

        return [
            'operation_codes' => $operationCodes,
            'visibility_codes' => $visibilityCodes,
            'all_codes' => array_values(array_unique(array_merge($visibilityCodes, $operationCodes))),
        ];
    }

    /**
     * 获取当前用户对指定资源的最高操作权限。
     *
     * 若没有任何显式操作权限记录，则返回 null。
     */
    public function getCurrentOperation(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $resourceType,
        string $code
    ): ?Operation {
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $currentUserId = $permissionDataIsolation->getCurrentUserId();
        $operationMap = $this->operationPermissionDomainService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            $resourceType,
            [$currentUserId],
            [$code]
        );

        return $operationMap[$currentUserId][$code] ?? null;
    }

    /**
     * 执行通用操作权限校验。
     *
     * 该方法用于收敛 edit / manage / delete 等写操作的统一判定逻辑。
     */
    private function assertOperation(
        Authenticatable|BaseDataIsolation $authorization,
        OperationResourceType $resourceType,
        string $code,
        string $operation
    ): void {
        // 写、管理、删除都统一收敛到 operation_permissions 的最高权限判定。
        $currentOperation = $this->getCurrentOperation($authorization, $resourceType, $code);
        if ($currentOperation === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        $currentOperation->validate($operation, $code);
    }
}
