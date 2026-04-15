<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\DTO\AccessToken;

readonly class GetAccessTokenParamsDTO
{
    public static function fromArray(array $params): self
    {
        return new self();
    }
}
