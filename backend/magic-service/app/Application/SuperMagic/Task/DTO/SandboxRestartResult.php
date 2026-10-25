<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartTarget;

/**
 * 单个话题沙箱的重启结果.
 *
 * 三种结局必须分开表达，不能合并成"成功/失败"两态：
 * - 成功重建：拿到新 sandbox_id；
 * - 部分失败：旧 pod 删掉了但重建失败——这一条最危险，需要人工介入；
 * - 跳过：镜像已是最新或缺少 owner 信息，什么都没做。
 */
readonly class SandboxRestartResult
{
    public const OUTCOME_RESTARTED = 'restarted';

    public const OUTCOME_FAILED = 'failed';

    public const OUTCOME_SKIPPED = 'skipped';

    /**
     * @param string[] $deletedSandboxIds 已删除的旧 pod（可能为空：pod 已被 GC）
     * @param string[] $failedSandboxIds 删除失败的 pod，重建仍会继续
     */
    public function __construct(
        private string $outcome,
        private SandboxRestartTarget $target,
        private string $newSandboxId = '',
        private array $deletedSandboxIds = [],
        private array $failedSandboxIds = [],
        private string $error = '',
        private float $durationSeconds = 0.0,
    ) {
    }

    public static function restarted(
        SandboxRestartTarget $target,
        string $newSandboxId,
        array $deletedSandboxIds,
        array $failedSandboxIds,
        float $durationSeconds,
    ): self {
        return new self(
            outcome: self::OUTCOME_RESTARTED,
            target: $target,
            newSandboxId: $newSandboxId,
            deletedSandboxIds: $deletedSandboxIds,
            failedSandboxIds: $failedSandboxIds,
            durationSeconds: $durationSeconds,
        );
    }

    public static function failed(
        SandboxRestartTarget $target,
        string $error,
        array $deletedSandboxIds,
        array $failedSandboxIds,
        float $durationSeconds,
    ): self {
        return new self(
            outcome: self::OUTCOME_FAILED,
            target: $target,
            deletedSandboxIds: $deletedSandboxIds,
            failedSandboxIds: $failedSandboxIds,
            error: $error,
            durationSeconds: $durationSeconds,
        );
    }

    public function getOutcome(): string
    {
        return $this->outcome;
    }

    public function isRestarted(): bool
    {
        return $this->outcome === self::OUTCOME_RESTARTED;
    }

    public function getTarget(): SandboxRestartTarget
    {
        return $this->target;
    }

    public function getTopicId(): int
    {
        return $this->target->getTopicId();
    }

    public function getNewSandboxId(): string
    {
        return $this->newSandboxId;
    }

    /**
     * @return string[]
     */
    public function getDeletedSandboxIds(): array
    {
        return $this->deletedSandboxIds;
    }

    /**
     * @return string[]
     */
    public function getFailedSandboxIds(): array
    {
        return $this->failedSandboxIds;
    }

    public function getError(): string
    {
        return $this->error;
    }

    public function getDurationSeconds(): float
    {
        return $this->durationSeconds;
    }
}
