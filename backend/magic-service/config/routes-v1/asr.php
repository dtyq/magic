<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Asr\Facade\AsrTokenApi;
use Hyperf\HttpServer\Router\Router;

// ASR 语音识别服务路由 - RESTful 风格
Router::addGroup('/api/v1/asr', function () {
    // JWT Token 资源管理
    Router::get('/tokens', [AsrTokenApi::class, 'show']);        // 获取当前用户的JWT Token
    Router::delete('/tokens', [AsrTokenApi::class, 'destroy']);  // 清除当前用户的JWT Token缓存

    // 录音文件上传 Token 管理
    Router::get('/upload-tokens', [AsrTokenApi::class, 'getUploadToken']);  // 获取录音文件上传STS Token

    // 录音文件上传服务,debug 使用
    Router::post('/upload', [AsrTokenApi::class, 'uploadFile']); // ASR专用服务端代理文件上传

    // 录音总结服务
    Router::post('/summary', [AsrTokenApi::class, 'summary']); // 查询录音总结状态（包含处理逻辑）
    // 合并录音文件下载服务
    Router::get('/download-url', [AsrTokenApi::class, 'downloadMergedAudio']); // 获取合并后录音文件的下载链接

    // 文件列表查询服务 - 测试接口
    Router::post('/files', [AsrTokenApi::class, 'listObject']); // 查询指定目录下的文件列表（测试用）
}, ['middleware' => [RequestContextMiddleware::class]]);
