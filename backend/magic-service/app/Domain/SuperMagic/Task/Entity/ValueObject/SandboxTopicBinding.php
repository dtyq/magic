<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

use App\Domain\SuperMagic\Topic\Entity\TopicEntity;

/**
 * 重启时需要用到的话题归属信息（谁的项目、谁的沙箱）.
 *
 * 沙箱重建以话题 owner 的身份发起：要生成 STS、拉取历史、初始化 agent，
 * 缺任何一个身份字段都无法安全重建，因此把"信息是否完整"显式暴露出来，
 * 让上层把它当作一个可解释的跳过原因，而不是在重建到一半时才失败。
 */
readonly class SandboxTopicBinding
{
    public function __construct(
        private int $topicId,
        private int $projectId,
        private string $userId,
        private string $organizationCode,
        private string $sandboxId,
    ) {
    }

    public static function fromEntity(TopicEntity $topic): self
    {
        return new self(
            topicId: $topic->getId(),
            projectId: $topic->getProjectId(),
            userId: $topic->getUserId(),
            organizationCode: $topic->getUserOrganizationCode(),
            sandboxId: $topic->getSandboxId(),
        );
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * 话题表里记录的 sandbox_id；老数据可能为空串.
     */
    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function hasOwner(): bool
    {
        return $this->userId !== '' && $this->organizationCode !== '';
    }
}
