<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Chat\Repository\Persistence\MagicChatFollowUpSuggestionRepository;
use App\Domain\Chat\Service\FollowUpContextDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FollowUpSuggestionAppService extends AbstractAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly FollowUpContextDomainService $followUpContextDomainService,
        protected readonly MagicChatFollowUpSuggestionRepository $followUpSuggestionRepository,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(static::class);
        } catch (Throwable) {
        }
    }

    /**
     * 异步生成追问建议并持久化，不阻塞主链路。
     */
    public function generateAndPersist(DataIsolation $isolation, int $topicId, string $taskId): void
    {
        // 初始化模型配置
        $modelGatewayDataIsolation = $this->createFollowUpModelGatewayDataIsolation($isolation);
        $microAgent = MicroAgentFactory::fast('follow_up_generator');
        if (! $microAgent->isEnabled()) {
            $this->followUpSuggestionRepository->markFailed($taskId);
            return;
        }

        // 查询当前话题下最近的6条问题消息作为上下文
        $historyContext = $this->followUpContextDomainService->buildFollowUpContextExcerptByTopicId($topicId, 3);
        if ($historyContext === '') {
            $this->followUpSuggestionRepository->markFailed($taskId);
            return;
        }

        // 构建上下文
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
                    'organization_id' => $isolation->getCurrentOrganizationCode(),
                    'user_id' => $isolation->getCurrentUserId() ?? '',
                    'business_id' => (string) $topicId,
                    'source_id' => 'follow_up_suggestions',
                    'task_type' => 'text_completion',
                ],
            );
            $content = trim($response->getFirstChoice()?->getMessage()->getContent() ?? '');
        } catch (Throwable $e) {
            $this->logger->error('followUpSuggestions easyCall failed', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);
            $this->followUpSuggestionRepository->markFailed($taskId);
            return;
        }

        $this->followUpSuggestionRepository->markDone(
            $taskId,
            $this->parseSuggestions($content)
        );
    }

    /**
     * 查询已落库的追问建议，HTTP 层只走这一条查询能力。
     */
    public function query(int $topicId, ?string $taskId = null): array
    {
        // 最新的消息查询
        if ($taskId !== null && $taskId !== '') {
            $record = $this->followUpSuggestionRepository->findLatestByTopicIdAndTaskId($topicId, $taskId);
        }
        // 历史消息查询
        else {
            $record = $this->followUpSuggestionRepository->findLatestByTopicId($topicId);
        }

        // 异常为空的话直接返回
        if ($record === null) {
            return [
                'topic_id' => $topicId,
                'task_id' => null,
                'status' => null,
                'suggestions' => [],
                'updated_at' => '',
            ];
        }

        return [
            'topic_id' => (int) ($record['topic_id'] ?? $topicId),
            'task_id' => $record['task_id'] ?? null,
            'status' => (int) ($record['status'] ?? MagicChatFollowUpSuggestionRepository::STATUS_GENERATING),
            'suggestions' => array_values($record['suggestions'] ?? []),
            'updated_at' => $record['updated_at'] ?? '',
        ];
    }

    /**
     * 将大模型返回的纯文本按换行切分为追问列表。
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
            $line = trim((string) preg_replace('/^\d+[.)]\s*/u', '', trim($line)));
            if ($line === '') {
                continue;
            }
            $suggestions[] = $line;
        }

        return array_slice(array_values(array_unique($suggestions)), 0, 3);
    }

    private function createFollowUpModelGatewayDataIsolation(DataIsolation $isolation): ModelGatewayDataIsolation
    {
        $dataIsolation = ModelGatewayDataIsolation::createByOrganizationCodeWithoutSubscription(
            $isolation->getCurrentOrganizationCode(),
            $isolation->getCurrentUserId() ?? ''
        );
        $dataIsolation->setBusinessId('follow_up_suggestions');

        return $dataIsolation;
    }
}
