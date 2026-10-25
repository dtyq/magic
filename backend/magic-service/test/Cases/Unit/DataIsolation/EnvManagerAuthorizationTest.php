<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Kernel\EnvManager;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Context\Context;

/**
 * 验证应用边界注册时不解析真实授权服务。
 * @internal
 */
final class EnvManagerAuthorizationTest extends ContextTestCase
{
    /** 空用户的对象与环境入口都不访问授权服务。 */
    public function testEmptyUserDoesNotResolveService(): void
    {
        $context = new DataIsolation();
        EnvManager::initUserAuthorizationToken($context);
        EnvManager::initDataIsolationEnv($context);
        self::assertNull($context->getUserAuthorizationToken());
    }

    /** 注册、首次读取、手工覆盖和重新注册都遵守消费契约。 */
    public function testRegistrationResolvesOnlyOnFirstRead(): void
    {
        $service = $this->createMock(AgentDomainService::class);
        $service->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $context = new DataIsolation('mock-org', 'mock-user');
        EnvManager::initUserAuthorizationToken($context);
        self::assertFalse($context->hasUserAuthorizationToken());
        $this->services[AgentDomainService::class] = $service;
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        $context->setUserAuthorizationToken('mock-manual');
        EnvManager::initUserAuthorizationToken($context);
        self::assertSame('mock-manual', $context->getUserAuthorizationToken());
    }

    /** 没有环境的返回分支仍注册授权。 */
    public function testMissingEnvironmentStillRegistersToken(): void
    {
        $environment = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environment->method('getOrganizationsEnvironmentDTO')->willReturn(null);
        $this->services[MagicOrganizationEnvDomainService::class] = $environment;
        $context = new DataIsolation('mock-org', 'mock-user');
        EnvManager::initDataIsolationEnv($context);
        $service = $this->createMock(AgentDomainService::class);
        $service->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $service;
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
    }

    /** 缓存环境复用后为目标实例重新注册，不复制父 token。 */
    public function testCachedEnvironmentRegistersForResultingIdentity(): void
    {
        $cached = new BaseDataIsolation('mock-org', 'mock-user');
        $cached->setUserAuthorizationToken('mock-parent-token');
        Context::set('LastBaseDataIsolationInitEnv', $cached);
        $context = new DataIsolation();
        EnvManager::initDataIsolationEnv($context);
        self::assertFalse($context->hasUserAuthorizationToken());
        $service = $this->createMock(AgentDomainService::class);
        $service->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $service;
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
    }

    /** 显式用户 helper 不继承协程内其他身份。 */
    public function testExplicitUserHelperDoesNotReuseEnvironmentIdentity(): void
    {
        Context::set('LastBaseDataIsolationInitEnv', new BaseDataIsolation('mock-other-org', 'mock-other-user'));
        $app = new class extends AbstractKernelAppService {
            /** 暴露应用 helper 以验证身份隔离。 */
            public function prepare(): DataIsolation
            {
                return $this->createContactDataIsolationByUser('mock-org', 'mock-user');
            }
        };
        $context = $app->prepare();
        self::assertSame('mock-org', $context->getCurrentOrganizationCode());
        self::assertSame('mock-user', $context->getCurrentUserId());
    }
}
