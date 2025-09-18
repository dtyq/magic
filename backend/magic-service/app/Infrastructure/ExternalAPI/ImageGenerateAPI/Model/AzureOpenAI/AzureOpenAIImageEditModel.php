<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageEditRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use Exception;
use Hyperf\Retry\Annotation\Retry;

class AzureOpenAIImageEditModel extends AbstractImageGenerate
{
    private AzureOpenAIAPI $api;

    private array $configItem;

    public function __construct(array $config)
    {
        $this->configItem = $config;
        $baseUrl = $config['url'];
        $apiVersion = $config['api_version'];
        $this->api = new AzureOpenAIAPI($config['api_key'], $baseUrl, $apiVersion);
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof AzureOpenAIImageEditRequest) {
            $this->logger->error('Azure OpenAI图像编辑：请求类型错误', [
                'expected' => AzureOpenAIImageEditRequest::class,
                'actual' => get_class($imageGenerateRequest),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $this->validateRequest($imageGenerateRequest);

        $this->logger->info('Azure OpenAI图像编辑：开始调用API', [
            'reference_images_count' => count($imageGenerateRequest->getReferenceImages()),
            'has_mask' => ! empty($imageGenerateRequest->getMaskUrl()),
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $imageGenerateRequest->getSize(),
            'n' => $imageGenerateRequest->getN(),
        ]);

        try {
            return $this->api->editImage(
                $imageGenerateRequest->getReferenceImages(),
                $imageGenerateRequest->getMaskUrl(),
                $imageGenerateRequest->getPrompt(),
                $imageGenerateRequest->getSize(),
                $imageGenerateRequest->getN()
            );
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：API调用失败', [
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    public function setAK(string $ak): void
    {
    }

    public function setSK(string $sk): void
    {
    }

    public function setApiKey(string $apiKey): void
    {
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);

        return $this->processAzureOpenAIEditRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - Azure OpenAI图像编辑版本.
     */
    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        // 1. 预先创建响应对象
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => $this->getProviderName(),
            'data' => [],
        ]);

        // 2. 参数验证
        if (! $imageGenerateRequest instanceof AzureOpenAIImageEditRequest) {
            $this->logger->error('Azure OpenAI图像编辑 OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response; // 返回空数据响应
        }

        try {
            // 3. 图像编辑（同步处理）
            $result = $this->generateImageRaw($imageGenerateRequest);
            $this->validateAzureOpenAIEditResponse($result);

            // 4. 转换响应格式
            $this->addImageDataToResponseAzureOpenAIEdit($response, $result, $imageGenerateRequest);

            $this->logger->info('Azure OpenAI图像编辑 OpenAI格式生图：处理完成', [
                '成功图片数' => count($response->getData()),
            ]);
        } catch (Exception $e) {
            // 设置错误信息到响应对象
            $response->setProviderErrorCode($e->getCode());
            $response->setProviderErrorMessage($e->getMessage());

            $this->logger->error('Azure OpenAI图像编辑 OpenAI格式生图：处理失败', [
                'error_code' => $e->getCode(),
                'error_message' => $e->getMessage(),
            ]);
        }

        return $response;
    }

    public function getProviderName(): string
    {
        return 'azure_openai';
    }

    public function getConfigItem(): array
    {
        return $this->configItem;
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        try {
            $result = $this->generateImageRaw($imageGenerateRequest);
            $response = $this->buildResponse($result);

            $this->logger->info('Azure OpenAI图像编辑：图像生成成功', [
                'image_count' => count($response->getData()),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：图像生成失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    private function validateRequest(AzureOpenAIImageEditRequest $request): void
    {
        if (empty($request->getPrompt())) {
            $this->logger->error('Azure OpenAI图像编辑：缺少必要参数 - prompt');
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.prompt_required');
        }

        if (empty($request->getReferenceImages())) {
            $this->logger->error('Azure OpenAI图像编辑：缺少必要参数 - reference images');
            ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.reference_images_required');
        }

        if ($request->getN() < 1 || $request->getN() > 10) {
            $this->logger->error('Azure OpenAI图像编辑：生成数量超出范围', [
                'requested' => $request->getN(),
                'valid_range' => '1-10',
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_count');
        }

        // 验证图像URL格式
        foreach ($request->getReferenceImages() as $index => $imageUrl) {
            if (empty($imageUrl) || ! filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $this->logger->error('Azure OpenAI图像编辑：无效的参考图像URL', [
                    'index' => $index,
                    'url' => $imageUrl,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_url');
            }
        }

        // 验证mask URL（如果提供）
        $maskUrl = $request->getMaskUrl();
        if (! empty($maskUrl) && ! filter_var($maskUrl, FILTER_VALIDATE_URL)) {
            $this->logger->error('Azure OpenAI图像编辑：无效的遮罩图像URL', [
                'mask_url' => $maskUrl,
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_mask_url');
        }
    }

    private function buildResponse(array $result): ImageGenerateResponse
    {
        try {
            if (! isset($result['data'])) {
                $this->logger->error('Azure OpenAI图像编辑：响应格式错误 - 缺少data字段', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, 'image_generate.response_format_error');
            }

            if (empty($result['data'])) {
                $this->logger->error('Azure OpenAI图像编辑：响应数据为空', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, 'image_generate.no_image_generated');
            }

            $images = [];
            foreach ($result['data'] as $index => $item) {
                if (! isset($item['b64_json'])) {
                    $this->logger->warning('Azure OpenAI图像编辑：跳过无效的图像数据', [
                        'index' => $index,
                        'item' => $item,
                    ]);
                    continue;
                }
                $images[] = $item['b64_json'];
            }

            if (empty($images)) {
                $this->logger->error('Azure OpenAI图像编辑：所有图像数据无效');
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.invalid_image_data');
            }

            $this->logger->info('Azure OpenAI图像编辑：成功构建响应', [
                'total_images' => count($images),
            ]);

            return new ImageGenerateResponse(ImageGenerateType::BASE_64, $images);
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：构建响应失败', [
                'error' => $e->getMessage(),
                'result' => $result,
            ]);

            if ($e instanceof BusinessException) {
                throw $e;
            }

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.response_build_failed');
        }
    }

    /**
     * 为Azure OpenAI编辑模式原始数据添加水印.
     */
    private function processAzureOpenAIEditRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! isset($rawData['data']) || ! is_array($rawData['data'])) {
            return $rawData;
        }

        foreach ($rawData['data'] as $index => &$item) {
            if (! isset($item['b64_json'])) {
                continue;
            }

            try {
                // 处理base64格式的图片
                $item['b64_json'] = $this->watermarkProcessor->addWatermarkToBase64($item['b64_json'], $imageGenerateRequest);
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('Azure OpenAI图像编辑水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }

    /**
     * 验证Azure OpenAI图像编辑API响应数据格式.
     */
    private function validateAzureOpenAIEditResponse(array $result): void
    {
        if (! isset($result['data'])) {
            throw new Exception('Azure OpenAI图像编辑响应数据格式错误：缺少data字段');
        }

        if (empty($result['data']) || ! is_array($result['data'])) {
            throw new Exception('Azure OpenAI图像编辑响应数据格式错误：data字段为空或不是数组');
        }

        $hasValidImage = false;
        foreach ($result['data'] as $item) {
            if (isset($item['b64_json']) && ! empty($item['b64_json'])) {
                $hasValidImage = true;
                break;
            }
        }

        if (! $hasValidImage) {
            throw new Exception('Azure OpenAI图像编辑响应数据格式错误：缺少有效的图像数据');
        }
    }

    /**
     * 将Azure OpenAI图像编辑结果添加到OpenAI响应对象中.
     */
    private function addImageDataToResponseAzureOpenAIEdit(
        OpenAIFormatResponse $response,
        array $azureResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        if (! isset($azureResult['data']) || ! is_array($azureResult['data'])) {
            return;
        }

        $currentData = $response->getData();
        $currentUsage = $response->getUsage() ?? new ImageUsage();

        foreach ($azureResult['data'] as $item) {
            if (! isset($item['b64_json']) || empty($item['b64_json'])) {
                continue;
            }

            // 处理水印（将base64转换为URL）
            $processedUrl = $item['b64_json'];
            try {
                $processedUrl = $this->watermarkProcessor->addWatermarkToBase64($item['b64_json'], $imageGenerateRequest);
            } catch (Exception $e) {
                $this->logger->error('Azure OpenAI图像编辑添加图片数据：水印处理失败', [
                    'error' => $e->getMessage(),
                ]);
                // 水印处理失败时使用原始base64数据
            }

            // 只返回URL格式，与其他模型保持一致
            $currentData[] = [
                'url' => $processedUrl,
            ];

            // 累计usage信息
            $currentUsage->addGeneratedImages(1);
        }

        // 如果Azure OpenAI响应包含usage信息，则使用它
        if (! empty($azureResult['usage']) && is_array($azureResult['usage'])) {
            $usage = $azureResult['usage'];
            $currentUsage->promptTokens += $usage['input_tokens'] ?? 0;
            $currentUsage->completionTokens += $usage['output_tokens'] ?? 0;
            $currentUsage->totalTokens += $usage['total_tokens'] ?? 0;
        }

        // 更新响应对象
        $response->setData($currentData);
        $response->setUsage($currentUsage);
    }
}
