<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use App\Interfaces\SuperMagic\Design\Facade\HtmlDesignStyleApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup(
    '/api/v1/super-magic/html-design-styles',
    static function () {
        Router::get('/{styleCode}/source', [HtmlDesignStyleApi::class, 'getSource']);
    },
    ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]
);
