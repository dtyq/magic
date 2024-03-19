<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

/**
 * 话题所属的消息.
 */
final class MagicTopicMessageEntity extends AbstractEntity
{
    protected string $seqId;

    protected string $conversationId;

    protected string $organizationCode;

    protected string $topicId;

    protected string $createdAt;

    protected string $updatedAt;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getSeqId(): string
    {
        return $this->seqId;
    }

    public function setSeqId(int|string $seqId): void
    {
        if (is_int($seqId)) {
            $seqId = (string) $seqId;
        }
        $this->seqId = $seqId;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(int|string $conversationId): void
    {
        if (is_int($conversationId)) {
            $conversationId = (string) $conversationId;
        }
        $this->conversationId = $conversationId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(int|string $topicId): void
    {
        if (is_int($topicId)) {
            $topicId = (string) $topicId;
        }
        $this->topicId = $topicId;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }
}
