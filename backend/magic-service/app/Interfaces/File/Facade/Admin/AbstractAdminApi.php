<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\File\Facade\Admin;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractAdminApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        protected readonly RequestInterface $request,
    ) {
    }
}
