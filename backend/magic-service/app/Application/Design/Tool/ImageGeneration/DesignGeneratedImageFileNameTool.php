<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 设计侧生图结果文件名（不含扩展名）：按任务类型规则命名或走 Agent 生成。
 */
final class DesignGeneratedImageFileNameTool
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * @param string $prompt 文生图等场景的提示词；专用能力可为空串
     * @return string 不含扩展名，失败时回退为 image_id
     */
    public function resolveBaseNameWithoutExtension(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $prompt,
    ): string {
        $handler = DesignImageGenerationTaskHandlerFactory::get($entity->getType());
        if ($handler !== null) {
            $ruleBased = $handler->resolveRuleBasedOutputBaseName($entity);
            if ($ruleBased !== null && $ruleBased !== '') {
                return $ruleBased;
            }
        }

        if (mb_strlen($prompt) < 10) {
            $fileName = $this->sanitizeFileName($prompt);
            if ($fileName === '') {
                return $entity->getImageId();
            }

            return $fileName . '_' . date('YmdHis');
        }

        try {
            $agentFilePath = BASE_PATH . '/app/Application/Design/MicroAgent/ImageFileNameGenerator.agent.yaml';
            $nameGeneratorAgent = $this->microAgentFactory->getAgent('ImageFileNameGenerator', $agentFilePath);

            if (! $nameGeneratorAgent->isEnabled()) {
                $this->logger->warning('ImageFileNameGenerator agent is disabled, fallback to image_id');
                return $entity->getImageId();
            }

            $modelGatewayDataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);

            $fileName = '';
            retry(1, function () use (&$fileName, $nameGeneratorAgent, $modelGatewayDataIsolation, $prompt, $dataIsolation): void {
                $response = $nameGeneratorAgent->easyCall(
                    dataIsolation: $modelGatewayDataIsolation,
                    userPrompt: "请为以下图片生成提示生成一个简洁的文件名：{$prompt}",
                    businessParams: [
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'source_id' => 'design_image_file_name_generation',
                    ]
                );

                $fileName = trim($response->getFirstChoice()?->getMessage()?->getContent() ?? '');
            }, 1000);

            if ($fileName === '') {
                $this->logger->warning('ImageFileNameGenerator returned empty result, fallback to image_id');
                return $entity->getImageId();
            }

            $fileName = $this->sanitizeFileName($fileName);

            if ($fileName === '') {
                return $entity->getImageId();
            }

            return $fileName . '_' . date('YmdHis');
        } catch (Throwable $throwable) {
            $this->logger->warning('Failed to generate intelligent file name, fallback to image_id', [
                'error' => $throwable->getMessage(),
                'prompt' => $prompt,
            ]);
            return $entity->getImageId();
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
}
