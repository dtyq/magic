<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\DTO;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Throwable;

class ApiKeyAuthResult
{
    public function __construct(
        public readonly ?AccessTokenEntity $accessTokenEntity,
        public readonly ?MagicUserAuthorization $userAuthorization,
        public readonly ?string $apiKey,
        public readonly ?Throwable $sandboxException = null
    ) {
    }
}
