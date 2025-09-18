<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\GPT4oModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\Context\CoContext;
use Exception;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Hyperf\RateLimit\Annotation\RateLimit;
use Hyperf\Retry\Annotation\Retry;

class GPT4oModel extends AbstractImageGenerate
{
    // 最大轮询次数
    private const MAX_POLL_ATTEMPTS = 60;

    // 轮询间隔（秒）
    private const POLL_INTERVAL = 5;

    protected GPTAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $this->api = new GPTAPI($serviceProviderConfig['api_key']);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        return $this->generateImageRawInternal($imageGenerateRequest);
    }

    public function setAK(string $ak)
    {
        // TODO: Implement setAK() method.
    }

    public function setSK(string $sk)
    {
        // TODO: Implement setSK() method.
    }

    public function setApiKey(string $apiKey)
    {
        $this->api->setApiKey($apiKey);
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);

        return $this->processGPT4oRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - GPT4o版本.
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
        if (! $imageGenerateRequest instanceof GPT4oModelRequest) {
            $this->logger->error('GPT4o OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
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
                    $jobId = $this->requestImageGeneration($imageGenerateRequest);
                    $result = $this->pollTaskResultForRaw($jobId);

                    $this->validateGPT4oResponse($result);

                    // 成功：设置图片数据到响应对象
                    $this->addImageDataToResponseGPT4o($response, $result, $imageGenerateRequest);
                } catch (Exception $e) {
                    // 失败：设置错误信息到响应对象（只设置第一个错误）
                    if (! $response->hasError()) {
                        $response->setProviderErrorCode($e->getCode());
                        $response->setProviderErrorMessage($e->getMessage());
                    }

                    $this->logger->error('GPT4o OpenAI格式生图：单个请求失败', [
                        'error_code' => $e->getCode(),
                        'error_message' => $e->getMessage(),
                    ]);
                }
            });
        }

        $parallel->wait();

        // 4. 记录最终结果
        $this->logger->info('GPT4o OpenAI格式生图：并发处理完成', [
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
        return 'gpt-image';
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $rawResults = $this->generateImageRawInternal($imageGenerateRequest);

        // 从原生结果中提取图片URL
        $imageUrls = [];
        foreach ($rawResults as $index => $result) {
            if (! empty($result['imageUrl'])) {
                $imageUrls[$index] = $result['imageUrl'];
            }
        }

        // 检查是否至少有一张图片生成成功
        if (empty($imageUrls)) {
            $this->logger->error('GPT4o文生图：所有图片生成均失败', ['rawResults' => $rawResults]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE);
        }

        // 按索引排序结果
        ksort($imageUrls);
        $imageUrls = array_values($imageUrls);

        $this->logger->info('GPT4o文生图：生成结束', [
            'totalImages' => count($imageUrls),
            'requestedImages' => $imageGenerateRequest->getGenerateNum(),
        ]);

        return new ImageGenerateResponse(ImageGenerateType::URL, $imageUrls);
    }

    protected function getAlertPrefix(): string
    {
        return 'GPT4o API';
    }

    protected function checkBalance(): float
    {
        try {
            $result = $this->api->getAccountInfo();

            if ($result['status'] !== 'SUCCESS') {
                throw new Exception('检查余额失败: ' . ($result['message'] ?? '未知错误'));
            }

            return (float) $result['data']['balance'];
        } catch (Exception $e) {
            throw new Exception('检查余额失败: ' . $e->getMessage());
        }
    }

    /**
     * 请求生成图片并返回任务ID.
     */
    #[RateLimit(create: 20, consume: 1, capacity: 0, key: self::IMAGE_GENERATE_KEY_PREFIX . self::IMAGE_GENERATE_SUBMIT_KEY_PREFIX . ImageGenerateModelType::TTAPIGPT4o->value, waitTimeout: 60)]
    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    protected function requestImageGeneration(GPT4oModelRequest $imageGenerateRequest): string
    {
        $prompt = $imageGenerateRequest->getPrompt();
        $referImages = $imageGenerateRequest->getReferImages();

        // 记录请求开始
        $this->logger->info('GPT4o文生图：开始生图', [
            'prompt' => $prompt,
            'referImages' => $referImages,
        ]);

        try {
            $result = $this->api->submitGPT4oTask($prompt, $referImages);

            if ($result['status'] !== 'SUCCESS') {
                $this->logger->warning('GPT4o文生图：生成请求失败', ['message' => $result['message'] ?? '未知错误']);
                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $result['message']);
            }

            if (empty($result['data']['jobId'])) {
                $this->logger->error('GPT4o文生图：缺少任务ID', ['response' => $result]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
            }
            $taskId = $result['data']['jobId'];
            $this->logger->info('GPT4o文生图：提交任务成功', [
                'taskId' => $taskId,
            ]);
            return $taskId;
        } catch (Exception $e) {
            $this->logger->warning('GPT4o文生图：调用图片生成接口失败', ['error' => $e->getMessage()]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    /**
     * 轮询任务结果.
     * @throws Exception
     */
    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    protected function pollTaskResult(string $jobId): array
    {
        $attempts = 0;
        while ($attempts < self::MAX_POLL_ATTEMPTS) {
            try {
                $result = $this->api->getGPT4oTaskResult($jobId);

                if ($result['status'] === 'FAILED') {
                    throw new Exception($result['message'] ?? '任务执行失败');
                }

                if ($result['status'] === 'SUCCESS' && ! empty($result['data']['imageUrl'])) {
                    return $result['data'];
                }

                // 如果任务还在进行中，等待后继续轮询
                if ($result['status'] === 'ON_QUEUE') {
                    $this->logger->info('GPT4o文生图：任务处理中', [
                        'jobId' => $jobId,
                        'attempt' => $attempts + 1,
                    ]);
                    sleep(self::POLL_INTERVAL);
                    ++$attempts;
                    continue;
                }

                throw new Exception('未知的任务状态：' . $result['status']);
            } catch (Exception $e) {
                $this->logger->error('GPT4o文生图：轮询任务失败', [
                    'jobId' => $jobId,
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
        }

        throw new Exception('任务轮询超时');
    }

    /**
     * 轮询任务结果，返回原生数据格式.
     */
    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    protected function pollTaskResultForRaw(string $jobId): array
    {
        $attempts = 0;
        while ($attempts < self::MAX_POLL_ATTEMPTS) {
            try {
                $result = $this->api->getGPT4oTaskResult($jobId);

                if ($result['status'] === 'FAILED') {
                    throw new Exception($result['message'] ?? '任务执行失败');
                }

                if ($result['status'] === 'SUCCESS' && ! empty($result['data']['imageUrl'])) {
                    return $result['data'];
                }

                // 如果任务还在进行中，等待后继续轮询
                if ($result['status'] === 'ON_QUEUE') {
                    $this->logger->info('GPT4o文生图：任务处理中', [
                        'jobId' => $jobId,
                        'attempt' => $attempts + 1,
                    ]);
                    sleep(self::POLL_INTERVAL);
                    ++$attempts;
                    continue;
                }

                throw new Exception('未知的任务状态：' . $result['status']);
            } catch (Exception $e) {
                $this->logger->error('GPT4o文生图：轮询任务失败', [
                    'jobId' => $jobId,
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
        }

        throw new Exception('任务轮询超时');
    }

    /**
     * 生成图像的核心逻辑，返回原生结果.
     */
    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof GPT4oModelRequest) {
            $this->logger->error('GPT4o文生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $count = $imageGenerateRequest->getGenerateNum();
        $rawResults = [];
        $errors = [];

        // 使用 Parallel 并行处理
        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();
        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $i, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    $jobId = $this->requestImageGeneration($imageGenerateRequest);
                    $result = $this->pollTaskResultForRaw($jobId);
                    return [
                        'success' => true,
                        'data' => $result,
                        'index' => $i,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('GPT4o文生图：图片生成失败', [
                        'error' => $e->getMessage(),
                        'index' => $i,
                    ]);
                    return [
                        'success' => false,
                        'error' => $e->getMessage(),
                        'index' => $i,
                    ];
                }
            });
        }

        // 获取所有并行任务的结果
        $results = $parallel->wait();

        // 处理结果，保持原生格式
        foreach ($results as $result) {
            if ($result['success']) {
                $rawResults[$result['index']] = $result['data'];
            } else {
                $errors[] = $result['error'] ?? '未知错误';
            }
        }

        // 检查是否至少有一张图片生成成功
        if (empty($rawResults)) {
            $errorMessage = implode('; ', $errors);
            $this->logger->error('GPT4o文生图：所有图片生成均失败', ['errors' => $errors]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, $errorMessage);
        }

        // 按索引排序结果
        ksort($rawResults);
        return array_values($rawResults);
    }

    /**
     * 为GPT4o原始数据添加水印.
     */
    private function processGPT4oRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['imageUrl'])) {
                continue;
            }

            try {
                // 处理图片URL
                $result['imageUrl'] = $this->watermarkProcessor->addWatermarkToUrl($result['imageUrl'], $imageGenerateRequest);
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('GPT4o图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }

    /**
     * 验证GPT4o API轮询响应数据格式.
     */
    private function validateGPT4oResponse(array $result): void
    {
        if (empty($result['imageUrl'])) {
            throw new Exception('GPT4o响应数据格式错误：缺少imageUrl字段');
        }
    }

    /**
     * 将GPT4o图片数据添加到OpenAI响应对象中.
     */
    private function addImageDataToResponseGPT4o(
        OpenAIFormatResponse $response,
        array $gpt4oResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        // 使用Redis锁确保并发安全
        $lockOwner = $this->lockResponse($response);
        try {
            // 从GPT4o轮询结果中提取图片URL
            if (empty($gpt4oResult['imageUrl'])) {
                return;
            }

            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();

            $imageUrl = $gpt4oResult['imageUrl'];

            // 处理水印
            $processedUrl = $imageUrl;
            try {
                $processedUrl = $this->watermarkProcessor->addWatermarkToUrl($imageUrl, $imageGenerateRequest);
            } catch (Exception $e) {
                $this->logger->error('GPT4o添加图片数据：水印处理失败', [
                    'error' => $e->getMessage(),
                    'url' => $imageUrl,
                ]);
                // 水印处理失败时使用原始URL
            }

            $currentData[] = [
                'url' => $processedUrl,
            ];

            // 累计usage信息 - GPT4o没有详细的token统计
            $currentUsage->addGeneratedImages(1);

            // 更新响应对象
            $response->setData($currentData);
            $response->setUsage($currentUsage);
        } finally {
            // 确保锁一定会被释放
            $this->unlockResponse($response, $lockOwner);
        }
    }
}
