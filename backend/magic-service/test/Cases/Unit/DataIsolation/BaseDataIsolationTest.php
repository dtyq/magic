<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Kernel\DataIsolationSerializer;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use RuntimeException;

/**
 * 验证实例级授权的消费、覆盖和身份边界。
 * @internal
 */
final class BaseDataIsolationTest extends ContextTestCase
{
    /** 多次读取只执行一次回调，clone 独立保存结果。 */
    public function testLazyCallbackIsConsumedOncePerInstance(): void
    {
        $calls = 0;
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $context->addLazyFunction(BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, static function () use (&$calls): string {
            ++$calls;
            return 'mock-token';
        });
        $clone = clone $context;
        self::assertSame(0, $calls);
        self::assertSame('mock-token', $clone->getUserAuthorizationToken());
        self::assertFalse($context->hasUserAuthorizationToken());
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        self::assertSame(2, $calls);
    }

    /** 异常也消费回调，后续读取不自动重试。 */
    public function testExceptionDoesNotRetryImplicitly(): void
    {
        $calls = 0;
        $context = new BaseDataIsolation();
        $context->addLazyFunction(BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, static function () use (&$calls): never {
            ++$calls;
            throw new RuntimeException('mock failure');
        });
        try {
            $context->getUserAuthorizationToken();
            self::fail('应传播回调异常');
        } catch (RuntimeException $exception) {
            self::assertSame('mock failure', $exception->getMessage());
        }
        self::assertNull($context->getUserAuthorizationToken());
        self::assertSame(1, $calls);
    }

    /** 手工空结果及有效 token 都能覆盖回调。 */
    public function testManualTokenRemovesPendingCallback(): void
    {
        foreach (['', 'mock-manual-token'] as $token) {
            $context = new BaseDataIsolation();
            $context->addLazyFunction(BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, static function (): never {
                self::fail('手工 token 不应被回调覆盖');
            });
            $context->setUserAuthorizationToken($token);
            self::assertTrue($context->hasUserAuthorizationToken());
            self::assertSame($token, $context->getUserAuthorizationToken());
            $context->setUserAuthorizationToken(null);
            self::assertNull($context->getUserAuthorizationToken());
        }
    }

    /** 用户或组织变更清除结果和未执行的旧回调。 */
    public function testIdentityChangeClearsAuthorization(): void
    {
        $context = new BaseDataIsolation('mock-org', 'mock-user');
        $context->setUserAuthorizationToken('mock-token');
        $context->setCurrentUserId('mock-user');
        self::assertSame('mock-token', $context->getUserAuthorizationToken());
        $context->setCurrentUserId('mock-other');
        self::assertNull($context->getUserAuthorizationToken());
        $context->addLazyFunction(BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, static fn (): string => 'stale-mock-token');
        $context->setCurrentOrganizationCode('mock-other-org');
        self::assertNull($context->getUserAuthorizationToken());
    }

    /** 复制基础状态不复制父对象授权，序列化也不输出授权。 */
    public function testExtendsAndSerializationDoNotPropagateSecrets(): void
    {
        $parent = new BaseDataIsolation('mock-org', 'mock-user');
        $parent->setUserAuthorizationToken('mock-parent-token');
        $child = new BaseDataIsolation('mock-other-org', 'mock-other-user');
        $child->setUserAuthorizationToken('mock-old-token');
        $child->extends($parent);
        self::assertSame('mock-user', $child->getCurrentUserId());
        self::assertNull($child->getUserAuthorizationToken());
        self::assertStringNotContainsString('mock-parent-token', json_encode(DataIsolationSerializer::toArray($parent), JSON_THROW_ON_ERROR));
    }

    /** 订阅和组织信息回调保留原有一次性行为。 */
    public function testExistingManagerCallbacksRemainLazy(): void
    {
        $context = new BaseDataIsolation();
        $calls = 0;
        foreach (['initSubscription', 'initOrganizationInfo'] as $key) {
            $context->addLazyFunction($key, static function () use (&$calls): void { ++$calls; });
        }
        $context->getSubscriptionManager();
        $context->getSubscriptionManager();
        $context->getOrganizationInfoManager();
        $context->getOrganizationInfoManager();
        self::assertSame(2, $calls);
    }
}
