<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 复制话题请求DTO.
 */
class DuplicateTopicRequestDTO extends AbstractRequestDTO
{
    /**
     * 目标消息ID.
     */
    public string $targetMessageId = '';

    /**
     * 新话题名称.
     */
    public string $newTopicName = '';

    /**
     * User sequence ID.
     */
    public string $userSeqId = '';

    /**
     * 获取目标消息ID.
     */
    public function getTargetMessageId(): string
    {
        return $this->targetMessageId;
    }

    /**
     * 获取新话题名称.
     */
    public function getNewTopicName(): string
    {
        return $this->newTopicName;
    }

    /**
     * Get user sequence ID.
     */
    public function getUserSeqId(): string
    {
        return $this->userSeqId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'target_message_id' => 'required|string',
            'new_topic_name' => 'required|string|max:255',
            'user_seq_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'target_message_id.required' => 'Target message ID is required',
            'target_message_id.string' => 'Target message ID must be a string',
            'new_topic_name.required' => 'New topic name is required',
            'new_topic_name.string' => 'New topic name must be a string',
            'new_topic_name.max' => 'New topic name cannot exceed 255 characters',
            'user_seq_id.required' => 'User sequence ID is required',
            'user_seq_id.string' => 'User sequence ID must be a string',
        ];
    }
}
