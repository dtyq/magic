<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Rpc\Service;

use App\Application\Provider\Service\AiAbilityConfigAppService;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_AI_ABILITY_CONFIG)]
readonly class AiAbilityConfigRpcService
{
    public function __construct(
        private AiAbilityConfigAppService $aiAbilityConfigAppService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_GET)]
    public function getConfig(array $params): array
    {
        $organizationCode = trim((string) ($params['organization_code'] ?? $params['organizationCode'] ?? ''));
        $abilityCode = trim((string) ($params['ability_code'] ?? $params['abilityCode'] ?? ''));

        if ($organizationCode === '' || $abilityCode === '') {
            return [
                'code' => 400,
                'message' => 'organization_code or ability_code is empty',
            ];
        }

        try {
            return [
                'code' => 0,
                'message' => 'success',
                'data' => $this->aiAbilityConfigAppService->getConfig($organizationCode, $abilityCode),
            ];
        } catch (InvalidArgumentException $exception) {
            return [
                'code' => 400,
                'message' => $exception->getMessage(),
            ];
        } catch (Throwable $exception) {
            $this->logger->warning('IPC get AI ability config failed', [
                'organization_code' => $organizationCode,
                'ability_code' => $abilityCode,
                'error' => $exception->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $exception->getMessage(),
            ];
        }
    }
}
