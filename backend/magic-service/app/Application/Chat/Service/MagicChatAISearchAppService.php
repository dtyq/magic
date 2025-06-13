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
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\SearchDetailItem;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamOptions;
use App\Domain\Chat\DTO\Stream\CreateStreamSeqDTO;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\AggregateAISearchCardResponseType;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Chat\Entity\ValueObject\AISearchCommonQueryVo;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
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
use Hyperf\Coroutine\Coroutine;
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
use JetBrains\PhpStorm\ArrayShape;
use Psr\Log\LoggerInterface;
use RedisException;
use Throwable;

/**
 * 聊天消息相关.
 * @deprecated 使用 MagicChatAISearchV2AppService 代替
 */
class MagicChatAISearchAppService extends AbstractAppService
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
        $this->logger = di()->get(LoggerFactory::class)->get(get_class($this));
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
            $topicId
        );
        $this->logger->info(sprintf('mindSearch aggregateSearch 开始聚合搜索  searchKeyword：%s 搜索类型：%s', $searchKeyword, $dto->getSearchDeepLevel()->name));
        $antiRepeatKey = md5($conversationId . $topicId . $searchKeyword);
        // 防重(不知道哪来的bug):如果同一会话同一话题下,2秒内有重复的消息,不触发流程
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
        $dto->setAppMessageId((string) $this->idGenerator->generate());

        try {
            // 1.发送ping pong响应,代表开始回复
            $this->sendPingPong($dto);
            // 获取 im 中指定会话下某个话题的历史消息，作为 llm 的历史消息
            $rawHistoryMessages = $this->getMagicChatMessages($dto->getConversationId(), $dto->getTopicId());
            $dto->setMagicChatMessageHistory($rawHistoryMessages);
            // 3.0 发送搜索深度
            $this->sendSearchDeepLevel($dto);
            // 2.搜索用户问题.这里一定会拆分一次关联问题
            $simpleSearchResults = $this->searchUserQuestion($dto);
            // 3.根据原始问题 + 搜索结果，按多个维度拆解关联问题.
            // 3.1 生成关联问题并发送给前端
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $simpleSearchResults['search'] ?? []);
            $associateQuestions = $this->generateAndSendAssociateQuestions($dto, $associateQuestionsQueryVo, '0');
            // 3.2 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
            $noRepeatSearchContexts = $this->generateSearchResults($dto, $associateQuestions);
            $this->sleepToFixBug();
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
            $associateQuestionIds = array_keys($associateQuestions);
            $this->sendLLMResponseForAssociateQuestions($dto, $associateQuestionIds, $readPagesDetailChannel);
            $this->sleepToFixBug(0.3);
            // 4. 根据每个关联问题回复，生成总结.
            $summarize = $this->generateAndSendSummary($dto, $noRepeatSearchContexts, $associateQuestions);
            // 5. 根据总结，生成额外内容（思维导图、PPT、事件等）
            if ($dto->getSearchDeepLevel() === SearchDeepLevel::DEEP) {
                $this->generateAndSendExtra($dto, $noRepeatSearchContexts, $summarize);
            }
            // 6. 发送ping pong响应,代表结束回复
            $this->sendPingPong($dto);
        } catch (Throwable $e) {
            // 7. 发生异常时，发送终止消息，并抛出异常
            $this->aiSendMessage(
                $dto->getConversationId(),
                (string) $this->idGenerator->generate(),
                '0',
                AggregateAISearchCardResponseType::TERMINATE,
                [],
                $dto->getAppMessageId(),
                $dto->getTopicId(),
            );
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
            $simpleSearchResults = $this->searchUserQuestion($dto);

            // 2.根据原始问题 + 搜索结果，按多个维度拆解关联问题.
            // 2.1 生成关联问题
            $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $simpleSearchResults['search'] ?? []);
            $associateQuestions = $this->generateAssociateQuestions($associateQuestionsQueryVo);
            // 2.2 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
            $this->sleepToFixBug();
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
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    public function simpleSearch(
        MagicChatAggregateSearchReqDTO $dto,
        array $associateQuestions,
        array $noRepeatSearchContexts
    ): void {
        $start = microtime(true);
        $parallel = new Parallel(5);

        // --- Start of new chunking logic ---
        $chunkedContexts = $this->chunkContextsByAssociateQuestions($associateQuestions, $noRepeatSearchContexts);
        // --- End of new chunking logic ---

        $questionIndex = 0;

        foreach ($associateQuestions as $questionId => $associateQuestion) {
            $questionId = (string) $questionId;
            $currentContextChunk = $chunkedContexts[$questionIndex] ?? []; // Get the pre-calculated chunk for this question

            $parallel->add(function () use ($questionId, $associateQuestion, $dto, $currentContextChunk) {
                $start = microtime(true);
                CoContext::setRequestId($dto->getRequestId());
                // 已生成关联问题，准备发送搜索结果
                $pageCount = random_int(30, 60);
                $onePageWords = random_int(50, 200);
                $totalWords = $pageCount * $onePageWords;

                $this->aiSendMessage(
                    $dto->getConversationId(),
                    (string) $this->idGenerator->generate(),
                    $questionId,
                    AggregateAISearchCardResponseType::SEARCH,
                    [
                        'search_keywords' => [],
                        // 推送前 5 个搜索结果。 且兼容历史数据，key 使用小驼峰
                        'search' => $this->getSearchData($currentContextChunk),
                        'total_words' => $totalWords,
                        // 全网资料总计
                        'match_count' => random_int(1000, 5000),
                        // 获取摘要的网页数量
                        'page_count' => $pageCount,
                    ],
                    $dto->getAppMessageId(),
                    $dto->getTopicId()
                );
                $this->logger->info(sprintf(
                    'getSearchResults 关联问题：%s 的空白子问题生成并推送完毕 结束计时，耗时 %s 秒',
                    $associateQuestion['title'],
                    TimeUtil::getMillisecondDiffFromNow($start) / 1000
                ));
            });
            ++$questionIndex;
        }
        $parallel->wait();
        $this->logger->info(sprintf(
            'getSearchResults 所有关联问题的空白子问题推送完毕 结束计时，耗时：%s 秒',
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
    }

    /**
     * 根据关联问题和问题的简单搜索，生成关联问题的子问题.(关联问题的子问题目前只用于前端展示，不会根据子问题再次搜索+精读).
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    public function generateAndSendAssociateSubQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions
    ): void {
        $start = microtime(true);
        $parallel = new Parallel(5);

        // --- Start of new chunking logic ---
        $chunkedContexts = $this->chunkContextsByAssociateQuestions($associateQuestions, $noRepeatSearchContexts);
        // --- End of new chunking logic ---

        $questionIndex = 0;

        foreach ($associateQuestions as $questionId => $associateQuestion) {
            $questionId = (string) $questionId;
            $currentContextChunk = $chunkedContexts[$questionIndex] ?? []; // Get the pre-calculated chunk for this question

            $parallel->add(function () use ($questionId, $associateQuestion, $dto, $noRepeatSearchContexts, $currentContextChunk) {
                CoContext::setRequestId($dto->getRequestId());
                $start = microtime(true);
                $associateQuestionsQueryVo = $this->getAssociateQuestionsQueryVo($dto, $noRepeatSearchContexts, $associateQuestion['title']);
                $associateQuestionsQueryVo->setMessageHistory(new MessageHistory());
                $associateSubQuestions = $this->magicLLMDomainService->getRelatedQuestions($associateQuestionsQueryVo, 2, 3);
                // todo 由于这里是对所有维度汇总后再精读，因此丢失了每个维度的数量，只能随机生成。
                // 等待前端调整渲染 ui
                $pageCount = random_int(30, 60);
                $onePageWords = random_int(200, 2000);
                $totalWords = $pageCount * $onePageWords;
                $searchResult = [
                    'search_keywords' => $associateSubQuestions,
                    'search' => $this->getSearchData($currentContextChunk),
                    'total_words' => $totalWords,
                    // 全网资料总计
                    'match_count' => random_int(1000, 5000),
                    // 获取摘要的网页数量
                    'page_count' => $pageCount,
                ];
                // 已生成关联问题，准备发送搜索结果
                $this->aiSendMessage(
                    $dto->getConversationId(),
                    (string) $this->idGenerator->generate(),
                    $questionId,
                    AggregateAISearchCardResponseType::SEARCH,
                    $searchResult,
                    $dto->getAppMessageId(),
                    $dto->getTopicId()
                );
                $this->logger->info(sprintf(
                    'getSearchResults 关联问题：%s 的子问题 %s 生成并推送完毕 结束计时，耗时 %s 秒',
                    $associateQuestion['title'],
                    Json::encode($associateSubQuestions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    TimeUtil::getMillisecondDiffFromNow($start) / 1000
                ));
            });
            ++$questionIndex;
        }
        $parallel->wait();
        $this->logger->info(sprintf(
            'getSearchResults 所有关联问题的子问题 生成并推送完毕 结束计时，耗时：%s 秒',
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
    }

    #[ArrayShape([
        'search_keywords' => 'array',
        'search' => 'array',
        'total_words' => 'int',
        'match_count' => 'int',
        'page_count' => 'int',
    ])]
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
        $searchResult = $this->magicLLMDomainService->getSearchResults($queryVo);
        $this->logger->info(sprintf(
            'getSearchResults searchUserQuestion 虚空拆解关键词并搜索用户问题 结束计时，耗时 %s 秒',
            microtime(true) - $start
        ));
        return $searchResult;
    }

    /**
     * 生成并发送关联问题.
     * @throws Throwable
     */
    public function generateAndSendAssociateQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        AISearchCommonQueryVo $queryVo,
        string $questionParentId
    ): array {
        // 生成关联问题
        $associateQuestions = $this->generateAssociateQuestions($queryVo);
        // 将关联问题推送给前端
        $this->aiSendMessage(
            $dto->getConversationId(),
            (string) $this->idGenerator->generate(),
            $questionParentId,
            AggregateAISearchCardResponseType::ASSOCIATE_QUESTIONS,
            ['associate_questions' => $associateQuestions],
            $dto->getAppMessageId(),
            $dto->getTopicId(),
        );
        return $associateQuestions;
    }

    /**
     * 根据原始问题 + 搜索结果，按多个维度拆解问题.
     * @todo 支持传入维度的数量范围
     */
    public function generateAssociateQuestions(AISearchCommonQueryVo $queryVo): array
    {
        $associateQuestions = [];
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
        foreach ($relatedQuestions as $question) {
            $associateQuestions[(string) $this->idGenerator->generate()] = [
                'title' => $question,
                'llm_response' => null,
            ];
        }
        $this->logger->info(sprintf(
            'getSearchResults 问题：%s 关联问题: %s .根据原始问题 + 搜索结果，按多个维度拆解关联问题并推送完毕 结束计时，耗时 %s 秒',
            $queryVo->getUserMessage(),
            Json::encode($relatedQuestions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            TimeUtil::getMillisecondDiffFromNow($start) / 1000
        ));
        return $associateQuestions;
    }

    /**
     * @return SearchDetailItem[]
     * @throws Throwable
     */
    public function generateSearchResults(MagicChatAggregateSearchReqDTO $dto, array $associateQuestions): array
    {
        $start = microtime(true);
        // 根据关联问题，发起简单搜索（不拿网页详情),并过滤掉重复或者与问题关联性不高的网页内容
        $searchKeywords = array_column($associateQuestions, 'title');
        $queryVo = (new AISearchCommonQueryVo())
            ->setSearchKeywords($searchKeywords)
            ->setSearchEngine($dto->getSearchEngine())
            ->setLanguage($dto->getLanguage());
        $allSearchContexts = $this->magicLLMDomainService->getSearchResults($queryVo)['search'] ?? [];
        // 过滤重复内容
        $noRepeatSearchContexts = [];
        if (! empty($allSearchContexts)) {
            // 清洗搜索结果中的重复项
            $searchKeywords = array_column($associateQuestions, 'title');
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
        foreach ($noRepeatSearchContexts as $key => $noRepeatSearchContext) {
            if (! $noRepeatSearchContext instanceof SearchDetailItem) {
                $noRepeatSearchContexts[$key] = new SearchDetailItem($noRepeatSearchContext);
            }
        }
        return $noRepeatSearchContexts;
    }

    /**
     * @throws Throwable
     */
    public function sendSearchDeepLevel(MagicChatAggregateSearchReqDTO $dto): void
    {
        $this->aiSendMessage(
            $dto->getConversationId(),
            (string) $this->idGenerator->generate(),
            '0',
            AggregateAISearchCardResponseType::SEARCH_DEEP_LEVEL,
            ['search_deep_level' => $dto->getSearchDeepLevel()],
            $dto->getAppMessageId(),
            $dto->getTopicId()
        );
    }

    /**
     * 推送最后一个关联问题的 llm 响应结束标识.
     * @throws Throwable
     */
    public function sendAssociateQuestionResponse(MagicChatAggregateSearchReqDTO $dto, string $associateQuestionId): void
    {
        $content = ['llm_response' => '已经为您找到答案，请等待生成总结'];
        $this->aiSendMessage(
            $dto->getConversationId(),
            (string) $this->idGenerator->generate(),
            $associateQuestionId,
            AggregateAISearchCardResponseType::LLM_RESPONSE,
            $content,
            $dto->getAppMessageId(),
            $dto->getTopicId()
        );
    }

    /**
     * 精读的过程中，隔随机时间推送一次关联问题搜索完毕给前端。
     * 完全精读完毕时，最后再推一次
     * @throws Throwable
     */
    public function sendLLMResponseForAssociateQuestions(
        MagicChatAggregateSearchReqDTO $dto,
        array $associateQuestionIds,
        ?Channel $readPagesDetailChannel
    ): void {
        foreach ($associateQuestionIds as $associateQuestionId) {
            $readPagesDetailChannel && $readPagesDetailChannel->pop(15);
            $this->sendAssociateQuestionResponse($dto, (string) $associateQuestionId);
        }
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    public function generateAndSendSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions,
    ): MagicAggregateSearchSummaryDTO {
        // 由于是流式输出响应，因此让前端判断 ai 引用的搜索 url。
        Coroutine::create(function () use ($dto, $noRepeatSearchContexts) {
            CoContext::setRequestId($dto->getRequestId());
            $messageId = (string) $this->idGenerator->generate();
            $messageType = AggregateAISearchCardResponseType::SEARCH;
            $content = ['search' => $this->getSearchData($noRepeatSearchContexts)];
            $this->aiSendMessage(
                $dto->getConversationId(),
                $messageId,
                '0',
                $messageType,
                $content,
                $dto->getAppMessageId(),
                $dto->getTopicId()
            );
        });
        // 生成总结
        return $this->generateSummary($dto, $noRepeatSearchContexts, $associateQuestions);
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    public function generateSummary(
        MagicChatAggregateSearchReqDTO $dto,
        array $noRepeatSearchContexts,
        array $associateQuestions
    ): MagicAggregateSearchSummaryDTO {
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
            ->setSearchKeywords(array_column($associateQuestions, 'title'))
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
        $senderSeqDTO = (new MagicSeqEntity())
            ->setConversationId($dto->getConversationId())
            ->setSeqType(ChatMessageType::AggregateAISearchCard)
            ->setAppMessageId($dto->getAppMessageId())
            ->setExtra((new SeqExtra())->setTopicId($dto->getTopicId()));
        $streamOptions = (new StreamOptions())->setStream(true)->setStreamAppMessageId($summaryMessageId);
        $messageContent = new AggregateAISearchCardMessage([
            'parent_id' => '0',
            'id' => $summaryMessageId,
            'type' => AggregateAISearchCardResponseType::LLM_RESPONSE,
        ]);
        // 流式响应
        $summarizeStreamResponse = '';
        $messageDTO = new MagicMessageEntity();
        $messageDTO->setMessageType(ChatMessageType::AggregateAISearchCard)->setSenderId($senderConversationEntity->getUserId());

        /**
         * @var ChatCompletionChoice $choice
         */
        foreach ($summarizeCompletionResponse as $index => $choice) {
            /** @var AssistantMessage $assistantMessage */
            $assistantMessage = $choice->getMessage();
            $messageContent->setStreamOptions($streamOptions);
            if ($index === 0) {
                $streamOptions->setStatus(StreamMessageStatus::Start);
                // 创建一个 seq 用于渲染占位
                $this->magicChatDomainService->createAndSendStreamStartSequence(
                    (new CreateStreamSeqDTO())->setTopicId($dto->getTopicId())->setAppMessageId($dto->getAppMessageId()),
                    $messageContent,
                    $senderConversationEntity
                );
                // 推送一次 parent_id/id/type 数据，用于更新流式缓存，避免最终落库时，parent_id/id/type 数据丢失
                $this->magicChatDomainService->streamSendJsonMessage($senderSeqDTO->getAppMessageId(), [
                    'parent_id' => '0',
                    'id' => $summaryMessageId,
                    'type' => AggregateAISearchCardResponseType::LLM_RESPONSE,
                ]);
            } else {
                $streamOptions->setStatus(StreamMessageStatus::Processing);
            }
            // 流式内容
            if ($assistantMessage->hasReasoningContent()) {
                // 发送思考内容
                $this->magicChatDomainService->streamSendJsonMessage($senderSeqDTO->getAppMessageId(), [
                    'reasoning_content' => $assistantMessage->getReasoningContent(),
                ]);
            } else {
                // 总结内容
                $this->magicChatDomainService->streamSendJsonMessage($senderSeqDTO->getAppMessageId(), [
                    'llm_response' => $assistantMessage->getContent(),
                ]);
                // 累加流式内容，用作最后的返回
                $summarizeStreamResponse .= $assistantMessage->getContent();
            }
        }
        // 发送结束
        $this->magicChatDomainService->streamSendJsonMessage($senderSeqDTO->getAppMessageId(), [], StreamMessageStatus::Completed);
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

    /**
     * @throws Throwable
     */
    public function generateAndSendPPT(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo, string $mindMap): void
    {
        $start = microtime(true);
        $ppt = $this->magicLLMDomainService->generatePPTFromMindMap($queryVo, $mindMap);
        $this->logger->info(sprintf('getSearchResults 生成PPT，结束计时，耗时: %s 秒', microtime(true) - $start));
        $messageId = (string) $this->idGenerator->generate();
        $messageType = AggregateAISearchCardResponseType::PPT;
        $this->aiSendMessage(
            $dto->getConversationId(),
            $messageId,
            '0',
            $messageType,
            ['ppt' => $ppt],
            $dto->getAppMessageId(),
            $dto->getTopicId()
        );
    }

    /**
     * @throws Throwable
     */
    public function generateAndSendMindMap(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo): string
    {
        $start = microtime(true);
        $mindMap = $this->magicLLMDomainService->generateMindMapFromMessage($queryVo);
        $this->logger->info(sprintf('getSearchResults 生成思维导图，结束计时，耗时: %s 秒', microtime(true) - $start));
        $messageId = (string) $this->idGenerator->generate();
        $messageType = AggregateAISearchCardResponseType::MIND_MAP;
        $this->aiSendMessage(
            $dto->getConversationId(),
            $messageId,
            '0',
            $messageType,
            ['mind_map' => $mindMap],
            $dto->getAppMessageId(),
            $dto->getTopicId()
        );
        return $mindMap;
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     * @throws Throwable
     */
    public function generateAndSendEvent(MagicChatAggregateSearchReqDTO $dto, AISearchCommonQueryVo $queryVo, array $noRepeatSearchContexts): void
    {
        $start = microtime(true);
        $event = $this->magicLLMDomainService->generateEventFromMessage($queryVo, $noRepeatSearchContexts);
        $this->logger->info(sprintf('getSearchResults 生成事件，结束计时，耗时: %s 秒', microtime(true) - $start));
        $messageId = (string) $this->idGenerator->generate();
        $messageType = AggregateAISearchCardResponseType::EVENT;
        $this->aiSendMessage(
            $dto->getConversationId(),
            $messageId,
            '0',
            $messageType,
            ['event' => $event],
            $dto->getAppMessageId(),
            $dto->getTopicId(),
        );
    }

    /**
     * @throws Throwable
     */
    public function sendPingPong(MagicChatAggregateSearchReqDTO $dto): void
    {
        $this->aiSendMessage(
            $dto->getConversationId(),
            (string) $this->idGenerator->generate(),
            '0',
            AggregateAISearchCardResponseType::PING_PONG,
            [],
            $dto->getAppMessageId(),
            $dto->getTopicId()
        );
    }

    public function getOrCreateConversation(string $senderUserId, string $receiveId, ?ConversationType $receiverType = null): MagicConversationEntity
    {
        return $this->magicConversationDomainService->getOrCreateConversation($senderUserId, $receiveId, $receiverType);
    }

    public function getUserInfo(string $senderUserId): ?MagicUserEntity
    {
        return $this->magicUserDomainService->getUserById($senderUserId);
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function getSearchData(array $noRepeatSearchContexts): array
    {
        $searchList = [];
        foreach ($noRepeatSearchContexts as $search) { // $search 已经是切片后的元素
            // 兼容历史数据，key 使用小驼峰
            $searchList[] = [
                'id' => $search->getId(),
                'name' => $search->getName(),
                'url' => $search->getUrl(),
                'datePublished' => $search->getDatePublished(),
                'datePublishedDisplayText' => $search->getDatePublishedDisplayText(),
                'isFamilyFriendly' => $search->isFamilyFriendly(),
                'displayUrl' => $search->getDisplayUrl(),
                'snippet' => $search->getSnippet(),
                'dateLastCrawled' => $search->getDateLastCrawled(),
                'cachedPageUrl' => $search->getCachedPageUrl(),
                'language' => $search->getLanguage(),
                'isNavigational' => $search->isNavigational(),
                'noCache' => $search->isNoCache(),
                'detail' => '', // 节省流量，给前端推消息不传 detail
            ];
        }
        return $searchList;
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

    private function sleepToFixBug(float $seconds = 0.2): void
    {
        // !!! 由于收件方的消息生成是异步的，可能乱序，因此，这里 sleep 一小会，尽量保证收件方消息生成的顺序
        Coroutine::sleep($seconds);
    }

    /**
     * @throws Throwable
     */
    private function aiSendMessage(
        string $conversationId,
        string $id,
        string $parentId,
        int $type,
        array $content,
        // todo 流式响应，拿到客户端传来的 app_message_id ，作为响应时候的唯一标识
        string $appMessageId = '',
        string $topicId = ''
    ): void {
        $logMessageContent = Json::encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (mb_strlen($logMessageContent) > 300) {
            $logMessageContent = '';
        }
        $this->logger->info(sprintf(
            'deepSearchSendMessage conversationId:%s id:%s messageName:%s Type:%s parentId:%s  appMessageId:%s topicId:%s logMessageContent:%s',
            $conversationId,
            $id,
            AggregateAISearchCardResponseType::getNameFromType($type),
            $type,
            $parentId,
            $appMessageId,
            $topicId,
            $logMessageContent
        ));
        $content = array_merge($content, [
            'parent_id' => $parentId,
            'id' => $id,
            'type' => $type,
        ]);
        $messageInterface = new AggregateAISearchCardMessage($content);
        $extra = new SeqExtra();
        $extra->setTopicId($topicId);
        $seqDTO = (new MagicSeqEntity())
            ->setConversationId($conversationId)
            ->setContent($messageInterface)
            ->setSeqType($messageInterface->getMessageTypeEnum())
            ->setAppMessageId($appMessageId)
            ->setExtra($extra);
        // 设置话题 id
        $this->getMagicChatMessageAppService()->aiSendMessage($seqDTO, $appMessageId);
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

    private function getMagicChatMessageAppService(): MagicChatMessageAppService
    {
        return di(MagicChatMessageAppService::class);
    }

    private function getChatModel(string $orgCode, string $modelName = LLMModelEnum::DEEPSEEK_V3->value): ModelInterface
    {
        // 通过降级链获取模型名称
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($orgCode, $modelName);
        // 获取模型代理
        return di(ModelGatewayMapper::class)->getChatModelProxy($modelName, $orgCode);
    }

    /**
     * @param SearchDetailItem[] $noRepeatSearchContexts
     */
    private function chunkContextsByAssociateQuestions(array $associateQuestions, array $noRepeatSearchContexts): array
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
