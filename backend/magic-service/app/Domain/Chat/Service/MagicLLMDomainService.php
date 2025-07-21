<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\AISearch\Request\MagicChatAggregateSearchReqDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\EventItem;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\SearchDetailItem;
use App\Domain\Chat\Entity\ValueObject\AISearchCommonQueryVo;
use App\Domain\Chat\Entity\ValueObject\BingSearchMarketCode;
use App\Domain\Chat\Entity\ValueObject\SearchEngineType;
use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\OdinTools\MindSearch\SubQuestionsTool;
use App\Infrastructure\ExternalAPI\Search\BingSearch;
use App\Infrastructure\ExternalAPI\Search\DuckDuckGoSearch;
use App\Infrastructure\ExternalAPI\Search\GoogleSearch;
use App\Infrastructure\ExternalAPI\Search\JinaSearch;
use App\Infrastructure\ExternalAPI\Search\TavilySearch;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Odin\AgentFactory;
use App\Infrastructure\Util\Time\TimeUtil;
use Exception;
use Generator;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Parallel;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ToolCall;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Exception\LLMException\LLMNetworkException;
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Redis\Redis;
use Hyperf\Retry\Retry;
use JetBrains\PhpStorm\ArrayShape;
use Psr\Log\LoggerInterface;
use RedisException;
use RuntimeException;
use Throwable;

use function array_merge;
use function Hyperf\Config\config;
use function is_string;
use function preg_replace;
use function trim;

use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

class MagicLLMDomainService
{
    // 搜索结果丢给大模型的最大字数限制，避免响应太慢
    public const int LLM_STR_MAX_LEN = 30000;

    public const int LLM_SEARCH_CONTENT_MAX_LEN = 30;

    private string $mindMapQueryPrompt = <<<'PROMPT'
    # 角色
    你是一个智能的思维导图生成器，可以根据用户的问题和给定的上下文，以清晰的 markdown 格式生成思维导图。
    
    ## 当前时间
    当前时间为 {date_now}
    
    ## markdown 格式的示例
    ```markdown
    # 主题一
    ## 子主题一
    - **维度一**：维度的描述。
    - **维度二**：维度的描述。
    - **维度三**：维度的描述。

    ## 子主题二
    - **维度一**：维度的描述。
    - **维度二**：维度的描述。
    - **维度三**：维度的描述。

    ## 总结性标题
    - **维度一**：维度的描述。
    - **维度二**：维度的描述。
    - **维度三**：维度的描述。
    ```

    ## 你的执行流程
    你需要严格按照以下步骤，一步一步地思考并生成思维导图：
    1. 仔细分析用户提出的问题，确定关键主题和要点。
    2. 认真阅读给定的上下文，提取与问题相关的信息。
    3. 整合问题和上下文的内容，为生成思维导图做准备。
    4. 以 markdown 格式构建思维导图结构，使用不同的符号和缩进表示层级关系。
    5. 将关键主题作为思维导图的中心节点，根据需要添加分支节点表示子主题和具体内容。
    6. 确保思维导图的内容准确反映问题和上下文的要点。

    ## 限制
    - 严格按照 markdown 格式输出思维导图。
    - 用户使用什么语言，你就使用什么语言。语言指的是人类语言，比如中文、英文等。
    - 思维导图的每一层的内容长度都是递增的，但请确保都是关键核心的内容，不要过于冗长，外层请控制在十个字以内，里层控制在五十字以内。
    
    ## 重点关注
    - 即使给出的上下文已经有用户想要的信息，你也一定要重新给出思维导图。

    ## 用于生成思维导图的上下文
    问题: {question}
    响应: {content}

