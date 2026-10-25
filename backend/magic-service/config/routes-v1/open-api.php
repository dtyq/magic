<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Chat\Facade\Open\MagicChatOpenApi;
use App\Interfaces\Contact\Facade\Open\MagicUserOpenApi;
use App\Interfaces\Flow\Facade\Open\MagicFlowOpenApi;
use App\Interfaces\Middleware\Auth\ApiKeyMiddleware;
use App\Interfaces\ModelGateway\Facade\Open\DataQueryApi;
use App\Interfaces\ModelGateway\Facade\Open\PersonaAvatarApi;
use App\Interfaces\ModelGateway\Facade\Open\SlidesTemplateApi;
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
    Router::post('/knowledge-bases/files/links', [MagicFlowOpenApi::class, 'generateKnowledgeBaseFileLinks']);
});

Router::addGroup('/api/v1/open-api', function () {
    Router::post('/im/messages/queries', [MagicChatOpenApi::class, 'messageQueries']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

// Slides template APIs
Router::addGroup('/api/v1/open-api', function () {
    Router::get('/slides-templates/taxonomy', [SlidesTemplateApi::class, 'getTaxonomy']);
    Router::get('/slides-templates/{code}/file-url', [SlidesTemplateApi::class, 'getFileUrl']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

// Persona avatar library APIs
Router::addGroup('/api/v1/open-api', function () {
    Router::get('/persona-avatars', [PersonaAvatarApi::class, 'getCatalog']);
    Router::get('/persona-avatars/{id}/file-url', [PersonaAvatarApi::class, 'getFileUrl']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

// Contact user lookup APIs
Router::addGroup('/api/v1/open-api', function () {
    Router::get('/contact/users/search', [MagicUserOpenApi::class, 'search']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

// Data query APIs
Router::addGroup('/api/v1/open-api', function () {
    Router::get('/weather/forecast', [DataQueryApi::class, 'weatherForecast']);
}, ['middleware' => [ApiKeyMiddleware::class]]);
