<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Authentication\Facade\Admin\ApiKeyProviderAdminApi;
use App\Interfaces\Authentication\Facade\Admin\PersonalAccessTokenAdminApi;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/authentication', static function () {
    // API密钥管理
    Router::addGroup('/api-key', static function () {
        Router::post('', [ApiKeyProviderAdminApi::class, 'save']);
        Router::post('/queries', [ApiKeyProviderAdminApi::class, 'queries']);
        Router::get('/{code}', [ApiKeyProviderAdminApi::class, 'show']);
        Router::delete('/{code}', [ApiKeyProviderAdminApi::class, 'destroy']);
        Router::post('/{code}/rebuild', [ApiKeyProviderAdminApi::class, 'changeSecretKey']);
    });

    // 个人访问令牌管理
    Router::addGroup('/personal-access-token', static function () {
        Router::post('', [PersonalAccessTokenAdminApi::class, 'createToken']);
        Router::post('/reset', [PersonalAccessTokenAdminApi::class, 'resetToken']);
        Router::get('', [PersonalAccessTokenAdminApi::class, 'getTokenInfo']);
        Router::delete('', [PersonalAccessTokenAdminApi::class, 'deleteToken']);
    });
}, ['middleware' => [UserAuthMiddleware::class]]);
