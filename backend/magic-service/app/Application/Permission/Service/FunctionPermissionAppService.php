<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Permission\Entity\FunctionPermissionPolicyEntity;
use App\Domain\Permission\Entity\ValueObject\BindingScopeType;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\FunctionPermissionCatalog;
use App\Domain\Permission\Service\FunctionPermissionDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

use function Hyperf\Translation\__;

class FunctionPermissionAppService extends AbstractPermissionAppService
{
    public function __construct(
        private readonly FunctionPermissionDomainService $domainService,
        private readonly MagicDepartmentDomainService $departmentDomainService,
        private readonly MagicUserInfoAppService $magicUserInfoAppService,
    ) {
    }

    public function catalog(): array
    {
        return array_map($this->resolveCatalogItem(...), FunctionPermissionCatalog::list());
    }

    public function queries(PermissionDataIsolation $dataIsolation): array
    {
        $policyMap = $this->domainService->listPolicies($dataIsolation);
        $settingsStatus = $this->domainService->getPermissionControlStatus($dataIsolation);

        $list = [];
        foreach (FunctionPermissionCatalog::list() as $item) {
            $item = $this->resolveCatalogItem($item);
            $policy = $policyMap[$item['function_code']] ?? null;
            $list[] = $this->buildItem($item, $policy, $settingsStatus);
        }

        return [
            'permission_control_status' => $settingsStatus->value,
            'list' => $list,
        ];
    }

    public function settings(PermissionDataIsolation $dataIsolation): array
    {
        return [
            'permission_control_status' => $this->domainService->getPermissionControlStatus($dataIsolation)->value,
        ];
    }

    public function show(PermissionDataIsolation $dataIsolation, string $functionCode): array
    {
        $catalog = FunctionPermissionCatalog::find($functionCode);
        if ($catalog === []) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid function code');
        }
        $catalog = $this->resolveCatalogItem($catalog);

        $policy = $this->domainService->getPolicyByFunctionCode($dataIsolation, $functionCode);
        $settingStatus = $this->domainService->getPermissionControlStatus($dataIsolation);

