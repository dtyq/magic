<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use App\Domain\LongTermMemory\DTO\SandboxMemoryDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

/**
 * 初始化元数据 DTO.
 * 用于封装初始化 Agent 时的元数据配置，方便后续扩展.
 */
class InitializationMetadataDTO
{
    /**
     * Topic entity (required for initialization).
     */
    private ?TopicEntity $topicEntity = null;

    /**
     * Task entity (optional, but recommended to provide for better context).
     * If provided, will be used directly instead of creating a temporary TaskEntity.
     */
    private ?TaskEntity $taskEntity = null;

    /**
     * Full working directory path (required for initialization).
     */
    private ?string $fullWorkdir = null;

    /**
     * Project entity (optional).
     */
    private ?ProjectEntity $projectEntity = null;

    /**
     * Custom sandbox ID (optional).
     * If not specified, will default to topic ID.
     */
    private ?string $sandboxId = null;

    /**
     * 构造函数.
     *
     * @param ?bool $skipInitMessages 是否跳过初始化消息，用于 ASR 场景
     * @param ?string $authorization 授权信息
     * @param ?AgentRoleValueObject $agentRole Agent role information (name and description)
     * @param ?array $memories 长期记忆内容
     * @param ?string $projectOrganizationCode 项目组织代码
     */
    public function __construct(
        private ?bool $skipInitMessages = null,
        private ?string $authorization = null,
        private ?AgentRoleValueObject $agentRole = null,
        private ?array $memories = null,
        private ?string $projectOrganizationCode = null
    ) {
    }

    /**
     * 创建默认实例.
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * 获取是否跳过初始化消息.
     *
     * @return ?bool 是否跳过初始化消息
     */
    public function getSkipInitMessages(): ?bool
    {
        return $this->skipInitMessages;
    }

    /**
     * 设置是否跳过初始化消息.
     *
     * @param ?bool $skipInitMessages 是否跳过初始化消息
     * @return self 当前实例（支持链式调用）
     */
    public function setSkipInitMessages(?bool $skipInitMessages): self
    {
        $this->skipInitMessages = $skipInitMessages;
        return $this;
    }

    /**
     * 获取授权信息.
     *
     * @return ?string 授权信息
     */
    public function getAuthorization(): ?string
    {
        return $this->authorization;
    }

    /**
     * 设置授权信息.
     *
     * @param ?string $authorization 授权信息
     * @return self 当前实例（支持链式调用）
     */
    public function setAuthorization(?string $authorization): self
    {
        $this->authorization = $authorization;
        return $this;
    }

    /**
     * Get agent role information.
     *
     * @return ?AgentRoleValueObject Agent role information
     */
    public function getAgentRole(): ?AgentRoleValueObject
    {
        return $this->agentRole;
    }

    /**
     * Set agent role information.
     *
     * @param ?AgentRoleValueObject $agentRole Agent role information
     */
    public function setAgentRole(?AgentRoleValueObject $agentRole): void
    {
        $this->agentRole = $agentRole;
    }

    /**
     * 获取项目组织代码.
     *
     * @return ?string 项目组织代码
     */
    public function getProjectOrganizationCode(): ?string
    {
        return $this->projectOrganizationCode;
    }

    /**
     * 设置项目组织代码.
     *
     * @param ?string $projectOrganizationCode 项目组织代码
     * @return self 当前实例（支持链式调用）
     */
    public function setProjectOrganizationCode(?string $projectOrganizationCode): self
    {
        $this->projectOrganizationCode = $projectOrganizationCode;
        return $this;
    }

    /**
     * 获取结构化记忆数组.
     *
     * @return null|SandboxMemoryDTO[]
     */
    public function getMemories(): ?array
    {
        return $this->memories;
    }

    /**
     * 设置结构化记忆数组（最小结构：[{id, content}]）.
     *
     * @param null|SandboxMemoryDTO[] $memories
     * @return self 当前实例（支持链式调用）
     */
    public function setMemories(?array $memories): self
    {
        $this->memories = $memories;
        return $this;
    }

    /**
     * Get topic entity.
     */
    public function getTopicEntity(): ?TopicEntity
    {
        return $this->topicEntity;
    }

    /**
     * Set topic entity.
     */
    public function setTopicEntity(?TopicEntity $topicEntity): self
    {
        $this->topicEntity = $topicEntity;
        return $this;
    }

    /**
     * Get task entity.
     */
    public function getTaskEntity(): ?TaskEntity
    {
        return $this->taskEntity;
    }

    /**
     * Set task entity.
     */
    public function setTaskEntity(?TaskEntity $taskEntity): self
    {
        $this->taskEntity = $taskEntity;
        return $this;
    }

    /**
     * Get full working directory path.
     */
    public function getFullWorkdir(): ?string
    {
        return $this->fullWorkdir;
    }

    /**
     * Set full working directory path.
     */
    public function setFullWorkdir(?string $fullWorkdir): self
    {
        $this->fullWorkdir = $fullWorkdir;
        return $this;
    }

    /**
     * Get project entity.
     */
    public function getProjectEntity(): ?ProjectEntity
    {
        return $this->projectEntity;
    }

    /**
     * Set project entity.
     */
    public function setProjectEntity(?ProjectEntity $projectEntity): self
    {
        $this->projectEntity = $projectEntity;
        return $this;
    }

    /**
     * Get custom sandbox ID.
     */
    public function getSandboxId(): ?string
    {
        return $this->sandboxId;
    }

    /**
     * Set custom sandbox ID.
     */
    public function setSandboxId(?string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    /**
     * Check if all required fields are set for sandbox initialization.
     */
    public function isComplete(): bool
    {
        return $this->topicEntity !== null
            && $this->taskEntity !== null  // ✅ TaskEntity is required
            && $this->fullWorkdir !== null
            && $this->memories !== null
            && $this->agentRole !== null;
    }

    /**
     * Get list of missing required fields.
     *
     * @return array<string>
     */
    public function getMissingFields(): array
    {
        $missing = [];

        if ($this->topicEntity === null) {
            $missing[] = 'topicEntity';
        }
        if ($this->taskEntity === null) {
            $missing[] = 'taskEntity';
        }
        if ($this->fullWorkdir === null) {
            $missing[] = 'fullWorkdir';
        }
        if ($this->memories === null) {
            $missing[] = 'memories';
        }
        if ($this->agentRole === null) {
            $missing[] = 'agentRole';
        }

        return $missing;
    }
}
