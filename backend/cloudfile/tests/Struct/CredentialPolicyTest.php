<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Struct;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * CredentialPolicy STS 权限表达式测试。
 */
class CredentialPolicyTest extends TestCase
{
    /**
     * 验证组合权限会被去重、排序并稳定输出。
     */
    public function testStsTypeExpressionIsNormalized(): void
    {
        $policy = new CredentialPolicy([
            'sts_type' => 'del_objects| upload_objects | list_objects | del_objects',
        ]);

        self::assertSame(['upload_objects', 'list_objects', 'del_objects'], $policy->getStsTypes());
        self::assertSame('upload_objects|list_objects|del_objects', $policy->getStsType());
    }

    /**
     * 验证追加权限不会覆盖已有权限。
     */
    public function testAddStsTypePreservesExistingTypes(): void
    {
        $policy = new CredentialPolicy(['sts_type' => 'upload_objects']);
        $policy->addStsType('list_objects');

        self::assertSame('upload_objects|list_objects', $policy->getStsType());
    }

    /**
     * 验证未指定类型时保留历史默认上传策略语义。
     */
    public function testEmptyStsTypeKeepsLegacyDefault(): void
    {
        $policy = new CredentialPolicy();

        self::assertSame('', $policy->getStsType());
        self::assertSame([], $policy->getStsTypes());
    }

    /**
     * 验证未知权限类型被拒绝。
     */
    public function testUnknownStsTypeIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new CredentialPolicy(['sts_type' => 'upload_objects|unknown']);
    }
}
