<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asr\DTO;

use App\Infrastructure\Core\AbstractDTO;

use function Hyperf\Translation\trans;

/**
 * Download Merged Audio Response DTO for ASR download merged audio file response.
 */
class DownloadMergedAudioResponseDTO extends AbstractDTO
{
    protected bool $success = false;

    protected string $taskKey = '';

    protected ?string $downloadUrl = null;

    protected ?string $fileKey = null;

    protected string $message = '';

    /**
     * @var array<string, string> User information
     */
    protected array $user = [];

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(null|bool|int|string $success): void
    {
        if ($success === null) {
            $this->success = false;
        } else {
            $this->success = (bool) $success;
        }
    }

    public function getTaskKey(): string
    {
        return $this->taskKey;
    }

    public function setTaskKey(?string $taskKey): void
    {
        if ($taskKey === null) {
            $this->taskKey = '';
        } else {
            $this->taskKey = $taskKey;
        }
    }

    public function getDownloadUrl(): ?string
    {
        return $this->downloadUrl;
    }

    public function setDownloadUrl(?string $downloadUrl): void
    {
        $this->downloadUrl = $downloadUrl;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function setFileKey(?string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(?string $message): void
    {
        if ($message === null) {
            $this->message = '';
        } else {
            $this->message = $message;
        }
    }

    /**
     * @return array<string, string>
     */
    public function getUser(): array
    {
        return $this->user;
    }

    /**
     * @param null|array<string, string> $user
     */
    public function setUser(?array $user): void
    {
        if ($user === null) {
            $this->user = [];
        } else {
            $this->user = $user;
        }
    }

    /**
     * Set user information.
     */
    public function setUserInfo(string $userId, string $organizationCode): void
    {
        $this->user = [
            'user_id' => $userId,
            'organization_code' => $organizationCode,
        ];
    }

    /**
     * Create success response.
     */
    public static function createSuccessResponse(
        string $taskKey,
        string $downloadUrl,
        string $fileKey,
        string $userId,
        string $organizationCode,
        ?string $message = null
    ): self {
        if ($message === null) {
            $message = trans('asr.download.success');
        }
        return new self([
            'success' => true,
            'task_key' => $taskKey,
            'download_url' => $downloadUrl,
            'file_key' => $fileKey,
            'message' => $message,
            'user' => [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ],
        ]);
    }

    /**
     * Create failure response.
     */
    public static function createFailureResponse(
        string $taskKey,
        string $userId,
        string $organizationCode,
        string $messageKey,
        ?string $fileKey = null,
        array $replace = []
    ): self {
        $message = trans($messageKey, $replace);
        return new self([
            'success' => false,
            'task_key' => $taskKey,
            'download_url' => null,
            'file_key' => $fileKey,
            'message' => $message,
            'user' => [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ],
        ]);
    }
}
