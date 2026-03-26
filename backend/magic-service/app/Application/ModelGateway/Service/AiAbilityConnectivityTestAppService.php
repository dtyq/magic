<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\AiAbilityConnectivity\AiAbilityConnectivityTesterResolver;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Core\DataIsolation\ProviderDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class AiAbilityConnectivityTestAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly LoggerFactory $loggerFactory,
        private readonly LLMAppService $llmAppService,
        private readonly AiAbilityDomainService $aiAbilityDomainService,
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

            $aiAbilityConfig = $this->getAiAbilityConfig($aiAbilityCode);
            $enabledProviderConfig = $this->getEnabledProviderConfig($aiAbilityConfig, $aiAbilityCode);
            $provider = (string) ($enabledProviderConfig['provider'] ?? '');

            $this->logger->info('AiAbilityConnectivityTestRequest', [
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'ai_ability' => $aiAbility,
                'provider' => $provider,
            ]);

            $result = $this->testerResolver->resolve($aiAbilityCode)->test($aiAbilityConfig, $enabledProviderConfig);

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

    private function getAiAbilityConfig(AiAbilityCode $aiAbilityCode): array
    {
        $providerDataIsolation = ProviderDataIsolation::create()->disabled();
        $aiAbilityEntity = $this->aiAbilityDomainService->getByCode($providerDataIsolation, $aiAbilityCode);

        if (! $aiAbilityEntity || ! $aiAbilityEntity->isEnabled()) {
            throw new RuntimeException(sprintf('AI ability "%s" is not enabled', $aiAbilityCode->value));
        }

        $config = $aiAbilityEntity->getConfig();
        if (empty($config)) {
            throw new RuntimeException(sprintf('AI ability "%s" configuration is not set', $aiAbilityCode->value));
        }

        return $config;
    }

    private function getEnabledProviderConfig(array $aiAbilityConfig, AiAbilityCode $aiAbilityCode): array
    {
        $providers = $aiAbilityConfig['providers'] ?? [];
        foreach ($providers as $providerConfig) {
            if (($providerConfig['enable'] ?? false) === true) {
                return $providerConfig;
            }
        }

        throw new RuntimeException(sprintf('No enabled provider configuration found for ai_ability: %s', $aiAbilityCode->value));
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
