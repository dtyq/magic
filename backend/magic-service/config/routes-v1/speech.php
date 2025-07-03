xq<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license.
 */
use App\Interfaces\Speech\Facade\Open\SpeechToTextStandardApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/speech', static function () {
        // 普通语音识别
        Router::post('/submit', [SpeechToTextStandardApi::class, 'submit']);
        Router::post('/query/{taskId}', [SpeechToTextStandardApi::class, 'query']);

        // 大模型语音识别
        Router::post('/large-model/submit', [SpeechToTextStandardApi::class, 'submitLargeModel']);
        Router::post('/large-model/query/{requestId}', [SpeechToTextStandardApi::class, 'queryLargeModel']);

        // 极速版语音识别
        Router::post('/flash', [SpeechToTextStandardApi::class, 'flash']);
    });
});
