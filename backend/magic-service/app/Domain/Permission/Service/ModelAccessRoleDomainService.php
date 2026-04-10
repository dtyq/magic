<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Db;

readonly class ModelAccessRoleDomainService
{
    public function __construct(
        private ModelAccessRoleRepository $repository,
        private AdminGlobalSettingsRepositoryInterface $adminGlobalSettingsRepository,
        private MagicUserDomainService $magicUserDomainService,
    ) {
    }

    public function getMeta(PermissionDataIsolation $dataIsolation): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $defaultRole = $this->repository->getDefaultRole($organizationCode);
        if (! $defaultRole) {
            return [
                'permission_control_status' => PermissionControlStatus::UNINITIALIZED,
                'default_role' => null,
            ];
        }

        $defaultRole->setModelIds($this->repository->getModelIdsByRoleId($organizationCode, $defaultRole->getId()));

        return [
            'permission_control_status' => $this->resolvePermissionControlStatus($organizationCode),
            'default_role' => $defaultRole,
        ];
    }

    public function updatePermissionControlStatus(PermissionDataIsolation $dataIsolation, PermissionControlStatus $status): array
    {
        if ($status === PermissionControlStatus::UNINITIALIZED) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission control status cannot be set to uninitialized');
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $defaultRole = $this->repository->getDefaultRole($organizationCode);
        if (! $defaultRole) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role required');
        }

        $defaultRole->setModelIds($this->repository->getModelIdsByRoleId($organizationCode, $defaultRole->getId()));
        $this->savePermissionControlSetting($organizationCode, $status);

        return [
            'permission_control_status' => $status,
            'default_role' => $defaultRole,
        ];
    }

    /**
     * @return array{total:int,list:ModelAccessRoleEntity[]}
     */
    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        $result = $this->repository->queries($dataIsolation->getCurrentOrganizationCode(), $page, $filters);
        $this->hydrateRelations($dataIsolation->getCurrentOrganizationCode(), $result['list']);
        return $result;
    }

    public function show(PermissionDataIsolation $dataIsolation, int $roleId): ModelAccessRoleEntity
    {
        $role = $this->repository->getById($dataIsolation->getCurrentOrganizationCode(), $roleId);
        if (! $role) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'model access role not found');
        }

        $this->hydrateRelations($dataIsolation->getCurrentOrganizationCode(), [$role]);
        return $role;
    }

    public function createDefaultRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setIsDefault(true);
        return $this->save($dataIsolation, $entity);
    }

    public function createRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setIsDefault(false);
        return $this->save($dataIsolation, $entity);
    }

    public function updateRole(PermissionDataIsolation $dataIsolation, int $roleId, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $existing = $this->show($dataIsolation, $roleId);
        $entity->setId($roleId);
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setIsDefault($existing->isDefault());
        if ($existing->isDefault()) {
            $entity->setParentRoleId(null);
        }
        return $this->save($dataIsolation, $entity);
    }

    public function destroy(PermissionDataIsolation $dataIsolation, int $roleId): PermissionControlStatus
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $role = $this->show($dataIsolation, $roleId);
        $deleteDefaultRole = $role->isDefault();

        if ($this->repository->countChildren($organizationCode, $roleId) > 0) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'role has children');
        }

        if ($role->isDefault()) {
            if ($this->repository->hasOtherRoles($organizationCode, $roleId)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role must be last to delete');
            }
        }

        Db::transaction(function () use ($organizationCode, $roleId, $deleteDefaultRole) {
            $this->repository->replaceUsers($organizationCode, $roleId, [], '');
            $this->repository->replaceModels($organizationCode, $roleId, [], '');
            $this->repository->delete($organizationCode, $roleId);
            if ($deleteDefaultRole) {
                $this->adminGlobalSettingsRepository->deleteSettingsByTypeAndOrganization(
                    AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL,
                    $organizationCode
                );
            }
        });

        if ($deleteDefaultRole) {
            return PermissionControlStatus::UNINITIALIZED;
        }

        return $this->resolvePermissionControlStatus($organizationCode);
    }

    public function getUserSummary(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $defaultRole = $this->repository->getDefaultRole($organizationCode);
        $roles = [];
        if ($defaultRole) {
            $roles[] = $defaultRole;
        }
        $roles = array_merge($roles, $this->repository->getUserAssignedRoles($organizationCode, $userId));

        $uniqueRoles = [];
        foreach ($roles as $role) {
            $uniqueRoles[$role->getId()] = $role;
        }
        $roles = array_values($uniqueRoles);
        $this->hydrateRelations($organizationCode, $roles);

        $accessibleModelIds = [];
        if ($defaultRole) {
            $visited = [];
            foreach ($roles as $role) {
                foreach ($this->collectInheritedRoleIds($organizationCode, $role, $visited) as $roleId) {
                    $roleModelIds = $this->repository->getModelIdsByRoleId($organizationCode, $roleId);
                    $accessibleModelIds = array_merge($accessibleModelIds, $roleModelIds);
                }
            }
        }

        return [
            'permission_control_status' => $defaultRole ? $this->resolvePermissionControlStatus($organizationCode) : PermissionControlStatus::UNINITIALIZED,
            'roles' => $roles,
            'accessible_model_ids' => array_values(array_unique($accessibleModelIds)),
        ];
    }

    private function save(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $entity->setOrganizationCode($organizationCode);

        $this->validateUsers($organizationCode, $dataIsolation->getCurrentUserId(), $entity->getUserIds());
        $this->validateModels($organizationCode, $entity->getModelIds());
        $this->validateRoleForSave($organizationCode, $entity);

        return Db::transaction(function () use ($dataIsolation, $entity, $organizationCode) {
            if ($entity->shouldCreate()) {
                $entity->prepareForCreation($dataIsolation->getCurrentUserId());
            } else {
                $entity->prepareForModification($dataIsolation->getCurrentUserId());
            }

            $saved = $this->repository->save($entity);
            $this->repository->replaceModels($organizationCode, $saved->getId(), $saved->getModelIds(), $dataIsolation->getCurrentUserId());
            $this->repository->replaceUsers($organizationCode, $saved->getId(), $saved->getUserIds(), $dataIsolation->getCurrentUserId());
            if ($saved->isDefault()) {
                $this->savePermissionControlSetting($organizationCode, PermissionControlStatus::ENABLED);
            }

            return $this->show($dataIsolation, $saved->getId());
        });
    }

    private function resolvePermissionControlStatus(string $organizationCode): PermissionControlStatus
    {
        $setting = $this->adminGlobalSettingsRepository->getSettingsByTypeAndOrganization(
            AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL,
            $organizationCode
        );

        if ($setting === null) {
            return PermissionControlStatus::ENABLED;
        }

        return $setting->getStatus() === AdminGlobalSettingsStatus::DISABLED
            ? PermissionControlStatus::DISABLED
            : PermissionControlStatus::ENABLED;
    }

    private function savePermissionControlSetting(string $organizationCode, PermissionControlStatus $status): void
    {
        $settingStatus = match ($status) {
            PermissionControlStatus::ENABLED => AdminGlobalSettingsStatus::ENABLED,
            PermissionControlStatus::DISABLED => AdminGlobalSettingsStatus::DISABLED,
            PermissionControlStatus::UNINITIALIZED => null,
        };

        if ($settingStatus === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission control status cannot be set to uninitialized');
        }

        $this->adminGlobalSettingsRepository->updateSettings(
            (new AdminGlobalSettingsEntity())
                ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
                ->setOrganization($organizationCode)
                ->setStatus($settingStatus)
        );
    }

    private function validateRoleForSave(string $organizationCode, ModelAccessRoleEntity $entity): void
    {
        $existingByName = $this->repository->getByName($organizationCode, $entity->getName());
        if ($existingByName && $existingByName->getId() !== $entity->getId()) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'role name already exists');
        }

        $defaultRole = $this->repository->getDefaultRole($organizationCode);
        if ($entity->isDefault()) {
            if ($defaultRole && $defaultRole->getId() !== $entity->getId()) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role already exists');
            }
            if (empty($entity->getModelIds())) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role must keep at least one model');
            }
            return;
        }

        if (! $defaultRole) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role required');
        }

        if ($entity->getParentRoleId() === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'parent role is required');
        }

        $this->validateParentChain($organizationCode, $entity, $defaultRole->getId());
    }

    private function validateParentChain(string $organizationCode, ModelAccessRoleEntity $entity, int $defaultRoleId): void
    {
        $currentParentId = $entity->getParentRoleId();
        $visited = [];

        while ($currentParentId !== null) {
            if (isset($visited[$currentParentId]) || $currentParentId === $entity->getId()) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'role cycle detected');
            }
            $visited[$currentParentId] = true;

            $parent = $this->repository->getById($organizationCode, $currentParentId);
            if (! $parent) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'parent role invalid');
            }

            if ($parent->getId() === $defaultRoleId) {
                return;
            }

            $currentParentId = $parent->getParentRoleId();
        }

        ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'parent role must trace to default role');
    }

    private function validateUsers(string $organizationCode, string $operatorUserId, array $userIds): void
    {
        if (empty($userIds)) {
            return;
        }

        $users = $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::create($organizationCode, $operatorUserId),
            $userIds
        );
        if (count($users) !== count(array_unique($userIds))) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'some users not found in organization');
        }
    }

    private function validateModels(string $organizationCode, array $modelIds): void
    {
        // Model access roles store model_id strings directly.
        // Do not validate against provider model records here.
    }

    /**
     * @param ModelAccessRoleEntity[] $roles
     */
    private function hydrateRelations(string $organizationCode, array $roles): void
    {
        if (empty($roles)) {
            return;
        }

        $roleIds = array_values(array_filter(array_map(static fn (ModelAccessRoleEntity $role) => $role->getId(), $roles)));
        $userMap = $this->repository->getRoleUserMap($organizationCode, $roleIds);
        $modelMap = $this->repository->getRoleModelMap($organizationCode, $roleIds);

        foreach ($roles as $role) {
            $role->setUserIds($userMap[$role->getId()] ?? []);
            $role->setModelIds($modelMap[$role->getId()] ?? []);
        }
    }

    /**
     * @return int[]
     */
    private function collectInheritedRoleIds(string $organizationCode, ModelAccessRoleEntity $role, array &$visited): array
    {
        $result = [];
        $current = $role;
        while ($current) {
            if (isset($visited[$current->getId()])) {
                break;
            }
            $visited[$current->getId()] = true;
            $result[] = $current->getId();
            $parentRoleId = $current->getParentRoleId();
            $current = $parentRoleId ? $this->repository->getById($organizationCode, $parentRoleId) : null;
        }
        return $result;
    }
}
