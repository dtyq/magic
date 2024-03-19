<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 工作区创建参数值对象
 * 遵循DDD中值对象的规范，封装相关参数并确保不可变性.
 */
readonly class WorkspaceCreationParams
{
    /**
     * @param string $chatConversationId 会话ID
     * @param string $workspaceName 工作区名称
     * @param string $chatConversationTopicId 会话话题ID
     * @param string $topicName 话题名称
     */
    public function __construct(
        private string $chatConversationId,
        private string $workspaceName,
        private string $chatConversationTopicId,
        private string $topicName
    ) {
    }

    /**
     * 获取会话ID.
     */
    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    /**
     * 获取工作区名称.
     */
    public function getWorkspaceName(): string
    {
        return $this->workspaceName;
    }

    /**
     * 获取话题ID.
     */
    public function getChatConversationTopicId(): string
    {
        return $this->chatConversationTopicId;
    }

    /**
     * 获取话题名称.
     */
    public function getTopicName(): string
    {
        return $this->topicName;
    }

    /**
     * 创建一个新的实例，修改指定的属性
     * 由于值对象的不可变性，我们创建一个新实例而不是修改原有实例.
     *
     * @param array $params 要修改的属性和值
     * @return self 新的实例
     */
    public function with(array $params): self
    {
        return new self(
            $params['chatConversationId'] ?? $this->chatConversationId,
            $params['workspaceName'] ?? $this->workspaceName,
            $params['chatConversationTopicId'] ?? $this->chatConversationTopicId,
            $params['topicName'] ?? $this->topicName
        );
    }
}
