<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Rpc\Service;

use App\Application\ModelGateway\DTO\Common\BusinessParamsDTO;
use App\Application\ModelGateway\DTO\Embedding\EmbeddingComputeParamsDTO;
use App\Application\ModelGateway\Official\MagicAccessToken;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelListType;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Hyperf\Odin\Exception\LLMException\LLMNetworkException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_MODEL_GATEWAY_EMBEDDING)]
readonly class EmbeddingRpcService
{
    public function __construct(
        private LLMAppService $llmAppService,
        private LoggerInterface $logger
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_PROVIDERS_LIST)]
    public function listProviders(array $params): array
    {
        $businessParams = BusinessParamsDTO::fromArray((array) ($params['business_params'] ?? []))->toArray();
        $accessToken = (string) ($params['access_token'] ?? '');

        try {
            if ($accessToken === '') {
                MagicAccessToken::init();
                if (defined('MAGIC_ACCESS_TOKEN')) {
                    $accessToken = MAGIC_ACCESS_TOKEN;
                }
            }

            if ($accessToken === '') {
                return [
                    'code' => 500,
                    'message' => 'magic access token not initialized',
                ];
            }

            $models = $this->llmAppService->models(
                accessToken: $accessToken,
                withInfo: true,
                type: ModelListType::EMBEDDING,
                businessParams: $businessParams
            );
            $providers = $this->mapProviders($models);

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $providers,
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC Embedding listProviders failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
                'error_code' => $e instanceof BusinessException ? $e->getCode() : 0,
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_COMPUTE)]
    public function compute(array $params): array
    {
        $request = EmbeddingComputeParamsDTO::fromArray($params);
        $model = $request->model;
        $input = $request->input;
        $businessParams = $request->businessParams->toArray();
        $accessToken = $request->accessToken;

        $inputCount = 1;
        if (is_array($input)) {
            $inputCount = count($input);
        } elseif ($input === '') {
            $inputCount = 0;
        }

        $this->logger->info('IPC Embedding compute request', [
            'model' => $model,
            'input_count' => $inputCount,
        ]);

        try {
            if ($accessToken === '') {
                $accessToken = (string) (($params['business_params']['access_token'] ?? '') ?: '');
            }
            if ($accessToken === '') {
                MagicAccessToken::init();
                if (defined('MAGIC_ACCESS_TOKEN')) {
                    $accessToken = MAGIC_ACCESS_TOKEN;
                }
            }
            if ($accessToken === '') {
                return [
                    'code' => 500,
                    'message' => 'magic access token not initialized',
                ];
            }

            $result = $this->computeEmbeddingData($model, $input, $businessParams, $accessToken);

            $this->logger->info('IPC Embedding compute completed', [
                'model' => $model,
                'result_count' => count($result['data'] ?? []),
            ]);

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'data' => $result['data'] ?? [],
                ],
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC Embedding compute failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
                'error_code' => $this->resolveComputeErrorCode($e),
            ];
        }
    }

    private function extractEmbeddingResult(object $response): array
    {
        if (! method_exists($response, 'toArray')) {
            throw new RuntimeException(sprintf(
                'unexpected embedding response type: %s',
                get_debug_type($response)
            ));
        }

        $result = $response->toArray();
        if (! is_array($result)) {
            throw new RuntimeException('unexpected embedding response payload: toArray() must return array');
        }

        $data = $result['data'] ?? [];
        if (! is_array($data)) {
            throw new RuntimeException('unexpected embedding response payload: data must be array');
        }

        return [
            'data' => $data,
        ];
    }

    private function computeEmbeddingData(string $model, array|string $input, array $businessParams, string $accessToken): array
    {
        if (is_string($input)) {
            return $this->computeSingleEmbeddingData($model, $input, $businessParams, $accessToken);
        }

        $allData = [];
        foreach ($input as $index => $text) {
            $result = $this->computeSingleEmbeddingData($model, (string) $text, $businessParams, $accessToken);
            foreach ($result['data'] as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $item['index'] = $index;
                $allData[] = $item;
            }
        }

        return [
            'data' => $allData,
        ];
    }

    private function computeSingleEmbeddingData(string $model, string $input, array $businessParams, string $accessToken): array
    {
        $embeddingsDTO = new EmbeddingsDTO([
            'model' => $model,
            'input' => $input,
        ]);
        $embeddingsDTO->setBusinessParams($businessParams);
        $embeddingsDTO->setAccessToken($accessToken);

        $response = $this->llmAppService->embeddings($embeddingsDTO);
        return $this->extractEmbeddingResult($response);
    }

    private function resolveComputeErrorCode(Throwable $throwable): int
    {
        if ($this->containsThrowable($throwable, static fn (Throwable $candidate): bool => $candidate instanceof LLMNetworkException)) {
            return MagicApiErrorCode::MODEL_NETWORK_ERROR->value;
        }

        return $throwable instanceof BusinessException ? $throwable->getCode() : 0;
    }

    /**
     * @param callable(Throwable): bool $predicate
     */
    private function containsThrowable(Throwable $throwable, callable $predicate): bool
    {
        for ($current = $throwable; $current !== null; $current = $current->getPrevious()) {
            if ($predicate($current)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string, ModelConfigEntity> $models
     */
    private function mapProviders(array $models): array
    {
        $providers = [];
        foreach ($models as $modelId => $model) {
            $info = $model->getInfo();
            $providerAlias = $info['attributes']['provider_alias'] ?? 'MagicAI';
            if (! isset($providers[$providerAlias])) {
                $providers[$providerAlias] = [
                    'id' => $providerAlias,
                    'name' => $providerAlias,
                    'models' => [],
                ];
            }

            $providers[$providerAlias]['models'][] = [
                'id' => $modelId,
                'name' => $model->getName(),
                'model_id' => $modelId,
                'icon' => $info['attributes']['icon'] ?? '',
            ];
        }

        return array_values($providers);
    }
}
