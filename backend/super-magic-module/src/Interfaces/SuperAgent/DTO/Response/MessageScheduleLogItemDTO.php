<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleLogEntity;

/**
 * Message Schedule Log Item DTO.
 * Response DTO for message schedule execution logs.
 */
class MessageScheduleLogItemDTO extends AbstractDTO
{
    /**
     * @var string Execution time
     */
    protected string $executedAt = '';

    /**
     * @var string Task name
     */
    protected string $taskName = '';

    /**
     * @var string Workspace ID
     */
    protected string $workspaceId = '';

    /**
     * @var string Workspace name
     */
    protected string $workspaceName = '';

    /**
     * @var string Project ID
     */
    protected string $projectId = '';

    /**
     * @var string Project name
     */
    protected string $projectName = '';

    /**
     * @var string Topic ID
     */
    protected string $topicId = '';

    /**
     * @var string Topic name
     */
    protected string $topicName = '';

    /**
     * @var int Execution status (1=success, 2=failed, 3=running)
     */
    protected int $status = 0;

    /**
     * @var string Error message (if status is failed)
     */
    protected string $errorMessage = '';

    public function getExecutedAt(): string
    {
        return $this->executedAt;
    }

    public function setExecutedAt(string $executedAt): self
    {
        $this->executedAt = $executedAt;
        return $this;
    }

    public function getTaskName(): string
    {
        return $this->taskName;
    }

    public function setTaskName(string $taskName): self
    {
        $this->taskName = $taskName;
        return $this;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(string $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function getWorkspaceName(): string
    {
        return $this->workspaceName;
    }

    public function setWorkspaceName(string $workspaceName): self
    {
        $this->workspaceName = $workspaceName;
        return $this;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
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

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function setTopicName(string $topicName): self
    {
        $this->topicName = $topicName;
        return $this;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getErrorMessage(): string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    /**
     * Create DTO from MessageScheduleLogEntity with additional name information.
     *
     * @param MessageScheduleLogEntity $entity The log entity
     * @param string $workspaceName The workspace name (fetched separately)
     * @param string $projectName The project name (fetched separately)
     * @param string $topicName The topic name (fetched separately)
     */
    public static function fromEntity(
        MessageScheduleLogEntity $entity,
        string $workspaceName = '',
        string $projectName = '',
        string $topicName = ''
    ): self {
        // Convert workspace_id: 0 -> "collaboration", others -> string
        $workspaceId = $entity->getWorkspaceId() === 0
            ? 'collaboration'
            : (string) $entity->getWorkspaceId();

        return (new self())
            ->setExecutedAt($entity->getExecutedAt())
            ->setTaskName($entity->getTaskName())
            ->setWorkspaceId($workspaceId)
            ->setWorkspaceName($workspaceName)
            ->setProjectId((string) $entity->getProjectId())
            ->setProjectName($projectName)
            ->setTopicId((string) $entity->getTopicId())
            ->setTopicName($topicName)
            ->setStatus($entity->getStatus())
            ->setErrorMessage($entity->getErrorMessage() ?? '');
    }
}
