<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageVersion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use PHPUnit\Framework\TestCase;

/**
 * 镜像比较与 pod 快照的纯函数契约.
 *
 * 这两块是"要不要重启"的唯一判据，必须钉死：
 * 一次误判要么把老镜像留在集群里，要么每隔几秒重建一次沙箱。
 *
 * @internal
 */
class SandboxImageVersionTest extends TestCase
{
    public function testCompleteMatchingImagesAreUpToDate(): void
    {
        $images = ['agent_image' => 'registry/agent:5.0.92@sha256:new', 'agfs_image' => 'registry/agfs:1.0.14'];

        self::assertTrue(SandboxImageVersion::isComplete($images));
        self::assertFalse(SandboxImageVersion::compare($images, $images));
    }

    public function testAnyDifferentReferenceRequiresUpdate(): void
    {
        $latest = ['agent_image' => 'registry/agent:5.0.92', 'agfs_image' => 'registry/agfs:1.0.14'];

        // 只换 agent
        self::assertTrue(SandboxImageVersion::compare(['agent_image' => 'registry/agent:5.0.77', 'agfs_image' => 'registry/agfs:1.0.14'], $latest));
        // 只换 agfs
        self::assertTrue(SandboxImageVersion::compare(['agent_image' => 'registry/agent:5.0.92', 'agfs_image' => 'registry/agfs:1.0.13'], $latest));
        // 同 tag 不同 digest：镜像被重新构建过，仍然需要升级
        self::assertTrue(SandboxImageVersion::compare(['agent_image' => 'registry/agent:5.0.92@sha256:old', 'agfs_image' => 'registry/agfs:1.0.14'], $latest));
    }

    public function testIncompleteImagesAreUnknownRatherThanUpToDate(): void
    {
        $latest = ['agent_image' => 'registry/agent:5.0.92', 'agfs_image' => 'registry/agfs:1.0.14'];

        self::assertNull(SandboxImageVersion::compare(null, $latest));
        self::assertNull(SandboxImageVersion::compare(['agent_image' => 'registry/agent:5.0.92'], $latest));
        self::assertNull(SandboxImageVersion::compare(['agent_image' => '  ', 'agfs_image' => 'registry/agfs:1.0.14'], $latest));
        // 最新镜像本身不完整时同样无法判断
        self::assertNull(SandboxImageVersion::compare($latest, ['agent_image' => 'registry/agent:5.0.92']));
        self::assertNull(SandboxImageVersion::compare($latest, []));
    }

    public function testExtractTagIgnoresRegistryPortAndDigest(): void
    {
        // 只有 5.0.92 是 tag；5000 是端口，不能被当成 tag
        self::assertSame('5.0.92', SandboxImageVersion::extractTag('registry.example.com:5000/team/agent:5.0.92@sha256:abc'));
        self::assertSame('1.0.14', SandboxImageVersion::extractTag('registry/agfs:1.0.14'));
        // 没有 tag 只有 digest
        self::assertSame('', SandboxImageVersion::extractTag('registry/agent@sha256:abc'));
        self::assertSame('', SandboxImageVersion::extractTag(''));
        self::assertSame('', SandboxImageVersion::extractTag(null));
    }

    public function testSnapshotKeepsGatewayImageFieldsAndTreatsMissingAsUnknown(): void
    {
        $complete = SandboxPodSnapshot::fromGatewayArray([
            'sandbox_id' => 'warm-101',
            'status' => 'Running',
            'topic_id' => '101',
            'agent_image' => 'registry/agent:5.0.92',
            'agfs_image' => 'registry/agfs:1.0.14',
        ]);
        self::assertSame('registry/agent:5.0.92', $complete->getAgentImage());
        self::assertSame('registry/agfs:1.0.14', $complete->getAgfsImage());
        self::assertTrue(SandboxImageVersion::isComplete($complete->getImages()));

        // 老网关不返回镜像字段：必须是空串（未知），不能顺手当成"已是最新"
        $legacy = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => '101', 'status' => 'Running']);
        self::assertSame('', $legacy->getAgentImage());
        self::assertFalse(SandboxImageVersion::isComplete($legacy->getImages()));
    }

    public function testSnapshotDistinguishesUnboundWarmPoolFromBoundSandbox(): void
    {
        $unbound = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'w', 'warm_pool' => true, 'bound' => false]);
        $bound = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'b', 'warm_pool' => true, 'bound' => true]);
        $cold = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'c']);

        self::assertTrue($unbound->isUnboundWarmPool());
        self::assertFalse($bound->isUnboundWarmPool());
        self::assertFalse($cold->isUnboundWarmPool());
    }

    public function testUnknownCreationTimeSortsLastInsteadOfFirst(): void
    {
        $unknown = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'u']);
        $ancient = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'a', 'created_at' => '2026-09-01T08:30:00Z']);
        $broken = SandboxPodSnapshot::fromGatewayArray(['sandbox_id' => 'x', 'created_at' => 'not-a-date']);

        self::assertSame(PHP_INT_MAX, $unknown->getCreatedAtTimestamp());
        self::assertSame(PHP_INT_MAX, $broken->getCreatedAtTimestamp(), '无法解析的时间按未知处理，不能当成 1970 抢跑');
        self::assertLessThan($unknown->getCreatedAtTimestamp(), $ancient->getCreatedAtTimestamp());
        self::assertSame('u@unknown', $unknown->describe());
        self::assertSame('a@2026-09-01T08:30:00Z', $ancient->describe());
    }
}
