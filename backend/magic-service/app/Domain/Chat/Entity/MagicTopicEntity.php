<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

/**
 * 话题所属的消息.
 */
final class MagicTopicEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $topicId = '';

    protected ?string $name = '';

    protected ?string $description = '';

    protected string $conversationId = '';

    protected string $organizationCode = '';

    protected string $createdAt = '';

    protected string $updatedAt = '';

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        if (is_int($id)) {
            $id = (string) $id;
        }
        $this->id = $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        if ($name === null) {
            $name = '';
        }
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        if ($description === null) {
            $description = '';
        }
        $this->description = $description;
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
}
