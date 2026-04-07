<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class IngestThirdPartyMessageRequestDTO extends AbstractRequestDTO
{
    public string $projectId = '';

    public string $topicId = '';

    public string $messageType = '';

    public array $messageContent = [];

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    public function getSource(): array
    {
        $sourceData = $this->messageContent['extra']['super_agent']['source'] ?? [];
        if (! is_array($sourceData)) {
            return [];
        }

        $source = [
            'channel' => (string) ($sourceData['channel'] ?? ''),
        ];

        if (! empty($sourceData['message_id'])) {
            $source['message_id'] = (string) $sourceData['message_id'];
        }
        if (! empty($sourceData['conversation_id'])) {
            $source['conversation_id'] = (string) $sourceData['conversation_id'];
        }
        if (! empty($sourceData['sender_id'])) {
            $source['sender_id'] = (string) $sourceData['sender_id'];
        }

        return $source;
    }

    public function toCreateTaskRequestDTO(): CreateTaskRequestDTO
    {
        return new CreateTaskRequestDTO([
            'project_id' => $this->getProjectId(),
            'topic_id' => $this->getTopicId(),
            'message_type' => $this->getMessageType(),
            'message_content' => $this->getMessageContent(),
        ]);
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'message_type' => 'required|string|in:text,rich_text',
            'message_content' => 'required|array',
            'message_content.content' => 'required|string|max:65000',
            'message_content.extra' => 'nullable|array',
            'message_content.extra.super_agent' => 'required|array',
            'message_content.extra.super_agent.source' => 'required|array',
            'message_content.extra.super_agent.source.channel' => 'required|string|max:64',
            'message_content.extra.super_agent.source.message_id' => 'required|string|max:255',
            'message_content.extra.super_agent.source.conversation_id' => 'nullable|string|max:255',
            'message_content.extra.super_agent.source.sender_id' => 'nullable|string|max:255',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID is required',
            'topic_id.required' => 'Topic ID is required',
            'message_type.required' => 'Message type is required',
            'message_type.in' => 'Message type must be text or rich_text',
            'message_content.required' => 'Message content is required',
            'message_content.content.required' => 'Message content cannot be empty',
            'message_content.content.max' => 'Message content cannot exceed 65000 characters',
            'message_content.extra.super_agent.required' => 'Super agent extra is required',
            'message_content.extra.super_agent.source.required' => 'Source is required',
            'message_content.extra.super_agent.source.channel.required' => 'Source channel is required',
            'message_content.extra.super_agent.source.message_id.required' => 'Source message ID is required',
        ];
    }
}
