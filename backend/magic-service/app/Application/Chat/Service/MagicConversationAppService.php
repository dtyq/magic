<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Agent\Constant\InstructType;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\ChatCompletionsDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SlidingWindow\SlidingWindowUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
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
        protected readonly Redis $redis
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

        // Check if conversation ID belongs to current user (skip if conversation_id is null)
        $conversationId = $chatCompletionsDTO->getConversationId();
        if ($conversationId) {
            $this->magicConversationDomainService->getConversationById($conversationId, $dataIsolation);
        }

        // Generate a unique throttle key based on user ID and conversation ID
        $throttleKey = sprintf('chat_completions_throttle:%s', $userAuthorization->getMagicId());

        // Use the sliding window utility for throttling, accepting only one request per 100ms window
        $canExecute = $this->redis->set($throttleKey, '1', ['NX', 'PX' => (int) (0.1 * 1000)]);
        if (! $canExecute) {
            $this->logger->info('Chat completions request skipped due to throttle', [
                'user_id' => $userAuthorization->getId(),
                'conversation_id' => $conversationId,
                'throttle_key' => $throttleKey,
            ]);
            return '';
        }
        try {
            $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($userAuthorization);
            $microAgent = MicroAgentFactory::fast('auto_completion');
            if (! $microAgent->isEnabled()) {
                return '';
            }
            $systemReplace = [
                'historyContext' => MessageAssembler::buildHistoryContext($chatHistoryMessages, 3000, $userAuthorization->getNickname()),
                'userNickname' => $userAuthorization->getNickname(),
                'currentTime' => date('Y-m-d H:i:s'),
            ];

            // 构造完整的 user prompt
            $userInput = $chatCompletionsDTO->getMessage();
            $noCompletionChar = self::NO_COMPLETION_NEEDED;
            $userPrompt = <<<UserPrompt
我正在输入框中打字，请补全我接下来可能输入的内容。

当前输入：{$userInput}

要求：
- 只输出续写内容，不解释、不回答问题
- 从停下的位置继续，不重复已输入的内容
- 保持语种、语气一致，长度 ≤50 字符
- 遇到疑问句时，预测问题的后半部分，而非回答
- 即使句子语法完整，也尝试预测下一句开头
- 仅当逻辑完全结束、无法续写时，返回 `{$noCompletionChar}`
UserPrompt;

            $response = $microAgent->easyCall(
                dataIsolation: $modelGatewayDataIsolation,
                systemReplace: $systemReplace,
                userPrompt: $userPrompt,
                businessParams: [
                    'organization_id' => $userAuthorization->getOrganizationCode(),
                    'user_id' => $userAuthorization->getId(),
                    'business_id' => $chatCompletionsDTO->getConversationId(),
                    'source_id' => 'conversation_chat_completion',
                    'task_type' => 'text_completion',
                ]
            );

            $completionContent = $response->getFirstChoice()?->getMessage()->getContent() ?? '';
            // Check for special "no completion needed" identifier
            if (trim($completionContent) === self::NO_COMPLETION_NEEDED) {
                return '';
            }

            // Remove duplicate user input prefix
            $userInput = $chatCompletionsDTO->getMessage();
            return $this->removeUserInputPrefix($completionContent, $userInput);
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
        $this->logger->info(sprintf('Start saving instructions, conversation ID: %s, instruction count: %d', $conversationId, count($instructs)));

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
                    case InstructType::TEXT:
                        break;
                }
            }
        }

        // Validate submitted instructions
        foreach ($instructs as $instructId => $value) {
            // Check if instruction ID exists
            if (! isset($availableInstructs[$instructId])) {
                $this->logger->error(sprintf('Instruction ID does not exist: %s', $instructId));
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_id_not_found');
            }

            $option = $availableInstructs[$instructId];

            // If value is empty or null, it means delete instruction, no need to validate value
            if (empty($value)) {
                $this->logger->info(sprintf('Instruction %s value is empty or null, will perform delete operation, skip value validation', $instructId));
                continue;
            }

            $this->logger->info(sprintf('Validate instruction: %s, type: %s, value: %s', $instructId, $option['type'], $value));

            // Validate value according to type
            if (! in_array($value, $option['values'])) {
                $this->logger->error(sprintf('Invalid instruction value: %s => %s, valid values: %s', $instructId, $value, implode(',', $option['values'])));
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_invalid');
            }
        }

        $conversationEntity = $this->magicConversationDomainService->getConversationById($conversationId, DataIsolation::create($authenticatable->getOrganizationCode(), $authenticatable->getId()));

        $oldInstructs = $conversationEntity->getInstructs();

        $mergeInstructs = $this->mergeInstructs($oldInstructs, $instructs);
        $this->logger->info('Merged instructions: ' . Json::encode($mergeInstructs));

        // Save to conversation window
        $this->magicConversationDomainService->saveInstruct($authenticatable, $mergeInstructs, $conversationId);

        return [
            'instructs' => $instructs,
        ];
    }

    /**
     * Get topic id when agent sends message.
     * @throws Throwable
     */
    public function agentSendMessageGetTopicId(MagicConversationEntity $senderConversationEntity): string
    {
        return $this->magicTopicDomainService->agentSendMessageGetTopicId($senderConversationEntity, 0);
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
            if (isset($value) && $value !== '') {
                // Log update
                $this->logger->info(sprintf('Instruction update: %s from %s to %s', $instructId, $oldValue, $value));

                // Update value
                $oldInstructs[$instructId] = $value;
            } else {
                // Empty value or null means delete the instruction
                $this->logger->info(sprintf('Instruction %s passed empty value or null, perform delete operation', $instructId));
                if (isset($oldInstructs[$instructId])) {
                    unset($oldInstructs[$instructId]);
                }
            }
        }

        return $oldInstructs;
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
