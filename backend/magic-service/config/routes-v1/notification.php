<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Hyperf\HttpServer\Router\Router;

// 公共能力只挂载用户侧 API，不提供站内信管理后台或内部事件 HTTP 入口。
Router::addGroup('/api/v1/notifications', static function () {
    // Facade 在第 8 节实现；此处使用类名字符串，避免装配阶段提前实例化未完成的业务服务。
    Router::get('', ['App\Interfaces\Notification\Facade\NotificationApi', 'list']);
    Router::get('/counts', ['App\Interfaces\Notification\Facade\NotificationApi', 'counts']);
    Router::post('/{notificationId}/read', ['App\Interfaces\Notification\Facade\NotificationApi', 'read']);
}, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);

Router::get('/api/v1/notification-templates', ['App\Interfaces\Notification\Facade\NotificationTemplateApi', 'catalog'], [
    'middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class],
]);