    ## 以下是响应，请使用 markdown 格式：
    ```markdown
    PROMPT;

    /* @phpstan-ignore-next-line */
    private string $pptQueryPrompt = <<<'PROMPT'
    Today is {date_now}

    You are a ppt generator built by 灯塔引擎, your name is 麦吉.

    Please convert the following Markdown content into a format suitable for rendering slides with Marpit:

    {mind_map}

    Requirements:

    Generate a separate slide for each first-level heading (starting with #).

    Second-level headings (starting with ##) should be distinguished within the corresponding first-level slide page through appropriate formatting, such as different indentation or font styles, to enhance readability and visual effect of the slides.

    In the generated Marpit format content, ensure the correct use of Marpit's syntax structure, using --- to separate each slide.

    Please follow the user's language, but not the content format. Language refers to human languages such as Chinese, English, French, etc., not computer languages such as JSON, XML, etc.

    Please output the mind map in required format directly, but not output ```markdown``` blocks. Without the need to reply with additional content. Please limit to 10240 tokens.

    PROMPT;

    // 根据用户的关键词，搜索一次后，拆分更细致的问题深入搜索
    private string $moreQuestionsPrompt = <<<'PROMPT'
    # 时间上下文
    - 系统时间: {date_now}
    
    ## 核心逻辑
    ### 1. 问题解构引擎
    输入: [用户问题 + {context}]
    处理步骤：
    1.1 实体识别
       - 显性命名实体提取，识别实体间的关系与属性
       - 推导用户的隐性需求和潜在意图，特别关注隐含的时间因素
    1.2 维度拆解
       - 根据识别出的实体和需求，选择合适的分析维度，例如：政策解读、数据验证、案例研究、影响评估、技术原理、市场前景、用户体验等
    1.3 子问题生成
       - 生成正交子问题集（Jaccard相似度<0.25），确保每个子问题能从不同角度探索用户需求，避免生成过于宽泛或相似的问题
    
    ### 2. 搜索代理模块
    必须调用工具: batchSubQuestionsSearch
    参数规范：
    2.1 关键词规则
       - 生成大于等于 3 个高质量的可检索关键词，包括核心实体、关键属性和相关概念
       - 时间限定符覆盖率≥30%
       - 对比类问题占比≥20%
    
    ## 硬性约束（强制遵守）
    1. 语言一致性
       - 输出语言编码必须匹配输入语言
    2. 子问题数量范围
       - {sub_questions_min} ≤ 子问题数 ≤ {sub_questions_max}
    3. 输出格式
       - 仅允许JSON数组格式，禁止自然语言回答
    
    ## 上下文异常处理
    当 {context} 为空时：
    1. 启动备选生成策略，应用5W1H框架（Who/What/When/Where/Why/How），并结合用户的原始问题进行填充
    2. 生成默认维度，例如：政策背景 | 最新数据 | 专家观点 | 对比分析 | 行业趋势
    
    ## 输出规范
    混合以下三种及更多类型的问题范式，以确保子问题的多样性和覆盖性：
    [
      "X对Y的影响差异",  // 对比/比较类
      "Z领域的典型应用",  // 应用/案例类
      "关于A的B指标",    // 指标/属性类
      "导致M发生的主要原因是什么？", // 原因/机制类
      "什么是N？它的核心特征是什么？", // 定义/解释类
      "未来五年P领域的发展趋势是什么？", // 趋势/预测类
      "针对Q问题，有哪些可行的解决方案？" // 解决方案/建议类
    ]
    
    当前上下文摘要：
    {context}
    
    // 最终输出（严格JSON数组）：
    ```json
    PROMPT;

    private string $summarizePrompt = <<<'PROMPT'
    # 任务
    你需要基于用户的消息，根据我提供的搜索结果，按照总分总的结构，输出高质量，结构化的详细回答，格式为 markdown。
    
    在我给你的搜索结果中，每个结果都是[webpage X begin]...[webpage X end]格式的，X代表每篇文章的数字索引。请在适当的情况下在句子末尾引用上下文。请按照引用编号[citation:X]的格式在答案中对应部分引用上下文。如果一句话源自多个上下文，请列出所有相关的引用编号，例如[citation:3][citation:5]，切记不要将引用集中在最后返回引用编号，而是在答案对应部分列出。
    在回答时，请注意以下几点：
    - 今天是{date_now}。
    - 并非搜索结果的所有内容都与用户的问题密切相关，你需要结合问题，对搜索结果进行甄别、筛选。
    - 对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看搜索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户搜索结果未提供的内容。
    - 对于创作类的问题（如写论文），请务必在正文的段落中引用对应的参考编号，例如[citation:3][citation:5]，不能只在文章末尾引用。你需要解读并概括用户的题目要求，选择合适的格式，充分利用搜索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。
    - 如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。
    - 对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。
    - 你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。
    - 你的回答应该综合多个相关网页来回答，不能重复引用一个网页。
    - 除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。
    - 输出漂亮的markdown 格式，内容中添加一些与主题相关的emoji表情符号。
    
    ## 用户消息为：
    {question}
    
    ## 基于用户发送的消息的互联网搜索结果:
    {search_context_details}
    PROMPT;

    private string $eventPrompt = <<<'PROMPT'
    # 你是一个新闻事件生成器，用户会提供搜索内容并询问问题。
    ## 当前时间是 {data_now}  
    ## 根据用户的问题，你需从用户提供的搜索内容中整理相关事件，事件包括事件名称、事件时间和事件概述。
    ### 注意事项：
    1. **事件名称格式**：
       - 在事件名称后添加搜索引用的编号，格式为 `[[citation:x]]`，编号来源于搜索内容中的引用标记（如 `[[citation:1]]`）。
       - 如果一个事件涉及多个引用，合并所有相关引用编号。
       - 不要在 "description" 中添加引用。
    2. **时间处理**：
       - 事件时间尽量精确到月份（如 "2023-05"），若搜索内容未提供具体月份，但有指出上半年或者下半年，可以使用（"2023 上半年"），若没有则，使用年份（如 "2023"）。
       - 若同一事件在多个引用中出现，优先使用最早的时间。
       - 若时间不明确，根据上下文推测最早可能的时间，并确保合理。
    3. **事件提取与筛选**：
       - **事件定义**：事件是搜索内容中提及的、具有时间关联（明确或可推测）的独立事实、变化或活动，包括但不限于创建、发布、开业、更新、合作、活动等。
       - 根据用户问题，提取与之相关的事件，保持描述简洁，聚焦具体发生的事情。
       - **跳过无关内容**：
         - 纯静态描述（如不变的属性、背景介绍，无时间变化）。
         - 数据统计或财务信息（如营收、利润）。
         - 主观评论、分析或推测（除非与事件直接相关）。
         - 无时间关联且与问题无关的细节。
       - **保留原则**：只要内容与时间相关且符合问题主题，尽量保留为事件。
    4. **输出要求**：
       - 以 JSON 格式返回，事件按时间倒序排列（从晚到早）。
       - 每个事件包含 "name"、"time"、"description" 三个字段。
       - 若搜索内容不足以生成事件，返回空数组 `[]`，避免凭空臆造。
    
