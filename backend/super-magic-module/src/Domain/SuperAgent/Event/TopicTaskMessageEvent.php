<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessagePayload;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsageDetails;

/**
 * 话题任务消息事件.
 */
class TopicTaskMessageEvent extends AbstractEvent
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
        private ?TokenUsageDetails $tokenUsageDetails = null,
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
    }

    /**
     * 从数组创建消息事件.
     *
     * @param array $data 消息数据数组
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
     * 转换为数组.
     *
     * @return array 消息数据数组
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
     * 获取消息元数据.
     */
    public function getMetadata(): MessageMetadata
    {
        return $this->metadata;
    }

    /**
     * 获取消息负载.
     */
    public function getPayload(): MessagePayload
    {
        return $this->payload;
    }

    public function getTokenUsageDetails(): ?TokenUsageDetails
    {
        return $this->tokenUsageDetails;
    }
}
