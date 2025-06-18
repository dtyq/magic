<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\Service\LLMAppService;
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
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SlidingWindow\SlidingWindowUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\Role;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Chat message related.
 */
class MagicConversationAppService extends AbstractAppService
{
    /**
     * Special character identifier: indicates no completion needed.
     */
    private const string NO_COMPLETION_NEEDED = '~';

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
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(get_class($this));
        } catch (Throwable) {
        }
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
            $userAuthorization->getMagicId(),
            $chatCompletionsDTO->getConversationId()
        );

        // Use the sliding window utility for debouncing, executing only the last request within a 1-second window
        if (! $this->slidingWindowUtil->shouldExecuteWithDebounce($debounceKey, 0.1)) {
            $this->logger->info('Chat completions request skipped due to debounce', [
                'user_id' => $userAuthorization->getId(),
                'conversation_id' => $chatCompletionsDTO->getConversationId(),
                'debounce_key' => $debounceKey,
            ]);
            return '';
        }
        try {
            // Build completion DTO with all necessary data
            $completionDTO = $this->buildCompletionRequest(
                $chatHistoryMessages,
                $userAuthorization,
                $chatCompletionsDTO
            );

            // Call LLM service
            $llmAppService = di(LLMAppService::class);
            $response = $llmAppService->chatCompletion($completionDTO);
            if ($response instanceof ChatCompletionResponse) {
                $completionContent = $response->getFirstChoice()?->getMessage()->getContent() ?? '';
                // Check for special "no completion needed" identifier
                if (trim($completionContent) === self::NO_COMPLETION_NEEDED) {
                    return '';
                }

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
        // Collect all available instruction options
        $availableInstructs = [];
        $this->logger->info("Start saving instructions, conversation ID: {$conversationId}, instruction count: " . count($instructs));

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
                            // Collect all selectable value IDs for single choice type
                            $availableInstructs[$itemId] = [
                                'type' => InstructType::SINGLE_CHOICE->name,
                                'values' => array_column($item['values'], 'id'),
                            ];
                        }
                        break;
                    case InstructType::SWITCH:
                        // Collect selectable values for switch type
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

        // Record all available instructions
        $this->logger->debug('Available instruction configuration: ' . json_encode($availableInstructs, JSON_UNESCAPED_UNICODE));

        // Validate submitted instructions
        foreach ($instructs as $instructId => $value) {
            // Check if instruction ID exists
            if (! isset($availableInstructs[$instructId])) {
                $this->logger->error("Instruction ID does not exist: {$instructId}");
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_id_not_found');
            }

            $option = $availableInstructs[$instructId];

            // If value is empty or null, it means delete instruction, no need to validate value
            if (empty($value)) {
                $this->logger->info("Instruction {$instructId} value is empty or null, will perform delete operation, skip value validation");
                continue;
            }

            $this->logger->info("Validate instruction: {$instructId}, type: {$option['type']}, value: {$value}");

            // Validate value according to type
            if (! in_array($value, $option['values'])) {
                $this->logger->error("Invalid instruction value: {$instructId} => {$value}, valid values: " . implode(',', $option['values']));
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_invalid');
            }
        }

        $conversationEntity = $this->magicConversationDomainService->getConversationById($conversationId, DataIsolation::create($authenticatable->getOrganizationCode(), $authenticatable->getId()));

        $oldInstructs = $conversationEntity->getInstructs();

        $mergeInstructs = $this->mergeInstructs($oldInstructs, $instructs);
        $this->logger->info('Merged instructions: ' . json_encode($mergeInstructs, JSON_UNESCAPED_UNICODE));

        // Save to conversation window
        $this->magicConversationDomainService->saveInstruct($authenticatable, $mergeInstructs, $conversationId);

        return [
            'instructs' => $instructs,
        ];
    }

    /**
     * Get topic id when agent sends message.
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
     * Merge old and new instructions.
     *
     * @param array $oldInstructs Old instructions ['instructId' => 'value']
     * @param array $newInstructs New instructions ['instructId' => 'value']
     * @return array Merged instructions
     */
    private function mergeInstructs(array $oldInstructs, array $newInstructs): array
    {
        // Iterate through new instructions, update or add to old instructions
        foreach ($newInstructs as $instructId => $value) {
            // Record status change
            $oldValue = $oldInstructs[$instructId] ?? '';

            // Check if it's a valid value
            if (isset($value) && $value !== '' && $value !== null) {
                // Log update
                $this->logger->info("Instruction update: {$instructId} from {$oldValue} to {$value}");

                // Update value
                $oldInstructs[$instructId] = $value;
            } else {
                // Empty value or null means delete the instruction
                $this->logger->info("Instruction {$instructId} passed empty value or null, perform delete operation");
                if (isset($oldInstructs[$instructId])) {
                    unset($oldInstructs[$instructId]);
                }
            }
        }

        return $oldInstructs;
    }

    /**
     * Build complete completion request DTO.
     */
    private function buildCompletionRequest(
        array $chatHistoryMessages,
        MagicUserAuthorization $userAuthorization,
        ChatCompletionsDTO $chatCompletionsDTO
    ): CompletionDTO {
        // Get model name
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain(
            $userAuthorization->getOrganizationCode(),
            LLMModelEnum::DEEPSEEK_V3->value
        );
        // Build history context with length limit, prioritizing recent messages
        $historyContext = MessageAssembler::buildHistoryContext($chatHistoryMessages, 3000, $userAuthorization->getNickname());

        // Generate base system prompt (cacheable)
        $baseSystemPrompt = <<<'Prompt'
            # 角色:
            你是一个专业的实时打字补全助手，专门为当前正在打字的用户提供智能输入建议。
           
            # 目标：
            预测当前用户接下来可能要输入的文本内容。
            
            ## 历史聊天记录：
            <CONTEXT>
            {historyContext}
            </CONTEXT>
              
            ### 输出要求
            1. **纯净输出**：只返回补全的文本内容，不包含任何解释说明，可以包含标点符号
            2. **避免重复**：不要重复当前用户正在输入的内容
            3. **自然衔接**：确保补全内容与用户输入形成自然流畅的完整句子
            4. **严禁回答**：禁止对用户的输入进行回答或者解释，只提供补全建议
            
            ### 特殊指令处理
            **输入为完整句子**:
            - **判断标准**：如果用户输入的内容本身已经构成一个语法完整、意思清晰的句子（比如以句号、问号、感叹号结尾，或者逻辑上已经表达完整），则无需进行补全。
            - **输出指令**：当判断输入为完整句子时，你必须只返回结束补全的特殊标识符：`{noCompletionChar}`，不要返回任何其他内容。
            - **示例**：
              - 用户输入: "好的，我知道了" -> 返回: `{noCompletionChar}`
              - 用户输入: "你叫什么名字？" -> 返回: `{noCompletionChar}`
        Prompt;

        // Generate current request prompt (dynamic)
        $currentRequestPrompt = <<<'Prompt'
            ## 当前用户：
            用户昵称：{userNickname}
            
            ## 用户当前输入：
            <CURRENT_INPUT>
            {currentInput}
            </CURRENT_INPUT>
            
            请为当前用户的正在输入提供最佳补全建议，或者返回结束补全的特殊标识符：
        Prompt;

        // Replace placeholders for base system prompt (cacheable)
        $baseSystemPrompt = str_replace(
            ['{historyContext}', '{noCompletionChar}'],
            [$historyContext, self::NO_COMPLETION_NEEDED],
            $baseSystemPrompt
        );

        // Replace placeholders for current request prompt (dynamic)
        $currentRequestPrompt = str_replace(
            ['{userNickname}', '{currentInput}'],
            [$userAuthorization->getNickname(), $chatCompletionsDTO->getMessage()],
            $currentRequestPrompt
        );

        // Build messages for completion with two system parts
        $messages = [
            [
                'role' => Role::System->value,
                'content' => $baseSystemPrompt,
            ],
            [
                'role' => Role::System->value,
                'content' => $currentRequestPrompt,
            ],
        ];
        // Create CompletionDTO
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel($modelName);
        $completionDTO->setMessages($messages);
        $completionDTO->setTemperature(0.3); // Lower temperature for more deterministic completion
        $completionDTO->setFrequencyPenalty(0.5); // Frequency penalty to reduce repetitive vocabulary
        $completionDTO->setPresencePenalty(0.3); // Presence penalty to encourage new vocabulary
        $completionDTO->setStream(false);
        $completionDTO->setMaxTokens(50);
        $completionDTO->setStop(["\n", "\n\n"]); // Stop tokens to control completion behavior

        // Set access token
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $completionDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }

        // Set business params in one call
        $completionDTO->setBusinessParams([
            'organization_id' => $userAuthorization->getOrganizationCode(),
            'user_id' => $userAuthorization->getId(),
            'business_id' => $chatCompletionsDTO->getConversationId(),
            'source_id' => 'conversation_chat_completion',
            'task_type' => 'text_completion',
        ]);
        var_dump($messages);
        return $completionDTO;
    }

    private function removeUserInputPrefix(string $content, string $userInput): string
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
        // For example, user input "if", model returns "if I want...", we only keep "I want..."
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