    ## 输出示例：
    ```json
    [
        {
            "name": "某事件发生[[citation:3]] [[citation:5]]",
            "time": "2024-11",
            "description": "某事件在2024年11月发生，具体情况概述。"
        },
        {
            "name": "另一事件开始[[citation:1]]",
            "time": "2019-05",
            "description": "另一事件于2019年5月开始，简要描述。"
        }
    ]
    ```
    ## 使用说明
    - 用户需提供搜索内容（包含引用标记如 [[citation:x]]）和具体问题。
    - 根据问题，从搜索内容中提取符合事件定义的内容，按要求生成输出。
    - 若问题涉及当前时间，基于 {date_now} 进行推算。
    
    ## 引用
    {citations}
    
    ## 搜索上下文详情:
    {search_context_details}

    ## 请直接输出 json 格式:
    ```json
    PROMPT;

    private string $filterSearchContextPrompt = <<<'PROMPT'
    ## 当前时间
    {date_now}
    
    ## 任务
    返回"search contexts"中与"search keywords"有关联性的 20 至 50 个 索引。
    
    ## 要求
    - 禁止直接回答用户的问题，一定要返回与用户问题有关联性的索引。
    - search contexts的格式为 "[[x]] 内容" ，其中 x 是search contexts的索引。x 不能大于 50
    - 请以正确的 JSON 格式回复筛选后的索引，例如：[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
    - 如果 search keywords 与时间相关，重点注意 search contexts 中与当前时间相关的内容。与当前时间越近越重要。

    
    ## search keywords
    {searchKeywords}
    
    ## search contexts
    {context}

    ## Please respond in JSON format, such as:
    ```json
    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
    ```
    
    ## Please output in json format directly:
    ```json
    PROMPT;

    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        public TavilySearch $apiWrapper,
        protected readonly MagicFlowAIModelRepositoryInterface $magicFlowAIModelRepository,
        protected LoggerFactory $loggerFactory,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    public function generatePPTFromMindMap(AISearchCommonQueryVo $queryVo, string $mindMap): string
    {
        // 直接用思维导图生成 ppt
        return $mindMap;
    }

    /**
     * @throws Throwable
     */
    public function generateMindMapFromMessage(AISearchCommonQueryVo $queryVo): string
    {
        $responseMessage = $queryVo->getLlmResponses()[0] ?? '';
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch generateMindMapFromMessage responseMessage',
            'log_content' => $responseMessage,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $question = $queryVo->getUserMessage();
        $conversationId = $queryVo->getConversationId();
        $model = $queryVo->getModel();
        try {
            $questionParsed = Json::decode($question);
            if ($questionParsed['content'] ?? '') {
                $question = trim($questionParsed['content']);
            }
        } catch (Exception) {
        }
        // 去除掉引用，避免思维导图中出现引用
        $responseMessage = preg_replace('/\[\[citation:(\d+)]]/', '', $responseMessage);
        // 观察到系统提示词变量串了，看看是不是没有复制一份的问题
        $systemPrompt = str_replace(
            ['{question}', '{content}', '{date_now}'],
            [$question, $responseMessage, date('Y年 m月 d日, H时 i分 s秒')],
            $this->mindMapQueryPrompt
        );
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch systemPrompt mindMap',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        // 访问 llm
        try {
            // 根据总结 + 用户原始问题已经能生成思维导图了，不需要再传入历史消息
            $mindMapMessage = $this->llmChat(
                $systemPrompt,
                $responseMessage,
                $model,
                null,
                $queryVo->getMessageHistory(),
                $conversationId,
                $queryVo->getMagicApiBusinessParam()
            );
            $mindMapMessage = (string) $mindMapMessage;
            // 去掉换行符
            $mindMapMessage = str_replace('\n', '', $mindMapMessage);
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch mindMap response',
                'log_content' => $mindMapMessage,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            return $this->stripMarkdownCodeBlock($mindMapMessage, 'markdown');
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch 生成思维导图时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        }
    }

    /**
     * @param SearchDetailItem[] $searchContexts
     * @return EventItem[]
     */
    public function generateEventFromMessage(AISearchCommonQueryVo $queryVo, array $searchContexts): array
    {
        $question = $queryVo->getUserMessage();
        $conversationId = $queryVo->getConversationId();
        $model = $queryVo->getModel();
        // 清洗search contexts
        $searchContextsDetail = '';
        $searchContextsCitations = '';
        foreach ($searchContexts as $searchIndex => $context) {
            $index = $searchIndex + 1;
            $searchContextsDetail .= sprintf(
                '[[citation:%d]] detail:%s ' . "\n\n",
                $index,
                $context->getDetail() ?: $context->getSnippet()
            );
            $searchContextsCitations .= sprintf('[[citation:%d]] snippet:%s ' . "\n\n", $index, $context->getSnippet());
        }
        // 超过最大值则直接截断，避免响应太久
        $maxLen = self::LLM_STR_MAX_LEN;
        if (mb_strlen($searchContextsCitations) > $maxLen) {
            $searchContextsCitations = mb_substr($searchContextsCitations, 0, $maxLen);
        }
        if (mb_strlen($searchContextsDetail) > $maxLen) {
            $searchContextsDetail = mb_substr($searchContextsDetail, 0, $maxLen);
        }

        // 输入替换
        $systemPrompt = str_replace(
            ['{citations}', '{search_context_details}', '{date_now}'],
            [$searchContextsCitations, $searchContextsDetail, date('Y年 m月 d日, H时 i分 s秒')],
            $this->eventPrompt
        );
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch systemPrompt eventMap',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        // 访问 llm
        try {
            $relationEventsResponse = (string) $this->llmChat(
                $systemPrompt,
                $question,
                $model,
                [],
                $queryVo->getMessageHistory(),
                $conversationId,
                $queryVo->getMagicApiBusinessParam()
            );
            $relationEventsResponse = $this->stripMarkdownCodeBlock($relationEventsResponse, 'json');
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch relationEventsResponse',
                'log_content' => $relationEventsResponse,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            $relationEventsResponse = Json::decode($relationEventsResponse);
            $eventsItem = [];
            foreach ($relationEventsResponse as $item) {
                $eventsItem[] = new EventItem($item);
            }
            return $eventsItem;
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch 生成事件时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            // 事件生成经常不是 json
            return [];
        }
    }

