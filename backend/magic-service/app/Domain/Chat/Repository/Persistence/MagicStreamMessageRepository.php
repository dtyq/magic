<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Repository\Facade\MagicStreamMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicStreamMessageModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Hyperf\DbConnection\Db;

class MagicStreamMessageRepository implements MagicStreamMessageRepositoryInterface
{
    public function create(array $message): void
    {
        $model = new MagicStreamMessageModel();
        $model->fill($message);
        $model->id = IdGenerator::getSnowId();
        $model->created_at = date('Y-m-d H:i:s');
        $model->updated_at = date('Y-m-d H:i:s');
        $model->save();
    }

    public function getByAppMessageId(string $appMessageId): ?array
    {
        $model = new MagicStreamMessageModel();

        $message = $model::query()->where('app_message_id', $appMessageId)->first();
        if ($message === null) {
            return null;
        }
        return $message->toArray();
    }

    public function updateById(string $id, array $message): void
    {
        $model = new MagicStreamMessageModel();
        $messageModel = $model::query()->where('id', $id)->first();
        if ($messageModel === null) {
            return;
        }
        $message['updated_at'] = date('Y-m-d H:i:s');
        $message['id'] = $id;
        $messageModel->fill($message);
        $messageModel->save();
    }

    public function getByGtUpdatedAt(string $updatedAt, string $lastId): array
    {
        $model = new MagicStreamMessageModel();
        $messages = $model::query()
            ->where('updated_at', '>', $updatedAt)
            ->where('id', '>', $lastId)
            ->orderBy('updated_at')
            ->limit(10);
        $messages = Db::select($messages->toSql(), $messages->getBindings());
        $result = [];
        foreach ($messages as $message) {
            $result[] = MessageAssembler::getStreamMessageEntity($message);
        }
        return $result;
    }

    public function clearSeqMessageIdsByStreamIds(array $ids)
    {
        $model = new MagicStreamMessageModel();
        $model::query()->whereIn('id', $ids)->update(['seq_message_ids' => null]);
    }
}
