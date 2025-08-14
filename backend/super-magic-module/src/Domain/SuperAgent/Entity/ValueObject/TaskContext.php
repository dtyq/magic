<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;

/**
 * 任务上下文对象，用于封装任务相关的上下文参数.
 *
 * 该类是一个不可变的值对象，符合DDD设计模式
 */
class TaskContext
{
    /**
     * @param TaskEntity $task 任务实体
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param string $chatConversationId 聊天会话ID
     * @param string $chatTopicId 聊天主题ID
     * @param string $agentUserId Agent用户ID
     * @param string $sandboxId 沙箱ID
     * @param string $taskId 任务ID
     * @param ChatInstruction $instruction 聊天指令
     * @param string $agentMode Agent模式
     * @param array $mcpConfig MCP配置
     * @param string $workspaceId 工作区ID
     * @param string $messageId 消息ID
     */
    public function __construct(
        private readonly TaskEntity $task,
        private readonly DataIsolation $dataIsolation,
        private readonly string $chatConversationId,
        private readonly string $chatTopicId,
        private readonly string $agentUserId,
        private string $sandboxId = '',
        private string $taskId = '',
        private ChatInstruction $instruction = ChatInstruction::Normal,
        private string $agentMode = '',
        private array $mcpConfig = [],
        private string $modelId = '',
        private array $dynamicConfig = [],
        private string $workspaceId = '',
        private string $messageId = '',
    ) {
    }

    /**
     * 获取任务实体.
     */
    public function getTask(): TaskEntity
    {
        return $this->task;
    }

    /**
     * 获取数据隔离对象
     */
    public function getDataIsolation(): DataIsolation
    {
        return $this->dataIsolation;
    }

    /**
     * 获取聊天会话ID.
     */
    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    /**
     * 获取聊天主题ID.
     */
    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    /**
     * 获取Agent用户ID.
     */
    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    /**
     * 获取沙箱ID.
     */
    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId ?: $this->task->getTaskId();
    }

    /**
     * 获取原始任务ID（从任务实体中获取）.
     */
    public function getOriginalTaskId(): string
    {
        return $this->task->getTaskId();
    }

    /**
     * 获取任务实体ID.
     */
    public function getTaskEntityId(): int
    {
        return $this->task->getId();
    }

    /**
     * 获取任务主题ID.
     */
    public function getTopicId(): int
    {
        return $this->task->getTopicId();
    }

    /**
     * 获取项目ID.
     */
    public function getProjectId(): int
    {
        return $this->task->getProjectId();
    }

    /**
     * 获取当前用户ID.
     */
    public function getCurrentUserId(): string
    {
        return $this->dataIsolation->getCurrentUserId();
    }

    /**
     * 获取当前组织代码
     */
    public function getCurrentOrganizationCode(): string
    {
        return $this->dataIsolation->getCurrentOrganizationCode();
    }

    /**
     * 获取聊天指令.
     */
    public function getInstruction(): ChatInstruction
    {
        return $this->instruction;
    }

    /**
     * 获取Agent模式.
     */
    public function getAgentMode(): string
    {
        return $this->agentMode;
    }

    public function getMcpConfig(): array
    {
        return $this->mcpConfig;
    }

    /**
     * 创建一个带有新任务但保留其他参数的上下文.
     */
    public function withTask(TaskEntity $newTask): self
    {
        return new self(
            $newTask,
            $this->dataIsolation,
            $this->chatConversationId,
            $this->chatTopicId,
            $this->agentUserId,
            $this->sandboxId,
            $this->taskId,
            $this->instruction,
            $this->agentMode,
            $this->mcpConfig,
            $this->modelId,
            $this->dynamicConfig,
            $this->workspaceId,
            $this->messageId,
        );
    }

    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function setInstruction(ChatInstruction $instruction): self
    {
        $this->instruction = $instruction;
        return $this;
    }

    public function setAgentMode(string $agentMode): self
    {
        $this->agentMode = $agentMode;
        return $this;
    }

    public function setMcpConfig(array $mcpConfig): self
    {
        $this->mcpConfig = $mcpConfig;
        return $this;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    public function getDynamicConfig(): array
    {
        if (! empty($this->modelId) && empty($this->dynamicConfig['models'][$this->getModelId()])) {
            // 添加默认配置
            $this->dynamicConfig['models'][$this->getModelId()] = [
                'api_key' => '${MAGIC_API_KEY}',
                'api_base_url' => '${MAGIC_API_BASE_URL}',
                'name' => $this->getModelId(),
            ];
        }

        return $this->dynamicConfig;
    }

    public function setDynamicConfig(array $dynamicConfig): self
    {
        $this->dynamicConfig = $dynamicConfig;
        return $this;
    }

    public function setWorkspaceId(string $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    /**
     * 获取消息ID.
     */
    public function getMessageId(): string
    {
        return $this->messageId;
    }

    /**
     * 设置消息ID.
     */
    public function setMessageId(string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }
}