    /**
     * 流式总结 - 原有方法.
     * @throws Throwable
     */
    public function summarize(AISearchCommonQueryVo $queryVo): Generator
    {
        $systemPrompt = $this->buildSummarizeSystemPrompt($queryVo);
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch systemPrompt summarize',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        // 访问 llm
        try {
            return $this->llmChatStreamed(
                $systemPrompt,
                $queryVo->getUserMessage(),
                $queryVo->getModel(),
                $queryVo->getMessageHistory(),
                $queryVo->getConversationId(),
                $queryVo->getMagicApiBusinessParam(),
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch 解析响应时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        }
    }

    /**
     * 非流式总结 - 新增方法，适用于工具调用.
     * @throws Throwable
     */
    public function summarizeNonStreaming(AISearchCommonQueryVo $queryVo): string
    {
        $systemPrompt = $this->buildSummarizeSystemPrompt($queryVo);
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch systemPrompt summarizeNonStreaming',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        // 访问 llm
        try {
            $response = $this->llmChat(
                $systemPrompt,
                $queryVo->getUserMessage(),
                $queryVo->getModel(),
                [],
                $queryVo->getMessageHistory(),
                $queryVo->getConversationId(),
                $queryVo->getMagicApiBusinessParam()
            );
            return (string) $response;
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch summarizeNonStreaming 解析响应时发生错误:%s,file:%s,line:%s trace:%s', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        }
    }

    /**
     * 让大模型虚空拆解子问题.
     * @throws Throwable
     */
    public function generateSearchKeywords(AISearchCommonQueryVo $queryVo): array
    {
        $userMessage = $queryVo->getUserMessage();
        $messageHistory = $queryVo->getMessageHistory();
        $conversationId = $queryVo->getConversationId();
        $model = $queryVo->getModel();
        $systemPrompt = str_replace(
            ['{date_now}', '{context}', '{sub_questions_min}', '{sub_questions_max}'],
            [date('Y年 m月 d日, H时 i分 s秒'), '', '3', '4'],
            $this->moreQuestionsPrompt
        );
        $subquestions = [];
        // 访问 llm
        try {
            $tools = [(new SubQuestionsTool())->toArray()];
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch systemPrompt generateSearchKeywords',
                'systemPrompt' => $systemPrompt,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            $generateSearchKeywordsResponse = $this->llmChat(
                $systemPrompt,
                $userMessage,
                $model,
                $tools,
                $messageHistory,
                $conversationId,
                $queryVo->getMagicApiBusinessParam()
            );
            foreach ($this->getLLMToolsCall($generateSearchKeywordsResponse) as $toolCall) {
                if ($toolCall->getName() === SubQuestionsTool::$name) {
                    $subquestions = $toolCall->getArguments()['subQuestions'];
                }
            }
            if (empty($subquestions)) {
                // 没有调用工具，尝试从响应中解析 json
                $subquestions = $this->getSubQuestionsFromLLMStringResponse($generateSearchKeywordsResponse, $userMessage);
            }
            return $subquestions;
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch getSearchResults 生成搜索词时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        } finally {
            // 记录 $subquestions
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch generateSearchKeywords',
                'userMessage' => $userMessage,
                'subquestions' => $subquestions,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }
    }

    /**
     * 批量搜索后，过滤掉重复的 search contexts.
     * @return SearchDetailItem[]
     * @throws Throwable
     */
    public function filterSearchContexts(AISearchCommonQueryVo $queryVo): ?array
    {
        $userMessage = $queryVo->getUserMessage();
        $conversationId = $queryVo->getConversationId();
        $model = $queryVo->getModel();
        $messageHistory = $queryVo->getMessageHistory();
        $searchContexts = $queryVo->getSearchContexts();
        $searchKeywords = $queryVo->getSearchKeywords();
        $searchKeywords[] = $userMessage;
        $searchKeywords = Json::encode($searchKeywords, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        // 获取系统提示词
        $searchContextsString = '';
        // 清洗搜索结果
        foreach ($searchContexts as $index => $context) {
            // 可以传入网页详情，以便更好的筛选
            $searchContextsString .= '[[' . $index . ']] ' . $context->getSnippet() . "\n\n";
        }
        $systemPrompt = str_replace(
            ['{context}', '{date_now}', '{searchKeywords}'],
            [$searchContextsString, date('Y年 m月 d日, H时 i分 s秒'), $searchKeywords],
            $this->filterSearchContextPrompt
        );
        $this->logger->info(Json::encode([
            'log_title' => 'mindSearch systemPrompt filterSearchContexts',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        // 访问 llm
        /** @var SearchDetailItem[] $noRepeatSearchContexts */
        $noRepeatSearchContexts = [];
        try {
            $filteredSearchResponse = (string) $this->llmChat(
                $systemPrompt,
                $userMessage,
                $model,
                messageHistory: $messageHistory,
                conversationId: $conversationId,
                businessParams: $queryVo->getMagicApiBusinessParam()
            );
            if (! empty($filteredSearchResponse) && $filteredSearchResponse !== '[]') {
                $filteredSearchResponse = $this->stripMarkdownCodeBlock($filteredSearchResponse, 'json');
                foreach (Json::decode($filteredSearchResponse) as $key => $index) {
                    if (! is_string($index) && ! is_int($index)) {
                        continue;
                    }
                    $noRepeatSearchContexts[] = $searchContexts[(int) $index];
                    if ($key >= self::LLM_SEARCH_CONTENT_MAX_LEN) {
                        break;
                    }
                }
            }
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch getSearchResults 解析响应时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        }
        foreach ($noRepeatSearchContexts as $key => $context) {
            if (! $context instanceof SearchDetailItem) {
                $noRepeatSearchContexts[$key] = new SearchDetailItem($context);
            }
        }
        return $noRepeatSearchContexts;
    }

    #[ArrayShape([
        'search_keywords' => 'array',
        'search' => 'array',
        'total_words' => 'int',
        'match_count' => 'int',
        'page_count' => 'int',
    ])]
    public function getSearchResults(AISearchCommonQueryVo $queryVo): array
    {
        $searchKeywords = $queryVo->getSearchKeywords();
        $searchEngine = $queryVo->getSearchEngine();
        $language = $queryVo->getLanguage();
        $searchArrayList = [];
        $matchCount = 0;
        $pageCount = 0;
        $start = microtime(true);
        $parallel = new Parallel(5);
        $requestId = CoContext::getRequestId();
        foreach ($searchKeywords as $searchKeyword) {
            $parallel->add(function () use ($requestId, $searchKeyword, $searchEngine, $language) {
                CoContext::setRequestId($requestId);
                return $this->search($searchKeyword, $searchEngine, false, $language);
            });
        }
        try {
            foreach ($parallel->wait() as $item) {
                $searchArrayList[] = $item['clear_search'];
                $matchCount += $item['match_count'];
                $pageCount += count($item['clear_search']);
            }
            $parallel->clear();
        } catch (Throwable $e) {
            $this->logger->error(sprintf('mindSearch getSearchResults 搜索内容时发生错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
        } finally {
            ! empty($searchArrayList) && $searchArrayList = array_merge(...$searchArrayList);
            $costTime = TimeUtil::getMillisecondDiffFromNow($start);
            $this->logger->info(sprintf(
                'getSearchResults 搜索全部关键词 结束计时 耗时：%s 秒',
                number_format($costTime / 1000, 2)
            ));
        }

        // 记录阅读字数
        $totalWords = 0;
        if (! empty($searchArrayList)) {
            foreach ($searchArrayList as $searchContext) {
                $totalWords += mb_strlen($searchContext['detail'] ?? $searchContext['snippet']);
            }
        }
        return [
            'search_keywords' => $searchKeywords,
            'search' => $searchArrayList,
            'total_words' => $totalWords,
            'match_count' => $matchCount,
            'page_count' => $pageCount,
        ];
    }

    /**
     * 让大模型虚空拆解子问题，对热梗/实时拆解的会不好。
     * @return string[]
     */
    public function generateSearchKeywordsByUserInput(MagicChatAggregateSearchReqDTO $dto, ModelInterface $modelInterface): array
    {
        $userInputKeyword = $dto->getUserMessage();
        $magicChatMessageHistory = $dto->getMagicChatMessageHistory();
        $queryVo = (new AISearchCommonQueryVo())
            ->setUserMessage($userInputKeyword)
            ->setSearchEngine(SearchEngineType::Bing)
            ->setFilterSearchContexts(false)
            ->setGenerateSearchKeywords(false)
            ->setModel($modelInterface)
            ->setLanguage($dto->getLanguage())
            ->setUserId($dto->getUserId())
            ->setOrganizationCode($dto->getOrganizationCode());
        $start = microtime(true);
        $subKeywords = Retry::whenThrows()->sleep(200)->max(3)->call(function () use ($queryVo, $magicChatMessageHistory) {
            // 每次重试清空之前的上下文
            $llmConversationId = (string) IdGenerator::getSnowId();
            $llmHistoryMessage = MagicChatAggregateSearchReqDTO::generateLLMHistory($magicChatMessageHistory, $llmConversationId);
            $queryVo->setMessageHistory($llmHistoryMessage)->setConversationId($llmConversationId);
            return $this->generateSearchKeywords($queryVo);
        });
        $costTime = TimeUtil::getMillisecondDiffFromNow($start);
        $this->logger->info(sprintf(
            'getSearchResults 根据用户原始问题，生成搜索词，结束计时，耗时：：%s 秒',
            number_format($costTime / 1000, 2)
        ));
        // 大模型没有拆孙问题是时，直接用子问题搜索
        if (! empty($subKeywords)) {
            $searchKeywords = $subKeywords;
        } else {
            $searchKeywords = [$userInputKeyword];
        }
        return $searchKeywords;
    }

    #[ArrayShape(['clear_search' => 'array', 'match_count' => 'array'])]
    public function searchWithBing(string $query, ?string $language = null): array
    {
        $start = microtime(true);
        $subscriptionKey = config('search.bing.api_key');
        $mkt = BingSearchMarketCode::fromLanguage($language);
        $referenceCount = 30;
        $data = make(BingSearch::class)->search($query, $subscriptionKey, $mkt);
        try {
            $contexts = array_slice($data['webPages']['value'], 0, $referenceCount);
        } catch (Exception $e) {
            $errMsg = [
                'error' => 'mindSearch getSearchResults searchWithBing 获取搜索结果时发生错误',
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ];
            $this->logger->error(Json::encode($errMsg));
            return [];
        }
        $totalMatches = $data['webPages']['totalEstimatedMatches'] ?? count($contexts);
        $clearSearch = [];
        foreach ($contexts as $context) {
            $time = isset($context['datePublished']) ? date('Y-m-d H:i:s', strtotime($context['datePublished'])) : null;
            $format = [
                'id' => $context['id'],
                'name' => $context['name'],
                'url' => $context['url'],
                'datePublished' => $time,
                'datePublishedDisplayText' => $time,
                'isFamilyFriendly' => true,
                'displayUrl' => $context['displayUrl'],
                'snippet' => $context['snippet'],
                'dateLastCrawled' => $time,
                'cachedPageUrl' => $context['cachedPageUrl'] ?? $context['url'],
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
                'detail' => null,
            ];
            $clearSearch[] = $format;
        }
        $this->logger->info(sprintf(
            'mindSearch getSearchResults searchWithBing 获取搜索结果，结束计时，耗时：%s 秒',
            number_format(TimeUtil::getMillisecondDiffFromNow($start) / 1000, 2)
        ));
        return [
            'clear_search' => $clearSearch,
            'match_count' => $totalMatches,
        ];
    }

    /**
     * @throws GuzzleException
     */
    public function searchWithDuckDuckGo(string $query): array
    {
        $region = config('search.duckduckgo.region');
        $data = make(DuckDuckGoSearch::class)->search($query, $region);
        $clearSearch = [];
        foreach ($data as $key => $context) {
            $time = date('Y-m-d H:i:s');
            $format = [
                'id' => $key,
                'name' => $context['title'],
                'url' => $context['url'],
                'datePublished' => $time,
                'datePublishedDisplayText' => $time,
                'isFamilyFriendly' => true,
                'displayUrl' => $context['url'],
                'snippet' => $context['body'],
                'dateLastCrawled' => $time,
                'cachedPageUrl' => $context['url'],
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ];
            $clearSearch[] = $format;
        }

        return [
            'clear_search' => $clearSearch,
            'match_count' => count($clearSearch),
        ];
    }

    /**
     * @throws GuzzleException
     */
    public function searchWithJina(string $query): array
    {
        $region = config('search.jina.region');
        $apiKey = config('search.jina.api_key');
        $data = make(JinaSearch::class)->search($query, $apiKey, $region);
        $clearSearch = [];
        foreach ($data as $key => $context) {
            $time = date('Y-m-d H:i:s');
            $format = [
                'id' => $key,
                'name' => $context['title'],
                'url' => $context['url'],
                'datePublished' => $time,
                'datePublishedDisplayText' => $time,
                'isFamilyFriendly' => true,
                'displayUrl' => $context['url'],
                'snippet' => $context['content'],
                'dateLastCrawled' => $time,
                'cachedPageUrl' => $context['url'],
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ];
            $clearSearch[] = $format;
        }

        return [
            'clear_search' => $clearSearch,
            'match_count' => count($clearSearch),
        ];
    }

    public function searchWithGoogle(string $query): array
    {
        // 以后可以从用户配置中读取这些值
        $subscriptionKey = config('search.google.api_key');
        $cx = config('search.google.cx');
        $data = make(GoogleSearch::class)->search($query, $subscriptionKey, $cx);
        $clearSearch = [];
        foreach ($data as $context) {
            $time = date('Y-m-d H:i:s');
            $format = [
                'id' => $context['formattedUrl'],
                'name' => $context['title'],
                'url' => $context['link'],
                'datePublished' => $time,
                'datePublishedDisplayText' => $time,
                'isFamilyFriendly' => true,
                'displayUrl' => $context['displayLink'],
                'snippet' => $context['snippet'],
                'dateLastCrawled' => $time,
                'cachedPageUrl' => $context['link'],
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ];
            $clearSearch[] = $format;
        }

        return [
            'clear_search' => $clearSearch,
            'match_count' => count($clearSearch),
        ];
    }

    /**
     * 根据原始问题 + 搜索结果，按指定个数的维度拆解问题.
     * @throws Throwable
     */
    public function getRelatedQuestions(AISearchCommonQueryVo $queryVo, int $subQuestionsMin, int $subQuestionsMax): ?array
    {
        $userMessage = $queryVo->getUserMessage();
        $searchContexts = $queryVo->getSearchContexts();
        $messageHistory = $queryVo->getMessageHistory();
        $conversationId = $queryVo->getConversationId();
        $model = $queryVo->getModel();
        $subQuestions = [];
        // 基于查询和上下文获取相关问题
        try {
            // 使用 array_map 和 join 函数来模拟 Python 中的 join 方法
            $contextString = '';
            foreach ($searchContexts as $searchContext) {
                $contextString .= $searchContext->getSnippet() . "\n\n";
            }
            // 使用 str_replace 函数来替换占位符
            // 带上年月日时分秒，避免重复问题
            $systemPrompt = str_replace(
                ['{context}', '{date_now}', '{sub_questions_min}', '{sub_questions_max}'],
                [$contextString, date('Y年 m月 d日, H时 i分 s秒'), (string) $subQuestionsMin, (string) $subQuestionsMax],
                $this->moreQuestionsPrompt
            );
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch systemPrompt getRelatedQuestions',
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            $tools = [(new SubQuestionsTool())->toArray()];
            $relatedQuestionsResponse = $this->llmChat(
                systemPrompt: $systemPrompt,
                query: $userMessage,
                modelInterface: $model,
                tools: $tools,
                messageHistory: $messageHistory,
                conversationId: $conversationId,
                businessParams: $queryVo->getMagicApiBusinessParam()
            );
            // todo 从 function getLLMToolsCall() 方法中获取相关问题
            foreach ($this->getLLMToolsCall($relatedQuestionsResponse) as $toolCall) {
                if ($toolCall->getName() === SubQuestionsTool::$name) {
                    $subQuestions = $toolCall->getArguments()['subQuestions'];
                }
            }

            if (empty($subQuestions)) {
                // 没有调用工具，尝试从响应中解析 json
                $subQuestions = $this->getSubQuestionsFromLLMStringResponse($relatedQuestionsResponse, $userMessage);
                // 大模型认为不需要生成关联问题，直接拿用户的问题
                empty($subQuestions) && $subQuestions = [$queryVo->getUserMessage()];
            }

            return $subQuestions;
        } catch (Exception $e) {
            $this->logger->error(sprintf('mindSearch getSearchResults 生成相关问题时遇到错误:%s,file:%s,line:%s trace:%s, will generate again.', $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
            throw $e;
        } finally {
            // 记录 $subQuestions
            $this->logger->info(Json::encode([
                'log_title' => 'mindSearch getRelatedQuestions',
                'userMessage' => $userMessage,
                'subQuestions' => $subQuestions,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }
    }

    /**
     * 存储值到 KVStore。
     * @throws RedisException
     */
    public function put(string $key, mixed $value): void
    {
        $this->redis->set($key, serialize($value));
    }

    /**
     * 从 KVStore 获取值。
     * @throws RedisException
     */
    public function get(string $key): mixed
    {
        $value = $this->redis->get($key);
        return $value !== false ? unserialize($value, ['allowed_classes' => true]) : false;
    }

    /**
     * 从 KVStore 删除值。
     * @throws RedisException
     */
    public function delete(string $key): void
    {
        $this->redis->del($key);
    }

    public function search(string $query, SearchEngineType $searchEngine, bool $getDetail = false, ?string $language = null): array
    {
        // 根据 backend的值，确定使用哪个搜索引擎
        return Retry::whenThrows()->max(3)->sleep(500)->call(
            function () use ($searchEngine, $query, $language, $getDetail) {
                return match ($searchEngine) {
                    SearchEngineType::Bing => $this->searchWithBing($query, $language),
                    SearchEngineType::Google => $this->searchWithGoogle($query),
                    SearchEngineType::Tavily => $this->searchWithTavily($query),
                    default => throw new RuntimeException('Backend must be LEPTON, BING, GOOGLE,TAVILY,SERPER or SEARCHAPI. getDetail' . $getDetail),
                };
            }
        );
    }

    protected function stripMarkdownCodeBlock(string $content, string $type): string
    {
        $content = trim($content);
        $typePattern = sprintf('/```%s\s*([\s\S]*?)\s*```/i', $type);
        // 匹配 ```json 或 ``` 之间的 JSON 数据
        if (preg_match($typePattern, $content, $matches)) {
            $matchString = $matches[1];
        } elseif (preg_match('/```\s*([\s\S]*?)\s*```/i', $content, $matches)) { // 匹配 ``` 之间的内容
            $matchString = $matches[1];
        } else {
            $matchString = ''; // 没有找到 JSON 数据
        }
        $matchString = ! empty($matchString) ? trim($matchString) : trim($content);
        if ($type === 'json' && json_validate($matchString) === false) {
            return '{}'; // JSON 格式不正确
        }
        return $matchString;
    }

    protected function getModelEntity(string $name): MagicFlowAIModelEntity
    {
        $model = $this->magicFlowAIModelRepository->getByName(FlowDataIsolation::create(), $name);
        if (! $model) {
            ExceptionBuilder::throw(
                FlowErrorCode::ExecuteValidateFailed,
                'flow.mode.not_found',
                ['model_name' => $name]
            );
        }
        return $model;
    }

    protected function searchWithTavily(string $query): array
    {
        $result = $this->apiWrapper->results($query);
        $clearSearch = [];
        foreach ($result['results'] as $key => $context) {
            $time = date('Y-m-d H:i:s');
            $format = [
                'id' => $key,
                'name' => $context['title'],
                'url' => $context['url'],
                'datePublished' => $time,
                'datePublishedDisplayText' => $time,
                'isFamilyFriendly' => true,
                'displayUrl' => $context['url'],
                // 避免内容太长
                'snippet' => mb_substr($context['content'], 0, 100),
                'dateLastCrawled' => $time,
                'cachedPageUrl' => $context['url'],
                'language' => 'en',
                'isNavigational' => false,
                'noCache' => false,
            ];
            $clearSearch[] = $format;
        }
        return [
            'clear_search' => $clearSearch,
            'match_count' => count($clearSearch),
        ];
    }

    /**
     * 构建总结系统提示词 - 公共方法，用于复用代码
     */
    private function buildSummarizeSystemPrompt(AISearchCommonQueryVo $queryVo): string
    {
        $searchContexts = $queryVo->getSearchContexts();
        $userMessage = $queryVo->getUserMessage();
        $searchKeywords = $queryVo->getSearchKeywords();
        $searchKeywords = Json::encode($searchKeywords, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        // 清洗search contexts
        $searchContextsDetail = '';
        foreach ($searchContexts as $searchIndex => $context) {
            $index = $searchIndex + 1;
            $searchContextsDetail .= sprintf(
                '[webpage %d begin] 内容发布日期:%s，摘要：%s' . "\n" . '详情内容:%s ' . "[webpage %d end]\n",
                $index,
                $context->getDatePublished() ?? '',
                $context->getSnippet(),
                $context->getDetail() ?? '',
                $index
            );
        }

        // 超过最大值则直接截断，避免响应太久
        $maxLen = self::LLM_STR_MAX_LEN;
        if (mb_strlen($searchContextsDetail) > $maxLen) {
            $searchContextsDetail = mb_substr($searchContextsDetail, 0, $maxLen);
        }

        // 输入替换
        return str_replace(
            ['{search_context_details}', '{relevant_questions}', '{date_now}', '{question}'],
            [$searchContextsDetail, $searchKeywords, date('Y年 m月 d日, H时 i分 s秒'), $userMessage],
            $this->summarizePrompt
        );
    }

    /**
     * 非流式.
     */
    private function llmChat(
        string $systemPrompt,
        string $query,
        ModelInterface $modelInterface,
        ?array $tools = [],
        ?MessageHistory $messageHistory = null,
        ?string $conversationId = null,
        array $businessParams = [],
    ): ChatCompletionResponse {
        $conversationId = $conversationId ?? uniqid('agent_', true);
        $tools = empty($tools) ? [] : $tools;
        $messageHistory = $messageHistory ?? new MessageHistory();
        $memoryManager = $messageHistory->getMemoryManager($conversationId);
        $memoryManager->addSystemMessage(new SystemMessage($systemPrompt));
        $agent = AgentFactory::create(
            model: $modelInterface,
            memoryManager: $memoryManager,
            tools: $tools,
            temperature: 0.1,
            businessParams: $businessParams,
        );
        // 捕捉 LLMNetworkException 异常，重试一次
        return Retry::whenThrows(LLMNetworkException::class)->sleep(500)->max(3)->call(
            function () use ($agent, $query) {
                return $agent->chatAndNotAutoExecuteTools(new UserMessage($query));
            }
        );
    }

    /**
     * 流式调用，迭代器是 \Hyperf\Odin\Api\OpenAI\Response\ChatCompletionChoice.
     */
    private function llmChatStreamed(
        string $systemPrompt,
        string $query,
        ModelInterface $modelInterface,
        ?MessageHistory $messageHistory = null,
        ?string $conversationId = null,
        array $businessParams = [],
    ): Generator {
        $conversationId = $conversationId ?? uniqid('agent_', true);
        $messageHistory = $messageHistory ?? new MessageHistory();
        $memoryManager = $messageHistory->getMemoryManager($conversationId);
        $memoryManager->addSystemMessage(new SystemMessage($systemPrompt));

        $agent = AgentFactory::create(
            model: $modelInterface,
            memoryManager: $memoryManager,
            temperature: 0.6,
            businessParams: $businessParams,
        );
        return $agent->chatStreamed(new UserMessage($query));
    }

    /**
     * @throws Throwable
     */
    private function getSubQuestionsFromLLMStringResponse(ChatCompletionResponse $chatCompletionResponse, string $userMessage): array
    {
        $llmResponse = (string) $chatCompletionResponse;
        try {
            $subQuestions = $this->stripMarkdownCodeBlock($llmResponse, 'json');
            $subQuestions = Json::decode($subQuestions);
            $this->logger->info(sprintf(
                'mindSearch getSubQuestionsFromLLMStringResponse 提问：%s 大模型响应：%s, 分析后结果：%s',
                $userMessage,
                // 去掉换行符
                str_replace(PHP_EOL, '', $llmResponse),
                Json::encode($subQuestions)
            ));
            // 有时会返回多维数组，在这里过滤
            $returnQuestions = [];
            foreach ($subQuestions as $subQuestion) {
                if (is_string($subQuestion)) {
                    $returnQuestions[] = $subQuestion;
                }
            }
            if (empty($returnQuestions)) {
                $returnQuestions[] = $userMessage;
            }
            return $returnQuestions;
        } catch (Throwable) {
            $this->logger->error('mindSearch getSubQuestionsFromLLMStringResponse 失败 $llmResponse:' . $llmResponse);
            return [$userMessage];
        }
    }

    /**
     * @return ToolCall[]
     */
    private function getLLMToolsCall(ChatCompletionResponse $response): array
    {
        if (! $response->getFirstChoice()?->isFinishedByToolCall()) {
            return [];
        }
        $message = $response->getFirstChoice()?->getMessage();
        if (! $message instanceof AssistantMessage) {
            return [];
        }
        return $message->getToolCalls();
    }
}
