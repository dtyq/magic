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

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
    public function meta(): array
    {
        return $this->modelAccessRoleAppService->meta($this->createDataIsolation());
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
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

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
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

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        return $this->modelAccessRoleAppService->queries(
            $this->createDataIsolation(),
            $this->createPage(),
            [
                'keyword' => $this->request->input('keyword'),
                'is_default' => $this->request->input('is_default'),
            ]
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        return $this->modelAccessRoleAppService->detail(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId')
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function createDefault(): array
    {
        return $this->modelAccessRoleAppService->createDefaultRole(
            $this->createDataIsolation(),
            $this->buildEntityFromRequest(true)
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function create(): array
    {
        return $this->modelAccessRoleAppService->createRole(
            $this->createDataIsolation(),
            $this->buildEntityFromRequest(false)
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function update(): array
    {
        return $this->modelAccessRoleAppService->updateRole(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId'),
            $this->buildEntityFromRequest(false)
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::EDIT)]
    public function destroy(): array
    {
        return $this->modelAccessRoleAppService->destroy(
            $this->createDataIsolation(),
            (int) $this->request->route('roleId')
        );
    }

    #[CheckPermission(MagicResourceEnum::SAFE_SUB_ADMIN, MagicOperationEnum::QUERY)]
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
            $authorization->getId()
        );
    }

    private function buildEntityFromRequest(bool $isDefault): ModelAccessRoleEntity
    {
        $entity = new ModelAccessRoleEntity();
        $entity->setName((string) $this->request->input('name', ''));
        $entity->setDescription($this->request->input('description'));
        $entity->setIsDefault($isDefault);
        $entity->setParentRoleId($isDefault ? null : $this->parseNullableInt($this->request->input('parent_role_id')));
        $entity->setModelIds($this->parseStringArray($this->request->input('model_ids', [])));
        $entity->setUserIds($isDefault ? [] : $this->parseStringArray($this->request->input('user_ids', [])));
        return $entity;
    }

    private function parseStringArray(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        return array_values(array_map(static fn ($item) => (string) $item, $value));
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        return (int) $value;
    }
}
