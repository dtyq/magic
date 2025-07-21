<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Repository\Facade\MagicChatFileRepositoryInterface;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\Speech\Entity\Dto\FlashSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechAudioDTO;
use App\Domain\Speech\Entity\Dto\SpeechUserDTO;
use App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\VolcengineStandardClient;
use Hyperf\Context\ApplicationContext;
use Throwable;

class VoiceMessage extends FileMessage implements TextContentInterface
{
    /**
     * Speech to text result.
     */
    protected ?string $transcriptionText = null;

    /**
     * Voice duration (seconds).
     */
    protected ?int $duration = null;

    /**
     * Transcription timestamp.
     */
    protected ?int $transcribedAt = null;

    /**
     * Transcription error message.
     */
    protected ?string $transcriptionError = null;

    /**
     * Message ID (used for updating message content).
     */
    protected ?string $magicMessageId = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        // Initialize transcription related fields
        if (isset($data['transcription_text'])) {
            $this->transcriptionText = $data['transcription_text'];
        }
        if (isset($data['transcribed_at'])) {
            $this->transcribedAt = $data['transcribed_at'];
        }
        if (isset($data['transcription_error'])) {
            $this->transcriptionError = $data['transcription_error'];
        }
        if (isset($data['duration'])) {
            $this->duration = $data['duration'];
        }
        if (isset($data['magic_message_id'])) {
            $this->magicMessageId = $data['magic_message_id'];
        }
    }

    /**
     * Get transcription text.
     */
    public function getTranscriptionText(): ?string
    {
        return $this->transcriptionText;
    }

    /**
     * Set transcription text.
     */
    public function setTranscriptionText(?string $text): self
    {
        $this->transcriptionText = $text;
        $this->transcribedAt = $text ? time() : null;
        $this->transcriptionError = null; // Clear error message
        return $this;
    }

    /**
     * Check if transcription result exists.
     */
    public function hasTranscription(): bool
    {
        return ! empty($this->transcriptionText);
    }

    /**
     * Get transcription error message.
     */
    public function getTranscriptionError(): ?string
    {
        return $this->transcriptionError;
    }

    /**
     * Set transcription error message.
     */
    public function setTranscriptionError(?string $error): self
    {
        $this->transcriptionError = $error;
        return $this;
    }

    /**
     * Get transcription timestamp.
     */
    public function getTranscribedAt(): ?int
    {
        return $this->transcribedAt;
    }

    /**
     * Get voice duration.
     */
    public function getDuration(): ?int
    {
        return $this->duration;
    }

    /**
     * Set voice duration.
     */
    public function setDuration(?int $duration): self
    {
        $this->duration = $duration;
        return $this;
    }

    /**
     * Get message ID.
     */
    public function getMagicMessageId(): ?string
    {
        return $this->magicMessageId;
    }

    /**
     * Set message ID.
     */
    public function setMagicMessageId(?string $magicMessageId): self
    {
        $this->magicMessageId = $magicMessageId;
        return $this;
    }

    /**
     * Get text content of voice message
     * If no transcription content, call speech recognition service to get it.
     */
    public function getTextContent(): string
    {
        // First check if transcription content already exists
        if ($this->hasTranscription()) {
            return $this->getTranscriptionText() ?? '';
        }

        // If no transcription content, try to call speech recognition service
        try {
            $transcriptionText = $this->performSpeechRecognition();
            // Save recognition result to transcription object (can be empty)
            $this->setTranscriptionText($transcriptionText);
            return $transcriptionText ?: '[Voice Message]';
        } catch (Throwable $e) {
            // Log error but don't throw exception, return fallback text
            $this->setTranscriptionError('Speech recognition failed: ' . $e->getMessage());
        }

        // If speech recognition fails, return fallback text
        return '[Voice Message]';
    }

    /**
     * Get transcription related data.
     */
    public function getTranscriptionData(): array
    {
        return [
            'transcription_text' => $this->transcriptionText,
            'transcribed_at' => $this->transcribedAt,
            'transcription_error' => $this->transcriptionError,
            'duration' => $this->duration,
            'has_transcription' => $this->hasTranscription(),
        ];
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::Voice;
    }

    /**
     * Perform speech recognition.
     */
    private function performSpeechRecognition(): string
    {
        $fileUrl = $this->getVoiceFileUrl();
        if (empty($fileUrl)) {
            return '';
        }
        $container = ApplicationContext::getContainer();
        $speechClient = $container->get(VolcengineStandardClient::class);

        // 构建Flash语音识别请求
        $submitDTO = new FlashSpeechSubmitDTO();

        // 设置音频信息
        $audioDTO = new SpeechAudioDTO([
            'url' => $fileUrl,
        ]);

        // 设置用户信息
        $userDTO = new SpeechUserDTO([
            'uid' => config('asr.volcengine.app_id'),
        ]);

        $submitDTO->setAudio($audioDTO);
        $submitDTO->setUser($userDTO);
        $submitDTO->setRequest(['model_name' => 'bigmodel']);

        // 调用Flash语音识别并获取响应
        $flashResponse = $speechClient->submitFlashTask($submitDTO);

        // If response contains audio duration info, set it to current object (convert to seconds)
        $audioDuration = $flashResponse->getAudioDuration();
        if ($audioDuration !== null) {
            $this->setDuration((int) ceil($audioDuration / 1000)); // Convert milliseconds to seconds, round up
        }

        // 提取并返回文本内容
        return $flashResponse->extractTextContent();
    }

    /**
     * Get voice file URL.
     */
    private function getVoiceFileUrl(): string
    {
        $fileId = $this->getFileId();
        if (empty($fileId)) {
            return '';
        }

        try {
            $container = ApplicationContext::getContainer();
            $chatFileRepository = $container->get(MagicChatFileRepositoryInterface::class);
            $cloudFileRepository = $container->get(CloudFileRepositoryInterface::class);

            // 获取文件实体
            $fileEntities = $chatFileRepository->getChatFileByIds([$fileId]);
            if (empty($fileEntities)) {
                return '';
            }

            $fileEntity = $fileEntities[0];

            // 如果有外链URL，直接使用
            if (! empty($fileEntity->getExternalUrl())) {
                return $fileEntity->getExternalUrl();
            }

            // 通过CloudFile Repository获取URL
            if (! empty($fileEntity->getFileKey()) && ! empty($fileEntity->getOrganizationCode())) {
                $fileLinks = $cloudFileRepository->getLinks(
                    $fileEntity->getOrganizationCode(),
                    [$fileEntity->getFileKey()]
                );

                if (! empty($fileLinks)) {
                    return array_values($fileLinks)[0]->getUrl();
                }
            }

            return '';
        } catch (Throwable) {
            return '';
        }
    }
}
