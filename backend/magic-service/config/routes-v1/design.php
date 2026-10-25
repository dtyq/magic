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
        // 根据提示词生成图片（generate-images上线后废弃）
        Router::post('/generate-image', [DesignApi::class, 'generateImage']);
        // 补全生图提示词
        Router::post('/image-prompt/complete', [DesignApi::class, 'completeImagePrompt']);
        // 根据提示词生成多张图片
        Router::post('/generate-images', [DesignApi::class, 'generateImages']);
        // 优化画布文本内容
        Router::post('/text-content/complete', [DesignApi::class, 'completeTextContent']);
        // 转高清
        Router::post('/generate-high-image', [DesignApi::class, 'generateHighImage']);

        // 查询图片生成结果（generate-images上线后废弃）
        Router::get('/image-generation-result', [DesignApi::class, 'queryImageGenerationResult']);
        // 查询多图生成结果
        Router::get('/image-generation-results', [DesignApi::class, 'queryImageGenerationResults']);

        // 识别图片标记位置的内容
        Router::post('/identify-image-mark', [DesignApi::class, 'identifyImageMark']);

        // Deprecated: use GET /api/v1/ai-abilities/availability instead.
        Router::get('/convert-high/config', [DesignApi::class, 'imageConvertHighConfig']);

        // 去背景
        Router::post('/remove-background', [DesignApi::class, 'removeBackground']);

        // 橡皮擦
        Router::post('/eraser', [DesignApi::class, 'eraser']);

        // 扩图
        Router::post('/expand-image', [DesignApi::class, 'expandImage']);

        // 生成视频
        Router::post('/generate-video', [DesignApi::class, 'generateVideo']);

        Router::post('/estimate-video-points', [DesignApi::class, 'estimateVideoPoints']);

        // 查询视频生成结果
        Router::get('/video-generation-result', [DesignApi::class, 'queryVideoGenerationResult']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});
