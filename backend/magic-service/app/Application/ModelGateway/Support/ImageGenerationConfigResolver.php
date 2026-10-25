<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Support;

use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModelConfig;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 图片生成参数解析器：把模型的 image_settings 声明原文与用户提示词拼成用户内容，
 * 交给通用提取器按提示词里的通用规则提取生成参数（不做任何结构转换），再与用户显式传入的参数合集。
 *
 * 图片域的知识（用哪个提示词、声明怎么拼、哪些键合法、声明默认值是什么）只留在本类，不下沉到通用提取器。
 */
class ImageGenerationConfigResolver
{
    /** 图片域的参数提取提示词（Prompt/ImageGenerationConfigExtractor.agent.yaml） */
    private const string EXTRACTOR_AGENT = 'ImageGenerationConfigExtractor';

    protected readonly LoggerInterface $logger;

    public function __construct(
        private readonly GenerationConfigExtractor $extractor,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('ImageGenerationConfigResolver');
    }

    /**
     * @return array<string, mixed> 从提示词提取到的生成参数（不含用户显式传入的值，由调用方负责合集）
     */
    public function resolve(
        string $modelVersion,
        ?string $modelId,
        string $prompt,
        ModelGatewayDataIsolation $dataIsolation
    ): array {
        try {
            if (trim($prompt) === '') {
                return [];
            }

            $settings = $this->loadSettings($modelVersion, $modelId);
            if ($settings === []) {
                return [];
            }

            // 声明原文直接交给模型，不做任何结构转换
            $userContent = sprintf(
                "Parameter declaration（JSON）：\n%s\n\nUser input：\n%s",
                Json::encode($settings),
                $prompt
            );

            $result = $this->extractor->extract($dataIsolation, self::EXTRACTOR_AGENT, $userContent, true);

            return $this->filterDeclared($result, $settings);
        } catch (Throwable $throwable) {
            // 提取失败不影响出图：退回声明默认值，只记录日志
            $this->logger->error('ImageGenerationConfigResolveFailed', [
                'model_version' => $modelVersion,
                'model_id' => $modelId,
                'error' => $throwable->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadSettings(string $modelVersion, ?string $modelId): array
    {
        return ImageModelConfig::fromModel($modelVersion, $modelId)?->toArray()['image_settings'] ?? [];
    }

    /**
     * 只保留声明过、且值不为空的参数，挡掉模型编造的键。
     * @param array<string, mixed> $result
     * @param array<int, array<string, mixed>> $settings
     * @return array<string, mixed>
     */
    private function filterDeclared(array $result, array $settings): array
    {
        $allowed = [];
        foreach ($settings as $setting) {
            $leaf = $this->leafName($setting);
            if ($leaf !== '') {
                $allowed[$leaf] = true;
            }
        }

        $filtered = [];
        foreach ($result as $name => $value) {
            if (is_string($name) && isset($allowed[$name]) && $value !== null) {
                $filtered[$name] = $value;
            }
        }

        return $filtered;
    }

    /**
     * @param array<string, mixed> $setting
     */
    private function leafName(array $setting): string
    {
        $parts = explode('.', (string) ($setting['key'] ?? ''));
        $leaf = end($parts);

        return is_string($leaf) ? $leaf : '';
    }
}
