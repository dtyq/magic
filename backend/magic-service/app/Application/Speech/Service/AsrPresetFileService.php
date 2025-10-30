<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 预设文件服务
 * 负责创建预设笔记和流式识别文件，供前端写入内容.
 */
readonly class AsrPresetFileService
{
    private LoggerInterface $logger;

    public function __construct(
        private ProjectDomainService $projectDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private TranslatorInterface $translator,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrPresetFileService');
    }

    /**
     * 创建预设笔记和流式识别文件.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param int $projectId 项目ID
     * @param string $displayDir 显示目录相对路径 (如: 录音总结_xxx)
     * @param int $displayDirId 显示目录ID
     * @param string $hiddenDir 隐藏目录相对路径 (如: .asr_recordings/session_xxx)
     * @param int $hiddenDirId 隐藏目录ID
     * @param string $taskKey 任务键
     * @return array{note_file: TaskFileEntity, transcript_file: TaskFileEntity}
     */
    public function createPresetFiles(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $displayDir,
        int $displayDirId,
        string $hiddenDir,
        int $hiddenDirId,
        string $taskKey
    ): array {
        // 获取项目信息
        $projectEntity = $this->projectDomainService->getProject($projectId, $userId);
        $workDir = $projectEntity->getWorkDir();

        // 获取组织码+APP_ID+bucket_md5前缀
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

        // 创建笔记文件（放在显示目录，用户可见）
        $noteFile = $this->createNoteFile(
            $userId,
            $organizationCode,
            $projectId,
            $displayDir,
            $displayDirId,
            $taskKey,
            $fullPrefix,
            $workDir
        );

        // 创建流式识别文件（放在隐藏目录，用户不可见）
        $transcriptFile = $this->createTranscriptFile(
            $userId,
            $organizationCode,
            $projectId,
            $hiddenDir,
            $hiddenDirId,
            $taskKey,
            $fullPrefix,
            $workDir
        );

        $this->logger->info('创建预设文件成功', [
            'task_key' => $taskKey,
            'note_file_id' => $noteFile->getFileId(),
            'transcript_file_id' => $transcriptFile->getFileId(),
        ]);

        return [
            'note_file' => $noteFile,
            'transcript_file' => $transcriptFile,
        ];
    }

    /**
     * 删除流式识别文件（总结完成后清理）.
     *
     * @param string $fileId 文件ID
     * @return bool 是否删除成功
     */
    public function deleteTranscriptFile(string $fileId): bool
    {
        try {
            $fileEntity = $this->taskFileDomainService->getById((int) $fileId);
            if ($fileEntity === null) {
                $this->logger->warning('流式识别文件不存在', ['file_id' => $fileId]);
                return false;
            }

            $this->taskFileDomainService->deleteById($fileEntity->getFileId());

            $this->logger->info('删除流式识别文件成功', [
                'file_id' => $fileId,
                'file_name' => $fileEntity->getFileName(),
            ]);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('删除流式识别文件失败', [
                'file_id' => $fileId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 创建笔记文件（放在显示目录）.
     */
    private function createNoteFile(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $displayDir,
        int $displayDirId,
        string $taskKey,
        string $fullPrefix,
        string $workDir
    ): TaskFileEntity {
        $fileName = $this->translator->trans('asr.file_names.preset_note') . '.md';
        $relativePath = rtrim($displayDir, '/') . '/' . $fileName;

        return $this->createPresetFile(
            userId: $userId,
            organizationCode: $organizationCode,
            projectId: $projectId,
            parentId: $displayDirId,
            fileName: $fileName,
            relativePath: $relativePath,
            fileType: 'note',
            isHidden: false,
            taskKey: $taskKey,
            fullPrefix: $fullPrefix,
            workDir: $workDir,
            logPrefix: '预设笔记文件'
        );
    }

    /**
     * 创建流式识别文件（放在隐藏目录）.
     */
    private function createTranscriptFile(
        string $userId,
        string $organizationCode,
        int $projectId,
        string $hiddenDir,
        int $hiddenDirId,
        string $taskKey,
        string $fullPrefix,
        string $workDir
    ): TaskFileEntity {
        $fileName = $this->translator->trans('asr.file_names.preset_transcript') . '.md';
        $relativePath = rtrim($hiddenDir, '/') . '/' . $fileName;

        return $this->createPresetFile(
            userId: $userId,
            organizationCode: $organizationCode,
            projectId: $projectId,
            parentId: $hiddenDirId,
            fileName: $fileName,
            relativePath: $relativePath,
            fileType: 'transcript',
            isHidden: true,
            taskKey: $taskKey,
            fullPrefix: $fullPrefix,
            workDir: $workDir,
            logPrefix: '预设流式识别文件'
        );
    }

    /**
     * 创建预设文件的通用方法.
     */
    private function createPresetFile(
        string $userId,
        string $organizationCode,
        int $projectId,
        int $parentId,
        string $fileName,
        string $relativePath,
        string $fileType,
        bool $isHidden,
        string $taskKey,
        string $fullPrefix,
        string $workDir,
        string $logPrefix
    ): TaskFileEntity {
        // 完整 file_key
        $fileKey = AsrAssembler::buildFileKey($fullPrefix, $workDir, $relativePath);

        // 元数据
        $metadata = [
            'asr_preset_file' => true,
            'file_type' => $fileType,
            'task_key' => $taskKey,
            'created_by' => 'asr_preset_file_service',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        $taskFileEntity = new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'user_upload',
            'file_name' => $fileName,
            'file_extension' => 'md',
            'file_key' => $fileKey,
            'file_size' => 0, // 初始为0，前端写入后会更新
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => $isHidden,
            'is_directory' => false,
            'sort' => 0,
            'parent_id' => $parentId,
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode($metadata),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
        if ($result !== null) {
            return $result;
        }

        // 如果插入被忽略（文件已存在），查询现有记录
        $existingFile = $this->taskFileDomainService->getByProjectIdAndFileKey($projectId, $fileKey);
        if ($existingFile !== null) {
            $this->logger->info(sprintf('%s已存在，使用现有记录', $logPrefix), [
                'task_key' => $taskKey,
                'file_id' => $existingFile->getFileId(),
            ]);
            return $existingFile;
        }

        ExceptionBuilder::throw(AsrErrorCode::CreatePresetFileFailed);
    }
}
