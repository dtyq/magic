<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatSequenceModel;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class MagicChatSeqRepository implements MagicChatSeqRepositoryInterface
{
    public function __construct(
        protected MagicChatSequenceModel $magicSeq,
        protected MagicMessageRepositoryInterface $magicMessageRepository,
        protected MagicAccountRepositoryInterface $magicAccountRepository,
        protected MagicUserRepositoryInterface $magicUserRepository,
        protected MagicChatConversationRepositoryInterface $magicUserConversationRepository,
    ) {
    }

    public function createSequence(array $message): MagicSeqEntity
    {
        if (is_array($message['content'])) {
            $message['content'] = Json::encode($message['content'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        if (is_array($message['receive_list'])) {
            $message['receive_list'] = Json::encode($message['receive_list'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        $message['extra'] = $this->getSeqExtra($message['extra'] ?? null);
        $this->magicSeq::query()->create($message);
        return SeqAssembler::getSeqEntity($message);
    }

    /**
     * @param MagicSeqEntity[] $seqList
     * @return MagicSeqEntity[]
     */
    public function batchCreateSeq(array $seqList): array
    {
        $insertData = [];
        foreach ($seqList as $seqEntity) {
            // 将entity中的数组转为string
            $seqInfo = $seqEntity->toArray();
            $seqInfo['content'] = Json::encode($seqInfo['content']);
            $seqInfo['receive_list'] = Json::encode($seqInfo['receive_list']);
            $seqInfo['extra'] = $this->getSeqExtra($seqInfo['extra'] ?? null);
            // seq 的topic_id实际保存在 topic_messages 表中
            unset($seqInfo['topic_id']);
            $insertData[] = $seqInfo;
        }
        $data = $this->magicSeq::query()->insert($insertData);
        if (! $data) {
            ExceptionBuilder::throw(ChatErrorCode::DATA_WRITE_FAILED);
        }
        return $seqList;
    }

    /**
     * 返回最大消息的倒数 n 条序列.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     * @return ClientSequenceResponse[]
     */
    public function pullRecentMessage(DataIsolation $dataIsolation, int $userLocalMaxSeqId, int $limit): array
    {
        $query = $this->magicSeq::query()
            ->where('object_type', $dataIsolation->getUserType())
            ->where('object_id', $dataIsolation->getCurrentMagicId());
        if ($userLocalMaxSeqId > 0) {
            $query->where('seq_id', '>', $userLocalMaxSeqId);
        }
        $query->orderBy('seq_id', Order::Desc->value)
            ->limit($limit)
            ->forceIndex('idx_object_type_id_seq_id');
        $seqInfos = Db::select($query->toSql(), $query->getBindings());
        return $this->getClientSequencesResponse($seqInfos);
    }

    /**
     * 返回 $userLocalMaxSeqId 之后的 $limit 条消息.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     * @return ClientSequenceResponse[]
     */
    public function getAccountSeqListByMagicId(DataIsolation $dataIsolation, int $userLocalMaxSeqId, int $limit): array
    {
        $query = $this->magicSeq::query()
            ->where('object_type', $dataIsolation->getUserType())
            ->where('object_id', $dataIsolation->getCurrentMagicId())
            ->where('seq_id', '>', $userLocalMaxSeqId)
            ->forceIndex('idx_object_type_id_seq_id')
            ->orderBy('seq_id')
            ->limit($limit);
        $seqInfos = Db::select($query->toSql(), $query->getBindings());
        return $this->getClientSequencesResponse($seqInfos);
    }

    /**
     * 根据 app_message_id 拉取消息.
     * @return ClientSequenceResponse[]
     */
    public function getAccountSeqListByAppMessageId(DataIsolation $dataIsolation, string $appMessageId, string $pageToken, int $pageSize): array
    {
        $query = $this->magicSeq::query()
            ->where('object_type', $dataIsolation->getUserType())
            ->where('object_id', $dataIsolation->getCurrentMagicId())
            ->where('app_message_id', $appMessageId)
            ->when(! empty($pageToken), function ($query) use ($pageToken) {
                $query->where('seq_id', '>', $pageToken);
            })
            ->orderBy('seq_id')
            ->limit($pageSize);
        $seqInfos = Db::select($query->toSql(), $query->getBindings());
        return $this->getClientSequencesResponse($seqInfos);
    }

    public function getSeqByMessageId(string $messageId): ?MagicSeqEntity
    {
        $seqInfo = $this->getSeq($messageId);
        if ($seqInfo === null) {
            return null;
        }
        return SeqAssembler::getSeqEntity($seqInfo);
    }

    /**
     * @return ClientSequenceResponse[]
     * @todo 挪到 magic_chat_topic_messages 处理
     * 会话窗口滚动加载历史记录.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     */
    public function getConversationChatMessages(MessagesQueryDTO $messagesQueryDTO): array
    {
        return $this->getConversationsChatMessages($messagesQueryDTO, [$messagesQueryDTO->getConversationId()]);
    }

    /**
     * @return ClientSequenceResponse[]
     * @todo 挪到 magic_chat_topic_messages 处理
     * 会话窗口滚动加载历史记录.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     */
    public function getConversationsChatMessages(MessagesQueryDTO $messagesQueryDTO, array $conversationIds): array
    {
        $order = $messagesQueryDTO->getOrder();
        if ($order === Order::Desc) {
            $operator = '<';
            $direction = 'desc';
        } else {
            $operator = '>';
            $direction = 'asc';
        }
        $timeStart = $messagesQueryDTO->getTimeStart();
        $timeEnd = $messagesQueryDTO->getTimeEnd();
        $pageToken = $messagesQueryDTO->getPageToken();
        $limit = $messagesQueryDTO->getLimit();
        $query = $this->magicSeq::query()->whereIn('conversation_id', $conversationIds);
        if (! empty($pageToken)) {
            // 当前会话历史消息中最小的 seq id. 会用来查比它还小的值
            $query->where('seq_id', $operator, $pageToken);
        }
        if ($timeStart !== null) {
            $query->where('created_at', '>=', $timeStart->toDateTimeString());
        }
        if ($timeEnd !== null) {
            $query->where('created_at', '<=', $timeEnd->toDateTimeString());
        }
        $query->orderBy('seq_id', $direction)->limit($limit);
        $seqList = Db::select($query->toSql(), $query->getBindings());
        return $this->getMessagesBySeqList($seqList, $order);
    }

    /**
     * 分组获取会话下最新的几条消息.
     */
    public function getConversationsMessagesGroupById(MessagesQueryDTO $messagesQueryDTO, array $conversationIds): array
    {
        $rawSql = <<<'sql'
        WITH RankedMessages AS (
            SELECT
                *,
                ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY seq_id DESC) as row_num
            FROM
                magic_chat_sequences
            WHERE
                conversation_id IN (%s)
        )
        SELECT * FROM RankedMessages WHERE row_num <= ? ORDER BY conversation_id, seq_id DESC
sql;
        // 生成pdo绑定
        $pdoBinds = implode(',', array_fill(0, count($conversationIds), '?'));
        $query = sprintf($rawSql, $pdoBinds);
        $seqList = Db::select($query, [...$conversationIds, $messagesQueryDTO->getLimit()]);
        return $this->getMessagesBySeqList($seqList);
    }

    /**
     * 获取收件方消息的状态变更流.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     * @return MagicSeqEntity[]
     */
    public function getReceiveMessagesStatusChange(array $referMessageIds, string $userId): array
    {
        $userEntity = $this->getAccountIdByUserId($userId);
        if ($userEntity === null) {
            return [];
        }
        return $this->getMessagesStatusChangeSeq($referMessageIds, $userEntity);
    }

    /**
     * 获取发件方消息的状态变更流.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     * @return MagicSeqEntity[]
     */
    public function getSenderMessagesStatusChange(string $senderMessageId, string $userId): array
    {
        $userEntity = $this->getAccountIdByUserId($userId);
        if ($userEntity === null) {
            return [];
        }
        return $this->getMessagesStatusChangeSeq([$senderMessageId], $userEntity);
    }

    /**
     * @return ClientSequenceResponse[]
     */
    public function getConversationMessagesBySeqIds(array $messageIds, Order $order): array
    {
        $query = $this->magicSeq::query()
            ->whereIn('id', $messageIds)
            ->orderBy('id', $order->value);
        $seqList = Db::select($query->toSql(), $query->getBindings());
        return $this->getMessagesBySeqList($seqList, $order);
    }

    /**
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     */
    public function getMessageReceiveList(string $messageId, string $magicId, ConversationType $userType): ?array
    {
        // 消息状态发生了变更
        $statusChangeSeq = $this->magicSeq::query()
            ->where('object_id', $magicId)
            ->where('object_type', $userType->value)
            ->where('refer_message_id', $messageId)
            ->whereIn('seq_type', ControlMessageType::getMessageStatusChangeType())
            ->forceIndex('idx_object_type_id_refer_message_id')
            ->orderBy('seq_id', 'desc');
        $statusChangeSeq = Db::select($statusChangeSeq->toSql(), $statusChangeSeq->getBindings())[0] ?? null;
        if (empty($statusChangeSeq)) {
            // 没有状态变更的消息
            $statusChangeSeq = $this->magicSeq::query()
                ->where('id', $messageId)
                ->orderBy('id', 'desc');
            $statusChangeSeq = Db::select($statusChangeSeq->toSql(), $statusChangeSeq->getBindings())[0] ?? null;
        }
        return $statusChangeSeq;
    }

    /**
     * Retrieve the sequence (seq) lists of both the sender and the receiver based on the $magicMessageId (generally used in the message editing scenario).
     */
    public function getBothSeqListByMagicMessageId(string $magicMessageId): array
    {
        $query = $this->magicSeq::query()->where('magic_message_id', $magicMessageId);
        return Db::select($query->toSql(), $query->getBindings());
    }

    /**
     * Optimized version: Group by object_id at MySQL level and return only the minimum seq_id record for each user
     * Supports message editing functionality and reduces data transfer volume.
     *
     * Performance optimization recommendations:
     * 1. Add composite index: CREATE INDEX idx_magic_message_id_object_id_seq_id ON magic_chat_sequences (magic_message_id, object_id, seq_id)
     * 2. This avoids table lookup queries and completes operations directly on the index
     */
    public function getMinSeqListByMagicMessageId(string $magicMessageId): array
    {
        // Use window function to group by object_id and select only the minimum seq_id for each user
        $sql = '
            SELECT * FROM (
                SELECT *,
                       ROW_NUMBER() OVER (PARTITION BY object_id ORDER BY seq_id ASC) as rn
                FROM magic_chat_sequences 
                WHERE magic_message_id = ?
            ) t 
            WHERE t.rn = 1
        ';

        return Db::select($sql, [$magicMessageId]);
    }

    /**
     * 获取消息的撤回 seq.
     */
    public function getMessageRevokedSeq(string $messageId, MagicUserEntity $userEntity, ControlMessageType $controlMessageType): ?MagicSeqEntity
    {
        $accountId = $userEntity->getMagicId();
        $query = $this->magicSeq::query()
            ->where('object_type', $userEntity->getUserType()->value)
            ->where('object_id', $accountId)
            ->where('refer_message_id', $messageId)
            ->where('seq_type', $controlMessageType->value)
            ->forceIndex('idx_object_type_id_refer_message_id');
        $seqInfo = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if ($seqInfo === null) {
            return null;
        }
        return SeqAssembler::getSeqEntity($seqInfo);
    }

    // todo 移到 magic_chat_topic_messages 处理
    public function getConversationSeqByType(string $magicId, string $conversationId, ControlMessageType $seqType): ?MagicSeqEntity
    {
        $query = $this->magicSeq::query()
            ->where('conversation_id', $conversationId)
            ->where('seq_type', $seqType->value)
            ->where('object_id', $magicId)
            ->where('object_type', ConversationType::User->value)
            ->forceIndex('idx_conversation_id_seq_type');
        $seqInfo = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if ($seqInfo === null) {
            return null;
        }
        return SeqAssembler::getSeqEntity($seqInfo);
    }

    /**
     * @return MagicSeqEntity[]
     */
    public function batchGetSeqByMessageIds(array $messageIds): array
    {
        $query = $this->magicSeq::query()->whereIn('id', $messageIds);
        $seqList = Db::select($query->toSql(), $query->getBindings());
        return $this->getSeqEntities($seqList);
    }

    public function updateSeqExtra(string $seqId, SeqExtra $seqExtra): bool
    {
        return (bool) $this->magicSeq::query()
            ->where('id', $seqId)
            ->update(['extra' => Json::encode($seqExtra->toArray())]);
    }

    public function getSeqMessageByIds(array $ids): array
    {
        $query = $this->magicSeq::query()->whereIn('id', $ids);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function deleteSeqMessageByIds(array $seqIds): int
    {
        $seqIds = array_values(array_filter(array_unique($seqIds)));
        if (empty($seqIds)) {
            return 0;
        }
        return (int) $this->magicSeq::query()->whereIn('id', $seqIds)->delete();
    }

    // 为了移除脏数据写的方法
    public function getSeqByMagicId(string $magicId, int $limit): array
    {
        $query = $this->magicSeq::query()
            ->where('object_type', ConversationType::User->value)
            ->where('object_id', $magicId)
            ->limit($limit);
        return Db::select($query->toSql(), $query->getBindings());
    }

    // 为了移除脏数据写的方法
    public function getHasTrashMessageUsers(): array
    {
        // 按 magic_id 分组,找出有垃圾消息的用户
        $query = $this->magicSeq::query()
            ->select('object_id')
            ->groupBy('object_id')
            ->havingRaw('count(*) < 100');
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function batchUpdateSeqStatus(array $seqIds, MagicMessageStatus $status): int
    {
        $seqIds = array_values(array_unique($seqIds));
        if (empty($seqIds)) {
            return 0;
        }
        return $this->magicSeq::query()
            ->whereIn('id', $seqIds)
            ->update(['status' => $status->value]);
    }

    public function updateSeqRelation(MagicSeqEntity $seqEntity): bool
    {
        return (bool) $this->magicSeq::query()
            ->where('id', $seqEntity->getId())
            ->update(
                [
                    'extra' => Json::encode($seqEntity->getExtra()?->toArray()),
                ]
            );
    }

    /**
     * 更新消息接收人列表.
     */
    public function updateReceiveList(MagicSeqEntity $seqEntity): bool
    {
        $receiveList = $seqEntity->getReceiveList();
        $receiveListJson = $receiveList ? Json::encode($receiveList->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;

        return (bool) $this->magicSeq::query()
            ->where('id', $seqEntity->getId())
            ->update([
                'receive_list' => $receiveListJson,
            ]);
    }

    /**
     * 获取消息的状态变更流.
     * @return MagicSeqEntity[]
     */
    private function getMessagesStatusChangeSeq(array $referMessageIds, MagicUserEntity $userEntity): array
    {
        // 将 orWhereIn 拆分为 2 条查询,避免索引失效
        $query = $this->magicSeq::query()
            ->where('object_type', $userEntity->getUserType()->value)
            ->where('object_id', $userEntity->getMagicId())
            ->whereIn('refer_message_id', $referMessageIds)
            ->forceIndex('idx_object_type_id_refer_message_id')
            ->orderBy('seq_id', 'desc');
        $referMessages = Db::select($query->toSql(), $query->getBindings());
        // 从 refer_message_id 中找出消息的最新状态
        $query = $this->magicSeq::query()
            ->where('object_type', $userEntity->getUserType()->value)
            ->where('object_id', $userEntity->getMagicId())
            ->whereIn('seq_id', $referMessageIds)
            ->forceIndex('idx_object_type_id_seq_id')
            ->orderBy('seq_id', 'desc');
        $seqList = Db::select($query->toSql(), $query->getBindings());
        // 合并后再降序排列,快速找出消息的最新状态
        $seqList = array_merge($seqList, $referMessages);
        $seqList = array_column($seqList, null, 'id');
        krsort($seqList);
        return $this->getSeqEntities($seqList);
    }

    /**
     * 对结果集强制重新降序排列.
     * @return ClientSequenceResponse[]
     */
    private function getClientSequencesResponse(array $seqInfos): array
    {
        $magicMessageIds = [];
        // 聊天消息,查message表获取消息内容
        foreach ($seqInfos as $seqInfo) {
            $seqType = MessageAssembler::getMessageType($seqInfo['seq_type']);
            if ($seqType instanceof ChatMessageType) {
                $magicMessageIds[] = $seqInfo['magic_message_id'];
            }
        }
        $messages = [];
        if (! empty($magicMessageIds)) {
            $messages = $this->magicMessageRepository->getMessages($magicMessageIds);
        }
        // 将控制消息/聊天消息一起放入用户的消息流中
        return SeqAssembler::getClientSeqStructs($seqInfos, $messages);
    }

    private function getSeqExtra(null|array|string $extra): string
    {
        if (empty($extra)) {
            return '{}';
        }
        return is_array($extra)
            ? Json::encode($extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            : $extra;
    }

    #[Cacheable(prefix: 'getSeqEntity', ttl: 60)]
    private function getSeq(string $messageId): ?array
    {
        $query = $this->magicSeq::query()->where('id', $messageId);
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }

    /**
     * 批量返回客户端需要的Seq结构.
     * @return ClientSequenceResponse[]
     */
    private function getMessagesBySeqList(array $seqList, Order $order = Order::Desc): array
    {
        // 从Messages表获取消息内容
        $magicMessageIds = array_column($seqList, 'magic_message_id');
        $messages = $this->magicMessageRepository->getMessages($magicMessageIds);
        $clientSequenceResponses = SeqAssembler::getClientSeqStructs($seqList, $messages);
        return SeqAssembler::sortSeqList($clientSequenceResponses, $order);
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    private function getAccountIdByUserId(string $uid): ?MagicUserEntity
    {
        // 根据uid找到account_id
        return $this->magicUserRepository->getUserById($uid);
    }

    /**
     * @return MagicSeqEntity[]
     */
    private function getSeqEntities(array $seqList): array
    {
        if (empty($seqList)) {
            return [];
        }
        $seqEntities = [];
        foreach ($seqList as $seqInfo) {
            $seqEntities[] = SeqAssembler::getSeqEntity($seqInfo);
        }
        return $seqEntities;
    }
}
