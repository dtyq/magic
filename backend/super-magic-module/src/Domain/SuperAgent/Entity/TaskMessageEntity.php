<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskMessageDTO;

class TaskMessageEntity extends AbstractEntity
{
    // 处理状态常量
    public const PROCESSING_STATUS_PENDING = 'pending';

    public const PROCESSING_STATUS_PROCESSING = 'processing';

    public const PROCESSING_STATUS_COMPLETED = 'completed';

    public const PROCESSING_STATUS_FAILED = 'failed';

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
     * @var null|string 原始消息内容
     */
    protected ?string $rawContent = null;

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

    /**
     * @var null|string 原始投递消息JSON数据
     */
    protected ?string $rawData = null;

    /**
     * @var null|int 序列ID，用于消息排序
     */
    protected ?int $seqId = null;

    /**
     * @var string 消息处理状态
     */
    protected string $processingStatus = self::PROCESSING_STATUS_PENDING;

    /**
     * @var null|string 处理失败时的错误信息
     */
    protected ?string $errorMessage = null;

    /**
     * @var int 重试次数
     */
    protected int $retryCount = 0;

    /**
     * @var null|string 处理完成时间
     */
    protected ?string $processedAt = null;

    /**
     * @var null|int IM 序列ID，用于消息顺序追踪
     */
    protected ?int $imSeqId = null;

    /**
     * @var null|int IM 状态（来自magic_chat_sequences表的status字段）
     */
    protected ?int $imStatus = null;

    /**
     * @var null|string 关联ID，用于消息追踪和关联
     */
    protected ?string $correlationId = null;

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

    public function getRawContent(): string
    {
        return $this->rawContent ?? '';
    }

    public function setRawContent(?string $rawContent): self
    {
        $this->rawContent = $rawContent;
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

    public function getRawData(): ?string
    {
        return $this->rawData;
    }

    public function setRawData(?string $rawData): self
    {
        $this->rawData = $rawData;
        return $this;
    }

    public function getSeqId(): ?int
    {
        return $this->seqId;
    }

    public function setSeqId(?int $seqId): self
    {
        $this->seqId = $seqId;
        return $this;
    }

    public function getProcessingStatus(): string
    {
        return $this->processingStatus;
    }

    public function setProcessingStatus(string $processingStatus): self
    {
        $this->processingStatus = $processingStatus;
        return $this;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function getRetryCount(): int
    {
        return $this->retryCount;
    }

    public function setRetryCount(int $retryCount): self
    {
        $this->retryCount = $retryCount;
        return $this;
    }

    public function getProcessedAt(): ?string
    {
        return $this->processedAt;
    }

    public function setProcessedAt(?string $processedAt): self
    {
        $this->processedAt = $processedAt;
        return $this;
    }

    public function getImSeqId(): ?int
    {
        return $this->imSeqId;
    }

    public function setImSeqId(?int $imSeqId): self
    {
        $this->imSeqId = $imSeqId;
        return $this;
    }

    public function getImStatus(): ?int
    {
        return $this->imStatus;
    }

    public function setImStatus(?int $imStatus): self
    {
        $this->imStatus = $imStatus;
        return $this;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function setCorrelationId(?string $correlationId): self
    {
        $this->correlationId = $correlationId;
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
            'raw_content' => $this->rawContent,
            'steps' => $this->getSteps(),
            'tool' => $this->getTool(),
            'attachments' => $this->getAttachments(),
            'mentions' => $this->getMentions(),
            'event' => $this->event,
            'send_timestamp' => $this->sendTimestamp,
            'show_in_ui' => $this->showInUi,
            // 新增的队列处理字段
            'raw_data' => $this->rawData,
            'seq_id' => $this->seqId,
            'processing_status' => $this->processingStatus,
            'error_message' => $this->errorMessage,
            'retry_count' => $this->retryCount,
            'processed_at' => $this->processedAt,
            'im_seq_id' => $this->imSeqId,
            'im_status' => $this->imStatus,
            'correlation_id' => $this->correlationId,
        ];

        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public static function taskMessageDTOToTaskMessageEntity(TaskMessageDTO $taskMessageDTO): TaskMessageEntity
    {
        $messageData = [
            'task_id' => $taskMessageDTO->getTaskId(),
            'sender_type' => $taskMessageDTO->getRole(),
            'sender_uid' => $taskMessageDTO->getSenderUid(),
            'receiver_uid' => $taskMessageDTO->getReceiverUid(),
            'type' => $taskMessageDTO->getMessageType(),
            'content' => $taskMessageDTO->getContent(),
            'status' => $taskMessageDTO->getStatus(),
            'steps' => $taskMessageDTO->getSteps(),
            'tool' => $taskMessageDTO->getTool(),
            'attachments' => $taskMessageDTO->getAttachments(),
            'mentions' => $taskMessageDTO->getMentions(),
            'topic_id' => $taskMessageDTO->getTopicId(),
            'event' => $taskMessageDTO->getEvent(),
            'show_in_ui' => $taskMessageDTO->isShowInUi(),
            'raw_content' => $taskMessageDTO->getRawContent(),
        ];

        // Add message_id if provided
        if ($taskMessageDTO->getMessageId() !== null) {
            $messageData['message_id'] = $taskMessageDTO->getMessageId();
        }

        // Add im_seq_id if provided
        if ($taskMessageDTO->getImSeqId() !== null) {
            $messageData['im_seq_id'] = $taskMessageDTO->getImSeqId();
        }

        // Add correlation_id if provided
        if ($taskMessageDTO->getCorrelationId() !== null) {
            $messageData['correlation_id'] = $taskMessageDTO->getCorrelationId();
        }

        return new TaskMessageEntity($messageData);
    }
}
