<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File;

use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * 统一托管请求生命周期内创建的临时文件，确保异常路径也能完成清理。
 */
class TemporaryFileManager
{
    private const REMOVE_BACKGROUND_TEMP_DIRECTORY = BASE_PATH . '/runtime/images/remove-background';

    private LoggerInterface $logger;

    /**
     * @var array<string, true>
     */
    private array $files = [];

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function add(string $filePath): void
    {
        if ($filePath === '') {
            return;
        }
        $this->files[$filePath] = true;
    }

    /**
     * 清理已注册的临时文件。清理失败只记录日志，不覆盖主流程异常。
     */
    public function cleanup(): void
    {
        foreach (array_keys($this->files) as $filePath) {
            try {
                if (is_file($filePath)) {
                    unlink($filePath);
                }
            } catch (Throwable $throwable) {
                $this->logger->warning('Failed to cleanup temporary file', [
                    'file_path' => $filePath,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }

        $this->files = [];
    }

    /**
     * 为去背景链路创建统一的临时文件，所有中间文件都落在 runtime/images/remove-background 目录下。
     */
    public static function createRemoveBackgroundTempFile(string $prefix): string
    {
        self::ensureDirectoryExists(self::REMOVE_BACKGROUND_TEMP_DIRECTORY);

        $tempFile = tempnam(self::REMOVE_BACKGROUND_TEMP_DIRECTORY, $prefix);
        if (! is_string($tempFile) || $tempFile === '') {
            throw new RuntimeException('Failed to create remove background temporary file');
        }

        return $tempFile;
    }

    private static function ensureDirectoryExists(string $directory): void
    {
        if (is_dir($directory)) {
            return;
        }

        if (! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException(sprintf('Failed to create directory: %s', $directory));
        }
    }
}
