<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Application\ModelGateway\Mapper\ProviderManager;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\DataIsolationInitializerInterface;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationStatus;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use Hyperf\Context\Context;
use WeakMap;

/** 统一准备隔离实例的环境能力，不复用其他实例的用户状态。 */
final class DataIsolationInitializer implements DataIsolationInitializerInterface
{
    /** 协程内只缓存环境元数据，不缓存用户隔离对象。 */
    private const ENVIRONMENT_CACHE = 'DataIsolationEnvironmentCache';

    /** 弱引用记录当前协程内各实例的成功初始化状态。 */
    private const INSTANCE_STATE = 'DataIsolationInitializationState';

    /** 按当前身份初始化环境，显式刷新时绕过元数据和实例缓存。 */
    public function initialize(BaseDataIsolation $context, int $envId = 0, bool $force = false): void
    {
        /** @var WeakMap<BaseDataIsolation, string> $states */
        $states = Context::getOrSet(self::INSTANCE_STATE, static fn (): WeakMap => new WeakMap());
        $effectiveEnvId = $envId ?: $context->getEnvId();
        if (! $force && isset($states[$context]) && $states[$context] === $this->fingerprint($context, $effectiveEnvId)) {
            return;
        }

        unset($states[$context]);
        $environment = $this->resolveEnvironment($context->getCurrentOrganizationCode(), $effectiveEnvId, $force);
        if ($environment !== null) {
            $context->setEnvId($environment->getId());
            $context->getThirdPlatformDataIsolationManager()->init($context, $environment);
            $this->initSubscription($context);
        } else {
            $context->setEnvId(0);
        }
        $this->initUserAuthorizationToken($context);
        $states[$context] = $this->fingerprint($context, $context->getEnvId());
    }

    /**
     * 为任意基础数据隔离对象注册用户授权 token 的延迟回调。
     */
    public function initUserAuthorizationToken(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        $userId = $baseDataIsolation->getCurrentUserId();
        if ($userId === '' || $baseDataIsolation->hasUserAuthorizationToken()) {
            return;
        }

        if ($lazy) {
            $baseDataIsolation->addLazyFunction(
                BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION,
                static fn (): string => di(AgentDomainService::class)->getAuthorizationByUserId($userId)
            );
            return;
        }

        $baseDataIsolation->setUserAuthorizationToken(
            di(AgentDomainService::class)->getAuthorizationByUserId($userId)
        );
    }

    /** 按需准备组织信息，保持旧入口显式开启的行为。 */
    public function initOrganizationInfo(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        if ($lazy) {
            $lazyFun = function () use ($baseDataIsolation) {
                $this->initOrganizationInfo($baseDataIsolation, false);
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

    /** 按组织和请求环境区分缓存，空环境结果也只查询一次。 */
    private function resolveEnvironment(string $organizationCode, int $envId, bool $force): ?MagicEnvironmentEntity
    {
        if ($organizationCode === '' && $envId === 0) {
            return null;
        }
        $key = json_encode([$organizationCode, $envId], JSON_THROW_ON_ERROR);
        $cache = Context::get(self::ENVIRONMENT_CACHE, []);
        if ($force) {
            foreach (array_keys($cache) as $cachedKey) {
                if (json_decode($cachedKey, true, flags: JSON_THROW_ON_ERROR)[0] === $organizationCode) {
                    unset($cache[$cachedKey]);
                }
            }
            Context::set(self::ENVIRONMENT_CACHE, $cache);
        }
        if (! $force && array_key_exists($key, $cache)) {
            return $cache[$key] === null ? null : clone $cache[$key];
        }
        $service = di(MagicOrganizationEnvDomainService::class);
        if ($envId !== 0) {
            $environment = $service->getMagicEnvironmentById($envId);
        } else {
            $dto = $service->getOrganizationsEnvironmentDTO($organizationCode);
            $environment = $dto?->getMagicEnvironmentEntity();
            $organizationEnvId = $dto?->getEnvironmentId() ?? 0;
            foreach ($environment?->getRelationEnvIds() ?? [] as $relationEnvId) {
                if ($environment?->getEnvironment()?->isProduction()) {
                    break;
                }
                if ($relationEnvId === $organizationEnvId) {
                    continue;
                }
                $related = $service->getMagicEnvironmentById((int) $relationEnvId);
                if ($related?->getEnvironment()?->isProduction()) {
                    $environment = $related;
                    break;
                }
            }
        }
        $cache[$key] = $environment === null ? null : clone $environment;
        Context::set(self::ENVIRONMENT_CACHE, $cache);
        return $environment;
    }

    /** 身份或显式环境变化后不能复用原实例的初始化标记。 */
    private function fingerprint(BaseDataIsolation $context, int $envId): string
    {
        return json_encode([
            $context->getInitializationVersion(),
            $context->getCurrentOrganizationCode(),
            $context->getCurrentUserId(),
            $context->getMagicId(),
            $envId,
            $context->getThirdPlatformUserId(),
            $context->getThirdPlatformOrganizationCode(),
        ], JSON_THROW_ON_ERROR);
    }

    /** 注册或消费当前实例的订阅能力，避免访问其他用户的管理器。 */
    private function initSubscription(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        if ($lazy) {
            $lazyFun = function () use ($baseDataIsolation) {
                $this->initSubscription($baseDataIsolation, false);
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
