<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class TaskMessageEntity extends AbstractEntity
{
    /**
     * @var int 消息ID
     */
    protected int $id = 0;

    /**
     * @var string 发送者类型(user/ai)
     */
    protected string $senderType = '';

    /**
     * @var string 发送者ID
     */
    protected string $senderUid = '';

    /**
     * @var string 接收者ID
     */
    protected string $receiverUid = '';

    /**
     * @var string 消息ID
     */
    protected string $messageId = '';

    /**
     * @var string 消息类型
     */
    protected string $type = '';

    /**
     * @var string 任务ID
     */
    protected string $taskId = '';

    /**
     * @var null|int|string 话题ID
     */
    protected $topicId;

    /**
     * @var null|string 任务状态
     */
    protected ?string $status = null;

    /**
     * @var string 消息内容
     */
    protected string $content = '';

    /**
     * @var null|array 步骤信息
     */
    protected ?array $steps = null;

    /**
     * @var null|array 工具调用信息
     */
    protected ?array $tool = null;

    /**
     * @var null|array 附件信息
     */
    protected ?array $attachments = null;

    /**
     * @var null|array 提及信息
     */
    protected ?array $mentions = null;

    /**
     * @var string 事件类型
     */
    protected string $event = '';

    /**
     * @var int 发送时间戳
     */
    protected int $sendTimestamp = 0;

    protected bool $showInUi = true;

    public function __construct(array $data = [])
    {
        $this->id = IdGenerator::getSnowId();
        $this->messageId = isset($data['message_id']) ? (string) $data['message_id'] : (string) IdGenerator::getSnowId();
        $this->sendTimestamp = time();
        parent::__construct($data);
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getSenderType(): string
    {
        return $this->senderType;
    }

    public function setSenderType(?string $senderType): self
    {
        $this->senderType = $senderType ?? '';
        return $this;
    }

    public function getSenderUid(): string
    {
        return $this->senderUid;
    }

    public function setSenderUid(?string $senderUid): self
    {
        $this->senderUid = $senderUid ?? '';
        return $this;
    }

    public function getReceiverUid(): string
    {
        return $this->receiverUid;
    }

    public function setReceiverUid(?string $receiverUid): self
    {
        $this->receiverUid = $receiverUid ?? '';
        return $this;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(?string $type): self
    {
        $this->type = $type ?? '';
        return $this;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): self
    {
        $this->taskId = $taskId ?? '';
        return $this;
    }

    public function getTopicId()
    {
        return $this->topicId;
    }

    public function setTopicId($topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(?string $content): self
    {
        $this->content = $content ?? '';
        return $this;
    }

    public function getSteps(): ?array
    {
        return $this->steps;
    }

    public function setSteps(?array $steps): self
    {
        $this->steps = empty($steps) ? null : $steps;
        return $this;
    }

    public function getTool(): ?array
    {
        return $this->tool;
    }

    public function setTool(?array $tool): self
    {
        $this->tool = empty($tool) ? null : $tool;
        return $this;
    }

    public function getAttachments(): ?array
    {
        return $this->attachments;
    }

    public function setAttachments(?array $attachments): self
    {
        $this->attachments = empty($attachments) ? null : $attachments;
        return $this;
    }

    public function getMentions(): ?array
    {
        return $this->mentions;
    }

    public function setMentions(?array $mentions): self
    {
        $this->mentions = empty($mentions) ? null : $mentions;
        return $this;
    }

    public function getEvent(): string
    {
        return $this->event;
    }

    public function setEvent(?string $event): self
    {
        $this->event = $event ?? '';
        return $this;
    }

    public function getSendTimestamp(): int
    {
        return $this->sendTimestamp;
    }

    public function getShowInUi(): bool
    {
        return $this->showInUi;
    }

    public function setShowInUi(bool $showInUi): self
    {
        $this->showInUi = $showInUi;
        return $this;
    }

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'sender_type' => $this->senderType,
            'sender_uid' => $this->senderUid,
            'receiver_uid' => $this->receiverUid,
            'message_id' => $this->messageId,
            'type' => $this->type,
            'task_id' => $this->taskId,
            'topic_id' => $this->topicId,
            'status' => $this->status,
            'content' => $this->content,
            'steps' => $this->steps,
            'tool' => $this->tool,
            'attachments' => $this->attachments,
            'mentions' => $this->getMentions(),
            'event' => $this->event,
            'send_timestamp' => $this->sendTimestamp,
            'show_in_ui' => $this->showInUi,
        ];

        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }
}
