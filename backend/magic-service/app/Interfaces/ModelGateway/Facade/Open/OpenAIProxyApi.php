<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\ImageLLMAppService;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageEditDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageSearchRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\SearchRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\Dto\WebScrapeRequestDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\ModelGateway\Assembler\LLMAssembler;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;

class OpenAIProxyApi extends AbstractOpenApi
{
    #[Inject]
    protected LLMAppService $llmAppService;

    #[Inject]
    protected ImageLLMAppService $imageLLMAppService;

    public function chatCompletions(RequestInterface $request)
    {
        $requestData = $request->all();
        $sendMsgGPTDTO = new CompletionDTO($requestData);
        $sendMsgGPTDTO->setAccessToken($this->getAccessToken());
        $sendMsgGPTDTO->setIps($this->getClientIps());

        $this->enrichRequestDTO($sendMsgGPTDTO, $request->getHeaders());

        $response = $this->llmAppService->chatCompletion($sendMsgGPTDTO);
        if ($response instanceof ChatCompletionStreamResponse) {
            LLMAssembler::createStreamResponseByChatCompletionResponse($sendMsgGPTDTO, $response);
            return [];
        }
        if ($response instanceof ChatCompletionResponse) {
            return LLMAssembler::createResponseByChatCompletionResponse($response, $sendMsgGPTDTO->getModel());
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

        $this->enrichRequestDTO($embeddingDTO, $request->getHeaders());
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
        $type = $this->request->input('type', '');
        $businessParams = $this->getBusinessParamsFromContext();

        $list = $this->llmAppService->models($accessToken, $withInfo, $type, $businessParams);
        return LLMAssembler::createModels($list, $withInfo);
    }

    public function textGenerateImage(RequestInterface $request)
    {
        $requestData = $request->all();
        $textGenerateImageDTO = new TextGenerateImageDTO($requestData);
        $textGenerateImageDTO->setAccessToken($this->getAccessToken());
        $textGenerateImageDTO->setIps($this->getClientIps());

        $textGenerateImageDTO->valid();
        $this->enrichRequestDTO($textGenerateImageDTO, $request->getHeaders());
        return $this->llmAppService->textGenerateImage($textGenerateImageDTO);
    }

    public function imageEdit(RequestInterface $request)
    {
        $requestData = $request->all();

        $imageEditDTO = new ImageEditDTO($requestData);
        $imageEditDTO->setAccessToken($this->getAccessToken());
        $imageEditDTO->setIps($this->getClientIps());

        $imageEditDTO->valid();
        $this->enrichRequestDTO($imageEditDTO, $request->getHeaders());
        return $this->llmAppService->imageEdit($imageEditDTO);
    }

    public function textGenerateImageV2(RequestInterface $request)
    {
        $requestData = $request->all();
        $textGenerateImageDTO = new TextGenerateImageDTO($requestData);
        $textGenerateImageDTO->setAccessToken($this->getAccessToken());
        $textGenerateImageDTO->setIps($this->getClientIps());

        $textGenerateImageDTO->valid();
        $this->enrichRequestDTO($textGenerateImageDTO, $request->getHeaders());
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

        $this->enrichRequestDTO($imageEditDTO, $request->getHeaders());
        $response = $this->llmAppService->textGenerateImageV2($imageEditDTO);
        if ($response instanceof OpenAIFormatResponse) {
            return $response->toArray();
        }
        return null;
    }

    /**
     * Image convert high definition endpoint.
     *
     * POST /v2/images/convert-high
     *
     * Request Body (JSON):
     * - images: Array of source image URLs to convert (required, at least one image)
     *
     * Headers:
     * - Authorization: Bearer {access_token}
     *
     * @return array Response with converted image URL
     */
    public function imageConvertHigh(RequestInterface $request): array
    {
        $requestData = $request->all();

        $imageConvertHighDTO = new ImageConvertHighDTO($requestData);
        $imageConvertHighDTO->setAccessToken($this->getAccessToken());
        $imageConvertHighDTO->setIps($this->getClientIps());

        $imageConvertHighDTO->valid();
        $this->enrichRequestDTO($imageConvertHighDTO, $request->getHeaders());

        $response = $this->imageLLMAppService->imageConvertHighV2($imageConvertHighDTO);
        return $response->toArray();
    }

    /**
     * Web scrape proxy - returns unified format response.
     *
     * POST /v2/web-scrape
     *
     * Request Body (JSON):
     * - url: Target URL to scrape (required)
     * - formats: Output formats array (optional, default: ['TEXT'])
     * - mode: Scrape mode (optional, default: 'quality')
     * - options: Additional options (optional)
     *
     * Headers:
     * - Authorization: Bearer {access_token}
     *
     * @return array Unified response format
     */
    public function webScrape(RequestInterface $request): array
    {
        // 1. Get request data
        $requestData = $request->all();

        // 2. Create WebScrapeRequestDTO
        $webScrapeRequestDTO = WebScrapeRequestDTO::createDTO($requestData);
        $webScrapeRequestDTO->setAccessToken($this->getAccessToken());
        $webScrapeRequestDTO->setIps($this->getClientIps());
        $this->enrichRequestDTO($webScrapeRequestDTO, $request->getHeaders());
        $webScrapeRequestDTO->validate();
        // 3. Call LLMAppService with DTO and return array directly
        return $this->llmAppService->webScrape($webScrapeRequestDTO);
    }

    /**
     * Bing search proxy - returns native Bing API format.
     *
     * @deprecated Use unifiedSearch() instead (/v2/search). This endpoint will be removed in a future version.
     *
     * GET /v1/search
     *
     * Query Parameters:
     * - query: Search keywords (required)
     * - count: Number of results (optional, default: 10, max: 50)
     * - offset: Pagination offset (optional, default: 0, max: 1000)
     * - mkt: Market code (optional, default: zh-CN)
     * - set_lang: UI language (optional)
     * - safe_search: Safe search level (optional, Strict/Moderate/Off)
     * - freshness: Time filter (optional, Day/Week/Month)
     *
     * Headers:
     * - Authorization: Bearer {access_token}
     *
     * @return array Native Bing API response
     */
    public function bingSearch(RequestInterface $request): array
    {
        // 1. Get query parameters - support both Bing native and underscore naming
        $query = (string) ($request->input('q') ?: $request->input('query', ''));
        $count = (int) $request->input('count', 10);
        $offset = (int) $request->input('offset', 0);
        $mkt = (string) $request->input('mkt', 'zh-CN');
        $setLang = (string) ($request->input('setLang') ?: $request->input('set_lang', ''));
        $safeSearch = (string) ($request->input('safeSearch') ?: $request->input('safe_search', ''));
        $freshness = (string) $request->input('freshness', '');

        // 2. Get access token and business params
        $accessToken = $this->getAccessToken();
        $businessParams = $this->getBusinessParamsFromContext();

        // 3. Call LLMAppService
        return $this->llmAppService->bingSearch(
            $accessToken,
            $query,
            $count,
            $offset,
            $mkt,
            $setLang,
            $safeSearch,
            $freshness,
            $businessParams
        );
    }

    /**
     * Unified search proxy - supports multiple search engines, returns Bing-compatible format.
     *
     * GET /v2/search
     *
     * Query Parameters:
     * - query or q: Search keywords (required)
     * - count: Number of results (optional, default: 10, max: 50)
     * - offset: Pagination offset (optional, default: 0, max: 1000)
     * - mkt: Market code (optional, default: zh-CN)
     * - set_lang or setLang: UI language (optional)
     * - safe_search or safeSearch: Safe search level (optional, Strict/Moderate/Off)
     * - freshness: Time filter (optional, Day/Week/Month)
     *
     * Search Provider:
     * - Actual provider is selected by the platform web_search ability configuration
     * - Supported providers include bing, baidu, google, tavily, duckduckgo, jina, cloudsway, magic
     *
     * Headers:
     * - Authorization: Bearer {access_token}
     *
     * @return array native API response
     */
    public function unifiedSearch(RequestInterface $request): array
    {
        // 1. Get request data
        $requestData = $request->all();

        // 2. Create SearchRequestDTO
        $searchRequestDTO = SearchRequestDTO::createDTO($requestData);
        $searchRequestDTO->setAccessToken($this->getAccessToken());
        $searchRequestDTO->setIps($this->getClientIps());

        $this->enrichRequestDTO($searchRequestDTO, $request->getHeaders());

        // 3. Call LLMAppService with unified search and return array directly
        return $this->llmAppService->unifiedSearch($searchRequestDTO)->toArray();
    }

    /**
     * Image search proxy - supports multiple providers (Bing, Google via SerpApi), returns unified format.
     *
     * GET /v2/image-search
     *
     * Query Parameters:
     * - query or q: Search query (required)
     * - count: Number of results (optional, default: 10, max: 50)
     * - offset: Pagination offset (optional, default: 0, max: 1000)
     *
     * Headers:
     * - Authorization: Bearer {access_token}
     *
     * @return array unified API response
     */
    public function imageSearch(RequestInterface $request): array
    {
        // 1. Get request data
        $requestData = $request->all();

        // 2. Create ImageSearchRequestDTO
        $imageSearchRequestDTO = ImageSearchRequestDTO::createDTO($requestData);
        $imageSearchRequestDTO->setAccessToken($this->getAccessToken());
        $imageSearchRequestDTO->setIps($this->getClientIps());

        $this->enrichRequestDTO($imageSearchRequestDTO, $request->getHeaders());

        // 3. Call LLMAppService with image search and return array directly
        return $this->llmAppService->imageSearch($imageSearchRequestDTO)->toArray();
    }

    /**
     * 从协程上下文获取业务参数（用户授权信息）.
     *
     * 该方法从协程上下文中获取 MagicUserAuthorization，提取 user_id 和 organization_code。
     * 适用于不使用 DTO 的接口（如 models、bingSearch）。
     *
     * @return array 包含 user_id、organization_id、organization_code 的业务参数数组
     */
    private function getBusinessParamsFromContext(): array
    {
        $businessParams = [];

        $magicUserAuthorization = RequestCoContext::getUserAuthorization();
        if (! $magicUserAuthorization instanceof MagicUserAuthorization) {
            return $businessParams;
        }

        $userId = $magicUserAuthorization->getId();
        $organizationCode = $magicUserAuthorization->getOrganizationCode();

        if ($userId !== '') {
            $businessParams['user_id'] = $userId;
        }

        if ($organizationCode !== '') {
            $businessParams['organization_id'] = $organizationCode;
            $businessParams['organization_code'] = $organizationCode;
        }

        return $businessParams;
    }

    /**
     * 丰富请求 DTO，设置请求头配置和业务参数.
     *
     * 该方法会执行以下操作：
     * 1. 将请求头转换为小写键名的配置数组，并设置到 DTO 的 headerConfigs
     * 2. 从 header 中提取业务参数
     * 3. 从协程上下文中获取用户授权信息，添加到业务参数
     * 4. 从协程上下文获取 API-Key（如果 DTO 中未设置）
     *
     * @param AbstractRequestDTO $abstractRequestDTO 待配置的请求 DTO
     * @param array $headers 请求头数组
     */
    private function enrichRequestDTO(AbstractRequestDTO $abstractRequestDTO, array $headers): void
    {
        // 1. 设置请求头配置
        $headerConfigs = RequestUtil::normalizeHeaders($headers);
        $abstractRequestDTO->setHeaderConfigs($headerConfigs);

        // 2. 从 header 中提取业务参数
        $this->addBusinessParamsFromHeaders($abstractRequestDTO, $headerConfigs);

        // 3. 从协程上下文获取用户授权信息，并设置业务参数
        $contextParams = $this->getBusinessParamsFromContext();
        foreach ($contextParams as $key => $value) {
            $abstractRequestDTO->addBusinessParam($key, $value);
        }

        // 4. 从协程上下文获取 API-Key（如果 DTO 中未设置）
        if (empty($abstractRequestDTO->getAccessToken()) && RequestCoContext::hasApiKey()) {
            $abstractRequestDTO->setAccessToken(RequestCoContext::getApiKey());
        }
    }

    /**
     * 从请求头中提取业务参数并添加到 DTO.
     * @todo 为了安全，后续要移除组织编码/用户 id 的请求头获取。 最后要移除 除 business_id 以外的请求头获取。
     */
    private function addBusinessParamsFromHeaders(AbstractRequestDTO $abstractRequestDTO, array $headerConfigs): void
    {
        $mapping = [
            'business_id' => 'business_id',
            'magic-topic-id' => 'magic_topic_id',
            'magic-chat-topic-id' => 'magic_chat_topic_id',
            'magic-task-id' => 'magic_task_id',
            'magic-language' => 'language',
            'magic-organization-code' => 'organization_id',
            'magic-user-id' => 'user_id',
        ];

        foreach ($mapping as $headerKey => $paramKey) {
            $value = $headerConfigs[$headerKey] ?? '';
            if ($value !== '') {
                $abstractRequestDTO->addBusinessParam($paramKey, $value);
            }
        }
    }
}