        return [
            'permission_control_status' => $settingStatus->value,
            'function' => $this->buildDetailItem($catalog, $policy),
        ];
    }

    public function save(
        PermissionDataIsolation $dataIsolation,
        string $functionCode,
        bool $enabled,
        array $bindingScope,
        ?string $remark = null
    ): array {
        $catalog = FunctionPermissionCatalog::find($functionCode);
        if ($catalog === []) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid function code');
        }
        $catalog = $this->resolveCatalogItem($catalog);

        $entity = new FunctionPermissionPolicyEntity();
        $entity->setFunctionCode($functionCode);
        $entity->setEnabled($enabled);
        $entity->setBindingScope($bindingScope);
        $entity->setRemark($remark);

        $savedEntity = $this->domainService->savePolicy($dataIsolation, $entity);

        return $this->buildDetailItem($catalog, $savedEntity);
    }

    public function updateEnabled(
        PermissionDataIsolation $dataIsolation,
        string $functionCode,
        bool $enabled
    ): array {
        $catalog = FunctionPermissionCatalog::find($functionCode);
        if ($catalog === []) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid function code');
        }
        $catalog = $this->resolveCatalogItem($catalog);

        $savedEntity = $this->domainService->updatePolicyEnabled(
            $dataIsolation,
            $functionCode,
            $enabled,
            is_array($catalog['default_binding_scope'] ?? null) ? $catalog['default_binding_scope'] : []
        );

        return $this->buildDetailItem($catalog, $savedEntity);
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function batchSave(PermissionDataIsolation $dataIsolation, array $items): array
    {
        $entities = [];
        foreach ($items as $item) {
            $functionCode = (string) ($item['function_code'] ?? '');
            $catalog = FunctionPermissionCatalog::find($functionCode);
            if ($catalog === []) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid function code');
            }

            $entity = new FunctionPermissionPolicyEntity();
            $entity->setFunctionCode($functionCode);
            $enabled = filter_var($item['enabled'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            $entity->setEnabled($enabled ?? false);
            $entity->setBindingScope(is_array($item['binding_scope'] ?? null) ? $item['binding_scope'] : []);
            $entity->setRemark(isset($item['remark']) ? (string) $item['remark'] : null);
            $entities[] = $entity;
        }

        $savedEntities = $this->domainService->saveBatch($dataIsolation, $entities);
        $policyMap = $this->domainService->listPolicies($dataIsolation);
        $settingsStatus = $this->domainService->getPermissionControlStatus($dataIsolation);

        $list = [];
        foreach (FunctionPermissionCatalog::list() as $item) {
            $item = $this->resolveCatalogItem($item);
            $policy = $policyMap[$item['function_code']] ?? null;
            $list[] = $this->buildItem($item, $policy, $settingsStatus);
        }

        return [
            'permission_control_status' => $settingsStatus->value,
            'list' => $list,
            'saved_count' => count($savedEntities),
        ];
    }

    public function updateSettings(PermissionDataIsolation $dataIsolation, PermissionControlStatus $status): array
    {
        $savedStatus = $this->domainService->updatePermissionControlStatus($dataIsolation, $status);

        return [
            'permission_control_status' => $savedStatus->value,
        ];
    }

    /**
     * @return array<string, bool>
     */
    public function getUserPermissions(MagicUserAuthorization $authorization): array
    {
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );

        return $this->domainService->getUserAllowedFunctions($dataIsolation, $authorization->getId());
    }

    public function checkPermission(MagicUserAuthorization $authorization, string $functionCode): bool
    {
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );

        return $this->domainService->checkPermission($dataIsolation, $authorization->getId(), $functionCode);
    }

    private function buildItem(array $catalog, ?FunctionPermissionPolicyEntity $policy, PermissionControlStatus $status): array
    {
        $enabled = $policy?->getEnabled() ?? false;
        $bindingScope = $policy?->getBindingScope() ?? $catalog['default_binding_scope'];

        return [
            'function_code' => $catalog['function_code'],
            'function_name' => $catalog['function_name'],
            'module_code' => $catalog['module_code'],
            'module_name' => $catalog['module_name'],
            'description' => $catalog['description'],
            'enabled' => $enabled,
            'binding_scope' => $bindingScope,
            'binding_scope_label' => $this->buildBindingScopeLabel($enabled, $bindingScope),
            'remark' => $policy?->getRemark(),
            'permission_control_status' => $status->value,
            'updated_at' => $policy?->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    private function buildDetailItem(array $catalog, ?FunctionPermissionPolicyEntity $policy): array
    {
        $bindingScope = $policy?->getBindingScope() ?? $catalog['default_binding_scope'];
        $detail = [
            'function_code' => $catalog['function_code'],
            'function_name' => $catalog['function_name'],
            'module_code' => $catalog['module_code'],
            'module_name' => $catalog['module_name'],
            'description' => $catalog['description'],
            'enabled' => $policy?->getEnabled() ?? false,
            'binding_scope' => $bindingScope,
            'binding_scope_label' => $this->buildBindingScopeLabel($policy?->getEnabled() ?? false, $bindingScope),
            'remark' => $policy?->getRemark(),
            'updated_at' => $policy?->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];

        if (($bindingScope['type'] ?? '') !== BindingScopeType::Specific->value) {
            return $detail;
        }

        $userIds = array_values(array_map('strval', $bindingScope['user_ids'] ?? []));
        $departmentIds = array_values(array_map('strval', $bindingScope['department_ids'] ?? []));

        $userItems = $this->buildUserItems($policy?->getOrganizationCode() ?? '', $userIds);
        $departmentItems = $this->buildDepartmentItems($policy?->getOrganizationCode() ?? '', $departmentIds);

        $detail['binding_scope'] = [
            'type' => BindingScopeType::Specific->value,
            'user_ids' => $userIds,
            'department_ids' => $departmentIds,
            'user_items' => $userItems,
            'department_items' => $departmentItems,
        ];

        return $detail;
    }

    private function buildBindingScopeLabel(bool $enabled, array $bindingScope): string
    {
        if (! $enabled) {
            return $this->translate('permission.function_permission.binding_scope_label.all_users_available', 'all_users_available');
        }

        $type = (string) ($bindingScope['type'] ?? BindingScopeType::OrganizationAll->value);
        if ($type === BindingScopeType::OrganizationAll->value) {
            return $this->translate('permission.function_permission.binding_scope_label.organization_all', 'organization_all');
        }

        $hasUsers = ! empty($bindingScope['user_ids'] ?? []);
        $hasDepartments = ! empty($bindingScope['department_ids'] ?? []);
        if ($hasUsers && $hasDepartments) {
            return $this->translate('permission.function_permission.binding_scope_label.specific_users_and_departments', 'specific_users_and_departments');
        }

        if ($hasUsers) {
            return $this->translate('permission.function_permission.binding_scope_label.specific_users', 'specific_users');
        }

        if ($hasDepartments) {
            return $this->translate('permission.function_permission.binding_scope_label.specific_departments', 'specific_departments');
        }

        return $this->translate('permission.function_permission.binding_scope_label.not_configured', 'not_configured');
    }

    /**
     * @param array<string, mixed> $item
     * @return array<string, mixed>
     */
    private function resolveCatalogItem(array $item): array
    {
        $item['function_name'] = $this->translate(
            (string) ($item['function_name_key'] ?? ''),
            (string) ($item['function_code'] ?? '')
        );
        $item['module_name'] = $this->translate(
            (string) ($item['module_name_key'] ?? ''),
            (string) ($item['module_code'] ?? '')
        );
        $item['description'] = $this->translate(
            (string) ($item['description_key'] ?? ''),
            ''
        );

        unset($item['function_name_key'], $item['module_name_key'], $item['description_key']);

        return $item;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildUserItems(string $organizationCode, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $dataIsolation = ContactDataIsolation::create($organizationCode, '');
        $userInfo = $this->magicUserInfoAppService->getBatchUserInfo($userIds, $dataIsolation);

        $items = [];
        foreach ($userIds as $userId) {
            $info = $userInfo[$userId] ?? [];
            $items[] = [
                'user_id' => $userId,
                'nickname' => $info['nickname'] ?? '',
                'real_name' => $info['real_name'] ?? '',
                'avatar_url' => $info['avatar_url'] ?? '',
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildDepartmentItems(string $organizationCode, array $departmentIds): array
    {
        if ($departmentIds === []) {
            return [];
        }

        $dataIsolation = ContactDataIsolation::create($organizationCode, '');
        $departments = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds, true);
        $departmentFullPaths = $this->departmentDomainService->getDepartmentFullPathByIds($dataIsolation, $departmentIds);

        $items = [];
        foreach ($departmentIds as $departmentId) {
            $department = $departments[$departmentId] ?? null;
            $path = $departmentFullPaths[$departmentId] ?? [];
            $items[] = [
                'department_id' => $departmentId,
                'name' => $department?->getName() ?? '',
                'full_path_name' => implode('/', array_map(static fn ($item): string => $item->getName(), $path)),
            ];
        }

        return $items;
    }

    private function translate(string $key, string $fallback): string
    {
        $value = __($key);

        if ($value === $key) {
            return $fallback;
        }

        return $value;
    }
}
