<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Application\SuperMagic\Task\Contract\SandboxRebuildPortInterface;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOptions;
use App\Application\SuperMagic\Task\DTO\SandboxRestartResult;
use App\Application\SuperMagic\Task\Service\SandboxRestartAppService;
use App\Application\SuperMagic\Task\Service\SandboxRestartBatchRunner;
use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodDeletion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartPlan;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartReason;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxTopicBinding;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\SandboxRestartPlanner;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxListResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * 重启编排：计划 → 挂起在途任务 → 删旧 pod → 按最新镜像重建.
 *
 * 重点钉三件事：
 * 1. 没有最新镜像标准时不做盲目全量重启（除非 --force）；
 * 2. 挂起任务发生在删除 pod 之前，且 waiting_for_user 也要挂起；
 * 3. 删除失败不阻断重建，但必须出现在结果里，不能被"成功"吞掉。
 *
 * @internal
 */
class SandboxRestartAppServiceTest extends TestCase
{
    private const LATEST = [
        'agent_image' => 'registry/agent:5.0.92',
        'agfs_image' => 'registry/agfs:1.0.14',
    ];

    public function testPlanRejectsBlindRestartWhenLatestImagesUnavailable(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: ['agent_image' => '', 'agfs_image' => '']
        );

        $service = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')]);

