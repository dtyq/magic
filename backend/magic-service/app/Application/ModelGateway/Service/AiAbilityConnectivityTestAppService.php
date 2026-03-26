<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\AiAbilityConnectivity\AiAbilityConnectivityTesterResolver;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class AiAbilityConnectivityTestAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly LoggerFactory $loggerFactory,
        private readonly LLMAppService $llmAppService,
        private readonly AiAbilityConnectivityTesterResolver $testerResolver,
    ) {
        $this->logger = $this->loggerFactory->get(static::class);
    }

    public function connectivityTest(AiAbilityConnectivityTestRequestDTO $requestDTO): array
    {
        $startTime = microtime(true);
        $aiAbility = $requestDTO->getAiAbility();
        $provider = '';
        $dataIsolation = null;

        try {
            $requestDTO->validate();
            $aiAbilityCode = $requestDTO->getAiAbilityCode();
            $aiAbility = $aiAbilityCode->value;

            $dataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken(
                $requestDTO->getAccessToken(),
                $requestDTO->getBusinessParams()
            );

            $this->logger->info('AiAbilityConnectivityTestRequest', [
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'ai_ability' => $aiAbility,
            ]);

            $result = $this->testerResolver->resolve($aiAbilityCode)->test($requestDTO);

            $response = $this->buildResponse(
                success: true,
                aiAbility: $aiAbility,
                provider: (string) ($result['provider'] ?? $provider),
                message: (string) ($result['message'] ?? 'connectivity test passed'),
                durationMs: (int) ($result['duration_ms'] ?? ((microtime(true) - $startTime) * 1000))
            );

            $this->logger->info('AiAbilityConnectivityTestSuccess', [
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'ai_ability' => $response['ai_ability'],
                'provider' => $response['provider'],
                'duration_ms' => $response['duration_ms'],
            ]);

            return $response;
        } catch (Throwable $throwable) {
            $response = $this->buildResponse(
                success: false,
                aiAbility: $aiAbility,
                provider: $provider,
                message: $throwable->getMessage(),
                durationMs: (int) ((microtime(true) - $startTime) * 1000)
            );

            $this->logger->error('AiAbilityConnectivityTestFailed', [
                'organization_code' => $dataIsolation?->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation?->getCurrentUserId(),
                'ai_ability' => $response['ai_ability'],
                'provider' => $response['provider'],
                'message' => $response['message'],
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);

            return $response;
        }
    }

    /**
     * @return array{success:bool,ai_ability:string,provider:string,message:string,duration_ms:int}
     */
    private function buildResponse(
        bool $success,
        string $aiAbility,
        string $provider,
        string $message,
        int $durationMs
    ): array {
        return [
            'success' => $success,
            'ai_ability' => $aiAbility,
            'provider' => $provider,
            'message' => $message,
            'duration_ms' => $durationMs,
        ];
    }
}
