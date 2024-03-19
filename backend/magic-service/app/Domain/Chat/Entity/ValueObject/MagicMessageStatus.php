<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

enum MagicMessageStatus: int
{
    // 未读
    case Unread = 0;

    // 已读
    case Seen = 1;

    // 已查看（非纯文本的复杂类型消息，用户点击了详情）
    case Read = 2;

    // 已撤回
    case Revoked = 3;

    public function getStatusName(): string
    {
        return strtolower($this->name);
    }

    // 根据控制消息类型获取消息状态
    public static function getMessageStatusByControlMessageType(ControlMessageType $controlMessageType): MagicMessageStatus
    {
        return match ($controlMessageType) {
            ControlMessageType::SeenMessages => MagicMessageStatus::Seen,
            ControlMessageType::ReadMessage => MagicMessageStatus::Read,
            ControlMessageType::RevokeMessage => MagicMessageStatus::Revoked,
            default => MagicMessageStatus::Seen
        };
    }
}
