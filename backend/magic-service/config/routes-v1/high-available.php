<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\HighAvailability\HighAvailabilityApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/high-available', static function () {
        Router::get('/models/endpoints', [HighAvailabilityApi::class, 'getModelsEndpoints']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});
