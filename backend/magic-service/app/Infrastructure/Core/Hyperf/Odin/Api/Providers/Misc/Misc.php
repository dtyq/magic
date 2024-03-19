<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Hyperf\Odin\Api\Providers\Misc;

use Hyperf\Odin\Api\Providers\AbstractApi;
use Hyperf\Odin\Api\Providers\OpenAI\Client;
use Hyperf\Odin\Api\Providers\OpenAI\OpenAIConfig;
use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Exception\LLMException\Configuration\LLMInvalidApiKeyException;
use Hyperf\Odin\Exception\LLMException\Configuration\LLMInvalidEndpointException;
use Psr\Log\LoggerInterface;

class Misc extends AbstractApi
{
    /**
     * @var Client[]
     */
    protected array $clients = [];

    public function getClient(OpenAIConfig $config, ?ApiOptions $requestOptions = null, ?LoggerInterface $logger = null): Client
    {
        // 检查API Key，除非配置为跳过验证
        if (empty($config->getApiKey()) && ! $config->shouldSkipApiKeyValidation()) {
            throw new LLMInvalidApiKeyException('API密钥不能为空', null, 'OpenAI');
        }

        if (empty($config->getBaseUrl())) {
            throw new LLMInvalidEndpointException('基础URL不能为空', null, $config->getBaseUrl());
        }
        $requestOptions = $requestOptions ?? new ApiOptions();

        $key = md5(json_encode($config->toArray()) . json_encode($requestOptions->toArray()));
        if (($this->clients[$key] ?? null) instanceof Client) {
            return $this->clients[$key];
        }

        $client = new MiscClient($config, $requestOptions, $logger);

        $this->clients[$key] = $client;
        return $this->clients[$key];
    }
}
