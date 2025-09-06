<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\GPT4oModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
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

    public function __construct(ProviderConfigItem $serviceProviderConfig)
    {
        $this->api = new GPTAPI($serviceProviderConfig->getApiKey());
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

        if ($this->isWatermark($imageGenerateRequest)) {
            return $rawData;
        }

        return $this->processGPT4oRawDataWithWatermark($rawData, $imageGenerateRequest);
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
}
