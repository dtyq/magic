<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Admin\Entity\ValueObject\AdminDataIsolation;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Service\AdminGlobalSettingsDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Permission\Entity\FunctionPermissionPolicyEntity;
use App\Domain\Permission\Entity\ValueObject\BindingScopeType;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\FunctionPermissionPolicyRepository;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use RuntimeException;

readonly class FunctionPermissionDomainService
{
    public function __construct(
        private FunctionPermissionPolicyRepository $repository,
        private AdminGlobalSettingsDomainService $adminGlobalSettingsDomainService,
        private MagicDepartmentUserDomainService $departmentUserDomainService,
    ) {
    }

    public function getPermissionControlStatus(PermissionDataIsolation $dataIsolation): PermissionControlStatus
    {
        $adminIsolation = AdminDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getMagicId()
        );
        $setting = $this->adminGlobalSettingsDomainService->getSettingsByType(
            AdminGlobalSettingsType::FUNCTION_PERMISSION_CONTROL,
            $adminIsolation
        );

        $status = $setting->getStatus();
        return $status === AdminGlobalSettingsStatus::ENABLED
            ? PermissionControlStatus::ENABLED
            : PermissionControlStatus::DISABLED;
    }

    public function updatePermissionControlStatus(
        PermissionDataIsolation $dataIsolation,
        PermissionControlStatus $status
    ): PermissionControlStatus {
        $adminIsolation = AdminDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getMagicId()
        );
        $setting = $this->adminGlobalSettingsDomainService->getSettingsByType(
            AdminGlobalSettingsType::FUNCTION_PERMISSION_CONTROL,
            $adminIsolation
        );
        $setting->setStatus(
            $status === PermissionControlStatus::ENABLED
                ? AdminGlobalSettingsStatus::ENABLED
                : AdminGlobalSettingsStatus::DISABLED
        );
        $this->adminGlobalSettingsDomainService->updateSettings($setting, $adminIsolation);

        return $status;
    }

    public function getPolicyByFunctionCode(
        PermissionDataIsolation $dataIsolation,
        string $functionCode
    ): ?FunctionPermissionPolicyEntity {
        return $this->repository->getByFunctionCode($dataIsolation, $functionCode);
    }

    /**
     * @return array<string, FunctionPermissionPolicyEntity>
     */
    public function listPolicies(PermissionDataIsolation $dataIsolation): array
    {
        return $this->repository->listByOrganization($dataIsolation);
    }

    public function savePolicy(
        PermissionDataIsolation $dataIsolation,
        FunctionPermissionPolicyEntity $entity
    ): FunctionPermissionPolicyEntity {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $existing = $this->repository->getByFunctionCode($dataIsolation, $entity->getFunctionCode());
        if ($existing !== null) {
            $entity->setId($existing->getId());
            $entity->setCreatedAt($existing->getCreatedAt());
            $entity->prepareForModification();
        } else {
            $entity->prepareForCreation();
        }

        return $this->repository->save($entity);
    }

    public function updatePolicyEnabled(
        PermissionDataIsolation $dataIsolation,
        string $functionCode,
        bool $enabled,
        array $defaultBindingScope
    ): FunctionPermissionPolicyEntity {
        $normalizedDefaultBindingScope = FunctionPermissionPolicyEntity::normalizeValidatedBindingScope($defaultBindingScope);
        $existing = $this->repository->getByFunctionCode($dataIsolation, $functionCode);
        if ($existing === null) {
            if (! $enabled) {
                $entity = new FunctionPermissionPolicyEntity();
                $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
                $entity->setFunctionCode($functionCode);
                $entity->setEnabled(false);
                $entity->setBindingScope($normalizedDefaultBindingScope);
                $entity->setRemark(null);

                return $entity;
            }

            $entity = new FunctionPermissionPolicyEntity();
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $entity->setFunctionCode($functionCode);
            $entity->setEnabled(true);
            $entity->setBindingScope($normalizedDefaultBindingScope);
            $entity->setRemark(null);
            $entity->prepareForCreation();

            return $this->repository->save($entity);
        }

        if ($enabled) {
            try {
                $existing->setBindingScope(
                    FunctionPermissionPolicyEntity::normalizeValidatedBindingScope($existing->getBindingScope())
                );
            } catch (BusinessException $exception) {
                ExceptionBuilder::throw(
                    PermissionErrorCode::ValidateFailed,
                    'current binding_scope is invalid, please use full save api',
                    throwable: $exception
                );
            }

            $existing->setEnabled(true);
            $existing->prepareForModification();

            return $this->repository->save($existing);
        }

        return $this->repository->updateEnabled(
            $dataIsolation->getCurrentOrganizationCode(),
            $functionCode,
            $enabled
        ) ?? throw new RuntimeException('function permission policy not found when updating enabled');
    }

    /**
     * @param array<FunctionPermissionPolicyEntity> $entities
     * @return array<FunctionPermissionPolicyEntity>
     */
    public function saveBatch(PermissionDataIsolation $dataIsolation, array $entities): array
    {
        foreach ($entities as $entity) {
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $existing = $this->repository->getByFunctionCode($dataIsolation, $entity->getFunctionCode());
            if ($existing !== null) {
                $entity->setId($existing->getId());
                $entity->setCreatedAt($existing->getCreatedAt());
                $entity->prepareForModification();
            } else {
                $entity->prepareForCreation();
            }
        }

        return $this->repository->saveBatch($entities);
    }

    /**
     * @return array<string, bool>
     */
    public function getUserAllowedFunctions(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        $status = $this->getPermissionControlStatus($dataIsolation);
        $catalog = array_keys(FunctionPermissionCatalog::definitions());

        if ($status === PermissionControlStatus::DISABLED) {
            return array_fill_keys($catalog, true);
        }

        $policyMap = $this->listPolicies($dataIsolation);
        $userDepartmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            $userId,
            true
        );

        $allowed = [];
        foreach ($catalog as $functionCode) {
            $policy = $policyMap[$functionCode] ?? null;
            $allowed[$functionCode] = $this->isFunctionAllowed($policy, $userId, $userDepartmentIds);
        }

        return $allowed;
    }

    public function checkPermission(PermissionDataIsolation $dataIsolation, string $userId, string $functionCode): bool
    {
        if (! FunctionPermissionCatalog::exists($functionCode)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid function code');
        }

        $status = $this->getPermissionControlStatus($dataIsolation);
        if ($status === PermissionControlStatus::DISABLED) {
            return true;
        }

        $policy = $this->getPolicyByFunctionCode($dataIsolation, $functionCode);
        if ($policy === null || ! $policy->getEnabled()) {
            return true;
        }

        $bindingScope = $policy->getBindingScope();
        $scopeType = (string) ($bindingScope['type'] ?? BindingScopeType::OrganizationAll->value);
        if ($scopeType === BindingScopeType::OrganizationAll->value) {
            return true;
        }

        $userIds = $this->normalizeBindingScopeIds($bindingScope['user_ids'] ?? []);
        if ($userIds !== [] && in_array($userId, $userIds, true)) {
            return true;
        }

        $departmentIds = $this->normalizeBindingScopeIds($bindingScope['department_ids'] ?? []);
        if ($departmentIds === []) {
            return false;
        }

        $userDepartmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
            $userId,
            true
        );

        return array_intersect($departmentIds, $userDepartmentIds) !== [];
    }

    private function isFunctionAllowed(
        ?FunctionPermissionPolicyEntity $policy,
        string $userId,
        array $userDepartmentIds
    ): bool {
        if ($policy === null) {
            return true;
        }

        if (! $policy->getEnabled()) {
            return true;
        }

        $bindingScope = $policy->getBindingScope();
        $scopeType = (string) ($bindingScope['type'] ?? BindingScopeType::OrganizationAll->value);
        if ($scopeType === BindingScopeType::OrganizationAll->value) {
            return true;
        }

        $userIds = $this->normalizeBindingScopeIds($bindingScope['user_ids'] ?? []);
        if ($userIds !== [] && in_array($userId, $userIds, true)) {
            return true;
        }

        $departmentIds = $this->normalizeBindingScopeIds($bindingScope['department_ids'] ?? []);
        if ($departmentIds !== [] && array_intersect($departmentIds, $userDepartmentIds) !== []) {
            return true;
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function normalizeBindingScopeIds(mixed $ids): array
    {
        if (! is_array($ids)) {
            return [];
        }

        $normalizedIds = [];
        foreach ($ids as $id) {
            $normalizedIds[] = (string) $id;
        }

        return $normalizedIds;
    }
}
