<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\OptionalUserAuthMiddleware;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use App\Interfaces\SlidesTemplate\Facade\SlidesTemplateApi;
use App\Interfaces\SlidesTemplate\Facade\SlidesTemplateCategoryApi;
use App\Interfaces\SlidesTemplate\Facade\SlidesTemplateTagApi;
use Hyperf\HttpServer\Router\Router;

// 幻灯片模板分类使用侧
Router::addGroup('/api/v1/slides-template-categories', static function () {
    Router::get('', [SlidesTemplateCategoryApi::class, 'queries']);
}, ['middleware' => [OptionalUserAuthMiddleware::class]]);

// 幻灯片模板标签使用侧
Router::addGroup('/api/v1/slides-template-tags', static function () {
    Router::get('', [SlidesTemplateTagApi::class, 'queries']);
}, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);

// 幻灯片模板标签组使用侧
Router::addGroup('/api/v1/slides-template/tags', static function () {
    Router::get('/groups', [SlidesTemplateTagApi::class, 'groups']);
}, ['middleware' => [OptionalUserAuthMiddleware::class]]);

// Share pages may read official template lists and counts with a temporary token.
Router::addGroup('/api/v1/slides-templates', static function () {
    Router::get('', [SlidesTemplateApi::class, 'queries']);
    Router::get('/count', [SlidesTemplateApi::class, 'count']);
}, ['middleware' => [OptionalUserAuthMiddleware::class]]);

// 幻灯片模板使用侧
Router::addGroup('/api/v1/slides-templates', static function () {
    //    Router::post('', [SlidesTemplateApi::class, 'save']);
    Router::post('/from-project', [SlidesTemplateApi::class, 'publishFromProject']);
    Router::get('/favorites', [SlidesTemplateApi::class, 'favorites']);
    Router::get('/used', [SlidesTemplateApi::class, 'used']);
    Router::get('/{code}/availability', [SlidesTemplateApi::class, 'availability']);
    Router::post('/{code}/favorite', [SlidesTemplateApi::class, 'favorite']);
    Router::delete('/{code}/favorite', [SlidesTemplateApi::class, 'unfavorite']);
    Router::delete('/{code}', [SlidesTemplateApi::class, 'delete']);
    Router::get('/{code}', [SlidesTemplateApi::class, 'detail']);
}, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);
