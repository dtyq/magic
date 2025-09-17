<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Exception;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Engine\Channel;
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

    /**
     * 响应对象锁的映射表.
     * @var array<string, Channel>
     */
    private static array $responseLocks = [];

    /**
     * 统一的图片生成入口方法
     * 先调用子类实现的原始图片生成，再统一添加水印.
     */
    final public function generateImage(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $originalResponse = $this->generateImageInternal($imageGenerateRequest);

        return $this->applyWatermark($originalResponse, $imageGenerateRequest);
    }

    /**
     * 实现接口要求的带水印原始数据方法
     * 各子类必须根据自己的数据格式实现此方法.
     */
    abstract public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array;

    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        return $this->generateImageOpenAIFormat($imageGenerateRequest);
    }

    /**
     * 子类实现的原始图片生成方法
     * 只负责调用各自API生成图片，不用关心水印处理.
     */
    abstract protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse;

    /**
     * 获取响应对象的锁，用于并发安全地操作 OpenAIFormatResponse.
     */
    protected function lockResponse(OpenAIFormatResponse $response): void
    {
        $lockKey = spl_object_hash($response);

        if (! isset(self::$responseLocks[$lockKey])) {
            // 创建容量为1的Channel作为互斥锁
            self::$responseLocks[$lockKey] = new Channel(1);
            // 初始放入一个令牌
            self::$responseLocks[$lockKey]->push(true);
        }

        // 获取锁（从Channel中取出令牌）
        self::$responseLocks[$lockKey]->pop();
    }

    /**
     * 释放响应对象的锁
     */
    protected function unlockResponse(OpenAIFormatResponse $response): void
    {
        $lockKey = spl_object_hash($response);

        if (isset(self::$responseLocks[$lockKey])) {
            // 释放锁（放回令牌到Channel）
            self::$responseLocks[$lockKey]->push(true);
        }
    }

    /**
     * 统一的水印处理逻辑
     * 支持URL和base64两种格式的图片水印处理.
     */
    private function applyWatermark(ImageGenerateResponse $response, ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $data = $response->getData();
        $processedData = [];

        foreach ($data as $index => $imageData) {
            try {
                if ($response->getImageGenerateType()->isBase64()) {
                    // 处理base64格式图片
                    $processedData[$index] = $this->watermarkProcessor->addWatermarkToBase64($imageData, $imageGenerateRequest);
                } else {
                    // 处理URL格式图片
                    $processedData[$index] = $this->watermarkProcessor->addWatermarkToUrl($imageData, $imageGenerateRequest);
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
