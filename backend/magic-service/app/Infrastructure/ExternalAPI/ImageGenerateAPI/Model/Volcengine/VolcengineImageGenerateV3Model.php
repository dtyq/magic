<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\VolcengineModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use Exception;
use Hyperf\Codec\Json;

class VolcengineImageGenerateV3Model extends AbstractImageGenerate
{
    // 最大轮询重试次数
    private const MAX_RETRY_COUNT = 30;

    // 轮询重试间隔（秒）
    private const RETRY_INTERVAL = 2;

    private VolcengineAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $this->api = new VolcengineAPI($serviceProviderConfig['ak'], $serviceProviderConfig['sk']);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        return $this->generateImageRawInternal($imageGenerateRequest);
    }

    public function setAK(string $ak)
    {
        $this->api->setAk($ak);
    }

    public function setSK(string $sk)
    {
        $this->api->setSk($sk);
    }

    public function setApiKey(string $apiKey)
    {
        // TODO: Implement setApiKey() method.
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);

        return $this->processVolcengineV3RawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - V3版本.
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
        if (! $imageGenerateRequest instanceof VolcengineModelRequest) {
            $this->logger->error('VolcengineV3 OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response; // 返回空数据响应
        }

        // 3. 同步处理图片生成
        $count = $imageGenerateRequest->getGenerateNum();

        for ($i = 0; $i < $count; ++$i) {
            try {
                // 提交任务并轮询结果
                $taskId = $this->submitAsyncTask($imageGenerateRequest);
                $result = $this->pollTaskResult($taskId, $imageGenerateRequest);

                $this->validateVolcengineV3Response($result);

                // 成功：设置图片数据到响应对象
                $this->addImageDataToResponseV3($response, $result, $imageGenerateRequest);
            } catch (Exception $e) {
                // 失败：设置错误信息到响应对象（只设置第一个错误）
                if (! $response->hasError()) {
                    $response->setProviderErrorCode($e->getCode());
                    $response->setProviderErrorMessage($e->getMessage());
                }

                $this->logger->error('VolcengineV3 OpenAI格式生图：单个请求失败', [
                    'error_code' => $e->getCode(),
                    'error_message' => $e->getMessage(),
                    'index' => $i,
                ]);
            }
        }

        // 4. 记录最终结果
        $this->logger->info('VolcengineV3 OpenAI格式生图：处理完成', [
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
        return 'volcengine';
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $rawResults = $this->generateImageRawInternal($imageGenerateRequest);

        // 从原生结果中提取图片URL
        $imageUrls = [];
        foreach ($rawResults as $index => $result) {
            $data = $result['data'];
            if (! empty($data['binary_data_base64'])) {
                $imageUrls[$index] = $data['binary_data_base64'][0];
            } elseif (! empty($data['image_urls'])) {
                $imageUrls[$index] = $data['image_urls'][0];
            }
        }

        // 按索引排序结果
        ksort($imageUrls);
        $imageUrls = array_values($imageUrls);

        $this->logger->info('火山文生图：生成结束', [
            '生成图片' => $imageUrls,
            '图片数量' => count($rawResults),
        ]);

        return new ImageGenerateResponse(ImageGenerateType::URL, $imageUrls);
    }

    /**
     * 生成图像的核心逻辑，返回原生结果.
     */
    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof VolcengineModelRequest) {
            $this->logger->error('火山文生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // 判断是图生图还是文生图
        $count = $imageGenerateRequest->getGenerateNum();

        $this->logger->info('火山文生图：开始生图', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'negativePrompt' => $imageGenerateRequest->getNegativePrompt(),
            'width' => $imageGenerateRequest->getWidth(),
            'height' => $imageGenerateRequest->getHeight(),
            'req_key' => $imageGenerateRequest->getModel(),
        ]);

        // 使用同步方式处理
        $rawResults = [];
        $errors = [];

        for ($i = 0; $i < $count; ++$i) {
            try {
                // 提交任务（带重试）
                $taskId = $this->submitAsyncTask($imageGenerateRequest);
                // 轮询结果（带重试）
                $result = $this->pollTaskResult($taskId, $imageGenerateRequest);

                $rawResults[] = [
                    'success' => true,
                    'data' => $result['data'],
                    'index' => $i,
                ];
            } catch (Exception $e) {
                $this->logger->error('火山文生图：失败', [
                    'error' => $e->getMessage(),
                    'index' => $i,
                ]);
                $errors[] = [
                    'code' => $e->getCode(),
                    'message' => $e->getMessage(),
                ];
            }
        }

        if (empty($rawResults)) {
            // 优先使用具体的错误码，如果都是通用错误则使用 NO_VALID_IMAGE
            $finalErrorCode = ImageGenerateErrorCode::NO_VALID_IMAGE;
            $finalErrorMsg = '';

            foreach ($errors as $error) {
                if ($error['code'] !== ImageGenerateErrorCode::GENERAL_ERROR->value) {
                    $finalErrorCode = ImageGenerateErrorCode::from($error['code']);
                    $finalErrorMsg = $error['message'];
                    break;
                }
            }

            // 如果没有找到具体错误消息，使用第一个错误消息
            if (empty($finalErrorMsg) && ! empty($errors[0]['message'])) {
                $finalErrorMsg = $errors[0]['message'];
            }

            $this->logger->error('火山文生图：所有图片生成均失败', ['errors' => $errors]);
            ExceptionBuilder::throw($finalErrorCode, $finalErrorMsg);
        }

        // 按索引排序结果
        ksort($rawResults);
        return array_values($rawResults);
    }

    private function submitAsyncTask(VolcengineModelRequest $request): string
    {
        $prompt = $request->getPrompt();
        $width = (int) $request->getWidth();
        $height = (int) $request->getHeight();

        try {
            $body = [
                'return_url' => true,
                'prompt' => $prompt,
                'width' => $width,
                'height' => $height,
                'req_key' => $request->getModel(),
            ];

            $response = $this->api->submitTask($body);

            if (! isset($response['code'])) {
                $this->logger->warning('火山文生图：响应格式错误', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
            }

            if ($response['code'] !== 10000) {
                $errorMsg = $response['message'] ?? '';
                $errorCode = match ($response['code']) {
                    50411 => ImageGenerateErrorCode::INPUT_IMAGE_AUDIT_FAILED,
                    50511 => ImageGenerateErrorCode::OUTPUT_IMAGE_AUDIT_FAILED_WITH_REASON,
                    50412, 50413 => ImageGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED,
                    default => ImageGenerateErrorCode::GENERAL_ERROR,
                };

                $this->logger->warning('火山文生图：任务提交失败', [
                    'code' => $response['code'],
                    'message' => $response['message'] ?? '',
                ]);

                ExceptionBuilder::throw($errorCode, $errorMsg);
            }

            if (! isset($response['data']['task_id'])) {
                $this->logger->warning('火山文生图：响应中缺少任务ID', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
            }

            $taskId = $response['data']['task_id'];

            $this->logger->info('火山文生图：提交任务成功', [
                'taskId' => $taskId,
            ]);

            return $taskId;
        } catch (Exception $e) {
            $this->logger->error('火山文生图：任务提交异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    private function pollTaskResult(string $taskId, VolcengineModelRequest $imageGenerateRequest): array
    {
        $reqKey = $imageGenerateRequest->getModel();
        $retryCount = 0;

        $reqJson = ['return_url' => true];

        $reqJsonString = Json::encode($reqJson);

        while ($retryCount < self::MAX_RETRY_COUNT) {
            try {
                $params = [
                    'task_id' => $taskId,
                    'req_key' => $reqKey,
                    'req_json' => $reqJsonString,
                ];

                $response = $this->api->getTaskResult($params);

                if (! isset($response['code'])) {
                    $this->logger->warning('火山文生图：查询任务响应格式错误', ['response' => $response]);
                    ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
                }

                if ($response['code'] !== 10000) {
                    $errorMsg = $response['message'] ?? '';
                    $errorCode = match ($response['code']) {
                        50411 => ImageGenerateErrorCode::INPUT_IMAGE_AUDIT_FAILED,
                        50511 => ImageGenerateErrorCode::OUTPUT_IMAGE_AUDIT_FAILED_WITH_REASON,
                        50412, 50413 => ImageGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED,
                        50512 => ImageGenerateErrorCode::OUTPUT_TEXT_AUDIT_FAILED,
                        default => ImageGenerateErrorCode::GENERAL_ERROR,
                    };

                    $this->logger->warning('火山文生图：查询任务失败', [
                        'code' => $response['code'],
                        'message' => $response['message'] ?? '',
                    ]);

                    ExceptionBuilder::throw($errorCode, $errorMsg);
                }

                if (! isset($response['data']) || ! isset($response['data']['status'])) {
                    $this->logger->warning('火山文生图：响应格式错误', ['response' => $response]);
                    ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
                }

                $data = $response['data'];
                $status = $data['status'];

                $this->logger->info('火山文生图：任务状态', [
                    'taskId' => $taskId,
                    'status' => $status,
                ]);

                switch ($status) {
                    case 'done':
                        if (! empty($data['binary_data_base64']) || ! empty($data['image_urls'])) {
                            return $response;
                        }
                        $this->logger->error('火山文生图：任务完成但缺少图片数据', ['response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
                        // no break
                    case 'in_queue':
                    case 'generating':
                        break;
                    case 'not_found':
                        $this->logger->error('火山文生图：任务未找到或已过期', ['taskId' => $taskId]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT_WITH_REASON);
                        // no break
                    default:
                        $this->logger->error('火山文生图：未知的任务状态', ['status' => $status, 'response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT_WITH_REASON);
                }

                ++$retryCount;
                sleep(self::RETRY_INTERVAL);
            } catch (Exception $e) {
                $this->logger->error('火山文生图：查询任务异常', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'taskId' => $taskId,
                ]);

                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
            }
        }

        $this->logger->error('火山文生图：任务查询超时', ['taskId' => $taskId]);
        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT);
    }

    /**
     * 验证火山引擎V3 API响应数据格式.
     */
    private function validateVolcengineV3Response(array $result): void
    {
        if (empty($result['data']) || ! is_array($result['data'])) {
            throw new Exception('火山引擎V3响应数据格式错误：缺少data字段');
        }

        $data = $result['data'];
        // 优先检查 image_urls，然后检查 binary_data_base64
        $hasValidImageData = (! empty($data['image_urls']) && ! empty($data['image_urls'][0]))
                            || (! empty($data['binary_data_base64']) && ! empty($data['binary_data_base64'][0]));

        if (! $hasValidImageData) {
            throw new Exception('火山引擎V3响应数据格式错误：缺少图片数据');
        }
    }

    /**
     * 将火山引擎V3图片数据添加到OpenAI响应对象中.
     */
    private function addImageDataToResponseV3(
        OpenAIFormatResponse $response,
        array $volcengineResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        // 使用锁确保并发安全（虽然V3使用同步，但保持一致性）
        $lockOwner = $this->lockResponse($response);
        try {
            // 从火山引擎V3响应中提取数据
            if (empty($volcengineResult['data']) || ! is_array($volcengineResult['data'])) {
                return;
            }

            $data = $volcengineResult['data'];
            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();

            // 优先处理 URL 格式图片，参考现有逻辑只取第一个图片
            if (! empty($data['image_urls']) && ! empty($data['image_urls'][0])) {
                $imageUrl = $data['image_urls'][0];
                try {
                    // 处理水印
                    $processedUrl = $this->watermarkProcessor->addWatermarkToUrl($imageUrl, $imageGenerateRequest);
                    $currentData[] = [
                        'url' => $processedUrl,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('VolcengineV3添加图片数据：URL水印处理失败', [
                        'error' => $e->getMessage(),
                        'url' => $imageUrl,
                    ]);
                    // 水印处理失败时使用原始URL
                    $currentData[] = [
                        'url' => $imageUrl,
                    ];
                }
            } elseif (! empty($data['binary_data_base64']) && ! empty($data['binary_data_base64'][0])) {
                // 备选：处理 base64 格式图片，只取第一个图片
                $base64Image = $data['binary_data_base64'][0];
                try {
                    // 处理水印
                    $processedImage = $this->watermarkProcessor->addWatermarkToBase64($base64Image, $imageGenerateRequest);
                    $currentData[] = [
                        'b64_json' => $processedImage,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('VolcengineV3添加图片数据：base64水印处理失败', [
                        'error' => $e->getMessage(),
                    ]);
                    // 水印处理失败时使用原始数据
                    $currentData[] = [
                        'b64_json' => $base64Image,
                    ];
                }
            }

            // 累计usage信息（如果有的话）
            if (! empty($volcengineResult['usage']) && is_array($volcengineResult['usage'])) {
                $currentUsage->addGeneratedImages($volcengineResult['usage']['generated_images'] ?? 1);
                $currentUsage->completionTokens += $volcengineResult['usage']['output_tokens'] ?? 0;
                $currentUsage->totalTokens += $volcengineResult['usage']['total_tokens'] ?? 0;
            } else {
                // 如果没有usage信息，默认增加1张图片
                $currentUsage->addGeneratedImages(1);
            }

            // 更新响应对象
            $response->setData($currentData);
            $response->setUsage($currentUsage);
        } finally {
            // 确保锁一定会被释放
            $this->unlockResponse($response, $lockOwner);
        }
    }

    /**
     * 为火山引擎V3原始数据添加水印.
     */
    private function processVolcengineV3RawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['data'])) {
                continue;
            }

            $data = &$result['data'];

            try {
                // 处理 base64 格式图片
                if (! empty($data['binary_data_base64'])) {
                    foreach ($data['binary_data_base64'] as $i => &$base64Image) {
                        $base64Image = $this->watermarkProcessor->addWatermarkToBase64($base64Image, $imageGenerateRequest);
                    }
                    unset($base64Image);
                }

                // 处理 URL 格式图片
                if (! empty($data['image_urls'])) {
                    foreach ($data['image_urls'] as $i => &$imageUrl) {
                        $imageUrl = $this->watermarkProcessor->addWatermarkToUrl($imageUrl, $imageGenerateRequest);
                    }
                    unset($imageUrl);
                }
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('火山引擎V3图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }
}
