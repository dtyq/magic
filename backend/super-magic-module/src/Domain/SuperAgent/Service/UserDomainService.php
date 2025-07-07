<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\UserAuthorization;

class UserDomainService
{
    public function __construct(
        protected MagicUserDomainService $magicUserDomainService,
    ) {
    }

    public function getUserEntity(string $userId): ?MagicUserEntity
    {
        $magicUserEntity = $this->magicUserDomainService->getUserById($userId);

        return $magicUserEntity;
    }

    public function getUserAuthorization(string $userId): ?UserAuthorization
    {
        $magicUserEntity = $this->getUserEntity($userId);

        return UserAuthorization::fromUserEntity($magicUserEntity);
    }
}
