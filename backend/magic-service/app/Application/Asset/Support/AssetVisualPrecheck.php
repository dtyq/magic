<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Support;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetMediaType;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\Video\VideoFrameExtractorInterface;
use Dtyq\CloudFile\Kernel\Utils\RemoteDownloadSecurityConfig;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 素材「是否含人像」的视觉理解预检，确认无人像才跳过第三方素材注册。
 */
class AssetVisualPrecheck
{
    private const string PRECHECK_PROMPT = 'Determine whether there is a human figure in the image(s). Reply only with JSON content; do not include any non-JSON content. Example response: {"has_person": true or false, "confidence": a decimal between 0 and 1}. Return has_person=true if unable to determine.';

    private const int MAX_TOKENS = 128;

    /** 图片只有一帧，误判概率低，沿用原有门槛。 */
    private const float IMAGE_MIN_CONFIDENCE = 0.8;

    /** 视频是抽样判断，漏判会放行带人像的素材，门槛更高。 */
    private const float VIDEO_MIN_CONFIDENCE = 0.9;

    /** 视频均匀抽帧数：帧数越多越不容易漏人像，代价是单次请求携带的图片数量与 token 消耗。 */
    private const int VIDEO_FRAME_COUNT = 6;

    private const int VIDEO_DOWNLOAD_MAX_BYTES = 209715200;

    /** 内联帧的兜底媒体类型：实际类型按帧文件内容判定，判定不出时才用它（见 frameDataUriPrefix）。 */
    private const string FRAME_DATA_URI_PREFIX = 'data:image/jpeg;base64,';

    /** 单帧编码后体积上限，超限的帧直接丢弃。 */
    private const int FRAME_MAX_BYTES = 5242880;

    private readonly SafeRemoteFileDownloader $downloader;

    /**
     * @param null|SafeRemoteFileDownloader $downloader 仅供单测传入替身：抓取外部地址涉及重定向与体积限制，
     *                                                  单测不必真的发请求。生产由容器装配，可选参数不会被注入，这里自建。
     */
    public function __construct(
        private readonly AiAbilityDomainService $abilityDomainService,
        private readonly LLMAppService $llmAppService,
        private readonly VideoFrameExtractorInterface $frameExtractor,
        private readonly LoggerInterface $logger,
        ?SafeRemoteFileDownloader $downloader = null,
    ) {
        $this->downloader = $downloader ?? new SafeRemoteFileDownloader(new RemoteDownloadSecurityConfig(
            enabled: true,
            level: RemoteDownloadSecurityConfig::LEVEL_STANDARD,
            maxDownloadSize: self::VIDEO_DOWNLOAD_MAX_BYTES,
            maxRedirects: 3,
        ));
    }

    /** 判断素材能否跳过第三方素材注册；只有图片 / 视频参与预检。 */
    public function resolveReviewMode(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        ?string $fileUrl,
    ): ProviderReviewMode {
        $mediaType = $asset->getAssetMediaType();
        if ($mediaType !== AssetMediaType::IMAGE && $mediaType !== AssetMediaType::VIDEO) {
            return ProviderReviewMode::VOLCENGINE;
        }

        $fileUrl = trim((string) $fileUrl);
        if ($fileUrl === '') {
            return ProviderReviewMode::VOLCENGINE;
        }

        $modelId = $this->resolveModelId();
        if ($modelId === null) {
            return ProviderReviewMode::VOLCENGINE;
        }

        return $mediaType === AssetMediaType::IMAGE
            ? $this->precheckImage($dataIsolation, $asset, $fileUrl, $modelId)
            : $this->precheckVideo($dataIsolation, $asset, $fileUrl, $modelId);
    }

    private function precheckImage(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        string $fileUrl,
        string $modelId,
    ): ProviderReviewMode {
        try {
            $hasPerson = $this->detectPerson($dataIsolation, $modelId, [$fileUrl], self::IMAGE_MIN_CONFIDENCE);
            return $hasPerson === false ? ProviderReviewMode::NO_PERSON : ProviderReviewMode::VOLCENGINE;
        } catch (Throwable $throwable) {
            $this->logger->warning('素材视觉理解预检失败，降级火山合规审核', [
                'asset_id' => $asset->getId(),
                'message' => $throwable->getMessage(),
            ]);
            return ProviderReviewMode::VOLCENGINE;
        }
    }

