<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 消息负载值对象.
 */
class MessagePayload
{
    /**
     * 构造函数.
     *
     * @param string $messageId 消息ID
     * @param string $type 消息类型
     * @param string $taskId 任务ID
     * @param string $status 状态
     * @param string $content 内容
     * @param null|array $steps 步骤
     * @param null|array $tool 工具
     * @param int $sendTimestamp 发送时间戳
     * @param string $event 事件
     * @param array $attachments 附件列表
     * @param null|array $projectArchive 项目归档数据
     * @param bool $showInUi 是否在UI中显示
     * @param string $remark 备注
     * @param int $seqId 序列ID
     * @param null|string $correlationId 关联ID
     */
    public function __construct(
        private string $messageId = '',
        private string $type = '',
        private string $taskId = '',
        private string $status = '',
        private string $content = '',
        private ?array $steps = null,
        private ?array $tool = null,
        private int $sendTimestamp = 0,
        private string $event = '',
        private array $attachments = [],
        private ?array $projectArchive = null,
        private bool $showInUi = true,
        private string $remark = '',
        private int $seqId = 0,
        private ?string $correlationId = null
    ) {
    }

    /**
     * 从数组创建负载对象.
     *
     * @param array $data 负载数据数组
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['message_id'] ?? '',
            $data['type'] ?? '',
            $data['task_id'] ?? '',
            $data['status'] ?? '',
            $data['content'] ?? '',
            $data['steps'] ?? null,
            $data['tool'] ?? null,
            isset($data['send_timestamp']) ? (int) $data['send_timestamp'] : time(),
            $data['event'] ?? '',
            $data['attachments'] ?? [],
            $data['project_archive'] ?? null,
            $data['show_in_ui'] ?? true,
            $data['remark'] ?? '',
            $data['seq_id'] ?? 0,
            $data['correlation_id'] ?? null,
        );
    }

    /**
     * 转换为数组.
     *
     * @return array 负载数据数组
     */
    public function toArray(): array
    {
        return [
            'message_id' => $this->messageId,
            'type' => $this->type,
            'task_id' => $this->taskId,
            'status' => $this->status,
            'content' => $this->content,
            'steps' => $this->steps,
            'tool' => $this->tool,
            'send_timestamp' => $this->sendTimestamp ?: time(),
            'event' => $this->event,
            'attachments' => $this->attachments,
            'project_archive' => $this->projectArchive,
            'show_in_ui' => $this->showInUi,
            'remark' => $this->remark,
            'seq_id' => $this->seqId,
            'correlation_id' => $this->correlationId,
        ];
    }

    // Getters
    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getSteps(): ?array
    {
        return $this->steps;
    }

    public function getTool(): ?array
    {
        return $this->tool;
    }

    public function getSendTimestamp(): int
    {
        return $this->sendTimestamp;
    }

    public function getEvent(): string
    {
        return $this->event;
    }

    public function getAttachments(): array
    {
        return $this->attachments;
    }

    /**
     * 获取项目归档数据.
     */
    public function getProjectArchive(): ?array
    {
        return $this->projectArchive;
    }

    public function getShowInUi(): bool
    {
        return $this->showInUi;
    }

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function getSeqId(): int
    {
        return $this->seqId;
    }

    // Withers for immutability
    public function withMessageId(string $messageId): self
    {
        $clone = clone $this;
        $clone->messageId = $messageId;
        return $clone;
    }

    public function withType(string $type): self
    {
        $clone = clone $this;
        $clone->type = $type;
        return $clone;
    }

    public function withTaskId(string $taskId): self
    {
        $clone = clone $this;
        $clone->taskId = $taskId;
        return $clone;
    }

    public function withStatus(string $status): self
    {
        $clone = clone $this;
        $clone->status = $status;
        return $clone;
    }

    public function withContent(string $content): self
    {
        $clone = clone $this;
        $clone->content = $content;
        return $clone;
    }

    public function withSteps(?array $steps): self
    {
        $clone = clone $this;
        $clone->steps = $steps;
        return $clone;
    }

    public function withTool(?array $tool): self
    {
        $clone = clone $this;
        $clone->tool = $tool;
        return $clone;
    }

    public function withSendTimestamp(int $sendTimestamp): self
    {
        $clone = clone $this;
        $clone->sendTimestamp = $sendTimestamp;
        return $clone;
    }

    public function withEvent(string $event): self
    {
        $clone = clone $this;
        $clone->event = $event;
        return $clone;
    }

    public function withAttachments(array $attachments): self
    {
        $clone = clone $this;
        $clone->attachments = $attachments;
        return $clone;
    }

    /**
     * 设置项目归档数据.
     */
    public function withProjectArchive(?array $projectArchive): self
    {
        $clone = clone $this;
        $clone->projectArchive = $projectArchive;
        return $clone;
    }

    public function withShowInUi(bool $showInUi): self
    {
        $clone = clone $this;
        $clone->showInUi = $showInUi;
        return $clone;
    }

    public function withRemark(string $remark): self
    {
        $clone = clone $this;
        $clone->remark = $remark;
        return $clone;
    }

    public function withSeqId(int $seqId): self
    {
        $clone = clone $this;
        $clone->seqId = $seqId;
        return $clone;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function setCorrelationId(?string $correlationId): void
    {
        $this->correlationId = $correlationId;
    }
}
