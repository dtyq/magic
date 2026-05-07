<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\KnowledgeBase\Event\OcrRecognitionUsageEvent;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Closure;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_OCR)]
readonly class OcrConfigRpcService
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
        private LoggerInterface $logger,
        private ?Closure $usageEventDispatcher = null,
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

    #[RpcMethod(name: SvcMethods::METHOD_REPORT_USAGE)]
    public function reportUsage(array $params = []): array
    {
        $provider = $this->stringParam($params, 'provider');
        $organizationCode = $this->stringParam($params, 'organization_code');
        $userId = $this->stringParam($params, 'user_id');
        $pageCount = (int) ($params['page_count'] ?? 0);
        if ($provider === '' || $organizationCode === '' || $userId === '' || $pageCount <= 0) {
            return [
                'code' => 400,
                'message' => 'provider, organization_code, user_id and positive page_count are required',
            ];
        }

        $fileType = $this->stringParam($params, 'file_type');
        $businessParams = $this->normalizeUsageBusinessParams($params, $pageCount);

        try {
            $this->dispatchUsageEvent(new OcrRecognitionUsageEvent(
                provider: $provider,
                organizationCode: $organizationCode,
                userId: $userId,
                pageCount: $pageCount,
                fileType: $fileType,
                businessParams: $businessParams,
            ));

            return [
                'code' => 0,
                'message' => 'success',
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC OCR usage report failed', [
                'provider' => $provider,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'page_count' => $pageCount,
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

    private function normalizeUsageBusinessParams(array $params, int $pageCount): array
    {
        $businessParams = $params['business_params'] ?? [];
        if (! is_array($businessParams)) {
            $businessParams = [];
        }

        $fields = [
            'event_id',
            'request_id',
            'knowledge_base_code',
            'document_code',
            'business_id',
            'source_id',
            'ocr_call_type',
        ];
        foreach ($fields as $field) {
            if (array_key_exists($field, $businessParams)) {
                $businessParams[$field] = (string) $businessParams[$field];
                continue;
            }
            $businessParams[$field] = $this->stringParam($params, $field);
        }
        $businessParams['page_count'] = $pageCount;

        return $businessParams;
    }

    private function stringParam(array $params, string $key): string
    {
        return trim((string) ($params[$key] ?? ''));
    }

    private function dispatchUsageEvent(OcrRecognitionUsageEvent $event): void
    {
        if ($this->usageEventDispatcher !== null) {
            ($this->usageEventDispatcher)($event);
            return;
        }

        AsyncEventUtil::dispatch($event);
    }
}
