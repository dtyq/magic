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
use App\Infrastructure\Util\Context\CoContext;
use Exception;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Hyperf\RateLimit\Annotation\RateLimit;
use Hyperf\Retry\Annotation\Retry;

class QwenImageEditModel extends AbstractImageGenerate
{
    // 最大轮询重试次数
    private const MAX_RETRY_COUNT = 30;

    // 轮询重试间隔（秒）
    private const RETRY_INTERVAL = 2;

    private QwenImageAPI $api;

    public function __construct(ProviderConfigItem $serviceProviderConfig)
    {
        $apiKey = $serviceProviderConfig->getApiKey();
        if (empty($apiKey)) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, '通义千问API Key不能为空');
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
        if (! $imageGenerateRequest instanceof QwenImageEditRequest) {
            $this->logger->error('通义千问图像编辑：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // 校验必要参数
        $this->validateEditRequest($imageGenerateRequest);

        $count = $imageGenerateRequest->getGenerateNum();

        $this->logger->info('通义千问图像编辑：开始编辑', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'edit_type' => $imageGenerateRequest->getEditType(),
            'image_count' => count($imageGenerateRequest->getImageUrls()),
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
                    $taskId = $this->submitAsyncEditTask($imageGenerateRequest);
                    // 轮询结果（带重试）
                    $result = $this->pollTaskResult($taskId, $imageGenerateRequest);

                    return [
                        'success' => true,
                        'output' => $result['output'],
                        'index' => $i,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('通义千问图像编辑：失败', [
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

            $this->logger->error('通义千问图像编辑：所有图片编辑均失败', ['errors' => $errors]);
            ExceptionBuilder::throw($finalErrorCode, $finalErrorMsg);
        }

        // 按索引排序结果
        ksort($rawResults);
        $rawResults = array_values($rawResults);

        $this->logger->info('通义千问图像编辑：编辑结束', [
            '图片数量' => $count,
        ]);

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
            ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, '图像编辑需要提供输入图像');
        }

        // 检查编辑类型
        if (empty($request->getEditType())) {
            $this->logger->error('通义千问图像编辑：缺少编辑类型');
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, '图像编辑需要指定编辑类型');
        }

        $this->logger->info('通义千问图像编辑：参数校验通过', [
            'edit_type' => $request->getEditType(),
            'image_count' => count($request->getImageUrls()),
        ]);
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    #[RateLimit(create: 4, consume: 1, capacity: 0, key: ImageGenerate::IMAGE_GENERATE_KEY_PREFIX . ImageGenerate::IMAGE_GENERATE_SUBMIT_KEY_PREFIX . ImageGenerateModelType::QwenImageEdit->value, waitTimeout: 60)]
    private function submitAsyncEditTask(QwenImageEditRequest $request): string
    {
        try {
            $params = [
                'prompt' => $request->getPrompt(),
                'edit_type' => $request->getEditType(),
                'image_urls' => $request->getImageUrls(),
                'ref_image_type' => $request->getRefImageType(),
                'model' => $request->getModel(),
                'edit_params' => $request->getEditParams(),
            ];

            // 设置遮罩图像（如果有）
            if ($request->getMaskUrl() !== null) {
                $params['mask_url'] = $request->getMaskUrl();
            }

            $response = $this->api->submitEditTask($params);

            // 检查响应格式
            if (! isset($response['output']['task_id'])) {
                $errorMsg = $response['message'] ?? '未知错误';
                $this->logger->warning('通义千问图像编辑：响应中缺少任务ID', ['response' => $response]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, $errorMsg);
            }

            $taskId = $response['output']['task_id'];

            $this->logger->info('通义千问图像编辑：提交任务成功', [
                'taskId' => $taskId,
                'edit_type' => $request->getEditType(),
            ]);

            return $taskId;
        } catch (Exception $e) {
            $this->logger->error('通义千问图像编辑：任务提交异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    #[RateLimit(create: 18, consume: 1, capacity: 0, key: ImageGenerate::IMAGE_GENERATE_KEY_PREFIX . self::IMAGE_GENERATE_POLL_KEY_PREFIX . ImageGenerateModelType::QwenImageEdit->value, waitTimeout: 60)]
    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    private function pollTaskResult(string $taskId, QwenImageEditRequest $imageGenerateRequest): array
    {
        $retryCount = 0;

        while ($retryCount < self::MAX_RETRY_COUNT) {
            try {
                $response = $this->api->getTaskResult($taskId);

                // 检查响应格式
                if (! isset($response['output'])) {
                    $this->logger->warning('通义千问图像编辑：查询任务响应格式错误', ['response' => $response]);
                    ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR);
                }

                $output = $response['output'];
                $taskStatus = $output['task_status'] ?? '';

                $this->logger->info('通义千问图像编辑：任务状态', [
                    'taskId' => $taskId,
                    'status' => $taskStatus,
                ]);

                switch ($taskStatus) {
                    case 'SUCCEEDED':
                        if (! empty($output['results'])) {
                            return $response;
                        }
                        $this->logger->error('通义千问图像编辑：任务完成但缺少图片数据', ['response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
                        // no break
                    case 'PENDING':
                    case 'RUNNING':
                        break;
                    case 'FAILED':
                        $errorMsg = $output['message'] ?? '任务执行失败';
                        $this->logger->error('通义千问图像编辑：任务执行失败', ['taskId' => $taskId, 'error' => $errorMsg]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $errorMsg);
                        // no break
                    default:
                        $this->logger->error('通义千问图像编辑：未知的任务状态', ['status' => $taskStatus, 'response' => $response]);
                        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT_WITH_REASON);
                }

                ++$retryCount;
                sleep(self::RETRY_INTERVAL);
            } catch (Exception $e) {
                $this->logger->error('通义千问图像编辑：查询任务异常', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'taskId' => $taskId,
                ]);

                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
            }
        }

        $this->logger->error('通义千问图像编辑：任务查询超时', ['taskId' => $taskId]);
        ExceptionBuilder::throw(ImageGenerateErrorCode::TASK_TIMEOUT);
    }

    /**
     * 为通义千问编辑模式原始数据添加水印.
     */
    private function processQwenEditRawDataWithWatermark(array $rawData, WatermarkConfig $watermarkConfig): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['output']['results']) || ! is_array($result['output']['results'])) {
                continue;
            }

            foreach ($result['output']['results'] as $resultIndex => &$resultItem) {
                if (! isset($resultItem['url'])) {
                    continue;
                }

                try {
                    // 处理URL格式的图片
                    $resultItem['url'] = $this->watermarkProcessor->addWatermarkToUrl($resultItem['url'], $watermarkConfig);
                } catch (Exception $e) {
                    // 水印处理失败时，记录错误但不影响图片返回
                    $this->logger->error('通义千问图像编辑水印处理失败', [
                        'index' => $index,
                        'resultIndex' => $resultIndex,
                        'error' => $e->getMessage(),
                    ]);
                    // 继续处理下一张图片，当前图片保持原始状态
                }
            }
        }

        return $rawData;
    }
}
