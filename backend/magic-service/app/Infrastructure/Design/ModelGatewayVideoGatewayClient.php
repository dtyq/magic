<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Design;

use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Design\Contract\VideoGatewayClientInterface;

readonly class ModelGatewayVideoGatewayClient implements VideoGatewayClientInterface
{
    public function __construct(
        private VideoOperationAppService $videoOperationAppService,
    ) {
    }

    /**
     * 将 Design 侧生成请求转成模型网关 DTO，并提交视频任务。
     */
    public function submitVideo(array $payload, array $businessParams): array
    {
        $mergedBusinessParams = $this->mergeBusinessParams($payload, $businessParams);
        $requestDTO = new CreateVideoDTO($payload);
        $requestDTO->setAccessToken($this->getMagicAccessToken());
        $requestDTO->setBusinessParams($mergedBusinessParams);
        $requestDTO->setHeaderConfigs($this->buildHeaderConfigs($mergedBusinessParams));
        $requestDTO->setIps(['127.0.0.1']);
        $requestDTO->valid();

        $response = $this->videoOperationAppService->enqueue($requestDTO->getAccessToken(), $requestDTO);
        $responseArray = $response->toArray();

        return [
            'id' => $response->getId(),
            'provider_task_id' => $response->getProviderTaskId(),
            'provider' => is_string($responseArray['provider'] ?? null) ? $responseArray['provider'] : '',
            'status' => $response->getStatus(),
        ];
    }

    /**
     * 将 Design 侧预估 payload 转成模型网关 DTO，并委托视频应用服务计算积分。
     */
    public function estimateVideo(array $payload, array $businessParams): array
    {
        $mergedBusinessParams = $this->mergeBusinessParams($payload, $businessParams);
        $requestDTO = new CreateVideoDTO($payload);
        $requestDTO->setAccessToken($this->getMagicAccessToken());
        $requestDTO->setBusinessParams($mergedBusinessParams);
        $requestDTO->setHeaderConfigs($this->buildHeaderConfigs($mergedBusinessParams));
        $requestDTO->setIps(['127.0.0.1']);
        $requestDTO->valid();

        return $this->videoOperationAppService
            ->estimate($requestDTO->getAccessToken(), $requestDTO)
            ->toArray();
    }

    /**
     * 查询模型网关视频任务，并透传 provider 原始结果给 Design 侧归档流程。
     */
    public function queryVideo(string $operationId, array $businessParams): array
    {
        $response = $this->videoOperationAppService
            ->getOperation($this->getMagicAccessToken(), $operationId, $businessParams);

        $result = $response->toArray();
        $providerResult = $response->getProviderResult();
        if (is_array($providerResult)) {
            $result['provider_result'] = $providerResult;
        }

        return $result;
    }

    /**
     * 合并调用方透传和 Design 层补充的业务参数，供鉴权、日志和计费共用。
     *
     * @param array<string, mixed> $payload
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    private function mergeBusinessParams(array $payload, array $businessParams): array
    {
        $payloadBusinessParams = $payload['business_params'] ?? [];

        if (! is_array($payloadBusinessParams)) {
            $payloadBusinessParams = [];
        }

        return array_merge($payloadBusinessParams, $businessParams);
    }

    /**
     * 构造内部调用模型网关所需的业务请求头。
     *
     * @param array<string, string> $businessParams
     * @return array<string, string>
     */
    private function buildHeaderConfigs(array $businessParams): array
    {
        $headers = [
            'api-key' => $this->getMagicAccessToken(),
            'request-id' => uniqid('design-video-', true),
        ];

        if (($businessParams['organization_code'] ?? '') !== '') {
            $headers['magic-organization-code'] = $businessParams['organization_code'];
        }

        if (($businessParams['user_id'] ?? '') !== '') {
            $headers['magic-user-id'] = $businessParams['user_id'];
        }

        $topicId = $businessParams['magic_topic_id'] ?? $businessParams['topic_id'] ?? '';
        if (is_string($topicId) && $topicId !== '') {
            $headers['magic-topic-id'] = $topicId;
        }

        $taskId = $businessParams['magic_task_id'] ?? $businessParams['task_id'] ?? '';
        if (is_string($taskId) && $taskId !== '') {
            $headers['magic-task-id'] = $taskId;
        }

        return $headers;
    }

    /**
     * 读取内部模型网关访问令牌，未配置时抛出 Design 侧第三方服务错误。
     */
    private function getMagicAccessToken(): string
    {
        if (! defined('MAGIC_ACCESS_TOKEN') || ! is_string(MAGIC_ACCESS_TOKEN) || MAGIC_ACCESS_TOKEN === '') {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.gateway_access_token_not_configured'
            );
        }

        return MAGIC_ACCESS_TOKEN;
    }
}
