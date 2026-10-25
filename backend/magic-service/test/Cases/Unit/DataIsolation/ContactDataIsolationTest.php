<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use InvalidArgumentException;

/**
 * 验证继承后的旧构造与公开 API 兼容。
 * @internal
 */
final class ContactDataIsolationTest extends ContextTestCase
{
    /** 旧数组和命名数组入口保留字段，字符串入口满足 Base 工厂。 */
    public function testLegacyAndBaseConstructors(): void
    {
        $data = ['current_organization_code' => 'mock-org', 'current_user_id' => 'mock-user', 'current_magic_id' => 'mock-magic', 'language' => 'en_US', 'current_app_id' => 'mock-app'];
        foreach ([new DataIsolation($data), new DataIsolation(data: $data), new DataIsolation(currentOrganizationCode: $data)] as $context) {
            self::assertInstanceOf(BaseDataIsolation::class, $context);
            self::assertSame('mock-org', $context->getCurrentOrganizationCode());
            self::assertSame('mock-user', $context->getCurrentUserId());
            self::assertSame('mock-magic', $context->getCurrentMagicId());
            self::assertSame('en_US', $context->getLanguage());
            self::assertSame('mock-app', $context->getCurrentAppId());
        }
        $context = DataIsolation::createByBaseDataIsolation(new BaseDataIsolation('mock-org', 'mock-user', 'mock-magic'));
        self::assertSame('mock-magic', $context->getCurrentMagicId());
        self::assertSame('', (new DataIsolation(null))->getCurrentUserId());
    }

    /** 旧空值和别名统一到 Base 状态，禁用可正常生效。 */
    public function testAliasesAndNullableCompatibility(): void
    {
        $context = new DataIsolation();
        $context->setCurrentUserId(null);
        $context->setThirdPartyOrganizationCode(null);
        self::assertSame('', $context->getCurrentUserId());
        self::assertSame('', $context->getThirdPartyOrganizationCode());
        $context->setCurrentMagicId('mock-id');
        self::assertSame('mock-id', $context->getMagicId());
        $context->setEnvironment('mock-environment');
        self::assertSame('mock-environment', $context->getEnvironment());
        self::assertSame('zh_CN', $context->getLanguage());
        self::assertFalse($context->disabled()->isEnable());
    }

    /** 同时传旧数组和新组织参数时拒绝歧义。 */
    public function testAmbiguousConstructorIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new DataIsolation('mock-org', data: ['current_organization_code' => 'mock-other']);
    }
}
