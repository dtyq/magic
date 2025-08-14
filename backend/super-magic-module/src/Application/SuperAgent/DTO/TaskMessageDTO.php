<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO;

/**
 * Task message DTO for recording task messages.
 */
class TaskMessageDTO
{
    public function __construct(
        private readonly string $taskId,
        private readonly string $role,
        private readonly string $senderUid,
        private readonly string $receiverUid,
        private readonly string $messageType,
        private readonly string $content,
        private readonly ?string $rawContent = null,
        private readonly ?string $status = null,
        private readonly ?array $steps = null,
        private readonly ?array $tool = null,
        private readonly ?int $topicId = null,
        private readonly ?string $event = null,
        private readonly ?array $attachments = null,
        private readonly ?array $mentions = null,
        private readonly bool $showInUi = true,
        private readonly ?string $messageId = null,
        private readonly ?int $imSeqId = null
    ) {
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getSenderUid(): string
    {
        return $this->senderUid;
    }

    public function getReceiverUid(): string
    {
        return $this->receiverUid;
    }

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getRawContent(): string
    {
        return $this->rawContent ?? '';
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function getSteps(): ?array
    {
        return $this->steps;
    }

    public function getTool(): ?array
    {
        return $this->tool;
    }

    public function getTopicId(): ?int
    {
        return $this->topicId;
    }

    public function getEvent(): ?string
    {
        return $this->event;
    }

    public function getAttachments(): ?array
    {
        return $this->attachments;
    }

    public function getMentions(): ?array
    {
        return $this->mentions;
    }

    public function isShowInUi(): bool
    {
        return $this->showInUi;
    }

    public function getMessageId(): ?string
    {
        return $this->messageId;
    }

    public function getImSeqId(): ?int
    {
        return $this->imSeqId;
    }

    /**
     * Create DTO from array.
     */
    public static function fromArray(array $data): self
    {
        $topicId = (isset($data['topicId']) ? (int) $data['topicId'] : null);
        return new self(
            taskId: $data['task_id'] ?? $data['taskId'] ?? '',
            role: $data['role'] ?? '',
            senderUid: $data['sender_uid'] ?? $data['senderUid'] ?? '',
            receiverUid: $data['receiver_uid'] ?? $data['receiverUid'] ?? '',
            messageType: $data['message_type'] ?? $data['messageType'] ?? '',
            content: $data['content'] ?? '',
            rawContent: $data['raw_content'] ?? $data['rawContent'] ?? null,
            status: $data['status'] ?? null,
            steps: $data['steps'] ?? null,
            tool: $data['tool'] ?? null,
            topicId: isset($data['topic_id']) ? (int) $data['topic_id'] : $topicId,
            event: $data['event'] ?? null,
            attachments: $data['attachments'] ?? null,
            mentions: $data['mentions'] ?? null,
            showInUi: $data['show_in_ui'] ?? $data['showInUi'] ?? true,
            messageId: $data['message_id'] ?? $data['messageId'] ?? null,
            imSeqId: isset($data['im_seq_id']) ? (int) $data['im_seq_id'] : (isset($data['imSeqId']) ? (int) $data['imSeqId'] : null)
        );
    }

    /**
     * Convert DTO to array.
     */
    public function toArray(): array
    {
        return [
            'task_id' => $this->taskId,
            'role' => $this->role,
            'sender_uid' => $this->senderUid,
            'receiver_uid' => $this->receiverUid,
            'message_type' => $this->messageType,
            'content' => $this->content,
            'raw_content' => $this->rawContent,
            'status' => $this->status,
            'steps' => $this->steps,
            'tool' => $this->tool,
            'topic_id' => $this->topicId,
            'event' => $this->event,
            'attachments' => $this->attachments,
            'mentions' => $this->mentions,
            'show_in_ui' => $this->showInUi,
            'message_id' => $this->messageId,
            'im_seq_id' => $this->imSeqId,
        ];
    }
}
