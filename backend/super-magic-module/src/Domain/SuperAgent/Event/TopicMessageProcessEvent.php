<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

/**
 * 话题消息处理事件（轻量级）.
 * 只通知有消息需要处理，不传递具体消息内容.
 */
class TopicMessageProcessEvent extends AbstractEvent
{
    /**
     * 构造函数.
     *
     * @param int $topicId 话题ID
     * @param int $taskId 任务ID
     */
    public function __construct(
        private readonly int $topicId,
        private readonly int $taskId = 0
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
    }

    /**
     * 从数组创建事件.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            topicId: (int) ($data['topic_id'] ?? 0),
            taskId: (int) ($data['task_id'] ?? 0)
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'event_id' => $this->getEventId(),
        ];
    }

    /**
     * 获取话题ID.
     */
    public function getTopicId(): int
    {
        return $this->topicId;
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): int
    {
        return $this->taskId;
    }
}
