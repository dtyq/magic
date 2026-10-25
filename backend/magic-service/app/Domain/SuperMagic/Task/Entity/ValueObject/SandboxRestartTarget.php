<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 一个需要重建的话题沙箱.
 *
 * 同一个话题在网关清单里可能出现多个 pod（话题表 sandbox_id 与实际 pod 漂移过），
 * 重启必须把该话题名下【所有】pod 都删掉，再重建一个，否则会留下旧镜像孤儿。
 * 因此 pods 保留全量，而不是只取"最新那个"。
 */
readonly class SandboxRestartTarget
{
    /**
     * @param SandboxPodSnapshot[] $pods 网关清单里属于该话题的全部 pod
     */
    public function __construct(
        private SandboxTopicBinding $binding,
        private array $pods,
        private SandboxRestartReason $reason,
    ) {
    }

    public function getBinding(): SandboxTopicBinding
    {
        return $this->binding;
    }

    public function getTopicId(): int
    {
        return $this->binding->getTopicId();
    }

    public function getProjectId(): int
    {
        return $this->binding->getProjectId();
    }

    public function getReason(): SandboxRestartReason
    {
        return $this->reason;
    }

    /**
     * @return SandboxPodSnapshot[]
     */
    public function getPods(): array
    {
        return $this->pods;
    }

    /**
     * 需要删除的 pod id，顺序即执行顺序（最老的在前）.
     *
     * @return string[]
     */
    public function getSandboxIds(): array
    {
        return array_map(
            static fn (SandboxPodSnapshot $pod): string => $pod->getSandboxId(),
            $this->pods
        );
    }

    public function hasDuplicatePods(): bool
    {
        return count($this->pods) > 1;
    }

    /**
     * 该话题最老的 pod 创建时间，用于"跑得最久的先重启"排序.
     */
    public function getOldestCreatedAtTimestamp(): int
    {
        $oldest = PHP_INT_MAX;
        foreach ($this->pods as $pod) {
            $oldest = min($oldest, $pod->getCreatedAtTimestamp());
        }
        return $oldest;
    }

    /**
     * 日志里的一句话描述：`topic_id=101 sandbox(es)=2 (a@..., b@...)`.
     */
    public function describe(): string
    {
        return sprintf(
            'topic_id=%d sandbox(es)=%d (%s), reason=%s',
            $this->getTopicId(),
            count($this->pods),
            implode(', ', array_map(
                static fn (SandboxPodSnapshot $pod): string => $pod->describe(),
                $this->pods
            )),
            $this->reason->value
        );
    }
}
