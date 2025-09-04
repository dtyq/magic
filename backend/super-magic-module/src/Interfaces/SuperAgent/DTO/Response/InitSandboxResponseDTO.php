<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class InitSandboxResponseDTO
{
    protected string $taskType = '';

    protected string $agentName = '';

    protected string $toolName = '';

    protected string $customName = '';

    protected string $modelId = '';

    protected string $workspaceId = '';

    protected string $projectId = '';

    protected string $projectMode = 'general';

    protected string $chatTopicId = '';

    protected string $topicId = '';

    protected string $conversationId = '';

    protected string $taskId = '';

    protected string $sandboxId = '';

    /**
     * 构造函数.
     */
    public function __construct()
    {
    }

    public function getTaskType(): string
    {
        return $this->taskType;
    }

    public function getAgentName(): string
    {
        return $this->agentName;
    }

    public function getToolName(): string
    {
        return $this->toolName;
    }

    public function getCustomName(): string
    {
        return $this->customName;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(string $workspaceId): void
    {
        $this->workspaceId = $workspaceId;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getProjectMode(): string
    {
        return $this->projectMode;
    }

    public function setProjectMode(string $projectMode): void
    {
        $this->projectMode = $projectMode;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function setChatTopicId(string $chatTopicId): void
    {
        $this->chatTopicId = $chatTopicId;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): void
    {
        $this->sandboxId = $sandboxId;
    }

    public function toArray(): array
    {
        return [
            'task_id' => $this->taskId,
            'workspace_id' => $this->workspaceId,
            'project_id' => $this->projectId,
            'project_mode' => $this->projectMode,
            'topic_id' => $this->topicId,
            'sandbox_id' => $this->sandboxId,
        ];
    }
}
