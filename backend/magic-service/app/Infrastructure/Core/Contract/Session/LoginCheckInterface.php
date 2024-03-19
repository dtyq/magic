<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Session;

interface LoginCheckInterface
{
    public function getLoginCode(): string;

    public function setLoginCode(string $loginCode): void;

    public function getAuthorization(): string;

    public function setAuthorization(string $authorization): void;
}
