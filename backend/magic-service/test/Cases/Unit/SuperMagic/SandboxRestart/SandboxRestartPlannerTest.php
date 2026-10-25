<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartPlan;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartReason;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxTopicBinding;
use App\Domain\SuperMagic\Task\Service\SandboxRestartPlanner;
use PHPUnit\Framework\TestCase;

/**
 * 重启计划生成的判定规则.
 *
 * 每一个用例都对应线上一种真实形态：镜像已最新、只有 agfs 变了、老网关没有镜像字段、
 * 同一话题漂移出两个 pod、温池 pod、找不到话题的孤儿、缺少 owner 的历史数据。
 *
 * @internal
 */
class SandboxRestartPlannerTest extends TestCase
{
    private const LATEST = [
        'agent_image' => 'registry/agent:5.0.92',
        'agfs_image' => 'registry/agfs:1.0.14',
    ];

    private SandboxRestartPlanner $planner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = new SandboxRestartPlanner();
    }

    public function testUpToDateSandboxIsNotRestarted(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, self::LATEST['agent_image'], self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
        );

        self::assertSame([], $plan->getTargets());
        self::assertSame(1, $plan->getUpToDateTopics());
        self::assertTrue($plan->isEmpty());
    }

    public function testAgentImageDriftRequiresRestart(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
        );

        self::assertCount(1, $plan->getTargets());
        self::assertSame(SandboxRestartReason::AgentImageOutdated, $plan->getTargets()[0]->getReason());
        self::assertSame([101], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
    }

    public function testAgfsImageDriftRequiresRestart(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, self::LATEST['agent_image'], 'registry/agfs:1.0.13')],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
        );

        self::assertSame(SandboxRestartReason::AgfsImageOutdated, $plan->getTargets()[0]->getReason());
    }

    public function testPodWithoutImageInformationRequiresRestart(): void
    {
        // 老网关不返回镜像字段：无法证明已最新，发布场景必须重建。
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, '', '')],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
        );

        self::assertSame(SandboxRestartReason::ImagesUnknown, $plan->getTargets()[0]->getReason());
    }

    public function testForceRestartsEvenWhenImagesAreCurrent(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, self::LATEST['agent_image'], self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
            force: true,
        );

        self::assertSame(SandboxRestartReason::Forced, $plan->getTargets()[0]->getReason());
        self::assertSame(0, $plan->getUpToDateTopics());
    }

    public function testDuplicatePodsOfOneTopicAreAllDeletedAndTopicRebuiltOnce(): void
    {
        // 现网症状：话题表 sandbox_id 与实际 pod 漂移，同一话题并存旧 pod 和新 pod。
        $plan = $this->plan(
            pods: [
                $this->pod('9675582091886593', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'], '2026-10-10T14:30:00Z'),
                $this->pod('941300468243693569', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'], '2026-07-30T03:52:00Z'),
            ],
            bindings: [$this->binding(101, 11, '9675582091886593')],
        );

        self::assertCount(1, $plan->getTargets(), '同一话题只重建一次');
        $target = $plan->getTargets()[0];
        self::assertSame(
            ['941300468243693569', '9675582091886593'],
            $target->getSandboxIds(),
            '两个 pod 都要删，且最老的排在前面'
        );
        self::assertTrue($target->hasDuplicatePods());
        self::assertSame(1, $plan->getDuplicateTopicCount());
    }

    public function testMixedOldAndCurrentPodsStillRequireRestart(): void
    {
        // 新 pod 已是最新，但老 pod 还在跑旧镜像：必须整组处理，否则老 pod 永远留着。
        $plan = $this->plan(
            pods: [
                $this->pod('new', 101, self::LATEST['agent_image'], self::LATEST['agfs_image'], '2026-10-10T00:00:00Z'),
                $this->pod('old', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'], '2026-08-01T00:00:00Z'),
            ],
            bindings: [$this->binding(101, 11, 'new')],
        );

        self::assertCount(1, $plan->getTargets());
        self::assertSame(SandboxRestartReason::AgentImageOutdated, $plan->getTargets()[0]->getReason());
    }

    public function testOutdatedUnboundWarmPoolPodIsDeletedButNotRebuilt(): void
    {
        $warm = $this->warmPoolPod('warm-900', 'registry/agent:5.0.77', self::LATEST['agfs_image']);

        $plan = $this->plan(pods: [$warm], bindings: []);

        self::assertSame([], $plan->getTargets());
        self::assertCount(1, $plan->getDeletions());
        self::assertSame('warm-900', $plan->getDeletions()[0]->getPod()->getSandboxId());
        self::assertSame('unbound warm-pool sandbox on outdated images', $plan->getDeletions()[0]->getReason());
    }

    /**
     * 池子里已经是最新镜像的 pod 不必删：删掉它不会让本批任何沙箱变快，
     * 只会让补货流程把同样的 pod 再造一遍（冷启动、拉镜像、等 sidecar 就绪）。
     */
    public function testUnboundWarmPoolPodOnTheReleaseImagesIsKept(): void
    {
        $plan = $this->plan(
            pods: [$this->warmPoolPod('warm-900', self::LATEST['agent_image'], self::LATEST['agfs_image'])],
            bindings: [],
        );

        self::assertSame([], $plan->getDeletions(), '已是最新镜像的池 pod 不该被删');
        self::assertSame(1, $plan->getSkippedPodCount());
        self::assertArrayHasKey('unbound warm-pool pod already runs the release images', $plan->getSkippedByReason());
        self::assertTrue($plan->isEmpty(), '无事可做时计划应为空，命令输出"无需重启"');
    }

    /**
     * 只有 agfs 落后也算落后：池 pod 是两个容器的组合，任何一个不是发布版本都要换。
     */
    public function testWarmPoolPodWithOnlyAgfsBehindIsDeleted(): void
    {
        $plan = $this->plan(
            pods: [$this->warmPoolPod('warm-900', self::LATEST['agent_image'], 'registry/agfs:1.0.13')],
            bindings: [],
        );

        self::assertCount(1, $plan->getDeletions());
    }

    /**
     * 镜像字段缺失的池 pod 无法证明已最新，按保守方向删除（补货会立刻补上一个新的）。
     * 这与话题侧 ImagesUnknown 是同一口径。
     */
    public function testWarmPoolPodWithoutImageInformationIsDeleted(): void
    {
        $plan = $this->plan(
            pods: [$this->warmPoolPod('warm-900', '', '')],
            bindings: [],
        );

        self::assertCount(1, $plan->getDeletions(), '无法证明已最新时必须替换');
    }

    /**
     * --force 仍然强删已最新的池 pod：它用来处理"镜像引用没变但配置漂移"这类
     * 无法从镜像判断的情况，此时必须给出一个真正的新 pod。
     */
    public function testForceStillReplacesUpToDateWarmPoolPods(): void
    {
        $plan = $this->plan(
            pods: [$this->warmPoolPod('warm-900', self::LATEST['agent_image'], self::LATEST['agfs_image'])],
            bindings: [],
            force: true,
        );

        self::assertCount(1, $plan->getDeletions());
    }

    public function testOrphanPodIsDeletedButNotRebuilt(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-999', 999, 'registry/agent:5.0.77', self::LATEST['agfs_image'])],
            bindings: [],
        );

        self::assertSame([], $plan->getTargets());
        self::assertCount(1, $plan->getDeletions());
        self::assertSame('no topic owns this sandbox', $plan->getDeletions()[0]->getReason());
    }

    public function testTopicWithoutOwnerIsSkippedNotRebuilt(): void
    {
        // 历史数据可能缺 user/org，重建需要 owner 身份发 STS，硬来只会中途中止。
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101', userId: '', orgCode: '')],
        );

        self::assertSame([], $plan->getTargets());
        self::assertSame([], $plan->getDeletions());
        self::assertSame(1, $plan->getSkippedPodCount());
        self::assertArrayHasKey('topic owner is incomplete', $plan->getSkippedByReason());
    }

    public function testMagicClawScopeIgnoresRegularProjectsAndSharedPods(): void
    {
        $warm = SandboxPodSnapshot::fromGatewayArray([
            'sandbox_id' => 'warm-900',
            'warm_pool' => true,
            'bound' => false,
        ]);
        $plan = $this->plan(
            pods: [
                $this->pod('sandbox-101', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image']), // claw 项目
                $this->pod('sandbox-201', 201, 'registry/agent:5.0.77', self::LATEST['agfs_image']), // 普通项目
                $warm,
            ],
            bindings: [$this->binding(101, 11, 'sandbox-101'), $this->binding(201, 21, 'sandbox-201')],
            scope: SandboxRestartScope::MagicClaw,
            scopeProjectIds: [11],
        );

        self::assertSame([101], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
        self::assertSame([], $plan->getDeletions(), 'Claw 范围不能删共享温池 pod');
        self::assertSame(2, $plan->getSkippedPodCount(), '普通项目与温池 pod 都记为跳过');
        self::assertArrayHasKey(
            'unbound warm-pool pod is not part of this scope',
            $plan->getSkippedByReason(),
            '温池 pod 的跳过原因必须与"项目不在范围内"区分开'
        );
    }

    /**
     * 指定镜像的运行时，共享温池不属于本次目标：池子永远预热的是"当前发布"，
     * 删掉它不会让本批沙箱更快，只会让别人在补货前领不到预热沙箱。
     */
    public function testWarmPoolIsSkippedRatherThanEmptiedWhenAnImageIsSpecified(): void
    {
        $warm = SandboxPodSnapshot::fromGatewayArray([
            'sandbox_id' => 'warm-900',
            'warm_pool' => true,
            'bound' => false,
            'agent_image' => self::LATEST['agent_image'],
            'agfs_image' => self::LATEST['agfs_image'],
        ]);

        $plan = $this->plan(
            pods: [$warm],
            bindings: [],
            target: SandboxImageTarget::withSpecifiedImages(self::LATEST, 'registry/agent:5.0.77', null),
        );

        self::assertSame([], $plan->getDeletions(), '指定镜像时不能清空共享温池');
        self::assertSame([], $plan->getTargets());
        self::assertArrayHasKey(
            'unbound warm-pool pod keeps the release images, which the specified images do not replace',
            $plan->getSkippedByReason()
        );
    }

    /**
     * 回滚方向同样要被识别：pod 跑的是"更新"的发布版本，而目标是指定的旧版本，
     * 这也算需要重启——否则回滚演练会得到"无事可做"的假结论。
     */
    public function testPodNewerThanTheSpecifiedTargetStillNeedsRestart(): void
    {
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, self::LATEST['agent_image'], self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
            target: SandboxImageTarget::withSpecifiedImages(self::LATEST, 'registry/agent:5.0.77', null),
        );

        self::assertCount(1, $plan->getTargets());
        self::assertSame(SandboxRestartReason::AgentImageOutdated, $plan->getTargets()[0]->getReason());
        self::assertSame(0, $plan->getUpToDateTopics());
    }

    /**
     * 指定了目标后，"已是最新"的判定基准随之改变：
     * pod 与指定目标一致就算到位，不再和网关发布版本比较。
     */
    public function testPodAlreadyOnTheSpecifiedTargetIsUpToDate(): void
    {
        $specified = 'registry/agent:5.0.77';
        $plan = $this->plan(
            pods: [$this->pod('sandbox-101', 101, $specified, self::LATEST['agfs_image'])],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
            target: SandboxImageTarget::withSpecifiedImages(self::LATEST, $specified, null),
        );

        self::assertSame([], $plan->getTargets());
        self::assertSame(1, $plan->getUpToDateTopics());
    }

    /**
     * 计划必须带上目标镜像，命令输出与执行校验都以它为准。
     */
    public function testPlanCarriesTheResolvedTarget(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::LATEST, 'registry/agent:5.0.77', null);
        $plan = $this->plan(pods: [], bindings: [], target: $target);

        self::assertTrue($plan->getTarget()->hasSpecifiedImages());
        self::assertSame('registry/agent:5.0.77', $plan->getTarget()->getAgentImage());
    }

    public function testLegacyNumericSandboxIdRequiresMatchingTopicBinding(): void
    {
        // 无 topic-id 标签时用数字 sandbox_id 兜底，但话题记录的 sandbox_id 必须吻合，
        // 否则温池雪花 ID 可能撞上真实话题 ID。
        $plan = $this->plan(
            pods: [
                SandboxPodSnapshot::fromGatewayArray([
                    'sandbox_id' => '102',
                    'status' => 'Running',
                    'agent_image' => 'registry/agent:5.0.77',
                    'agfs_image' => self::LATEST['agfs_image'],
                ]),
                SandboxPodSnapshot::fromGatewayArray([
                    'sandbox_id' => '103',
                    'status' => 'Running',
                    'agent_image' => 'registry/agent:5.0.77',
                    'agfs_image' => self::LATEST['agfs_image'],
                ]),
            ],
            bindings: [
                $this->binding(102, 12, '102'),
                $this->binding(103, 13, 'warm-303'),
            ],
        );

        self::assertSame([102], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
        self::assertCount(1, $plan->getDeletions(), '对不上的数字 id 按孤儿清理，不能误重启别的话题');
    }

    public function testTargetsAreOrderedOldestFirst(): void
    {
        $plan = $this->plan(
            pods: [
                $this->pod('a', 101, 'old', self::LATEST['agfs_image'], '2026-10-10T00:00:00Z'),
                $this->pod('b', 102, 'old', self::LATEST['agfs_image'], '2026-09-01T00:00:00Z'),
                $this->pod('c', 103, 'old', self::LATEST['agfs_image'], ''),
            ],
            bindings: [
                $this->binding(101, 11, 'a'),
                $this->binding(102, 12, 'b'),
                $this->binding(103, 13, 'c'),
            ],
        );

        self::assertSame([102, 101, 103], array_map(
            static fn ($t) => $t->getTopicId(),
            $plan->getTargetsOldestFirst()
        ), '跑得最久的先重启；时间未知的排最后');
    }

    /**
     * 点名一个沙箱时只处理它所属的话题，其它话题原样跳过。
     */
    public function testSandboxIdRestrictsThePlanToItsTopic(): void
    {
        $plan = $this->plan(
            pods: [
                $this->pod('sandbox-101', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image']),
                $this->pod('sandbox-202', 202, 'registry/agent:5.0.77', self::LATEST['agfs_image']),
            ],
            bindings: [$this->binding(101, 11, 'sandbox-101'), $this->binding(202, 12, 'sandbox-202')],
            topicIds: [202],
        );

        self::assertSame([202], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
        self::assertArrayHasKey('not one of the sandboxes named by --sandbox-id', $plan->getSkippedByReason());
    }

    /**
     * 话题漂移出多个 pod 时，只点名其中一个也必须把整组换掉：
     * 只删点名的那个，另一个旧 pod 会立刻变成新的漂移。
     */
    public function testSandboxIdSelectionStillReplacesEveryPodOfThatTopic(): void
    {
        $plan = $this->plan(
            pods: [
                $this->pod('new', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image'], '2026-10-10T00:00:00Z'),
                $this->pod('old', 101, 'registry/agent:5.0.70', self::LATEST['agfs_image'], '2026-08-01T00:00:00Z'),
            ],
            bindings: [$this->binding(101, 11, 'new')],
            topicIds: [101],
        );

        self::assertCount(1, $plan->getTargets());
        self::assertSame(['old', 'new'], $plan->getTargets()[0]->getSandboxIds(), '同话题的两个 pod 都要换掉');
    }

    /**
     * 点名具体沙箱是"精确操作"：绝不能顺手清空共享温池或删掉无关孤儿。
     */
    public function testSandboxIdSelectionLeavesWarmPoolAndOrphansAlone(): void
    {
        $outdatedWarm = $this->warmPoolPod('warm-900', 'registry/agent:5.0.77', self::LATEST['agfs_image']);
        $plan = $this->plan(
            pods: [
                $this->pod('sandbox-101', 101, 'registry/agent:5.0.77', self::LATEST['agfs_image']),
                $this->pod('sandbox-999', 999, 'registry/agent:5.0.77', self::LATEST['agfs_image']),
                $outdatedWarm,
            ],
            bindings: [$this->binding(101, 11, 'sandbox-101')],
            topicIds: [101],
        );

        self::assertSame([], $plan->getDeletions(), '点名模式下不做任何只删不建的动作');
        self::assertSame(['sandbox-999', 'warm-900'], array_map(
            static fn (SandboxPodSnapshot $pod): string => $pod->getSandboxId(),
            $plan->getSkippedByReason()['not one of the sandboxes named by --sandbox-id']
        ));
    }

    /**
     * 点名解析：话题去重、无法归属与不存在的 id 都要报出来。
     */
    public function testResolveTopicIdsForSandboxIdsReportsUnmatchedIds(): void
    {
        $pods = [
            $this->pod('sandbox-101', 101, self::LATEST['agent_image'], self::LATEST['agfs_image']),
            $this->pod('sandbox-102', 101, self::LATEST['agent_image'], self::LATEST['agfs_image']),
            $this->warmPoolPod('warm-900', self::LATEST['agent_image'], self::LATEST['agfs_image']),
        ];
        $bindings = [101 => $this->binding(101, 11, 'sandbox-101')];

        [$topicIds, $unmatched] = $this->planner->resolveTopicIdsForSandboxIds(
            $pods,
            $bindings,
            ['sandbox-101', 'sandbox-102', 'warm-900', 'typo-404']
        );

        self::assertSame([101], $topicIds, '同一话题的多个 pod 只产出一个话题');
        self::assertSame(['warm-900', 'typo-404'], $unmatched, '未绑定温池与不存在的 id 都要报出来');
    }

    /**
     * @param SandboxPodSnapshot[] $pods
     * @param SandboxTopicBinding[] $bindings
     */
    private function plan(
        array $pods,
        array $bindings,
        bool $force = false,
        SandboxRestartScope $scope = SandboxRestartScope::All,
        array $scopeProjectIds = [],
        ?SandboxImageTarget $target = null,
        array $topicIds = [],
    ): SandboxRestartPlan {
        $bindingsById = [];
        foreach ($bindings as $binding) {
            $bindingsById[$binding->getTopicId()] = $binding;
        }

        return $this->planner->plan(
            pods: $pods,
            bindingsByTopicId: $bindingsById,
            target: $target ?? SandboxImageTarget::release(self::LATEST),
            force: $force,
            scope: $scope,
            scopeProjectIds: $scopeProjectIds,
            topicIds: $topicIds,
        );
    }

    private function warmPoolPod(string $sandboxId, string $agentImage, string $agfsImage): SandboxPodSnapshot
    {
        return SandboxPodSnapshot::fromGatewayArray([
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'warm_pool' => true,
            'bound' => false,
            'agent_image' => $agentImage,
            'agfs_image' => $agfsImage,
        ]);
    }

    private function pod(
        string $sandboxId,
        int $topicId,
        string $agentImage,
        string $agfsImage,
        string $createdAt = '2026-09-01T00:00:00Z',
    ): SandboxPodSnapshot {
        return SandboxPodSnapshot::fromGatewayArray([
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'topic_id' => (string) $topicId,
            'bound' => true,
            'created_at' => $createdAt,
            'agent_image' => $agentImage,
            'agfs_image' => $agfsImage,
        ]);
    }

    private function binding(
        int $topicId,
        int $projectId,
        string $sandboxId,
        string $userId = 'user-1',
        string $orgCode = 'org-1',
    ): SandboxTopicBinding {
        return new SandboxTopicBinding($topicId, $projectId, $userId, $orgCode, $sandboxId);
    }
}
