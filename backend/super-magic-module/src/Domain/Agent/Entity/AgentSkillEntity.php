<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * Agent × Skill 关联实体.
 */
class AgentSkillEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID
     */
    protected ?int $id = null;

    /**
     * @var int 关联的 Agent ID，对应 magic_super_magic_agents.id
     */
    protected int $agentId;

    /**
     * @var null|int 关联的 Agent 版本 ID，对应 magic_super_magic_agent_versions.id，NULL 表示不属于特定版本
     */
    protected ?int $agentVersionId = null;

    /**
     * @var string Agent 代码标识，对应 magic_super_magic_agents.code
     */
    protected string $agentCode;

    /**
     * @var int 关联的 Skill ID，对应 magic_skills.id
     */
    protected int $skillId;

    /**
     * @var int 关联的 Skill 版本 ID，对应 magic_skill_versions.id
     */
    protected ?int $skillVersionId = null;

    /**
     * @var string Skill 代码标识，对应 skill_version.code
     */
    protected string $skillCode;

    /**
     * @var int Skill 在 Agent 中的展示排序，数值越小越靠前
     */
    protected int $sortOrder = 0;

    /**
     * @var string 绑定操作人用户 ID
     */
    protected string $creatorId;

    /**
     * @var null|string 绑定时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    /**
     * @var null|string 软删除时间，NULL 表示绑定有效（解绑使用软删除）
     */
    protected ?string $deletedAt = null;

    protected ?string $organizationCode = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'agent_id' => $this->agentId,
            'agent_version_id' => $this->agentVersionId,
            'agent_code' => $this->agentCode,
            'skill_id' => $this->skillId,
            'skill_version_id' => $this->skillVersionId,
            'skill_code' => $this->skillCode,
            'sort_order' => $this->sortOrder,
            'creator_id' => $this->creatorId,
            'organization_code' => $this->organizationCode,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        if (is_string($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = $id;
        }
        return $this;
    }

    public function getAgentId(): int
    {
        return $this->agentId;
    }

    public function setAgentId(int|string $agentId): self
    {
        $this->agentId = is_string($agentId) ? (int) $agentId : $agentId;
        return $this;
    }

    public function getAgentVersionId(): ?int
    {
        return $this->agentVersionId;
    }

    public function setAgentVersionId(null|int|string $agentVersionId): self
    {
        if ($agentVersionId === null) {
            $this->agentVersionId = null;
        } else {
            $this->agentVersionId = is_string($agentVersionId) ? (int) $agentVersionId : $agentVersionId;
        }
        return $this;
    }

    public function getAgentCode(): string
    {
        return $this->agentCode;
    }

    public function setAgentCode(string $agentCode): self
    {
        $this->agentCode = $agentCode;
        return $this;
    }

    public function getSkillId(): int
    {
        return $this->skillId;
    }

    public function setSkillId(int|string $skillId): self
    {
        $this->skillId = is_string($skillId) ? (int) $skillId : $skillId;
        return $this;
    }

    public function getSkillVersionId(): int
    {
        return $this->skillVersionId;
    }

    public function setSkillVersionId(?int $skillVersionId): self
    {
        $this->skillVersionId = $skillVersionId;
        return $this;
    }

    public function getSkillCode(): string
    {
        return $this->skillCode;
    }

    public function setSkillCode(string $skillCode): self
    {
        $this->skillCode = $skillCode;
        return $this;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int|string $sortOrder): self
    {
        $this->sortOrder = is_string($sortOrder) ? (int) $sortOrder : $sortOrder;
        return $this;
    }

    public function getCreatorId(): string
    {
        return $this->creatorId;
    }

    public function setCreatorId(string $creatorId): self
    {
        $this->creatorId = $creatorId;
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

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
