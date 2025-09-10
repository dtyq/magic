<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

use function Hyperf\Translation\__;

/**
 * 项目成员设置实体.
 *
 * 表示项目成员的个人设置，如置顶状态、最后活跃时间等
 */
class ProjectMemberSettingEntity extends AbstractEntity
{
    /** @var int 主键ID */
    protected int $id = 0;

    protected string $userId = '';

    protected int $projectId = 0;

    protected string $organizationCode = '';

    protected bool $isPinned = false;

    protected ?string $pinnedAt = null;

    protected bool $isBindWorkspace = false;

    protected int $bindWorkspaceId = 0;

    protected string $lastActiveAt = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        $this->initProperty($data);
        $this->validateEntity();
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function isPinned(): bool
    {
        return $this->isPinned;
    }

    public function setIsPinned(bool $isPinned): void
    {
        $this->isPinned = $isPinned;

        // 设置置顶时间
        if ($isPinned) {
            $this->pinnedAt = date('Y-m-d H:i:s');
        } else {
            $this->pinnedAt = null;
        }
    }

    public function getPinnedAt(): ?string
    {
        return $this->pinnedAt;
    }

    public function setPinnedAt(?string $pinnedAt): void
    {
        $this->pinnedAt = $pinnedAt;
    }

    public function isBindWorkspace(): bool
    {
        return $this->isBindWorkspace;
    }

    public function setIsBindWorkspace(bool $isBindWorkspace): void
    {
        $this->isBindWorkspace = $isBindWorkspace;
    }

    public function getBindWorkspaceId(): int
    {
        return $this->bindWorkspaceId;
    }

    public function setBindWorkspaceId(int $bindWorkspaceId): void
    {
        $this->bindWorkspaceId = $bindWorkspaceId;
    }

    /**
     * 设置工作区绑定.
     */
    public function bindToWorkspace(int $workspaceId): void
    {
        $this->isBindWorkspace = true;
        $this->bindWorkspaceId = $workspaceId;
    }

    /**
     * 取消工作区绑定.
     */
    public function unbindWorkspace(): void
    {
        $this->isBindWorkspace = false;
        $this->bindWorkspaceId = 0;
    }

    public function getLastActiveAt(): string
    {
        return $this->lastActiveAt;
    }

    public function setLastActiveAt(string $lastActiveAt): void
    {
        $this->lastActiveAt = $lastActiveAt;
    }

    /**
     * 更新最后活跃时间为当前时间.
     */
    public function updateLastActiveTime(): void
    {
        $this->lastActiveAt = date('Y-m-d H:i:s');
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * 从数据库模型创建实体.
     */
    public static function modelToEntity(array $data): ProjectMemberSettingEntity
    {
        $entity = new ProjectMemberSettingEntity();
        $entity->setId($data['id']);
        $entity->setUserId($data['user_id']);
        $entity->setProjectId($data['project_id']);
        $entity->setOrganizationCode($data['organization_code']);
        $entity->setIsPinned((bool) $data['is_pinned']);

        // 处理置顶时间
        if (! empty($data['pinned_at'])) {
            $entity->setPinnedAt($data['pinned_at']);
        }

        // 处理工作区绑定字段
        if (isset($data['is_bind_workspace'])) {
            $entity->setIsBindWorkspace((bool) $data['is_bind_workspace']);
        }
        if (isset($data['bind_workspace_id'])) {
            $entity->setBindWorkspaceId((int) $data['bind_workspace_id']);
        }

        // 处理最后活跃时间
        $entity->setLastActiveAt($data['last_active_at']);

        $entity->setCreatedAt($data['created_at']);
        $entity->setUpdatedAt($data['updated_at']);

        return $entity;
    }

    /**
     * 转换为数组格式.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'project_id' => $this->projectId,
            'organization_code' => $this->organizationCode,
            'is_pinned' => $this->isPinned ? 1 : 0,
            'pinned_at' => $this->pinnedAt,
            'is_bind_workspace' => $this->isBindWorkspace ? 1 : 0,
            'bind_workspace_id' => $this->bindWorkspaceId,
            'last_active_at' => $this->lastActiveAt,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }

    /**
     * 转换为数据库插入格式.
     */
    public function toInsertArray(): array
    {
        $data = [
            'user_id' => $this->userId,
            'project_id' => $this->projectId,
            'organization_code' => $this->organizationCode,
            'is_pinned' => $this->isPinned ? 1 : 0,
            'is_bind_workspace' => $this->isBindWorkspace ? 1 : 0,
            'bind_workspace_id' => $this->bindWorkspaceId,
            'last_active_at' => $this->lastActiveAt,
        ];

        if ($this->pinnedAt !== null) {
            $data['pinned_at'] = $this->pinnedAt;
        }

        return $data;
    }

    /**
     * 切换置顶状态.
     */
    public function togglePin(): void
    {
        $this->setIsPinned(! $this->isPinned);
    }

    /**
     * 验证实体数据完整性.
     */
    private function validateEntity(): void
    {
        if (empty($this->userId) && empty($this->projectId)) {
            return; // 允许初始化时为空
        }

        // 基本验证：确保userId和projectId有值
        if (empty(trim($this->userId))) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MEMBER_VALIDATION_FAILED, __('project.setting.user_id_required'));
        }

        if ($this->projectId <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MEMBER_VALIDATION_FAILED, __('project.setting.project_id_required'));
        }
    }
}
