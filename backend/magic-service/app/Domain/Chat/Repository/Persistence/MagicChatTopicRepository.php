<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\MagicTopicMessageEntity;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatTopicRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatTopicMessageModel;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatTopicModel;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use App\Interfaces\Chat\Assembler\TopicAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\DbConnection\Db;

class MagicChatTopicRepository implements MagicChatTopicRepositoryInterface
{
    public function __construct(
        protected MagicChatTopicModel $topicModel,
        protected MagicChatTopicMessageModel $topicMessagesModel,
        protected MagicChatConversationRepository $conversationRepository,
        protected MagicChatSeqRepositoryInterface $seqRepository,
    ) {
    }

    // 创建话题
    public function createTopic(MagicTopicEntity $magicTopicEntity): MagicTopicEntity
    {
        if (empty($magicTopicEntity->getOrganizationCode())) {
            ExceptionBuilder::throw(
                ChatErrorCode::INPUT_PARAM_ERROR,
                'chat.common.param_error',
                ['param' => 'organization_code null']
            );
        }
        $time = date('Y-m-d H:i:s');
        $data = $magicTopicEntity->toArray();
        if (empty($data['id'])) {
            $data['id'] = IdGenerator::getSnowId();
            $magicTopicEntity->setId((string) $data['id']);
        }
        if (empty($data['topic_id'])) {
            $data['topic_id'] = IdGenerator::getSnowId();
            $magicTopicEntity->setTopicId((string) $data['topic_id']);
        }
        $data['created_at'] = $time;
        $data['updated_at'] = $time;
        $this->topicModel::query()->create($data);
        return $magicTopicEntity;
    }

