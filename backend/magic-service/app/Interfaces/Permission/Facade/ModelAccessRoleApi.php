<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Permission\Service\ModelAccessRoleAppService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\ModelAccessRoleBindingScopeType;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Provider\DTO\QueryModelsRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse(version: 'low_code')]
class ModelAccessRoleApi extends AbstractPermissionApi
{
    #[Inject]
    protected ModelAccessRoleAppService $modelAccessRoleAppService;

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::QUERY)]
    public function meta(): array
    {
        return $this->modelAccessRoleAppService->meta($this->createDataIsolation());
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::EDIT)]
    public function updateMeta(): array
    {
        $status = PermissionControlStatus::tryFrom((string) $this->request->input('permission_control_status', ''));
        if ($status === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid permission control status');
        }

        return $this->modelAccessRoleAppService->updateMeta(
            $this->createDataIsolation(),
            $status
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::QUERY)]
    public function availableModels(RequestInterface $request): array
    {
        $queryRequest = new QueryModelsRequest($request->all());

        if ($queryRequest->getCategory() === null && $request->input('category') !== null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
        }

        return $this->modelAccessRoleAppService->availableModels(
            $this->getAuthorization(),
            $queryRequest->getCategory(),
            $queryRequest->getModelTypes()
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        return $this->modelAccessRoleAppService->queries(
            $this->createDataIsolation(),
            $this->createPage(),
            [
                'keyword' => $this->request->input('keyword'),
            ]
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        return $this->modelAccessRoleAppService->detail(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId')
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::EDIT)]
    public function create(): array
    {
        return $this->modelAccessRoleAppService->createRole(
            $this->createDataIsolation(),
            $this->buildEntityFromRequest()
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::EDIT)]
    public function update(): array
    {
        return $this->modelAccessRoleAppService->updateRole(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId'),
            $this->buildEntityFromRequest()
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::EDIT)]
    public function destroy(): array
    {
        return $this->modelAccessRoleAppService->destroy(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId')
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE, MagicOperationEnum::QUERY)]
    public function userSummary(): array
    {
        return $this->modelAccessRoleAppService->userSummary(
            $this->createDataIsolation(),
            (string) $this->request->route('userId')
        );
    }

    private function createDataIsolation(): PermissionDataIsolation
    {
        $authorization = $this->getAuthorization();
        return PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );
    }

    private function buildEntityFromRequest(): ModelAccessRoleEntity
    {
        $entity = new ModelAccessRoleEntity();
        $entity->setName((string) $this->request->input('name', ''));
        $entity->setDescription($this->request->input('description'));
        $entity->setDeniedModelIds($this->parseStringArray($this->request->input('denied_model_ids', [])));

        $bindingScope = $this->request->input('binding_scope', []);
        if (! is_array($bindingScope)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid binding_scope');
        }

        $scopeType = ModelAccessRoleBindingScopeType::tryFrom((string) ($bindingScope['type'] ?? ''));
        if ($scopeType === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid binding_scope type');
        }

        $userIds = $this->parseStringArray($bindingScope['user_ids'] ?? []);
        $departmentIds = $this->parseStringArray($bindingScope['department_ids'] ?? []);
        $exclusionScope = $this->request->input('exclusion_scope', []);
        if ($exclusionScope !== null && ! is_array($exclusionScope)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid exclusion_scope');
        }

        $exclusionScope = is_array($exclusionScope) ? $exclusionScope : [];
        if ($exclusionScope !== []) {
            $exclusionType = ModelAccessRoleBindingScopeType::tryFrom((string) ($exclusionScope['type'] ?? ''));
            if ($exclusionType !== ModelAccessRoleBindingScopeType::Specific) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid exclusion_scope type');
            }
        }

        $entity->setExclusionScopeType(ModelAccessRoleBindingScopeType::Specific->value);
        $entity->setExcludedUserIds($this->parseStringArray($exclusionScope['user_ids'] ?? []));
        $entity->setExcludedDepartmentIds($this->parseStringArray($exclusionScope['department_ids'] ?? []));

        if ($scopeType === ModelAccessRoleBindingScopeType::OrganizationAll) {
            if (! empty($userIds) || ! empty($departmentIds)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'organization_all binding_scope cannot include user_ids or department_ids');
            }

            $entity->setUserIds([]);
            $entity->setDepartmentIds([]);
            $entity->setAllUsers(true);
            return $entity;
        }

        $entity->setUserIds($userIds);
        $entity->setDepartmentIds($departmentIds);
        $entity->setAllUsers(false);
        return $entity;
    }

    private function parseStringArray(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        return array_values(array_map(static fn ($item) => (string) $item, $value));
    }
}
