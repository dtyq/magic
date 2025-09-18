<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
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

class QwenImageModel extends AbstractImageGenerate
{
    // 最大轮询重试次数
    private const MAX_RETRY_COUNT = 30;

    // 轮询重试间隔（秒）
    private const RETRY_INTERVAL = 2;

    private QwenImageAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $apiKey = $serviceProviderConfig['api_key'];
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

        return $this->processQwenRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - Qwen版本.
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
        if (! $imageGenerateRequest instanceof QwenImageModelRequest) {
            $this->logger->error('Qwen OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response; // 返回空数据响应
        }

        // 3. 并发处理 - 直接操作响应对象
        $count = $imageGenerateRequest->getGenerateNum();
        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();

        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $response, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    // 提交任务并轮询结果
                    $taskId = $this->submitAsyncTask($imageGenerateRequest);
                    $result = $this->pollTaskResult($taskId, $imageGenerateRequest);

                    $this->validateQwenResponse($result);

                    // 成功：设置图片数据到响应对象
                    $this->addImageDataToResponseQwen($response, $result, $imageGenerateRequest);
                } catch (Exception $e) {
                    // 失败：设置错误信息到响应对象（只设置第一个错误）
                    if (! $response->hasError()) {
                        $response->setProviderErrorCode($e->getCode());
                        $response->setProviderErrorMessage($e->getMessage());
                    }

                    $this->logger->error('Qwen OpenAI格式生图：单个请求失败', [
                        'error_code' => $e->getCode(),
                        'error_message' => $e->getMessage(),
                    ]);
                }
            });
        }

        $parallel->wait();

        // 4. 记录最终结果
        $this->logger->info('Qwen OpenAI格式生图：并发处理完成', [
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

        // 从原生结果中提取图片URL
        $imageUrls = [];
        foreach ($rawResults as $index => $result) {
            $output = $result['output'];
            if (! empty($output['results'])) {
                foreach ($output['results'] as $resultItem) {
                    if (! empty($resultItem['url'])) {
                        $imageUrls[$index] = $resultItem['url'];
                        break; // 只取第一个图片URL
                    }
                }
            }
        }

        return new ImageGenerateResponse(ImageGenerateType::URL, $imageUrls);
    }

    /**
     * 生成图像的核心逻辑，返回原生结果.
     */
    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof QwenImageModelRequest) {
            $this->logger->error('通义千问文生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // 其他文生图是 x ，阿里是 * ，保持上游一致，最终传入还是 *
        $size = $imageGenerateRequest->getWidth() . 'x' . $imageGenerateRequest->getHeight();

        // 校验图片尺寸
        $this->validateImageSize($size, $imageGenerateRequest->getModel());

        $count = $imageGenerateRequest->getGenerateNum();

        $this->logger->info('通义千问文生图：开始生图', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $size,
            'count' => $count,
        ]);

        // 使用 Parallel 并行处理
        $parallel = new Parallel();
        for ($i = 0; $i < $count; ++$i) {
            $fromCoroutineId = Coroutine::id();
            $parallel->add(function () use ($imageGenerateRequest, $i, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    // 提交任务（带重试）
                    $taskId = $this->submitAsyncTask($imageGenerateRequest);
                    // 轮询结果（带重试）
                    $result = $this->pollTaskResult($taskId, $imageGenerateRequest);

                    return [
                        'success' => true,
                        'output' => $result['output'],
                        'index' => $i,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('通义千问文生图：失败', [
                        'error' => $e->getMessage(),
                        'index' => $i,
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

        // 获取所有并行任务的结果
        $results = $parallel->wait();
        $rawResults = [];
        $errors = [];

        // 处理结果，保持原生格式
        foreach ($results as $result) {
            if ($result['success']) {
                $rawResults[$result['index']] = $result;
            } else {
                $errors[] = [
                    'code' => $result['error_code'] ?? ImageGenerateErrorCode::GENERAL_ERROR->value,
                    'message' => $result['error_msg'] ?? '',
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

            $this->logger->error('通义千问文生图：所有图片生成均失败', ['errors' => $errors]);
            ExceptionBuilder::throw($finalErrorCode, $finalErrorMsg);
        }

        // 按索引排序结果
        ksort($rawResults);
        $rawResults = array_values($rawResults);

        $this->logger->info('通义千问文生图：生成结束', [
            '图片数量' => $count,
        ]);

        return $rawResults;
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    #[RateLimit(create: 4, consume: 1, capacity: 0, key: self::IMAGE_GENERATE_KEY_PREFIX . self::IMAGE_GENERATE_SUBMIT_KEY_PREFIX . ImageGenerateModelType::QwenImage->value, waitTimeout: 60)]
    private function submitAsyncTask(QwenImageModelRequest $request): string
    {
        $prompt = $request->getPrompt();

        try {
            $params = [
                'prompt' => $prompt,
                'size' => $request->getWidth() . '*' . $request->getHeight(),
                'n' => 1, // 通义千问每次只能生成1张图片
                'model' => $request->getModel(),
                'watermark' => false, // 关闭API水印，使用统一PHP水印
                'prompt_extend' => $request->isPromptExtend(),
            ];

            $response = $this->api->submitTask($params);

            // 检查响应格式
            if (! isset($response['output']['task_id'])) {
                $errorMsg = $response['message'] ?? '未知错误';
                $this->logger->warning('通义千问文生图：响应中缺少任务ID', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, $errorMsg);
            }

            $taskId = $response['output']['task_id'];

            $this->logger->info('通义千问文生图：提交任务成功', [
                'taskId' => $taskId,
            ]);

            return $taskId;
        } catch (Exception $e) {
            $this->logger->error('通义千问文生图：任务提交异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    #[RateLimit(create: 18, consume: 1, capacity: 0, key: self::IMAGE_GENERATE_KEY_PREFIX . self::IMAGE_GENERATE_POLL_KEY_PREFIX . ImageGenerateModelType::QwenImage->value, waitTimeout: 60)]
    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    private function pollTaskResult(string $taskId, QwenImageModelRequest $imageGenerateRequest): array
    {
        $retryCount = 0;

        while ($retryCount < self::MAX_RETRY_COUNT) {
            try {
                $response = $this->api->getTaskResult($taskId);

                // 检查响应格式
                if (! isset($response['output'])) {
                    $this->logger->warning('通义千问文生图：查询任务响应格式错误', ['response' => $response]);
                    ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
                }

                $output = $response['output'];
                $taskStatus = $output['task_status'] ?? '';

                $this->logger->info('通义千问文生图：任务状态', [
                    'taskId' => $taskId,
                    'status' => $taskStatus,
                ]);

                switch ($taskStatus) {
                    case 'SUCCEEDED':
                        if (! empty($output['results'])) {
                            return $response;
                        }
                        $this->logger->error('通义千问文生图：任务完成但缺少图片数据', ['response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
                        // no break
                    case 'PENDING':
                    case 'RUNNING':
                        break;
                    case 'FAILED':
                        $errorMsg = $output['message'] ?? '任务执行失败';
                        $this->logger->error('通义千问文生图：任务执行失败', ['taskId' => $taskId, 'error' => $errorMsg]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $errorMsg);
                        // no break
                    default:
                        $this->logger->error('通义千问文生图：未知的任务状态', ['status' => $taskStatus, 'response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT_WITH_REASON);
                }

                ++$retryCount;
                sleep(self::RETRY_INTERVAL);
            } catch (Exception $e) {
                $this->logger->error('通义千问文生图：查询任务异常', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'taskId' => $taskId,
                ]);

                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
            }
        }

        $this->logger->error('通义千问文生图：任务查询超时', ['taskId' => $taskId]);
        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT);
    }

    /**
     * 校验图片尺寸是否符合通义千问模型的规格
     */
    private function validateImageSize(string $size, string $model): void
    {
        switch ($model) {
            case 'qwen-image':
                $this->validateQwenImageSize($size);
                break;
            case 'wan2.2-t2i-flash':
                $this->validateWan22FlashSize($size);
                break;
            default:
                // 其他模型暂不校验
                break;
        }
    }

    /**
     * 校验qwen-image模型的固定尺寸列表.
     */
    private function validateQwenImageSize(string $size): void
    {
        // qwen-image支持的固定尺寸列表
        $supportedSizes = [
            '1664x928',   // 16:9
            '1472x1140',  // 4:3
            '1328x1328',  // 1:1 (默认)
            '1140x1472',  // 3:4
            '928x1664',   // 9:16
        ];

        if (! in_array($size, $supportedSizes, true)) {
            $this->logger->error('通义千问文生图：qwen-image不支持的图片尺寸', [
                'requested_size' => $size,
                'supported_sizes' => $supportedSizes,
                'model' => 'qwen-image',
            ]);

            ExceptionBuilder::throw(
                ImageGenerateErrorCode::UNSUPPORTED_IMAGE_SIZE,
                'image_generate.unsupported_image_size',
                [
                    'size' => $size,
                    'supported_sizes' => implode('、', $supportedSizes),
                ]
            );
        }
    }

    /**
     * 校验wan2.2-t2i-flash模型的区间尺寸.
     */
    private function validateWan22FlashSize(string $size): void
    {
        $dimensions = explode('x', $size);
        if (count($dimensions) !== 2) {
            $this->logger->error('通义千问文生图：wan2.2-t2i-flash尺寸格式错误', [
                'requested_size' => $size,
                'model' => 'wan2.2-t2i-flash',
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_size_format');
        }

        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];

        // wan2.2-t2i-flash支持512-1440像素区间
        $minSize = 512;
        $maxSize = 1440;

        if ($width < $minSize || $width > $maxSize || $height < $minSize || $height > $maxSize) {
            $this->logger->error('通义千问文生图：wan2.2-t2i-flash尺寸超出支持范围', [
                'requested_size' => $size,
                'width' => $width,
                'height' => $height,
                'min_size' => $minSize,
                'max_size' => $maxSize,
                'model' => 'wan2.2-t2i-flash',
            ]);

            ExceptionBuilder::throw(
                ImageGenerateErrorCode::UNSUPPORTED_IMAGE_SIZE_RANGE,
                'image_generate.unsupported_image_size_range',
                [
                    'size' => $size,
                    'min_size' => $minSize,
                    'max_size' => $maxSize,
                ]
            );
        }
    }

    /**
     * 为通义千问原始数据添加水印.
     */
    private function processQwenRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['output']['results'])) {
                continue;
            }

            try {
                // 处理 results 数组中的图片URL
                foreach ($result['output']['results'] as $i => &$resultItem) {
                    if (! empty($resultItem['url'])) {
                        $resultItem['url'] = $this->watermarkProcessor->addWatermarkToUrl($resultItem['url'], $imageGenerateRequest);
                    }
                }
                unset($resultItem);
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('通义千问图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }

    /**
     * 验证通义千问API响应数据格式.
     */
    private function validateQwenResponse(array $result): void
    {
        if (empty($result['output']) || ! is_array($result['output'])) {
            throw new Exception('通义千问响应数据格式错误：缺少output字段');
        }

        $output = $result['output'];
        if (empty($output['results']) || ! is_array($output['results'])) {
            throw new Exception('通义千问响应数据格式错误：缺少results字段');
        }

        // 检查第一个结果是否有URL
        if (empty($output['results'][0]['url'])) {
            throw new Exception('通义千问响应数据格式错误：缺少图片URL');
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
        // 使用Redis锁确保并发安全
        $lockOwner = $this->lockResponse($response);
        try {
            // 从通义千问响应中提取数据
            if (empty($qwenResult['output']['results']) || ! is_array($qwenResult['output']['results'])) {
                return;
            }

            $results = $qwenResult['output']['results'];
            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();

            // 处理 results 数组中的第一个图片URL
            foreach ($results as $resultItem) {
                if (! empty($resultItem['url'])) {
                    try {
                        // 处理水印
                        $processedUrl = $this->watermarkProcessor->addWatermarkToUrl($resultItem['url'], $imageGenerateRequest);
                        $currentData[] = [
                            'url' => $processedUrl,
                        ];
                    } catch (Exception $e) {
                        $this->logger->error('Qwen添加图片数据：URL水印处理失败', [
                            'error' => $e->getMessage(),
                            'url' => $resultItem['url'],
                        ]);
                        // 水印处理失败时使用原始URL
                        $currentData[] = [
                            'url' => $resultItem['url'],
                        ];
                    }
                    break; // 只取第一个图片
                }
            }

            // 累计usage信息
            if (! empty($qwenResult['usage']) && is_array($qwenResult['usage'])) {
                $currentUsage->addGeneratedImages($qwenResult['usage']['image_count'] ?? 1);
            // 通义千问没有token信息，保持默认值
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
}
