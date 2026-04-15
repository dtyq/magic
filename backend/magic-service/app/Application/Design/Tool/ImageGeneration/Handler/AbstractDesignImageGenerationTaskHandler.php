<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\Design\Tool\ImageGeneration\Contract\DesignImageGenerationTaskHandlerInterface;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;

/**
 * 设计异步生图 Handler 公共逻辑：业务参数、访问令牌、参考图链接（SandBox / Private、crop）。
 */
abstract class AbstractDesignImageGenerationTaskHandler implements DesignImageGenerationTaskHandlerInterface
{
    public function __construct(
        protected readonly FileDomainService $fileDomainService,
    ) {
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return null;
    }

    /**
     * 将 Model Gateway 返回值收窄为 {@see OpenAIFormatResponse}。
     * 如 LLMAppService::textGenerateImageV2 对静态分析标注为 ResponseInterface，经此处统一收窄可消除 IDE/分析器告警。
     */
    protected function narrowToOpenAiFormatImageResponse(mixed $response): ?OpenAIFormatResponse
    {
        return $response instanceof OpenAIFormatResponse ? $response : null;
    }

    /**
     * @return array{organization_code: string, user_id: int|string, source_id: string}
     */
    protected function designImageGenerationBusinessParams(DesignDataIsolation $dataIsolation): array
    {
        return [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'source_id' => 'design_image_generation',
        ];
    }

    protected function applyMagicAccessToken(AbstractRequestDTO $dto): void
    {
        /* @phpstan-ignore-next-line constant is defined at runtime */
        $dto->setAccessToken(MAGIC_ACCESS_TOKEN);
    }

    /**
     * 工作区内相对路径图片在 SandBox 下的访问 URL。
     *
     * @param array<string, mixed> $linkOptions
     */
    protected function getWorkspaceSandboxImageUrl(
        DesignDataIsolation $dataIsolation,
        string $workspacePrefix,
        string $relativePath,
        array $linkOptions = [],
    ): ?string {
        return $this->fileDomainService->getLink(
            $dataIsolation->getCurrentOrganizationCode(),
            $workspacePrefix . $relativePath,
            StorageBucketType::SandBox,
            [],
            $linkOptions
        )?->getUrl();
    }

    /**
     * 将单张参考图的处理选项转换为链接参数.
     * 目前支持 crop，后续可在此处扩展更多选项类型.
     *
     * @param array<string, mixed> $imageOptions 单张图片的选项，如 ['crop' => [...]]
     * @return array<string, mixed>
     */
    protected function buildLinkOptionsFromImageOptions(array $imageOptions): array
    {
        $crop = $imageOptions['crop'] ?? null;
        return $this->buildImageLinkOptionsFromCrop(is_array($crop) ? $crop : null);
    }

    /**
     * 从数组格式的 referenceImageOptions 中按路径查找对应选项.
     * 外部格式: [['path' => '/img.png', 'crop' => [...]], ...].
     *
     * @param list<array<string, mixed>> $referenceImageOptions
     * @return array<string, mixed>
     */
    protected function findImageOptions(array $referenceImageOptions, string $path): array
    {
        foreach ($referenceImageOptions as $item) {
            if (is_array($item) && ($item['path'] ?? '') === $path) {
                $options = $item;
                unset($options['path']);
                return $options;
            }
        }
        return [];
    }

    /**
     * 文生图 / 图生图：参考图均在 SandBox 工作区路径下，支持按索引 crop。
     *
     * @return list<string>
     */
    protected function collectWorkspaceReferenceImageUrls(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): array {
        $urls = [];
        $referenceImageOptions = $entity->getReferenceImageOptions() ?? [];

        foreach ($entity->getReferenceImages() ?? [] as $referenceImage) {
            $linkOptions = $this->buildLinkOptionsFromImageOptions($this->findImageOptions($referenceImageOptions, $referenceImage));
            $url = $this->getWorkspaceSandboxImageUrl($dataIsolation, $workspacePrefix, $referenceImage, $linkOptions);
            if ($url !== null && $url !== '') {
                $urls[] = $url;
            }
        }

        return $urls;
    }

    /**
     * 橡皮擦 / 扩图：含 design-mark 走 Private，其余走 SandBox 工作区。
     *
     * @return list<string>
     */
    protected function collectEraserExpandReferenceImageUrls(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): array {
        $urls = [];
        $referenceImageOptions = $entity->getReferenceImageOptions() ?? [];

        foreach ($entity->getReferenceImages() ?? [] as $referenceImage) {
            if (str_contains($referenceImage, 'design-mark/')) {
                // 临时标记图走私有桶，不携带 options
                $privateFileKey = ltrim($referenceImage, '/');
                $url = $this->fileDomainService->getLink(
                    $dataIsolation->getCurrentOrganizationCode(),
                    $privateFileKey,
                    StorageBucketType::Private
                )?->getUrl();
            } else {
                $linkOptions = $this->buildLinkOptionsFromImageOptions($this->findImageOptions($referenceImageOptions, $referenceImage));
                $url = $this->getWorkspaceSandboxImageUrl($dataIsolation, $workspacePrefix, $referenceImage, $linkOptions);
            }
            if ($url !== null && $url !== '') {
                $urls[] = $url;
            }
        }

        return $urls;
    }

    /**
     * 取首张参考图文件名，去掉历史同类后缀与末尾 14 位时间戳，再拼上 joiner + 当前时间戳。
     *
     * @param non-empty-string $dedicatedSuffixRegex 如 '/_high_\d{14}$/'
     * @param non-empty-string $joiner 如 '_high_'（含首尾下划线语义由调用方决定）
     */
    protected function outputBasenameFromFirstReferenceImage(
        ImageGenerationEntity $entity,
        string $dedicatedSuffixRegex,
        string $joiner,
    ): ?string {
        $referenceImage = $entity->getReferenceImages()[0] ?? null;
        if ($referenceImage === null || $referenceImage === '') {
            return null;
        }

        $originalFileName = (string) pathinfo($referenceImage, PATHINFO_FILENAME);
        $originalFileName = preg_replace($dedicatedSuffixRegex, '', $originalFileName) ?? '';
        $originalFileName = preg_replace('/_\d{14}$/', '', $originalFileName) ?? '';

        return $originalFileName . $joiner . date('YmdHis');
    }

    /**
     * @param null|array<string, mixed> $cropData
     * @return array<string, mixed>
     */
    private function buildImageLinkOptionsFromCrop(?array $cropData): array
    {
        if ($cropData === null || $cropData === []) {
            return [];
        }

        $imageProcessOptions = new ImageProcessOptions();
        $imageProcessOptions->crop([
            'width' => (int) round((float) ($cropData['width'] ?? 0)),
            'height' => (int) round((float) ($cropData['height'] ?? 0)),
            'x' => (int) round((float) ($cropData['x'] ?? 0)),
            'y' => (int) round((float) ($cropData['y'] ?? 0)),
        ]);

        return ['image' => $imageProcessOptions];
    }
}
