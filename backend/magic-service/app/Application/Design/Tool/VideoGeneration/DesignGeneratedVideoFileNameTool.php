<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\VideoGeneration;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 视频生成结果文件名（不含扩展名）：优先走智能命名，失败时返回空串，由现有默认命名逻辑兜底。
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
     * @param string $prompt 视频生成提示词
     * @return string 不含扩展名，失败时返回空串，交由默认 video_时间戳 命名逻辑处理
     */
    public function resolveBaseNameWithoutExtension(
        DesignDataIsolation $dataIsolation,
        DesignGenerationTaskEntity $entity,
        string $prompt,
    ): string {
        $prompt = trim($prompt);
        if ($prompt === '') {
            return '';
        }

        if (mb_strlen($prompt) < 10) {
            $fileName = $this->sanitizeFileName($prompt);
            if ($fileName === '') {
                return '';
            }
            return $fileName . '_' . date('YmdHis');
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
                        'source_id' => 'design_video_file_name_generation',
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

            return $fileName . '_' . date('YmdHis');
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
     * 清理文件名，移除不合法字符。
     */
    public function sanitizeFileName(string $fileName): string
    {
        $fileName = preg_replace('/[`\'\"]+/', '', $fileName) ?? '';
        $fileName = preg_replace('/[\/\\\:*?"<>|]+/', '_', $fileName) ?? '';
        $fileName = trim($fileName);
        if (mb_strlen($fileName) > 30) {
            $fileName = mb_substr($fileName, 0, 30);
        }

        return $fileName;
    }

    /**
     * 单独封装 DataIsolation 转换，方便单测绕开容器依赖。
     */
    protected function createModelGatewayDataIsolation(DesignDataIsolation $dataIsolation): ModelGatewayDataIsolation
    {
        return ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
    }
}
