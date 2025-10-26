<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Asr\Facade\AsrApi;
use Hyperf\HttpServer\Router\Router;

// ASR 语音识别服务路由 - RESTful 风格
Router::addGroup('/api/v1/asr', static function () {
    // JWT Token 资源管理
    Router::get('/tokens', [AsrApi::class, 'show']);        // 获取当前用户的JWT Token
    Router::delete('/tokens', [AsrApi::class, 'destroy']);  // 清除当前用户的JWT Token缓存
    // 录音文件上传 Token 管理
    Router::get('/upload-tokens', [AsrApi::class, 'getUploadToken']);  // 获取录音文件上传STS Token
    // 录音状态上报
    Router::post('/status', [AsrApi::class, 'reportStatus']); // 录音状态上报（start|recording|paused|stopped）
    // 录音总结服务
    Router::post('/summary', [AsrApi::class, 'summary']); // 查询录音总结状态（包含处理逻辑）
}, ['middleware' => [RequestContextMiddleware::class]]);
