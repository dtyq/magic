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
use App\Infrastructure\Util\Locker\RedisLocker;
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

    #[Inject]
    protected RedisLocker $redisLocker;

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
     * 使用Redis自旋锁实现排队等待.
     *
     * @return string 返回锁的owner，用于释放锁
     */
    protected function lockResponse(OpenAIFormatResponse $response): string
    {
        $lockKey = 'img_response_' . spl_object_id($response);
        $owner = bin2hex(random_bytes(8)); // 16位随机字符串作为owner

        // spinLock会自动等待，直到获取成功或超时（30秒）
        if (! $this->redisLocker->spinLock($lockKey, $owner, 30)) {
            $this->logger->error('获取图像响应Redis锁超时', [
                'lock_key' => $lockKey,
                'timeout' => 30,
            ]);
            throw new Exception('获取图像响应锁超时，请稍后重试');
        }

        $this->logger->debug('Redis锁获取成功', ['lock_key' => $lockKey, 'owner' => $owner]);
        return $owner;
    }

    /**
     * 释放响应对象的锁.
     *
     * @param OpenAIFormatResponse $response 响应对象
     * @param string $owner 锁的owner
     */
    protected function unlockResponse(OpenAIFormatResponse $response, string $owner): void
    {
        $lockKey = 'img_response_' . spl_object_id($response);

        try {
            $result = $this->redisLocker->release($lockKey, $owner);
            if (! $result) {
                $this->logger->warning('Redis锁释放失败，可能已被其他进程释放', [
                    'lock_key' => $lockKey,
                    'owner' => $owner,
                ]);
            } else {
                $this->logger->debug('Redis锁释放成功', ['lock_key' => $lockKey, 'owner' => $owner]);
            }
        } catch (Exception $e) {
            $this->logger->error('Redis锁释放异常', [
                'lock_key' => $lockKey,
                'owner' => $owner,
                'error' => $e->getMessage(),
            ]);
            // 锁释放失败不影响业务逻辑，但要记录日志
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
