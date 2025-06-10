<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

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
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 聊天消息相关.
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
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
        parent::__construct($magicSeqDomainService);
    }

    /**
     * @param array $historyMessages 为了适配群聊，$historyMessages 里的 role 值是用户的真名（或者昵称）
     */
    public function conversationChatCompletions(
        array $historyMessages,
        ChatCompletionsDTO $chatCompletionsDTO,
        MagicUserAuthorization $userAuthorization
    ): CompletionDTO {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 检查会话 id是否属于当前用户
        $this->magicConversationDomainService->getConversationById($chatCompletionsDTO->getConversationId(), $dataIsolation);
        $currentUserRole = $userAuthorization->getRealName();
        if (! empty($historyMessages)) {
            $lastMessage = array_splice($historyMessages, -1)[0];
            if ($lastMessage['role'] === $currentUserRole) {
                // 适配小模型，最后一条消息如果是 user，那么把要补全的内容也放入 user
                $lastMessage['content'] .= ' ' . $chatCompletionsDTO->getMessage();
                $historyMessages[] = $lastMessage;
            } else {
                // 把最后一条消息放回去
                $historyMessages[] = $lastMessage;
                // 然后再带上用户正在输入的消息
                $historyMessages[] = [
                    'role' => $currentUserRole,
                    'content' => $chatCompletionsDTO->getMessage(),
                ];
            }
        } else {
            // 带上用户正在输入的消息
            $historyMessages[] = ['role' => $currentUserRole, 'content' => $chatCompletionsDTO->getMessage()];
        }

        $sendMsgGPTDTO = new CompletionDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $sendMsgGPTDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $sendMsgGPTDTO->setModel(LLMModelEnum::GEMMA2_2B->value);
        $sendMsgGPTDTO->setBusinessParams([
            'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'business_id' => $chatCompletionsDTO->getConversationId(),
            'source_id' => 'chat_completions',
        ]);
        // 指明调用的方法
        $sendMsgGPTDTO->setCallMethod(CompletionDTO::METHOD_COMPLETIONS);
        $sendMsgGPTDTO->setMessages($historyMessages);
        $sendMsgGPTDTO->setPrompt($this->getGemma2CompletionTemplateV2($historyMessages));
        $sendMsgGPTDTO->setMaxTokens(30);
        $sendMsgGPTDTO->setTemperature(0);
        $sendMsgGPTDTO->setFrequencyPenalty(1);
        $sendMsgGPTDTO->setPresencePenalty(1);
        $sendMsgGPTDTO->setStop(['\n', '<end_of_turn>', '<end_of_text>']);
        return $sendMsgGPTDTO;
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

    // 传入用户名和角色描述，以增强模型的理解能力，优化群聊补全
    private function getGemma2CompletionTemplateV2(array $messages): string
    {
        $systemPrompt = "以下是一段对话，其中的角色有：\n\n";
        $uniqueRoles = [];
        foreach ($messages as $message) {
            $uniqueKey = $message['role'] . ($message['role_description'] ?? '');
            if (isset($uniqueRoles[$uniqueKey])) {
                continue;
            }
            $roleName = $message['role'];
            $roleDescription = $message['role_description'] ?? '';
            $systemPrompt .= "{$roleName}\n{$roleDescription}\n\n";
            $uniqueRoles[$uniqueKey] = true;
        }

        $prompt = "<bos><start_of_turn>system\n{$systemPrompt}<end_of_turn>\n";
        $lastIndex = count($messages) - 1;

        foreach ($messages as $i => $message) {
            if ($message['role'] === 'system') {
                continue;
            }
            $prompt .= "<start_of_turn>{$message['role']}\n{$message['content']}";
            if ($i !== $lastIndex) {
                $prompt .= "<end_of_turn>\n";
            }
        }
        return $prompt;
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
}
