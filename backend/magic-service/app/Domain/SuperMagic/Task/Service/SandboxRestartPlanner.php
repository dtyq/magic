<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodDeletion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartPlan;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartReason;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxTopicBinding;

/**
 * 把"网关 pod 清单 + 话题归属 + 目标镜像"算成一份可执行的重启计划.
 *
 * 纯计算，无 IO、无随机、无时间依赖：同样的输入永远得到同一份计划，
 * 因此可以 --dry-run 先看计划再执行，也可以直接用单测钉住每一条判定规则。
 *
 * 输入三份事实：
 *   - pods       网关清单（每行 = 一个真实 pod，含它创建时用的镜像）
 *   - bindings   话题归属（topic → project/owner/sandbox_id），只读业务表快照
 *   - target     本次的目标镜像（默认=网关发布版本；命令行也可以直接指定）
 *
 * 输出三类动作：
 *   - targets    需要"删掉该话题名下全部 pod，再重建一个"
 *   - deletions  只删除不重建（未绑定温池、找不到话题的孤儿）
 *   - skipped    明确不处理的原因（便于运维回答"为什么没重启我这一只"）
 */
class SandboxRestartPlanner
{
    private const SKIP_NO_OWNER = 'topic owner is incomplete';

    private const SKIP_OUT_OF_SCOPE = 'project is outside the restart scope';

    private const SKIP_SHARED_WARM_POOL = 'unbound warm-pool pod is not part of this scope';

    private const SKIP_UNOWNED_SANDBOX = 'no topic owns this sandbox';

    private const SKIP_WARM_POOL_WITH_SPECIFIED_IMAGES = 'unbound warm-pool pod keeps the release images, which the specified images do not replace';

    private const SKIP_WARM_POOL_UP_TO_DATE = 'unbound warm-pool pod already runs the release images';

    private const SKIP_NOT_SELECTED = 'not one of the sandboxes named by --sandbox-id';

    /**
     * @param SandboxPodSnapshot[] $pods 网关清单
     * @param array<int, SandboxTopicBinding> $bindingsByTopicId topicId => 归属信息
     * @param SandboxImageTarget $target 本次的目标镜像
     * @param int[] $scopeProjectIds 仅 Magic Claw 范围使用：允许处理的项目 id
     * @param int[] $topicIds 只处理这些话题（来自 --sandbox-id 的解析结果）；空数组=不限定
     */
    public function plan(
        array $pods,
        array $bindingsByTopicId,
        SandboxImageTarget $target,
        bool $force,
        SandboxRestartScope $scope,
        array $scopeProjectIds = [],
        array $topicIds = [],
    ): SandboxRestartPlan {
        $deletions = [];
        $skipped = [];
        /** @var array<int, array{binding: SandboxTopicBinding, pods: SandboxPodSnapshot[]}> $grouped */
        $grouped = [];
        $allowedProjects = array_fill_keys(array_map('intval', $scopeProjectIds), true);
        $allowedTopics = array_fill_keys(array_map('intval', $topicIds), true);

        foreach ($pods as $pod) {
            // 点名了具体沙箱时，其余一切都是"不在本次范围"：包括别的话题、温池和孤儿。
            // 这一步必须放在温池/孤儿分支之前——否则一次"只重启这一个"会顺手清空共享
            // 温池或删掉无关孤儿，那是运维完全没要求的破坏性副作用。
            if ($allowedTopics !== [] && ! $this->belongsToSelectedTopic($pod, $bindingsByTopicId, $allowedTopics)) {
                $skipped[self::SKIP_NOT_SELECTED][] = $pod;
                continue;
            }

            // 未绑定的温池 pod 没有 owner，"重建"无从谈起。它的处置规则见
            // unboundWarmPoolDisposition()：只有确实跑着旧镜像的池 pod 才需要删掉，
            // 让补货流程用发布版本补齐；已经是最新镜像的池 pod 留着。
            if ($pod->isUnboundWarmPool()) {
                $skipReason = $this->unboundWarmPoolSkipReason($pod, $target, $force, $scope);
                if ($skipReason !== null) {
                    $skipped[$skipReason][] = $pod;
                } else {
                    $deletions[] = new SandboxPodDeletion($pod, 'unbound warm-pool sandbox on outdated images');
                }
                continue;
            }

            $binding = $this->resolveBinding($pod, $bindingsByTopicId);
            if ($binding === null) {
                if ($scope->deletesSharedPods()) {
                    $deletions[] = new SandboxPodDeletion($pod, self::SKIP_UNOWNED_SANDBOX);
                } else {
                    $skipped[self::SKIP_UNOWNED_SANDBOX][] = $pod;
                }
                continue;
            }

            if (! $binding->hasOwner()) {
                $skipped[self::SKIP_NO_OWNER][] = $pod;
                continue;
            }

            if ($scope === SandboxRestartScope::MagicClaw && ! isset($allowedProjects[$binding->getProjectId()])) {
                $skipped[self::SKIP_OUT_OF_SCOPE][] = $pod;
                continue;
            }

            $topicId = $binding->getTopicId();
            if (! isset($grouped[$topicId])) {
                $grouped[$topicId] = ['binding' => $binding, 'pods' => []];
            }
            $grouped[$topicId]['pods'][] = $pod;
        }

        $targets = [];
        $upToDateTopics = 0;
        foreach ($grouped as $group) {
            usort(
                $group['pods'],
                static fn (SandboxPodSnapshot $left, SandboxPodSnapshot $right): int => $left->getCreatedAtTimestamp() <=> $right->getCreatedAtTimestamp()
            );
            $reason = $this->decideReason($group['pods'], $target, $force);
            if (! $reason->needsRestart()) {
                ++$upToDateTopics;
                continue;
            }
            $targets[] = new SandboxRestartTarget($group['binding'], $group['pods'], $reason);
        }

        return new SandboxRestartPlan(
            targets: $targets,
            deletions: $deletions,
            skippedByReason: $skipped,
            upToDateTopics: $upToDateTopics,
            listedPods: count($pods),
            target: $target,
        );
    }

