<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Exception;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;

/**
 * 图片生成统一抽象类
 * 集成水印处理和钉钉告警功能
 * 所有图片生成Provider都应该继承此类.
 */
abstract class AbstractImageGenerate implements ImageGenerate
{
    #[Inject]
    protected LoggerInterface $logger;

    #[Inject]
    protected ImageWatermarkProcessor $watermarkProcessor;

    #[Inject]
    protected Redis $redis;

    protected static string $watermarkText = '麦吉 AI 生成';

    /**
     * 统一的图片生成入口方法
     * 先调用子类实现的原始图片生成，再统一添加水印.
     */
    final public function generateImage(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        // 1. 调用子类的原始生成方法
        $originalResponse = $this->generateImageInternal($imageGenerateRequest);

        // 2. 获取水印配置（所有图片都必须加水印）
        $watermarkConfig = $imageGenerateRequest->getWatermarkConfig();

        if ($this->isWatermark($imageGenerateRequest)) {
            return $originalResponse;
        }

        // 3. 统一添加水印
        $this->logger->info('图片生成：开始添加统一水印', [
            'imageCount' => count($originalResponse->getData()),
            'imageType' => $originalResponse->getImageGenerateType()->value,
        ]);

        return $this->applyWatermark($originalResponse, $watermarkConfig);
    }

    /**
     * 实现接口要求的带水印原始数据方法
     * 各子类必须根据自己的数据格式实现此方法.
     */
    abstract public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array;

    /**
     * 子类实现的原始图片生成方法
     * 只负责调用各自API生成图片，不用关心水印处理.
     */
    abstract protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse;

    protected function isWatermark(ImageGenerateRequest $imageGenerateRequest): bool
    {
        return $imageGenerateRequest->getWatermarkConfig() === null;
    }

    /**
     * 统一的水印处理逻辑
     * 支持URL和base64两种格式的图片水印处理.
     */
    private function applyWatermark(ImageGenerateResponse $response, WatermarkConfig $watermarkConfig): ImageGenerateResponse
    {
        $data = $response->getData();
        $processedData = [];

        foreach ($data as $index => $imageData) {
            try {
                if ($response->getImageGenerateType()->isBase64()) {
                    // 处理base64格式图片
                    $processedData[$index] = $this->watermarkProcessor->addWatermarkToBase64($imageData, $watermarkConfig);
                } else {
                    // 处理URL格式图片
                    $processedData[$index] = $this->watermarkProcessor->addWatermarkToUrl($imageData, $watermarkConfig);
                }
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                    'imageType' => $response->getImageGenerateType()->value,
                ]);
                // 返回原始图片
                $processedData[$index] = $imageData;
            }
        }

        return new ImageGenerateResponse($response->getImageGenerateType(), $processedData);
    }
}
