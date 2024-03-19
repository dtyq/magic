<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Facade;

use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicBotThirdPlatformChatQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicBotThirdPlatformChatRepositoryInterface
{
    public function save(MagicBotThirdPlatformChatEntity $entity): MagicBotThirdPlatformChatEntity;

    public function getByKey(string $key): ?MagicBotThirdPlatformChatEntity;

    public function getById(int $id): ?MagicBotThirdPlatformChatEntity;

    /**
     * @return array{total: int, list: MagicBotThirdPlatformChatEntity[]}
     */
    public function queries(MagicBotThirdPlatformChatQuery $query, Page $page): array;

    public function destroy(MagicBotThirdPlatformChatEntity $entity): void;
}
