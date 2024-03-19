<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence;

use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicBotThirdPlatformChatQuery;
use App\Domain\Agent\Factory\MagicAgentThirdPlatformChatFactory;
use App\Domain\Agent\Repository\Facade\MagicBotThirdPlatformChatRepositoryInterface;
use App\Domain\Agent\Repository\Persistence\Model\MagicBotThirdPlatformChatModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class MagicBotThirdPlatformChatRepository extends AbstractRepository implements MagicBotThirdPlatformChatRepositoryInterface
{
    public function save(MagicBotThirdPlatformChatEntity $entity): MagicBotThirdPlatformChatEntity
    {
        if (! empty($entity->getId())) {
            /** @var MagicBotThirdPlatformChatModel $model */
            $model = MagicBotThirdPlatformChatModel::query()->find($entity->getId());
            $saveData = [
                // 只允许修改是否启用
                'identification' => $entity->getIdentification(),
                'enabled' => $entity->isEnabled(),
            ];
            if ($entity->isAllUpdate()) {
                $saveData = $entity->toArray();
            }
        } else {
            $model = new MagicBotThirdPlatformChatModel();
            $saveData = $entity->toArray();
        }
        $model->fill($saveData);
        $model->save();
        return MagicAgentThirdPlatformChatFactory::modelToEntity($model);
    }

    public function getByKey(string $key): ?MagicBotThirdPlatformChatEntity
    {
        $model = MagicBotThirdPlatformChatModel::query()->where('key', $key)->first();
        if (empty($model)) {
            return null;
        }
        return MagicAgentThirdPlatformChatFactory::modelToEntity($model);
    }

    public function getById(int $id): ?MagicBotThirdPlatformChatEntity
    {
        /** @var null|MagicBotThirdPlatformChatModel $model */
        $model = MagicBotThirdPlatformChatModel::query()->find($id);
        if (empty($model)) {
            return null;
        }
        return MagicAgentThirdPlatformChatFactory::modelToEntity($model);
    }

    public function queries(MagicBotThirdPlatformChatQuery $query, Page $page): array
    {
        $queryBuilder = MagicBotThirdPlatformChatModel::query();
        if (! empty($query->getBotId())) {
            $queryBuilder->where('bot_id', $query->getBotId());
        }
        $data = $this->getByPage($queryBuilder, $page, $query);
        $list = [];
        foreach ($data['list'] ?? [] as $datum) {
            $entity = MagicAgentThirdPlatformChatFactory::modelToEntity($datum);
            if ($query->getKeyBy() === 'key') {
                $list[$entity->getKey()] = $entity;
            } else {
                $list[] = $entity;
            }
        }
        $data['list'] = $list;
        return $data;
    }

    public function destroy(MagicBotThirdPlatformChatEntity $entity): void
    {
        MagicBotThirdPlatformChatModel::query()->where('id', $entity->getId())->delete();
    }
}
