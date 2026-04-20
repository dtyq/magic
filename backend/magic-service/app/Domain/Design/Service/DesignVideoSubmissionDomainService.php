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
}