    // 更新话题
    public function updateTopic(MagicTopicEntity $magicTopicEntity): MagicTopicEntity
    {
        $name = $magicTopicEntity->getName();
        // 长度不能超过 50
        if (mb_strlen($name) > 50) {
            ExceptionBuilder::throw(
                ChatErrorCode::INPUT_PARAM_ERROR,
                'chat.common.param_error',
                ['param' => 'topic_name']
            );
        }
        $this->checkEntity($magicTopicEntity);
        $this->topicModel::query()
            ->where('conversation_id', $magicTopicEntity->getConversationId())
            ->where('topic_id', $magicTopicEntity->getTopicId())
            ->update([
                'name' => $magicTopicEntity->getName(),
                'description' => $magicTopicEntity->getDescription(),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        return $magicTopicEntity;
    }

    // 删除话题
    public function deleteTopic(MagicTopicEntity $magicTopicDTO): int
    {
        $this->checkEntity($magicTopicDTO);
        return (int) $this->topicModel::query()
            ->where('conversation_id', $magicTopicDTO->getConversationId())
            ->where('topic_id', $magicTopicDTO->getTopicId())
            ->delete();
    }

    /**
     * 获取会话的会话列表.
     * @param string[] $topicIds
     * @return array<MagicTopicEntity>
     */
    public function getTopicsByConversationId(string $conversationId, array $topicIds): array
    {
        $query = $this->topicModel::query()->where('conversation_id', $conversationId);
        ! empty($topicIds) && $query->whereIn('topic_id', $topicIds);
        $topics = Db::select($query->toSql(), $query->getBindings());
        return TopicAssembler::getTopicEntities($topics);
    }

    public function getTopicEntity(MagicTopicEntity $magicTopicDTO): ?MagicTopicEntity
    {
        $this->checkEntity($magicTopicDTO);
        $topic = $this->getTopicArray($magicTopicDTO);
        if ($topic === null) {
            return null;
        }
        return TopicAssembler::getTopicEntity($topic);
    }

    public function createTopicMessage(MagicTopicMessageEntity $topicMessageDTO): MagicTopicMessageEntity
    {
        if (empty($topicMessageDTO->getSeqId())) {
            ExceptionBuilder::throw(ChatErrorCode::TOPIC_MESSAGE_NOT_FOUND);
        }
        $time = date('Y-m-d H:i:s');
        $data = $topicMessageDTO->toArray();
        $data['created_at'] = $time;
        $data['updated_at'] = $time;
        $this->topicMessagesModel::query()->create($data);
        return $topicMessageDTO;
    }

    public function createTopicMessages(array $data): bool
    {
        return $this->topicMessagesModel::query()->insert($data);
    }

    /**
     * @return array<MagicTopicMessageEntity>
     */
    public function getTopicMessageByMessageIds(array $messageIds): array
    {
        $query = $this->topicMessagesModel::query()->whereIn('seq_id', $messageIds);
        $topicMessages = Db::select($query->toSql(), $query->getBindings());
        return TopicAssembler::getTopicMessageEntities($topicMessages);
    }

    /**
     * @return array<MagicTopicMessageEntity>
     */
    public function getTopicMessagesByConversationId(string $conversationId): array
    {
        $query = $this->topicMessagesModel::query()->where('conversation_id', $conversationId);
        $topicMessages = Db::select($query->toSql(), $query->getBindings());
        return TopicAssembler::getTopicMessageEntities($topicMessages);
    }

    public function getTopicByName(string $conversationId, string $topicName): ?MagicTopicEntity
    {
        $topic = $this->topicModel::query()
            ->where('conversation_id', $conversationId)
            ->where('name', $topicName);
        $topic = Db::select($topic->toSql(), $topic->getBindings())[0] ?? null;
        if (empty($topic)) {
            return null;
        }
        return TopicAssembler::getTopicEntity($topic);
    }

    public function getPrivateChatReceiveTopicEntity(string $senderTopicId, string $senderConversationId): ?MagicTopicEntity
    {
        $topicDTO = new MagicTopicEntity();
        $topicDTO->setTopicId($senderTopicId);
        $topicDTO->setConversationId($senderConversationId);
        $senderTopicEntity = $this->getTopicEntity($topicDTO);
        if ($senderTopicEntity === null) {
            return null;
        }
        $receiveConversationEntity = $this->conversationRepository->getReceiveConversationBySenderConversationId($senderTopicEntity->getConversationId());
        if ($receiveConversationEntity === null) {
            return null;
        }
        $receiveTopicDTO = new MagicTopicEntity();
        $receiveTopicDTO->setTopicId($senderTopicEntity->getTopicId());
        $receiveTopicDTO->setConversationId($receiveConversationEntity->getId());
        $receiveTopicEntity = $this->getTopicEntity($receiveTopicDTO);
        return $receiveTopicEntity ?? null;
    }

    /**
     * 按时间范围获取会话下某个话题的消息.
     * @return ClientSequenceResponse[]
     */
    public function getTopicMessages(MessagesQueryDTO $messagesQueryDTO): array
    {
        $magicTopicDTO = new MagicTopicEntity();
        $magicTopicDTO->setConversationId($messagesQueryDTO->getConversationId());
        $magicTopicDTO->setTopicId($messagesQueryDTO->getTopicId());
        $this->checkEntity($magicTopicDTO);
        $topicEntity = $this->getTopicEntity($magicTopicDTO);
        if ($topicEntity === null) {
            return [];
        }
        $timeStart = $messagesQueryDTO->getTimeStart();
        $timeEnd = $messagesQueryDTO->getTimeEnd();
        $pageToken = $messagesQueryDTO->getPageToken();
        $limit = $messagesQueryDTO->getLimit();
        $order = $messagesQueryDTO->getOrder();
        if ($order === Order::Desc) {
            $operator = '<';
            $direction = 'desc';
        } else {
            $operator = '>';
            $direction = 'asc';
        }
        $query = $this->topicMessagesModel::query()
            ->where('conversation_id', $magicTopicDTO->getConversationId())
            ->where('topic_id', $magicTopicDTO->getTopicId());
        if ($timeStart !== null) {
            $query->where('created_at', '>=', $timeStart->toDateTimeString());
        }
        if ($timeEnd !== null) {
            $query->where('created_at', '<=', $timeEnd->toDateTimeString());
        }
        if (! empty($pageToken)) {
            $query->where('seq_id', $operator, $pageToken);
        }
        $query->limit($limit)->orderBy('seq_id', $direction)->select('seq_id');
        $seqList = Db::select($query->toSql(), $query->getBindings());
        // 根据 seqIds 获取消息详情
        $seqIds = array_column($seqList, 'seq_id');
        $clientSequenceResponses = $this->seqRepository->getConversationMessagesBySeqIds($seqIds, $order);

        return SeqAssembler::sortSeqList($clientSequenceResponses, $order);
    }

    public function deleteTopicByIds(array $ids)
    {
        $ids = array_values(array_filter(array_unique($ids)));
        if (empty($ids)) {
            return 0;
        }
        return $this->topicModel::query()->whereIn('id', $ids)->delete();
    }

    /**
     * Get topics by topic ID.
     * @param string $topicId 话题ID
     * @return MagicTopicEntity[] 话题实体数组
     */
    public function getTopicsByTopicId(string $topicId): array
    {
        $query = $this->topicModel::query()->where('topic_id', $topicId);
        $topics = Db::select($query->toSql(), $query->getBindings());
        return TopicAssembler::getTopicEntities($topics);
    }

    /**
     * Get topic messages by conversation ID, topic ID and max seq ID.
     * @param string $conversationId 会话ID
     * @param string $topicId 话题ID
     * @param int $maxSeqId 最大序列ID（包含该ID）
     * @return MagicTopicMessageEntity[] 话题消息实体数组
     */
    public function getTopicMessagesBySeqId(string $conversationId, string $topicId, int $maxSeqId): array
    {
        $query = $this->topicMessagesModel::query()
            ->where('conversation_id', $conversationId)
            ->where('topic_id', $topicId)
            ->where('seq_id', '<=', $maxSeqId)
            ->orderBy('seq_id', 'asc');

        $topicMessages = Db::select($query->toSql(), $query->getBindings());
        return TopicAssembler::getTopicMessageEntities($topicMessages);
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    #[Cacheable(prefix: 'topic:id:conversation', value: '_#{magicTopicDTO.topicId}_#{magicTopicDTO.conversationId}', ttl: 60)]
    private function getTopicArray(MagicTopicEntity $magicTopicDTO): ?array
    {
        $query = $this->topicModel::query()
            ->where('conversation_id', $magicTopicDTO->getConversationId())
            ->where('topic_id', $magicTopicDTO->getTopicId());
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }

    private function checkEntity($magicTopicEntity): void
    {
        if (empty($magicTopicEntity->getTopicId())) {
            ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
        }
        if (empty($magicTopicEntity->getConversationId())) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
    }
}
