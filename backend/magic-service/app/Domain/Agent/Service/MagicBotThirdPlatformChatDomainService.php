<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Service;

use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicBotThirdPlatformChatQuery;
use App\Domain\Agent\Repository\Facade\MagicBotThirdPlatformChatRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Annotation\Transactional;

readonly class MagicBotThirdPlatformChatDomainService
{
    public function __construct(
        private MagicBotThirdPlatformChatRepositoryInterface $magicBotThirdPlatformChatRepository
    ) {
    }

    public function getByKey(string $key): ?MagicBotThirdPlatformChatEntity
    {
        return $this->magicBotThirdPlatformChatRepository->getByKey($key);
    }

    public function getById(int $id): ?MagicBotThirdPlatformChatEntity
    {
        return $this->magicBotThirdPlatformChatRepository->getById($id);
    }

    public function save(MagicBotThirdPlatformChatEntity $entity): MagicBotThirdPlatformChatEntity
    {
        $entity->prepareForSaving();
        return $this->magicBotThirdPlatformChatRepository->save($entity);
    }

    /**
     * @return array{total: int, list: MagicBotThirdPlatformChatEntity[]}
     */
    public function queries(MagicBotThirdPlatformChatQuery $query, Page $page): array
    {
        return $this->magicBotThirdPlatformChatRepository->queries($query, $page);
    }

    public function destroy(MagicBotThirdPlatformChatEntity $entity): void
    {
        $this->magicBotThirdPlatformChatRepository->destroy($entity);
    }

    /**
     * @param null|MagicBotThirdPlatformChatEntity[] $thirdPlatformList
     */
    #[Transactional]
    public function syncBotThirdPlatformList(string $botId, ?array $thirdPlatformList = null): void
    {
        if (is_null($thirdPlatformList)) {
            return;
        }

        $query = new MagicBotThirdPlatformChatQuery();
        $query->setBotId($botId);
        $query->setKeyBy('key');
        $historyList = $this->magicBotThirdPlatformChatRepository->queries($query, Page::createNoPage())['list'];

        foreach ($thirdPlatformList as $thirdPlatformChatEntity) {
            $thirdPlatformChatEntity->setBotId($botId);
            if ($historyThirdPlatformChatEntity = $historyList[$thirdPlatformChatEntity->getKey()] ?? null) {
                $thirdPlatformChatEntity->setId($historyThirdPlatformChatEntity->getId());
            } else {
                $thirdPlatformChatEntity->setId(null);
            }
            $this->save($thirdPlatformChatEntity);
            unset($historyList[$thirdPlatformChatEntity->getKey()]);
        }

        // 剩下的都是要删除的
        foreach ($historyList as $item) {
            $this->destroy($item);
        }
    }
}
