<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO;

/**
 * Task initialization message DTO.
 */
class TaskInitializationMessageDTO
{
    public function __construct(
        private readonly string $organizationCode,
        private readonly string $userId,
        private readonly int $projectId,
        private readonly int $topicId,
        private readonly int $taskId,
        private readonly array $messageContent,
        private readonly string $messageType,
        private readonly string $language,
        private readonly string $chatTopicId = '',
        private readonly string $agentUserId = '',
        private readonly ?array $extraData = null
    ) {
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    public function getExtraData(): ?array
    {
        return $this->extraData;
    }

    public function toArray(): array
    {
        return [
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'message_content' => $this->messageContent,
            'message_type' => $this->messageType,
            'language' => $this->language,
            'chat_topic_id' => $this->chatTopicId,
            'agent_user_id' => $this->agentUserId,
            'extra_data' => $this->extraData,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            organizationCode: $data['organization_code'] ?? '',
            userId: $data['user_id'] ?? '',
            projectId: (int) ($data['project_id'] ?? 0),
            topicId: (int) ($data['topic_id'] ?? 0),
            taskId: (int) ($data['task_id'] ?? 0),
            messageContent: $data['message_content'] ?? [],
            messageType: $data['message_type'] ?? '',
            language: $data['language'] ?? 'en_US',
            chatTopicId: $data['chat_topic_id'] ?? '',
            agentUserId: $data['agent_user_id'] ?? '',
            extraData: $data['extra_data'] ?? null
        );
    }
}
