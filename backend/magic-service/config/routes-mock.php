<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Mock\OpenAIApi;
use App\Interfaces\Mock\SandboxAsrApi;
use Hyperf\HttpServer\Router\Router;

// 出于单测的需要，mock 所有第三方的 http 调用，提升单测速度和稳定性。
Router::addServer('mock-http-service', static function () {
    // 类 openai 的大模型调用
    Router::addRoute(['POST'], '/v1/chat/completions', [OpenAIApi::class, 'chatCompletion']);
    Router::addRoute(['POST'], '/v1/completions', [OpenAIApi::class, 'chatCompletion']);
    Router::addRoute(['POST'], '/v1/embeddings', [OpenAIApi::class, 'embeddings']);

    // odin 中，豆包大模型的 DouBao的API版本路径为 api/v3
    Router::addRoute(['POST'], '/api/v3/chat/completions', [OpenAIApi::class, 'chatCompletion']);
    Router::addRoute(['POST'], '/api/v3/completions', [OpenAIApi::class, 'chatCompletion']);
    Router::addRoute(['POST'], '/api/v3/embeddings', [OpenAIApi::class, 'embeddings']);

    // 沙箱管理 API
    Router::addRoute(['GET'], '/api/v1/sandboxes/{sandboxId}', [SandboxAsrApi::class, 'getSandboxStatus']);
    Router::addRoute(['POST'], '/api/v1/sandboxes', [SandboxAsrApi::class, 'createSandbox']);

    // 沙箱 ASR API (通过 proxy 路径)
    Router::addRoute(['POST'], '/api/v1/sandboxes/{sandboxId}/proxy/api/asr/task/start', [SandboxAsrApi::class, 'startTask']);
    Router::addRoute(['POST'], '/api/v1/sandboxes/{sandboxId}/proxy/api/asr/task/finish', [SandboxAsrApi::class, 'finishTask']);
});
