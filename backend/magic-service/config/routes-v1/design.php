<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Design\Facade\DesignApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/design', static function () {
        // 根据提示词生成图片
        Router::post('/generate-image', [DesignApi::class, 'generateImage']);
        // 转高清
        Router::post('/generate-high-image', [DesignApi::class, 'generateHighImage']);

        // 查询图片生成结果
        Router::get('/image-generation-result', [DesignApi::class, 'queryImageGenerationResult']);

        // 识别图片标记位置的内容
        Router::post('/identify-image-mark', [DesignApi::class, 'identifyImageMark']);

        // 获取图片转高清配置信息
        Router::get('/convert-high/config', [DesignApi::class, 'imageConvertHighConfig']);

        // 去背景
        Router::post('/remove-background', [DesignApi::class, 'removeBackground']);

        // 橡皮擦
        Router::post('/eraser', [DesignApi::class, 'eraser']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});
