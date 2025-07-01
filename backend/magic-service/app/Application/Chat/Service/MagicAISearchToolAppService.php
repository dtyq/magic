<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\Domain\Chat\DTO\AISearch\Request\MagicChatAggregateSearchReqDTO;
use App\Domain\Chat\DTO\AISearch\Response\MagicAggregateSearchSummaryDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessageV2;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\QuestionItem;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\SearchDetailItem;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Chat\Entity\ValueObject\AISearchCommonQueryVo;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicLLMDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\HTMLReader;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Time\TimeUtil;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Parallel;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Psr\Log\LoggerInterface;
use RedisException;
use Throwable;

/**
 * Deep search tooling, no longer pushes messages to the user, but returns results.
 */
class MagicAISearchToolAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicLLMDomainService $magicLLMDomainService,
        private readonly IdGeneratorInterface $idGenerator,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly Redis $redis
    ) {
        $this->logger = di()->get(LoggerFactory::class)->get('aggregate_ai_search_card_v2');
    }

    /**
     * Execute internet search (supports simple and deep search).
     * @throws Throwable
     * @throws RedisException
     */
    public function executeInternetSearch(MagicChatAggregateSearchReqDTO $dto, bool $isDeepSearch, string $errorFunction): ?MagicAggregateSearchSummaryDTO
    {
        // Anti-duplication handling
        if (! $this->checkAndSetAntiRepeat($dto, $isDeepSearch)) {
            return null;
        }

        // Initialize DTO
        $this->initializeSearchDTO($dto);

        try {
            // 1. Search based on user's input message. This will deconstruct into keywords.
            $searchDetailItems = $this->searchFromUserMessage($dto);

            // 2. Deconstruct associated keywords in multiple dimensions based on the original input + search results.
            // 2.1 Generate associated keywords
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $searchDetailItems);
            $associateKeywords = $this->generateAssociateKeywords($associateQuestionsQueryVo, AggregateAISearchCardMessageV2::NULL_PARENT_ID);
            // 2.2 Initiate a simple search based on the associated keywords (without fetching web page details), and no longer filter duplicate content
            $allSearchContexts = $this->generateSearchResultsWithoutFilter($dto, $associateKeywords);

            // 3. Deep search processing (if needed) - get web page details
            if ($isDeepSearch) {
                $this->deepSearch($allSearchContexts);
            }

            // 4. Directly return web page details and list, no longer generate summary
            return $this->buildDirectResponse($allSearchContexts);
        } catch (Throwable $e) {
            $this->logSearchError($e, $errorFunction);
            throw $e;
        }
    }

    /**
     * @return array 2D array of searchDetailItem objects, here for compatibility and convenience, no object conversion is performed
     */
    protected function searchFromUserMessage(MagicChatAggregateSearchReqDTO $dto): array
    {
        $start = microtime(true);
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $queryVo = $this->buildSearchQueryVo($dto, $modelInterface)
            ->setFilterSearchContexts(false)
            ->setGenerateSearchKeywords(true);

        // Deconstruct sub-questions based on the user's context. Need to understand what the user wants to ask, then deconstruct search keywords.
        $searchKeywords = $this->magicLLMDomainService->generateSearchKeywordsByUserInput($dto, $modelInterface);
        $queryVo->setSearchKeywords($searchKeywords);
        $searchDetailItems = $this->magicLLMDomainService->getSearchResults($queryVo)['search'] ?? [];
        $this->logger->info(sprintf(
            'getSearchResults searchUserQuestion: Deconstructing keywords from user input and searching. End timing, took %s seconds',
            microtime(true) - $start
        ));
        return $searchDetailItems;
    }

    /**
     * Deconstruct keywords in multiple dimensions based on the original question + search results.
     * @return QuestionItem[]
     */
    protected function generateAssociateKeywords(AISearchCommonQueryVo $queryVo, string $parentQuestionId): array
    {
        $start = microtime(true);
        $relatedQuestions = [];
        try {
            $relatedQuestions = $this->magicLLMDomainService->getRelatedQuestions($queryVo, 3, 5);
        } catch (Throwable $exception) {
            $this->logSearchError($exception, 'generateAndSendAssociateQuestionsError');
        }
        $associateKeywords = $this->buildAssociateQuestions($relatedQuestions, $parentQuestionId);
        $this->logger->info(sprintf(
            'getSearchResults Question: %s Related questions: %s. Deconstructed and pushed associated questions based on original question + search results. End timing, took %s seconds',
            $queryVo->getUserMessage(),
            Json::encode($relatedQuestions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
        return $associateKeywords;
    }

    /**
     * Generate search results without filtering duplicate content (to improve response speed).
     * @param QuestionItem[] $associateKeywords
     * @return SearchDetailItem[]
     * @throws Throwable
     */
    protected function generateSearchResultsWithoutFilter(MagicChatAggregateSearchReqDTO $dto, array $associateKeywords): array
    {
        $start = microtime(true);
        $searchKeywords = $this->getSearchKeywords($associateKeywords);

        // Initiate a simple search based on the associated questions (without fetching web page details)
        $searchQueryVo = (new AISearchCommonQueryVo())
            ->setSearchKeywords($searchKeywords)
            ->setSearchEngine($dto->getSearchEngine())
            ->setLanguage($dto->getLanguage());
        $allSearchContexts = $this->magicLLMDomainService->getSearchResults($searchQueryVo)['search'] ?? [];

        // Limit to a maximum of 50 results
        if (count($allSearchContexts) > 50) {
            $allSearchContexts = array_slice($allSearchContexts, 0, 50);
        }

        $this->logger->info(sprintf(
            'generateSearchResultsWithoutFilter: Did not filter search results, limited to 50 results, actually returned %d results, took: %s seconds',
            count($allSearchContexts),
            microtime(true) - $start
        ));

        // Convert array to objects
        return $this->convertToSearchDetailItems($allSearchContexts);
    }

    /**
     * Generate search summary (unified method, supports simple and deep search).
     * @param QuestionItem[] $associateKeywords
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    protected function generateSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateKeywords
    ): MagicAggregateSearchSummaryDTO {
        $searchKeywords = $this->getSearchKeywords($associateKeywords);
        $dto->setRequestId(CoContext::getRequestId());
        $start = microtime(true);
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);
        $queryVo = (new AISearchCommonQueryVo())
            ->setUserMessage($dto->getUserMessage())
            ->setMessageHistory($llmHistoryMessage)
            ->setConversationId($llmConversationId)
            ->setSearchContexts($noRepeatSearchContexts)
            ->setSearchKeywords($searchKeywords)
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode());
        // Summary for deep search supports using other models
        if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode(), LLMModelEnum::DEEPSEEK_V3->value);
        } else {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        }
        $queryVo->setModel($modelInterface);

        // Use non-streaming summarization method
        $summarizeStreamResponse = $this->magicLLMDomainService->summarizeNonStreaming($queryVo);

        $this->logger->info(sprintf('getSearchResults generateSummary: Generated summary. End timing, took: %s seconds', microtime(true) - $start));

        // Format search context
        $formattedSearchContexts = $this->formatSearchContexts($noRepeatSearchContexts);

        $summaryDTO = new MagicAggregateSearchSummaryDTO();
        $summaryDTO->setLlmResponse($summarizeStreamResponse);
        $summaryDTO->setSearchContext($noRepeatSearchContexts);
        $summaryDTO->setFormattedSearchContext($formattedSearchContexts);
        return $summaryDTO;
    }

    /**
     * Directly build the response without generating a summary (to improve response speed).
     * @param SearchDetailItem[] $searchContexts
     */
    protected function buildDirectResponse(array $searchContexts): MagicAggregateSearchSummaryDTO
    {
        $start = microtime(true);

        // Concatenate all webpage details, limited to 60,000 characters
        $detailContents = [];
        $currentLength = 0;
        $maxLength = 60000; // Character limit
        $processedCount = 0;

        foreach ($searchContexts as $context) {
            $detail = $context->getDetail();
            if (! empty($detail)) {
                $detailLength = mb_strlen($detail, 'UTF-8');
                // Check if adding the current detail will exceed the limit
                if ($currentLength + $detailLength + 2 > $maxLength) { // +2 for the "\n\n" separator
                    // If it exceeds the limit, truncate the content to the remaining available length
                    $remainingLength = $maxLength - $currentLength - 2;
                    if ($remainingLength > 0) {
                        $truncatedDetail = mb_substr($detail, 0, $remainingLength, 'UTF-8');
                        $detailContents[] = $truncatedDetail;
                    }
                    break; // Reached the length limit, stop processing
                }
                $detailContents[] = $detail;
                $currentLength += $detailLength + 2; // +2 for the "\n\n" separator
            }
            ++$processedCount;
        }

        $concatenatedDetails = implode("\n\n", $detailContents);

        // Format search context
        $formattedSearchContexts = $this->formatSearchContexts($searchContexts);

        $this->logger->info(sprintf(
            'buildDirectResponse: Directly built response, returned %d search results, processed %d webpage details, total length of webpage details: %d characters (character limit applied), took: %s seconds',
            count($searchContexts),
            $processedCount,
            strlen($concatenatedDetails),
            microtime(true) - $start
        ));

        $summaryDTO = new MagicAggregateSearchSummaryDTO();
        $summaryDTO->setLlmResponse($concatenatedDetails); // Use concatenated details instead of LLM summary
        $summaryDTO->setSearchContext($searchContexts);
        $summaryDTO->setFormattedSearchContext($formattedSearchContexts);
        return $summaryDTO;
    }

    protected function getUserInfo(string $senderUserId): ?MagicUserEntity
    {
        return $this->magicUserDomainService->getUserById($senderUserId);
    }

    /**
     * Format search context for API response.
     * @param SearchDetailItem[] $searchContexts
     */
    protected function formatSearchContexts(array $searchContexts): array
    {
        $formattedContexts = [];
        foreach ($searchContexts as $context) {
            $formattedContexts[] = [
                'title' => $context->getName(),
                'url' => $context->getCachedPageUrl() ?: $context->getUrl(),
                'snippet' => $context->getSnippet(),
                'date_published' => $context->getDatePublished(),
            ];
        }
        return $formattedContexts;
    }

    /**
     * @param string[] $relatedQuestions
     * @return QuestionItem[]
     */
    protected function buildAssociateQuestions(array $relatedQuestions, string $parentQuestionId): array
    {
        $associateKeywords = [];
        foreach ($relatedQuestions as $question) {
            $associateKeywords[] = new QuestionItem([
                'parent_question_id' => $parentQuestionId,
                'question_id' => (string) IdGenerator::getSnowId(),
                'question' => $question,
            ]);
        }
        return $associateKeywords;
    }

    /**
     * Check and set anti-duplication key.
     */
    private function checkAndSetAntiRepeat(MagicChatAggregateSearchReqDTO $dto, bool $isDeepSearch): bool
    {
        $conversationId = $dto->getConversationId();
        $topicId = $dto->getTopicId();
        $searchKeyword = $dto->getUserMessage();
        $suffix = $isDeepSearch ? 'deep_tool' : '';
        $antiRepeatKey = md5($conversationId . $topicId . $searchKeyword . $suffix);

        // Anti-duplication: If there are duplicate messages in the same conversation and topic within 2 seconds, the process is not triggered
        return $this->redis->set($antiRepeatKey, '1', ['nx', 'ex' => 2]);
    }

    /**
     * Initialize search DTO.
     */
    private function initializeSearchDTO(MagicChatAggregateSearchReqDTO $dto): void
    {
        if (empty($dto->getRequestId())) {
            $requestId = CoContext::getRequestId() ?: (string) $this->idGenerator->generate();
            $dto->setRequestId($requestId);
        }
        $dto->setAppMessageId((string) $this->idGenerator->generate());
    }

    /**
     * Log search error.
     */
    private function logSearchError(Throwable $e, string $functionName): void
    {
        $errMsg = [
            'function' => $functionName,
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ];
        $logPrefix = $functionName === 'deepInternetSearchForToolError' ? 'mindSearch deepInternetSearchForTool' : 'mindSearch';
        $this->logger->error($logPrefix . ' ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Common method for building search query VO.
     */
    private function buildSearchQueryVo(MagicChatAggregateSearchReqDTO $dto, ModelInterface $modelInterface): AISearchCommonQueryVo
    {
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);

        return (new AISearchCommonQueryVo())
            ->setUserMessage($dto->getUserMessage())
            ->setSearchEngine($dto->getSearchEngine())
            ->setMessageHistory($llmHistoryMessage)
            ->setConversationId($llmConversationId)
            ->setLanguage($dto->getLanguage())
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode())
            ->setModel($modelInterface);
    }

    /**
     * Convert array to SearchDetailItem objects.
     */
    private function convertToSearchDetailItems(array $searchContexts): array
    {
        foreach ($searchContexts as &$searchContext) {
            if (! $searchContext instanceof SearchDetailItem) {
                $searchContext = new SearchDetailItem($searchContext);
            }
        }
        return $searchContexts;
    }

    /**
     * Deep search tool version, only reads webpage details, does not send websocket messages.
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function deepSearch(
        array $noRepeatSearchContexts
    ): void {
        $timeStart = microtime(true);
        // Only read webpage details, do not generate sub-questions for associated questions
        $this->getSearchPageDetails($noRepeatSearchContexts);
        $this->logger->info(sprintf(
            'mindSearch deepSearchForTool: Read all search results, finished. Total time: %s seconds',
            number_format(TimeUtil::getMillisecondDiffFromNow($timeStart) / 1000, 2)
        ));
    }

    /**
     * @param QuestionItem[] $associateKeywords
     */
    private function getSearchKeywords(array $associateKeywords): array
    {
        $searchKeywords = [];
        foreach ($associateKeywords as $questionItem) {
            $searchKeywords[] = $questionItem->getQuestion();
        }
        return $searchKeywords;
    }

    /**
     * Tool version of the method for reading webpage details, does not use Channel for communication.
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function getSearchPageDetails(array $noRepeatSearchContexts): void
    {
        $timeStart = microtime(true);
        $detailReadMaxNum = max(20, count($noRepeatSearchContexts));
        // Limit the number of concurrent requests
        $parallel = new Parallel(5);
        $currentDetailReadCount = 0;

        foreach ($noRepeatSearchContexts as $context) {
            $requestId = CoContext::getRequestId();
            $parallel->add(function () use ($context, $detailReadMaxNum, $requestId, &$currentDetailReadCount) {
                // Cannot read zhihu.com
                if (str_contains($context->getCachedPageUrl(), 'zhihu.com')) {
                    return;
                }
                // Only get the detailed content of a specified number of web pages
                if ($currentDetailReadCount > $detailReadMaxNum) {
                    return;
                }
                CoContext::setRequestId($requestId);
                $htmlReader = make(HTMLReader::class);
                try {
                    // Get content from snapshot!!
                    $content = $htmlReader->getText($context->getCachedPageUrl());
                    $content = mb_substr($content, 0, 2048);
                    $context->setDetail($content);
                    ++$currentDetailReadCount;
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'mindSearch getSearchPageDetailsForTool An error occurred while getting detailed content:%s,file:%s,line:%s trace:%s',
                        $e->getMessage(),
                        $e->getFile(),
                        $e->getLine(),
                        $e->getTraceAsString()
                    ));
                }
            });
        }
        $parallel->wait();

        $this->logger->info(sprintf(
            'mindSearch getSearchPageDetailsForTool: Finished reading webpage details, read %d webpages, took: %s seconds',
            $currentDetailReadCount,
            number_format(TimeUtil::getMillisecondDiffFromNow($timeStart) / 1000, 2)
        ));
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function getAssociateQuestionsQueryVo(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        string $searchKeyword = ''
    ): AISearchCommonQueryVo {
        $userMessage = empty($searchKeyword) ? $dto->getUserMessage() : $searchKeyword;
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);

        return (new AISearchCommonQueryVo())
            ->setUserMessage($userMessage)
            ->setSearchEngine($dto->getSearchEngine())
            ->setFilterSearchContexts(false)
            ->setGenerateSearchKeywords(false)
            ->setMessageHistory($llmHistoryMessage)
            ->setConversationId($llmConversationId)
            ->setModel($modelInterface)
            ->setSearchContexts($noRepeatSearchContexts)
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode());
    }

    private function getChatModel(string $orgCode, string $modelName = LLMModelEnum::DEEPSEEK_V3->value): ModelInterface
    {
        // Get the model name through the fallback chain
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($orgCode, $modelName);
        // If a valid model is still not obtained, use the default DEEPSEEK_V3 to prevent null model from causing subsequent exceptions
        if ($modelName === '' || $modelName === null) {
            $modelName = LLMModelEnum::DEEPSEEK_V3->value;
        }
        // Get the model proxy
        return di(ModelGatewayMapper::class)->getChatModelProxy($modelName, $orgCode);
    }
}
