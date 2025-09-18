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

        $fullFilePath = $dto->taskStatus->filePath;
        $fileName = basename($fullFilePath); // 从完整路径中提取文件名

        // 提取工作区下的相对路径
        $workspaceRelativePath = $this->extractWorkspaceRelativePath($fullFilePath);
        // 构建消息内容
        $messageContent = $this->buildMessageContent($fileId, $fileName, $workspaceRelativePath, $dto->modelId, $dto->taskStatus->hasNoteFile);

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
                    'topic_id' => $dto->chatTopicId,
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
     * @param bool $hasNoteFile 是否存在note文件
     * @return array 消息内容数组
     */
    public function buildMessageContent(string $fileId, string $fileName, string $filePath, string $modelId, bool $hasNoteFile = false): array
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
                                'type' => 'text',
                                'text' => $hasNoteFile
                                    ? $this->translator->trans('asr.messages.summary_prefix_with_note')
                                    : $this->translator->trans('asr.messages.summary_prefix'),
                            ],
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
                                'text' => $hasNoteFile
                                    ? $this->translator->trans('asr.messages.summary_suffix_with_note')
                                    : $this->translator->trans('asr.messages.summary_suffix'),
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
                    'topic_pattern' => 'summary',
                    'model' => [
                        'model_id' => $modelId,
                    ],
                ],
            ],
        ];
    }

    /**
     * 提取工作区下的相对路径.
     *
     * 从完整路径中提取相对于workspace/的相对路径
     * 例如：DT001/588417216353927169/project_821749697183776769/workspace/录音总结_20250908_153820/原始录音文件.webm
     * 返回：录音总结_20250908_153820/原始录音文件.webm
     *
     * 如果传入的已经是相对路径，直接返回原始路径
     *
     * @param string $fullPath 完整文件路径或相对路径
     * @return string 工作区相对路径或原始路径
     */
    public function extractWorkspaceRelativePath(string $fullPath): string
    {
        // 标准化路径分隔符
        $normalizedPath = str_replace('\\', '/', trim($fullPath, '/'));

        // 查找 workspace/ 的位置
        $workspacePos = strpos($normalizedPath, '/workspace/');
        if ($workspacePos !== false) {
            // 提取 workspace/ 后面的部分
            $relativePath = substr($normalizedPath, $workspacePos + 11); // 11 = strlen('/workspace/')

            // 如果相对路径不为空，返回相对路径
            if (! empty($relativePath)) {
                return $relativePath;
            }
        }

        // 如果没有找到 /workspace/，尝试查找 workspace/ 开头的情况
        if (str_starts_with($normalizedPath, 'workspace/')) {
            $relativePath = substr($normalizedPath, 10); // 移除 'workspace/' 前缀
            if (! empty($relativePath)) {
                return $relativePath;
            }
        }

        // 如果都没找到workspace标识，直接返回原始路径（可能已经是相对路径）
        return $normalizedPath;
    }
}
