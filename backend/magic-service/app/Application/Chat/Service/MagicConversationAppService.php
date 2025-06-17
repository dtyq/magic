<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\Domain\Agent\Constant\InstructType;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\ChatCompletionsDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Odin\AgentFactory;
use App\Infrastructure\Util\SlidingWindow\SlidingWindowUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Agent\Agent;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Contract\Message\MessageInterface;
use Hyperf\Odin\Memory\MemoryManager;
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Odin\Message\UserMessage;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Chat message related.
 */
class MagicConversationAppService extends MagicSeqAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly MagicTopicDomainService $magicTopicDomainService,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicChatFileDomainService $magicChatFileDomainService,
        protected MagicSeqDomainService $magicSeqDomainService,
        protected FileDomainService $fileDomainService,
        protected readonly MagicAgentDomainService $magicAgentDomainService,
        protected readonly SlidingWindowUtil $slidingWindowUtil,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
        parent::__construct($magicSeqDomainService);
    }

    /**
     * Chat completion for conversation context.
     *
     * @param array $chatHistoryMessages Chat history messages, role values are user's real names (or nicknames) for group chat compatibility
     */
    public function conversationChatCompletions(
        array $chatHistoryMessages,
        ChatCompletionsDTO $chatCompletionsDTO,
        MagicUserAuthorization $userAuthorization
    ): string {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // Check if conversation ID belongs to current user
        $this->magicConversationDomainService->getConversationById($chatCompletionsDTO->getConversationId(), $dataIsolation);

        // Generate a unique debounce key based on user ID and conversation ID
        $debounceKey = sprintf(
            'chat_completions_debounce:%s:%s',
            $userAuthorization->getId(),
            $chatCompletionsDTO->getConversationId()
        );

        // Use the sliding window utility for debouncing, executing only the last request within a 1-second window
        if (! $this->slidingWindowUtil->shouldExecuteWithDebounce($debounceKey, 0.6)) {
            $this->logger->info('Chat completions request skipped due to debounce', [
                'user_id' => $userAuthorization->getId(),
                'conversation_id' => $chatCompletionsDTO->getConversationId(),
                'debounce_key' => $debounceKey,
            ]);
            return '';
        }
        // Build history context with length limit, prioritizing recent messages
        $historyContext = $this->buildHistoryContext($chatHistoryMessages);

        // Generate system prompt for user input completion
        $systemPrompt = <<<'Prompt'
            你是一个专业的智能输入补全助手。你的任务是根据对话历史和用户当前的输入，提供准确、简洁的文本补全建议。
            
            ## 对话历史：
            <CONVERSATION_START>
            {historyContext}
            <CONVERSATION_END>
            
            ## 补全规则：
            1. 仔细分析对话上下文和用户意图
            2. 提供自然、流畅的补全内容
            3. 保持与对话主题的一致性
            4. 补全内容应该简洁明了，通常不超过一句话
            5. 只返回补全的文本内容，不要添加任何解释、标点或格式
            6. 重要：不要重复用户当前正在输入的内容，只提供接下来的补全部分
            7. 如果用户输入不完整，请直接续写，不要从头开始
            
            请根据以上对话历史，为用户的当前输入提供最合适的补全建议：
        Prompt;

        // Replace placeholders
        $systemPrompt = str_replace('{historyContext}', $historyContext, $systemPrompt);
        // Get current user nickname
        $currentUserRole = $userAuthorization->getRealName();
        // Create MessageInterface array
        $messages = [
            new SystemMessage($systemPrompt),
            new UserMessage(sprintf('%s: %s', $currentUserRole, $chatCompletionsDTO->getMessage())),
        ];

        $messageHistory = new MessageHistory();
        $messageHistory->addMessages($messages, uniqid('', true));

        try {
            // Use ChatCompletions interface implementation
            // Get model name
            $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain(
                $userAuthorization->getOrganizationCode(),
                LLMModelEnum::DEEPSEEK_V3->value
            );

            // Get model instance
            $model = di(ModelGatewayMapper::class)->getChatModelProxy($modelName, $userAuthorization->getOrganizationCode());

            // Get memoryManager instance and add messages
            $memoryManager = new MemoryManager();
            foreach ($messages as $message) {
                $memoryManager->addMessage($message);
            }

            // Create agent instance
            $agent = AgentFactory::create(
                model: $model,
                memoryManager: $memoryManager,
                temperature: 0.3, // Lower temperature for more deterministic completion
                businessParams: [
                    'organization_id' => $userAuthorization->getOrganizationCode(),
                    'user_id' => $userAuthorization->getId(),
                    'business_id' => $chatCompletionsDTO->getConversationId(),
                    'source_id' => 'conversation_chat_completions',
                    'task_type' => 'text_completion', // Explicitly identify as completion task
                ]
            );
            // Frequency penalty to reduce repetitive vocabulary
            $agent->setFrequencyPenalty(0.5);
            // Presence penalty to encourage new vocabulary
            $agent->setPresencePenalty(0.3);

            $response = $agent->chatAndNotAutoExecuteTools();
            if ($response instanceof ChatCompletionResponse) {
                $completionContent = $response->getFirstChoice()?->getMessage()->getContent() ?? '';

                // Remove duplicate user input prefix
                $userInput = $chatCompletionsDTO->getMessage();
                return $this->removeUserInputPrefix($completionContent, $userInput);
            }
        } catch (Throwable $exception) {
            $this->logger->error('conversationChatCompletions failed: ' . $exception->getMessage());
        }

        // Return empty string if implementation fails
        return '';
    }

    public function saveInstruct(MagicUserAuthorization $authenticatable, array $instructs, string $conversationId, array $agentInstruct): array
    {
        // 收集所有可用的指令选项
        $availableInstructs = [];
        $this->logger->info("开始保存指令，会话ID: {$conversationId}，指令数量: " . count($instructs));

        foreach ($agentInstruct as $group) {
            foreach ($group['items'] as $item) {
                if (isset($item['display_type'])) {
                    continue;
                }
                $itemId = $item['id'];
                $type = InstructType::fromType($item['type']);

                switch ($type) {
                    case InstructType::SINGLE_CHOICE:
                        if (isset($item['values'])) {
                            // 收集单选类型的所有可选值ID
                            $availableInstructs[$itemId] = [
                                'type' => InstructType::SINGLE_CHOICE->name,
                                'values' => array_column($item['values'], 'id'),
                            ];
                        }
                        break;
                    case InstructType::SWITCH:
                        // 收集开关类型的可选值
                        $availableInstructs[$itemId] = [
                            'type' => InstructType::SWITCH->name,
                            'values' => ['on', 'off'],
                        ];
                        break;
                    case InstructType::STATUS:
                        $availableInstructs[$itemId] = [
                            'type' => InstructType::STATUS->name,
                            'values' => array_column($item['values'], 'id'),
                        ];
                        break;
                }
            }
        }

        // 记录所有可用的指令
        $this->logger->debug('可用指令配置: ' . json_encode($availableInstructs, JSON_UNESCAPED_UNICODE));

        // 验证提交的指令
        foreach ($instructs as $instructId => $value) {
            // 检查指令ID是否存在
            if (! isset($availableInstructs[$instructId])) {
                $this->logger->error("指令ID不存在: {$instructId}");
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_id_not_found');
            }

            $option = $availableInstructs[$instructId];

            // 如果值为空或null，表示删除指令，不需要验证值
            if (empty($value)) {
                $this->logger->info("指令 {$instructId} 值为空或null，将执行删除操作，跳过值验证");
                continue;
            }

            $this->logger->info("验证指令: {$instructId}, 类型: {$option['type']}, 值: {$value}");

            // 根据类型验证值
            if (! in_array($value, $option['values'])) {
                $this->logger->error("指令值无效: {$instructId} => {$value}, 有效值: " . implode(',', $option['values']));
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_invalid');
            }
        }

        $conversationEntity = $this->magicConversationDomainService->getConversationById($conversationId, DataIsolation::create($authenticatable->getOrganizationCode(), $authenticatable->getId()));

        $oldInstructs = $conversationEntity->getInstructs();

        $mergeInstructs = $this->mergeInstructs($oldInstructs, $instructs);
        $this->logger->info('合并后的指令: ' . json_encode($mergeInstructs, JSON_UNESCAPED_UNICODE));

        // 保存到会话窗口中
        $this->magicConversationDomainService->saveInstruct($authenticatable, $mergeInstructs, $conversationId);

        return [
            'instructs' => $instructs,
        ];
    }

    /**
     * agent 发送消息时获取话题 id.
     */
    public function agentSendMessageGetTopicId(MagicConversationEntity $senderConversationEntity): string
    {
        return $this->magicTopicDomainService->agentSendMessageGetTopicId($senderConversationEntity, 0);
    }

    public function deleteTrashMessages(): array
    {
        return $this->magicChatDomainService->deleteTrashMessages();
    }

    /**
     * 合并新旧指令.
     *
     * @param array $oldInstructs 旧指令 ['instructId' => 'value']
     * @param array $newInstructs 新指令 ['instructId' => 'value']
     * @return array 合并后的指令
     */
    private function mergeInstructs(array $oldInstructs, array $newInstructs): array
    {
        // 遍历新指令，更新或添加到旧指令中
        foreach ($newInstructs as $instructId => $value) {
            // 记录状态变更
            $oldValue = $oldInstructs[$instructId] ?? '';

            // 判断是否是有效的值
            if (isset($value) && $value !== '' && $value !== null) {
                // 记录日志
                $this->logger->info("指令更新: {$instructId} 从 {$oldValue} 变为 {$value}");

                // 更新值
                $oldInstructs[$instructId] = $value;
            } else {
                // 传入空值或 null 表示要删除该指令
                $this->logger->info("指令 {$instructId} 传入空值或 null，执行删除操作");
                if (isset($oldInstructs[$instructId])) {
                    unset($oldInstructs[$instructId]);
                }
            }
        }

        return $oldInstructs;
    }

    /**
     * Builds a length-limited chat history context.
     * To ensure context coherence, this method prioritizes keeping the most recent messages.
     *
     * @param array $chatHistoryMessages Chat history messages
     * @param int $maxLength Maximum string length
     */
    private function buildHistoryContext(array $chatHistoryMessages, int $maxLength = 3000): string
    {
        $limitedMessages = [];
        $currentLength = 0;

        // Iterate through messages in reverse to prioritize recent ones
        foreach (array_reverse($chatHistoryMessages) as $message) {
            $role = $message['role'] ?? 'user';
            $content = $message['content'] ?? '';

            if (empty(trim($content))) {
                continue;
            }

            $formattedMessage = sprintf("%s: %s\n", $role, $content);
            $messageLength = mb_strlen($formattedMessage, 'UTF-8');

            if ($currentLength + $messageLength > $maxLength) {
                // Stop adding messages if the current one exceeds the length limit
                break;
            }

            // Prepend the message to the array to maintain the original chronological order
            array_unshift($limitedMessages, $formattedMessage);
            $currentLength += $messageLength;
        }

        return implode('', $limitedMessages);
    }

    private function removeUserInputPrefix($content, $userInput)
    {
        if (empty($content) || empty($userInput)) {
            return $content;
        }

        // Remove leading and trailing whitespace
        $content = trim($content);
        $userInput = trim($userInput);

        // If completion content starts with user input, remove that part
        if (stripos($content, $userInput) === 0) {
            $content = substr($content, strlen($userInput));
            $content = ltrim($content); // Remove left whitespace
        }

        // Handle partial duplication cases
        // For example, user input "如果", model returns "如果我想...", we only keep "我想..."
        $userWords = mb_str_split($userInput, 1, 'UTF-8');
        $contentWords = mb_str_split($content, 1, 'UTF-8');

        $matchLength = 0;
        $minLength = min(count($userWords), count($contentWords));

        for ($i = 0; $i < $minLength; ++$i) {
            if ($userWords[$i] === $contentWords[$i]) {
                ++$matchLength;
            } else {
                break;
            }
        }

        // If there's partial match and match length is greater than half of user input, remove matched part
        if ($matchLength > 0 && $matchLength >= strlen($userInput) / 2) {
            $content = mb_substr($content, $matchLength, null, 'UTF-8');
            $content = ltrim($content);
        }

        return $content;
    }
}
