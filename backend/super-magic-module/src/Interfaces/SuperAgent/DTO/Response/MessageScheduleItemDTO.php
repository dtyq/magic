<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;

class MessageScheduleItemDTO extends AbstractDTO
{
    /**
     * @var string Message schedule ID
     */
    protected string $id = '';

    /**
     * @var string User ID
     */
    protected string $userId = '';

    /**
     * @var string Organization code
     */
    protected string $organizationCode = '';

    /**
     * @var string Task name
     */
    protected string $taskName = '';

    /**
     * @var string Message type
     */
    protected string $messageType = '';

    /**
     * @var array Message content
     */
    protected array $messageContent = [];

    /**
     * @var string Workspace ID
     */
    protected string $workspaceId = '';

    /**
     * @var string Project ID
     */
    protected string $projectId = '';

    /**
     * @var string Topic ID
     */
    protected string $topicId = '';

    /**
     * @var int Completed status (0-not completed, 1-completed)
     */
    protected int $completed = 0;

    /**
     * @var int Enabled status (0-disabled, 1-enabled)
     */
    protected int $enabled = 1;

    /**
     * @var null|string Deadline time
     */
    protected ?string $deadline = null;

    /**
     * @var string Remark
     */
    protected string $remark = '';

    /**
     * @var array Time configuration
     */
    protected array $timeConfig = [];

    /**
     * @var null|array MCP plugins configuration
     */
    protected ?array $plugins = null;

    /**
     * @var string Task scheduler crontab ID
     */
    protected string $taskSchedulerCrontabId = '';

    /**
     * @var string Updated at timestamp
     */
    protected string $updatedAt = '';

    /**
     * Create DTO from entity.
     */
    public static function fromEntity(MessageScheduleEntity $entity): self
    {
        $dto = new self();
        $dto->setId((string) $entity->getId());
        $dto->setUserId($entity->getUserId());
        $dto->setOrganizationCode($entity->getOrganizationCode());
        $dto->setTaskName($entity->getTaskName());
        $dto->setMessageType($entity->getMessageType());
        $dto->setMessageContent($entity->getMessageContent());

        // Convert workspace_id: 0 -> "collaboration", others -> string
        $workspaceId = $entity->getWorkspaceId() === 0
            ? 'collaboration'
            : (string) $entity->getWorkspaceId();
        $dto->setWorkspaceId($workspaceId);

        $dto->setProjectId((string) $entity->getProjectId());
        $dto->setTopicId((string) $entity->getTopicId());
        $dto->setCompleted($entity->getCompleted());
        $dto->setEnabled($entity->getEnabled());
        $dto->setDeadline($entity->getDeadline());
        $dto->setRemark($entity->getRemark());
        $dto->setTimeConfig($entity->getTimeConfig());
        $dto->setPlugins($entity->getPlugins());
        $dto->setTaskSchedulerCrontabId($entity->getTaskSchedulerCrontabId() ? (string) $entity->getTaskSchedulerCrontabId() : '');
        $dto->setUpdatedAt($entity->getUpdatedAt() ?? '');
        return $dto;
    }

    /**
     * Create DTO from array.
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) ($data['id'] ?? '');
        $dto->userId = $data['user_id'] ?? '';
        $dto->organizationCode = $data['organization_code'] ?? '';
        $dto->taskName = $data['task_name'] ?? '';
        $dto->messageType = $data['message_type'] ?? '';
        $dto->messageContent = $data['message_content'] ?? [];
        $dto->workspaceId = (string) ($data['workspace_id'] ?? '');
        $dto->projectId = (string) ($data['project_id'] ?? '');
        $dto->topicId = (string) ($data['topic_id'] ?? '');
        $dto->completed = (int) ($data['completed'] ?? 0);
        $dto->enabled = (int) ($data['enabled'] ?? 1);
        $dto->deadline = $data['deadline'] ?? null;
        $dto->remark = $data['remark'] ?? '';
        $dto->timeConfig = $data['time_config'] ?? [];
        $dto->plugins = $data['plugins'] ?? null;
        $dto->taskSchedulerCrontabId = (string) ($data['task_scheduler_crontab_id'] ?? '');
        $dto->updatedAt = $data['updated_at'] ?? '';
        return $dto;
    }

    // Getters and Setters
    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): self
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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
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

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function setMessageType(string $messageType): self
    {
        $this->messageType = $messageType;
        return $this;
    }

    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    public function setMessageContent(array $messageContent): self
    {
        $this->messageContent = $messageContent;
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

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
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

    public function getCompleted(): int
    {
        return $this->completed;
    }

    public function setCompleted(int $completed): self
    {
        $this->completed = $completed;
        return $this;
    }

    public function getEnabled(): int
    {
        return $this->enabled;
    }

    public function setEnabled(int $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getDeadline(): ?string
    {
        return $this->deadline;
    }

    public function setDeadline(?string $deadline): self
    {
        $this->deadline = $deadline;
        return $this;
    }

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function setRemark(string $remark): self
    {
        $this->remark = $remark;
        return $this;
    }

    public function getTimeConfig(): array
    {
        return $this->timeConfig;
    }

    public function setTimeConfig(array $timeConfig): self
    {
        $this->timeConfig = $timeConfig;
        return $this;
    }

    public function getPlugins(): ?array
    {
        return $this->plugins;
    }

    public function setPlugins(?array $plugins): self
    {
        $this->plugins = $plugins;
        return $this;
    }

    public function getTaskSchedulerCrontabId(): string
    {
        return $this->taskSchedulerCrontabId;
    }

    public function setTaskSchedulerCrontabId(string $taskSchedulerCrontabId): self
    {
        $this->taskSchedulerCrontabId = $taskSchedulerCrontabId;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    /**
     * Convert to array.
     * Keep underscore naming for API compatibility.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'task_name' => $this->taskName,
            'message_type' => $this->messageType,
            'message_content' => $this->messageContent,
            'workspace_id' => $this->workspaceId,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'completed' => $this->completed,
            'enabled' => $this->enabled,
            'deadline' => $this->deadline,
            'remark' => $this->remark,
            'time_config' => $this->timeConfig,
            'plugins' => $this->plugins,
            'task_scheduler_crontab_id' => $this->taskSchedulerCrontabId,
            'updated_at' => $this->updatedAt,
        ];
    }
}
