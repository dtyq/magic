<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\MagicAIApi\Api;

use App\Infrastructure\ExternalAPI\MagicAIApi\Api\Request\Chat\CompletionsRequest;
use App\Infrastructure\ExternalAPI\MagicAIApi\Api\Response\Chat\CompletionsResponse;
use App\Infrastructure\ExternalAPI\MagicAIApi\Kernel\AbstractApi;
use GuzzleHttp\RequestOptions;

class Chat extends AbstractApi
{
    public function completions(CompletionsRequest $request): CompletionsResponse
    {
        $options = [
            RequestOptions::JSON => $request->toBody(),
        ];
        $response = $this->post('/api/v2/magic/llm/chatCompletions', $options);
        $data = $this->getResponseData($response, true);

        return new CompletionsResponse($data);
    }
}
