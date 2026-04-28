<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\ModelAccessRoleBindingScopeType;
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
        private readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly AdminProviderAppService $adminProviderAppService,
    ) {
    }

    public function meta(PermissionDataIsolation $dataIsolation): array
    {
        $meta = $this->domainService->getMeta($dataIsolation);

        return [
            'permission_control_status' => $meta['permission_control_status']->value,
        ];
    }

    public function updateMeta(PermissionDataIsolation $dataIsolation, PermissionControlStatus $status): array
    {
        $meta = $this->domainService->updatePermissionControlStatus($dataIsolation, $status);

        return [
            'permission_control_status' => $meta['permission_control_status']->value,
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
        $deniedModelIds = [];
        foreach ($result['list'] as $role) {
            $deniedModelIds = [...$deniedModelIds, ...$role->getDeniedModelIds()];
        }

        $deniedModelNameMap = $this->resolveDeniedModelNameMap(
            $dataIsolation,
            $deniedModelIds
        );

        $list = [];
        foreach ($result['list'] as $role) {
            $list[] = [
                'id' => (string) $role->getId(),
                'name' => $role->getName(),
                'description' => $role->getDescription(),
                'model_rule_effect' => 'deny',
                'denied_model_ids' => $role->getDeniedModelIds(),
                'denied_model_names' => array_map(
                    static fn (string $modelId): string => $deniedModelNameMap[$modelId] ?? $modelId,
                    $role->getDeniedModelIds()
                ),
                'denied_model_count' => count($role->getDeniedModelIds()),
                'binding_scope' => $this->buildBindingScopeSummary($role),
                'exclusion_user_count' => count($role->getExcludedUserIds()),
                'exclusion_department_count' => count($role->getExcludedDepartmentIds()),
                'user_count' => $this->domainService->countAssignedUsers($dataIsolation, $role),
                'department_count' => count($role->getDepartmentIds()),
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
        $allUserIds = array_values(array_unique(array_merge($role->getUserIds(), $role->getExcludedUserIds())));
        $allDepartmentIds = array_values(array_unique(array_merge($role->getDepartmentIds(), $role->getExcludedDepartmentIds())));

        $userInfo = $this->magicUserInfoAppService->getBatchUserInfo(
            $allUserIds,
            ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId())
        );
        $contactIsolation = ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $departments = $this->magicDepartmentDomainService->getDepartmentByIds($contactIsolation, $allDepartmentIds, true);
        $departmentFullPaths = $this->magicDepartmentDomainService->getDepartmentFullPathByIds($contactIsolation, $allDepartmentIds);

        $deniedModelNameMap = $this->resolveDeniedModelNameMap($dataIsolation, $role->getDeniedModelIds());

        return [
            'id' => (string) $role->getId(),
            'name' => $role->getName(),
            'description' => $role->getDescription(),
            'model_rule_effect' => 'deny',
            'denied_model_ids' => $role->getDeniedModelIds(),
            'binding_scope' => $this->buildBindingScopeDetail($role, $userInfo, $departments, $departmentFullPaths),
            'exclusion_scope' => $this->buildExclusionScopeDetail($role, $userInfo, $departments, $departmentFullPaths),
            'denied_model_items' => array_map(static function (string $modelId) use ($deniedModelNameMap) {
                return [
                    'model_id' => $modelId,
                    'model_name' => $deniedModelNameMap[$modelId] ?? $modelId,
                ];
            }, $role->getDeniedModelIds()),
            'denied_model_count' => count($role->getDeniedModelIds()),
            'exclusion_user_count' => count($role->getExcludedUserIds()),
            'exclusion_department_count' => count($role->getExcludedDepartmentIds()),
            'user_count' => $this->domainService->countAssignedUsers($dataIsolation, $role),
            'department_count' => count($role->getDepartmentIds()),
            'created_at' => $role->getCreatedAt()?->format('Y-m-d H:i:s'),
            'updated_at' => $role->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    public function createRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): array
    {
        $role = $this->domainService->createRole($dataIsolation, $entity);
        return $this->simpleRoleResponse($dataIsolation, $role);
    }

    public function updateRole(PermissionDataIsolation $dataIsolation, int $roleId, ModelAccessRoleEntity $entity): array
    {
        $role = $this->domainService->updateRole($dataIsolation, $roleId, $entity);
        return [
            ...$this->simpleRoleResponse($dataIsolation, $role),
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
            ], $summary['roles']),
            'denied_model_ids' => $summary['denied_model_ids'],
            'accessible_model_ids' => $summary['accessible_model_ids'],
        ];
    }

    private function simpleRoleResponse(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $role): array
    {
        return [
            'id' => (string) $role->getId(),
            'name' => $role->getName(),
            'description' => $role->getDescription(),
            'model_rule_effect' => 'deny',
            'denied_model_count' => count($role->getDeniedModelIds()),
            'binding_scope' => $this->buildBindingScopeSummary($role),
            'exclusion_user_count' => count($role->getExcludedUserIds()),
            'exclusion_department_count' => count($role->getExcludedDepartmentIds()),
            'user_count' => $this->domainService->countAssignedUsers($dataIsolation, $role),
            'department_count' => count($role->getDepartmentIds()),
        ];
    }

    private function buildBindingScopeSummary(ModelAccessRoleEntity $role): array
    {
        return [
            'type' => $role->isAllUsers()
                ? ModelAccessRoleBindingScopeType::OrganizationAll->value
                : ModelAccessRoleBindingScopeType::Specific->value,
        ];
    }

    private function buildBindingScopeDetail(
        ModelAccessRoleEntity $role,
        array $userInfo,
        array $departments,
        array $departmentFullPaths
    ): array {
        if ($role->isAllUsers()) {
            return [
                'type' => ModelAccessRoleBindingScopeType::OrganizationAll->value,
            ];
        }

        return [
            'type' => ModelAccessRoleBindingScopeType::Specific->value,
            'user_ids' => $role->getUserIds(),
            'department_ids' => $role->getDepartmentIds(),
            'user_items' => array_map(static function (string $userId) use ($userInfo) {
                $item = $userInfo[$userId] ?? ['nickname' => '', 'real_name' => ''];
                return [
                    'user_id' => $userId,
                    'nickname' => $item['nickname'] ?? '',
                    'real_name' => $item['real_name'] ?? '',
                    'avatar_url' => $item['avatar_url'] ?? '',
                ];
            }, $role->getUserIds()),
            'department_items' => array_map(static function (string $departmentId) use ($departments, $departmentFullPaths) {
                $department = $departments[$departmentId] ?? null;
                $path = $departmentFullPaths[$departmentId] ?? [];
                return [
                    'department_id' => $departmentId,
                    'name' => $department?->getName() ?? '',
                    'full_path_name' => implode('/', array_map(static fn ($item) => $item->getName(), $path)),
                ];
            }, $role->getDepartmentIds()),
        ];
    }

    private function buildExclusionScopeDetail(
        ModelAccessRoleEntity $role,
        array $userInfo,
        array $departments,
        array $departmentFullPaths
    ): array {
        return [
            'type' => ModelAccessRoleBindingScopeType::Specific->value,
            'user_ids' => $role->getExcludedUserIds(),
            'department_ids' => $role->getExcludedDepartmentIds(),
            'user_items' => array_map(static function (string $userId) use ($userInfo) {
                $item = $userInfo[$userId] ?? ['nickname' => '', 'real_name' => ''];
                return [
                    'user_id' => $userId,
                    'nickname' => $item['nickname'] ?? '',
                    'real_name' => $item['real_name'] ?? '',
                    'avatar_url' => $item['avatar_url'] ?? '',
                ];
            }, $role->getExcludedUserIds()),
            'department_items' => array_map(static function (string $departmentId) use ($departments, $departmentFullPaths) {
                $department = $departments[$departmentId] ?? null;
                $path = $departmentFullPaths[$departmentId] ?? [];
                return [
                    'department_id' => $departmentId,
                    'name' => $department?->getName() ?? '',
                    'full_path_name' => implode('/', array_map(static fn ($item) => $item->getName(), $path)),
                ];
            }, $role->getExcludedDepartmentIds()),
        ];
    }

    /**
     * @param string[] $modelIds
     * @return array<string, string>
     */
    private function resolveDeniedModelNameMap(PermissionDataIsolation $dataIsolation, array $modelIds): array
    {
        $modelIds = array_values(array_unique($modelIds));
        if ($modelIds === []) {
            return [];
        }

        $modelMap = $this->providerModelDomainService->getModelsByModelIds(
            ProviderDataIsolation::create($dataIsolation->getCurrentOrganizationCode()),
            $modelIds
        );

        $deniedModelNameMap = [];
        foreach ($modelIds as $modelId) {
            $first = $modelMap[$modelId][0] ?? null;
            if ($first !== null) {
                $deniedModelNameMap[$modelId] = $first->getName();
                continue;
            }

            $model = $this->providerModelDomainService->getModelByModelId($modelId);
            if ($model !== null) {
                $deniedModelNameMap[$modelId] = $model->getName();
            }
        }

        return $deniedModelNameMap;
    }
}
