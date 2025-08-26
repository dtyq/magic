<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\ChatMessage\AbstractChatMessageStruct;
use App\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessageInterface;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\MemoryOperation;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\SuperAgentStep;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\SuperAgentTool;

class SuperAgentMessage extends AbstractChatMessageStruct implements TextContentInterface, SuperAgentMessageInterface
{
    protected ?string $topicId = '';

    protected ?string $messageId = null;

    protected ?string $taskId = null;

    protected ?string $type = null;

    protected ?string $status = null;

    protected ?string $content = null;

    protected ?array $steps = null;

    protected ?string $event = '';

    protected ?string $role = '';

    protected ?SuperAgentTool $tool = null;

    protected ?int $sendTimestamp = null;

    protected ?array $attachments = null;

    protected ?string $remark = '';

    protected ?MemoryOperation $memoryOperation;

    protected ?string $correlationId = null; // 🎯 添加 correlation_id 字段

    public function __construct(?array $messageStruct = null)
    {
        parent::__construct();
        if ($messageStruct !== null) {
            $this->initProperty($messageStruct);
        }
        $this->setMessageType();
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getMessageId(): ?string
    {
        return $this->messageId;
    }

    public function setMessageId(?string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }

    public function getTaskId(): ?string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): self
    {
        $this->type = $type;
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

    public function getSteps(): ?array
    {
        return $this->steps;
    }

    public function setSteps(?array $steps): self
    {
        $this->steps = $steps;
        return $this;
    }

    public function getTool(): ?SuperAgentTool
    {
        return $this->tool;
    }

    public function setTool(null|array|string|SuperAgentTool $tool): self
    {
        if ($tool === null) {
            $this->tool = null;
        } elseif ($tool instanceof SuperAgentTool) {
            $this->tool = $tool;
        } elseif (is_string($tool)) {
            if (json_validate($tool)) {
                $decoded = json_decode($tool, true);
                $this->tool = new SuperAgentTool($decoded);
            } else {
                // 如果不是有效的 JSON 字符串，可以选择抛出异常或忽略
                $this->tool = null;
            }
        } else {
            $this->tool = new SuperAgentTool($tool);
        }
        return $this;
    }

    public function getSendTimestamp(): ?int
    {
        return $this->sendTimestamp;
    }

    public function setSendTimestamp(?int $sendTimestamp): self
    {
        $this->sendTimestamp = $sendTimestamp;
        return $this;
    }

    public function setEvent(?string $event): self
    {
        $this->event = $event;
        return $this;
    }

    public function getEvent(): ?string
    {
        return $this->event;
    }

    public function getRole(): ?string
    {
        return $this->role;
    }

    public function setRole(?string $role): self
    {
        $this->role = $role;
        return $this;
    }

    public function getAttachments(): ?array
    {
        return $this->attachments;
    }

    public function setAttachments(?array $attachments): self
    {
        $this->attachments = $attachments;
        return $this;
    }

    public function getRemark(): ?string
    {
        return $this->remark;
    }

    public function setRemark(?string $remark): self
    {
        $this->remark = $remark;
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

    public function toArray(bool $filterNull = false): array
    {
        $data = array_merge(parent::toArray($filterNull), [
            'topic_id' => $this->topicId,
            'message_id' => $this->messageId,
            'task_id' => $this->taskId,
            'type' => $this->type,
            'status' => $this->status,
            'content' => $this->content,
            'event' => $this->event,
            'steps' => array_map(function ($step) {
                if ($step instanceof SuperAgentStep) {
                    return $step->toArray();
                }
                return (new SuperAgentStep($step))->toArray();
            }, $this->steps ?? []),
            'tool' => $this->tool?->toArray(),
            'role' => $this->role,
            'send_timestamp' => $this->sendTimestamp ?? time(),
            'attachments' => $this->attachments,
            'remark' => $this->remark,
            'correlation_id' => $this->correlationId,
        ]);

        if ($filterNull) {
            $data = array_filter($data, fn ($value) => $value !== null);
        }

        return $data;
    }

    public function getTextContent(): string
    {
        return $this->content ?? '';
    }

    public function getContent(): string
    {
        return $this->getTextContent();
    }

    public function setContent(?string $content): static
    {
        $this->content = $content ?? '';
        return $this;
    }

    public function getMemoryOperation(): ?MemoryOperation
    {
        return $this->memoryOperation;
    }

    public function setMemoryOperation(null|array|MemoryOperation|string $memoryOperation): self
    {
        if ($memoryOperation === null) {
            $this->memoryOperation = null;
        } elseif ($memoryOperation instanceof MemoryOperation) {
            $this->memoryOperation = $memoryOperation;
        } elseif (is_string($memoryOperation)) {
            if (json_validate($memoryOperation)) {
                $decoded = json_decode($memoryOperation, true);
                $this->memoryOperation = new MemoryOperation($decoded);
            } else {
                // 如果不是有效的 JSON 字符串，可以选择抛出异常或忽略
                $this->memoryOperation = null;
            }
        } else {
            $this->memoryOperation = new MemoryOperation($memoryOperation);
        }
        return $this;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::SuperAgentCard;
    }
}
