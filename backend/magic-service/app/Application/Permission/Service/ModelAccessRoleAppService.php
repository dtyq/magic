<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class ModelAccessRoleAppService extends AbstractPermissionAppService
{
    public function __construct(
        private readonly ModelAccessRoleDomainService $domainService,
        private readonly MagicUserInfoAppService $magicUserInfoAppService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly AdminProviderAppService $adminProviderAppService,
    ) {
    }

    public function meta(PermissionDataIsolation $dataIsolation): array
    {
        $meta = $this->domainService->getMeta($dataIsolation);
        $defaultRole = $meta['default_role'];

        return [
            'permission_control_status' => $meta['permission_control_status']->value,
            'default_role' => $defaultRole ? [
                'id' => (string) $defaultRole->getId(),
                'name' => $defaultRole->getName(),
                'model_count' => count($defaultRole->getModelIds()),
            ] : null,
        ];
    }

    public function updateMeta(PermissionDataIsolation $dataIsolation, PermissionControlStatus $status): array
    {
        $meta = $this->domainService->updatePermissionControlStatus($dataIsolation, $status);
        $defaultRole = $meta['default_role'];

        return [
            'permission_control_status' => $meta['permission_control_status']->value,
            'default_role' => $defaultRole ? [
                'id' => (string) $defaultRole->getId(),
                'name' => $defaultRole->getName(),
                'model_count' => count($defaultRole->getModelIds()),
            ] : null,
        ];
    }

    /**
     * @param ModelType[] $modelTypes
     */
    public function availableModels(
        MagicUserAuthorization $authorization,
        ?Category $category = null,
        array $modelTypes = []
    ): array {
        return $this->adminProviderAppService->getAvailableModelsForOrganization(
            $authorization,
            $category,
            $modelTypes
        );
    }

    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        $result = $this->domainService->queries($dataIsolation, $page, $filters);
        $roleIds = array_map(static fn (ModelAccessRoleEntity $role) => $role->getId(), $result['list']);
        $roleMap = [];
        foreach ($result['list'] as $role) {
            $roleMap[$role->getId()] = $role;
        }

        $list = [];
        foreach ($result['list'] as $role) {
            $parent = $role->getParentRoleId() ? ($roleMap[$role->getParentRoleId()] ?? $this->domainService->show($dataIsolation, $role->getParentRoleId())) : null;
            $list[] = [
                'id' => (string) $role->getId(),
                'name' => $role->getName(),
                'description' => $role->getDescription(),
                'is_default' => $role->isDefault(),
                'parent_role_id' => $role->getParentRoleId() === null ? null : (string) $role->getParentRoleId(),
                'parent_role_name' => $parent?->getName(),
                'model_ids' => $role->getModelIds(),
                'model_count' => count($role->getModelIds()),
                'user_count' => count($role->getUserIds()),
                'created_at' => $role->getCreatedAt()?->format('Y-m-d H:i:s'),
                'updated_at' => $role->getUpdatedAt()?->format('Y-m-d H:i:s'),
            ];
        }

        return [
            'list' => $list,
            'total' => $result['total'],
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
        ];
    }

    public function detail(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        $role = $this->domainService->show($dataIsolation, $roleId);

        $userInfo = $this->magicUserInfoAppService->getBatchUserInfo(
            $role->getUserIds(),
            ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId())
        );

        $modelMap = $this->providerModelDomainService->getModelsByModelIds(
            ProviderDataIsolation::create($dataIsolation->getCurrentOrganizationCode()),
            $role->getModelIds()
        );
        $fallbackModelNames = [];
        foreach ($role->getModelIds() as $modelId) {
            if (isset($modelMap[$modelId][0])) {
                continue;
            }
            $model = $this->providerModelDomainService->getModelByModelId($modelId);
            if ($model !== null) {
                $fallbackModelNames[$modelId] = $model->getName();
            }
        }

        $parentName = null;
        if ($role->getParentRoleId()) {
            $parentName = $this->domainService->show($dataIsolation, $role->getParentRoleId())->getName();
        }

        return [
            'id' => (string) $role->getId(),
            'name' => $role->getName(),
            'description' => $role->getDescription(),
            'is_default' => $role->isDefault(),
            'parent_role_id' => $role->getParentRoleId() === null ? null : (string) $role->getParentRoleId(),
            'parent_role_name' => $parentName,
            'inherited_path' => $this->buildInheritedPath($dataIsolation, $role),
            'model_ids' => $role->getModelIds(),
            'user_ids' => $role->getUserIds(),
            'model_items' => array_map(static function (string $modelId) use ($modelMap, $fallbackModelNames) {
                $first = $modelMap[$modelId][0] ?? null;
                return [
                    'model_id' => $modelId,
                    'model_name' => $first?->getName() ?? ($fallbackModelNames[$modelId] ?? $modelId),
                ];
            }, $role->getModelIds()),
            'user_items' => array_map(static function (string $userId) use ($userInfo) {
                $item = $userInfo[$userId] ?? ['nickname' => '', 'real_name' => ''];
                return [
                    'user_id' => $userId,
                    'nickname' => $item['nickname'] ?? '',
                    'real_name' => $item['real_name'] ?? '',
                    'avatar_url' => $item['avatar_url'] ?? '',
                ];
            }, $role->getUserIds()),
            'model_count' => count($role->getModelIds()),
            'user_count' => count($role->getUserIds()),
            'created_at' => $role->getCreatedAt()?->format('Y-m-d H:i:s'),
            'updated_at' => $role->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    public function createDefaultRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): array
    {
        $role = $this->domainService->createDefaultRole($dataIsolation, $entity);
        return [
            ...$this->simpleRoleResponse($role),
            'permission_control_status' => PermissionControlStatus::ENABLED->value,
        ];
    }

    public function createRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): array
    {
        $role = $this->domainService->createRole($dataIsolation, $entity);
        return $this->simpleRoleResponse($role);
    }

    public function updateRole(PermissionDataIsolation $dataIsolation, int $roleId, ModelAccessRoleEntity $entity): array
    {
        $role = $this->domainService->updateRole($dataIsolation, $roleId, $entity);
        return [
            ...$this->simpleRoleResponse($role),
            'updated_at' => $role->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    public function destroy(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        $status = $this->domainService->destroy($dataIsolation, $roleId);
        return [
            'success' => true,
            'permission_control_status' => $status->value,
        ];
    }

    public function userSummary(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        $summary = $this->domainService->getUserSummary($dataIsolation, $userId);
        return [
            'permission_control_status' => $summary['permission_control_status']->value,
            'user_id' => $userId,
            'roles' => array_map(static fn (ModelAccessRoleEntity $role) => [
                'id' => (string) $role->getId(),
                'name' => $role->getName(),
                'is_default' => $role->isDefault(),
            ], $summary['roles']),
            'accessible_model_ids' => $summary['accessible_model_ids'],
        ];
    }

    private function simpleRoleResponse(ModelAccessRoleEntity $role): array
    {
        return [
            'id' => (string) $role->getId(),
            'name' => $role->getName(),
            'description' => $role->getDescription(),
            'is_default' => $role->isDefault(),
            'parent_role_id' => $role->getParentRoleId() === null ? null : (string) $role->getParentRoleId(),
            'model_count' => count($role->getModelIds()),
            'user_count' => count($role->getUserIds()),
        ];
    }

    private function buildInheritedPath(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $role): array
    {
        $path = [];
        $current = $role;
        while ($current) {
            array_unshift($path, [
                'id' => (string) $current->getId(),
                'name' => $current->getName(),
            ]);
            $parentRoleId = $current->getParentRoleId();
            $current = $parentRoleId ? $this->domainService->show($dataIsolation, $parentRoleId) : null;
        }
        return $path;
    }
}
