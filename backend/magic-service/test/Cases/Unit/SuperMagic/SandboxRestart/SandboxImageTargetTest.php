<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use PHPUnit\Framework\TestCase;

/**
 * 目标镜像的解析规则：发布版本、指定版本、以及两者混用.
 *
 * 这个值对象是"这次按哪一版镜像重启"的唯一出处，因此每条用例都对应一种运维会真的用到的组合：
 *
 * | 命令行                     | 目标 agent       | 目标 agfs        |
 * |---|---|---|
 * | 什么都不给                 | 发布版本         | 发布版本         |
 * | --agent-image=旧版         | 旧版（指定）     | 发布版本         |
 * | --agfs-image=旧版          | 发布版本         | 旧版（指定）     |
 * | 两个都给                   | 指定             | 指定             |
 *
 * @internal
 */
class SandboxImageTargetTest extends TestCase
{
    private const RELEASE = [
        'agent_image' => 'registry/agent:5.0.92@sha256:new',
        'agfs_image' => 'registry/agfs:1.0.14@sha256:agfsnew',
    ];

    public function testWithoutAnySpecifiedImageTheTargetIsTheGatewayRelease(): void
    {
        $target = SandboxImageTarget::release(self::RELEASE);

        self::assertSame(self::RELEASE['agent_image'], $target->getAgentImage());
        self::assertSame(self::RELEASE['agfs_image'], $target->getAgfsImage());
        self::assertFalse($target->hasSpecifiedImages());
        self::assertTrue($target->isComplete());
        self::assertSame([], $target->launchImages(), '未指定镜像时不向网关下发任何镜像字段');
    }

    public function testSpecifyingOnlyTheAgentImageKeepsAgfsOnTheRelease(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null);

        self::assertSame('registry/agent:5.0.77', $target->getAgentImage());
        self::assertSame(self::RELEASE['agfs_image'], $target->getAgfsImage(), '未指定的一侧继续跟随发布');
        self::assertTrue($target->hasSpecifiedImages());
        self::assertSame('registry/agent:5.0.77', $target->getSpecifiedAgentImage());
        self::assertNull($target->getSpecifiedAgfsImage());
    }

    public function testSpecifyingOnlyTheAgfsImageKeepsAgentOnTheRelease(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, null, 'registry/agfs:1.0.13');

        self::assertSame(self::RELEASE['agent_image'], $target->getAgentImage());
        self::assertSame('registry/agfs:1.0.13', $target->getAgfsImage());
    }

    public function testBlankStringsCountAsNotSpecified(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, '   ', '');

        self::assertFalse($target->hasSpecifiedImages(), '空白值不能把一次普通发布变成"指定镜像"');
        self::assertSame(self::RELEASE['agent_image'], $target->getAgentImage());
    }

    /**
     * 下发给网关的字段就是请求体里的镜像字段本身（agent_image / agfs_image）。
     *
     * 只要指定了任意一侧，就下发完整的"判定时目标镜像对"：重建出来的 pod 必须
     * 等于刚刚判定过的那一对。若只下发 agent 而让网关自己读 ConfigMap 决定 agfs，
     * 一旦发布恰好在本次执行期间滚到新 agfs，产出的 pod 就会与目标不一致，
     * dry-run 的结论和重建后的校验都会对不上。
     *
     * 未指定镜像时一律不下发，保持"跟随发布"的原有语义。
     */
    public function testLaunchImagesCarryTheCompleteTargetOnceAnythingIsSpecified(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null);

        self::assertSame(
            [
                'agent_image' => 'registry/agent:5.0.77',
                'agfs_image' => self::RELEASE['agfs_image'],
            ],
            $target->launchImages(),
            '指定 agent 时 agfs 取判定时的发布版本，保证 pod 与判定目标完全一致'
        );
    }

    public function testMatchesComparesBothImagesExactly(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null);

        self::assertTrue($target->matches([
            'agent_image' => 'registry/agent:5.0.77',
            'agfs_image' => self::RELEASE['agfs_image'],
        ]));

        // 同 tag 不同 digest 也算不一致：重新构建过的镜像必须重建才能生效。
        self::assertFalse($target->matches([
            'agent_image' => 'registry/agent:5.0.77',
            'agfs_image' => 'registry/agfs:1.0.14@sha256:other',
        ]));
        self::assertFalse($target->matches(['agent_image' => 'registry/agent:5.0.77']), '缺字段无法证明一致');
        self::assertFalse($target->matches(null));
    }

    public function testIncompleteTargetNeverMatchesAndIsReportedAsUnknown(): void
    {
        $target = SandboxImageTarget::release(['agent_image' => 'registry/agent:5.0.92', 'agfs_image' => '']);

        self::assertFalse($target->isComplete());
        self::assertFalse($target->matches(self::RELEASE), '目标不完整时不能声称"已经到位"');
        self::assertSame(
            'agent=registry/agent:5.0.92 (release), agfs=unknown (release)',
            $target->describe(),
            '读不到的镜像必须在输出里显示为 unknown，而不是空字段'
        );
    }

    public function testDescribeMarksWhichSidesWereSpecified(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', 'registry/agfs:1.0.13');

        self::assertSame(
            'agent=registry/agent:5.0.77 (specified), agfs=registry/agfs:1.0.13 (specified)',
            $target->describe()
        );
    }
}
