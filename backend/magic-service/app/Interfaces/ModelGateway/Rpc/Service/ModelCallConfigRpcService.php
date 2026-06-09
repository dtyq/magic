<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Rpc\Service;

use App\Application\ModelGateway\Service\ModelCallConfigAppService;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_MODEL_GATEWAY_MODEL_CONFIG)]
readonly class ModelCallConfigRpcService
{
    public function __construct(
        private ModelCallConfigAppService $modelCallConfigAppService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_GET)]
    public function getConfig(array $params): array
    {
        $organizationCode = trim((string) ($params['organization_code'] ?? $params['organizationCode'] ?? ''));
        $modelId = trim((string) ($params['model_id'] ?? $params['modelId'] ?? ''));
        $modelType = trim((string) ($params['model_type'] ?? $params['modelType'] ?? 'llm'));

        if ($organizationCode === '' || $modelId === '') {
            return [
                'code' => 400,
                'message' => 'organization_code or model_id is empty',
            ];
        }

        try {
            return [
                'code' => 0,
                'message' => 'success',
                'data' => $this->modelCallConfigAppService->getConfig($organizationCode, $modelId, $modelType),
            ];
        } catch (InvalidArgumentException $exception) {
            return [
                'code' => 400,
                'message' => $exception->getMessage(),
            ];
        } catch (Throwable $exception) {
            $this->logger->warning('IPC get model call config failed', [
                'organization_code' => $organizationCode,
                'model_id' => $modelId,
                'model_type' => $modelType,
                'error' => $exception->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $exception->getMessage(),
            ];
        }
    }
}
