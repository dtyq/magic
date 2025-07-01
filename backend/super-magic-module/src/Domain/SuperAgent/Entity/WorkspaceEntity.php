<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceStatus;

class WorkspaceEntity extends AbstractEntity
{
    protected int $id = 0;

    protected string $userId = '';

    protected string $userOrganizationCode = '';

    protected string $chatConversationId = '';

    protected string $name = '';

    protected int $isArchived = 0;

    protected string $createdUid = '';

    protected string $updatedUid = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    protected ?int $currentTopicId = null;

    protected ?int $currentProjectId = null;

    protected int $status = 0;

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getUserOrganizationCode(): string
    {
        return $this->userOrganizationCode;
    }

    public function setUserOrganizationCode(string $userOrganizationCode): self
    {
        $this->userOrganizationCode = $userOrganizationCode;
        return $this;
    }

    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    public function setChatConversationId(string $chatConversationId): self
    {
        $this->chatConversationId = $chatConversationId;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    /**
     * 获取工作区归档状态
     */
    public function getIsArchived(): int
    {
        return $this->isArchived;
    }

    /**
     * 获取工作区归档状态（枚举对象）.
     */
    public function getArchiveStatus(): WorkspaceArchiveStatus
    {
        return WorkspaceArchiveStatus::from($this->isArchived);
    }

    /**
     * 设置工作区归档状态
     */
    public function setIsArchived(int $isArchived): self
    {
        $this->isArchived = $isArchived;
        return $this;
    }

    /**
     * 设置工作区归档状态（通过枚举对象）.
     */
    public function setArchiveStatus(WorkspaceArchiveStatus $archiveStatus): self
    {
        $this->isArchived = $archiveStatus->value;
        return $this;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getCurrentTopicId(): ?int
    {
        return $this->currentTopicId;
    }

    public function setCurrentTopicId(?int $currentTopicId): self
    {
        $this->currentTopicId = $currentTopicId;
        return $this;
    }

    public function getCurrentProjectId(): ?int
    {
        return $this->currentProjectId;
    }

    public function setCurrentProjectId(?int $currentProjectId): self
    {
        $this->currentProjectId = $currentProjectId;
        return $this;
    }

    /**
     * 获取工作区状态
     */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * 获取工作区状态（枚举对象）.
     */
    public function getWorkspaceStatus(): WorkspaceStatus
    {
        return WorkspaceStatus::from($this->status);
    }

    /**
     * 设置工作区状态
     */
    public function setStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 设置工作区状态（通过枚举对象）.
     */
    public function setWorkspaceStatus(WorkspaceStatus $status): self
    {
        $this->status = $status->value;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'user_organization_code' => $this->userOrganizationCode,
            'chat_conversation_id' => $this->chatConversationId,
            'name' => $this->name,
            'is_archived' => $this->isArchived,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
            'current_topic_id' => $this->currentTopicId,
            'current_project_id' => $this->currentProjectId,
            'status' => $this->status,
        ];
    }
}
