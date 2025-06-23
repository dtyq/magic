<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\SpeechToTextDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Asr\AsrFacade;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class SpeechToTextAppService
{
    protected LoggerInterface $logger;

    public function __construct()
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class);
    }

    /**
     * Execute speech to text conversion.
     */
    public function convertSpeechToText(SpeechToTextDTO $dto): array
    {
        $audioUrl = $dto->getAudioUrl();

        $this->logger->info('Starting speech to text conversion', [
            'audio_url' => $audioUrl,
        ]);

        try {
            $asrResult = AsrFacade::recognizeVoice($audioUrl);
            $formattedResult = $this->formatAsrResult($asrResult);

            $this->logger->info('Speech to text conversion completed', [
                'text_length' => strlen($formattedResult['text']),
            ]);

            return $formattedResult;
        } catch (Throwable $e) {
            $this->logger->error('Speech to text conversion failed', [
                'error' => $e->getMessage(),
                'audio_url' => $audioUrl,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::RecognitionError, '', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Format ASR result.
     */
    private function formatAsrResult(array $asrResult): array
    {
        if (isset($asrResult['content']) && is_array($asrResult['content'])) {
            return [
                'text' => $this->extractFullText($asrResult['content']),
            ];
        }

        return [
            'text' => $asrResult['text'] ?? '',
        ];
    }

    /**
     * Extract full text from content array.
     */
    private function extractFullText(array $content): string
    {
        $texts = [];
        foreach ($content as $item) {
            if (isset($item['text']) && ! empty($item['text'])) {
                $texts[] = $item['text'];
            }
        }
        return implode('', $texts);
    }
}
