<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Interfaces\ModelGateway\Assembler\LLMAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;

#[ApiResponse('low_code')]
class LLMApi extends AbstractOpenApi
{
    #[Inject]
    protected LLMAppService $llmAppService;

    public function chatCompletions(RequestInterface $request)
    {
        $requestData = $request->all();
        $sendMsgGPTDTO = new CompletionDTO($requestData);
        $sendMsgGPTDTO->setAccessToken($this->getAccessToken());
        $sendMsgGPTDTO->setIps($this->getClientIps());
        $response = $this->llmAppService->chatCompletion($sendMsgGPTDTO);
        if ($response instanceof ChatCompletionStreamResponse) {
            LLMAssembler::createStreamResponseByChatCompletionResponse($sendMsgGPTDTO, $response);
            return [];
        }
        if ($response instanceof ChatCompletionResponse) {
            return LLMAssembler::createResponseByChatCompletionResponse($response);
        }
        return null;
    }

    /**
     * 处理文本嵌入请求.
     * 将文本转换为向量表示.
     */
    public function embeddings(RequestInterface $request)
    {
        $requestData = $request->all();
        $embeddingDTO = new EmbeddingsDTO($requestData);
        $embeddingDTO->setAccessToken($this->getAccessToken());
        $embeddingDTO->setIps($this->getClientIps());
        $response = $this->llmAppService->embeddings($embeddingDTO);
        if ($response instanceof EmbeddingResponse) {
            return LLMAssembler::createEmbeddingsResponse($response);
        }
        return null;
    }
}
