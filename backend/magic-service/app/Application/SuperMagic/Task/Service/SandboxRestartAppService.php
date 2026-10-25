<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Task\Contract\SandboxRebuildPortInterface;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOptions;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOutcome;
use App\Application\SuperMagic\Task\DTO\SandboxRestartResult;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodDeletion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartPlan;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxTopicBinding;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\SandboxRestartPlanner;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 镜像发布后的沙箱重启用例.
 *
 * 与既有 restart/upgrade 的区别（这三条是命令存在的理由）：
 *
 * | 场景 | restart（单话题） | upgrade（单话题） | 本服务（全量） |
 * |---|---|---|---|
 * | 目标集合 | 一个话题 | 一个话题 | 网关 pod 清单，可过滤范围 |
 * | 目标镜像 | 网关发布版本 | 网关发布版本 | 网关发布版本，或命令行指定的镜像 |
 * | 镜像已最新时 | 仍然重启 | 跳过 | 跳过（--force 可强制） |
 * | 同话题多个漂移 pod | 只删表里那个 | 只删表里那个 | 全删再重建一个 |
 * | 温池/孤儿 pod | 不处理 | 不处理 | 删除（指定镜像时不删共享温池） |
 * | 正在运行的任务 | 不处理 | 不处理 | 先挂起，避免误报失败 |
 * | 重建方式 | 冷启动或温池 | 冷启动或温池 | 同左：删掉旧 pod 后照常走温池，快 |
 *
 * 重建沿用正常初始化流程，因此会走温池：旧 pod 删掉后探测拿到 NOT_FOUND，
 * 温池守卫放行，直接领一个现成 pod 挂载，不必从零冷启动。
 * 温池待领的 pod 必须与本次目标镜像一致（领取条件就是镜像对），因此指定镜像时
 * 只会领到同一代的池子；池里没有就退回冷启动，仍按指定镜像构建。
 *
 * 使用方式分两步：先 plan() 得到只读计划（可 dry-run 打印），再 execute() 执行。
 */