    /**
     * 把"点名要重启的沙箱 id"解析成"要处理的话题 id"。
     *
     * 为什么落到话题而不是单个 pod：一个话题可能漂移出多个 pod，重建的最小正确单位
     * 就是话题——只删其中一个 pod 会立刻留下新的漂移，正好是这条命令要消除的问题。
     *
     * @param SandboxPodSnapshot[] $pods
     * @param array<int, SandboxTopicBinding> $bindingsByTopicId
     * @param string[] $sandboxIds
     * @return array{0: int[], 1: string[]} [选中话题 id（去重）, 无法归属到话题的沙箱 id]
     */
    public function resolveTopicIdsForSandboxIds(array $pods, array $bindingsByTopicId, array $sandboxIds): array
    {
        $wanted = array_fill_keys($sandboxIds, true);
        $seen = [];
        $topicIds = [];
        $unmatched = [];

        foreach ($pods as $pod) {
            $sandboxId = $pod->getSandboxId();
            if (! isset($wanted[$sandboxId])) {
                continue;
            }
            $seen[$sandboxId] = true;

            $binding = $this->resolveBinding($pod, $bindingsByTopicId);
            if ($binding === null) {
                // 未绑定温池 / 孤儿：没有 owner，无法"重建"，只能报出来让运维换个 id。
                $unmatched[$sandboxId] = $sandboxId;
                continue;
            }
            $topicIds[$binding->getTopicId()] = $binding->getTopicId();
        }

        // 清单里根本不存在的 id 也要报出来，否则打错一个字符会被静默当成"已处理"。
        foreach (array_keys($wanted) as $sandboxId) {
            if (! isset($seen[$sandboxId])) {
                $unmatched[$sandboxId] = $sandboxId;
            }
        }

        return [array_values($topicIds), array_values($unmatched)];
    }

    /**
     * 该 pod 是否属于被点名的话题。
     *
     * @param array<int, SandboxTopicBinding> $bindingsByTopicId
     * @param array<int, true> $allowedTopics
     */
    private function belongsToSelectedTopic(SandboxPodSnapshot $pod, array $bindingsByTopicId, array $allowedTopics): bool
    {
        $binding = $this->resolveBinding($pod, $bindingsByTopicId);
        return $binding !== null && isset($allowedTopics[$binding->getTopicId()]);
    }

