<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\MagicAIApi;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use Hyperf\Odin\Api\Providers\OpenAI\OpenAI;
use Hyperf\Odin\Api\Providers\OpenAI\OpenAIConfig;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Api\Response\TextCompletionResponse;
use Hyperf\Odin\Contract\Api\ClientInterface;
use Hyperf\Odin\Contract\Message\MessageInterface;
use Hyperf\Odin\Exception\LLMException\Configuration\LLMInvalidApiKeyException;
use Hyperf\Odin\Exception\LLMException\Configuration\LLMInvalidEndpointException;
use Hyperf\Odin\Exception\LLMException\Model\LLMEmbeddingNotSupportedException;
use Hyperf\Odin\Exception\LLMException\Model\LLMFunctionCallNotSupportedException;
use Hyperf\Odin\Exception\LLMException\Model\LLMModalityNotSupportedException;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\Embedding;
use Hyperf\Odin\Utils\ToolUtil;
use Psr\Log\LoggerInterface;

class MagicAILocalModel extends AbstractModel
{
    protected bool $includeBusinessParams = true;

    private string $accessToken;

    private int $vectorSize;

    public function __construct(
        protected string $model,
        protected array $config,
        protected ?LoggerInterface $logger = null
    ) {
        $this->accessToken = defined('MAGIC_ACCESS_TOKEN') ? MAGIC_ACCESS_TOKEN : ($this->config['access_token'] ?? '');
        $this->vectorSize = (int) ($this->config['vector_size'] ?? 2048);
        parent::__construct($this->model, $this->config, $this->logger);
    }

    /**
     * @throws LLMEmbeddingNotSupportedException
     */
    public function embeddings(array|string $input, ?string $encoding_format = 'float', ?string $user = null, array $businessParams = []): EmbeddingResponse
    {
        $this->checkEmbeddingSupport();
        $sendMsgGPTDTO = new EmbeddingsDTO();
        $sendMsgGPTDTO->setModel($this->model);
        $sendMsgGPTDTO->setInput($input);
        $sendMsgGPTDTO->setAccessToken($this->accessToken);
        $sendMsgGPTDTO->setUser($user);
        $sendMsgGPTDTO->setBusinessParams($businessParams);
        return di(LLMAppService::class)->embeddings($sendMsgGPTDTO);
    }

    /**
     * @throws LLMEmbeddingNotSupportedException
     */
    public function embedding(array|string $input, ?string $encoding_format = 'float', ?string $user = null, array $businessParams = []): Embedding
    {
        $response = $this->embeddings($input, $encoding_format, $user, $businessParams);
        // 从响应中提取嵌入向量
        $embeddings = [];
        foreach ($response->getData() as $embedding) {
            $embeddings[] = $embedding->getEmbedding();
        }
        return new Embedding($embeddings[0] ?? []);
    }

    /**
     * @param MessageInterface[] $messages 消息
     * @throws LLMFunctionCallNotSupportedException
     * @throws LLMModalityNotSupportedException
     */
    public function chatStream(
        array $messages,
        float $temperature = 0.9,
        int $maxTokens = 0,
        array $stop = [],
        array $tools = [],
        float $frequencyPenalty = 0.0,
        float $presencePenalty = 0.0,
        array $businessParams = [],
    ): ChatCompletionStreamResponse {
        $this->checkFunctionCallSupport($tools);
        $this->checkMultiModalSupport($messages);
        return $this->modelChat($messages, $temperature, $maxTokens, $stop, $tools, $businessParams, true);
    }

    /**
     * @param MessageInterface[] $messages 消息
     * @throws LLMFunctionCallNotSupportedException
     * @throws LLMModalityNotSupportedException
     */
    public function chat(
        array $messages,
        float $temperature = 0.9,
        int $maxTokens = 0,
        array $stop = [],
        array $tools = [],
        float $frequencyPenalty = 0.0,
        float $presencePenalty = 0.0,
        array $businessParams = [],
    ): ChatCompletionResponse {
        $this->checkFunctionCallSupport($tools);
        $this->checkMultiModalSupport($messages);
        return $this->modelChat($messages, $temperature, $maxTokens, $stop, $tools, $businessParams);
    }

    public function completions(string $prompt, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = []): TextCompletionResponse
    {
        $sendMsgGPTDTO = new CompletionDTO();
        $sendMsgGPTDTO->setAccessToken($this->accessToken);
        $sendMsgGPTDTO->setModel($this->model);
        $sendMsgGPTDTO->setTemperature($temperature);
        $sendMsgGPTDTO->setPrompt($prompt);
        $sendMsgGPTDTO->setStop($stop);
        $sendMsgGPTDTO->setMaxTokens($maxTokens);
        $sendMsgGPTDTO->setBusinessParams($businessParams);

        return di(LLMAppService::class)->chatCompletion($sendMsgGPTDTO);
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    /**
     * @throws LLMInvalidApiKeyException
     * @throws LLMInvalidEndpointException
     */
    protected function getClient(): ClientInterface
    {
        $config = $this->config;
        $this->processApiBaseUrl($config);

        $openAI = new OpenAI();
        $config = new OpenAIConfig(
            apiKey: $config['access_token'] ?? '',
            organization: '',
            baseUrl: 'http://127.0.0.1:9501',
        );
        return $openAI->getClient($config, $this->getApiRequestOptions(), $this->logger);
    }

    private function modelChat(
        array $messages,
        float $temperature = 0.9,
        int $maxTokens = 0,
        array $stop = [],
        array $tools = [],
        array $businessParams = [],
        bool $stream = false,
    ): ChatCompletionResponse|ChatCompletionStreamResponse {
        $messageList = [];
        foreach ($messages as $message) {
            if (! $message instanceof MessageInterface) {
                continue;
            }
            $messageList[] = $message->toArray();
        }
        $sendMsgGPTDTO = new CompletionDTO();
        $sendMsgGPTDTO->setAccessToken($this->accessToken);
        $sendMsgGPTDTO->setModel($this->model);
        $sendMsgGPTDTO->setTemperature($temperature);
        $sendMsgGPTDTO->setTools(ToolUtil::filter($tools));
        $sendMsgGPTDTO->setStop($stop);
        $sendMsgGPTDTO->setMaxTokens($maxTokens);
        $sendMsgGPTDTO->setMessages($messageList);
        $sendMsgGPTDTO->setStream($stream);
        $sendMsgGPTDTO->setBusinessParams($businessParams);

        return di(LLMAppService::class)->chatCompletion($sendMsgGPTDTO);
    }
}
