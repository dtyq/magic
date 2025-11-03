<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicMessageVersionEntity;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicMessageModel;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Cache\Annotation\CacheEvict;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class MagicMessageRepository implements MagicMessageRepositoryInterface
{
    public function __construct(
        protected MagicMessageModel $magicMessage
    ) {
    }

    public function createMessage(array $message): void
    {
        $this->magicMessage::query()->create($message);
    }

    public function getMessages(array $magicMessageIds, ?array $rangMessageTypes = null): array
    {
        // 去除空值
        $magicMessageIds = array_filter($magicMessageIds);
        if (empty($magicMessageIds)) {
            return [];
        }
        $query = $this->magicMessage::query()->whereIn('magic_message_id', $magicMessageIds);
        if (! is_null($rangMessageTypes)) {
            $query->whereIn('message_type', $rangMessageTypes);
        }
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getMessageByMagicMessageId(string $magicMessageId): ?MagicMessageEntity
    {
        $message = $this->getMessageDataByMagicMessageId($magicMessageId);
        return MessageAssembler::getMessageEntity($message);
    }

    public function deleteByMagicMessageIds(array $magicMessageIds)
    {
        $magicMessageIds = array_values(array_unique(array_filter($magicMessageIds)));
        if (empty($magicMessageIds)) {
            return;
        }
        $this->magicMessage::query()->whereIn('magic_message_id', $magicMessageIds)->delete();
    }

    public function updateMessageContent(string $magicMessageId, array $messageContent): void
    {
        $this->magicMessage::query()->where('magic_message_id', $magicMessageId)->update(
            [
                'content' => Json::encode($messageContent),
            ]
        );
    }

    #[CacheEvict(prefix: 'getMessageByMagicMessageId', value: '_#{messageEntity.magicMessageId}')]
    public function updateMessageContentAndVersionId(MagicMessageEntity $messageEntity, MagicMessageVersionEntity $magicMessageVersionEntity): void
    {
        $this->magicMessage::query()->where('magic_message_id', $messageEntity->getMagicMessageId())->update(
            [
                'current_version_id' => $magicMessageVersionEntity->getVersionId(),
                // 编辑消息允许修改消息类型
                'message_type' => $messageEntity->getMessageType()->value,
                'content' => Json::encode($messageEntity->getContent()->toArray()),
            ]
        );
    }

    /**
     * Check if message exists by app_message_id and optional message_type.
     * Uses covering index (app_message_id, deleted_at, message_type) to avoid table lookup.
     */
    public function isMessageExistsByAppMessageId(string $appMessageId, string $messageType = ''): bool
    {
        if (empty($appMessageId)) {
            return false;
        }

        // Build query to maximize covering index usage
        // Index order: app_message_id, deleted_at, message_type
        $query = $this->magicMessage::query()
            ->select(Db::raw('1'))  // Only select constant to ensure index-only scan
            ->where('app_message_id', $appMessageId)
            ->whereNull('deleted_at');

        // Only add message type filter when messageType is not empty
        if (! empty($messageType)) {
            $query->where('message_type', $messageType);
        }

        // Use limit(1) for early termination since we only care about existence
        return $query->limit(1)->exists();
    }

    public function getMagicMessageIdByAppMessageId(string $appMessageId, string $messageType = ''): string
    {
        if (empty($appMessageId)) {
            return '';
        }

        // Build query to maximize covering index usage
        // Index order: app_message_id, deleted_at, message_type
        $query = $this->magicMessage::query()
            ->select('magic_message_id')  // Only select magic_message_id field
            ->where('app_message_id', $appMessageId)
            ->whereNull('deleted_at');

        // Only add message type filter when messageType is not empty
        if (! empty($messageType)) {
            $query->where('message_type', $messageType);
        }

        // Use limit(1) for early termination and get the first result
        $result = $query->limit(1)->first();

        return $result ? $result->magic_message_id : '';
    }

    /**
     * Get messages by magic message IDs.
     * @param array $magicMessageIds Magic message ID数组
     * @return MagicMessageEntity[] 消息实体数组
     */
    public function getMessagesByMagicMessageIds(array $magicMessageIds): array
    {
        if (empty($magicMessageIds)) {
            return [];
        }

        $query = $this->magicMessage::query()->whereIn('magic_message_id', $magicMessageIds);
        $messages = Db::select($query->toSql(), $query->getBindings());

        return array_map(function ($message) {
            return MessageAssembler::getMessageEntity($message);
        }, $messages);
    }

    /**
     * Batch create messages.
     * @param array $messagesData 消息数据数组
     * @return bool 是否创建成功
     */
    public function batchCreateMessages(array $messagesData): bool
    {
        if (empty($messagesData)) {
            return true;
        }

        return $this->magicMessage::query()->insert($messagesData);
    }

    #[Cacheable(prefix: 'getMessageByMagicMessageId', value: '_#{magicMessageId}', ttl: 10)]
    private function getMessageDataByMagicMessageId(string $magicMessageId)
    {
        $query = $this->magicMessage::query()->where('magic_message_id', $magicMessageId);
        $message = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if (empty($message)) {
            return null;
        }
        return $message;
    }
}
