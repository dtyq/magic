<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Application\ModelGateway\Mapper\ProviderManager;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationStatus;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use Hyperf\Context\Context;

class EnvManager
{
    public static function initDataIsolationEnv(BaseDataIsolation $baseDataIsolation, int $envId = 0, bool $force = false): void
    {
        $lastBaseDataIsolation = Context::get('LastBaseDataIsolationInitEnv');
        if (! $force && $lastBaseDataIsolation instanceof BaseDataIsolation) {
            $baseDataIsolation->extends($lastBaseDataIsolation);
            return;
        }

        if (empty($envId) && empty($baseDataIsolation->getCurrentOrganizationCode())) {
            return;
        }
        if (empty($envId)) {
            // 尝试获取当前环境的环境 ID.
            $envId = $baseDataIsolation->getEnvId();
        }

        $magicOrganizationEnvDomainService = di(MagicOrganizationEnvDomainService::class);

        if (! $envId) {
            $envDTO = $magicOrganizationEnvDomainService->getOrganizationsEnvironmentDTO($baseDataIsolation->getCurrentOrganizationCode());
            $env = $envDTO?->getMagicEnvironmentEntity();
            $envId = $envDTO?->getEnvironmentId() ?? 0;
            $relationEnvIds = $env?->getRelationEnvIds() ?? [];
            if (count($relationEnvIds) > 0 && ! $env?->getEnvironment()?->isProduction()) {
                foreach ($relationEnvIds as $relationEnvId) {
                    if ($relationEnvId === $envId) {
                        continue;
                    }
                    $relationEnv = $magicOrganizationEnvDomainService->getMagicEnvironmentById((int) $relationEnvId);
                    if ($relationEnv?->getEnvironment()?->isProduction()) {
                        $env = $relationEnv;
                        break;
                    }
                }
            }
        } else {
            $env = $magicOrganizationEnvDomainService->getMagicEnvironmentById($envId);
        }
        if (! $env) {
            return;
        }
        $baseDataIsolation->setEnvId($env->getId());
        $baseDataIsolation->getThirdPlatformDataIsolationManager()->init($baseDataIsolation, $env);

        self::initSubscription($baseDataIsolation);

        simple_log('EnvManagerInit', [
            'class' => get_class($baseDataIsolation),
            'env_id' => $baseDataIsolation->getEnvId(),
            'third_platform_manager' => $baseDataIsolation->getThirdPlatformDataIsolationManager()->toArray(),
            'third_user_id' => $baseDataIsolation->getThirdPlatformUserId(),
            'third_organization_code' => $baseDataIsolation->getThirdPlatformOrganizationCode(),
        ]);

        // 同一个协程内无需重复加载
        Context::set('LastBaseDataIsolationInitEnv', $baseDataIsolation);
    }

    public static function getMagicId(string $userId): ?string
    {
        $magicUserDomainService = di(MagicUserDomainService::class);
        return $magicUserDomainService->getByUserId($userId)?->getMagicId();
    }

    public static function initOrganizationInfo(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        if ($lazy) {
            $lazyFun = function () use ($baseDataIsolation) {
                self::initOrganizationInfo($baseDataIsolation, false);
            };
            $baseDataIsolation->addLazyFunction('initOrganizationInfo', $lazyFun);
            return;
        }
        $organizationAdminDomainService = di(OrganizationAdminDomainService::class);
        $organizationEntity = $organizationAdminDomainService->getOrganizationInfo($baseDataIsolation);

        if ($organizationEntity) {
            $organizationInfoManager = $baseDataIsolation->getOrganizationInfoManager();
            $organizationInfoManager->setOrganizationId($organizationEntity->getId());
            $organizationInfoManager->setOrganizationCode($organizationEntity->getMagicOrganizationCode());
            $organizationInfoManager->setOrganizationName($organizationEntity->getName());
            $organizationInfoManager->setOrganizationType(OrganizationType::from($organizationEntity->getType()));
            $organizationInfoManager->setOrganizationStatus(OrganizationStatus::from($organizationEntity->getStatus()));

            simple_log('OrganizationInfo', $organizationInfoManager->toArray());
        }
    }

    private static function initSubscription(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        if ($lazy) {
            $lazyFun = function () use ($baseDataIsolation) {
                self::initSubscription($baseDataIsolation, false);
            };
            $baseDataIsolation->addLazyFunction('initSubscription', $lazyFun);
            return;
        }
        $subscriptionManager = $baseDataIsolation->getSubscriptionManager();
        $providerDataIsolation = ProviderDataIsolation::create($baseDataIsolation->getCurrentOrganizationCode(), $baseDataIsolation->getCurrentUserId(), $baseDataIsolation->getMagicId());
        $providerDataIsolation->setContainOfficialOrganization(true);
        if (! $subscriptionManager->isEnabled()) {
            return;
        }
        if ($baseDataIsolation->isOfficialOrganization()) {
            $subscriptionManager->setEnabled(false);
        }

        $subscription = di(PackageFilterInterface::class)->getCurrentSubscription($baseDataIsolation);
        $modelIdsGroupByType = di(ProviderManager::class)->getModelIdsGroupByType($providerDataIsolation);
        $subscriptionManager->setCurrentSubscription($subscription['id'] ?? '', $subscription['info'] ?? [], $modelIdsGroupByType);
    }
}
