<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Utils;

use Dtyq\CloudFile\Kernel\Utils\StsPolicyBuilder;
use PHPUnit\Framework\TestCase;

/**
 * 云存储 STS 组合策略测试。
 */
class StsPolicyBuilderTest extends TestCase
{
    /**
     * 验证 OSS 组合权限生成独立 Statement。
     */
    public function testBuildOssPolicyWithMultipleTypes(): void
    {
        $policy = (new StsPolicyBuilder())->buildOss(
            'mock-bucket',
            'mock-dir/',
            ['upload_objects', 'list_objects', 'del_objects']
        );

        self::assertCount(3, $policy['Statement']);
        self::assertSame(['oss:PutObject', 'oss:AbortMultipartUpload', 'oss:GetObject', 'oss:ListParts', 'oss:GetObjectMeta'], $policy['Statement'][0]['Action']);
        self::assertSame(['oss:ListObjects', 'oss:ListObjectVersions'], $policy['Statement'][1]['Action']);
        self::assertSame(['oss:DeleteObject', 'oss:DeleteObjectVersion', 'oss:DeleteObjectTagging', 'oss:DeleteObjectVersionTagging'], $policy['Statement'][2]['Action']);
    }

    /**
     * 验证 S3 空目录仍覆盖整个 bucket 的对象资源。
     */
    public function testBuildS3PolicyKeepsLegacyEmptyDirectoryResource(): void
    {
        $policy = (new StsPolicyBuilder())->buildS3('mock-bucket', '', []);

        self::assertSame('arn:aws:s3:::mock-bucket', $policy['Statement'][0]['Resource']);
    }

    /**
     * 验证重复的等价权限不会产生重复 Statement。
     */
    public function testBuildTosPolicyDeduplicatesEquivalentStatements(): void
    {
        $policy = (new StsPolicyBuilder())->buildTos(
            'mock-bucket',
            'mock-dir/',
            ['upload_objects', 'set_object_meta']
        );

        self::assertCount(1, $policy['Statement']);
        self::assertSame([
            'tos:AppendObject',
            'tos:PutObject',
            'tos:GetObject',
            'tos:AbortMultipartUpload',
            'tos:ListMultipartUploadParts',
            'tos:GetObjectVersion',
        ], $policy['Statement'][0]['Action']);
    }
}
