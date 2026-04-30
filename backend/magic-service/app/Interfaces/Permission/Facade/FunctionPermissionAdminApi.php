<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Permission\Service\FunctionPermissionAppService;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class FunctionPermissionAdminApi extends AbstractPermissionApi
{
    #[Inject]
    protected FunctionPermissionAppService $functionPermissionAppService;

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::QUERY)]
    public function catalog(): array
    {
        return [
            'list' => $this->functionPermissionAppService->catalog(),
        ];
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $authorization = $this->getAuthorization();
        return $this->functionPermissionAppService->queries($this->createPermissionDataIsolation($authorization));
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::QUERY)]
    public function settings(): array
    {
        $authorization = $this->getAuthorization();
        return $this->functionPermissionAppService->settings(
            $this->createPermissionDataIsolation($authorization)
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::QUERY)]
    public function show(string $functionCode): array
    {
        $authorization = $this->getAuthorization();
        return $this->functionPermissionAppService->show(
            $this->createPermissionDataIsolation($authorization),
            $functionCode
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::EDIT)]
    public function save(string $functionCode): array
    {
        $authorization = $this->getAuthorization();
        $payload = $this->request->all();

        $bindingScope = $payload['binding_scope'] ?? [];
        if (! is_array($bindingScope)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid binding_scope');
        }

        $enabled = filter_var($payload['enabled'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if ($enabled === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid enabled');
        }

        return $this->functionPermissionAppService->save(
            $this->createPermissionDataIsolation($authorization),
            $functionCode,
            $enabled,
            $bindingScope,
            isset($payload['remark']) ? (string) $payload['remark'] : null
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::EDIT)]
    public function updateEnabled(string $functionCode): array
    {
        $authorization = $this->getAuthorization();
        $payload = $this->request->all();
        $enabled = array_key_exists('enabled', $payload)
            ? filter_var($payload['enabled'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : null;
        if ($enabled === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid enabled');
        }

        return $this->functionPermissionAppService->updateEnabled(
            $this->createPermissionDataIsolation($authorization),
            $functionCode,
            $enabled
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::EDIT)]
    public function batchSave(): array
    {
        $authorization = $this->getAuthorization();
        $payload = $this->request->all();
        $items = $payload['items'] ?? [];
        if (! is_array($items)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'items must be array');
        }

        return $this->functionPermissionAppService->batchSave(
            $this->createPermissionDataIsolation($authorization),
            $items
        );
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::EDIT)]
    public function updateSettings(): array
    {
        $authorization = $this->getAuthorization();
        $status = PermissionControlStatus::tryFrom((string) $this->request->input('permission_control_status', ''));
        if ($status === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid permission control status');
        }

        return $this->functionPermissionAppService->updateSettings(
            $this->createPermissionDataIsolation($authorization),
            $status
        );
    }

    private function createPermissionDataIsolation(MagicUserAuthorization $authorization): PermissionDataIsolation
    {
        return PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );
    }
}
