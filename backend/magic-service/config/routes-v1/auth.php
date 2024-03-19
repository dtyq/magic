<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Authentication\Facade\AuthenticationApi;
use App\Interfaces\Authentication\Facade\LoginApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    // 认证相关路由 - RESTful风格
    Router::addGroup('/auth', static function () {
        // 登录校验 - GET方法用于检查认证状态
        Router::get('/status', [AuthenticationApi::class, 'authCheck']);

        // 环境信息 - GET方法获取资源
        Router::get('/environment', [AuthenticationApi::class, 'authEnvironment']);
    });

    // 会话管理 - RESTful风格
    Router::addGroup('/sessions', static function () {
        // 创建会话（登录）
        Router::post('', [LoginApi::class, 'login']);
        // 销毁会话（登出）- 如果需要可以添加
        // Router::delete('', [LoginApi::class, 'logout']);
    });
});
