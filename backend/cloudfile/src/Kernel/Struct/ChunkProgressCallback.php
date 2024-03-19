<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

/**
 * Chunk upload/download progress callback interface.
 */
interface ChunkProgressCallback
{
    /**
     * Progress callback (compatible for upload and download).
     *
     * @param int $completedChunks Completed chunks count (upload or download)
     * @param int $totalChunks Total chunks count
     * @param int $completedBytes Completed bytes count (upload or download)
     * @param int $totalBytes Total bytes count
     */
    public function onProgress(int $completedChunks, int $totalChunks, int $completedBytes, int $totalBytes): void;

    /**
     * Single chunk starts processing (upload or download).
     *
     * @param int $partNumber Part number
     * @param int $partSize Part size
     */
    public function onChunkStart(int $partNumber, int $partSize): void;

    /**
     * Single chunk processing completed (upload or download).
     *
     * @param int $partNumber Part number
     * @param int $partSize Part size
     * @param string $identifier Identifier (ETag for upload, file path for download)
     */
    public function onChunkComplete(int $partNumber, int $partSize, string $identifier): void;

    /**
     * Single chunk processing failed (upload or download).
     *
     * @param int $partNumber Part number
     * @param int $partSize Part size
     * @param string $error Error message
     * @param int $retryCount Retry count
     */
    public function onChunkError(int $partNumber, int $partSize, string $error, int $retryCount): void;

    /**
     * All chunks processing completed (upload merge or download merge).
     */
    public function onComplete(): void;

    /**
     * Processing failed (upload or download).
     *
     * @param string $error Error message
     */
    public function onError(string $error): void;
}
