<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\ModelGateway\Facade\Open\OpenAIProxyApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

// OpenAI 兼容接口 - 一定是 openai 模式，不要修改这里
Router::addGroup('/v1', function () {
    Router::post('/chat/completions', [OpenAIProxyApi::class, 'chatCompletions']);
    Router::post('/embeddings', [OpenAIProxyApi::class, 'embeddings']);
    Router::get('/models', [OpenAIProxyApi::class, 'models']);
    Router::post('/images/generations', [OpenAIProxyApi::class, 'textGenerateImage']);
    Router::post('/images/edits', [OpenAIProxyApi::class, 'imageEdit']);
    Router::get('/search', [OpenAIProxyApi::class, 'bingSearch']);
});

Router::addGroup('/v2', function () {
    Router::post('/images/generations', [OpenAIProxyApi::class, 'textGenerateImageV2']);
    Router::post('/images/edits', [OpenAIProxyApi::class, 'imageEditV2']);
});

// 前台模型接口
Router::addGroup('/api/v1', static function () {
    // 超级麦吉显示模型
    Router::get('/super-magic-models', [ServiceProviderApi::class, 'getSuperMagicDisplayModels']);
}, ['middleware' => [RequestContextMiddleware::class]]);
