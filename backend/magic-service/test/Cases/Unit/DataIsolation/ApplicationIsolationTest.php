<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Common\Share\Service\AbstractShareAppService;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\Context;
use ReflectionMethod;

/** 验证应用统一入口与旧 trait 的兼容边界。
 * @internal
 */
final class ApplicationIsolationTest extends ContextTestCase
{
    /** Common 和 Share 直接继承统一入口，身份与类型不受缓存环境干扰。 */
    public function testApplicationServicesInheritLazyFactory(): void
    {
        Context::set('LastBaseDataIsolationInitEnv', new BaseDataIsolation('mock-other-org', 'mock-other-user'));
        $authorization = $this->authorization();
        $service = $this->createMock(AgentDomainService::class);
        $service->expects(self::exactly(2))->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        foreach ([AbstractAppService::class, AbstractShareAppService::class] as $class) {
            $method = new ReflectionMethod($class, 'createDataIsolation');
            self::assertSame(AbstractKernelAppService::class, $method->getDeclaringClass()->getName());
            $app = $this->service($class, []);
            $context = $method->invoke($app, $authorization);
            self::assertSame('mock-org', $context->getCurrentOrganizationCode());
            self::assertSame('mock-user', $context->getCurrentUserId());
            self::assertSame('mock-magic-id', $context->getCurrentMagicId());
            self::assertSame(UserType::Ai, $context->getUserType());
            self::assertFalse($context->hasUserAuthorizationToken());
            $this->services[AgentDomainService::class] = $service;
            self::assertSame('mock-token', $context->getUserAuthorizationToken());
            self::assertSame('mock-token', $context->getUserAuthorizationToken());
            unset($this->services[AgentDomainService::class]);
        }
    }

    /** 旧 trait 仍可独立使用，保持只组装身份、不初始化环境和授权的行为。 */
    public function testLegacyTraitRemainsIdentityOnly(): void
    {
        $factory = new class {
            use DataIsolationTrait {
                createDataIsolation as public create;
            }
        };
        $context = $factory->create($this->authorization());
        self::assertSame('mock-user', $context->getCurrentUserId());
        self::assertSame(UserType::Ai, $context->getUserType());
        self::assertNull($context->getUserAuthorizationToken());
    }

    /** 构造占位认证身份，不访问认证服务或真实用户。 */
    private function authorization(): MagicUserAuthorization
    {
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $authorization->method('getOrganizationCode')->willReturn('mock-org');
        $authorization->method('getId')->willReturn('mock-user');
        $authorization->method('getMagicId')->willReturn('mock-magic-id');
        $authorization->method('getUserType')->willReturn(UserType::Ai);
        return $authorization;
    }
}
