<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class ModelIdentifierMappingEntity extends AbstractEntity
{
    private ?int $id = null;

    private string $groupId = '';

    private string $groupName = '';

    private string $sourceModelId = '';

    private string $targetModelId = '';

    private Status $status = Status::Enabled;

    private ?DateTime $createdAt = null;

    private ?DateTime $updatedAt = null;

    private ?DateTime $deletedAt = null;

    /**
     * 获取持久化主键。
     */
    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * 设置持久化主键。
     */
    public function setId(null|int|string $id): self
    {
        $this->id = is_numeric($id) ? (int) $id : null;
        return $this;
    }

    /**
     * 获取映射组标识。
     */
    public function getGroupId(): string
    {
        return $this->groupId;
    }

    /**
     * 设置映射组标识。
     */
    public function setGroupId(string $groupId): self
    {
        $this->groupId = trim($groupId);
        return $this;
    }

    /**
     * 获取映射组名称。
     */
    public function getGroupName(): string
    {
        return $this->groupName;
    }

    /**
     * 设置映射组名称。
     */
    public function setGroupName(string $groupName): self
    {
        $this->groupName = trim($groupName);
        return $this;
    }

    /**
     * 获取源模型标识。
     */
    public function getSourceModelId(): string
    {
        return $this->sourceModelId;
    }

    /**
     * 设置源模型标识。
     */
    public function setSourceModelId(string $sourceModelId): self
    {
        $this->sourceModelId = trim($sourceModelId);
        return $this;
    }

    /**
     * 获取目标模型标识。
     */
    public function getTargetModelId(): string
    {
        return $this->targetModelId;
    }

    /**
     * 设置目标模型标识。
     */
    public function setTargetModelId(string $targetModelId): self
    {
        $this->targetModelId = trim($targetModelId);
        return $this;
    }

    /**
     * 获取映射组状态。
     */
    public function getStatus(): Status
    {
        return $this->status;
    }

    /**
     * 设置映射组状态。
     */
    public function setStatus(int|Status|string $status): self
    {
        $this->status = $status instanceof Status ? $status : (Status::tryFrom((int) $status) ?? Status::Enabled);
        return $this;
    }

    /**
     * 获取创建时间。
     */
    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    /**
     * 设置创建时间。
     */
    public function setCreatedAt(null|DateTime|string $createdAt): self
    {
        $this->createdAt = $createdAt instanceof DateTime ? $createdAt : ($createdAt ? new DateTime($createdAt) : null);
        return $this;
    }

    /**
     * 获取更新时间。
     */
    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    /**
     * 设置更新时间。
     */
    public function setUpdatedAt(null|DateTime|string $updatedAt): self
    {
        $this->updatedAt = $updatedAt instanceof DateTime ? $updatedAt : ($updatedAt ? new DateTime($updatedAt) : null);
        return $this;
    }

    /**
     * 获取软删除时间。
     */
    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    /**
     * 设置软删除时间。
     */
    public function setDeletedAt(null|DateTime|string $deletedAt): self
    {
        $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : ($deletedAt ? new DateTime($deletedAt) : null);
        return $this;
    }
}
