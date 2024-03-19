<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\MagicMessageVersionEntity;
use App\Domain\Chat\Repository\Facade\MagicChatMessageVersionsRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicMessageVersionsModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class MagicMessageVersionsRepository implements MagicChatMessageVersionsRepositoryInterface
{
    public function __construct(
        protected MagicMessageVersionsModel $messageVersionsModel
    ) {
    }

    public function createMessageVersion(MagicMessageVersionEntity $messageVersionDTO): MagicMessageVersionEntity
    {
        $data = $messageVersionDTO->toArray();
        $time = date('Y-m-d H:i:s');
        $data['created_at'] = $time;
        $data['updated_at'] = $time;
        $data['deleted_at'] = null;
        $data['version_id'] = (string) IdGenerator::getSnowId();
        $this->messageVersionsModel::query()->create($data);
        return $this->assembleMessageVersionEntity($data);
    }

    /**
     * @return MagicMessageVersionEntity[]
     */
    public function getMessageVersions(string $magicMessageId): array
    {
        $data = $this->messageVersionsModel::query()
            ->where('magic_message_id', $magicMessageId)
            ->get()
            ->toArray();
        $entities = [];
        foreach ($data as $item) {
            $entities[] = $this->assembleMessageVersionEntity($item);
        }
        return $entities;
    }

    // 组装 MagicMessageVersionEntity 对象
    private function assembleMessageVersionEntity(array $data): MagicMessageVersionEntity
    {
        return new MagicMessageVersionEntity($data);
    }
}
