<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\Router\RouteLoader;

RouteLoader::loadDir(BASE_PATH . '/vendor/dtyq/super-magic-module/config/routes-v1');
