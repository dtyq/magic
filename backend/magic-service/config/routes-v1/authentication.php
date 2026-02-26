<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Authentication\Facade\Admin\ApiKeyProviderAdminApi;
use App\Interfaces\Authentication\Facade\Admin\PersonalAccessTokenAdminApi;
use App\Interfaces\Authentication\Facade\ModelGatewayTokenApi;
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

    // 模型网关用户 token 首发签发（登录态用户）
    Router::addGroup('/model-gateway-tokens', static function () {
        Router::post('', [ModelGatewayTokenApi::class, 'issueModelGatewayToken']);
    });
}, ['middleware' => [UserAuthMiddleware::class]]);

// 模型网关用户 token 刷新（refresh token 双旋转）
Router::addGroup('/api/v1/authentication', static function () {
    Router::addGroup('/model-gateway-tokens', static function () {
        Router::post('/refresh', [ModelGatewayTokenApi::class, 'refreshModelGatewayToken']);
    });
});