        $this->expectExceptionMessage('refusing to guess whether a restart is needed');
        $service->plan(new SandboxRestartOptions());
    }

    public function testForceAllowsPlanningWithoutLatestImages(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: ['agent_image' => '', 'agfs_image' => '']
        );

        $plan = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')])
            ->plan(new SandboxRestartOptions(force: true));

        self::assertSame([101], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
    }

    public function testPlanAppliesLimitAfterOldestFirstOrdering(): void
    {
        $gateway = $this->gateway(
            pods: [
                $this->podArray('a', 101, 'old', '2026-10-10T00:00:00Z'),
                $this->podArray('b', 102, 'old', '2026-09-01T00:00:00Z'),
            ],
            latestImages: self::LATEST
        );
        $service = $this->service($gateway, [$this->topic(101, 11, 'a'), $this->topic(102, 12, 'b')]);

        $plan = $service->plan(new SandboxRestartOptions(limit: 1));

        self::assertSame([102], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
        self::assertSame(2, $plan->getListedPods());
    }

    public function testMagicClawScopeResolvesAllowedProjectsFromClawRecords(): void
    {
        $gateway = $this->gateway(
            pods: [
                $this->podArray('a', 101, 'old'),
                $this->podArray('b', 201, 'old'),
            ],
            latestImages: self::LATEST
        );
        $spy = new SandboxRestartClawSpy();
        $claws = new SandboxRestartClawStub([
            11 => $this->claw('claw-1', 11),
            21 => $this->claw('claw-2', 21),
        ], $spy);

        $service = $this->service(
            $gateway,
            [$this->topic(101, 11, 'a'), $this->topic(201, 21, 'b')],
            claws: $claws
        );

        $plan = $service->plan(new SandboxRestartOptions(scope: SandboxRestartScope::MagicClaw, clawCode: 'claw-2'));

        self::assertSame([201], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
        self::assertSame([11, 21], $spy->requestedProjectIds, '只查一次，且包含清单里所有项目');
    }

    /**
     * 指定镜像必须真的改变判定基准：pod 跑在 5.0.77、发布是 5.0.92，
     * 把目标指定成 5.0.77 后就应当判为"已经到位"，什么都不用做。
     *
     * 这条用例同时是回滚演练的说明书：先指定旧镜像重启，再不带参数 dry-run，
     * 两者结论相反，正好证明重启命令确实换了镜像。
     */
    public function testSpecifiedImageBecomesTheTargetThatPodsAreComparedAgainst(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: self::LATEST
        );
        $service = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')]);

        $plan = $service->plan(new SandboxRestartOptions(requestedAgentImage: 'registry/agent:5.0.77'));

        self::assertSame([], $plan->getTargets(), 'pod 已经在指定镜像上，无需重启');
        self::assertSame(1, $plan->getUpToDateTopics());
        self::assertSame('registry/agent:5.0.77', $plan->getTarget()->getAgentImage());
        self::assertSame(self::LATEST['agfs_image'], $plan->getTarget()->getAgfsImage(), '未指定的一侧跟随发布');
    }

    /**
     * 目标完全解析不出来时（发布镜像读不到、也没指定）必须拒绝执行，
     * 并且错误信息要指出"可以用什么参数补救"。
     */
    public function testUnresolvableTargetFailsWithAnActionableMessage(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: ['agent_image' => '', 'agfs_image' => '']
        );
        $service = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')]);

        $this->expectExceptionMessage('--agent-image');
        $service->plan(new SandboxRestartOptions());
    }

    /**
     * 计划里的目标必须原样交给重建端口：编排层不重新解析、不偷换版本，
     * 否则"判定用 A 版本、重建用 B 版本"这种偏差无从发现。
     */
    public function testExecuteHandsThePlanTargetToTheRebuildPort(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.92')],
            latestImages: self::LATEST
        );
        $target = SandboxImageTarget::withSpecifiedImages(self::LATEST, 'registry/agent:5.0.77', null);
        $log = new SandboxRestartCallLog();
        $service = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')], null, null, null, new SandboxRestartPortStub($log));

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 1,
            target: $target,
        );

        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame(1, $outcome->getRestartedCount());
        self::assertSame($target, $log->rebuildTargets[101] ?? null, '重建端口必须收到同一份目标镜像');
    }

    /**
     * 点名的沙箱只处理它所属的话题，其它话题不动。
     */
    public function testSandboxIdNarrowsThePlanToItsTopic(): void
    {
        $gateway = $this->gateway(
            pods: [
                $this->podArray('sandbox-101', 101, 'registry/agent:5.0.77'),
                $this->podArray('sandbox-202', 202, 'registry/agent:5.0.77'),
            ],
            latestImages: self::LATEST
        );
        $service = $this->service($gateway, [
            $this->topic(101, 11, 'sandbox-101'),
            $this->topic(202, 12, 'sandbox-202'),
        ]);

        $plan = $service->plan(new SandboxRestartOptions(sandboxIds: ['sandbox-202']));

        self::assertSame([202], array_map(static fn ($t) => $t->getTopicId(), $plan->getTargets()));
    }

    /**
     * 打错一个字符必须立刻失败：这类命令最坏的失败模式是"什么都没做却看起来成功"。
     */
    public function testUnknownSandboxIdFailsBeforeAnythingHappens(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: self::LATEST
        );
        $service = $this->service($gateway, [$this->topic(101, 11, 'sandbox-101')]);

        $this->expectExceptionMessage('typo-404');
        $service->plan(new SandboxRestartOptions(sandboxIds: ['sandbox-101', 'typo-404']));
    }

    /**
     * 未绑定温池的沙箱没有 owner，无法"重建"，同样要报出来而不是静默跳过。
     */
    public function testUnboundWarmPoolSandboxIdIsRejected(): void
    {
        $gateway = $this->gateway(
            pods: [$this->warmPoolPodArray('warm-900')],
            latestImages: self::LATEST
        );
        $service = $this->service($gateway, []);

        $this->expectExceptionMessage('warm-900');
        $service->plan(new SandboxRestartOptions(sandboxIds: ['warm-900']));
    }

    public function testExecuteSuspendsActiveWorkBeforeDeletingPods(): void
    {
        $gateway = $this->gateway(
            pods: [$this->podArray('sandbox-101', 101, 'registry/agent:5.0.77')],
            latestImages: self::LATEST
        );
        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->method('getTopicsByIds')->willReturn([$this->topic(101, 11, 'sandbox-101')]);
        $taskService = $this->createMock(TaskDomainService::class);

        $log = new SandboxRestartCallLog();
        $topicService->expects(self::once())->method('updateTopicStatusBySandboxIds')
            ->willReturnCallback(function (array $sandboxIds, TaskStatus $status, array $from) use ($log) {
                $log->calls[] = 'suspend_topics';
                self::assertSame(['sandbox-101'], $sandboxIds);
                self::assertSame(TaskStatus::Suspended, $status);
                self::assertContains(TaskStatus::WAITING_FOR_USER, $from, '等用户回答的任务也必须挂起');
                return true;
            });
        $taskService->method('updateTaskStatusByTopicIds')->willReturnCallback(function (array $topicIds, TaskStatus $status) use ($log) {
            $log->calls[] = 'suspend_tasks';
            self::assertSame([101], $topicIds);
            self::assertSame(TaskStatus::Suspended, $status);
            return 3;
        });

        $port = new SandboxRestartPortStub($log);
        $service = $this->service($gateway, [], $topicService, $taskService, null, $port);

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 1,
            target: SandboxImageTarget::release(self::LATEST),
        );

        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame(['suspend_topics', 'suspend_tasks', 'delete:sandbox-101', 'rebuild:101'], $log->calls);
        self::assertSame(3, $outcome->getSuspendedTasks());
        self::assertSame(1, $outcome->getSuspendedTopics());
        self::assertSame(1, $outcome->getRestartedCount());
        self::assertSame(0, $outcome->getFailedCount());
        self::assertSame('new-sandbox-101', $outcome->getResults()[0]->getNewSandboxId());
    }

    public function testDeleteFailureDoesNotBlockRebuildButIsReported(): void
    {
        $gateway = $this->gateway(pods: [], latestImages: self::LATEST);
        $port = new SandboxRestartPortStub(new SandboxRestartCallLog(), failDeletes: ['sandbox-101']);
        $service = $this->service($gateway, [], null, null, null, $port);

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 1,
            target: SandboxImageTarget::release(self::LATEST),
        );

        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame(1, $outcome->getRestartedCount(), '删不掉也要继续重建，否则永远卡在旧镜像');
        self::assertSame(['sandbox-101'], $outcome->getResults()[0]->getFailedSandboxIds());
        self::assertTrue($outcome->hasFailures(), '删除失败必须让命令返回非零退出码');
    }

    public function testFailedRebuildIsReportedSeparatelyFromSuccess(): void
    {
        $gateway = $this->gateway(pods: [], latestImages: self::LATEST);
        $port = new SandboxRestartPortStub(new SandboxRestartCallLog(), failRebuild: [101]);
        $service = $this->service($gateway, [], null, null, null, $port);

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101'), $this->target(102, 12, 'sandbox-102')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 2,
            target: SandboxImageTarget::release(self::LATEST),
        );

        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame(1, $outcome->getRestartedCount());
        self::assertSame(1, $outcome->getFailedCount());
        self::assertTrue($outcome->hasFailures());
        $failed = array_values(array_filter($outcome->getResults(), static fn ($r) => ! $r->isRestarted()));
        self::assertSame(101, $failed[0]->getTopicId());
        self::assertStringContainsString('rebuild exploded', $failed[0]->getError());
    }

    public function testOrphanAndWarmPoolPodsAreDeletedWithoutRebuild(): void
    {
        $gateway = $this->gateway(pods: [$this->warmPoolPodArray('warm-900')], latestImages: self::LATEST);
        $log = new SandboxRestartCallLog();
        $service = $this->service($gateway, [], null, null, null, new SandboxRestartPortStub($log));

        // 走真实的 plan()：池 pod 不是话题，只进 deletions。
        $plan = $service->plan(new SandboxRestartOptions());
        self::assertSame([], $plan->getTargets());
        self::assertCount(1, $plan->getDeletions());

        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame(['delete:warm-900'], $log->calls);
        self::assertCount(1, $outcome->getDeletedPods());
        self::assertSame(0, $outcome->getRestartedCount());
        self::assertFalse($outcome->hasFailures());
    }

    /**
     * 重建会去温池领 pod：计划里"未绑定"的池 pod 可能在本批重建中被话题领走
     * （挂载成功后 pod 会带上 topic-id 标签）。清理阶段必须按"现在还有没有主人"
     * 重新判断，绝不能照旧快照删掉刚挂出去的新沙箱。
     */
    public function testCleanupKeepsWarmPoolPodThatGotClaimedDuringTheRestart(): void
    {
        $gateway = $this->gateway(
            pods: [$this->warmPoolPodArray('warm-900')],
            latestImages: self::LATEST,
            reloadPods: [$this->warmPoolPodArray('warm-900', topicId: '101')],
        );
        $log = new SandboxRestartCallLog();
        $service = $this->service($gateway, [], null, null, null, new SandboxRestartPortStub($log));

        $plan = $service->plan(new SandboxRestartOptions());
        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame([], $log->calls, '已经被话题领走的沙箱不能再删');
        self::assertCount(0, $outcome->getDeletedPods());
        self::assertFalse($outcome->hasFailures(), '主动保留不是失败');
    }

    /**
     * 清理前无法确认归属（网关列不出清单）时，宁可漏清理也不能误删：
     * 每个待删项都要出现在删除失败里，让命令以非零退出码收尾。
     */
    public function testCleanupIsSkippedWhenOwnershipCannotBeReverified(): void
    {
        $gateway = $this->gateway(
            pods: [$this->warmPoolPodArray('warm-900')],
            latestImages: self::LATEST,
            reloadResult: SandboxListResult::fromApiResponse([
                'code' => ResponseCode::ERROR,
                'message' => 'gateway unavailable',
                'data' => [],
            ])
        );
        $log = new SandboxRestartCallLog();
        $service = $this->service($gateway, [], null, null, null, new SandboxRestartPortStub($log));

        $plan = $service->plan(new SandboxRestartOptions());
        $outcome = $service->execute($plan, new SandboxRestartOptions());

        self::assertSame([], $log->calls);
        self::assertSame(1, $outcome->getDeleteFailureCount());
        self::assertTrue($outcome->hasFailures());
        self::assertStringContainsString('could not be re-verified', $outcome->getDeletionFailures()[0]['error']);
    }

    public function testExecuteReportsEveryTargetThroughTheProgressCallback(): void
    {
        $gateway = $this->gateway(pods: [], latestImages: self::LATEST);
        $service = $this->service($gateway, []);

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101'), $this->target(102, 12, 'sandbox-102')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 2,
            target: SandboxImageTarget::release(self::LATEST),
        );

        $reported = [];
        $outcome = $service->execute(
            $plan,
            new SandboxRestartOptions(),
            static function (SandboxRestartResult $result) use (&$reported): void {
                $reported[] = $result->getTopicId();
            }
        );

        self::assertSame([101, 102], $reported, '每个目标完成时都要回调一次，命令层才能实时打进度');
        self::assertCount(count($outcome->getResults()), $reported, '回调次数必须与结果条数一致，不多不少');
    }

    public function testProgressCallbackFailureDoesNotChangeTheOutcome(): void
    {
        $gateway = $this->gateway(pods: [], latestImages: self::LATEST);
        $service = $this->service($gateway, []);

        $plan = new SandboxRestartPlan(
            targets: [$this->target(101, 11, 'sandbox-101')],
            deletions: [],
            skippedByReason: [],
            upToDateTopics: 0,
            listedPods: 1,
            target: SandboxImageTarget::release(self::LATEST),
        );

        $outcome = $service->execute(
            $plan,
            new SandboxRestartOptions(),
            static function (): void {
                throw new RuntimeException('progress printer exploded');
            }
        );

        self::assertSame(1, $outcome->getRestartedCount(), '进度打印失败不能把成功改成失败');
        self::assertFalse($outcome->hasFailures());
    }

    /**
     * @param TopicEntity[] $topics
     */
    private function service(
        SandboxGatewayInterface $gateway,
        array $topics = [],
        ?TopicDomainService $topicService = null,
        ?TaskDomainService $taskService = null,
        ?MagicClawDomainService $claws = null,
        ?SandboxRebuildPortInterface $port = null,
    ): SandboxRestartAppService {
        if ($topicService === null) {
            $topicService = $this->createMock(TopicDomainService::class);
            $topicService->method('getTopicsByIds')->willReturn($topics);
        }

        if ($taskService === null) {
            $taskService = $this->createMock(TaskDomainService::class);
        }

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new SandboxRestartAppService(
            gateway: $gateway,
            topicDomainService: $topicService,
            taskDomainService: $taskService,
            magicClawDomainService: $claws ?? new SandboxRestartClawStub([], new SandboxRestartClawSpy()),
            planner: new SandboxRestartPlanner(),
            rebuildPort: $port ?? new SandboxRestartPortStub(new SandboxRestartCallLog()),
            batchRunner: new SandboxRestartBatchRunner(),
            loggerFactory: $loggerFactory,
        );
    }

    /**
     * @param array<int, array<string, mixed>> $pods
     * @param array<string, string> $latestImages
     */
    /**
     * 网关替身：第一次 listSandboxes 是计划阶段的清单，第二次是清理前的复核清单。
     *
     * 两个返回值必须分开，否则测不出"计划之后 pod 归属变了"这类竞态。
     *
     * @param array<int, array<string, mixed>> $pods 计划阶段看到的 pod 清单
     * @param array<string, string> $latestImages 网关发布镜像
     * @param null|array<int, array<string, mixed>> $reloadPods 复核阶段的 pod 清单；默认与计划阶段相同
     * @param null|SandboxListResult $reloadResult 复核阶段整体失败时的返回值（优先于 $reloadPods）
     */
    private function gateway(
        array $pods,
        array $latestImages,
        ?array $reloadPods = null,
        ?SandboxListResult $reloadResult = null,
    ): SandboxGatewayInterface {
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('listSandboxes')->willReturnOnConsecutiveCalls(
            $this->listResult($pods),
            $reloadResult ?? $this->listResult($reloadPods ?? $pods),
        );
        $gateway->method('getLatestImages')->willReturn($latestImages);

        return $gateway;
    }

    /**
     * @param array<int, array<string, mixed>> $pods
     */
    private function listResult(array $pods): SandboxListResult
    {
        return SandboxListResult::fromApiResponse([
            'code' => ResponseCode::SUCCESS,
            'message' => 'ok',
            'data' => ['total' => count($pods), 'sandboxes' => $pods],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function warmPoolPodArray(string $sandboxId, string $topicId = ''): array
    {
        return [
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'topic_id' => $topicId,
            'warm_pool' => true,
            'bound' => $topicId !== '',
        ];
    }

    private function warmPoolDeletion(string $sandboxId): SandboxPodDeletion
    {
        return new SandboxPodDeletion(
            SandboxPodSnapshot::fromGatewayArray($this->warmPoolPodArray($sandboxId)),
            'unbound warm-pool sandbox'
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function podArray(string $sandboxId, int $topicId, string $agentImage, string $createdAt = '2026-09-01T00:00:00Z'): array
    {
        return [
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'topic_id' => (string) $topicId,
            'bound' => true,
            'created_at' => $createdAt,
            'agent_image' => $agentImage,
            'agfs_image' => self::LATEST['agfs_image'],
        ];
    }

    private function topic(int $topicId, int $projectId, string $sandboxId): TopicEntity
    {
        return (new TopicEntity())
            ->setId($topicId)
            ->setProjectId($projectId)
            ->setSandboxId($sandboxId)
            ->setUserId('user-1')
            ->setUserOrganizationCode('org-1');
    }

    private function claw(string $code, int $projectId): MagicClawEntity
    {
        $claw = new MagicClawEntity();
        $claw->setCode($code);
        $claw->setProjectId($projectId);
        return $claw;
    }

    private function target(int $topicId, int $projectId, string $sandboxId): SandboxRestartTarget
    {
        return new SandboxRestartTarget(
            new SandboxTopicBinding(
                $topicId,
                $projectId,
                'user-1',
                'org-1',
                $sandboxId
            ),
            [SandboxPodSnapshot::fromGatewayArray([
                'sandbox_id' => $sandboxId,
                'status' => 'Running',
                'topic_id' => (string) $topicId,
                'bound' => true,
            ])],
            SandboxRestartReason::AgentImageOutdated,
        );
    }
}

/**
 * 记录调用顺序的假重建端口.
 */
final class SandboxRestartPortStub implements SandboxRebuildPortInterface
{
    /**
     * @param SandboxRestartCallLog $log 与测试共享的调用记录
     * @param string[] $failDeletes 删除时抛异常的 sandbox id
     * @param int[] $failRebuild 重建时抛异常的 topic id
     */
    public function __construct(
        private readonly SandboxRestartCallLog $log,
        private readonly array $failDeletes = [],
        private readonly array $failRebuild = [],
    ) {
    }

    public function deleteSandbox(string $sandboxId): void
    {
        $this->log->calls[] = 'delete:' . $sandboxId;
        if (in_array($sandboxId, $this->failDeletes, true)) {
            throw new RuntimeException('delete exploded');
        }
    }

    public function rebuild(int $topicId, string $userId, string $organizationCode, ?SandboxImageTarget $images = null): string
    {
        $this->log->calls[] = 'rebuild:' . $topicId;
        if ($images !== null) {
            $this->log->rebuildTargets[$topicId] = $images;
        }
        if (in_array($topicId, $this->failRebuild, true)) {
            throw new RuntimeException('rebuild exploded');
        }
        return 'new-sandbox-' . $topicId;
    }
}

/**
 * MagicClawDomainService 是 readonly 服务，PHPUnit 无法替身；
 * 这里用 readonly 子类覆盖唯一需要的方法（与生产行为一致：按 projectId 批量查询），
 * 调用记录放在可变的 spy 对象里。
 */
readonly class SandboxRestartClawStub extends MagicClawDomainService
{
    /**
     * @param array<int, MagicClawEntity> $clawsByProjectId
     */
    public function __construct(private array $clawsByProjectId, private SandboxRestartClawSpy $spy)
    {
    }

    public function getByProjectIds(array $projectIds): array
    {
        $this->spy->requestedProjectIds = $projectIds;
        return array_intersect_key($this->clawsByProjectId, array_flip($projectIds));
    }
}

/**
 * 共享的调用记录（可变）.
 */
final class SandboxRestartCallLog
{
    /** @var string[] */
    public array $calls = [];

    /** @var array<int, SandboxImageTarget> topicId => 重建时拿到的目标镜像 */
    public array $rebuildTargets = [];
}

/**
 * 记录 Magic Claw 查询的可变 spy.
 */
final class SandboxRestartClawSpy
{
    /** @var int[] */
    public array $requestedProjectIds = [];
}
