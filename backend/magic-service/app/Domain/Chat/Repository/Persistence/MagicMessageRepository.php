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
