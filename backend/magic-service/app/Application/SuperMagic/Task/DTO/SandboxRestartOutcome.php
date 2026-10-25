<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodDeletion;

/**
 * 一次完整重启的汇总结果.
 *
 * 刻意不提供 "success()" 这种粗粒度布尔：
 * - restarted 与 failed 必须同时可见，部分失败不能被"整体成功"掩盖；
 * - deletedOnly 是与重建无关的清理（温池/孤儿 pod），单独计数；
 * - suspendedTasks 让运维知道有多少正在跑或等待用户的任务被主动挂起。
 */
readonly class SandboxRestartOutcome
{
    /**
     * @param SandboxRestartResult[] $results
     * @param SandboxPodDeletion[] $deletedPods
     * @param array<int, array{pod: SandboxPodDeletion, error: string}> $deletionFailures
     */
    public function __construct(
        private array $results,
        private array $deletedPods,
        private array $deletionFailures,
        private int $suspendedTasks,
        private int $suspendedTopics,
        private float $durationSeconds,
    ) {
    }

    /**
     * @return SandboxRestartResult[]
     */
    public function getResults(): array
    {
        return $this->results;
    }

    /**
     * @return SandboxPodDeletion[]
     */
    public function getDeletedPods(): array
    {
        return $this->deletedPods;
    }

    /**
     * @return array<int, array{pod: SandboxPodDeletion, error: string}>
     */
    public function getDeletionFailures(): array
    {
        return $this->deletionFailures;
    }

    public function getSuspendedTasks(): int
    {
        return $this->suspendedTasks;
    }

    public function getSuspendedTopics(): int
    {
        return $this->suspendedTopics;
    }

    public function getDurationSeconds(): float
    {
        return $this->durationSeconds;
    }

    public function getRestartedCount(): int
    {
        return $this->countByOutcome(SandboxRestartResult::OUTCOME_RESTARTED);
    }

    public function getFailedCount(): int
    {
        return $this->countByOutcome(SandboxRestartResult::OUTCOME_FAILED);
    }

    /**
     * 删除失败的 pod 数（旧 pod 没删掉，但仍尝试重建）.
     */
    public function getDeleteFailureCount(): int
    {
        $count = 0;
        foreach ($this->results as $result) {
            $count += count($result->getFailedSandboxIds());
        }
        return $count + count($this->deletionFailures);
    }

    public function hasFailures(): bool
    {
        return $this->getFailedCount() > 0 || $this->getDeleteFailureCount() > 0;
    }

    private function countByOutcome(string $outcome): int
    {
        $count = 0;
        foreach ($this->results as $result) {
            if ($result->getOutcome() === $outcome) {
                ++$count;
            }
        }
        return $count;
    }
}
