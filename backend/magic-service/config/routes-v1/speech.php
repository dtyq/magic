<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Speech\Facade\Open\SpeechToTextStandardApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/v1', static function () {
    Router::addGroup('/volcano/speech', static function () {
        // 提交语音识别任务
        Router::post('/submit', [SpeechToTextStandardApi::class, 'submit']);

        // 查询语音识别结果
        Router::post('/query/{taskId}', [SpeechToTextStandardApi::class, 'query']);
    });
});
