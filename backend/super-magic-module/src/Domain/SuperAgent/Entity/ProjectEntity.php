<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectStatus;

/**
 * Project Entity.
 */
class ProjectEntity extends AbstractEntity
{
    /**
     * @var int Project ID
     */
    protected int $id = 0;

    /**
     * @var string User ID
     */
    protected string $userId = '';

    /**
     * @var string User organization code
     */
    protected string $userOrganizationCode = '';

    /**
     * @var int Workspace ID
     */
    protected int $workspaceId = 0;

    /**
     * @var string Project name
     */
    protected string $projectName = '';

    /**
     * @var string 项目描述
     */
    protected string $projectDescription = '';

    /**
     * @var string 项目目录
     */
    protected string $workDir = '';

    /**
     * @var string 项目模式
     */
    protected string $projectMode = '';

    /**
     * @var ProjectStatus Project status
     */
    protected ProjectStatus $projectStatus = ProjectStatus::ACTIVE;

    /**
     * @var null|int 当前话题ID
     */
    protected ?int $currentTopicId = null;

    /**
     * @var string 当前话题状态
     */
    protected string $currentTopicStatus = '';

    /**
     * @var string 创建者用户ID
     */
    protected string $createdUid = '';

    /**
     * @var string 更新者用户ID
     */
    protected string $updatedUid = '';

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    /**
     * @var null|string 删除时间
     */
    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        $this->initProperty($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'user_id' => $this->userId,
            'user_organization_code' => $this->userOrganizationCode,
            'workspace_id' => $this->workspaceId,
            'project_name' => $this->projectName,
            'project_description' => $this->projectDescription,
            'work_dir' => $this->workDir,
            'project_status' => $this->projectStatus->value,
            'current_topic_id' => $this->currentTopicId,
            'current_topic_status' => $this->currentTopicStatus,
            'project_mode' => $this->projectMode,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        // 移除null值
        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int|string $id): self
    {
        $this->id = (int) $id;
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

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(int|string $workspaceId): self
    {
        $this->workspaceId = (int) $workspaceId;
        return $this;
    }

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function setProjectName(string $projectName): self
    {
        $this->projectName = $projectName;
        return $this;
    }

    public function getProjectDescription(): string
    {
        return $this->projectDescription;
    }

    public function setProjectDescription(string $projectDescription): self
    {
        $this->projectDescription = $projectDescription;
        return $this;
    }

    public function getWorkDir(): string
    {
        return $this->workDir;
    }

    public function setWorkDir(string $workDir): self
    {
        $this->workDir = $workDir;
        return $this;
    }

    public function getProjectStatus(): ProjectStatus
    {
        return $this->projectStatus;
    }

    public function setProjectStatus(int $projectStatus): self
    {
        $this->projectStatus = ProjectStatus::from($projectStatus);
        return $this;
    }

    public function getCurrentTopicId(): ?int
    {
        return $this->currentTopicId;
    }

    public function setCurrentTopicId(null|int|string $currentTopicId): self
    {
        $this->currentTopicId = $currentTopicId ? (int) $currentTopicId : null;
        return $this;
    }

    public function getCurrentTopicStatus(): string
    {
        return $this->currentTopicStatus;
    }

    public function setCurrentTopicStatus(string $currentTopicStatus): self
    {
        $this->currentTopicStatus = $currentTopicStatus;
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

    /**
     * 检查项目是否已删除.
     */
    public function isDeleted(): bool
    {
        return ! empty($this->deletedAt);
    }

    /**
     * 获取项目状态
     */
    public function getStatus(): ProjectStatus
    {
        // Sync status with deleted_at field
        if ($this->isDeleted() && ! $this->projectStatus->isDeleted()) {
            $this->projectStatus = ProjectStatus::DELETED;
        }
        return $this->projectStatus;
    }

    /**
     * 标记项目为已删除.
     */
    public function markAsDeleted(): self
    {
        $this->deletedAt = date('Y-m-d H:i:s');
        $this->projectStatus = ProjectStatus::DELETED;
        return $this;
    }

    /**
     * 恢复已删除的项目.
     */
    public function restore(): self
    {
        $this->deletedAt = null;
        $this->projectStatus = ProjectStatus::ACTIVE;
        return $this;
    }

    /**
     * 归档项目.
     */
    public function archive(): self
    {
        $this->projectStatus = ProjectStatus::ARCHIVED;
        return $this;
    }

    /**
     * 激活项目.
     */
    public function activate(): self
    {
        $this->projectStatus = ProjectStatus::ACTIVE;
        return $this;
    }

    /**
     * 检查项目是否活跃.
     */
    public function isActive(): bool
    {
        return $this->getStatus()->isActive();
    }

    /**
     * 检查项目是否已归档.
     */
    public function isArchived(): bool
    {
        return $this->getStatus()->isArchived();
    }

    /**
     * 获取项目模式.
     */
    public function getProjectMode(): ?string
    {
        return $this->projectMode;
    }

    /**
     * 设置项目模式.
     */
    public function setProjectMode(?string $projectMode): self
    {
        $this->projectMode = $projectMode ?? '';
        return $this;
    }
}
