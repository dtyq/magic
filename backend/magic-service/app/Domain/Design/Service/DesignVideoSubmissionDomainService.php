<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Service;

use App\Domain\Design\Contract\VideoGatewayPayloadBuilderInterface;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Design\Contract\VideoGatewayClientInterface;
use Throwable;

readonly class DesignVideoSubmissionDomainService
{
    public function __construct(
        private VideoGatewayPayloadBuilderInterface $payloadBuilder,
        private VideoGatewayClientInterface $videoGatewayClient,
    ) {
    }

    /**
     * 构建 provider 请求并提交视频生成任务，返回 Design 侧需要保存的提交快照。
     *
     * @return array<string, mixed>
     */
    public function submit(DesignGenerationTaskEntity $entity): array
    {
        try {
            $result = $this->videoGatewayClient->submitVideo(
                $this->payloadBuilder->build($entity),
                [
                    'organization_code' => $entity->getOrganizationCode(),
                    'user_id' => $entity->getUserId(),
                ]
            );
        } catch (BusinessException $exception) {
            throw $exception;
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.submit_failed',
                throwable: $throwable
            );
        }

        $operationId = trim((string) ($result['id'] ?? ''));
        if ($operationId === '') {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.operation_id_missing'
            );
        }

        return [
            'provider' => (string) ($result['provider'] ?? ''),
            'submit_endpoint' => '/v1/videos',
            'operation_id' => $operationId,
            'submitted_at' => date(DATE_ATOM),
            'poll_attempts' => 0,
            'deadline_at' => date(DATE_ATOM, time() + (int) config('design_generation.video_poll.timeout_seconds', 3600)),
        ];
    }

    /**
     * 调用视频网关进行积分预估，统一把下游异常转换为 Design 侧错误。
     *
     * @param array<string, mixed> $payload
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function estimate(array $payload, array $businessParams): array
    {
        try {
            return $this->videoGatewayClient->estimateVideo($payload, $businessParams);
        } catch (BusinessException $exception) {
            throw $exception;
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.estimate_failed',
                throwable: $throwable
            );
        }
    }
}
