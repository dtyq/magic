<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Speech\Assembler\AsrPromptAssembler;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\DTO\NoteDTO;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Contract\TranslatorInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 标题生成服务
 * 负责根据不同场景生成录音总结标题.
 */
readonly class AsrTitleGeneratorService
{
    public function __construct(
        private MagicChatMessageAppService $magicChatMessageAppService,
        private TaskFileDomainService $taskFileDomainService,
        private MagicUserDomainService $magicUserDomainService,
        private TranslatorInterface $translator,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 根据不同场景生成标题.
     *
     * 场景一：有 asr_stream_content（前端实时录音），直接用内容生成标题
     * 场景二：有 file_id（上传已有文件），构建提示词生成标题
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权
     * @param string $asrStreamContent ASR流式识别内容
     * @param null|string $fileId 文件ID
     * @param null|NoteDTO $note 笔记内容
     * @param string $taskKey 任务键（用于日志）
     * @return null|string 生成的标题
     */
    public function generateTitleForScenario(
        MagicUserAuthorization $userAuthorization,
        string $asrStreamContent,
        ?string $fileId,
        ?NoteDTO $note,
        string $taskKey
    ): ?string {
        try {
            $language = $this->translator->getLocale() ?: 'zh_CN';

            // 场景一：有 asr_stream_content（前端实时录音）
            if (! empty($asrStreamContent)) {
                $customPrompt = AsrPromptAssembler::getTitlePrompt($asrStreamContent, $note, $language);
                $title = $this->magicChatMessageAppService->summarizeTextWithCustomPrompt(
                    $userAuthorization,
                    $customPrompt
                );
                return $this->sanitizeTitle($title);
            }

            // 场景二：有 file_id（上传已有文件）
            if (! empty($fileId)) {
                $fileEntity = $this->taskFileDomainService->getById((int) $fileId);
                if ($fileEntity === null) {
                    $this->logger->warning('生成标题时未找到文件', [
                        'file_id' => $fileId,
                        'task_key' => $taskKey,
                    ]);
                    return null;
                }

                // 获取音频文件名称
                $audioFileName = $fileEntity->getFileName();

                // 构建笔记文件名（如果有）
                $noteFileName = null;
                if ($note !== null && $note->hasContent()) {
                    $noteFileName = $note->generateFileName();
                }

                // 构建用户请求消息（模拟用户聊天消息）
                $userRequestMessage = $this->buildUserRequestMessage($audioFileName, $noteFileName);

                // 使用 AsrPromptAssembler 构建提示词
                $customPrompt = AsrPromptAssembler::getTitlePromptForUploadedFile(
                    $userRequestMessage,
                    $language
                );
                $title = $this->magicChatMessageAppService->summarizeTextWithCustomPrompt(
                    $userAuthorization,
                    $customPrompt
                );
                return $this->sanitizeTitle($title);
            }

            return null;
        } catch (Throwable $e) {
            $this->logger->warning('生成标题失败', [
                'task_key' => $taskKey,
                'has_asr_content' => ! empty($asrStreamContent),
                'has_file_id' => ! empty($fileId),
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 从任务状态生成标题（使用保存的 ASR 内容和笔记内容）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @return string 生成的标题（失败时返回默认标题）
     */
    public function generateFromTaskStatus(AsrTaskStatusDTO $taskStatus): string
    {
        try {
            // 使用上报时保存的语种，如果没有则使用当前语种
            $language = $taskStatus->language ?: $this->translator->getLocale() ?: 'zh_CN';

            $this->logger->info('使用语种生成标题', [
                'task_key' => $taskStatus->taskKey,
                'language' => $language,
                'has_asr_content' => ! empty($taskStatus->asrStreamContent),
                'has_note' => ! empty($taskStatus->noteContent),
            ]);

            // 如果有 ASR 流式内容，使用它生成标题
            if (! empty($taskStatus->asrStreamContent)) {
                // 构建笔记 DTO（如果有）
                $note = null;
                if (! empty($taskStatus->noteContent)) {
                    $note = new NoteDTO(
                        $taskStatus->noteContent,
                        $taskStatus->noteFileType ?? 'md'
                    );
                }

                // 获取完整的录音总结提示词
                $customPrompt = AsrPromptAssembler::getTitlePrompt(
                    $taskStatus->asrStreamContent,
                    $note,
                    $language
                );

                // 使用自定义提示词生成标题
                $userAuthorization = $this->getUserAuthorizationFromUserId($taskStatus->userId);
                $title = $this->magicChatMessageAppService->summarizeTextWithCustomPrompt(
                    $userAuthorization,
                    $customPrompt
                );

                return $this->sanitizeTitle($title);
            }

            // 如果没有 ASR 内容，返回默认标题
            return $this->generateDefaultDirectoryName();
        } catch (Throwable $e) {
            $this->logger->warning('生成标题失败，使用默认标题', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
            return $this->generateDefaultDirectoryName();
        }
    }

    /**
     * 清洗标题，移除文件/目录不允许的字符并截断长度.
     *
     * @param string $title 原始标题
     * @return string 清洗后的标题
     */
    public function sanitizeTitle(string $title): string
    {
        $title = trim($title);
        if ($title === '') {
            return '';
        }

        // 移除非法字符 \/:*?"<>|
        $title = preg_replace('/[\\\\\/:*?"<>|]/u', '', $title) ?? '';
        // 压缩空白
        $title = preg_replace('/\s+/u', ' ', $title) ?? '';
        // 限制长度，避免过长路径
        if (mb_strlen($title) > 50) {
            $title = mb_substr($title, 0, 50);
        }

        return $title;
    }

    /**
     * 生成默认的目录名称.
     *
     * @param null|string $customTitle 自定义标题
     * @return string 目录名称
     */
    public function generateDefaultDirectoryName(?string $customTitle = null): string
    {
        $base = $customTitle ?: $this->translator->trans('asr.directory.recordings_summary_folder');
        return sprintf('%s_%s', $base, date('Ymd_His'));
    }

    /**
     * 为文件直传场景生成标题（仅根据文件名）.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权
     * @param string $fileName 文件名
     * @param string $taskKey 任务键（用于日志）
     * @return null|string 生成的标题
     */
    public function generateTitleForFileUpload(
        MagicUserAuthorization $userAuthorization,
        string $fileName,
        string $taskKey
    ): ?string {
        try {
            $language = $this->translator->getLocale() ?: 'zh_CN';

            // 构建用户请求消息（模拟用户聊天消息）
            $userRequestMessage = $this->buildUserRequestMessage($fileName, null);

            // 使用 AsrPromptAssembler 构建提示词
            $customPrompt = AsrPromptAssembler::getTitlePromptForUploadedFile(
                $userRequestMessage,
                $language
            );

            $title = $this->magicChatMessageAppService->summarizeTextWithCustomPrompt(
                $userAuthorization,
                $customPrompt
            );

            return $this->sanitizeTitle($title);
        } catch (Throwable $e) {
            $this->logger->warning('为文件直传生成标题失败', [
                'task_key' => $taskKey,
                'file_name' => $fileName,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 构建用户请求消息（模拟用户聊天消息，使用国际化文本）.
     *
     * @param string $audioFileName 音频文件名称
     * @param null|string $noteFileName 笔记文件名称（可选）
     * @return string 格式化后的用户请求
     */
    private function buildUserRequestMessage(string $audioFileName, ?string $noteFileName): string
    {
        if ($noteFileName !== null) {
            // 有笔记的情况："请帮我把 @年会方案讨论.webm 录音内容和 @年会笔记.md 的内容转化为一份超级产物"
            return sprintf(
                '%s@%s%s@%s%s',
                $this->translator->trans('asr.messages.summary_prefix_with_note'),
                $audioFileName,
                $this->translator->trans('asr.messages.summary_middle_with_note'),
                $noteFileName,
                $this->translator->trans('asr.messages.summary_suffix_with_note')
            );
        }

        // 只有音频文件的情况："请帮我把 @年会方案讨论.webm 录音内容转化为一份超级产物"
        return sprintf(
            '%s@%s%s',
            $this->translator->trans('asr.messages.summary_prefix'),
            $audioFileName,
            $this->translator->trans('asr.messages.summary_suffix')
        );
    }

    /**
     * 从用户ID获取用户授权对象.
     *
     * @param string $userId 用户ID
     * @return MagicUserAuthorization 用户授权对象
     */
    private function getUserAuthorizationFromUserId(string $userId): MagicUserAuthorization
    {
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            ExceptionBuilder::throw(AsrErrorCode::UserNotExist);
        }
        return MagicUserAuthorization::fromUserEntity($userEntity);
    }
}
