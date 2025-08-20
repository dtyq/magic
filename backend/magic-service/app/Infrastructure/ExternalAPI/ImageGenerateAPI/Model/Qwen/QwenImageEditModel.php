<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\QwenImageEditRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use Hyperf\RateLimit\Annotation\RateLimit;
use Hyperf\Retry\Annotation\Retry;

class QwenImageEditModel extends AbstractImageGenerate
{
    private QwenImageAPI $api;

    public function __construct(ProviderConfigItem $serviceProviderConfig)
    {
        $apiKey = $serviceProviderConfig->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.api_call_failed');
        }

        $this->api = new QwenImageAPI($apiKey);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        return $this->generateImageRawInternal($imageGenerateRequest);
    }

    public function setAK(string $ak)
    {
        // 通义千问不使用AK/SK认证，此方法为空实现
    }

    public function setSK(string $sk)
    {
        // 通义千问不使用AK/SK认证，此方法为空实现
    }

    public function setApiKey(string $apiKey)
    {
        $this->api->setApiKey($apiKey);
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);

        if ($this->isWatermark($imageGenerateRequest)) {
            return $rawData;
        }

        return $this->processQwenEditRawDataWithWatermark($rawData, $imageGenerateRequest->getWatermarkConfig());
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $rawResults = $this->generateImageRawInternal($imageGenerateRequest);

        // 从原生结果中提取图片URL - 适配新的响应格式 output.choices
        $imageUrls = [];
        foreach ($rawResults as $index => $result) {
            $output = $result['output'];
            if (! empty($output['choices'])) {
                foreach ($output['choices'] as $choice) {
                    if (! empty($choice['message']['content'])) {
                        foreach ($choice['message']['content'] as $content) {
                            if (isset($content['image']) && ! empty($content['image'])) {
                                $imageUrls[$index] = $content['image'];
                                break 2; // 只取第一个图片URL
                            }
                        }
                    }
                }
            }
        }

        return new ImageGenerateResponse(ImageGenerateType::URL, $imageUrls);
    }

    /**
     * 生成图像的核心逻辑，返回原生结果 - 同步调用.
     */
    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof QwenImageEditRequest) {
            $this->logger->error('通义千问图像编辑：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // 校验必要参数
        $this->validateEditRequest($imageGenerateRequest);

        $this->logger->info('通义千问图像编辑：开始编辑', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'image_count' => count($imageGenerateRequest->getImageUrls()),
        ]);

        // 直接处理单个请求，图像编辑只处理一张图片
        try {
            $result = $this->callSyncEditAPI($imageGenerateRequest);
            $rawResults = [
                [
                    'success' => true,
                    'output' => $result['output'],
                ],
            ];
        } catch (Exception $e) {
            $this->logger->error('通义千问图像编辑：失败', [
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::from($e->getCode()) ?? ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }

        return $rawResults;
    }

    /**
     * 校验图像编辑请求参数.
     */
    private function validateEditRequest(QwenImageEditRequest $request): void
    {
        // 检查是否有输入图像
        if (empty($request->getImageUrls())) {
            $this->logger->error('通义千问图像编辑：缺少输入图像');
            ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.reference_images_required');
        }
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    #[RateLimit(create: 4, consume: 1, capacity: 0, key: ImageGenerate::IMAGE_GENERATE_KEY_PREFIX . ImageGenerate::IMAGE_GENERATE_SUBMIT_KEY_PREFIX . ImageGenerateModelType::QwenImageEdit->value, waitTimeout: 60)]
    private function callSyncEditAPI(QwenImageEditRequest $request): array
    {
        try {
            $params = [
                'prompt' => $request->getPrompt(),
                'image_urls' => $request->getImageUrls(),
                'model' => $request->getModel(),
            ];

            $response = $this->api->submitEditTask($params);

            // 检查响应格式 - 适配新的同步响应格式
            if (! isset($response['output']['choices'])) {
                $errorMsg = $response['message'] ?? '未知错误';
                $this->logger->warning('通义千问图像编辑：响应格式错误', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, $errorMsg);
            }

            // 检查是否有图像数据
            $choices = $response['output']['choices'];
            if (empty($choices)) {
                $this->logger->error('通义千问图像编辑：响应中缺少图像数据', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
            }

            $this->logger->info('通义千问图像编辑：调用成功', [
                'choices_count' => count($choices),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('通义千问图像编辑：调用异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    /**
     * 为通义千问编辑模式原始数据添加水印 - 适配新的choices格式.
     */
    private function processQwenEditRawDataWithWatermark(array $rawData, WatermarkConfig $watermarkConfig): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['output']['choices']) || ! is_array($result['output']['choices'])) {
                continue;
            }

            foreach ($result['output']['choices'] as $choiceIndex => &$choice) {
                if (! isset($choice['message']['content']) || ! is_array($choice['message']['content'])) {
                    continue;
                }

                foreach ($choice['message']['content'] as $contentIndex => &$content) {
                    if (! isset($content['image'])) {
                        continue;
                    }

                    try {
                        // 处理URL格式的图片
                        $content['image'] = $this->watermarkProcessor->addWatermarkToUrl($content['image'], $watermarkConfig);
                    } catch (Exception $e) {
                        // 水印处理失败时，记录错误但不影响图片返回
                        $this->logger->error('通义千问图像编辑水印处理失败', [
                            'index' => $index,
                            'choiceIndex' => $choiceIndex,
                            'contentIndex' => $contentIndex,
                            'error' => $e->getMessage(),
                        ]);
                        // 继续处理下一张图片，当前图片保持原始状态
                    }
                }
            }
        }

        return $rawData;
    }
}
