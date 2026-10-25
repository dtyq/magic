<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\VideoGeneration;

use App\Application\Design\Tool\DesignFileNameSanitizer;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Support\retry;

/**
 * Output file name (without extension) for generated videos.
 *
 * Prefers the intelligent naming agent; returns an empty string on failure so the
 * caller falls back to the default timestamp-based naming.
 */
class DesignGeneratedVideoFileNameTool
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * @param string $prompt the video generation prompt
     * @return string file name without extension; empty string on failure, so the caller
     *                falls back to the default `video_<timestamp>` naming
     */
    public function resolveBaseNameWithoutExtension(
        DesignDataIsolation $dataIsolation,
        DesignGenerationTaskEntity $entity,
        string $prompt,
    ): string {
        $prompt = DesignFileNameSanitizer::sanitizePrompt($prompt);
        if ($prompt === '') {
            return '';
        }

        if (mb_strlen($prompt) < 10) {
            $fileName = $this->sanitizeFileName($prompt);
            if ($fileName === '') {
                return '';
            }
            return $fileName . '_' . $this->uniqueSuffix($entity);
        }

        try {
            $basePath = defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__, 5);
            $agentFilePath = $basePath . '/app/Application/Design/MicroAgent/VideoFileNameGenerator.agent.yaml';
            $nameGeneratorAgent = $this->microAgentFactory->getAgent('VideoFileNameGenerator', $agentFilePath);

            if (! $nameGeneratorAgent->isEnabled()) {
                $this->logger->warning('VideoFileNameGenerator agent is disabled, fallback to default video file name', [
                    'generation_id' => $entity->getGenerationId(),
                ]);
                return '';
            }

            $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($dataIsolation);

            $fileName = '';
            retry(1, function () use (&$fileName, $nameGeneratorAgent, $modelGatewayDataIsolation, $prompt, $dataIsolation): void {
                $response = $nameGeneratorAgent->easyCall(
                    dataIsolation: $modelGatewayDataIsolation,
                    userPrompt: "请为以下视频生成提示词生成一个简洁的文件名：{$prompt}",
                    businessParams: [
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => SourceId::DESIGN_VIDEO_FILE_NAME_GENERATION,
                    ]
                );

                $fileName = trim($response->getFirstChoice()?->getMessage()?->getContent() ?? '');
            }, 1000);

            if ($fileName === '') {
                $this->logger->warning('VideoFileNameGenerator returned empty result, fallback to default video file name', [
                    'generation_id' => $entity->getGenerationId(),
                    'prompt' => $prompt,
                ]);
                return '';
            }

            $fileName = $this->sanitizeFileName($fileName);
            if ($fileName === '') {
                return '';
            }

            return $fileName . '_' . $this->uniqueSuffix($entity);
        } catch (Throwable $throwable) {
            $this->logger->warning('Failed to generate intelligent video file name, fallback to default video file name', [
                'generation_id' => $entity->getGenerationId(),
                'prompt' => $prompt,
                'error' => $throwable->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * Strip characters that are not allowed in a file name.
     */
    public function sanitizeFileName(string $fileName): string
    {
        return DesignFileNameSanitizer::sanitize($fileName);
    }

    /**
     * Wrap the DataIsolation conversion so unit tests can bypass the container.
     */
    protected function createModelGatewayDataIsolation(DesignDataIsolation $dataIsolation): ModelGatewayDataIsolation
    {
        return ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
    }

    /**
     * Unique suffix: creation date + task short ID.
     *
     * Keeps videos generated concurrently on the same day from colliding, and keeps
     * retries idempotent because the suffix no longer depends on the archive time.
     */
    private function uniqueSuffix(DesignGenerationTaskEntity $entity): string
    {
        try {
            $datePart = $entity->getCreatedAt()->format('Ymd');
        } catch (Throwable) {
            // createdAt is a non-nullable typed property: it is only missing on an entity
            // that never went through creation or hydration. Fall back to the current date
            // instead of aborting the naming flow.
            $datePart = date('Ymd');
        }

        return $datePart . '_' . substr(hash('sha256', $entity->getGenerationId()), 0, 12);
    }
}
