<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\File\Facade\Admin\FileApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/file', static function () {
        Router::post('/temporary-credential', [FileApi::class, 'getUploadTemporaryCredential']);
        // 公有桶下载
        Router::post('/publicFileDownload', [FileApi::class, 'publicFileDownload']);
        // 可能不同的业务下会有默认的文件以及组织也可以上传，供TA人使用，因此单独开路由
        // 根据不同的业务，获取指定业务下的文件
        Router::get('/business-file', [FileApi::class, 'getFileByBusinessType']);
        // 上传到业务中
        Router::post('/upload-business-file', [FileApi::class, 'uploadBusinessType']);
        // 删除
        Router::post('/delete-business-file', [FileApi::class, 'deleteBusinessFile']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/file', static function () {
        Router::get('/default-icons', [FileApi::class, 'getDefaultIcons']);

        // 本地文件上传
        Router::post('/upload', [FileApi::class, 'fileUpload']);
    });
});
