<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:3000, 3999.
 */
enum ChatErrorCode: int
{
    #[ErrorMessage('chat.message.not_found')]
    case MESSAGE_NOT_FOUND = 3001;

    #[ErrorMessage('chat.already_exist')]
    case ALREADY_EXIST = 3002;

    #[ErrorMessage('chat.message.send_failed')]
    case MESSAGE_SEND_FAILED = 3003;

    #[ErrorMessage('chat.not_found')]
    case NOT_FOUND = 3004;

    #[ErrorMessage('chat.ai.not_found')]
    case AI_NOT_FOUND = 3005;

    #[ErrorMessage('chat.conversation.type_error')]
    case CONVERSATION_TYPE_ERROR = 3006;

    #[ErrorMessage('chat.common.param_error')]
    case INPUT_PARAM_ERROR = 3007;

    #[ErrorMessage('chat.seq.id_error')]
    case SEQ_ID_ERROR = 3008;

    #[ErrorMessage('chat.user.no_organization')]
    case NO_ORGANIZATION = 3009;

    // 消息类型错误
    #[ErrorMessage('chat.message.type_error')]
    case MESSAGE_TYPE_ERROR = 3010;

    // 会话不存在
    #[ErrorMessage('chat.conversation.not_found')]
    case CONVERSATION_NOT_FOUND = 3011;

    // 收件方不存在
    #[ErrorMessage('chat.user.receive_not_found')]
    case RECEIVER_NOT_FOUND = 3012;

    // 数据写入失败
    #[ErrorMessage('chat.data.write_failed')]
    case DATA_WRITE_FAILED = 3013;

    // 请求上下文丢失
    #[ErrorMessage('chat.context.lost')]
    case CONTEXT_LOST = 3014;

    // 引用消息不存在
    #[ErrorMessage('chat.refer_message.not_found')]
    case REFER_MESSAGE_NOT_FOUND = 3015;

    // 话题不存在
    #[ErrorMessage('chat.topic.not_found')]
    case TOPIC_NOT_FOUND = 3016;

    // 话题的消息不存在
    #[ErrorMessage('chat.topic.message.not_found')]
    case TOPIC_MESSAGE_NOT_FOUND = 3017;

    // 消息序列不存在
    #[ErrorMessage('chat.seq.not_found')]
    case SEQ_NOT_FOUND = 3018;

    // 群聊人员选择异常
    #[ErrorMessage('chat.group.user_select_error')]
    case GROUP_USER_SELECT_ERROR = 3019;

    // 群聊人数超出限制
    #[ErrorMessage('chat.group.user_num_limit_error')]
    case GROUP_USER_NUM_LIMIT_ERROR = 3020;

    // 群聊创建失败
    #[ErrorMessage('chat.group.create_error')]
    case GROUP_CREATE_ERROR = 3021;

    // 群聊不存在
    #[ErrorMessage('chat.group.not_found')]
    case GROUP_NOT_FOUND = 3022;

    // 消息投递失败
    #[ErrorMessage('chat.message.delivery_failed')]
    case MESSAGE_DELIVERY_FAILED = 3023;

    // 所有用户已经在群里中
    #[ErrorMessage('chat.group.user_already_in_group')]
    case USER_ALREADY_IN_GROUP = 3024;

    // 请发送消息后再使用智能重命名功能
    #[ErrorMessage('chat.topic.send_message_and_rename_topic')]
    case SEND_MESSAGE_AND_RENAME_TOPIC = 3025;

    // 用户不存在
    #[ErrorMessage('chat.user.not_found')]
    case USER_NOT_FOUND = 3026;

    // 群信息更新失败
    #[ErrorMessage('chat.group.update_error')]
    case GROUP_UPDATE_ERROR = 3027;

    // 没有用户可以从群聊中移除
    #[ErrorMessage('chat.group.no_user_to_remove')]
    case GROUP_NO_USER_TO_REMOVE = 3028;

    // 不能踢出群主
    #[ErrorMessage('chat.group.group_cannot_kick_owner')]
    case GROUP_CANNOT_KICK_OWNER = 3029;

    // 请先转让群主再退出群聊
    #[ErrorMessage('chat.group.transfer_owner_before_leave')]
    case GROUP_TRANSFER_OWNER_BEFORE_LEAVE = 3030;

