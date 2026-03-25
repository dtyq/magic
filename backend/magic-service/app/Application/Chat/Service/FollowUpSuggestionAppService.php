<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionType;
use App\Domain\Chat\Repository\Persistence\MagicGeneratedSuggestionRepository;
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
        protected readonly MagicGeneratedSuggestionRepository $generatedSuggestionRepository,
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
            $this->markSuperMagicTopicFollowUpFailed($topicId, $taskId);
            return;
        }

        // 查询当前话题下最近的6条问题消息作为上下文
        $historyContext = $this->followUpContextDomainService->buildFollowUpContextExcerptByTopicId($topicId, 3);
        if ($historyContext === '') {
            $this->markSuperMagicTopicFollowUpFailed($topicId, $taskId);
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
            $this->markSuperMagicTopicFollowUpFailed($topicId, $taskId);
            return;
        }

        $this->markSuperMagicTopicFollowUpDone(
            $topicId,
            $taskId,
            $this->parseSuggestions($content),
        );
    }

    /**
     * 通用查询入口：API 层使用 relation keys，业务层再映射为语义化参数。
     */
    public function queryByRelationKeys(
        int $type,
        string $relationKey1,
        ?string $relationKey2 = null,
        ?string $relationKey3 = null,
    ): array {
        return match ($type) {
            GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP => $this->querySuperMagicTopicFollowUp(
                $relationKey1,
                $relationKey2,
            ),
            default => $this->buildEmptyQueryResult($type, $relationKey1, $relationKey2, $relationKey3),
        };
    }

    /**
     * 查询超级麦吉话题追问建议。
     */
    public function querySuperMagicTopicFollowUp(string $topicId, ?string $taskId = null): array
    {
        $topicIdInt = (int) $topicId;

        // 最新的消息查询
        if ($taskId !== null && $taskId !== '') {
            $record = $this->generatedSuggestionRepository->findLatestByRelationKeys(
                $this->getSuggestionType(),
                $this->getRelationKey1($topicIdInt),
                $this->getRelationKey2($taskId),
                $this->getRelationKey3(),
            );
        }
        // 历史消息查询
        else {
            $record = $this->generatedSuggestionRepository->findLatestByTypeAndRelationKey1(
                $this->getSuggestionType(),
                $this->getRelationKey1($topicIdInt),
            );
        }

        // 异常为空的话直接返回
        if ($record === null) {
            return [
                'type' => $this->getSuggestionType(),
                'type_label' => GeneratedSuggestionType::label($this->getSuggestionType()),
                'relation_keys' => [
                    'relation_key1' => $this->getRelationKey1($topicIdInt),
                    'relation_key2' => $taskId !== null ? $this->getRelationKey2($taskId) : '',
                    'relation_key3' => $this->getRelationKey3(),
                ],
                'params' => [],
                'topic_id' => $topicIdInt,
                'task_id' => $taskId,
                'status' => null,
                'suggestions' => [],
                'updated_at' => '',
            ];
        }

        return [
            'type' => (int) ($record['type'] ?? $this->getSuggestionType()),
            'type_label' => GeneratedSuggestionType::label((int) ($record['type'] ?? $this->getSuggestionType())),
            'relation_keys' => [
                'relation_key1' => (string) ($record['relation_key1'] ?? $this->getRelationKey1($topicIdInt)),
                'relation_key2' => (string) ($record['relation_key2'] ?? ($taskId !== null ? $this->getRelationKey2($taskId) : '')),
                'relation_key3' => (string) ($record['relation_key3'] ?? $this->getRelationKey3()),
            ],
            'params' => $record['params'] ?? [],
            'topic_id' => (int) ($record['relation_key1'] ?? $topicIdInt),
            'task_id' => (string) ($record['relation_key2'] ?? ($record['params']['task_id'] ?? '')),
            'status' => (int) ($record['status'] ?? MagicGeneratedSuggestionRepository::STATUS_GENERATING),
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

    private function getSuggestionType(): int
    {
        return GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP;
    }

    /**
     * @param string[] $suggestions
     */
    private function markSuperMagicTopicFollowUpDone(int $topicId, string $taskId, array $suggestions): void
    {
        $this->generatedSuggestionRepository->markDone(
            $this->getSuggestionType(),
            $this->getRelationKey1($topicId),
            $this->getRelationKey2($taskId),
            $this->getRelationKey3(),
            $suggestions,
        );
    }

    private function markSuperMagicTopicFollowUpFailed(int $topicId, string $taskId): void
    {
        $this->generatedSuggestionRepository->markFailed(
            $this->getSuggestionType(),
            $this->getRelationKey1($topicId),
            $this->getRelationKey2($taskId),
            $this->getRelationKey3(),
        );
    }

    private function buildEmptyQueryResult(
        int $type,
        string $relationKey1,
        ?string $relationKey2 = null,
        ?string $relationKey3 = null,
    ): array {
        return [
            'type' => $type,
            'type_label' => GeneratedSuggestionType::label($type),
            'relation_keys' => [
                'relation_key1' => $relationKey1,
                'relation_key2' => $relationKey2 ?? '',
                'relation_key3' => $relationKey3 ?? '',
            ],
            'params' => [],
            'status' => null,
            'suggestions' => [],
            'updated_at' => '',
        ];
    }

    private function getRelationKey1(int $topicId): string
    {
        return (string) $topicId;
    }

    private function getRelationKey2(string $taskId): string
    {
        return (string) $taskId;
    }

    private function getRelationKey3(): string
    {
        return '';
    }
}
