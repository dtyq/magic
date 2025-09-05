<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 聊天消息装配器
 * 负责构建ASR总结相关的聊天消息.
 */
class ChatMessageAssembler
{
    private LoggerInterface $logger;

    public function __construct(
        private TranslatorInterface $translator,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('ChatMessageAssembler');
    }

    /**
     * 构建聊天请求对象用于总结任务
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @return ChatRequest 聊天请求对象
     * @throws BusinessException 当工作区文件键为空时
     */
    public function buildSummaryMessage(ProcessSummaryTaskDTO $dto): ChatRequest
    {
        // 验证工作区文件键
        if (empty($dto->taskStatus->workspaceFileKey)) {
            $this->logger->warning('工作区文件键为空，无法构建聊天消息', [
                'task_key' => $dto->taskStatus->taskKey,
                'user_id' => $dto->userId,
            ]);

            throw new BusinessException('工作区文件键为空，无法构建聊天消息');
        }
        // 生成文件信息
        $fileId = (string) IdGenerator::getSnowId();
        $fileName = $dto->taskStatus->fileName ?: $dto->taskStatus->taskKey;
        $filePath = $dto->taskStatus->taskKey;

        // 构建消息内容
        $messageContent = $this->buildMessageContent($fileId, $fileName, $filePath, $dto->modelId);

        // 构建聊天请求数据
        $chatRequestData = [
            'context' => [
                'language' => $this->translator->getLocale(),
            ],
            'data' => [
                'conversation_id' => $dto->conversationId,
                'message' => [
                    'type' => 'rich_text',
                    'app_message_id' => (string) IdGenerator::getSnowId(),
                    'send_time' => time() * 1000,
                    'topic_id' => $dto->topicId,
                    'rich_text' => $messageContent,
                ],
            ],
        ];
        return new ChatRequest($chatRequestData);
    }

    /**
     * 构建rich_text消息内容.
     *
     * @param string $fileId 文件ID
     * @param string $fileName 文件名
     * @param string $filePath 文件路径
     * @param string $modelId 模型ID
     * @return array 消息内容数组
     */
    private function buildMessageContent(string $fileId, string $fileName, string $filePath, string $modelId): array
    {
        $fileData = [
            'file_id' => $fileId,
            'file_name' => $fileName,
            'file_path' => $filePath,
            'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
            'file_size' => 0,
        ];

        return [
            'content' => json_encode([
                'type' => 'doc',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'attrs' => ['suggestion' => ''],
                        'content' => [
                            [
                                'type' => 'mention',
                                'attrs' => [
                                    'id' => null,
                                    'label' => null,
                                    'mentionSuggestionChar' => '@',
                                    'type' => 'project_file',
                                    'data' => $fileData,
                                ],
                            ],
                            [
                                'type' => 'text',
                                'text' => $this->translator->trans('asr.messages.summary_content'),
                            ],
                        ],
                    ],
                ],
            ]),
            'instructs' => [
                ['value' => 'plan'],
            ],
            'attachments' => [],
            'extra' => [
                'super_agent' => [
                    'mentions' => [
                        [
                            'type' => 'mention',
                            'attrs' => [
                                'type' => 'project_file',
                                'data' => $fileData,
                            ],
                        ],
                    ],
                    'input_mode' => 'plan',
                    'chat_mode' => 'normal',
                    'topic_pattern' => 'general',
                    'model' => [
                        'model_id' => $modelId,
                    ],
                ],
            ],
        ];
    }
}
