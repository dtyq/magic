<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
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
            'subscription' => $baseDataIsolation->getSubscriptionManager()->toArray(),
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
        $magicUser = $magicUserDomainService->getByUserId($userId);
        return $magicUser?->getMagicId();
    }

    private static function initSubscription(BaseDataIsolation $baseDataIsolation): void
    {
        $subscriptionManager = $baseDataIsolation->getSubscriptionManager();
        if (! $subscriptionManager->isEnabled()) {
            return;
        }
        if ($baseDataIsolation->isOfficialOrganization()) {
            $subscriptionManager->setEnabled(false);
        }
        $subscription = di(PackageFilterInterface::class)->getCurrentSubscription($baseDataIsolation);
        $subscriptionManager->setCurrentSubscription($subscription['id'] ?? '', $subscription['info'] ?? []);
    }
}
