<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\QwenImageModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\Context\CoContext;
use Exception;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Hyperf\RateLimit\Annotation\RateLimit;
use Hyperf\Retry\Annotation\Retry;
use ValueError;

class QwenImageModel extends AbstractImageGenerate
{
    private QwenImageAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $apiKey = $serviceProviderConfig['api_key'];
        $baseUrl = $serviceProviderConfig['url'] ?? null;
        $proxyUrl = $serviceProviderConfig['proxy_url'] ?? null;
        if (empty($apiKey)) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.api_call_failed');
        }

        $this->api = new QwenImageAPI($apiKey, $baseUrl, $proxyUrl);
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

        return $this->processQwenRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - Qwen版本.
     */
    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => $this->getProviderName(),
            'data' => [],
        ]);

        if (! $imageGenerateRequest instanceof QwenImageModelRequest) {
            $this->logger->error('Qwen OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response;
        }

        $count = $imageGenerateRequest->getGenerateNum();
        try {
            $rawResults = $this->generateImageRawInternal($imageGenerateRequest);
            foreach ($rawResults as $result) {
                $this->addImageDataToResponseQwen($response, $result, $imageGenerateRequest);
            }
        } catch (Exception $e) {
            $response->setProviderErrorCode($e->getCode());
            $response->setProviderErrorMessage($e->getMessage());
            $this->logger->error('Qwen OpenAI格式生图：处理失败', [
                'error_code' => $e->getCode(),
                'error_message' => $e->getMessage(),
            ]);
        }

        $this->logger->info('Qwen OpenAI格式生图：处理完成', [
            '总请求数' => $count,
            '成功图片数' => count($response->getData()),
            '是否有错误' => $response->hasError(),
            '错误码' => $response->getProviderErrorCode(),
            '错误消息' => $response->getProviderErrorMessage(),
        ]);

        return $response;
    }

    public function getProviderName(): string
    {
        return 'qwen';
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $rawResults = $this->generateImageRawInternal($imageGenerateRequest);

        $imageUrls = [];
        $index = 0;
        foreach ($rawResults as $result) {
            $urls = $this->extractImageUrls($result);
            foreach ($urls as $url) {
                $imageUrls[$index] = $url;
                ++$index;
            }
        }

        return new ImageGenerateResponse(ImageGenerateType::URL, $imageUrls);
    }

    /**
     * 生成图像核心逻辑：仅保留同步接口，按 generate_num 并发多个同步请求.
     */
    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof QwenImageModelRequest) {
            $this->logger->error('通义千问生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.general_error');
        }

        $this->validateRequest($imageGenerateRequest);
        $count = $imageGenerateRequest->getGenerateNum();
        $this->logger->info('通义千问生图：开始同步调用', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $imageGenerateRequest->getWidth() . 'x' . $imageGenerateRequest->getHeight(),
            'count' => $count,
            'model' => $imageGenerateRequest->getModel(),
        ]);

        // qwen-image 仅支持单次1张；其他模型支持单请求批量生成
        if (! $this->isSingleGenerateOnlyModel($imageGenerateRequest->getModel())) {
            try {
                $result = $this->callSyncGenerateAPI($imageGenerateRequest, $count);
                $this->validateQwenResponse($result);
                return [$result];
            } catch (Exception $e) {
                $this->logger->error('通义千问生图：批量同步请求失败', [
                    'count' => $count,
                    'error' => $e->getMessage(),
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.api_call_failed');
            }
        }

        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();
        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $i, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    $result = $this->callSyncGenerateAPI($imageGenerateRequest, 1);
                    $this->validateQwenResponse($result);
                    return [
                        'success' => true,
                        'result' => $result,
                        'index' => $i,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('通义千问生图：同步请求失败', [
                        'index' => $i,
                        'error' => $e->getMessage(),
                    ]);
                    return [
                        'success' => false,
                        'error_code' => $e->getCode(),
                        'error_msg' => $e->getMessage(),
                        'index' => $i,
                    ];
                }
            });
        }

        $results = $parallel->wait();
        $rawResults = [];
        $errors = [];
        foreach ($results as $result) {
            if ($result['success']) {
                $rawResults[$result['index']] = $result['result'];
                continue;
            }
            $errors[] = [
                'code' => $result['error_code'] ?? ImageGenerateErrorCode::GENERAL_ERROR->value,
                'message' => $result['error_msg'] ?? '',
            ];
        }

        if (empty($rawResults)) {
            $finalErrorCode = ImageGenerateErrorCode::NO_VALID_IMAGE;
            $finalErrorMsg = 'image_generate.no_valid_image_generated';
            foreach ($errors as $error) {
                if ($error['code'] === ImageGenerateErrorCode::GENERAL_ERROR->value) {
                    continue;
                }
                $finalErrorCode = $this->resolveErrorCode((int) $error['code']);
                $finalErrorMsg = $error['message'] ?: 'image_generate.general_error';
                break;
            }
            ExceptionBuilder::throw($finalErrorCode, $finalErrorMsg);
        }

        ksort($rawResults);
        return array_values($rawResults);
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    #[RateLimit(create: 4, consume: 1, capacity: 0, key: self::IMAGE_GENERATE_KEY_PREFIX . self::IMAGE_GENERATE_SUBMIT_KEY_PREFIX . 'Qwen-Image', waitTimeout: 60)]
    private function callSyncGenerateAPI(QwenImageModelRequest $request, int $generateNum = 1): array
    {
        try {
            return $this->api->generateImage($request->toArray($generateNum));
        } catch (Exception $e) {
            $this->logger->error('通义千问生图：同步接口调用异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.api_call_failed');
        }
    }

    private function validateRequest(QwenImageModelRequest $request): void
    {
        if (empty($request->getPrompt())) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.prompt_required');
        }

        if ($request->getGenerateNum() < 1) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_count');
        }
    }

    private function isSingleGenerateOnlyModel(string $model): bool
    {
        return in_array($model, ['qwen-image', 'qwen-image-plus']);
    }

    /**
     * 为通义千问原始数据添加水印.
     */
    private function processQwenRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        foreach ($rawData as $index => &$result) {
            if (empty($result['output']['choices']) || ! is_array($result['output']['choices'])) {
                continue;
            }

            foreach ($result['output']['choices'] as &$choice) {
                if (empty($choice['message']['content']) || ! is_array($choice['message']['content'])) {
                    continue;
                }
                foreach ($choice['message']['content'] as &$content) {
                    if (empty($content['image'])) {
                        continue;
                    }
                    try {
                        $content['image'] = $this->watermarkProcessor->addWatermarkToUrl($content['image'], $imageGenerateRequest);
                    } catch (Exception $e) {
                        $this->logger->error('通义千问图片水印处理失败', [
                            'index' => $index,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
                unset($content);
            }
            unset($choice);
        }

        return $rawData;
    }

    /**
     * 验证通义千问API响应数据格式.
     */
    private function validateQwenResponse(array $result): void
    {
        if (empty($result['output']) || ! is_array($result['output'])) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, 'image_generate.response_format_error');
        }

        if ($this->extractImageUrls($result) === []) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.missing_image_data');
        }
    }

    /**
     * 将通义千问图片数据添加到OpenAI响应对象中.
     */
    private function addImageDataToResponseQwen(
        OpenAIFormatResponse $response,
        array $qwenResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        $lockOwner = $this->lockResponse($response);
        try {
            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();
            $imageUrls = $this->extractImageUrls($qwenResult);
            if ($imageUrls === []) {
                return;
            }

            foreach ($imageUrls as $imageUrl) {
                try {
                    $processedUrl = $this->watermarkProcessor->addWatermarkToUrl($imageUrl, $imageGenerateRequest);
                    $currentData[] = ['url' => $processedUrl];
                } catch (Exception $e) {
                    $this->logger->error('Qwen添加图片数据：URL水印处理失败', [
                        'error' => $e->getMessage(),
                        'url' => $imageUrl,
                    ]);
                    $currentData[] = ['url' => $imageUrl];
                }
            }

            if (! empty($qwenResult['usage']) && is_array($qwenResult['usage'])) {
                $currentUsage->addGeneratedImages((int) ($qwenResult['usage']['image_count'] ?? 1));
            } else {
                $currentUsage->addGeneratedImages(count($imageUrls));
            }

            $response->setData($currentData);
            $response->setUsage($currentUsage);
        } finally {
            $this->unlockResponse($response, $lockOwner);
        }
    }

    private function extractImageUrls(array $result): array
    {
        if (empty($result['output']['choices']) || ! is_array($result['output']['choices'])) {
            return [];
        }

        $imageUrls = [];
        foreach ($result['output']['choices'] as $choice) {
            if (empty($choice['message']['content']) || ! is_array($choice['message']['content'])) {
                continue;
            }
            foreach ($choice['message']['content'] as $content) {
                if (! empty($content['image'])) {
                    $imageUrls[] = $content['image'];
                }
            }
        }

        return $imageUrls;
    }

    private function resolveErrorCode(int $errorCode): ImageGenerateErrorCode
    {
        try {
            return ImageGenerateErrorCode::from($errorCode);
        } catch (ValueError $e) {
            return ImageGenerateErrorCode::GENERAL_ERROR;
        }
    }
}
