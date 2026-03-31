<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Domain\Chat\Entity\ValueObject\FollowUpContextLine;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionType;
use App\Domain\Chat\Service\MagicGeneratedSuggestionDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Interfaces\Chat\Assembler\MagicGeneratedSuggestionAssembler;
use App\Interfaces\Chat\DTO\Response\FollowUpSuggestionQueryResponseDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskMessageDomainService;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FollowUpSuggestionAppService extends AbstractAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly TaskMessageDomainService $taskMessageDomainService,
        protected readonly MagicGeneratedSuggestionDomainService $generatedSuggestionDomainService,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(static::class);
        } catch (Throwable) {
        }
    }

    /**
     * 异步生成追问建议并持久化，不阻塞主链路.
     */
    public function generateAndPersist(DataIsolation $isolation, int $topicId, string $taskId, string $historyContext): void
    {
        // 初始化模型配置
        $modelGatewayDataIsolation = $this->createFollowUpModelGatewayDataIsolation($isolation);
        $microAgent = MicroAgentFactory::fast('follow_up_generator');
        if (! $microAgent->isEnabled()) {
            $this->logger->error('follow_up_generator model configuration error');
            $this->updateSuperMagicTopicFollowUpStatus(
                $taskId,
                GeneratedSuggestionStatus::Failed,
            );
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
            $this->updateSuperMagicTopicFollowUpStatus(
                $taskId,
                GeneratedSuggestionStatus::Failed,
            );
            return;
        }

        $this->updateSuperMagicTopicFollowUpStatus(
            $taskId,
            GeneratedSuggestionStatus::Done,
            $this->parseSuggestions($content),
        );
    }

    /**
     * 初始化生成推荐问题记录.
     */
    public function createSuperMagicTopicFollowUpGenerating(
        string $taskId,
        array $params = [],
        ?string $createdUid = null,
    ): array {
        return $this->generatedSuggestionDomainService->createGenerating(
            GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP,
            $taskId,
            $params,
            $createdUid,
        );
    }

    /**
     * 构建 super magic 追问建议上下文.
     */
    public function buildSuperMagicTopicFollowUpHistoryContext(int $topicId, int $roundLimit = 3): string
    {
        return $this->buildFollowUpHistoryContextExcerpt($topicId, $roundLimit);
    }

    /**
     * 基于上下文构建 super magic 追问建议参数.
     */
    public function buildSuperMagicTopicFollowUpParams(
        string $taskId,
        int $topicId,
        ?string $language,
        string $historyContext,
    ): array {
        return [
            'task_id' => $taskId,
            'topic_id' => (string) $topicId,
            'source' => 'super_magic',
            'generator' => 'follow_up_generator',
            'language' => $language,
            'content' => $historyContext,
        ];
    }

    /**
     * 通用查询入口：按 type + relation_id 查询建议结果。
     */
    public function queryFollowUpSuggestions(MagicGeneratedSuggestionEntity $criteria): FollowUpSuggestionQueryResponseDTO
    {
        $entity = $this->generatedSuggestionDomainService->queryByCriteria($criteria);

        return MagicGeneratedSuggestionAssembler::entityToQueryResponseDto($entity);
    }

    /**
     * 查询当前话题下的最近 N 轮对话问 + 答（合并排序后的 prompt 行文本）.
     */
    private function buildFollowUpHistoryContextExcerpt(int $topicId, int $roundLimit = 3): string
    {
        $contextMessages = $this->taskMessageDomainService->findFollowUpContextMessages($topicId, $roundLimit);
        $linesToRender = $this->mapTaskMessagesToFollowUpContextLines($contextMessages);
        if ($linesToRender === []) {
            return '';
        }

        usort($linesToRender, [FollowUpContextLine::class, 'compare']);

        $lines = [];
        foreach ($linesToRender as $line) {
            if ($line->content === '') {
                continue;
            }
            $lines[] = $line->toPromptLine();
        }

        return $lines === [] ? '' : implode("\n", $lines);
    }

    /**
     * 格式化消息message -> followUpContextLine.
     */
    private function mapTaskMessagesToFollowUpContextLines(array $messages): array
    {
        $lines = [];
        foreach ($messages as $message) {
            $rawContent = trim($message->getContent());
            if ($rawContent === '') {
                $content = '[回答内容为空]';
            } else {
                try {
                    $decoded = Json::decode($rawContent);
                    if (is_array($decoded)) {
                        $rawContent = trim((string) ($decoded['content'] ?? ''));
                    }
                } catch (Throwable) {
                }

                $content = trim((string) preg_replace('/\s+/u', ' ', $rawContent));
                if ($content === '') {
                    $content = '[回答内容为空]';
                }
            }

            $sendTs = $message->getSendTimestamp();
            $lines[] = new FollowUpContextLine(
                $sendTs,
                $message->getId(),
                date('Y-m-d H:i:s', $sendTs),
                $content,
                $message->getSenderType() === 'user',
            );
        }

        return $lines;
    }

    /**
     * 将大模型返回的纯文本按换行切分为追问列表。
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

    /**
     * 更新生成推荐状态.
     */
    private function updateSuperMagicTopicFollowUpStatus(
        string $taskId,
        GeneratedSuggestionStatus $status,
        array $suggestions = [],
    ): void {
        $this->generatedSuggestionDomainService->updateStatus(
            GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP,
            $taskId,
            $status,
            $suggestions,
        );
    }
}
