<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

/**
 * Agent context value object, encapsulating core Agent runtime information.
 *
 * This class is an immutable value object following DDD design patterns
 */
class AgentContext
{
    /**
     * @param string $sandboxId Sandbox ID
     * @param string $authToken Authorization token
     * @param ProjectEntity $projectEntity Project entity
     * @param TopicEntity $topicEntity Topic entity
     * @param TaskEntity $taskEntity Task entity
     * @param ?AgentInitContext $initContext Agent initialization context (optional)
     */
    public function __construct(
        private readonly string $sandboxId,
        private readonly string $authToken,
        private readonly ProjectEntity $projectEntity,
        private readonly TopicEntity $topicEntity,
        private readonly TaskEntity $taskEntity,
        private readonly ?AgentInitContext $initContext = null,
    ) {
    }

    /**
     * Get sandbox ID.
     */
    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    /**
     * Get authorization token.
     */
    public function getAuthToken(): string
    {
        return $this->authToken;
    }

    /**
     * Get project entity.
     */
    public function getProjectEntity(): ProjectEntity
    {
        return $this->projectEntity;
    }

    /**
     * Get topic entity.
     */
    public function getTopicEntity(): TopicEntity
    {
        return $this->topicEntity;
    }

    /**
     * Get task entity.
     */
    public function getTaskEntity(): TaskEntity
    {
        return $this->taskEntity;
    }

    /**
     * Get project ID from project entity.
     */
    public function getProjectId(): int
    {
        return $this->projectEntity->getId();
    }

    /**
     * Get topic ID from topic entity.
     */
    public function getTopicId(): int
    {
        return $this->topicEntity->getId();
    }

    /**
     * Get task ID from task entity.
     */
    public function getTaskId(): string
    {
        return $this->taskEntity->getTaskId();
    }

    /**
     * Get agent initialization context.
     */
    public function getInitContext(): ?AgentInitContext
    {
        return $this->initContext;
    }
}
