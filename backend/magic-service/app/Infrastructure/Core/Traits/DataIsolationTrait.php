<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use InvalidArgumentException;
use Qbhy\HyperfAuth\Authenticatable;

trait DataIsolationTrait
{
    protected function createDataIsolation(Authenticatable|MagicUserAuthorization $authorization): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        /* @phpstan-ignore-next-line */
        if ($authorization instanceof MagicUserAuthorization) {
            $userId = $authorization->getId();
            $dataIsolation->setCurrentUserId(currentUserId: $userId);
            $dataIsolation->setCurrentMagicId(currentMagicId: $authorization->getMagicId());
            $dataIsolation->setUserType(userType: $authorization->getUserType());
            $dataIsolation->setCurrentOrganizationCode(currentOrganizationCode: $authorization->getOrganizationCode());
        } else {
            throw new InvalidArgumentException(message: 'Unsupported authorization type for data isolation');
        }

        return $dataIsolation;
    }
}
