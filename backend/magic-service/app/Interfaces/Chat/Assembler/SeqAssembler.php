<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\DTO\Message\EmptyMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Response\ClientJsonStreamSequenceResponse;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\DTO\Response\Common\ClientMessage;
use App\Domain\Chat\DTO\Response\Common\ClientSequence;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\MessageOptionsEnum;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Throwable;

class SeqAssembler
{
    public static function getSeqEntity(array $seqInfo): MagicSeqEntity
    {
        return new MagicSeqEntity($seqInfo);
    }

    /**
     * 将entity转换为可以直接写入数据库的数据.
     */
    public static function getInsertDataByEntity(MagicSeqEntity $magicSeqEntity): array
    {
        $seqData = $magicSeqEntity->toArray();
        $seqData['content'] = Json::encode($seqData['content'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $seqData['receive_list'] = Json::encode($seqData['receive_list'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $seqData;
    }

    /**
     * 批量返回客户端需要的Seq结构,对结果集强制重新降序排列.
     * @return ClientSequenceResponse[]
     */
    public static function getClientSeqStructs(array $seqInfos, array $messageInfos): array
    {
        $seqStructs = [];
        $messageInfos = array_column($messageInfos, null, 'magic_message_id');
        foreach ($seqInfos as $seqInfo) {
            $seqEntity = self::getSeqEntity($seqInfo);
            if ($seqEntity->getSeqType() instanceof ChatMessageType) {
                $messageInfo = $messageInfos[$seqInfo['magic_message_id']] ?? [];
                $messageEntity = MessageAssembler::getMessageEntity($messageInfo);
            } else {
                // 控制消息没有聊天消息的状态
                $messageEntity = null;
            }
            $seqStructs[$seqEntity->getSeqId()] = self::getClientSeqStruct($seqEntity, $messageEntity);
        }
        // 对结果集强制重新降序排列
        krsort($seqStructs);
        return array_values($seqStructs);
    }

    /**
     * Json 流式消息的客户端 seq 结构.
     */
    public static function getClientJsonStreamSeqStruct(
        string $seqId,
        ?array $thisTimeStreamMessages = null
    ): ?ClientJsonStreamSequenceResponse {
        // todo 为了兼容旧版流式消息，需要将 content/reasoning_content/status/llm_response 字段放到最外层。
        // todo 等前端上线后，就移除 content/reasoning_content/status/llm_response 的多余推送
        $response = (new ClientJsonStreamSequenceResponse())->setTargetSeqId($seqId);
        $content = $thisTimeStreamMessages['content'] ?? null;
        $reasoningContent = $thisTimeStreamMessages['reasoning_content'] ?? null;
        $llmResponse = $thisTimeStreamMessages['llm_response'] ?? null;
        // 强行删除 $streamOptions 中的stream_app_message_id/stream字段
        unset($thisTimeStreamMessages['stream_options']['stream_app_message_id'], $thisTimeStreamMessages['stream_options']['stream']);
        $streamOptions = $thisTimeStreamMessages['stream_options'] ?? null;
        // 0 会被当做 false 处理，所以这里要判断是否为 null 或者 ''
        if ($content !== null && $content !== '') {
            $response->setContent($content);
        }
        if ($llmResponse !== null && $llmResponse !== '') {
            $response->setLlmResponse($llmResponse);
        }
        if ($reasoningContent !== null && $reasoningContent !== '') {
            // 以前的流程有 reasoning_content 时也会推送 content 为空字符串的数据
            $response->setReasoningContent($reasoningContent);
        }
        if (isset($streamOptions['status'])) {
            $response->setStatus($streamOptions['status']);
        } else {
            $response->setStatus(StreamMessageStatus::Processing);
        }
        $response->setStreams($thisTimeStreamMessages);
        return $response;
    }

    /**
     * 生成客户端需要的Seq结构.
     */
    public static function getClientSeqStruct(
        MagicSeqEntity $seqEntity,
        ?MagicMessageEntity $messageEntity = null
    ): ClientSequenceResponse {
        $clientSequence = self::getClientSequence($seqEntity, $messageEntity);
        return new ClientSequenceResponse([
            'type' => 'seq',
            'seq' => $clientSequence,
        ]);
    }

    /**
     * 根据已经存在的seqEntity,生成已读/已查看/撤回/编辑等消息状态变更类型的回执消息.
     */
    public static function generateReceiveStatusChangeSeqEntity(MagicSeqEntity $originSeqEntity, ControlMessageType $messageType): MagicSeqEntity
    {
        // 编辑/撤回/引用的回执,都是 refer 的是自己聊天的消息 id
        if ($originSeqEntity->getSeqType() instanceof ChatMessageType) {
            $referMessageId = $originSeqEntity->getMessageId();
        } else {
            $referMessageId = $originSeqEntity->getReferMessageId();
        }
        $statusChangeSeqEntity = clone $originSeqEntity;
        // 消息的接收方不需要记录收件人列表,清空该字段信息
        $statusChangeSeqEntity->setReceiveList(null);
        $statusChangeSeqEntity->setSeqType($messageType);
        $seqData = $statusChangeSeqEntity->toArray();
        if ($messageType === ControlMessageType::SeenMessages) {
            // 变更状态为已读
            $seqData['status'] = MagicMessageStatus::Seen->value;
            // 回写时将 $referMessageIds 拆开,每条消息生成一条已读消息
            $seqData['content'] = Json::encode(['refer_message_ids' => [$referMessageId]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        if ($messageType === ControlMessageType::RevokeMessage) {
            // 变更状态为已撤回
            $seqData['status'] = MagicMessageStatus::Revoked->value;
            $seqData['content'] = Json::encode(['refer_message_id' => $referMessageId], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        return self::generateStatusChangeSeqEntity($seqData, $referMessageId);
    }

    /**
     * 根据已经存在的seqEntity,生成已读/已查看/撤回/编辑等消息状态变更类型的回执消息.
     * @param string $referMessageId 支持指定引用的消息id,用于给接收方的其他设备推送回执,或者给发件方推送回执
     */
    public static function generateStatusChangeSeqEntity(array $seqData, string $referMessageId): MagicSeqEntity
    {
        $messageId = (string) IdGenerator::getSnowId();
        $time = date('Y-m-d H:i:s');
        // 重置seq的相关id
        $seqData['id'] = $messageId;
        $seqData['message_id'] = $messageId;
        $seqData['seq_id'] = $messageId;
        // 生成一个新的message_id,并refer到原来的message_id
        $seqData['refer_message_id'] = $referMessageId;
        $seqData['created_at'] = $time;
        $seqData['updated_at'] = $time;
        $seqData['magic_message_id'] = ''; // 控制消息没有 magic_message_id
        $seqData['receive_list'] = Json::encode($seqData['receive_list'] ?: [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return self::getSeqEntity($seqData);
    }

    /**
     * 根据已经存在的seqEntity,生成topic变更类型的控制消息.
     */
    public static function generateTopicChangeSeqEntity(MagicSeqEntity $seqEntity, MagicTopicEntity $topicEntity, ?MagicUserEntity $receiveUserEntity): MagicSeqEntity
    {
        $seqData = $seqEntity->toArray();
        $messageId = (string) IdGenerator::getSnowId();
        $time = date('Y-m-d H:i:s');
        // 重置seq的相关id
        $seqData['id'] = $messageId;
        // 序列所属用户可能发生变更
        if ($receiveUserEntity !== null) {
            $seqData['object_id'] = $receiveUserEntity->getMagicId();
            $seqData['object_type'] = $receiveUserEntity->getUserType()->value;
        }
        $seqData['message_id'] = $messageId;
        $seqData['seq_id'] = $messageId;
        // 生成一个新的message_id,并refer到原来的message_id
        $seqData['refer_message_id'] = '';
        $seqData['created_at'] = $time;
        $seqData['updated_at'] = $time;
        // 更新 content 中的会话 id 为接收方自己的
        $seqData['content'] = Json::encode($topicEntity->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $seqData['conversation_id'] = $topicEntity->getConversationId();
        $extra = new SeqExtra();
        $extra->setTopicId($topicEntity->getTopicId());
        $seqData['extra'] = Json::encode($extra->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $seqData['receive_list'] = '';
        $seqData['magic_message_id'] = ''; // 控制消息没有 magic_message_id
        return self::getSeqEntity($seqData);
    }

    /**
     * 根据数组获取消息结构.
     */
    public static function getSeqStructByArray(string $messageTypeString, array $messageStructArray): MessageInterface
    {
        $messageTypeEnum = MessageAssembler::getMessageType($messageTypeString);
        if ($messageTypeEnum instanceof ChatMessageType) {
            // 聊天消息在seq表中不存储具体的消息详情
            return new EmptyMessage();
        }
        try {
            return MessageAssembler::getControlMessageStruct($messageTypeEnum, $messageStructArray);
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, throwable: $exception);
        }
    }

    /**
     * @param ClientSequenceResponse[] $clientSequenceResponses
     */
    public static function sortSeqList(array $clientSequenceResponses, Order $order): array
    {
        // 按 $direction 对消息进行排序
        if ($order === Order::Desc) {
            usort($clientSequenceResponses, function (ClientSequenceResponse $a, ClientSequenceResponse $b) {
                return $b->getSeq()->getSeqId() <=> $a->getSeq()->getSeqId();
            });
        } else {
            usort($clientSequenceResponses, function (ClientSequenceResponse $a, ClientSequenceResponse $b) {
                return $a->getSeq()->getSeqId() <=> $b->getSeq()->getSeqId();
            });
        }
        return $clientSequenceResponses;
    }

    /**
     * Get corresponding Socket event type based on sequence entity.
     */
    public static function getSocketEventType(MagicSeqEntity $seqEntity): SocketEventType
    {
        if ($seqEntity->getSeqType() instanceof ControlMessageType) {
            return SocketEventType::Control;
        }
        return SocketEventType::Chat;
    }

    private static function getClientSequence(MagicSeqEntity $seqEntity, ?MagicMessageEntity $messageEntity = null): ClientSequence
    {
        // 由于编辑消息可能更改消息类型，因此如果 $messageEntity 不为空，优先使用 $messageEntity 的消息类型
        if ($messageEntity !== null) {
            $messageType = $messageEntity->getContent()->getMessageTypeEnum();
        } else {
            $messageType = $seqEntity->getSeqType();
        }
        $messageTypeName = $messageType->getName();
        $messageStatus = $seqEntity->getStatus()?->getStatusName();
        // 为了节约存储空间,控制消息的具体内容存储在seqEntity中,聊天消息的具体内容存储在messageEntity中
        if ($messageType instanceof ControlMessageType) {
            // 如果是控制消息,消息的具体内容从seqEntity中获取
            $messageData = $seqEntity->getContent()->toArray();
        } else {
            // 如果是聊天消息,消息的具体内容从messageEntity中获取
            $messageData = $messageEntity?->getContent()->toArray();
        }
        // 聊天统计未读人数
        $receiveList = $seqEntity->getReceiveList();
        $unreadCount = $receiveList === null ? 0 : count($receiveList->getUnreadList());
        if (empty($messageData)) {
            $messageData = [];
        }
        $carbon = Carbon::parse($seqEntity->getCreatedAt());
        $messageTopicId = (string) $seqEntity->getExtra()?->getTopicId();
        // 生成客户端消息结构
        $clientMessageData = [
            // 服务端生成的消息唯一id，全局唯一。用于撤回、编辑消息。
            'magic_message_id' => $seqEntity->getMagicMessageId(),
            // 客户端生成，需要ios/安卓/web三端共同确定一个生成算法。用于告知客户端，magic_message_id的由来
            'app_message_id' => $seqEntity->getAppMessageId(),
            // 发送者
            'sender_id' => (string) $messageEntity?->getSenderId(),
            'topic_id' => $messageTopicId,
            // 消息的小类。控制消息的小类：已读回执；撤回；编辑；入群/退群；组织架构变动; 。 展示消息：text,voice,img,file,video等
            'type' => $messageTypeName,
            // 回显未读人数,如果用户点击了详情,再请求具体的消息内容
            'unread_count' => $unreadCount,
            // 消息发送时间，与 magic_message_id 一起，用于撤回、编辑消息时的唯一性校验。
            'send_time' => $carbon->getTimestamp(),
            // 聊天消息状态:unread | seen | read |revoked  .对应中文释义：未读|已读|已查看（非纯文本的复杂类型消息，用户点击了详情）  | 撤回
            'status' => $messageStatus ?: '',
            'content' => $messageData,
        ];
        $clientSeqMessage = new ClientMessage($clientMessageData);

        // 生成客户端seq结构
        $clientSequenceData = [
            // 序列号归属账号id
            'magic_id' => $seqEntity->getObjectId(),
            // 序列号，一定不重复，一定增长，但是不保证连续。
            'seq_id' => $seqEntity->getSeqId(),
            // 用户的消息id，用户下唯一。
            'message_id' => $seqEntity->getMessageId(),
            // 本条消息指向的magic_message_id。 用于实现已读回执场景。存在引用关系时，send_msg_id字段不再返回，因为发送方的消息id没有改变。
            'refer_message_id' => $seqEntity->getReferMessageId(),
            // 发送方的消息id
            'sender_message_id' => $seqEntity->getSenderMessageId(),
            // 消息所属会话窗口。 客户端可以根据此值确定消息是否要提醒等。如果本地没有发现这个会话id，主动向服务端查询会话窗口详情
            'conversation_id' => $seqEntity->getConversationId(),
            // 本条消息所属组织
            'organization_code' => $seqEntity->getOrganizationCode(),
            'message' => $clientSeqMessage,
            // 编辑消息的选项
            MessageOptionsEnum::EDIT_MESSAGE_OPTIONS->value => $seqEntity->getExtra()?->getEditMessageOptions(),
        ];
        return new ClientSequence($clientSequenceData);
    }
}
