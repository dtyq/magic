<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Agent initialization context value object.
 *
 * Encapsulates all initialization parameters for Agent sandbox initialization.
 * Supports builder pattern with setter methods for flexible construction
 */
class AgentInitContext
{
    /**
     * Message ID.
     */
    private string $messageId = '';

    /**
     * User ID.
     */
    private string $userId = '';

    /**
     * Project ID.
     */
    private string $projectId = '';

    /**
     * Message type (e.g., MessageType::Init->value).
     */
    private string $type = '';

    /**
     * Upload configuration (STS credentials).
     */
    private array $uploadConfig = [];

    /**
     * Message subscription configuration.
     */
    private array $messageSubscriptionConfig = [];

    /**
     * STS token refresh configuration.
     */
    private array $stsTokenRefresh = [];

    /**
     * Message metadata.
     */
    private array $metadata = [];

    /**
     * Task mode.
     */
    private string $taskMode = '';

    /**
     * Agent mode.
     */
    private string $agentMode = '';

    /**
     * Magic service host URL.
     */
    private string $magicServiceHost = '';

    /**
     * Magic service websocket host URL.
     */
    private string $magicServiceWsHost = '';

    /**
     * Long-term memories.
     */
    private ?array $memories = null;

    /**
     * Chat history directory path.
     */
    private string $chatHistoryDir = '';

    /**
     * Working directory path.
     */
    private string $workDir = '';

    /**
     * Model ID.
     */
    private string $modelId = '';

    /**
     * Whether to fetch history.
     */
    private bool $fetchHistory = false;

    /**
     * Create a new instance.
     */
    public function __construct()
    {
    }

    /**
     * Create default instance (factory method).
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * Get message ID.
     */
    public function getMessageId(): string
    {
        return $this->messageId;
    }

    /**
     * Set message ID.
     */
    public function setMessageId(string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }

    /**
     * Get user ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Set user ID.
     */
    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Set project ID.
     */
    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * Get message type.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Set message type.
     */
    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    /**
     * Get upload configuration.
     */
    public function getUploadConfig(): array
    {
        return $this->uploadConfig;
    }

    /**
     * Set upload configuration.
     */
    public function setUploadConfig(array $uploadConfig): self
    {
        $this->uploadConfig = $uploadConfig;
        return $this;
    }

    /**
     * Get message subscription configuration.
     */
    public function getMessageSubscriptionConfig(): array
    {
        return $this->messageSubscriptionConfig;
    }

    /**
     * Set message subscription configuration.
     */
    public function setMessageSubscriptionConfig(array $messageSubscriptionConfig): self
    {
        $this->messageSubscriptionConfig = $messageSubscriptionConfig;
        return $this;
    }

    /**
     * Get STS token refresh configuration.
     */
    public function getStsTokenRefresh(): array
    {
        return $this->stsTokenRefresh;
    }

    /**
     * Set STS token refresh configuration.
     */
    public function setStsTokenRefresh(array $stsTokenRefresh): self
    {
        $this->stsTokenRefresh = $stsTokenRefresh;
        return $this;
    }

    /**
     * Get message metadata.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * Set message metadata.
     */
    public function setMetadata(array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    /**
     * Get task mode.
     */
    public function getTaskMode(): string
    {
        return $this->taskMode;
    }

    /**
     * Set task mode.
     */
    public function setTaskMode(string $taskMode): self
    {
        $this->taskMode = $taskMode;
        return $this;
    }

    /**
     * Get agent mode.
     */
    public function getAgentMode(): string
    {
        return $this->agentMode;
    }

    /**
     * Set agent mode.
     */
    public function setAgentMode(string $agentMode): self
    {
        $this->agentMode = $agentMode;
        return $this;
    }

    /**
     * Get magic service host.
     */
    public function getMagicServiceHost(): string
    {
        return $this->magicServiceHost;
    }

    /**
     * Set magic service host.
     */
    public function setMagicServiceHost(string $magicServiceHost): self
    {
        $this->magicServiceHost = $magicServiceHost;
        return $this;
    }

    /**
     * Get magic service websocket host.
     */
    public function getMagicServiceWsHost(): string
    {
        return $this->magicServiceWsHost;
    }

    /**
     * Set magic service websocket host.
     */
    public function setMagicServiceWsHost(string $magicServiceWsHost): self
    {
        $this->magicServiceWsHost = $magicServiceWsHost;
        return $this;
    }

    /**
     * Get memories.
     */
    public function getMemories(): ?array
    {
        return $this->memories;
    }

    /**
     * Set memories.
     */
    public function setMemories(?array $memories): self
    {
        $this->memories = $memories;
        return $this;
    }

    /**
     * Get chat history directory.
     */
    public function getChatHistoryDir(): string
    {
        return $this->chatHistoryDir;
    }

    /**
     * Set chat history directory.
     */
    public function setChatHistoryDir(string $chatHistoryDir): self
    {
        $this->chatHistoryDir = $chatHistoryDir;
        return $this;
    }

    /**
     * Get working directory.
     */
    public function getWorkDir(): string
    {
        return $this->workDir;
    }

    /**
     * Set working directory.
     */
    public function setWorkDir(string $workDir): self
    {
        $this->workDir = $workDir;
        return $this;
    }

    /**
     * Get model ID.
     */
    public function getModelId(): string
    {
        return $this->modelId;
    }

    /**
     * Set model ID.
     */
    public function setModelId(string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    /**
     * Get fetch history flag.
     */
    public function getFetchHistory(): bool
    {
        return $this->fetchHistory;
    }

    /**
     * Set fetch history flag.
     */
    public function setFetchHistory(bool $fetchHistory): self
    {
        $this->fetchHistory = $fetchHistory;
        return $this;
    }

    /**
     * Convert to array format matching generateInitializationInfo return structure.
     */
    public function toArray(): array
    {
        return [
            'message_id' => $this->messageId,
            'user_id' => $this->userId,
            'project_id' => $this->projectId,
            'type' => $this->type,
            'upload_config' => $this->uploadConfig,
            'message_subscription_config' => $this->messageSubscriptionConfig,
            'sts_token_refresh' => $this->stsTokenRefresh,
            'metadata' => $this->metadata,
            'task_mode' => $this->taskMode,
            'agent_mode' => $this->agentMode,
            'magic_service_host' => $this->magicServiceHost,
            'magic_service_ws_host' => $this->magicServiceWsHost,
            'memories' => $this->memories,
            'chat_history_dir' => $this->chatHistoryDir,
            'work_dir' => $this->workDir,
            'model_id' => $this->modelId,
            'fetch_history' => $this->fetchHistory,
        ];
    }
}
