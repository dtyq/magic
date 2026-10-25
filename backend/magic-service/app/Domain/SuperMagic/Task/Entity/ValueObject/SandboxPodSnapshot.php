<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 沙箱网关返回的一个 pod 快照（GET /api/v1/sandboxes 的单条记录）.
 *
 * 这是“沙箱当前真实状态”的最小事实来源：pod 可能对应一个话题（冷启动或
 * 温池挂载），也可能是尚未绑定的温池 pod，甚至可能是找不到话题的孤儿。
 * 重启脚本只读事实、不猜状态，因此这里保留原始字段，由上层决定处置方式。
 */
readonly class SandboxPodSnapshot
{
    public function __construct(
        private string $sandboxId,
        private string $status,
        private string $projectId,
        private string $topicId,
        private bool $warmPool,
        private bool $bound,
        private string $createdAt,
        private string $agentImage,
        private string $agfsImage,
    ) {
    }

    /**
     * @param array<string, mixed> $pod 网关原始记录（字段可能缺失）
     */
    public static function fromGatewayArray(array $pod): self
    {
        return new self(
            sandboxId: (string) ($pod['sandbox_id'] ?? ''),
            status: (string) ($pod['status'] ?? ''),
            projectId: (string) ($pod['project_id'] ?? ''),
            topicId: (string) ($pod['topic_id'] ?? ''),
            warmPool: (bool) ($pod['warm_pool'] ?? false),
            bound: (bool) ($pod['bound'] ?? false),
            createdAt: (string) ($pod['created_at'] ?? ''),
            agentImage: (string) ($pod['agent_image'] ?? ''),
            agfsImage: (string) ($pod['agfs_image'] ?? ''),
        );
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function isWarmPool(): bool
    {
        return $this->warmPool;
    }

    public function isBound(): bool
    {
        return $this->bound;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getAgentImage(): string
    {
        return $this->agentImage;
    }

    public function getAgfsImage(): string
    {
        return $this->agfsImage;
    }

    /**
     * 未绑定的温池 pod：没有用户与项目，只能删除，不能“重建”。
     */
    public function isUnboundWarmPool(): bool
    {
        return $this->warmPool && ! $this->bound;
    }

    /**
     * pod 当前镜像；老网关或缺失字段会得到空串，按“未知”处理.
     *
     * @return array{agent_image: string, agfs_image: string}
     */
    public function getImages(): array
    {
        return [
            SandboxImageVersion::AGENT_IMAGE_KEY => $this->agentImage,
            SandboxImageVersion::AGFS_IMAGE_KEY => $this->agfsImage,
        ];
    }

    /**
     * pod 运行时长排序键：创建时间越早越先重启，未知时间排到最后.
     *
     * 用 PHP_INT_MAX 而不是 0，避免“缺字段”被当成 1970 年抢占最优先的位置。
     */
    public function getCreatedAtTimestamp(): int
    {
        if ($this->createdAt === '') {
            return PHP_INT_MAX;
        }

        $timestamp = strtotime($this->createdAt);
        return $timestamp === false ? PHP_INT_MAX : $timestamp;
    }

    /**
     * 运维日志里的一行描述：`sandbox-101@2026-09-01T08:30:00Z`.
     */
    public function describe(): string
    {
        return sprintf('%s@%s', $this->sandboxId, $this->createdAt === '' ? 'unknown' : $this->createdAt);
    }
}
