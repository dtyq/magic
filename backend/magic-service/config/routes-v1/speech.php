<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Speech\Facade\Open\SpeechToTextStandardApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/v1', static function () {
    Router::addGroup('/volcano/speech', static function () {
        // 普通语音识别
        Router::post('/submit', [SpeechToTextStandardApi::class, 'submit']);
        Router::post('/query/{taskId}', [SpeechToTextStandardApi::class, 'query']);

        // 大模型语音识别
        Router::post('/bigmodel/submit', [SpeechToTextStandardApi::class, 'submitBigModel']);
        Router::post('/bigmodel/query/{requestId}', [SpeechToTextStandardApi::class, 'queryBigModel']);
    });
});