readonly class SandboxRestartAppService
{
    /**
     * 释放容量前挂起的任务状态：等待中、运行中、等用户回答.
     *
     * waiting_for_user 容易漏：Agent 已经停下来等用户，但 pod 仍被这条任务占着，
     * 直接删 pod 会让它在下一次检查里变成"沙箱不存在"的错误。
     */
    private const SOURCE_STATUSES = [TaskStatus::WAITING, TaskStatus::RUNNING, TaskStatus::WAITING_FOR_USER];

    private LoggerInterface $logger;

    public function __construct(
        private SandboxGatewayInterface $gateway,
        private TopicDomainService $topicDomainService,
        private TaskDomainService $taskDomainService,
        private MagicClawDomainService $magicClawDomainService,
        private SandboxRestartPlanner $planner,
        private SandboxRebuildPortInterface $rebuildPort,
        private SandboxRestartBatchRunner $batchRunner,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 只读地计算重启计划：这一步不会删除或创建任何东西.
     */
    public function plan(SandboxRestartOptions $options): SandboxRestartPlan
    {
        $listResult = $this->gateway->listSandboxes($options->getStatuses());
        if (! $listResult->isSuccess()) {
            throw new BusinessException('Failed to list sandboxes from the sandbox gateway: ' . $listResult->getMessage());
        }

        /** @var SandboxPodSnapshot[] $pods */
        $pods = $listResult->getSandboxes();

        $target = $this->resolveImageTarget($options);

        $bindings = $this->loadBindings($pods);
        $scopeProjectIds = $this->resolveScopeProjectIds($options, $bindings);
        $topicIds = $this->resolveSelectedTopicIds($options, $pods, $bindings);

        $plan = $this->planner->plan(
            pods: $pods,
            bindingsByTopicId: $bindings,
            target: $target,
            force: $options->isForce(),
            scope: $options->getScope(),
            scopeProjectIds: $scopeProjectIds,
            topicIds: $topicIds,
        );

        $targets = $plan->getTargetsOldestFirst();
        if ($options->getLimit() > 0) {
            $targets = array_slice($targets, 0, $options->getLimit());
        }

        return new SandboxRestartPlan(
            targets: $targets,
            deletions: $plan->getDeletions(),
            skippedByReason: $plan->getSkippedByReason(),
            upToDateTopics: $plan->getUpToDateTopics(),
            listedPods: $plan->getListedPods(),
            target: $target,
        );
    }

    /**
     * 执行计划：挂起在途任务 → 删除旧 pod → 按最新镜像重建.
     *
     * @param null|callable(SandboxRestartResult): void $onTargetDone 每完成一个话题就回调一次，
     *                                                                让调用方（命令层）能实时打出 `[i/n]` 进度。批量执行可能持续几十分钟，
     *                                                                没有这个回调，运维直到全部结束才知道进展。回调抛出的异常不外溢。
     */
    public function execute(
        SandboxRestartPlan $plan,
        SandboxRestartOptions $options,
        ?callable $onTargetDone = null
    ): SandboxRestartOutcome {
        $startedAt = microtime(true);
        $targets = $plan->getTargets();
        $images = $plan->getTarget();

        [$suspendedTasks, $suspendedTopics] = $this->suspendActiveWork($targets);

        $results = $this->batchRunner->run(
            $targets,
            $options->getConcurrency(),
            function (mixed $target) use ($onTargetDone, $images): ?SandboxRestartResult {
                if (! $target instanceof SandboxRestartTarget) {
                    return null;
                }

                $result = $this->restartTarget($target, $images);
                if ($onTargetDone !== null) {
                    try {
                        $onTargetDone($result);
                    } catch (Throwable $e) {
                        // 进度打印失败不能影响重启结果本身。
                        $this->logger->warning('[Sandbox][RestartAll] Progress callback failed', [
                            'topic_id' => $target->getTopicId(),
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                return $result;
            }
        );

        // runner 对异常任务返回 null：这里补一条失败结果，避免"少了一条没人知道"。
        $normalized = [];
        foreach ($targets as $key => $target) {
            $result = $results[$key] ?? null;
            $normalized[] = $result instanceof SandboxRestartResult
                ? $result
                : SandboxRestartResult::failed($target, 'Restart task aborted unexpectedly', [], [], 0.0);
        }

        [$deletedPods, $deletionFailures] = $this->executeDeletions($plan->getDeletions());

        $outcome = new SandboxRestartOutcome(
            results: $normalized,
            deletedPods: $deletedPods,
            deletionFailures: $deletionFailures,
            suspendedTasks: $suspendedTasks,
            suspendedTopics: $suspendedTopics,
            durationSeconds: microtime(true) - $startedAt,
        );

        $this->logger->info('[Sandbox][RestartAll] Restart finished', [
            'listed_pods' => $plan->getListedPods(),
            'targets' => count($targets),
            'restarted' => $outcome->getRestartedCount(),
            'failed' => $outcome->getFailedCount(),
            'deleted_only' => count($deletedPods),
            'delete_failures' => $outcome->getDeleteFailureCount(),
            'suspended_tasks' => $suspendedTasks,
            'suspended_topics' => $suspendedTopics,
            'duration_seconds' => round($outcome->getDurationSeconds(), 3),
        ]);

        return $outcome;
    }

    /**
     * 挂起目标话题上"还会被误判成失败"的任务与话题状态.
     *
     * 一次批量更新，而不是逐个话题更新：删 pod 与改状态之间的窗口越小，
     * 现有 CheckTaskStatusTask 把任务标成 ERROR 的概率越低。
     *
     * @param SandboxRestartTarget[] $targets
     * @return array{0: int, 1: int} [挂起任务数, 挂起话题数]
     */
    private function suspendActiveWork(array $targets): array
    {
        if ($targets === []) {
            return [0, 0];
        }

        $topicIds = [];
        $sandboxIds = [];
        foreach ($targets as $target) {
            $topicIds[$target->getTopicId()] = $target->getTopicId();
            $persistedSandboxId = $target->getBinding()->getSandboxId();
            if ($persistedSandboxId !== '') {
                $sandboxIds[$persistedSandboxId] = $persistedSandboxId;
            }
            foreach ($target->getSandboxIds() as $sandboxId) {
                $sandboxIds[$sandboxId] = $sandboxId;
            }
        }

        $topicIds = array_values($topicIds);
        $sandboxIds = array_values($sandboxIds);

        try {
            $this->topicDomainService->updateTopicStatusBySandboxIds(
                $sandboxIds,
                TaskStatus::Suspended,
                self::SOURCE_STATUSES
            );
            $suspendedTasks = $this->taskDomainService->updateTaskStatusByTopicIds(
                $topicIds,
                TaskStatus::Suspended,
                'Sandbox restarted to pick up the latest images',
                self::SOURCE_STATUSES
            );
        } catch (Throwable $e) {
            // 状态收口失败不阻断重启：宁可让任务状态留着让 cron 兜底，
            // 也不能因为一次 DB 抖动就放弃整批镜像升级。
            $this->logger->error('[Sandbox][RestartAll] Failed to suspend active tasks before restart', [
                'topic_count' => count($topicIds),
                'error' => $e->getMessage(),
            ]);
            return [0, 0];
        }

        $this->logger->info('[Sandbox][RestartAll] Suspended active work before restart', [
            'topic_count' => count($topicIds),
            'sandbox_count' => count($sandboxIds),
            'suspended_tasks' => $suspendedTasks,
        ]);

        return [$suspendedTasks, count($topicIds)];
    }

    /**
     * 单个话题：删掉清单里的全部 pod，再按本次目标镜像重建一个.
     */
    private function restartTarget(SandboxRestartTarget $target, SandboxImageTarget $images): SandboxRestartResult
    {
        $startedAt = microtime(true);
        $deleted = [];
        $failed = [];

        foreach ($target->getSandboxIds() as $sandboxId) {
            try {
                $this->rebuildPort->deleteSandbox($sandboxId);
                $deleted[] = $sandboxId;
                $this->logger->info('[Sandbox][RestartAll] Deleted stale sandbox pod', [
                    'topic_id' => $target->getTopicId(),
                    'sandbox_id' => $sandboxId,
                ]);
            } catch (Throwable $e) {
                // 删不掉不阻断重建（否则这一只永远卡在旧镜像），但必须显式记下来。
                $failed[] = $sandboxId;
                $this->logger->error('[Sandbox][RestartAll] Failed to delete stale sandbox pod', [
                    'topic_id' => $target->getTopicId(),
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        try {
            $binding = $target->getBinding();
            $newSandboxId = $this->rebuildPort->rebuild(
                $target->getTopicId(),
                $binding->getUserId(),
                $binding->getOrganizationCode(),
                $images
            );

            return SandboxRestartResult::restarted(
                $target,
                $newSandboxId,
                $deleted,
                $failed,
                microtime(true) - $startedAt
            );
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][RestartAll] Failed to rebuild sandbox', [
                'topic_id' => $target->getTopicId(),
                'user_id' => $target->getBinding()->getUserId(),
                'deleted_sandbox_ids' => $deleted,
                'error' => $e->getMessage(),
            ]);

            return SandboxRestartResult::failed(
                $target,
                $e->getMessage(),
                $deleted,
                $failed,
                microtime(true) - $startedAt
            );
        }
    }

    /**
     * 删除只清理不重建的 pod（温池、孤儿）.
     *
     * 计划是执行前算出来的快照，而重建本身会去温池领 pod：某个"未绑定"的池子 pod
     * 完全可能在本批重建中被话题领走并挂载成功（挂载后 pod 会打上 topic-id 标签）。
     * 若照旧快照删除，就会把刚刚挂给用户的新沙箱删掉，话题则指向一个不存在的沙箱。
     *
     * 因此删除前重新拉一次清单，只删"现在仍然没有话题归属"的 pod；无法重新确认
     * （网关列不出清单）时一个都不删，并把原因写进删除失败里——宁可漏清理，
     * 也不能误删仍在服役的沙箱。
     *
     * @param SandboxPodDeletion[] $deletions
     * @return array{0: SandboxPodDeletion[], 1: array<int, array{pod: SandboxPodDeletion, error: string}>}
     */
    private function executeDeletions(array $deletions): array
    {
        if ($deletions === []) {
            return [[], []];
        }

        $stillUnowned = $this->reloadUnownedSandboxIds();
        if ($stillUnowned === null) {
            $failures = [];
            foreach ($deletions as $index => $deletion) {
                $failures[$index] = [
                    'pod' => $deletion,
                    'error' => 'pod ownership could not be re-verified; skipped to avoid deleting a sandbox that a topic may have just claimed',
                ];
            }
            $this->logger->error('[Sandbox][RestartAll] Skipped every cleanup deletion: pod list is unavailable', [
                'planned_deletions' => count($deletions),
            ]);
            return [[], $failures];
        }

        $deleted = [];
        $failures = [];
        foreach ($deletions as $index => $deletion) {
            $sandboxId = $deletion->getPod()->getSandboxId();
            if (! isset($stillUnowned[$sandboxId])) {
                // 已经被话题领走、或者已经消失：两种情况下都不该再删。
                $this->logger->info('[Sandbox][RestartAll] Sandbox is no longer unowned, keeping it', [
                    'sandbox_id' => $sandboxId,
                    'reason' => $deletion->getReason(),
                ]);
                continue;
            }

            try {
                $this->rebuildPort->deleteSandbox($sandboxId);
                $deleted[] = $deletion;
                $this->logger->info('[Sandbox][RestartAll] Deleted pod without rebuild', [
                    'sandbox_id' => $sandboxId,
                    'reason' => $deletion->getReason(),
                ]);
            } catch (Throwable $e) {
                $failures[$index] = ['pod' => $deletion, 'error' => $e->getMessage()];
                $this->logger->error('[Sandbox][RestartAll] Failed to delete pod', [
                    'sandbox_id' => $sandboxId,
                    'reason' => $deletion->getReason(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
        return [$deleted, $failures];
    }

    /**
     * 重新拉一次网关清单，返回"此刻仍然没有话题归属"的沙箱 id 集合.
     *
     * 判定口径与计划阶段一致：没有 topic-id 标签且未标记 bound，才是可以安全清理的
     * 池子/孤儿 pod。返回 null 表示无法确认（调用方必须放弃删除而不是按旧快照删）。
     *
     * @return null|array<string, true>
     */
    private function reloadUnownedSandboxIds(): ?array
    {
        try {
            $listResult = $this->gateway->listSandboxes([]);
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][RestartAll] Failed to reload sandbox list before cleanup', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }

        if (! $listResult->isSuccess()) {
            $this->logger->error('[Sandbox][RestartAll] Sandbox list request failed before cleanup', [
                'code' => $listResult->getCode(),
                'message' => $listResult->getMessage(),
            ]);
            return null;
        }

        $unowned = [];
        foreach ($listResult->getSandboxes() as $pod) {
            if ($pod->getTopicId() !== '' || $pod->isBound()) {
                continue;
            }
            $unowned[$pod->getSandboxId()] = true;
        }
        return $unowned;
    }

    /**
     * 解析本次操作的目标镜像.
     *
     * 两种来源合成同一个目标：网关当前发布的镜像，以及命令行指定的镜像
     * （指定了哪一侧就用哪一侧，另一侧继续跟随发布）。
     *
     * 目标不完整时不做盲目全量重启：没有标准就无法判断"是否需要重启"，
     * 也无法证明重建结果符合预期。此时要求运维补齐指定镜像或显式 --force。
     */
    private function resolveImageTarget(SandboxRestartOptions $options): SandboxImageTarget
    {
        $release = $this->gateway->getLatestImages();
        $requestedAgentImage = $options->getRequestedAgentImage();
        $requestedAgfsImage = $options->getRequestedAgfsImage();

        $target = $requestedAgentImage === null && $requestedAgfsImage === null
            ? SandboxImageTarget::release($release)
            : SandboxImageTarget::withSpecifiedImages($release, $requestedAgentImage, $requestedAgfsImage);

        if ($target->isComplete()) {
            $this->logger->info('[Sandbox][RestartAll] Resolved the target images', [
                'target' => $target->describe(),
                'specified' => $target->hasSpecifiedImages(),
            ]);
            return $target;
        }

        if ($options->isForce()) {
            $this->logger->warning('[Sandbox][RestartAll] Target images are incomplete, continuing because --force was given', [
                'target' => $target->describe(),
            ]);
            return $target;
        }

        throw new BusinessException(
            'Unable to resolve the target sandbox images (' . $target->describe() . '); refusing to guess whether a restart is needed. '
            . 'Pin them explicitly with --agent-image / --agfs-image, or re-run with --force to restart unconditionally.'
        );
    }

    /**
     * 把清单里的 pod 映射回话题，批量取一次归属信息.
     *
     * @param SandboxPodSnapshot[] $pods
     * @return array<int, SandboxTopicBinding>
     */
    private function loadBindings(array $pods): array
    {
        $topicIds = [];
        foreach ($pods as $pod) {
            $topicId = $this->candidateTopicId($pod);
            if ($topicId !== null) {
                $topicIds[$topicId] = $topicId;
            }
        }

        if ($topicIds === []) {
            return [];
        }

        $bindings = [];
        foreach ($this->topicDomainService->getTopicsByIds(array_values($topicIds)) as $topic) {
            $bindings[$topic->getId()] = SandboxTopicBinding::fromEntity($topic);
        }
        return $bindings;
    }

    /**
     * pod 可能对应的话题 id（未经存在性校验）.
     */
    private function candidateTopicId(SandboxPodSnapshot $pod): ?int
    {
        $labelTopicId = (int) $pod->getTopicId();
        if ($labelTopicId > 0) {
            return $labelTopicId;
        }

        $sandboxId = $pod->getSandboxId();
        $sandboxIdInt = (int) $sandboxId;
        if ($sandboxIdInt > 0 && (string) $sandboxIdInt === $sandboxId) {
            return $sandboxIdInt;
        }

        return null;
    }

    /**
     * 把 --sandbox-id 点名的沙箱解析成话题集合.
     *
     * 写错一个字符就必须立刻失败：这类命令的失败模式是"什么都没做却看起来成功"，
     * 等到事后 dry-run 才发现 id 根本不存在，代价是一次白跑的发布窗口。
     *
     * @param SandboxPodSnapshot[] $pods
     * @param array<int, SandboxTopicBinding> $bindings
     * @return int[] 选中话题 id；未点名任何沙箱时返回空数组（表示不限定）
     */
    private function resolveSelectedTopicIds(SandboxRestartOptions $options, array $pods, array $bindings): array
    {
        $sandboxIds = $options->getSandboxIds();
        if ($sandboxIds === []) {
            return [];
        }

        [$topicIds, $unmatched] = $this->planner->resolveTopicIdsForSandboxIds($pods, $bindings, $sandboxIds);
        if ($unmatched !== []) {
            throw new BusinessException(sprintf(
                'These sandbox ids cannot be restarted: %s. They are missing from the sandbox gateway list, or they are unbound warm-pool/orphan pods that belong to no topic '
                . '(run --dry-run without --sandbox-id to inspect the current list).',
                implode(', ', $unmatched)
            ));
        }

        $this->logger->info('[Sandbox][RestartAll] Restricted to the sandboxes named on the command line', [
            'sandbox_ids' => $sandboxIds,
            'topic_ids' => $topicIds,
        ]);

        return $topicIds;
    }

    /**
     * Magic Claw 范围需要先知道"哪些项目是 Claw".
     *
     * @param array<int, SandboxTopicBinding> $bindings
     * @return int[] 范围内允许处理的项目 id；All 范围返回空数组（表示不过滤）
     */
    private function resolveScopeProjectIds(SandboxRestartOptions $options, array $bindings): array
    {
        if ($options->getScope() !== SandboxRestartScope::MagicClaw) {
            return [];
        }

        $projectIds = [];
        foreach ($bindings as $binding) {
            $projectIds[$binding->getProjectId()] = $binding->getProjectId();
        }
        if ($projectIds === []) {
            return [];
        }

        $claws = $this->magicClawDomainService->getByProjectIds(array_values($projectIds));
        $code = $options->getClawCode();
        $scopeProjectIds = [];
        foreach ($claws as $projectId => $claw) {
            if ($code !== '' && $claw->getCode() !== $code) {
                continue;
            }
            $scopeProjectIds[] = (int) $projectId;
        }

        return $scopeProjectIds;
    }
}
