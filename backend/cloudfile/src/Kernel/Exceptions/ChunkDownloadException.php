<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Exceptions;

use Throwable;

/**
 * Chunk download exception class.
 */
class ChunkDownloadException extends CloudFileException
{
    /**
     * Download ID.
     */
    private string $downloadId = '';

    /**
     * Part number.
     */
    private int $partNumber = 0;

    /**
     * Remote file path.
     */
    private string $remoteFilePath = '';

    public function __construct(
        string $message = '',
        int $code = 0,
        ?Throwable $previous = null,
        string $downloadId = '',
        int $partNumber = 0,
        string $remoteFilePath = ''
    ) {
        parent::__construct($message, $code, $previous);
        $this->downloadId = $downloadId;
        $this->partNumber = $partNumber;
        $this->remoteFilePath = $remoteFilePath;
    }

    public function getDownloadId(): string
    {
        return $this->downloadId;
    }

    public function getPartNumber(): int
    {
        return $this->partNumber;
    }

    public function getRemoteFilePath(): string
    {
        return $this->remoteFilePath;
    }

    /**
     * Create get file info failed exception.
     */
    public static function createGetFileInfoFailed(string $message, string $remoteFilePath, ?Throwable $previous = null): self
    {
        return new self("Get file info failed: {$message}", 2001, $previous, '', 0, $remoteFilePath);
    }

    /**
     * Create part download failed exception.
     */
    public static function createPartDownloadFailed(string $message, string $downloadId, int $partNumber, string $remoteFilePath, ?Throwable $previous = null): self
    {
        return new self("Download part {$partNumber} failed: {$message}", 2002, $previous, $downloadId, $partNumber, $remoteFilePath);
    }

    /**
     * Create merge failed exception.
     */
    public static function createMergeFailed(string $message, string $downloadId, string $remoteFilePath, ?Throwable $previous = null): self
    {
        return new self("Merge chunks failed: {$message}", 2003, $previous, $downloadId, 0, $remoteFilePath);
    }

    /**
     * Create verification failed exception.
     */
    public static function createVerificationFailed(string $message, string $downloadId, string $remoteFilePath, ?Throwable $previous = null): self
    {
        return new self("File verification failed: {$message}", 2004, $previous, $downloadId, 0, $remoteFilePath);
    }

    /**
     * Create invalid chunk size exception.
     */
    public static function createInvalidChunkSize(int $chunkSize): self
    {
        return new self("Invalid download chunk size: {$chunkSize}. Must be between 1MB and 100MB", 2005);
    }

    /**
     * Create too many chunks exception.
     */
    public static function createTooManyChunks(int $chunkCount): self
    {
        return new self("Too many download chunks: {$chunkCount}. Maximum allowed is 10000", 2006);
    }

    /**
     * Create retry exhausted exception.
     */
    public static function createRetryExhausted(string $downloadId, int $partNumber, int $maxRetries, string $remoteFilePath): self
    {
        return new self("Retry exhausted for part {$partNumber} after {$maxRetries} attempts", 2007, null, $downloadId, $partNumber, $remoteFilePath);
    }

    /**
     * Create timeout exception.
     */
    public static function createTimeout(string $downloadId, int $partNumber = 0, string $remoteFilePath = ''): self
    {
        $message = $partNumber > 0 ? "Download part {$partNumber} timeout" : 'Download timeout';
        return new self($message, 2008, null, $downloadId, $partNumber, $remoteFilePath);
    }

    /**
     * Create temp file operation failed exception.
     */
    public static function createTempFileOperationFailed(string $message, string $downloadId, ?Throwable $previous = null): self
    {
        return new self("Temp file operation failed: {$message}", 2009, $previous, $downloadId);
    }

    /**
     * Create resume failed exception.
     */
    public static function createResumeFailed(string $message, string $downloadId, string $remoteFilePath, ?Throwable $previous = null): self
    {
        return new self("Resume download failed: {$message}", 2010, $previous, $downloadId, 0, $remoteFilePath);
    }

    /**
     * Create file not found exception.
     */
    public static function createFileNotFound(string $remoteFilePath): self
    {
        return new self("Remote file not found: {$remoteFilePath}", 2011, null, '', 0, $remoteFilePath);
    }

    /**
     * Create insufficient disk space exception.
     */
    public static function createInsufficientDiskSpace(string $localPath, int $requiredBytes): self
    {
        $requiredMB = round($requiredBytes / 1024 / 1024, 2);
        return new self("Insufficient disk space at {$localPath}. Required: {$requiredMB}MB", 2012);
    }
}
