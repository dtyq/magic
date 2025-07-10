<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Flow\Facade\Open\MagicFlowOpenApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/open-api', function () {
    // flow api
    Router::post('/chat', [MagicFlowOpenApi::class, 'chat']);
    Router::post('/{botId}/chat', [MagicFlowOpenApi::class, 'chatWithId']);
    Router::post('/chat/completions', [MagicFlowOpenApi::class, 'chatCompletions']);
    Router::post('/param-call', [MagicFlowOpenApi::class, 'paramCall']);
    Router::post('/{code}/param-call', [MagicFlowOpenApi::class, 'paramCallWithId']);
    Router::post('/async-chat', [MagicFlowOpenApi::class, 'chatAsync']);
    Router::post('/async-param-call', [MagicFlowOpenApi::class, 'paramCallAsync']);
    Router::get('/async-chat/{taskId}', [MagicFlowOpenApi::class, 'getExecuteResult']);
});
