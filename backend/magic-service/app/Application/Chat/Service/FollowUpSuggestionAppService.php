<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Chat\Service\FollowUpContextDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FollowUpSuggestionAppService extends AbstractAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly FollowUpContextDomainService $followUpContextDomainService,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(static::class);
        } catch (Throwable) {
        }
    }

    /**
     * 生成追问问题.
     */
    public function generateFollowUpSuggestions(
        MagicUserAuthorization $authorization,
        int $topicId,
    ): array {
        // 模型不可用的话直接返回
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($authorization);
        $microAgent = MicroAgentFactory::fast('follow_up_generator');
        if (! $microAgent->isEnabled()) {
            return ['suggestions' => []];
        }

        // 查询数据库得到上下文（当前 topic 下最近三轮，共 6 条问答消息）
        $historyContext = $this->followUpContextDomainService->buildFollowUpContextExcerptByTopicId($topicId, 3);

        // 构建用户上下文信息
        $currentTime = date('Y-m-d H:i:s');
        $userPrompt = <<<PROMPT
请基于以下用户问题摘录，生成3个最自然的后续追问。

## 最近用户问题摘录
<HISTORY_START>
{$historyContext}
<HISTORY_END>

当前时间：{$currentTime}
PROMPT;

        try {
            // 调用简易chat链路
            $response = $microAgent->easyCall(
                dataIsolation: $modelGatewayDataIsolation,
                systemReplace: [
                    'language' => $modelGatewayDataIsolation->getLanguage(),
                ],
                userPrompt: $userPrompt,
                businessParams: [
                    'organization_id' => $authorization->getOrganizationCode(),
                    'user_id' => $authorization->getId(),
                    'business_id' => (string) $topicId,
                    'source_id' => 'follow_up_suggestions',
                    'task_type' => 'text_completion',
                ],
            );
            $content = trim($response->getFirstChoice()?->getMessage()->getContent() ?? '');
        } catch (Throwable $e) {
            $this->logger->error('followUpSuggestions easyCall failed: ' . $e->getMessage());
            return ['suggestions' => []];
        }

        // 格式化大模型输出内容
        return ['suggestions' => $this->parseSuggestions($content)];
    }

    /**
     * 将大模型返回的纯文本按换行切分为追问列表.
     * @return string[]
     */
    private function parseSuggestions(string $content): array
    {
        if ($content === '') {
            return [];
        }

        $lines = preg_split('/\R/u', $content) ?: [];
        $suggestions = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $suggestions[] = $line;
        }

        return array_slice($suggestions, 0, 3);
    }
}
