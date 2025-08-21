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
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessageV2;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\QuestionItem;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\QuestionSearchResult;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\SearchDetailItem;
use App\Domain\Chat\DTO\Message\StreamMessage\FinishedReasonEnum;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamOptions;
use App\Domain\Chat\DTO\Stream\CreateStreamSeqDTO;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Chat\Entity\ValueObject\AISearchCommonQueryVo;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicLLMDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\HTMLReader;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Time\TimeUtil;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Exception\ParallelExecutionException;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Channel;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Psr\Log\LoggerInterface;
use RedisException;
use Throwable;

/**
 * 聊天消息相关.
 */
class MagicChatAISearchV2AppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicLLMDomainService $magicLLMDomainService,
        private readonly IdGeneratorInterface $idGenerator,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly Redis $redis
    ) {
        $this->logger = di()->get(LoggerFactory::class)->get('aggregate_ai_search_card_v2');
    }

    /**
     * @throws Throwable
     */
    public function aggregateSearch(MagicChatAggregateSearchReqDTO $dto): void
    {
        $conversationId = $dto->getConversationId();
        $topicId = $dto->getTopicId();
        $searchKeyword = $dto->getUserMessage();
        // ai准备开始发消息了,结束输入状态
        $this->magicConversationDomainService->agentOperateConversationStatusV2(
            ControlMessageType::EndConversationInput,
            $conversationId,
            $topicId,
        );
        $this->logger->info(sprintf('mindSearch aggregateSearch 开始聚合搜索  searchKeyword：%s 搜索类型：%s', $searchKeyword, $dto->getSearchDeepLevel()->name));
        $antiRepeatKey = md5($conversationId . $topicId);
        // 防重:如果同一会话同一话题下,2秒内有重复的消息,不触发流程
        if (! $this->redis->set($antiRepeatKey, '1', ['nx', 'ex' => 2])) {
            return;
        }
        // magic-api 二期要求传入用户 id
        $agentConversationEntity = $this->magicConversationDomainService->getConversationByIdWithoutCheck($conversationId);
        if (! $agentConversationEntity) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 计费用，传入的是触发助理的用户 id和组织 code
        $dto->setUserId($agentConversationEntity->getReceiveId());
        $dto->setOrganizationCode($agentConversationEntity->getReceiveOrganizationCode());
        if (empty($dto->getRequestId())) {
            $requestId = CoContext::getRequestId() ?: (string) $this->idGenerator->generate();
            CoContext::setRequestId($requestId);
            $dto->setRequestId($requestId);
        }
        $dto->setAppMessageId(IdGenerator::getUniqueIdSha256());

        try {
            # 初始化流式消息并发送搜索深度
            $this->initStreamAndSendSearchDeepLevel($dto);
            // 获取 im 中指定会话下某个话题的历史消息，作为 llm 的历史消息
            $rawHistoryMessages = $this->getMagicChatMessages($dto->getConversationId(), $dto->getTopicId());
            $dto->setMagicChatMessageHistory($rawHistoryMessages);

            # 2.搜索用户问题.这里一定会拆分一次关联问题
            $searchDetailItems = $this->searchUserQuestion($dto);
            # 3.根据原始问题 + 搜索结果，按多个维度拆解关联问题.
            // 3.1 生成关联问题并发送给前端
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $searchDetailItems);
            $associateQuestions = $this->generateAndSendAssociateQuestions($dto, $associateQuestionsQueryVo, AggregateAISearchCardMessageV2::NULL_PARENT_ID);
            // 3.2 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
            $noRepeatSearchContexts = $this->generateSearchResults($dto, $associateQuestions);

            // 3.4 根据搜索深度，决定是否继续搜索关联问题的子问题
            $readPagesDetailChannel = new Channel(count($associateQuestions));
            // 3.4.a 深度搜索
            if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
                $this->deepSearch($dto, $associateQuestions, $noRepeatSearchContexts, $readPagesDetailChannel);
            } else {
                // 3.4.b 简单搜索
                $readPagesDetailChannel = null;
                $this->simpleSearch($dto, $associateQuestions, $noRepeatSearchContexts);
            }
            // 使用 channel 通信，精读过程中就推送消息给前端
            $associateQuestionIds = [];
            foreach ($associateQuestions as $associateQuestion) {
                $associateQuestionIds[] = $associateQuestion->getQuestionId();
            }
            $this->sendLLMResponseForAssociateQuestions($dto, $associateQuestionIds, $readPagesDetailChannel);
            // 4. 根据每个关联问题回复，生成总结.
            $summarize = $this->generateAndSendSummary($dto, $noRepeatSearchContexts, $associateQuestions);
            // 5. 根据总结，生成额外内容（思维导图、PPT、事件等）
            if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
                $this->generateAndSendExtra($dto, $noRepeatSearchContexts, $summarize);
            }
            // 6. 发送ping pong响应,代表结束回复
            $this->streamSendDeepSearchMessages($dto, [], StreamMessageStatus::Completed);
        } catch (Throwable $e) {
            // 7. 发生异常时，发送终止消息，并抛出异常
            $this->streamSendDeepSearchMessages($dto, [], StreamMessageStatus::Completed);
            $errMsg = [
                'function' => 'aggregateSearchError',
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ];
            $this->logger->error('mindSearch ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            throw $e;
        }
    }

    /**
     * 麦吉互联网搜索简单版，适配流程，仅支持简单搜索.
     * @throws Throwable
     * @throws RedisException
     */
    public function easyInternetSearch(MagicChatAggregateSearchReqDTO $dto): ?MagicAggregateSearchSummaryDTO
    {
        $conversationId = $dto->getConversationId();
        $topicId = $dto->getTopicId();
        $searchKeyword = $dto->getUserMessage();
        $antiRepeatKey = md5($conversationId . $topicId . $searchKeyword);
        // 防重(不知道哪来的bug):如果同一会话同一话题下,2秒内有重复的消息,不触发流程
        if (! $this->redis->set($antiRepeatKey, '1', ['nx', 'ex' => 2])) {
            return null;
        }
        if (empty($dto->getRequestId())) {
            $requestId = CoContext::getRequestId() ?: (string) $this->idGenerator->generate();
            $dto->setRequestId($requestId);
        }
        $dto->setAppMessageId((string) $this->idGenerator->generate());

        try {
            // 1.搜索用户问题.这里一定会拆分一次关联问题
            $searchDetailItems = $this->searchUserQuestion($dto);

            // 2.根据原始问题 + 搜索结果，按多个维度拆解关联问题.
            // 2.1 生成关联问题
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $searchDetailItems);
            $associateQuestions = $this->generateAssociateQuestions($associateQuestionsQueryVo, AggregateAISearchCardMessageV2::NULL_PARENT_ID);
            // 2.2 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
            $noRepeatSearchContexts = $this->generateSearchResults($dto, $associateQuestions);

            // 3. 根据每个关联问题回复，生成总结.
            return $this->generateSummary($dto, $noRepeatSearchContexts, $associateQuestions);
        } catch (Throwable $e) {
            // 4. 发生异常时，记录报错
            $errMsg = [
                'function' => 'aggregateSearchError',
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ];
            $this->logger->error('mindSearch ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            throw $e;
        }
    }

    // 生成空关联问题的子问题

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    public function simpleSearch(
        MagicChatAggregateSearchReqDTO $dto,
        array $associateQuestions,
        array $noRepeatSearchContexts
    ): void {
        $start = microtime(true);
        $parallel = new Parallel(5);
        $associateQuestions = array_values($associateQuestions);

        // --- Start of new chunking logic ---
        $chunkedContexts = $this->chunkContexts($associateQuestions, $noRepeatSearchContexts);
        // --- End of new chunking logic ---

        foreach ($associateQuestions as $index => $associateQuestion) {
            $questionId = $associateQuestion->getQuestionId();
            $currentContextChunk = $chunkedContexts[$index] ?? [];

            $parallel->add(function () use (
                $questionId,
                $associateQuestion,
                $dto,
                $currentContextChunk // Use this chunk
            ) {
                $start = microtime(true);
                CoContext::setRequestId($dto->getRequestId());
                // 已生成关联问题，准备发送搜索结果
                // 由于这里是对所有维度汇总后再精读，因此丢失了每个维度的数量，只能随机生成。
                $pageCount = random_int(30, 60);
                $webSearchItem = new QuestionSearchResult([
                    'question_id' => $questionId,
                    'search' => $currentContextChunk, // Use the pre-calculated chunk
                    'page_count' => $pageCount,
                    'match_count' => random_int(1000, 5000),
                    'total_words' => $pageCount * random_int(50, 200),
                ]);
                $this->streamSendSearchWebPages($dto, $webSearchItem);
                $this->logger->info(sprintf(
                    'getSearchResults 关联问题：%s 的空白子问题生成并推送完毕 结束计时，耗时 %s 秒',
                    $associateQuestion->getQuestion(),
                    TimeUtil::getMillisecondDiffFromNow($start) / 1000
                ));
            });
        }
        $parallel->wait();
        $this->logger->info(sprintf(
            'getSearchResults 所有关联问题的空白子问题推送完毕 结束计时，耗时：%s 秒',
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    public function generateAndSendAssociateSubQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions
    ): void {
        $start = microtime(true);
        $parallel = new Parallel(5);
        $associateQuestions = array_values($associateQuestions);

        // --- Start of new chunking logic ---
        $chunkedContexts = $this->chunkContexts($associateQuestions, $noRepeatSearchContexts);
        // --- End of new chunking logic ---

        foreach ($associateQuestions as $index => $associateQuestion) { // $associateQuestion is QuestionItem
            $questionId = $associateQuestion->getQuestionId();
            $currentContextChunk = $chunkedContexts[$index] ?? []; // Get the pre-calculated chunk for this question

            $parallel->add(function () use (
                $questionId,
                $associateQuestion,
                $dto,
                $noRepeatSearchContexts, // Still needed for getAssociateQuestionsQueryVo
                $currentContextChunk     // New chunk for 'search'
            ) {
                CoContext::setRequestId($dto->getRequestId());
                $start = microtime(true);
                // Uses $noRepeatSearchContexts (the full list)
                $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $noRepeatSearchContexts, $associateQuestion->getQuestion());
                $associateQuestionsQueryVo->setMessageHistory(new MessageHistory());
                // 获取子问题
                $associateSubQuestions = $this->magicLLMDomainService->getRelatedQuestions($associateQuestionsQueryVo, 2, 3);
                $pageCount = random_int(30, 60);
                $onePageWords = random_int(200, 2000);
                $totalWords = $pageCount * $onePageWords;
                // todo 由于这里是对所有维度汇总后再精读，因此丢失了每个维度的数量，只能随机生成。
                $webSearchItem = new QuestionSearchResult([
                    'question_id' => $questionId,
                    'search_keywords' => $associateSubQuestions,
                    'search' => $currentContextChunk, // Use the pre-calculated chunk
                    'page_count' => $pageCount,
                    'match_count' => random_int(1000, 5000),
                    'total_words' => $totalWords,
                ]);
                $this->streamSendSearchWebPages($dto, $webSearchItem);

                $this->logger->info(sprintf(
                    'getSearchResults 关联问题：%s 的子问题 %s 生成并推送完毕 结束计时，耗时 %s 秒',
                    $associateQuestion->getQuestion(),
                    Json::encode($associateSubQuestions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    TimeUtil::getMillisecondDiffFromNow($start) / 1000
                ));
            });
        }
        $parallel->wait();
        $this->logger->info(sprintf(
            'getSearchResults 所有关联问题的子问题 生成并推送完毕 结束计时，耗时：%s 秒',
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
    }

    /**
     * @return array searchDetailItem 对象的二维数组形式，这里为了兼容和方便，不进行对象转换
     */
    public function searchUserQuestion(MagicChatAggregateSearchReqDTO $dto): array
    {
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $start = microtime(true);
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);
        $queryVo = (new AISearchCommonQueryVo())
            ->setUserMessage($dto->getUserMessage())
            ->setSearchEngine($dto->getSearchEngine())
            ->setFilterSearchContexts(false)
            ->setGenerateSearchKeywords(true)
            ->setMessageHistory($llmHistoryMessage)
            ->setConversationId($llmConversationId)
            ->setLanguage($dto->getLanguage())
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode())
            ->setModel($modelInterface);
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
     * 生成并发送关联问题.
     * @return QuestionItem[]
     */
    public function generateAndSendAssociateQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        AISearchCommonQueryVo $queryVo,
        string $questionParentId
    ): array {
        // 生成关联问题
        $associateQuestions = $this->generateAssociateQuestions($queryVo, $questionParentId);
        // 流式推送关联问题
        $this->sendAssociateQuestions($dto, $associateQuestions, $questionParentId);
        return $associateQuestions;
    }

    /**
     * 根据原始问题 + 搜索结果，按多个维度拆解问题.
     * @return QuestionItem[]
     */
    public function generateAssociateQuestions(AISearchCommonQueryVo $queryVo, string $parentQuestionId): array
    {
        $start = microtime(true);
        $relatedQuestions = [];
        try {
            $relatedQuestions = $this->magicLLMDomainService->getRelatedQuestions($queryVo, 3, 5);
        } catch (Throwable $exception) {
            $errMsg = [
                'function' => 'generateAndSendAssociateQuestionsError',
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ];
            $this->logger->error('mindSearch generateAndSendAssociateQuestionsError ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
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
    public function generateSearchResults(MagicChatAggregateSearchReqDTO $dto, array $associateQuestions): array
    {
        $start = microtime(true);
        // 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
        $searchKeywords = $this->getSearchKeywords($associateQuestions);
        $queryVo = (new AISearchCommonQueryVo())
            ->setSearchKeywords($searchKeywords)
            ->setSearchEngine($dto->getSearchEngine())
            ->setLanguage($dto->getLanguage());
        $allSearchContexts = $this->magicLLMDomainService->getSearchResults($queryVo)['search'] ?? [];
        // 过滤重复内容
        $noRepeatSearchContexts = [];
        if (! empty($allSearchContexts)) {
            // 清洗搜索结果中的重复项
            $modelInterface = $this->getChatModel($dto->getOrganizationCode());
            $queryVo = (new AISearchCommonQueryVo())
                ->setSearchKeywords($searchKeywords)
                ->setUserMessage($dto->getUserMessage())
                ->setModel($modelInterface)
                ->setConversationId((string) IdGenerator::getSnowId())
                ->setMessageHistory(new MessageHistory())
                ->setSearchContexts($allSearchContexts)
                ->setUserId($dto->getUserId())
                ->setOrganizationCode($dto->getOrganizationCode());
            // 与搜索关键词关联性最高且不重复的搜索结果
            $noRepeatSearchContexts = $this->magicLLMDomainService->filterSearchContexts($queryVo);
            $costMircoTime = TimeUtil::getMillisecondDiffFromNow($start);
            $this->logger->info(sprintf(
                'mindSearch getSearchResults filterSearchContexts 清洗搜索结果中的重复项 清洗前：%s 清洗后:%s 结束计时 累计耗时 %s 秒',
                count($allSearchContexts),
                count($noRepeatSearchContexts),
                $costMircoTime / 1000
            ));
        }
        if (empty($noRepeatSearchContexts)) {
            $noRepeatSearchContexts = $allSearchContexts;
        }
        // 数组转对象
        foreach ($noRepeatSearchContexts as &$searchContext) {
            if (! $searchContext instanceof SearchDetailItem) {
                $searchContext = new SearchDetailItem($searchContext);
            }
        }
        return $noRepeatSearchContexts;
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    public function generateAndSendSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions,
    ): MagicAggregateSearchSummaryDTO {
        // 由于是流式输出响应，因此让前端判断 ai 引用的搜索 url。
        CoContext::setRequestId($dto->getRequestId());
        // 移除 detail
        $noRepeatSearchData = [];
        foreach ($noRepeatSearchContexts as $searchDetailItem) {
            $noRepeatSearch = $searchDetailItem->toArray();
            // 前端不要网页详情，移除 detail，同时保留总结时的搜索详情
            unset($noRepeatSearch['detail']);
            $noRepeatSearchData[] = $noRepeatSearch;
        }
        $this->streamSendDeepSearchMessages($dto, ['no_repeat_search_details' => $noRepeatSearchData]);
        // 生成总结
        return $this->generateSummary($dto, $noRepeatSearchContexts, $associateQuestions);
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    public function generateSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions
    ): MagicAggregateSearchSummaryDTO {
        $searchKeywords = $this->getSearchKeywords($associateQuestions);
        $dto->setRequestId(CoContext::getRequestId());
        $summaryMessageId = (string) $this->idGenerator->generate();
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
        // 深度搜索的总结使用 deepseek-r1 模型
        if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode(), LLMModelEnum::DEEPSEEK_R1->value);
        } else {
            $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        }
        $queryVo->setModel($modelInterface);
        $summarizeCompletionResponse = $this->magicLLMDomainService->summarize($queryVo);
        // 流式响应
        $senderConversationEntity = $this->magicConversationDomainService->getConversationByIdWithoutCheck($dto->getConversationId());
        if ($senderConversationEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $streamOptions = (new StreamOptions())->setStream(true)->setStreamAppMessageId($summaryMessageId);
        $messageContent = new AggregateAISearchCardMessage();
        $messageContent->setStreamOptions($streamOptions);
        // 流式响应
        $summarizeStreamResponse = '';
        $messageDTO = new MagicMessageEntity();
        $messageDTO->setMessageType(ChatMessageType::AggregateAISearchCard)->setSenderId($senderConversationEntity->getUserId());
        $streamOptions->setStatus(StreamMessageStatus::Processing);
        $hasReasoningContent = false;
        $hasSummaryContent = false;
        $hasPushedReasoningContentFinished = false;
        /**
         * @var ChatCompletionChoice $choice
         */
        foreach ($summarizeCompletionResponse as $choice) {
            /** @var AssistantMessage $assistantMessage */
            $assistantMessage = $choice->getMessage();
            // 流式内容
            if ($assistantMessage->hasReasoningContent()) {
                // 流式推送思考或者总结过程
                $this->streamSendDeepSearchMessages($dto, ['summary.reasoning_content' => $assistantMessage->getReasoningContent()]);
                $hasReasoningContent = true;
            } else {
                $hasSummaryContent = true;
            }
            // 有思考内容，且思考内容结束，开始有总结，推送思考结束
            if ($hasReasoningContent && $hasSummaryContent && ! $hasPushedReasoningContentFinished) {
                $streamMessageKey = 'stream_options.steps_finished.summary.reasoning_content';
                $this->streamSendDeepSearchMessages($dto, [$streamMessageKey => [
                    'finished_reason' => FinishedReasonEnum::Finished->value,
                ]]);
                $hasPushedReasoningContentFinished = true;
            }
            // 先推送思考结束，再推送总结
            if ($hasSummaryContent && $assistantMessage->getContent() !== '') {
                // 流式推送思考或者总结过程
                $this->streamSendDeepSearchMessages($dto, ['summary.content' => $assistantMessage->getContent()]);
            }
        }
        // 推送总结结束
        $streamMessageKey = 'stream_options.steps_finished.summary.content';
        $this->streamSendDeepSearchMessages($dto, [$streamMessageKey => [
            'finished_reason' => FinishedReasonEnum::Finished,
        ]]);
        $this->logger->info(sprintf('getSearchResults 生成总结，结束计时，耗时：%s 秒', microtime(true) - $start));
        $summaryDTO = new MagicAggregateSearchSummaryDTO();
        $summaryDTO->setLlmResponse($summarizeStreamResponse);
        $summaryDTO->setSearchContext($noRepeatSearchContexts);
        return $summaryDTO;
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    public function generateAndSendExtra(MagicChatAggregateSearchReqDTO $dto, array $noRepeatSearchContexts, MagicAggregateSearchSummaryDTO $summarize): void
    {
        // 生成思维导图和PPT
        $extraContentParallel = new Parallel(3);
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        $extraContentParallel->add(function () use ($summarize, $dto, $modelInterface) {
            // odin 会修改 vo 对象中的值，避免污染，复制再传入
            CoContext::setRequestId($dto->getRequestId());
            // 思维导图
            $mindMapQueryVo = $this->getSearchVOByAggregateSearchDTO($dto, $summarize);
            $mindMapQueryVo->setModel($modelInterface);
            $mindMap = $this->generateAndSendMindMap($dto, $mindMapQueryVo);
            // ppt
            $pptQueryVo = $this->getSearchVOByAggregateSearchDTO($dto, $summarize);
            $pptQueryVo->setModel($modelInterface);
            $this->generateAndSendPPT($dto, $pptQueryVo, $mindMap);
        });

        // 生成事件
        $extraContentParallel->add(function () use ($dto, $noRepeatSearchContexts, $summarize, $modelInterface) {
            CoContext::setRequestId($dto->getRequestId());
            $eventQueryVo = $this->getSearchVOByAggregateSearchDTO($dto, $summarize);
            $eventQueryVo->setModel($modelInterface);
            $this->generateAndSendEvent($dto, $eventQueryVo, $noRepeatSearchContexts);
        });

        try {
            $extraContentParallel->wait();
        } catch (ParallelExecutionException $parallelExecutionException) {
            foreach ($parallelExecutionException->getThrowables() as $throwable) {
                // 仅记录
                $this->logger->error('error_during_tool_call', [
                    'function' => 'generateAndSendExtraError',
                    'error_message' => $throwable->getMessage(),
                    'error_code' => $throwable->getCode(),
                    'error_file' => $throwable->getFile(),
                    'error_line' => $throwable->getLine(),
                    'error_trace' => $throwable->getTraceAsString(),
                ]);
            }
            throw $parallelExecutionException;
        }
    }

    public function getUserInfo(string $senderUserId): ?MagicUserEntity
    {
        return $this->magicUserDomainService->getUserById($senderUserId);
    }

    protected function sendAssociateQuestions(MagicChatAggregateSearchReqDTO $dto, array $associateQuestions, string $parentQuestionId): void
    {
        // 将关联问题推送给前端
        $questionKey = AggregateAISearchCardMessageV2::QUESTION_DELIMITER . $parentQuestionId;
        $data = [];
        foreach ($associateQuestions as $questionItem) {
            $data[] = $questionItem->toArray();
        }
        $this->streamSendDeepSearchMessages($dto, ['associate_questions.' . $questionKey => $data]);
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

    protected function streamSendSearchWebPages(MagicChatAggregateSearchReqDTO $dto, QuestionSearchResult $webSearchItem): void
    {
        $webSearchItemArray = $webSearchItem->toArray();
        // 去掉 detail 字段
        foreach ($webSearchItemArray['search'] as &$searchItem) {
            if (! empty($searchItem['detail'])) {
                $searchItem['detail'] = null;
            }
        }
        unset($searchItem);
        $this->streamSendDeepSearchMessages($dto, ['search_web_pages' => [$webSearchItemArray]]);
    }

    /**
     * @throws Throwable
     */
    protected function generateAndSendPPT(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo, string $mindMap): void
    {
        $start = microtime(true);
        $ppt = $this->magicLLMDomainService->generatePPTFromMindMap($queryVo, $mindMap);
        $this->logger->info(sprintf(
            'getSearchResults 生成PPT，结束计时，耗时: %s 秒',
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
        # 流式消息推送
        $this->streamSendDeepSearchMessages($dto, ['ppt' => $ppt]);
    }

    /**
     * @throws Throwable
     */
    protected function generateAndSendMindMap(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo): string
    {
        $start = microtime(true);
        $mindMap = $this->magicLLMDomainService->generateMindMapFromMessage($queryVo);
        $this->logger->info(sprintf('getSearchResults 生成思维导图，结束计时，耗时: %s 秒', microtime(true) - $start));
        # 流式消息推送
        $this->streamSendDeepSearchMessages($dto, ['mind_map' => $mindMap]);
        return $mindMap;
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    protected function generateAndSendEvent(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo, array $noRepeatSearchContexts): void
    {
        $start = microtime(true);
        $events = $this->magicLLMDomainService->generateEventFromMessage($queryVo, $noRepeatSearchContexts);
        $this->logger->info(sprintf('getSearchResults 生成事件，结束计时，耗时: %s 秒', microtime(true) - $start));
        // 对象转数组
        $data = [];
        foreach ($events as $event) {
            $data[] = $event->toArray();
        }
        # 流式消息推送
        $this->streamSendDeepSearchMessages($dto, ['events' => $data]);
    }

    protected function streamSendDeepSearchMessages(
        MagicChatAggregateSearchReqDTO $dto,
        array $messageContent,
        ?StreamMessageStatus $streamMessageStatus = null
    ): void {
        $this->magicChatDomainService->streamSendJsonMessage(
            $dto->getAppMessageId(),
            $messageContent,
            $streamMessageStatus
        );
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
     * @throws Throwable
     */
    private function initStreamAndSendSearchDeepLevel(MagicChatAggregateSearchReqDTO $dto): void
    {
        $senderConversationEntity = $this->magicConversationDomainService->getConversationByIdWithoutCheck($dto->getConversationId());
        if ($senderConversationEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $messageContent = (new AggregateAISearchCardMessageV2())
            ->setStreamOptions(
                (new StreamOptions())->setStatus(StreamMessageStatus::Start)->setStream(true)
            );
        # 推送流式开始前生成一个 seq，标记流式开始，用于前端渲染占位
        $senderSeqEntity = $this->magicChatDomainService->createAndSendStreamStartSequence(
            (new CreateStreamSeqDTO())->setTopicId($dto->getTopicId())->setAppMessageId($dto->getAppMessageId()),
            $messageContent,
            $senderConversationEntity
        );
        $dto->setMagicSeqEntity($senderSeqEntity);

        // 开始更新 seq 的字段
        $this->streamSendDeepSearchMessages($dto, ['search_deep_level' => $dto->getSearchDeepLevel()->value]);
    }

    /**
     * 精读的过程中，隔随机时间推送一次关联问题搜索完毕给前端。
     * 完全精读完毕时，最后再推一次
     */
    private function sendLLMResponseForAssociateQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        array $associateQuestionIds,
        ?Channel $readPagesDetailChannel
    ): void {
        foreach ($associateQuestionIds as $questionId) {
            $readPagesDetailChannel && $readPagesDetailChannel->pop(15);
            # 推送每个子问题的搜索结束终止标识
            $questionKey = AggregateAISearchCardMessageV2::QUESTION_DELIMITER . $questionId;
            $streamMessageKey = 'stream_options.steps_finished.associate_questions.' . $questionKey;
            $this->streamSendDeepSearchMessages($dto, [$streamMessageKey => [
                'finished_reason' => FinishedReasonEnum::Finished,
            ]]);
        }
        // 推送父问题的搜索结束终止标识
        $streamMessageKey = 'stream_options.steps_finished.associate_questions.' . AggregateAISearchCardMessageV2::QUESTION_DELIMITER . '0';
        $this->streamSendDeepSearchMessages($dto, [$streamMessageKey => [
            'finished_reason' => FinishedReasonEnum::Finished,
        ]]);
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function getSearchPageDetails(array $noRepeatSearchContexts, array $associateQuestions, Channel $readPagesDetailChannel): void
    {
        $questionsNum = count($associateQuestions);
        $detailReadMaxNum = max(20, $questionsNum);
        $perReadResponseNum = intdiv($detailReadMaxNum, $questionsNum);
        // 限制并发请求数量
        $parallel = new Parallel(5);
        $timeStart = microtime(true);
        $currentDetailReadCount = 0;
        foreach ($noRepeatSearchContexts as $context) {
            $requestId = CoContext::getRequestId();
            $parallel->add(function () use ($context, $detailReadMaxNum, $requestId, &$currentDetailReadCount, $readPagesDetailChannel, $perReadResponseNum, &$questionsNum) {
                // 知乎读不了一点
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
                    // 根据精读进度，推送关联问题搜索完毕给前端
                    if (($currentDetailReadCount % $perReadResponseNum === 0) && $readPagesDetailChannel->isAvailable()) {
                        $readPagesDetailChannel->push(1, 5);
                        // 需要推送的次数减少
                        --$questionsNum;
                    }
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'mindSearch getSearchResults 获取详细内容时发生错误:%s,file:%s,line:%s trace:%s',
                        $e->getMessage(),
                        $e->getFile(),
                        $e->getLine(),
                        $e->getTraceAsString()
                    ));
                }
            });
        }
        $parallel->wait();
        // 如果还有需要推送的次数，循环推送
        while ($questionsNum > 0 && $readPagesDetailChannel->isAvailable()) {
            $readPagesDetailChannel->push(1, 5);
            --$questionsNum;
        }
        $this->logger->info(sprintf(
            'mindSearch getSearchResults 精读所有搜索结果 精读累计耗时：%s 秒',
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
        if (empty($searchKeyword)) {
            $searchKeyword = $dto->getUserMessage();
        }
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);
        $modelInterface = $this->getChatModel($dto->getOrganizationCode());
        return (new AISearchCommonQueryVo())
            ->setUserMessage($searchKeyword)
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

    private function getSearchVOByAggregateSearchDTO(MagicChatAggregateSearchReqDTO $dto, MagicAggregateSearchSummaryDTO $summarize): AISearchCommonQueryVo
    {
        $llmConversationId = (string) IdGenerator::getSnowId();
        $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($dto->getMagicChatMessageHistory(), $llmConversationId);
        return (new AISearchCommonQueryVo())
            ->setConversationId($llmConversationId)
            ->setUserMessage($dto->getUserMessage())
            ->setMessageHistory($llmHistoryMessage)
            ->appendLlmResponse($summarize->getLlmResponse())
            ->setSearchContexts($summarize->getSearchContext())
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode());
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function deepSearch(MagicChatAggregateSearchReqDTO $dto, array $associateQuestions, array &$noRepeatSearchContexts, Channel $readPagesDetailChannel): void
    {
        $timeStart = microtime(true);
        $parallel = new Parallel(2);
        $parallel->add(function () use ($dto, $noRepeatSearchContexts, $associateQuestions) {
            // 3.4.a.1 并行：根据关联问题和问题的简单搜索，生成关联问题的子问题.(关联问题的子问题只用于前端展示，目前不会根据子问题再次搜索+精读)
            $this->generateAndSendAssociateSubQuestions($dto, $noRepeatSearchContexts, $associateQuestions);
        });
        $parallel->add(function () use (&$noRepeatSearchContexts, $readPagesDetailChannel, $associateQuestions) {
            // 3.4.a.2 并行：精读关联问题搜索的网页详情
            $this->getSearchPageDetails($noRepeatSearchContexts, $associateQuestions, $readPagesDetailChannel);
        });
        $parallel->wait();
        $this->logger->info(sprintf(
            'mindSearch getSearchResults 生成关联问题的子问题，并精读所有搜索结果，结束 累计耗时：%s 秒',
            number_format(TimeUtil::getMillisecondDiffFromNow($timeStart) / 1000, 2)
        ));
    }

    /**
     * 获取 im中指定会话下某个话题的历史消息，作为 llm 的历史消息.
     */
    private function getMagicChatMessages(string $magicChatConversationId, string $topicId): array
    {
        $rawHistoryMessages = $this->magicChatDomainService->getLLMContentForAgent($magicChatConversationId, $topicId);
        // 取最后指定条数的对话记录
        return array_slice($rawHistoryMessages, -10);
    }

    private function getChatModel(string $orgCode, string $modelName = LLMModelEnum::DEEPSEEK_V3->value): ModelInterface
    {
        // 通过降级链获取模型名称
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($orgCode, $modelName);
        // 获取模型代理
        return di(ModelGatewayMapper::class)->getChatModelProxy($modelName, $orgCode);
    }

    /**
     * @param QuestionItem[] $associateQuestions
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function chunkContexts(array $associateQuestions, array $noRepeatSearchContexts): array
    {
        $numAssociateQuestions = count($associateQuestions);
        $numTotalContexts = count($noRepeatSearchContexts);
        $chunkedContexts = [];

        if ($numAssociateQuestions > 0) {
            if ($numTotalContexts > 0) {
                $chunkSize = (int) ceil($numTotalContexts / $numAssociateQuestions);
                $chunkSize = min($chunkSize, 5);
                $chunkedContexts = array_chunk($noRepeatSearchContexts, $chunkSize);
            }
        }
        return $chunkedContexts;
    }
}
