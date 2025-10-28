<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Assembler;

use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\DTO\Response\AsrFileDataDTO;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;

/**
 * 聊天消息装配器
 * 负责构建ASR总结相关的聊天消息.
 */
readonly class ChatMessageAssembler
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * 构建聊天请求对象用于总结任务
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @param AsrFileDataDTO $audioFileData 音频文件数据
     * @param null|AsrFileDataDTO $noteFileData 笔记文件数据，可选
     * @return ChatRequest 聊天请求对象
     */
    public function buildSummaryMessage(ProcessSummaryTaskDTO $dto, AsrFileDataDTO $audioFileData, ?AsrFileDataDTO $noteFileData = null): ChatRequest
    {
        // 构建消息内容
        $messageContent = $this->buildMessageContent($dto->modelId, $audioFileData, $noteFileData);

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
     * @param string $modelId 模型ID
     * @param AsrFileDataDTO $fileData 文件数据
     * @param null|AsrFileDataDTO $noteData 笔记文件数据，可选
     * @return array 消息内容数组
     */
    public function buildMessageContent(string $modelId, AsrFileDataDTO $fileData, ?AsrFileDataDTO $noteData = null): array
    {
        // 构建消息内容
        if ($noteData !== null && ! empty($noteData->fileName) && ! empty($noteData->filePath)) {
            // 有笔记时的消息内容：同时提到录音文件和笔记文件

            $messageContent = [
                [
                    'type' => 'text',
                    'text' => $this->translator->trans('asr.messages.summary_prefix_with_note'),
                ],
                [
                    'type' => 'mention',
                    'attrs' => [
                        'id' => null,
                        'label' => null,
                        'mentionSuggestionChar' => '@',
                        'type' => 'project_file',
                        'data' => $fileData->toArray(),
                    ],
                ],
                [
                    'type' => 'text',
                    'text' => $this->translator->trans('asr.messages.summary_middle_with_note'),
                ],
                [
                    'type' => 'mention',
                    'attrs' => [
                        'id' => null,
                        'label' => null,
                        'mentionSuggestionChar' => '@',
                        'type' => 'project_file',
                        'data' => $noteData->toArray(),
                    ],
                ],
                [
                    'type' => 'text',
                    'text' => $this->translator->trans('asr.messages.summary_suffix_with_note'),
                ],
            ];
        } else {
            // 无笔记时的消息内容：只提到录音文件
            $messageContent = [
                [
                    'type' => 'text',
                    'text' => $this->translator->trans('asr.messages.summary_prefix'),
                ],
                [
                    'type' => 'mention',
                    'attrs' => [
                        'id' => null,
                        'label' => null,
                        'mentionSuggestionChar' => '@',
                        'type' => 'project_file',
                        'data' => $fileData->toArray(),
                    ],
                ],
                [
                    'type' => 'text',
                    'text' => $this->translator->trans('asr.messages.summary_suffix'),
                ],
            ];
        }

        return [
            'content' => Json::encode([
                'type' => 'doc',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'attrs' => ['suggestion' => ''],
                        'content' => $messageContent,
                    ],
                ],
            ]),
            'instructs' => [
                ['value' => 'plan'],
            ],
            'attachments' => [],
            'extra' => [
                'super_agent' => [
                    'mentions' => $noteData !== null && ! empty($noteData->fileName) && ! empty($noteData->filePath) ? [
                        [
                            'type' => 'mention',
                            'attrs' => [
                                'type' => 'project_file',
                                'data' => $fileData->toArray(),
                            ],
                        ],
                        [
                            'type' => 'mention',
                            'attrs' => [
                                'type' => 'project_file',
                                'data' => $noteData->toArray(),
                            ],
                        ],
                    ] : [
                        [
                            'type' => 'mention',
                            'attrs' => [
                                'type' => 'project_file',
                                'data' => $fileData->toArray(),
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
     * @deprecated 请使用 AsrAssembler::extractWorkspaceRelativePath() 代替
     * @param string $fullPath 完整文件路径或相对路径
     * @return string 工作区相对路径或原始路径
     */
    public function extractWorkspaceRelativePath(string $fullPath): string
    {
        // 向后兼容：委托给 AsrAssembler 处理
        return AsrAssembler::extractWorkspaceRelativePath($fullPath);
    }
}
