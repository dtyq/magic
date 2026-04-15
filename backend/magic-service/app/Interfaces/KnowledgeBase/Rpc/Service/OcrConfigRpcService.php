<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_OCR)]
readonly class OcrConfigRpcService
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_CONFIG)]
    public function config(): array
    {
        try {
            $entity = $this->aiAbilityDomainService->getByCode(ProviderDataIsolation::create(), AiAbilityCode::Ocr);
            $enabled = $entity?->isEnabled() ?? false;
            $config = $enabled ? ($entity?->getConfig() ?? []) : [];

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'enabled' => $enabled,
                    'provider_code' => $this->resolveProviderCode($config),
                    'providers' => $this->normalizeProviders((array) ($config['providers'] ?? [])),
                ],
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC OCR config resolve failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
            ];
        }
    }

    private function normalizeProviders(array $providers): array
    {
        $normalized = [];
        foreach ($providers as $provider) {
            if (! is_array($provider)) {
                continue;
            }
            $normalized[] = [
                'provider' => (string) ($provider['provider'] ?? ''),
                'enable' => (bool) ($provider['enable'] ?? false),
                'access_key' => (string) ($provider['access_key'] ?? ''),
                'secret_key' => (string) ($provider['secret_key'] ?? ''),
            ];
        }
        return $normalized;
    }

    private function resolveProviderCode(array $config): string
    {
        $providerCode = trim((string) ($config['provider_code'] ?? ''));
        if ($providerCode !== '') {
            return $providerCode;
        }

        foreach ((array) ($config['providers'] ?? []) as $provider) {
            if (! is_array($provider) || ! ($provider['enable'] ?? false)) {
                continue;
            }
            $providerCode = trim((string) ($provider['provider'] ?? ''));
            if ($providerCode !== '') {
                return $providerCode;
            }
        }

        return '';
    }
}