    /** 下载视频、均匀抽帧后一次请求送视觉理解，未确认无人像则降级火山合规审核。 */
    private function precheckVideo(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        string $fileUrl,
        string $modelId,
    ): ProviderReviewMode {
        $downloadedPath = null;
        /** @var array<int, string> $framePaths */
        $framePaths = [];

        try {
            $downloadedPath = $this->downloader->download($fileUrl)->getRealPath();
            if (! is_file($downloadedPath)) {
                $this->logger->warning('视频下载产物不存在，降级火山合规审核', [
                    'asset_id' => $asset->getId(),
                ]);
                return ProviderReviewMode::VOLCENGINE;
            }

            $framePaths = $this->frameExtractor->extractFrames($downloadedPath, self::VIDEO_FRAME_COUNT);
            if ($framePaths === []) {
                $this->logger->warning('视频抽帧无有效画面，降级火山合规审核', [
                    'asset_id' => $asset->getId(),
                ]);
                return ProviderReviewMode::VOLCENGINE;
            }

            $frameDataUris = [];
            foreach ($framePaths as $framePath) {
                $dataUri = $this->buildFrameDataUri($framePath);
                if ($dataUri !== null) {
                    $frameDataUris[] = $dataUri;
                }
            }
            if ($frameDataUris === []) {
                $this->logger->warning('视频抽帧产物无法编码为 Base64，降级火山合规审核', [
                    'asset_id' => $asset->getId(),
                ]);
                return ProviderReviewMode::VOLCENGINE;
            }

            $hasPerson = $this->detectPerson($dataIsolation, $modelId, $frameDataUris, self::VIDEO_MIN_CONFIDENCE);
            if ($hasPerson !== false) {
                $this->logger->info('视频预检未确认无人像，按有人像走火山合规审核', [
                    'asset_id' => $asset->getId(),
                    'frame_count' => count($frameDataUris),
                ]);
                return ProviderReviewMode::VOLCENGINE;
            }

            return ProviderReviewMode::NO_PERSON;
        } catch (Throwable $throwable) {
            $this->logger->warning('视频无人像预检失败，降级火山合规审核', [
                'asset_id' => $asset->getId(),
                'message' => $throwable->getMessage(),
            ]);
            return ProviderReviewMode::VOLCENGINE;
        } finally {
            if ($downloadedPath !== null && is_file($downloadedPath)) {
                @unlink($downloadedPath);
            }
            $this->removeLocalFiles($framePaths);
        }
    }

    /** 把本地抽出的帧编码为 Base64 data URI；读不到、为空或超限时返回 null 由调用方降级。 */
    private function buildFrameDataUri(string $localPath): ?string
    {
        if (! is_file($localPath)) {
            return null;
        }
        $size = (int) filesize($localPath);
        if ($size <= 0 || $size > self::FRAME_MAX_BYTES) {
            $this->logger->warning('视频预检帧体积异常，跳过该帧', [
                'size' => $size,
            ]);
            return null;
        }

        $content = file_get_contents($localPath);
        if (! is_string($content) || $content === '') {
            return null;
        }

        return $this->frameDataUriPrefix($localPath) . base64_encode($content);
    }

    /**
     * 帧以 data URI 内联，媒体类型必须与帧文件的实际内容一致。
     *
     * 接口只承诺「帧图片」，当前实现输出 JPEG；这里按内容判定、判定不出时退回 JPEG，
     * 避免将来换成其它编码（如 PNG）的实现时，内容被静默按 JPEG 解码。
     */
    private function frameDataUriPrefix(string $localPath): string
    {
        $info = @getimagesize($localPath);
        if (! is_array($info) || ! isset($info['mime'])) {
            return self::FRAME_DATA_URI_PREFIX;
        }

        return 'data:' . $info['mime'] . ';base64,';
    }

    /** @param array<int, string> $paths */
    private function removeLocalFiles(array $paths): void
    {
        foreach ($paths as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /** 读取视觉理解能力配置的模型；未开启或未配置模型时无法预检。 */
    private function resolveModelId(): ?string
    {
        try {
            $ability = $this->abilityDomainService->getByCode(
                ProviderDataIsolation::create()->disabled(),
                AiAbilityCode::VisualUnderstanding,
            );
            if ($ability === null || ! $ability->isEnabled()) {
                return null;
            }
            $modelId = trim((string) ($ability->getConfig()['model_id'] ?? ''));
            return $modelId === '' ? null : $modelId;
        } catch (Throwable $throwable) {
            $this->logger->warning('读取视觉理解能力失败，跳过无人像预检', [
                'message' => $throwable->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 调用视觉理解判断画面是否含人像。
     *
     * @param array<int, string> $imageUrls 图片地址或 Base64 data URI；视频的多个抽帧一次性传完
     * @return null|bool false=确认无人像；true=有人像；null=判不准（响应异常或置信度不足）
     */
    private function detectPerson(
        AssetDataIsolation $dataIsolation,
        string $modelId,
        array $imageUrls,
        float $minConfidence,
    ): ?bool {
        $request = new CompletionDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $request->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $request->setModel($modelId);
        $request->setMaxTokens(self::MAX_TOKENS);
        $request->setTemperature(0.0);
        $request->setBusinessParams([
            'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'source_id' => SourceId::ASSET_COMPLIANCE_PRECHECK,
        ]);
        $blocks = [['type' => 'text', 'text' => self::PRECHECK_PROMPT]];
        foreach ($imageUrls as $imageUrl) {
            $blocks[] = ['type' => 'image_url', 'image_url' => ['url' => $imageUrl]];
        }

        $request->setMessages([[
            'role' => 'user',
            'content' => $blocks,
        ]]);

        $response = $this->llmAppService->chatCompletion($request);
        if (! $response instanceof ChatCompletionResponse) {
            return null;
        }
        $content = $response->getFirstChoice()?->getMessage()?->getContent();
        if (! is_string($content)) {
            return null;
        }
        $content = trim(preg_replace('/^```(?:json)?|```$/i', '', $content) ?? '');
        $result = json_decode($content, true);
        if (! is_array($result)) {
            return null;
        }

        // 字段缺失一律按「有人像」处理：预检的默认答案必须是交给火山审核，而不是放行。
        if (($result['has_person'] ?? true) !== false) {
            return true;
        }

        return (float) ($result['confidence'] ?? 0) >= $minConfidence ? false : null;
    }
}
