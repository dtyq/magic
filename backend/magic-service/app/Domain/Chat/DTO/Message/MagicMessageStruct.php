<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message;

use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatInstruction;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\MessageExtra;
use App\Domain\Chat\Entity\AbstractEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;
use Hyperf\Codec\Json;

/**
 * 聊天和控制消息的基类.
 */
abstract class MagicMessageStruct extends AbstractEntity implements MessageInterface
{
    /**
     * @var null|ChatInstruction[]
     */
    protected ?array $instructs;

    protected ?MessageExtra $extra;

    protected ChatMessageType $chatMessageType;

    protected ControlMessageType $controlMessageType;

    protected IntermediateMessageType $intermediateMessageType;

    public function __construct(?array $messageStruct = null)
    {
        $this->setMessageType();
        parent::__construct($messageStruct);
    }

    public function toArray(bool $filterNull = false): array
    {
        $data = Json::decode($this->toJsonString());
        if ($filterNull) {
            $data = array_filter($data, static fn ($value) => $value !== null);
        }
        // 去掉 message_type 字段
        unset($data['control_message_type'], $data['chat_message_type'], $data['intermediate_message_type']);
        // 如果数据为空，则去掉为每条消息附近的 attachments 和 instructs
        foreach (['attachments', 'instructs'] as $field) {
            if (empty($data[$field])) {
                unset($data[$field]);
            }
        }
        return $data;
    }

    public function getMessageTypeEnum(): ChatMessageType|ControlMessageType|IntermediateMessageType
    {
        return $this->intermediateMessageType ?? $this->controlMessageType ?? $this->chatMessageType;
    }

    /**
     * @return null|ChatInstruction[]
     */
    public function getInstructs(): ?array
    {
        return $this->instructs ?? null;
    }

    /**
     * @param null|array|ChatInstruction[] $instructs
     */
    public function setInstructs(?array $instructs): void
    {
        // 确保 instructs 数组中的每个元素都是 ChatInstruction 对象
        if ($instructs !== null) {
            foreach ($instructs as $key => $instruct) {
                /* @phpstan-ignore-next-line */
                if (! $instruct instanceof ChatInstruction && is_array($instruct)) {
                    $instructs[$key] = new ChatInstruction($instruct);
                }
            }
        }
        $this->instructs = $instructs;
    }

    public function getExtra(): ?MessageExtra
    {
        return $this->extra ?? null;
    }

    public function setExtra(null|array|MessageExtra $extra): void
    {
        if ($extra instanceof MessageExtra) {
            $this->extra = $extra;
        } elseif (is_array($extra)) {
            $this->extra = new MessageExtra($extra);
        } else {
            $this->extra = null;
        }
    }

    abstract protected function setMessageType(): void;
}
