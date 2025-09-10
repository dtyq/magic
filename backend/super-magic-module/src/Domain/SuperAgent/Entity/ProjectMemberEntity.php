<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberType;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

/**
 * 项目成员实体.
 *
 * 表示项目中的成员，支持用户和部门两种类型
 */
class ProjectMemberEntity extends AbstractEntity
{
    /** @var int 主键ID */
    protected int $id = 0;

    protected int $projectId = 0;

    protected MemberType $targetType;

    protected string $targetId = '';

    protected MemberRole $role;

    protected string $organizationCode = '';

    protected MemberStatus $status;

    protected string $invitedBy = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        // 设置默认状态为激活
        $this->status = MemberStatus::ACTIVE;
        // 设置默认成员类型为用户
        $this->targetType = MemberType::USER;
        // 设置默认角色为编辑者
        $this->role = MemberRole::EDITOR;

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

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getTargetType(): MemberType
    {
        return $this->targetType;
    }

    public function setTargetType(MemberType $targetType): void
    {
        $this->targetType = $targetType;
    }

    /**
     * 从字符串设置成员类型.
     */
    public function setTargetTypeFromString(string $targetType): void
    {
        $this->targetType = MemberType::fromString($targetType);
    }

    public function getTargetId(): string
    {
        return $this->targetId;
    }

    public function setTargetId(string $targetId): void
    {
        $this->targetId = $targetId;
    }

    public function getRole(): MemberRole
    {
        return $this->role;
    }

    public function setRole(MemberRole $role): void
    {
        $this->role = $role;
    }

    /**
     * 从字符串设置成员角色.
     */
    public function setRoleFromString(string $role): void
    {
        if (empty($role)) {
            // 如果角色为空，设置为默认的编辑者角色，而不是 null
            $this->role = MemberRole::EDITOR;
        } else {
            $this->role = MemberRole::fromString($role);
        }
    }

    /**
     * 获取角色的字符串值.
     */
    public function getRoleValue(): string
    {
        return $this->role->value;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getStatus(): MemberStatus
    {
        return $this->status;
    }

    public function setStatus(MemberStatus $status): void
    {
        $this->status = $status;
    }

    public function getInvitedBy(): string
    {
        return $this->invitedBy;
    }

    public function setInvitedBy(string $invitedBy): void
    {
        $this->invitedBy = $invitedBy;
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

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public static function modelToEntity(array $data): ProjectMemberEntity
    {
        $entity = new ProjectMemberEntity();
        $entity->setId($data['id']);
        $entity->setProjectId($data['project_id']);
        $entity->setTargetTypeFromString($data['target_type']);
        $entity->setTargetId($data['target_id']);
        $entity->setRoleFromString($data['role']);
        $entity->setOrganizationCode($data['organization_code']);
        $entity->setStatus(MemberStatus::from((int) $data['status'])); // 转换为MemberStatus枚举
        $entity->setInvitedBy($data['invited_by']);
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
            'project_id' => $this->projectId,
            'target_type' => $this->targetType->value,
            'target_id' => $this->targetId,
            'role' => $this->getRoleValue(),
            'organization_code' => $this->organizationCode,
            'status' => $this->status->value,
            'invited_by' => $this->invitedBy,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];
    }

    /**
     * 验证实体数据完整性.
     */
    private function validateEntity(): void
    {
        if (empty($this->targetId)) {
            return; // 允许初始化时为空
        }

        // 基本验证：确保targetId有值
        if (empty(trim($this->targetId))) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MEMBER_VALIDATION_FAILED);
        }
    }
}
