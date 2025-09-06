<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\LongTermMemory\DTO\EvaluateConversationRequestDTO;
use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\LongTermMemory\Service\LongTermMemoryAppService as MagicServiceLongTermMemoryAppService;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\CheckLongTermMemoryEvent;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 长期记忆检查事件监听器
 * 负责处理长期记忆检查事件的具体逻辑.
 */
class CheckLongTermMemoryEventSubscriber implements ListenerInterface
{
    /**
     * Listen to events.
     *
     * @return array Array of event classes to listen to
     */
    public function listen(): array
    {
        return [
            CheckLongTermMemoryEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
        // Type check
        if (! $event instanceof CheckLongTermMemoryEvent) {
            return;
        }

        try {
            $this->getLogger()->info('开始处理长期记忆检查事件', [
                'event_id' => $event->getEventId(),
                'organization_code' => $event->getOrganizationCode(),
                'user_id' => $event->getUserId(),
                'conversation_id' => $event->getConversationId(),
                'chat_topic_id' => $event->getChatTopicId(),
                'prompt_length' => mb_strlen($event->getPrompt()),
                'has_attachments' => ! empty($event->getAttachments()),
                'instructions_count' => count($event->getInstructions()),
            ]);

            // 直接从事件中获取 conversationId
            $conversationId = $event->getConversationId();
            if (empty($conversationId)) {
                $this->getLogger()->warning('事件中的 conversation_id 为空', [
                    'chat_topic_id' => $event->getChatTopicId(),
                    'event_id' => $event->getEventId(),
                ]);
                return;
            }

            // 构建授权对象
            $authorization = $this->createUserAuthorization($event->getOrganizationCode(), $event->getUserId());

            // 获取历史消息
            $historyMessages = $this->getConversationHistory($authorization, $conversationId, $event->getChatTopicId());
            // 构建完整的对话内容
            $conversationContent = $this->buildConversationContentWithHistory($event, $historyMessages);

            // 通过降级链获取模型名称
            $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain(
                $event->getOrganizationCode(),
                LLMModelEnum::DEEPSEEK_V3->value
            );

            // 创建评估请求DTO
            $dto = new EvaluateConversationRequestDTO([
                'modelName' => $modelName,
                'conversationContent' => $conversationContent,
                'appId' => AppCodeEnum::SUPER_MAGIC->value,
            ]);
            // 调用 magic-service 的长期记忆评估服务
            $this->getLongTermMemoryApp()->evaluateAndCreateMemory($dto, $authorization);
        } catch (Throwable $e) {
            $this->getLogger()->error('处理长期记忆检查事件时发生异常', [
                'event_id' => $event->getEventId(),
                'error' => $e->getMessage(),
                'organization_code' => $event->getOrganizationCode(),
                'user_id' => $event->getUserId(),
                'conversation_id' => $event->getConversationId(),
                'chat_topic_id' => $event->getChatTopicId(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 获取长期记忆应用服务
     */
    private function getLongTermMemoryApp(): MagicServiceLongTermMemoryAppService
    {
        return \Hyperf\Support\make(MagicServiceLongTermMemoryAppService::class);
    }

    /**
     * 获取聊天消息应用服务
     */
    private function getMagicChatMessageApp(): MagicChatMessageAppService
    {
        return \Hyperf\Support\make(MagicChatMessageAppService::class);
    }

    /**
     * 获取日志器.
     */
    private function getLogger(): LoggerInterface
    {
        return \Hyperf\Support\make(LoggerFactory::class)->get(static::class);
    }

    /**
     * 创建用户授权对象
     */
    private function createUserAuthorization(string $organizationCode, string $userId): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId($userId);
        $authorization->setOrganizationCode($organizationCode);
        $authorization->setApplicationCode(AppCodeEnum::SUPER_MAGIC->value);
        return $authorization;
    }

    /**
     * 获取会话历史消息.
     */
    private function getConversationHistory(MagicUserAuthorization $authorization, string $conversationId, string $topicId): array
    {
        try {
            return $this->getMagicChatMessageApp()->getConversationChatCompletionsHistory(
                $authorization,
                $conversationId,
                50, // 获取最近50条消息
                $topicId,
                false // 使用传统的 role 格式（user/assistant）而不是用户昵称
            );
        } catch (Throwable $e) {
            $this->getLogger()->error('获取会话历史消息失败', [
                'conversation_id' => $conversationId,
                'topic_id' => $topicId,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * 构建包含历史消息的对话内容.
     */
    private function buildConversationContentWithHistory(CheckLongTermMemoryEvent $event, array $historyMessages): string
    {
        $content = [];
        // 添加历史消息
        if (! empty($historyMessages)) {
            $content[] = '=== 历史对话 ===';
            foreach ($historyMessages as $message) {
                if (is_array($message) && isset($message['role'], $message['content'])) {
                    $content[] = $message['role'] . ': ' . $message['content'];
                }
            }
            $content[] = "=== 历史对话结束 ===\n";
        }
        // 添加当前用户消息
        $content[] = '=== 当前消息 ===';
        $content[] = "用户消息: {$event->getPrompt()}";

        // 添加提及信息（如果有）
        if (! empty($event->getMentions())) {
            $mentionsData = json_decode($event->getMentions(), true);
            if (is_array($mentionsData) && ! empty($mentionsData)) {
                $content[] = '提及: ' . json_encode($mentionsData, JSON_UNESCAPED_UNICODE);
            }
        }
        return implode("\n", $content);
    }
}
