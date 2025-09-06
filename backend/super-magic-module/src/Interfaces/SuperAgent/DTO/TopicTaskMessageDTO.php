<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessagePayload;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsageDetails;

/**
 * 话题任务消息DTO.
 */
class TopicTaskMessageDTO
{
    /**
     * 构造函数.
     *
     * @param MessageMetadata $metadata 消息元数据
     * @param MessagePayload $payload 消息负载
     * @param null|TokenUsageDetails $tokenUsageDetails Token 使用详情
     */
    public function __construct(
        private MessageMetadata $metadata,
        private MessagePayload $payload,
        private ?TokenUsageDetails $tokenUsageDetails = null
    ) {
    }

    /**
     * 从消息数据创建DTO实例.
     *
     * @param array $data 消息数据
     */
    public static function fromArray(array $data): self
    {
        $metadata = isset($data['metadata']) && is_array($data['metadata'])
            ? MessageMetadata::fromArray($data['metadata'])
            : new MessageMetadata();

        $payload = isset($data['payload']) && is_array($data['payload'])
            ? MessagePayload::fromArray($data['payload'])
            : new MessagePayload();

        $tokenUsageDetails = isset($data['token_usage_details']) && is_array($data['token_usage_details'])
            ? TokenUsageDetails::fromArray($data['token_usage_details'])
            : null;

        return new self($metadata, $payload, $tokenUsageDetails);
    }

    /**
     * 获取消息元数据.
     */
    public function getMetadata(): MessageMetadata
    {
        return $this->metadata;
    }

    /**
     * 设置消息元数据.
     *
     * @param MessageMetadata $metadata 消息元数据
     */
    public function setMetadata(MessageMetadata $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    /**
     * 获取消息负载.
     */
    public function getPayload(): MessagePayload
    {
        return $this->payload;
    }

    /**
     * 设置消息负载.
     *
     * @param MessagePayload $payload 消息负载
     */
    public function setPayload(MessagePayload $payload): self
    {
        $this->payload = $payload;
        return $this;
    }

    /**
     * 获取 Token 使用详情.
     */
    public function getTokenUsageDetails(): ?TokenUsageDetails
    {
        return $this->tokenUsageDetails;
    }

    /**
     * 设置 Token 使用详情.
     *
     * @param null|TokenUsageDetails $tokenUsageDetails Token 使用详情
     */
    public function setTokenUsageDetails(?TokenUsageDetails $tokenUsageDetails): self
    {
        $this->tokenUsageDetails = $tokenUsageDetails;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'metadata' => $this->metadata->toArray(),
            'payload' => $this->payload->toArray(),
            'token_usage_details' => $this->tokenUsageDetails?->toArray(),
        ];
    }

    /**
     * 转换为TaskMessageEntity实体.
     *
     * @param int $topicId 话题ID
     * @return TaskMessageEntity 任务消息实体
     */
    public function toTaskMessageEntity(int $topicId, string $senderUid, string $receiverUid): TaskMessageEntity
    {
        $messageData = [
            'sender_type' => 'assistant',
            'sender_uid' => $senderUid,
            'receiver_uid' => $receiverUid,
            'message_id' => $this->payload->getMessageId() ?? '',
            'type' => $this->payload->getType() ?? '',
            'task_id' => $this->payload->getTaskId() ?? '',
            'topic_id' => $topicId,
            'status' => $this->payload->getStatus() ?? 'pending',
            'content' => $this->payload->getContent() ?? '',
            'raw_content' => '',
            'steps' => $this->payload->getSteps() ?? null,
            'tool' => $this->payload->getTool() ?? null,
            'attachments' => $this->payload->getAttachments() ?? null,
            'mentions' => null,
            'event' => $this->payload->getEvent() ?? '',
            'send_timestamp' => $this->payload->getSendTimestamp() ?? time(),
            'show_in_ui' => $this->payload->getShowInUi() ?? true,
            'seq_id' => $this->payload->getSeqId() ?? 0,
            'correlation_id' => $this->payload->getCorrelationId(),
        ];

        return new TaskMessageEntity($messageData);
    }
}
