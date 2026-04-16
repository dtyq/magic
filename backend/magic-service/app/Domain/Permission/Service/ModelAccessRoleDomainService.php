<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Application\Kernel\EnvManager;
use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Db;

readonly class ModelAccessRoleDomainService
{
    public function __construct(
        private ModelAccessRoleRepository $repository,
        private AdminGlobalSettingsRepositoryInterface $adminGlobalSettingsRepository,
        private MagicDepartmentDomainService $magicDepartmentDomainService,
        private MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private MagicUserDomainService $magicUserDomainService,
        private ProviderModelDomainService $providerModelDomainService,
    ) {
    }

    public function getMeta(PermissionDataIsolation $dataIsolation): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        return [
            'permission_control_status' => $this->resolvePermissionControlStatus($organizationCode),
        ];
    }

    public function updatePermissionControlStatus(PermissionDataIsolation $dataIsolation, PermissionControlStatus $status): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $this->savePermissionControlSetting($organizationCode, $status);

        return [
            'permission_control_status' => $status,
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

    public function createRole(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        return $this->save($dataIsolation, $entity);
    }

    public function updateRole(PermissionDataIsolation $dataIsolation, int $roleId, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $existing = $this->show($dataIsolation, $roleId);
        $entity->setId($roleId);
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setCreatedAt($existing->getCreatedAt());
        $entity->setCreatedUid($existing->getCreatedUid());
        return $this->save($dataIsolation, $entity);
    }

    public function destroy(PermissionDataIsolation $dataIsolation, int $roleId): PermissionControlStatus
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $this->show($dataIsolation, $roleId);

        Db::transaction(function () use ($organizationCode, $roleId) {
            $this->repository->replaceBindings($organizationCode, $roleId, [], [], false, '');
            $this->repository->replaceDeniedModels($organizationCode, $roleId, [], '');
            $this->repository->delete($organizationCode, $roleId);
        });

        return $this->resolvePermissionControlStatus($organizationCode);
    }

    public function getUserSummary(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $contactIsolation = ContactDataIsolation::create($organizationCode, $dataIsolation->getCurrentUserId());
        $userDepartmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($contactIsolation, $userId, true);
        $roles = $this->repository->getUserAssignedRoles($organizationCode, $userId, $userDepartmentIds);

        $uniqueRoles = [];
        foreach ($roles as $role) {
            $uniqueRoles[$role->getId()] = $role;
        }
        $roles = array_values($uniqueRoles);
        $this->hydrateRelations($organizationCode, $roles);

        $status = $this->resolvePermissionControlStatus($organizationCode);
        $availableModelIds = $this->resolveOrganizationAvailableModelIds($dataIsolation);
        $deniedModelIds = [];
        $accessibleModelIds = $availableModelIds;

        if ($status === PermissionControlStatus::ENABLED) {
            $deniedModelIdMap = [];
            foreach ($roles as $role) {
                $roleModelIds = $this->repository->getDeniedModelIdsByRoleId($organizationCode, $role->getId());
                foreach ($roleModelIds as $modelId) {
                    $deniedModelIdMap[$modelId] = true;
                }
            }

            $deniedModelIds = array_values(array_filter(
                $availableModelIds,
                static fn (string $modelId): bool => isset($deniedModelIdMap[$modelId])
            ));
            $accessibleModelIds = array_values(array_filter(
                $availableModelIds,
                static fn (string $modelId): bool => ! isset($deniedModelIdMap[$modelId])
            ));
        }

        return [
            'permission_control_status' => $status,
            'roles' => $roles,
            'denied_model_ids' => $deniedModelIds,
            'accessible_model_ids' => array_values(array_unique($accessibleModelIds)),
        ];
    }

    public function countAssignedUsers(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $role): int
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        if ($role->isAllUsers()) {
            return $this->repository->countOrganizationUsers($organizationCode);
        }

        $userIdMap = array_fill_keys($role->getUserIds(), true);
        if (! empty($role->getDepartmentIds())) {
            $contactIsolation = ContactDataIsolation::create($organizationCode, $dataIsolation->getCurrentUserId());
            $departmentIds = $this->magicDepartmentDomainService->getAllChildrenByDepartmentIds($role->getDepartmentIds(), $contactIsolation);
            foreach ($this->repository->getDistinctUserIdsByDepartmentIds($organizationCode, $departmentIds) as $userId) {
                $userIdMap[$userId] = true;
            }
        }

        return count($userIdMap);
    }

    private function save(PermissionDataIsolation $dataIsolation, ModelAccessRoleEntity $entity): ModelAccessRoleEntity
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $entity->setOrganizationCode($organizationCode);

        $this->validateUsers($organizationCode, $dataIsolation->getCurrentUserId(), $entity->getUserIds());
        $this->validateDepartments($organizationCode, $dataIsolation->getCurrentUserId(), $entity->getDepartmentIds());
        $this->validateModels($dataIsolation, $entity->getDeniedModelIds());
        $this->validateRoleForSave($organizationCode, $entity);

        return Db::transaction(function () use ($dataIsolation, $entity, $organizationCode) {
            if ($entity->shouldCreate()) {
                $entity->prepareForCreation($dataIsolation->getCurrentUserId());
            } else {
                $entity->prepareForModification($dataIsolation->getCurrentUserId());
            }

            $saved = $this->repository->save($entity);
            $this->repository->replaceDeniedModels($organizationCode, $saved->getId(), $saved->getDeniedModelIds(), $dataIsolation->getCurrentUserId());
            $this->repository->replaceBindings(
                $organizationCode,
                $saved->getId(),
                $saved->getUserIds(),
                $saved->getDepartmentIds(),
                $saved->isAllUsers(),
                $dataIsolation->getCurrentUserId()
            );
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
            return PermissionControlStatus::DISABLED;
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
        };

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

    private function validateDepartments(string $organizationCode, string $operatorUserId, array $departmentIds): void
    {
        if (empty($departmentIds)) {
            return;
        }

        $departments = $this->magicDepartmentDomainService->getDepartmentByIds(
            ContactDataIsolation::create($organizationCode, $operatorUserId),
            $departmentIds,
            true
        );
        if (count($departments) !== count(array_unique($departmentIds))) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'some departments not found in organization');
        }
    }

    private function validateModels(PermissionDataIsolation $dataIsolation, array $modelIds): void
    {
        if (empty($modelIds)) {
            return;
        }

        $availableModelIdMap = array_fill_keys($this->resolveOrganizationAvailableModelIds($dataIsolation), true);
        foreach ($modelIds as $modelId) {
            if (! isset($availableModelIdMap[$modelId])) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'some models are not available in organization');
            }
        }
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
        $bindingMap = $this->repository->getRoleBindingMap($organizationCode, $roleIds);
        $modelMap = $this->repository->getRoleDeniedModelMap($organizationCode, $roleIds);

        foreach ($roles as $role) {
            $bindings = $bindingMap[$role->getId()] ?? [
                'user_ids' => [],
                'department_ids' => [],
                'all_users' => false,
            ];
            $role->setUserIds($bindings['user_ids']);
            $role->setDepartmentIds($bindings['department_ids']);
            $role->setAllUsers($bindings['all_users']);
            $role->setDeniedModelIds($modelMap[$role->getId()] ?? []);
        }
    }

    /**
     * @return list<string>
     */
    private function resolveOrganizationAvailableModelIds(PermissionDataIsolation $dataIsolation): array
    {
        $providerDataIsolation = ProviderDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getMagicId()
        );

        $models = $this->providerModelDomainService->getEnableModels($providerDataIsolation);
        if (empty($models)) {
            return [];
        }

        if ($dataIsolation->getMagicId() === '') {
            $result = [];
            foreach ($models as $model) {
                $result[$model->getModelId()] = $model->getModelId();
            }
            return array_values($result);
        }

        $modelGatewayDataIsolation = new ModelGatewayDataIsolation(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getMagicId()
        );
        EnvManager::initDataIsolationEnv($modelGatewayDataIsolation, force: true);
        $subscriptionAvailableModelIds = $modelGatewayDataIsolation->getSubscriptionManager()->getAvailableModelIds(null);
        $subscriptionAvailableModelIdMap = is_array($subscriptionAvailableModelIds)
            ? array_fill_keys($subscriptionAvailableModelIds, true)
            : null;

        $result = [];
        foreach ($models as $model) {
            $modelId = $model->getModelId();
            if ($subscriptionAvailableModelIdMap !== null && ! isset($subscriptionAvailableModelIdMap[$modelId])) {
                continue;
            }
            if (! isset($result[$modelId])) {
                $result[$modelId] = $modelId;
            }
        }

        return array_values($result);
    }
}
