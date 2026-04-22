<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

use function Hyperf\Translation\__;

readonly class ModelGatewayModelAccessService
{
    public function __construct(
        private ModelAccessRoleDomainService $modelAccessRoleDomainService,
        private MagicUserDomainService $magicUserDomainService,
    ) {
    }

    public function resolveAccessContext(ModelGatewayDataIsolation $dataIsolation): ModelAccessContext
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $this->backfillMagicId($permissionDataIsolation);

        return $this->modelAccessRoleDomainService->resolveAccessContext(
            $permissionDataIsolation,
            $dataIsolation->getCurrentUserId()
        );
    }

    public function assertCanAccess(ModelAccessContext $accessContext, string $modelId): void
    {
        if (! $accessContext->isRestricted()) {
            return;
        }

        if ($accessContext->canAccess($modelId)) {
            return;
        }

        $this->throwInsufficientPermissionException();
    }

    protected function createPermissionDataIsolation(ModelGatewayDataIsolation $dataIsolation): PermissionDataIsolation
    {
        return PermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
    }

    protected function getInsufficientPermissionMessage(): string
    {
        return __('service_provider.insufficient_permission_for_model');
    }

    protected function throwInsufficientPermissionException(): never
    {
        ExceptionBuilder::throw(
            ServiceProviderErrorCode::InvalidParameter,
            $this->getInsufficientPermissionMessage()
        );
    }

    private function backfillMagicId(BaseDataIsolation $dataIsolation): void
    {
        if ($dataIsolation->getMagicId() !== '' || $dataIsolation->getCurrentUserId() === '') {
            return;
        }

        $magicId = $this->magicUserDomainService->getByUserId($dataIsolation->getCurrentUserId())?->getMagicId() ?? '';
        if ($magicId !== '') {
            $dataIsolation->setMagicId($magicId);
        }
    }
}
