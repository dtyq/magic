<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Response\Common;

use App\Domain\Chat\DTO\Message\ChatMessage\UnknowChatMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\AbstractEntity;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Throwable;

/**
 * 客户端收到的消息结构体.
 */
class ClientMessage extends AbstractEntity
{
    // 服务端生成的消息唯一id，全局唯一。用于撤回、编辑消息。
    protected string $magicMessageId;

    // 客户端生成，需要ios/安卓/web三端共同确定一个生成算法。用于告知客户端，magic_message_id的由来
    protected ?string $appMessageId;

    // 话题id
    protected ?string $topicId;

    // 消息的小类。控制消息的小类：已读回执；撤回；编辑；入群/退群；组织架构变动; 。 展示消息：text,voice,img,file,video等

    protected string $type;

    // 回显未读人数,如果用户点击了详情,再请求具体的消息内容
    protected ?int $unreadCount;

    // 消息发送者,自己或者他人
    protected string $senderId;

    // 消息发送时间，与 magic_message_id 一起，用于撤回、编辑消息时的唯一性校验。
    protected int $sendTime;

    // 聊天消息状态:unread | seen | read |revoked  .对应中文释义：未读|已读|已查看（非纯文本的复杂类型消息，用户点击了详情）  | 撤回
    protected ?string $status;

    protected MessageInterface $content;

    public function __construct(array $data)
    {
        if (! $data['content'] instanceof MessageInterface) {
            // 避免各种 bug 导致用户完全无法拉消息，这里做一下兜底
            try {
                $data['content'] = MessageAssembler::getMessageStructByArray($data['type'], $data['content']);
            } catch (Throwable) {
                $data['content'] = new UnknowChatMessage();
            }
        }
        parent::__construct($data);
    }

    public function toArray(bool $filterNull = false): array
    {
        return [
            'magic_message_id' => $this->getMagicMessageId(),
            'app_message_id' => $this->getAppMessageId(),
            'topic_id' => $this->getTopicId(),
            'type' => $this->getType(),
            'unread_count' => $this->getUnreadCount(),
            'sender_id' => $this->getSenderId(),
            'send_time' => $this->getSendTime(),
            'status' => $this->getStatus(),
            // 这里 key 是 $this->getType() 对应消息类型，value 是消息内容
            $this->type => $this->content->toArray($filterNull),
        ];
    }

    public function getMagicMessageId(): string
    {
        return $this->magicMessageId ?? '';
    }

    public function setMagicMessageId(string $magicMessageId): void
    {
        $this->magicMessageId = $magicMessageId;
    }

    public function getAppMessageId(): ?string
    {
        return $this->appMessageId ?? null;
    }

    public function setAppMessageId(?string $appMessageId): void
    {
        $this->appMessageId = $appMessageId;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId ?? null;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getUnreadCount(): ?int
    {
        return $this->unreadCount ?? null;
    }

    public function setUnreadCount(?int $unreadCount): void
    {
        $this->unreadCount = $unreadCount;
    }

    public function getSenderId(): string
    {
        return $this->senderId ?? '';
    }

    public function setSenderId(string $senderId): void
    {
        $this->senderId = $senderId;
    }

    public function getSendTime(): int
    {
        return $this->sendTime;
    }

    public function setSendTime(int $sendTime): void
    {
        $this->sendTime = $sendTime;
    }

    public function getStatus(): ?string
    {
        return $this->status ?? null;
    }

    public function setStatus(?string $status): void
    {
        $this->status = $status;
    }

    public function getContent(): MessageInterface
    {
        return $this->content;
    }

    public function setContent(MessageInterface $content): void
    {
        $this->content = $content;
    }
}
