<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\MessageType;

/**
 * 聊天消息内容的类型.
 */
enum ControlMessageType: string
{
    // 队列等场景的心跳
    case Ping = 'ping';

    // 创建会话窗口
    case CreateConversation = 'create_conversation';

    // 移除会话窗口（列表不显示）
    case HideConversation = 'hide_conversation';

    // 置顶会话窗口
    case TopConversation = 'top_conversation';

    // 会话免打扰
    case MuteConversation = 'mute_conversation';

    // 已读
    case SeenMessages = 'seen_messages';

    // 已查看消息
    case ReadMessage = 'read_message';

    // 撤回消息
    case RevokeMessage = 'revoke_message';

    // 编辑消息
    case EditMessage = 'edit_message';

    // 开始在会话窗口输入
    case StartConversationInput = 'start_conversation_input';

    // 结束在会话窗口输入
    case EndConversationInput = 'end_conversation_input';

    // 打开会话窗口
    case OpenConversation = 'open_conversation';

    // 创建话题
    case CreateTopic = 'create_topic';

    // 更新话题
    case UpdateTopic = 'update_topic';

    // 删除话题
    case DeleteTopic = 'delete_topic';

    // 设置会话的话题(设置为空表示离开话题)
    case SetConversationTopic = 'set_conversation_topic';

    // 创建群聊
    case GroupCreate = 'group_create';

    // 更新群聊
    case GroupUpdate = 'group_update';

    // 系统通知(xx加入/离开群聊,群温馨提醒等)
    case SystemNotice = 'system_notice';

    // 群成员变更
    case GroupUsersAdd = 'group_users_add';

    // 群成员变更
    case GroupUsersRemove = 'group_users_remove';

    // 解散群聊
    case GroupDisband = 'group_disband';

    // 群成员角色变更(批量设置管理员/普通成员)
    case GroupUserRoleChange = 'group_user_role_change';

    // 转让群主
    case GroupOwnerChange = 'group_owner_change';

    // 助理的交互指令
    case AgentInstruct = 'bot_instruct';

    // 翻译配置项
    case TranslateConfig = 'translate_config';

    // 翻译
    case Translate = 'translate';

    // 添加好友成功
    case AddFriendSuccess = 'add_friend_success';

    // 添加好友申请
    case AddFriendApply = 'add_friend_apply';

    /**
     * 未知消息。
     * 由于版本迭代，发版时间差异等原因，可能产生未知类型的消息。
     */
    case Unknown = 'unknown';

    public function getName(): string
    {
        return $this->value;
    }

    /**
     * @return ControlMessageType[]
     */
    public static function getMessageStatusChangeType(): array
    {
        // 不包含编辑消息的状态变更!
        // 编辑消息不会改变消息的状态,只会改变消息的内容.
        return [
            self::RevokeMessage,
            self::ReadMessage,
            self::SeenMessages,
        ];
    }

    public function allowCallUserFlow(): bool
    {
        return match ($this) {
            self::AddFriendSuccess,
            self::OpenConversation => true,
            default => false,
        };
    }
}
