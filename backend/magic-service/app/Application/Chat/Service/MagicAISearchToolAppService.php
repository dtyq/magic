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
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Psr\Log\LoggerInterface;
use RedisException;
use Throwable;

/**
 * 深度搜索工具化，不再给用户推送消息，而是返回结果。
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
     * 执行互联网搜索（支持简单和深度搜索）.
     * @throws Throwable
     * @throws RedisException
     */
    public function executeInternetSearch(MagicChatAggregateSearchReqDTO $dto, bool $isDeepSearch, string $errorFunction): ?MagicAggregateSearchSummaryDTO
    {
        // 防重处理
        if (! $this->checkAndSetAntiRepeat($dto, $isDeepSearch)) {
            return null;
        }

        // 初始化DTO
        $this->initializeSearchDTO($dto);

        try {
            // 1.搜索用户问题.这里一定会拆分一次关联问题
            $searchDetailItems = $this->searchUserQuestion($dto);

            // 2.根据原始问题 + 搜索结果，按多个维度拆解关联问题.
            // 2.1 生成关联问题
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $searchDetailItems);
            $associateQuestions = $this->generateAssociateQuestions($associateQuestionsQueryVo, AggregateAISearchCardMessageV2::NULL_PARENT_ID);
            // 2.2 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
            $noRepeatSearchContexts = $this->generateSearchResults($dto, $associateQuestions);

            // 3. 深度搜索处理（如需要）- 必须在生成总结之前执行，确保详情被写入
            if ($isDeepSearch) {
                $this->deepSearch($noRepeatSearchContexts);
            }
            // 4. 根据每个关联问题回复，生成总结.
            return $this->generateSummary($dto, $noRepeatSearchContexts, $associateQuestions);
        } catch (Throwable $e) {
            $this->logSearchError($e, $errorFunction);
            throw $e;
        }
    }

    /**
     * @return array searchDetailItem 对象的二维数组形式，这里为了兼容和方便，不进行对象转换
     */
    protected function searchUserQuestion(MagicChatAggregateSearchReqDTO $dto): array
    {
        $start = microtime(true);
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $queryVo = $this->buildSearchQueryVo($dto, $modelInterface)
            ->setFilterSearchContexts(false)
            ->setGenerateSearchKeywords(true);

        // 根据用户的上下文，拆解子问题。需要理解用户想问什么，再去拆搜索关键词。
        $searchKeywords = $this->magicLLMDomainService->generateSearchKeywordsByUserInput($dto, $modelInterface);
        $queryVo->setSearchKeywords($searchKeywords);
        $searchDetailItems = $this->magicLLMDomainService->getSearchResults($queryVo)['search'] ?? [];
        $this->logger->info(sprintf(
            'getSearchResults searchUserQuestion 虚空拆解关键词并搜索用户问题 结束计时，耗时 %s 秒',
            microtime(true) - $start
        ));
        return $searchDetailItems;
    }

    /**
     * 根据原始问题 + 搜索结果，按多个维度拆解问题.
     * @return QuestionItem[]
     */
    protected function generateAssociateQuestions(AISearchCommonQueryVo $queryVo, string $parentQuestionId): array
    {
        $start = microtime(true);
        $relatedQuestions = [];
        try {
            $relatedQuestions = $this->magicLLMDomainService->getRelatedQuestions($queryVo, 3, 5);
        } catch (Throwable $exception) {
            $this->logSearchError($exception, 'generateAndSendAssociateQuestionsError');
        }
        $associateQuestions = $this->buildAssociateQuestions($relatedQuestions, $parentQuestionId);
        $this->logger->info(sprintf(
            'getSearchResults 问题：%s 关联问题: %s .根据原始问题 + 搜索结果，按多个维度拆解关联问题并推送完毕 结束计时，耗时 %s 秒',
            $queryVo->getUserMessage(),
            Json::encode($relatedQuestions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
        return $associateQuestions;
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @return SearchDetailItem[]
     * @throws Throwable
     */
    protected function generateSearchResults(MagicChatAggregateSearchReqDTO $dto, array $associateQuestions): array
    {
        $start = microtime(true);
        $searchKeywords = $this->getSearchKeywords($associateQuestions);

        // 根据关联问题，发起简单搜索（不拿网页详情)
        $searchQueryVo = (new AISearchCommonQueryVo())
            ->setSearchKeywords($searchKeywords)
            ->setSearchEngine($dto->getSearchEngine())
            ->setLanguage($dto->getLanguage());
        $allSearchContexts = $this->magicLLMDomainService->getSearchResults($searchQueryVo)['search'] ?? [];

        // 过滤重复或者与问题关联性不高的网页内容
        $noRepeatSearchContexts = $this->filterDuplicateSearchContexts($dto, $searchKeywords, $allSearchContexts, $start);

        // 数组转对象
        return $this->convertToSearchDetailItems($noRepeatSearchContexts);
    }

    /**
     * 生成搜索总结（统一方法，支持简单和深度搜索）.
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    protected function generateSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions
    ): MagicAggregateSearchSummaryDTO {
        $searchKeywords = $this->getSearchKeywords($associateQuestions);
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
        // 深度搜索的总结支持使用其他模型
        if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode(), LLMModelEnum::DEEPSEEK_V3->value);
        } else {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        }
        $queryVo->setModel($modelInterface);

        // 使用非流式总结方法
        $summarizeStreamResponse = $this->magicLLMDomainService->summarizeNonStreaming($queryVo);

        $this->logger->info(sprintf('getSearchResults generateSummary 生成总结，结束计时，耗时：%s 秒', microtime(true) - $start));

        // 格式化搜索上下文
        $formattedSearchContexts = $this->formatSearchContexts($noRepeatSearchContexts);

        $summaryDTO = new MagicAggregateSearchSummaryDTO();
        $summaryDTO->setLlmResponse($summarizeStreamResponse);
        $summaryDTO->setSearchContext($noRepeatSearchContexts);
        $summaryDTO->setFormattedSearchContext($formattedSearchContexts);
        return $summaryDTO;
    }

    protected function getUserInfo(string $senderUserId): ?MagicUserEntity
    {
        return $this->magicUserDomainService->getUserById($senderUserId);
    }

    /**
     * 格式化搜索上下文为API返回格式.
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
        $associateQuestions = [];
        foreach ($relatedQuestions as $question) {
            $associateQuestions[] = new QuestionItem([
                'parent_question_id' => $parentQuestionId,
                'question_id' => (string) IdGenerator::getSnowId(),
                'question' => $question,
            ]);
        }
        return $associateQuestions;
    }

    /**
     * 检查并设置防重复键.
     */
    private function checkAndSetAntiRepeat(MagicChatAggregateSearchReqDTO $dto, bool $isDeepSearch): bool
    {
        $conversationId = $dto->getConversationId();
        $topicId = $dto->getTopicId();
        $searchKeyword = $dto->getUserMessage();
        $suffix = $isDeepSearch ? 'deep_tool' : '';
        $antiRepeatKey = md5($conversationId . $topicId . $searchKeyword . $suffix);

        // 防重:如果同一会话同一话题下,2秒内有重复的消息,不触发流程
        return $this->redis->set($antiRepeatKey, '1', ['nx', 'ex' => 2]);
    }

    /**
     * 初始化搜索DTO.
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
     * 记录搜索错误日志.
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
     * 构建搜索查询VO的通用方法.
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
     * 过滤重复的搜索结果.
     */
    private function filterDuplicateSearchContexts(MagicChatAggregateSearchReqDTO $dto, array $searchKeywords, array $allSearchContexts, float $start): array
    {
        if (empty($allSearchContexts)) {
            return [];
        }

        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $filterQueryVo = (new AISearchCommonQueryVo())
            ->setSearchKeywords($searchKeywords)
            ->setUserMessage($dto->getUserMessage())
            ->setModel($modelInterface)
            ->setConversationId((string) IdGenerator::getSnowId())
            ->setMessageHistory(new MessageHistory())
            ->setSearchContexts($allSearchContexts)
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode());

        $noRepeatSearchContexts = $this->magicLLMDomainService->filterSearchContexts($filterQueryVo);
        $costMircoTime = TimeUtil::getMillisecondDiffFromNow($start);
        $this->logger->info(sprintf(
            'mindSearch getSearchResults filterSearchContexts 清洗搜索结果中的重复项 清洗前：%s 清洗后:%s 结束计时 累计耗时 %s 秒',
            count($allSearchContexts),
            count($noRepeatSearchContexts),
            $costMircoTime / 1000
        ));

        return empty($noRepeatSearchContexts) ? $allSearchContexts : $noRepeatSearchContexts;
    }

    /**
     * 将数组转换为SearchDetailItem对象
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
     * 深度搜索工具版本，只精读网页详情，不发送websocket消息.
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function deepSearch(
        array $noRepeatSearchContexts
    ): void {
        $timeStart = microtime(true);
        // 只精读网页详情，不生成关联问题的子问题
        $this->getSearchPageDetails($noRepeatSearchContexts);
        $this->logger->info(sprintf(
            'mindSearch deepSearchForTool 精读所有搜索结果，结束 累计耗时：%s 秒',
            number_format(TimeUtil::getMillisecondDiffFromNow($timeStart) / 1000, 2)
        ));
    }

    /**
     * @param QuestionItem[] $associateQuestions
     */
    private function getSearchKeywords(array $associateQuestions): array
    {
        $searchKeywords = [];
        foreach ($associateQuestions as $questionItem) {
            $searchKeywords[] = $questionItem->getQuestion();
        }
        return $searchKeywords;
    }

    /**
     * 工具版本的精读网页详情方法，不使用Channel通信.
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function getSearchPageDetails(array $noRepeatSearchContexts): void
    {
        $timeStart = microtime(true);
        $detailReadMaxNum = max(20, count($noRepeatSearchContexts));
        // 限制并发请求数量
        $parallel = new Parallel(5);
        $currentDetailReadCount = 0;

        foreach ($noRepeatSearchContexts as $context) {
            $requestId = CoContext::getRequestId();
            $parallel->add(function () use ($context, $detailReadMaxNum, $requestId, &$currentDetailReadCount) {
                // 知乎读不了
                if (str_contains($context->getCachedPageUrl(), 'zhihu.com')) {
                    return;
                }
                // 只取指定数量网页的详细内容
                if ($currentDetailReadCount > $detailReadMaxNum) {
                    return;
                }
                CoContext::setRequestId($requestId);
                $htmlReader = make(HTMLReader::class);
                try {
                    // 用快照去拿内容！！
                    $content = $htmlReader->getText($context->getCachedPageUrl());
                    $content = mb_substr($content, 0, 2048);
                    $context->setDetail($content);
                    ++$currentDetailReadCount;
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'mindSearch getSearchPageDetailsForTool 获取详细内容时发生错误:%s,file:%s,line:%s trace:%s',
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
            'mindSearch getSearchPageDetailsForTool 精读网页详情完成，精读了 %d 个网页，耗时：%s 秒',
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
        // 通过降级链获取模型名称
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($orgCode, $modelName);
        // 如果依旧未获取到有效模型，则使用默认 DEEPSEEK_V3 防止空模型导致后续异常
        if ($modelName === '' || $modelName === null) {
            $modelName = LLMModelEnum::DEEPSEEK_V3->value;
        }
        // 获取模型代理
        return di(ModelGatewayMapper::class)->getChatModelProxy($modelName, $orgCode);
    }
}
