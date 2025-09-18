<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\Util\FileType;
use BadMethodCallException;
use Exception;
use Hyperf\RateLimit\Annotation\RateLimit;

class MiracleVisionModel extends AbstractImageGenerate
{
    private const STATUS_INIT = 0;

    private const STATUS_PROCESSING = 1;

    private const STATUS_FAILED = 2;

    private const STATUS_SUCCESS = 10;

    private const STATUS_NOT_FOUND = -1;

    // 注释掉的是目前用不到
    //    private const STYLE_PORTRAIT = 25;
    private const STYLE_GENERAL = 26;
    //    private const STYLE_LANDSCAPE = 28;
    //    private const STYLE_3D = 27;

    private const ALLOWED_IMAGE_TYPES = ['JPG', 'JPEG', 'BMP', 'IMAGE', 'PNG'];

    private MiracleVisionAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $this->api = new MiracleVisionAPI($serviceProviderConfig['ak'], $serviceProviderConfig['sk']);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        throw new BadMethodCallException('该方法暂不支持');
    }

    public function imageConvertHigh(ImageGenerateRequest $imageGenerateRequest): string
    {
        $this->logger->info('美图超清转换：开始处理转换请求', [
            'request_type' => get_class($imageGenerateRequest),
        ]);

        $this->validateRequest($imageGenerateRequest);

        try {
            /**
             * @var MiracleVisionModelRequest $imageGenerateRequest
             */
            $styles = $this->api->getStyle();
            $this->validateApiResponse($styles);

            $styleId = $this->determineStyleId($styles);
            $this->logger->info('美图超清转换：已选择转换样式', ['style_id' => $styleId]);

            $result = $this->api->submitTask($imageGenerateRequest->getUrl(), $styleId);
            $this->validateApiResponse($result);

            $taskId = $result['data']['result']['id'];
            $this->logger->info('美图超清转换：任务提交成功', [
                'task_id' => $taskId,
            ]);

            return $taskId;
        } catch (Exception $e) {
            $this->logger->error('美图超清转换：任务提交异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    #[RateLimit(create: 5, consume: 1, capacity: 0, key: ImageGenerate::IMAGE_GENERATE_KEY_PREFIX . ImageGenerate::IMAGE_GENERATE_POLL_KEY_PREFIX . ImageGenerateModelType::MiracleVision->value, waitTimeout: 60)]
    public function queryTask(string $taskId): MiracleVisionModelResponse
    {
        $this->logger->info('美图超清转换：开始查询任务状态', ['task_id' => $taskId]);

        if (empty($taskId)) {
            $this->logger->error('美图超清转换：缺少任务ID参数');
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.missing_job_id');
        }

        try {
            $result = $this->api->queryTask($taskId);
            $this->validateApiResponse($result);

            $response = new MiracleVisionModelResponse();
            $status = (int) ($result['data']['status'] ?? self::STATUS_FAILED);

            $this->logger->info('美图超清转换：获取任务状态', [
                'task_id' => $taskId,
                'status' => $status,
                'progress' => $result['data']['progress'] ?? 0,
            ]);

            return $this->handleTaskStatus($status, $result, $response);
        } catch (Exception $e) {
            $this->logger->error('美图超清转换：查询任务状态异常', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function getStyle(): array
    {
        try {
            $result = $this->api->getStyle();
            $this->validateApiResponse($result);
            return $result;
        } catch (Exception $e) {
            $this->logger->error('美图超清转换：获取样式列表异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    public function setAK(string $ak)
    {
        $this->api->setKey($ak);
    }

    public function setSK(string $sk)
    {
        $this->api->setSecret($sk);
    }

    public function setApiKey(string $apiKey)
    {
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        throw new BadMethodCallException('该方法暂不支持');
    }

    public function getProviderName(): string
    {
        return 'miracle';
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        throw new BadMethodCallException('该方法暂不支持');
    }

    private function handleTaskStatus(int $status, array $result, MiracleVisionModelResponse $response): MiracleVisionModelResponse
    {
        $this->logger->info('美图超清转换：处理任务状态信息', ['status' => $status]);

        switch ($status) {
            case self::STATUS_SUCCESS:
                if (empty($result['data']['result']['urls'])) {
                    $this->logger->error('美图超清转换：任务完成但缺少结果URL', ['response' => $result]);
                    ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA);
                }
                $response->setFinishStatus(true);
                $response->setUrls($result['data']['result']['urls']);
                $this->logger->info('美图超清转换：任务处理成功', [
                    'urls_count' => count($result['data']['result']['urls']),
                ]);
                break;
            case self::STATUS_PROCESSING:
                $response->setFinishStatus(false);
                $response->setProgress($result['data']['progress']);
                $this->logger->info('美图超清转换：任务处理进行中', [
                    'progress' => $result['data']['progress'],
                ]);
                // no break
            case self::STATUS_INIT:
                $response->setFinishStatus(false);
                $response->setProgress($result['data']['progress']);
                $this->logger->info('美图超清转换：任务正在初始化', [
                    'progress' => $result['data']['progress'],
                ]);
                break;
            case self::STATUS_FAILED:
            case self::STATUS_NOT_FOUND:
            default:
                $response->setFinishStatus(false);
                $response->setError($result['message'] ?? '未知错误');
                $this->logger->error(
                    $status === self::STATUS_NOT_FOUND ? '美图超清转换：任务不存在' : '美图超清转换：任务处理失败',
                    ['status' => $status, 'response' => $result]
                );
        }

        return $response;
    }

    private function validateRequest(ImageGenerateRequest $request): void
    {
        if (! $request instanceof MiracleVisionModelRequest) {
            $this->logger->error('美图超清转换：请求类型不匹配', ['class' => get_class($request)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $this->validateImageType($request->getUrl());
    }

    private function validateImageType(string $url): void
    {
        $this->logger->info('美图超清转换：开始验证图片类型', ['url' => $url]);

        $type = FileType::getType($url);
        if (empty($type)) {
            $this->logger->error('美图超清转换：无法识别图片类型', ['url' => $url]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        if (! in_array(strtoupper($type), self::ALLOWED_IMAGE_TYPES, true)) {
            $this->logger->error('美图超清转换：图片类型不支持', [
                'url' => $url,
                'type' => $type,
                'allowed_types' => self::ALLOWED_IMAGE_TYPES,
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::UNSUPPORTED_IMAGE_FORMAT);
        }

        $this->logger->info('美图超清转换：图片类型验证通过', ['type' => $type]);
    }

    private function validateApiResponse(array $result): void
    {
        $this->logger->info('美图API：开始验证响应数据', ['response' => $result]);

        if (! isset($result['code'])) {
            $this->logger->warning('美图API：响应格式异常', ['response' => $result]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        if ($result['code'] !== 0) {
            $this->logger->warning('美图API：接口返回错误', [
                'code' => $result['code'],
                'message' => $result['message'] ?? '',
                'response' => $result,
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $result['message'] ?? '');
        }

        $this->logger->info('美图API：响应数据验证通过');
    }

    // todo xhy 目前只能强制返回 26 ，因为无法对图片场景做匹配
    private function determineStyleId(array $styles): int
    {
        if (empty($styles['data']['style_list'])) {
            return self::STYLE_GENERAL;
        }

        return $styles['data']['style_list'][1]['id'];
    }
}