    // 只有群主才能解散群聊
    #[ErrorMessage('chat.group.only_owner_can_disband')]
    case GROUP_ONLY_OWNER_CAN_DISBAND = 3031;

    // 只有群主才能转让群组
    #[ErrorMessage('chat.group.only_owner_can_transfer')]
    case GROUP_ONLY_OWNER_CAN_TRANSFER = 3032;

    // 会话已被删除
    #[ErrorMessage('chat.conversation.deleted')]
    case CONVERSATION_DELETED = 3033;

    // 部门不存在
    #[ErrorMessage('chat.department.not_found')]
    case DEPARTMENT_NOT_FOUND = 3034;

    // 登录失败
    #[ErrorMessage('chat.login.failed')]
    case LOGIN_FAILED = 3035;

    // 操作失败
    #[ErrorMessage('chat.operation.failed')]
    case OPERATION_FAILED = 3036;

    // 消息中的文件不存在
    #[ErrorMessage('chat.file.not_found')]
    case FILE_NOT_FOUND = 3037;

    // TOPIC_ID_NOT_FOUND
    #[ErrorMessage('chat.topic.id_not_found')]
    case TOPIC_ID_NOT_FOUND = 3038;

    // 不支持同步这个第三方平台的部门数据
    #[ErrorMessage('chat.department.sync_not_support')]
    case DEPARTMENT_SYNC_NOT_SUPPORT = 3039;

    // PLATFORM_ORGANIZATION_CODE_NOT_FOUND
    #[ErrorMessage('chat.platform.organization_code_not_found')]
    case PLATFORM_ORGANIZATION_CODE_NOT_FOUND = 3040;

    // 部门同步失败
    #[ErrorMessage('chat.department.sync_failed')]
    case DEPARTMENT_SYNC_FAILED = 3041;

    #[ErrorMessage('chat.platform.organization_env_not_found')]
    case PLATFORM_ORGANIZATION_ENV_NOT_FOUND = 3042;

    // MAGIC_ENVIRONMENT_CONFIG_ERROR
    #[ErrorMessage('chat.magic.environment_config_error')]
    case MAGIC_ENVIRONMENT_CONFIG_ERROR = 3043;

    // USER_SYNC_FAILED
    #[ErrorMessage('chat.user.sync_failed')]
    case USER_SYNC_FAILED = 3044;

    // magicEnv not found
    #[ErrorMessage('chat.magic.environment_not_found')]
    case MAGIC_ENVIRONMENT_NOT_FOUND = 3045;

    // appTicket not found
    #[ErrorMessage('chat.magic.ticket_not_found')]
    case APP_TICKET_NOT_FOUND = 3046;

    // 流式消息不支持该消息
    #[ErrorMessage('chat.message.stream.type_not_support')]
    case STREAM_TYPE_NOT_SUPPORT = 3100;

    // CONVERSATION_ORGANIZATION_CODE_EMPTY
    #[ErrorMessage('chat.conversation.organization_code_empty')]
    case CONVERSATION_ORGANIZATION_CODE_EMPTY = 3101;

    // 用户还未创建账号
    #[ErrorMessage('chat.user.not_create_account')]
    case USER_NOT_CREATE_ACCOUNT = 3102;

    // authorization 不合法
    #[ErrorMessage('chat.authorization.invalid')]
    case AUTHORIZATION_INVALID = 3103;

    // STREAM_SEQUENCE_ID_NOT_FOUND
    #[ErrorMessage('chat.stream.sequence_id_not_found')]
    case STREAM_SEQUENCE_ID_NOT_FOUND = 3104;

    // STREAM_MESSAGE_NOT_FOUND
    #[ErrorMessage('chat.stream.message_not_found')]
    case STREAM_MESSAGE_NOT_FOUND = 3105;

    // STREAM_RECEIVE_MESSAGE_ID_NOT_FOUND
    #[ErrorMessage('chat.stream.receive_message_id_not_found')]
    case STREAM_RECEIVE_MESSAGE_ID_NOT_FOUND = 3106;

    // user_call_agent_fail_notice
    #[ErrorMessage('chat.agent.user_call_agent_fail_notice')]
    case USER_CALL_AGENT_FAIL_NOTICE = 3107;

    // system_default_topic
    #[ErrorMessage('chat.topic.system_default_topic')]
    case SYSTEM_DEFAULT_TOPIC = 3108;
}
