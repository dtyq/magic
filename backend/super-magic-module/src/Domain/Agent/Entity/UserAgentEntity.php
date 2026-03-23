<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Hyperf\Database\Model\SoftDeletes;

/**
 * User-owned agent relation entity.
 */
class UserAgentEntity extends AbstractEntity
{
    use SoftDeletes;

    protected ?int $id = null;

    protected string $organizationCode;

    protected string $userId;

    protected string $agentCode;

    protected ?int $agentVersionId = null;

    protected AgentSourceType $sourceType = AgentSourceType::LOCAL_CREATE;

    protected ?int $sourceId = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'agent_code' => $this->agentCode,
            'agent_version_id' => $this->agentVersionId,
            'source_type' => $this->sourceType->value,
            'source_id' => $this->sourceId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];

        return array_filter($result, static fn ($value) => $value !== null);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = is_string($id) ? (int) $id : $id;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
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

    public function getAgentCode(): string
    {
        return $this->agentCode;
    }

    public function setAgentCode(string $agentCode): self
    {
        $this->agentCode = $agentCode;
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

    public function getSourceType(): AgentSourceType
    {
        return $this->sourceType;
    }

    public function setSourceType(AgentSourceType|string $sourceType): self
    {
        $this->sourceType = $sourceType instanceof AgentSourceType ? $sourceType : AgentSourceType::from($sourceType);
        return $this;
    }

    public function getSourceId(): ?int
    {
        return $this->sourceId;
    }

    public function setSourceId(null|int|string $sourceId): self
    {
        if ($sourceId === null) {
            $this->sourceId = null;
        } else {
            $this->sourceId = is_string($sourceId) ? (int) $sourceId : $sourceId;
        }
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
}