    /**
     * 未绑定的温池 pod 该不该删：返回 null 表示删，返回字符串表示跳过原因.
     *
     * | 条件 | 处置 | 理由 |
     * |---|---|---|
     * | 本次指定了镜像 | 跳过 | 池子预热的是发布版本，与本次目标无关；删它不加速本批 |
     * | 范围不包含共享池（magic-claw） | 跳过 | 不属于本范围 |
     * | 镜像已等于发布版本且没 --force | 跳过 | 已经是最新的，删掉只会让补货流程白做一遍 |
     * | 镜像过期 / 缺字段 / --force | 删除 | 由补货流程用发布版本补齐 |
     *
     * 缺字段按"无法证明已最新"处理，与话题侧 ImagesUnknown 同一口径：
     * 宁可多删一个（补货会立刻补上），也不留一个来历不明的旧镜像 pod。
     *
     * --force 依然强删已最新的池 pod：它的用途是处理"镜像引用没变但配置漂移"这类
     * 无法从镜像判断的情况，此时必须给出一个真正的新 pod。
     */
    private function unboundWarmPoolSkipReason(
        SandboxPodSnapshot $pod,
        SandboxImageTarget $target,
        bool $force,
        SandboxRestartScope $scope,
    ): ?string {
        if ($target->hasSpecifiedImages()) {
            return self::SKIP_WARM_POOL_WITH_SPECIFIED_IMAGES;
        }

        if (! $scope->deletesSharedPods()) {
            return self::SKIP_SHARED_WARM_POOL;
        }

        // 未指定镜像时目标就是发布版本，所以这里比较的正是"池 pod vs 当前发布"。
        if (! $force && $target->matches($pod->getImages())) {
            return self::SKIP_WARM_POOL_UP_TO_DATE;
        }

        return null;
    }

    /**
     * 判定一个话题是否需要重启.
     *
     * @param SandboxPodSnapshot[] $pods 该话题名下的全部 pod
     */
    private function decideReason(array $pods, SandboxImageTarget $target, bool $force): SandboxRestartReason
    {
        if ($force) {
            return SandboxRestartReason::Forced;
        }

        if (! $target->isComplete()) {
            // 没有目标就无法证明"已经到位"。这里返回 Unknown 而不是 UpToDate，
            // 由调用方决定是否继续（应用层在没有 --force 时会直接报错要求显式确认）。
            return SandboxRestartReason::ImagesUnknown;
        }

        $agentOutdated = false;
        $agfsOutdated = false;
        foreach ($pods as $pod) {
            if ($pod->getAgentImage() === '' || $pod->getAgfsImage() === '') {
                // 老 pod 可能只有 agent 容器、没有 agfs sidecar；镜像不完整一律按未知处理。
                return SandboxRestartReason::ImagesUnknown;
            }
            if ($pod->getAgentImage() !== $target->getAgentImage()) {
                $agentOutdated = true;
            }
            if ($pod->getAgfsImage() !== $target->getAgfsImage()) {
                $agfsOutdated = true;
            }
        }

        if ($agentOutdated) {
            return SandboxRestartReason::AgentImageOutdated;
        }
        if ($agfsOutdated) {
            return SandboxRestartReason::AgfsImageOutdated;
        }

        return SandboxRestartReason::UpToDate;
    }

    /**
     * 把 pod 映射回话题.
     *
     * 首选 pod 的 topic-id 标签（冷启动与温池挂载都会打）。标签缺失时退化为
     * "沙箱 ID 即话题 ID"的历史约定，并要求话题记录的 sandbox_id 与之吻合，
     * 避免温池雪花 ID 恰好是数字时撞上真实话题 ID。
     *
     * @param array<int, SandboxTopicBinding> $bindingsByTopicId
     */
    private function resolveBinding(SandboxPodSnapshot $pod, array $bindingsByTopicId): ?SandboxTopicBinding
    {
        $labelTopicId = (int) $pod->getTopicId();
        if ($labelTopicId > 0) {
            return $bindingsByTopicId[$labelTopicId] ?? null;
        }

        $sandboxId = $pod->getSandboxId();
        $sandboxIdInt = (int) $sandboxId;
        if ($sandboxIdInt <= 0 || (string) $sandboxIdInt !== $sandboxId) {
            return null;
        }

        $binding = $bindingsByTopicId[$sandboxIdInt] ?? null;
        if ($binding === null) {
            return null;
        }

        // 走沙箱 ID 兜底时，必须确认话题自己记的就是这个沙箱（或它从未绑定过）。
        $persistedSandboxId = $binding->getSandboxId();
        if ($persistedSandboxId !== '' && $persistedSandboxId !== $sandboxId) {
            return null;
        }

        return $binding;
    }
}
