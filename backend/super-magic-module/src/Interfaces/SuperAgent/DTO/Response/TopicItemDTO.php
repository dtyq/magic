<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

class TopicItemDTO extends AbstractDTO
{
    /**
     * @var string 话题ID
     */
    protected string $id = '';

    /**
     * @var string 用户ID
     */
    protected string $userId = '';

    /**
     * @var string 聊天话题ID
     */
    protected string $chatTopicId = '';

    /**
     * @var string 聊天会话ID
     */
    protected string $chatConversationId = '';

    /**
     * @var string 话题名称
     */
    protected string $topicName = '';

    /**
     * @var string 任务状态
     */
    protected string $taskStatus = '';

    /**
     * @var string 项目ID
     */
    protected string $projectId = '';

    /**
     * @var string 工作区ID
     */
    protected string $workspaceId = '';

    /**
     * @var string 话题模式
     */
    protected string $topicMode = '';

    /**
     * @var string 沙箱ID
     */
    protected string $sandboxId = '';

    /**
     * @var string 更新时间
     */
    protected string $updatedAt = '';

    /**
     * 从实体创建 DTO.
     */
    public static function fromEntity(TopicEntity $entity): self
    {
        $dto = new self();
        $dto->setId((string) $entity->getId());
        $dto->setUserId($entity->getUserId() ? (string) $entity->getUserId() : '');
        $dto->setChatTopicId($entity->getChatTopicId());
        $dto->setChatConversationId($entity->getChatConversationId());
        $dto->setTopicName($entity->getTopicName());
        $dto->setTaskStatus($entity->getCurrentTaskStatus()->value);
        $dto->setProjectId($entity->getProjectId() ? (string) $entity->getProjectId() : '');
        $dto->setWorkspaceId($entity->getWorkspaceId() ? (string) $entity->getWorkspaceId() : '');
        $dto->setTopicMode($entity->getTopicMode()->value ?? '');
        $dto->setSandboxId($entity->getSandboxId());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        return $dto;
    }

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

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function setChatTopicId(string $chatTopicId): self
    {
        $this->chatTopicId = $chatTopicId;
        return $this;
    }

    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    public function setChatConversationId(string $chatConversationId): self
    {
        $this->chatConversationId = $chatConversationId;
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

    public function getTaskStatus(): string
    {
        return $this->taskStatus;
    }

    public function setTaskStatus(string $taskStatus): self
    {
        $this->taskStatus = $taskStatus;
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

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(string $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function getTopicMode(): string
    {
        return $this->topicMode;
    }

    public function setTopicMode(string $topicMode): self
    {
        $this->topicMode = $topicMode;
        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
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
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) $data['id'];
        $dto->userId = isset($data['user_id']) ? (string) $data['user_id'] : '';
        $dto->chatTopicId = $data['chat_topic_id'] ?? '';
        $dto->chatConversationId = $data['chat_conversation_id'] ?? '';
        $dto->topicName = $data['topic_name'] ?? $data['name'] ?? '';
        $dto->taskStatus = $data['task_status'] ?? $data['current_task_status'] ?? '';
        $dto->projectId = isset($data['project_id']) ? (string) $data['project_id'] : '';
        $dto->workspaceId = isset($data['workspace_id']) ? (string) $data['workspace_id'] : '';
        $dto->topicMode = $data['topic_mode'] ?? 'general';
        $dto->sandboxId = $data['sandbox_id'] ?? '';
        $dto->updatedAt = $data['updated_at'] ?? '';

        return $dto;
    }

    /**
     * 转换为数组.
     * 输出保持下划线命名，以保持API兼容性.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'chat_topic_id' => $this->chatTopicId,
            'chat_conversation_id' => $this->chatConversationId,
            'topic_name' => $this->topicName,
            'task_status' => $this->taskStatus,
            'project_id' => $this->projectId,
            'workspace_id' => $this->workspaceId,
            'topic_mode' => $this->topicMode,
            'sandbox_id' => $this->sandboxId,
            'updated_at' => $this->updatedAt,
        ];
    }
}
