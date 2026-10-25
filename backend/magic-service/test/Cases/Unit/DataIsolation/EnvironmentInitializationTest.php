<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Kernel\EnvManager;
use App\Application\ModelGateway\Mapper\ProviderManager;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\OrganizationEnvironment\DTO\MagicOrganizationEnvDTO;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\EnvironmentEnum;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\DataIsolationInitializerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use Hyperf\Context\Context;
use RuntimeException;

/** 验证统一初始化入口、缓存边界和实例级延迟能力，所有业务服务均为Mock。
 * @internal
 */
final class EnvironmentInitializationTest extends ContextTestCase
{
    /** 对象入口仅通过Core端口委托，返回当前实例支持链式调用。 */
    public function testObjectEntryDelegatesToInitializer(): void
    {
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $initializer = $this->createMock(DataIsolationInitializerInterface::class);
        $initializer->expects(self::once())->method('initialize')->with($context, 7, true);
        $this->services[DataIsolationInitializerInterface::class] = $initializer;
        self::assertSame($context, $context->initDataIsolationEnv(7, true));
    }

    /** 新入口不能让缓存身份覆盖显式身份或空身份。 */
    public function testObjectEntryNeverInheritsCachedIdentity(): void
    {
        Context::set('LastBaseDataIsolationInitEnv', new BaseDataIsolation('mock-cached-org', 'mock-cached-user'));
        $explicit = new DataIsolation('mock-org', 'mock-user');
        $explicit->initDataIsolationEnv();
        self::assertSame('mock-org', $explicit->getCurrentOrganizationCode());
        self::assertSame('mock-user', $explicit->getCurrentUserId());
        $empty = new BaseDataIsolation();
        $empty->initDataIsolationEnv();
        self::assertSame('', $empty->getCurrentUserId());
        self::assertSame('', $empty->getCurrentOrganizationCode());
    }

