<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\ApiKeyMiddleware;
use App\Interfaces\ModelGateway\Facade\Open\ImageProxyApi;
use App\Interfaces\ModelGateway\Facade\Open\OpenAIProxyApi;
use App\Interfaces\ModelGateway\Facade\Open\VideoApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

// OpenAI 兼容接口 - 一定是 openai 模式，不要修改这里
Router::addGroup('/v1', function () {
    Router::post('/chat/completions', [OpenAIProxyApi::class, 'chatCompletions']);
    Router::post('/embeddings', [OpenAIProxyApi::class, 'embeddings']);
    Router::get('/models', [OpenAIProxyApi::class, 'models']);
    Router::post('/images/generations', [OpenAIProxyApi::class, 'textGenerateImage']);
    Router::post('/images/edits', [OpenAIProxyApi::class, 'imageEdit']);
    Router::post('/videos', [VideoApi::class, 'create']);
    Router::get('/videos/{id}', [VideoApi::class, 'get']);
    // @deprecated Use /v2/search instead - supports multiple search engines
    Router::get('/search', [OpenAIProxyApi::class, 'bingSearch']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

Router::addGroup('/v2', function () {
    // Image generation endpoint - creates images from text prompts
    Router::post('/images/generations', [OpenAIProxyApi::class, 'textGenerateImageV2']);
    // Image edit endpoint - edits images with prompts and optional masks
    Router::post('/images/edits', [OpenAIProxyApi::class, 'imageEditV2']);
    // Image convert-high endpoint - upscales or enhances input images
    Router::post('/images/convert-high', [ImageProxyApi::class, 'imageConvertHigh']);
    // Image remove-background endpoint - removes backgrounds from input images
    Router::post('/images/remove-background', [ImageProxyApi::class, 'imageRemoveBackground']);
    // Unified search endpoint - supports multiple search engines (bing, google, tavily, duckduckgo, jina)
    Router::get('/search', [OpenAIProxyApi::class, 'unifiedSearch']);
    // Image search endpoint - supports multiple providers (bing, google via serpapi)
    Router::get('/image-search', [OpenAIProxyApi::class, 'imageSearch']);
    // Web scrape endpoint - fetches and extracts content from target web pages
    Router::post('/web-scrape', [OpenAIProxyApi::class, 'webScrape']);
}, ['middleware' => [ApiKeyMiddleware::class]]);

// 前台模型接口
Router::addGroup('/api/v1', static function () {
    // 超级麦吉显示模型
    Router::get('/super-magic-models', [ServiceProviderApi::class, 'getSuperMagicDisplayModels']);
}, ['middleware' => [RequestContextMiddleware::class]]);
