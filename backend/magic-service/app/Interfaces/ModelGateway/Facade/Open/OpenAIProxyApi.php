<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageEditDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Interfaces\ModelGateway\Assembler\LLMAssembler;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;

use function Hyperf\Translation\__;

class OpenAIProxyApi extends AbstractOpenApi
{
    #[Inject]
    protected LLMAppService $llmAppService;

    public function chatCompletions(RequestInterface $request)
    {
        $requestData = $request->all();
        $sendMsgGPTDTO = new CompletionDTO($requestData);
        $sendMsgGPTDTO->setAccessToken($this->getAccessToken());
        $sendMsgGPTDTO->setIps($this->getClientIps());

        $this->setHeaderConfigs($sendMsgGPTDTO, $request);

        $response = $this->llmAppService->chatCompletion($sendMsgGPTDTO);
        if ($response instanceof ChatCompletionStreamResponse) {
            LLMAssembler::createStreamResponseByChatCompletionResponse($sendMsgGPTDTO, $response);
            return [];
        }
        if ($response instanceof ChatCompletionResponse) {
            return LLMAssembler::createResponseByChatCompletionResponse($response, (string) $sendMsgGPTDTO->getModel());
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

        $this->setHeaderConfigs($embeddingDTO, $request);
        $response = $this->llmAppService->embeddings($embeddingDTO);
        if ($response instanceof EmbeddingResponse) {
            return LLMAssembler::createEmbeddingsResponse($response);
        }
        return null;
    }

    public function models()
    {
        $accessToken = $this->getAccessToken();
        $withInfo = (bool) $this->request->input('with_info', false);
        $list = $this->llmAppService->models($accessToken, $withInfo);
        return LLMAssembler::createModels($list, $withInfo);
    }

    public function textGenerateImage(RequestInterface $request)
    {
        $requestData = $request->all();
        $textGenerateImageDTO = new TextGenerateImageDTO($requestData);
        $textGenerateImageDTO->setAccessToken($this->getAccessToken());
        $textGenerateImageDTO->setIps($this->getClientIps());

        $textGenerateImageDTO->valid();
        $this->setHeaderConfigs($textGenerateImageDTO, $request);
        return $this->llmAppService->textGenerateImage($textGenerateImageDTO);
    }

    public function imageEdit(RequestInterface $request)
    {
        $requestData = $request->all();

        $imageEditDTO = new ImageEditDTO($requestData);
        $imageEditDTO->setAccessToken($this->getAccessToken());
        $imageEditDTO->setIps($this->getClientIps());

        $imageEditDTO->valid();
        $this->setHeaderConfigs($imageEditDTO, $request);
        return $this->llmAppService->imageEdit($imageEditDTO);
    }

    public function textGenerateImageV2(RequestInterface $request)
    {
        $requestData = $request->all();
        $textGenerateImageDTO = new TextGenerateImageDTO($requestData);
        $textGenerateImageDTO->setAccessToken($this->getAccessToken());
        $textGenerateImageDTO->setIps($this->getClientIps());

        $textGenerateImageDTO->valid();
        $this->setHeaderConfigs($textGenerateImageDTO, $request);
        $response = $this->llmAppService->textGenerateImageV2($textGenerateImageDTO);
        if ($response instanceof OpenAIFormatResponse) {
            return $response->toArray();
        }
        return null;
    }

    public function imageEditV2(RequestInterface $request)
    {
        $requestData = $request->all();

        $imageEditDTO = new TextGenerateImageDTO($requestData);
        $imageEditDTO->setAccessToken($this->getAccessToken());
        $imageEditDTO->setIps($this->getClientIps());

        $imageEditDTO->valid();
        if (! $imageEditDTO->validateSupportedImageEditModel()) {
            return OpenAIFormatResponse::buildError(ImageGenerateErrorCode::MODEL_NOT_SUPPORT_EDIT->value, __('image_generate.model_not_support_edit'))->toArray();
        }
        $this->setHeaderConfigs($imageEditDTO, $request);
        $response = $this->llmAppService->textGenerateImageV2($imageEditDTO);
        if ($response instanceof OpenAIFormatResponse) {
            return $response->toArray();
        }
        return null;
    }

    private function setHeaderConfigs(AbstractRequestDTO $abstractRequestDTO, RequestInterface $request): void
    {
        $headerConfigs = [];
        foreach ($request->getHeaders() as $key => $value) {
            $key = strtolower((string) $key);
            $headerConfigs[$key] = $request->getHeader($key)[0] ?? '';
        }
        $abstractRequestDTO->setHeaderConfigs($headerConfigs);
    }
}