    /** 新对象初始化不能改变后续旧空身份入口继承的请求身份。 */
    public function testObjectEntryDoesNotReplaceLegacyRequestIdentity(): void
    {
        $this->environmentService()->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($this->environment()));
        $request = new BaseDataIsolation('mock-request-org', 'mock-request-user');
        Context::set('LastBaseDataIsolationInitEnv', $request);
        $source = (new BaseDataIsolation('mock-source-org', 'mock-source-user'))->initDataIsolationEnv();
        self::assertSame(1, $source->getEnvId());
        self::assertSame($request, Context::get('LastBaseDataIsolationInitEnv'));
    }

    /** 静态兼容入口同样不能覆盖显式身份。 */
    public function testLegacyEntryKeepsExplicitIdentity(): void
    {
        Context::set('LastBaseDataIsolationInitEnv', new BaseDataIsolation('mock-cached-org', 'mock-cached-user'));
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        EnvManager::initDataIsolationEnv($context);
        self::assertSame('mock-org', $context->getCurrentOrganizationCode());
        self::assertSame('mock-user', $context->getCurrentUserId());
    }

    /** 环境查询和用户映射各自幂等，授权仍仅在首次消费时获取。 */
    public function testInitializationIsIdempotentAndAuthorizationIsLazy(): void
    {
        $environment = $this->environment();
        $this->environmentService()->expects(self::once())->method('getOrganizationsEnvironmentDTO')->with('mock-org')->willReturn($this->dto($environment));
        $manager = $this->createMock(ThirdPlatformDataIsolationManagerInterface::class);
        $manager->expects(self::once())->method('init');
        $this->services[ThirdPlatformDataIsolationManagerInterface::class] = $manager;
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $context->initDataIsolationEnv()->initDataIsolationEnv();
        self::assertSame(1, $context->getEnvId());
        self::assertFalse($context->hasUserAuthorizationToken());
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $agent;
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        $context->initDataIsolationEnv();
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
    }

    /** 同组织环境元数据可复用，但两个用户仍各自初始化映射和授权。 */
    public function testEnvironmentCacheDoesNotShareUserCapabilities(): void
    {
        $this->environmentService()->expects(self::once())->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($this->environment()));
        $contexts = [];
        foreach (['mock-user-a', 'mock-user-b'] as $user) {
            $manager = $this->createMock(ThirdPlatformDataIsolationManagerInterface::class);
            $manager->expects(self::once())->method('init')->willReturnCallback(static function (BaseDataIsolation $context) use ($user): void {
                self::assertSame($user, $context->getCurrentUserId());
                $context->setThirdPlatformUserId('mock-third-' . $user);
            });
            $this->services[ThirdPlatformDataIsolationManagerInterface::class] = $manager;
            $context = new BaseDataIsolation('mock-org', $user);
            $context->setUserAuthorizationToken('mock-token-' . $user);
            $contexts[] = $context->initDataIsolationEnv();
        }
        self::assertNotSame($contexts[0]->getThirdPlatformDataIsolationManager(), $contexts[1]->getThirdPlatformDataIsolationManager());
        self::assertSame('mock-token-mock-user-a', $contexts[0]->getUserAuthorizationToken());
        self::assertSame('mock-token-mock-user-b', $contexts[1]->getUserAuthorizationToken());
        self::assertSame('mock-third-mock-user-b', $contexts[1]->getThirdPlatformUserId());
    }

    /** 不同组织不能命中相同环境查询缓存。 */
    public function testEnvironmentCacheIsPartitionedByOrganization(): void
    {
        $this->environmentService()->expects(self::exactly(2))->method('getOrganizationsEnvironmentDTO')->willReturnCallback(function (string $org): MagicOrganizationEnvDTO {
            return $this->dto($this->environment($org === 'mock-org-a' ? 1 : 2));
        });
        $first = (new BaseDataIsolation('mock-org-a', 'mock-user'))->initDataIsolationEnv();
        $second = (new BaseDataIsolation('mock-org-b', 'mock-user'))->initDataIsolationEnv();
        self::assertSame(1, $first->getEnvId());
        self::assertSame(2, $second->getEnvId());
    }

    /** 显式环境和force刷新都不能复用其他环境元数据。 */
    public function testExplicitEnvironmentAndForceRefresh(): void
    {
        $this->environmentService()->expects(self::exactly(3))->method('getMagicEnvironmentById')->willReturnCallback(fn (int $id): MagicEnvironmentEntity => $this->environment($id));
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $context->setUserAuthorizationToken('mock-manual');
        $context->initDataIsolationEnv(1)->initDataIsolationEnv(2)->initDataIsolationEnv(2, true);
        self::assertSame(2, $context->getEnvId());
        self::assertSame('mock-manual', $context->getUserAuthorizationToken());
    }

    /** 无环境也只查询一次，并在首次读取时解析用户授权。 */
    public function testMissingEnvironmentStillPreparesAuthorization(): void
    {
        $this->environmentService()->expects(self::once())->method('getOrganizationsEnvironmentDTO')->willReturn(null);
        $first = (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv();
        (new BaseDataIsolation('mock-org', 'mock-other-user'))->initDataIsolationEnv();
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $agent;
        self::assertSame('mock-token', $first->getUserAuthorizationToken());
    }

    /** 用户切换回原值仍需重新准备，不能因指纹相同跳过初始化。 */
    public function testIdentityRoundTripInvalidatesCapabilities(): void
    {
        $context = (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv();
        $context->setCurrentUserId('mock-other')->setCurrentUserId('mock-user');
        $context->initDataIsolationEnv();
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $agent;
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
    }

    /** 组织切换失效旧环境ID和当前用户派生字段。 */
    public function testOrganizationChangeClearsDerivedState(): void
    {
        $context = new BaseDataIsolation('mock-org-a', 'mock-user', 'mock-magic');
        $context->setEnvId(7)->setThirdPlatformUserId('mock-third-user')->setThirdPlatformOrganizationCode('mock-third-org');
        $context->setUserAuthorizationToken('mock-old-token');
        $context->setCurrentOrganizationCode('mock-org-b');
        self::assertSame(0, $context->getEnvId());
        self::assertSame('', $context->getMagicId());
        self::assertSame('', $context->getThirdPlatformUserId());
        self::assertSame('', $context->getThirdPlatformOrganizationCode());
        self::assertNull($context->getUserAuthorizationToken());
    }

    /** 查询异常不写成功标记，后续调用能够重新查询。 */
    public function testFailedEnvironmentLookupCanRetry(): void
    {
        $calls = 0;
        $this->environmentService()->expects(self::exactly(2))->method('getOrganizationsEnvironmentDTO')->willReturnCallback(static function () use (&$calls): ?MagicOrganizationEnvDTO {
            if (++$calls === 1) {
                throw new RuntimeException('mock lookup failure');
            }
            return null;
        });
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        try {
            $context->initDataIsolationEnv();
            self::fail('首次查询应抛出异常');
        } catch (RuntimeException $exception) {
            self::assertSame('mock lookup failure', $exception->getMessage());
        }
        self::assertSame($context, $context->initDataIsolationEnv());
    }

    /** 关联环境仍沿用生产环境优先的原有选择规则。 */
    public function testRelatedProductionEnvironmentIsSelected(): void
    {
        $environment = $this->environment(1, EnvironmentEnum::Test);
        $environment->method('getRelationEnvIds')->willReturn([2]);
        $this->environmentService()->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($environment));
        $this->environmentService()->expects(self::once())->method('getMagicEnvironmentById')->with(2)->willReturn($this->environment(2));
        self::assertSame(2, (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv()->getEnvId());
    }

    /** 订阅只在getter消费一次，重复初始化不能再次触发已完成查询。 */
    public function testSubscriptionRemainsLazyAndInstanceScoped(): void
    {
        $this->environmentService()->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($this->environment()));
        $manager = $this->createMock(SubscriptionManagerInterface::class);
        $manager->method('isEnabled')->willReturn(true);
        $manager->expects(self::once())->method('setCurrentSubscription')->with('mock-subscription', [], []);
        $this->services[SubscriptionManagerInterface::class] = $manager;
        $context = (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv();
        // 初始化阶段不安装订阅服务，提前查询会直接失败。
        $filter = $this->createMock(PackageFilterInterface::class);
        $filter->expects(self::once())->method('getCurrentSubscription')->with($context)->willReturn(['id' => 'mock-subscription', 'info' => []]);
        $this->services[PackageFilterInterface::class] = $filter;
        $providers = new EnvironmentProviderManagerStub();
        $this->services[ProviderManager::class] = $providers;
        self::assertSame($manager, $context->getSubscriptionManager());
        $context->initDataIsolationEnv();
        self::assertSame($manager, $context->getSubscriptionManager());
    }

    /** 用户变化后不能继续暴露旧订阅结果或第三方映射。 */
    public function testUserChangeDiscardsOldManagers(): void
    {
        $old = new BaseSubscriptionManager();
        $old->setCurrentSubscription('mock-old-subscription', []);
        $this->services[SubscriptionManagerInterface::class] = $old;
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $fresh = new BaseSubscriptionManager();
        $this->services[SubscriptionManagerInterface::class] = $fresh;
        $context->setCurrentUserId('mock-other');
        self::assertSame($fresh, $context->getSubscriptionManager());
        self::assertSame('', $context->getSubscriptionManager()->getCurrentSubscriptionId());
    }

    /** 静态门面保留旧命名参数，并支持立即解析授权的历史行为。 */
    public function testLegacyNamedArgumentsAndImmediateAuthorization(): void
    {
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $agent;
        EnvManager::initDataIsolationEnv(baseDataIsolation: $context);
        EnvManager::initUserAuthorizationToken(baseDataIsolation: $context, lazy: false);
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
    }

    /** 强制初始化失败后不保留旧的成功标记，普通调用也可重试。 */
    public function testFailedForcedInitializationCanRetry(): void
    {
        $environment = $this->environment();
        $this->environmentService()->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($environment));
        $this->environmentService()->method('getMagicEnvironmentById')->willReturn($environment);
        $manager = $this->createMock(ThirdPlatformDataIsolationManagerInterface::class);
        $calls = 0;
        $manager->expects(self::exactly(3))->method('init')->willReturnCallback(static function () use (&$calls): void {
            if (++$calls === 2) {
                throw new RuntimeException('mock mapping failure');
            }
        });
        $this->services[ThirdPlatformDataIsolationManagerInterface::class] = $manager;
        $context = (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv();
        try {
            $context->initDataIsolationEnv(force: true);
            self::fail('强制初始化应传播映射错误');
        } catch (RuntimeException $exception) {
            self::assertSame('mock mapping failure', $exception->getMessage());
        }
        self::assertSame($context, $context->initDataIsolationEnv());
    }

    /** 环境刷新为不存在时失效旧环境，不能继续暴露旧订阅。 */
    public function testMissingRefreshedEnvironmentClearsOldCapabilities(): void
    {
        $this->environmentService()->method('getOrganizationsEnvironmentDTO')->willReturn($this->dto($this->environment()));
        $this->environmentService()->method('getMagicEnvironmentById')->willReturn(null);
        $old = new BaseSubscriptionManager();
        $old->setCurrentSubscription('mock-old-subscription', []);
        $this->services[SubscriptionManagerInterface::class] = $old;
        $context = (new BaseDataIsolation('mock-org', 'mock-user'))->initDataIsolationEnv();
        $context->setUserAuthorizationToken('mock-manual');
        $fresh = new BaseSubscriptionManager();
        $this->services[SubscriptionManagerInterface::class] = $fresh;
        $context->initDataIsolationEnv(force: true);
        self::assertSame(0, $context->getEnvId());
        self::assertSame('', $context->getSubscriptionManager()->getCurrentSubscriptionId());
        self::assertSame('mock-manual', $context->getUserAuthorizationToken());
    }

    /** 提供当前测试容器内的Mock环境服务。 */
    private function environmentService(): MagicOrganizationEnvDomainService
    {
        return $this->services[MagicOrganizationEnvDomainService::class];
    }

    /** 构造不含凭证或真实配置的环境替身。 */
    private function environment(int $id = 1, EnvironmentEnum $type = EnvironmentEnum::Production): MagicEnvironmentEntity
    {
        $environment = $this->createMock(MagicEnvironmentEntity::class);
        $environment->method('getId')->willReturn($id);
        $environment->method('getEnvironment')->willReturn($type);
        return $environment;
    }

    /** 只装配本测试需要的环境映射字段。 */
    private function dto(MagicEnvironmentEntity $environment): MagicOrganizationEnvDTO
    {
        $dto = $this->createMock(MagicOrganizationEnvDTO::class);
        $dto->method('getEnvironmentId')->willReturn($environment->getId());
        $dto->method('getMagicEnvironmentEntity')->willReturn($environment);
        return $dto;
    }
}

/** 隔离只读Provider编排服务的离线替身。 */
readonly class EnvironmentProviderManagerStub extends ProviderManager
{
    /** 不创建真实模型和Provider依赖。 */
    public function __construct()
    {
    }

    /** 返回占位模型分组，不请求任何外部服务。 */
    public function getModelIdsGroupByType(ProviderDataIsolation $providerDataIsolation, array $modelTypes = []): array
    {
        return [];
    }
}
