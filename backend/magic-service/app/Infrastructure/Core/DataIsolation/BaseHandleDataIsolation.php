<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;

class BaseHandleDataIsolation implements HandleDataIsolationInterface
{
    public function handleByAuthorization(Authenticatable $authorization, BaseDataIsolation $baseDataIsolation, int &$envId): void
    {
        match (true) {
            $authorization instanceof MagicUserAuthorization => $this->createByMagicUserAuthorization($authorization, $baseDataIsolation, $envId),
            default => ExceptionBuilder::throw(AuthenticationErrorCode::Error, 'unknown_authorization_type'),
        };
    }

    protected function createByMagicUserAuthorization(MagicUserAuthorization $authorization, BaseDataIsolation $baseDataIsolation, int &$envId): void
    {
        $baseDataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $baseDataIsolation->setCurrentUserId($authorization->getId());
        $baseDataIsolation->setMagicId($authorization->getMagicId());
        $baseDataIsolation->setThirdPlatformUserId($authorization->getThirdPlatformUserId());
        $baseDataIsolation->setThirdPlatformOrganizationCode($authorization->getThirdPlatformOrganizationCode());
        $envId = $authorization->getMagicEnvId();
    }
}
