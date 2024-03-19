<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

enum TriggerType: int
{
    // 无触发
    case None = 0;

    // 新消息时
    case ChatMessage = 1;

    // 打开聊天窗口
    case OpenChatWindow = 2;

    // 定时
    case Routine = 3;

    // 参数调用
    case ParamCall = 4;

    // 循环体开始节点
    case LoopStart = 5;

    // 等待消息
    case WaitMessage = 6;

    // 添加好友时
    case AddFriend = 7;

    public static function fromSeqType(ChatMessageType|ControlMessageType $seqType): TriggerType
    {
        $triggerType = TriggerType::None;
        if ($seqType instanceof ChatMessageType) {
            // 聊天触发
            $triggerType = TriggerType::ChatMessage;
        } elseif ($seqType === ControlMessageType::OpenConversation) {
            // 打开聊天窗口触发
            $triggerType = TriggerType::OpenChatWindow;
        } elseif ($seqType === ControlMessageType::AddFriendSuccess) {
            // 添加好友触发
            $triggerType = TriggerType::AddFriend;
        }
        return $triggerType;
    }
}
