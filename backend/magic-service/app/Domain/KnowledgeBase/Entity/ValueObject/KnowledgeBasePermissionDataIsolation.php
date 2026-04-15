<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\DataIsolationInterface;
use ReflectionProperty;

class KnowledgeBasePermissionDataIsolation extends PermissionDataIsolation
{
    public function extends(DataIsolationInterface $parentDataIsolation): void
    {
        if (! $parentDataIsolation instanceof BaseDataIsolation) {
            parent::extends($parentDataIsolation);
            return;
        }

        $this->setCurrentOrganizationCode($parentDataIsolation->getCurrentOrganizationCode());
        $this->setCurrentUserId($parentDataIsolation->getCurrentUserId());
        $this->setMagicId($parentDataIsolation->getMagicId());
        $this->setEnvId($parentDataIsolation->getEnvId());
        $this->setEnabled($parentDataIsolation->isEnable());
        $this->setContainOfficialOrganization($parentDataIsolation->isContainOfficialOrganization());
        $this->setOnlyOfficialOrganization($parentDataIsolation->isOnlyOfficialOrganization());
        $this->setOfficialOrganizationCodes($parentDataIsolation->getOfficialOrganizationCodes());
        $this->setThirdPlatformOrganizationCode($parentDataIsolation->getThirdPlatformOrganizationCode());
        $this->setThirdPlatformUserId($parentDataIsolation->getThirdPlatformUserId());

        $this->setBaseProperty($this, 'subscriptionManager', $this->getBaseProperty($parentDataIsolation, 'subscriptionManager'));
        $this->setBaseProperty($this, 'organizationInfoManager', $this->getBaseProperty($parentDataIsolation, 'organizationInfoManager'));
        $this->copyDeferredInitializer($parentDataIsolation, 'initSubscription');
        $this->copyDeferredInitializer($parentDataIsolation, 'initOrganizationInfo');

        $this->getThirdPlatformDataIsolationManager()->extends($parentDataIsolation);
    }

    private function copyDeferredInitializer(BaseDataIsolation $parentDataIsolation, string $key): void
    {
        $lazyFunctions = $this->getBaseProperty($parentDataIsolation, 'lazyFunctions');
        if (! isset($lazyFunctions[$key])) {
            return;
        }

        $this->addLazyFunction($key, function () use ($parentDataIsolation, $key): void {
            $lazyFunctions = $this->getBaseProperty($parentDataIsolation, 'lazyFunctions');
            if (! isset($lazyFunctions[$key])) {
                return;
            }

            $lazyFun = $lazyFunctions[$key];
            unset($lazyFunctions[$key]);
            $this->setBaseProperty($parentDataIsolation, 'lazyFunctions', $lazyFunctions);
            $lazyFun();
        });
    }

    private function getBaseProperty(BaseDataIsolation $target, string $property): mixed
    {
        return $this->newBaseReflectionProperty($property)->getValue($target);
    }

    private function setBaseProperty(BaseDataIsolation $target, string $property, mixed $value): void
    {
        $this->newBaseReflectionProperty($property)->setValue($target, $value);
    }

    private function newBaseReflectionProperty(string $property): ReflectionProperty
    {
        return new ReflectionProperty(BaseDataIsolation::class, $property);
    }
}
