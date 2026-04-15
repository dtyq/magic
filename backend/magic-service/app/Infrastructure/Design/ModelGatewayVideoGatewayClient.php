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
            'provider' => is_string($responseArray['provider'] ?? null) ? $responseArray['provider'] : '',
            'status' => $response->getStatus(),
        ];
    }

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
