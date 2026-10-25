<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Support\AssetVisualPrecheck;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\Video\VideoFrameExtractorInterface;
use Dtyq\CloudFile\Kernel\Struct\DownloadedRemoteFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * 无人像预检的判定与降级。
 *
 * 预检只承担一件不可出错的事：确认「没有人像」才允许跳过火山素材注册。因此除了模型判有人之外，
 * 判不准、响应不可解析、模型调用抛错、抽帧或下载失败——每条路径都必须退回火山合规审核。
 *
 * @internal
 */
class AssetVisualPrecheckTest extends TestCase
{
    /** 1x1 PNG：帧的媒体类型由内容判定，用它证明 data URI 的前缀来自帧本身而不是写死的常量。 */
    private const string PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AGtH0lWAAAAAElFTkSuQmCC';

    private const string IMAGE_URL = 'https://example.test/asset.png';

    private const string VIDEO_URL = 'https://example.test/asset.mp4';

    private const string MODEL_ID = 'vision-model';

    private const string NO_PERSON_CONTENT = '{"has_person": false, "confidence": 0.95}';

    private const string PERSON_CONTENT = '{"has_person": true, "confidence": 0.99}';

    private const string LOW_CONFIDENCE_CONTENT = '{"has_person": false, "confidence": 0.4}';

    /** @var array<int, CompletionDTO> 预检实际发出的请求，用来断言请求内容 */
    private array $requests = [];

    /** @var array<int, string> 用例创建的临时文件，兜底清理（正常路径由被测代码自己删） */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        $this->tempFiles = [];
        $this->requests = [];

        parent::tearDown();
    }

    public function testNonVisualAssetNeverCallsTheModel(): void
    {
        $precheck = $this->precheck($this->neverInvokedResponder());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('AUDIO'), self::IMAGE_URL),
        );
        self::assertSame([], $this->requests);
    }

    public function testBlankFileUrlNeverCallsTheModel(): void
    {
        $precheck = $this->precheck($this->neverInvokedResponder());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), '  '),
        );
        self::assertSame([], $this->requests);
    }

    public function testMissingAbilityNeverCallsTheModel(): void
    {
        $precheck = $this->precheckWithAbility(null, $this->neverInvokedResponder());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
        self::assertSame([], $this->requests);
    }

    public function testDisabledAbilityNeverCallsTheModel(): void
    {
        $precheck = $this->precheckWithAbility($this->ability(self::MODEL_ID, 0), $this->neverInvokedResponder());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
        self::assertSame([], $this->requests);
    }

    public function testAbilityWithoutModelNeverCallsTheModel(): void
    {
        $precheck = $this->precheckWithAbility($this->ability('', 1), $this->neverInvokedResponder());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
        self::assertSame([], $this->requests);
    }

    public function testImageWithoutPersonSkipsTheProvider(): void
    {
        $precheck = $this->precheck($this->answering(self::NO_PERSON_CONTENT));

        self::assertSame(
            ProviderReviewMode::NO_PERSON,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );

        // 图片只有一张，直接把它自己的地址交给模型，不做任何转码。
        $blocks = $this->blocksOfFirstRequest();
        self::assertSame('text', $blocks[0]['type']);
        self::assertSame(self::IMAGE_URL, $blocks[1]['image_url']['url']);

        $request = $this->requests[0];
        self::assertSame(self::MODEL_ID, $request->getModel());
        self::assertSame(128, $request->getMaxTokens());
        self::assertSame(0.0, $request->getTemperature());
    }

    public function testImageWithPersonGoesToTheProvider(): void
    {
        $precheck = $this->precheck($this->answering(self::PERSON_CONTENT));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageBelowConfidenceGoesToTheProvider(): void
    {
        // 图片的门槛是 0.8：判了无人像但置信度不足，不能放行。
        $precheck = $this->precheck($this->answering(self::LOW_CONFIDENCE_CONTENT));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageWithoutConfidenceGoesToTheProvider(): void
    {
        $precheck = $this->precheck($this->answering('{"has_person": false}'));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageWithoutHasPersonGoesToTheProvider(): void
    {
        // 字段缺失按「有人像」处理：预检的默认答案必须是交给火山，而不是放行。
        $precheck = $this->precheck($this->answering('{"confidence": 0.99}'));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageUnparsableResponseGoesToTheProvider(): void
    {
        $precheck = $this->precheck($this->answering('there is no json here'));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageWithoutChoiceGoesToTheProvider(): void
    {
        $precheck = $this->precheck(fn (): ChatCompletionResponse => $this->emptyCompletion());

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testImageModelFailureGoesToTheProvider(): void
    {
        $precheck = $this->precheck(function (): ChatCompletionResponse {
            throw new RuntimeException('model gateway down');
        });

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('IMAGE'), self::IMAGE_URL),
        );
    }

    public function testVideoWithoutPersonInlinesFramesAndCleansUp(): void
    {
        $video = $this->tempFile('video-', '.mp4', 'video-bytes');
        $pngFrame = $this->tempFile('frame-', '.jpg', (string) base64_decode(self::PNG_BASE64, true));
        // 内容不是图片：判定不出媒体类型时退回 JPEG，而不是把未知内容当成别的格式。
        $opaqueFrame = $this->tempFile('frame-', '.jpg', 'not-an-image');

        $extractor = $this->createMock(VideoFrameExtractorInterface::class);
        $extractor->expects(self::once())
            ->method('extractFrames')
            ->with($video, 6)
            ->willReturn([$pngFrame, $opaqueFrame]);

        $precheck = $this->precheck(
            $this->answering(self::NO_PERSON_CONTENT),
            $extractor,
            $this->downloader($video),
        );

        self::assertSame(
            ProviderReviewMode::NO_PERSON,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );

        // 多帧一次请求传完，帧不落第三方存储。
        $blocks = $this->blocksOfFirstRequest();
        self::assertCount(3, $blocks);
        self::assertStringStartsWith('data:image/png;base64,', $blocks[1]['image_url']['url']);
        self::assertStringStartsWith('data:image/jpeg;base64,', $blocks[2]['image_url']['url']);

        self::assertFileDoesNotExist($video);
        self::assertFileDoesNotExist($pngFrame);
        self::assertFileDoesNotExist($opaqueFrame);
    }

    public function testVideoWithPersonGoesToTheProvider(): void
    {
        $video = $this->tempFile('video-', '.mp4', 'video-bytes');
        $frame = $this->tempFile('frame-', '.jpg', (string) base64_decode(self::PNG_BASE64, true));

        $extractor = $this->createMock(VideoFrameExtractorInterface::class);
        $extractor->method('extractFrames')->willReturn([$frame]);

        $precheck = $this->precheck($this->answering(self::PERSON_CONTENT), $extractor, $this->downloader($video));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );

        // 无论结论如何，抽帧产物与下载的临时视频都要回收。
        self::assertFileDoesNotExist($video);
        self::assertFileDoesNotExist($frame);
    }

    public function testVideoWithoutFramesNeverCallsTheModel(): void
    {
        $video = $this->tempFile('video-', '.mp4', 'video-bytes');

        $extractor = $this->createMock(VideoFrameExtractorInterface::class);
        $extractor->method('extractFrames')->willReturn([]);

        $precheck = $this->precheck($this->neverInvokedResponder(), $extractor, $this->downloader($video));

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );
        self::assertSame([], $this->requests);
        self::assertFileDoesNotExist($video);
    }

    public function testVideoWithUnreadableFramesNeverCallsTheModel(): void
    {
        $video = $this->tempFile('video-', '.mp4', 'video-bytes');
        $missingFrame = sys_get_temp_dir() . '/asset-precheck-missing-frame-' . bin2hex(random_bytes(4)) . '.jpg';

        $extractor = $this->createMock(VideoFrameExtractorInterface::class);
        $extractor->method('extractFrames')->willReturn([$missingFrame]);

        $precheck = $this->precheck($this->neverInvokedResponder(), $extractor, $this->downloader($video));

        // 拿不到帧不等于「没有人像」。
        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );
        self::assertSame([], $this->requests);
        self::assertFileDoesNotExist($video);
    }

    public function testVideoDownloadFailureGoesToTheProvider(): void
    {
        $downloader = $this->createMock(SafeRemoteFileDownloader::class);
        $downloader->method('download')->willThrowException(new RuntimeException('download refused'));

        $precheck = $this->precheck($this->neverInvokedResponder(), null, $downloader);

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );
        self::assertSame([], $this->requests);
    }

    public function testVideoMissingDownloadedFileGoesToTheProvider(): void
    {
        $missingVideo = sys_get_temp_dir() . '/asset-precheck-missing-video-' . bin2hex(random_bytes(4)) . '.mp4';

        $precheck = $this->precheck(
            $this->neverInvokedResponder(),
            null,
            $this->downloader($missingVideo),
        );

        self::assertSame(
            ProviderReviewMode::VOLCENGINE,
            $precheck->resolveReviewMode($this->isolation(), $this->asset('VIDEO'), self::VIDEO_URL),
        );
        self::assertSame([], $this->requests);
    }

    /**
     * @param callable(CompletionDTO):ChatCompletionResponse $responder
     */
    private function precheck(
        callable $responder,
        ?VideoFrameExtractorInterface $frameExtractor = null,
        ?SafeRemoteFileDownloader $downloader = null,
    ): AssetVisualPrecheck {
        return $this->precheckWithAbility($this->ability(self::MODEL_ID, 1), $responder, $frameExtractor, $downloader);
    }

    /**
     * @param callable(CompletionDTO):ChatCompletionResponse $responder
     */
    private function precheckWithAbility(
        ?AiAbilityEntity $ability,
        callable $responder,
        ?VideoFrameExtractorInterface $frameExtractor = null,
        ?SafeRemoteFileDownloader $downloader = null,
    ): AssetVisualPrecheck {
        $abilities = $this->createMock(AiAbilityDomainService::class);
        $abilities->method('getByCode')->willReturn($ability);

        $llm = $this->createMock(LLMAppService::class);
        $llm->method('chatCompletion')->willReturnCallback(
            function (CompletionDTO $request) use ($responder): ChatCompletionResponse {
                $this->requests[] = $request;
                return $responder($request);
            }
        );

        return new AssetVisualPrecheck(
            $abilities,
            $llm,
            $frameExtractor ?? $this->createMock(VideoFrameExtractorInterface::class),
            new NullLogger(),
            $downloader,
        );
    }

    /**
     * @return callable(CompletionDTO):ChatCompletionResponse
     */
    private function answering(string $content): callable
    {
        return fn (): ChatCompletionResponse => $this->completion($content);
    }

    /**
     * 预检走到这条路径就是错的：模型不该被调用。
     *
     * @return callable(CompletionDTO):ChatCompletionResponse
     */
    private function neverInvokedResponder(): callable
    {
        return function (): ChatCompletionResponse {
            self::fail('这条路径不应调用视觉理解模型');
        };
    }

    private function completion(string $content): ChatCompletionResponse
    {
        $response = $this->createMock(ChatCompletionResponse::class);
        $response->method('getFirstChoice')->willReturn(ChatCompletionChoice::fromArray([
            'index' => 0,
            'message' => ['role' => 'assistant', 'content' => $content],
            'finish_reason' => 'stop',
        ]));

        return $response;
    }

    private function emptyCompletion(): ChatCompletionResponse
    {
        $response = $this->createMock(ChatCompletionResponse::class);
        $response->method('getFirstChoice')->willReturn(null);

        return $response;
    }

    private function ability(string $modelId, int $status): AiAbilityEntity
    {
        return new AiAbilityEntity([
            'status' => $status,
            'config' => ['model_id' => $modelId],
        ]);
    }

    private function isolation(): AssetDataIsolation
    {
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('getCurrentOrganizationCode')->willReturn('org-a');
        $isolation->method('getCurrentUserId')->willReturn('user-a');

        return $isolation;
    }

    private function asset(string $mediaType): AssetEntity
    {
        return new AssetEntity(['id' => 1, 'asset_media_type' => $mediaType]);
    }

    private function downloader(string $localPath): SafeRemoteFileDownloader
    {
        $downloader = $this->createMock(SafeRemoteFileDownloader::class);
        $downloader->method('download')->willReturn(new DownloadedRemoteFile($localPath, 'asset.mp4', 'video/mp4', 11));

        return $downloader;
    }

    private function tempFile(string $prefix, string $suffix, string $content): string
    {
        $path = tempnam(sys_get_temp_dir(), $prefix) . $suffix;
        file_put_contents($path, $content);
        $this->tempFiles[] = $path;

        return $path;
    }

    /**
     * @return array<int, array<string, mixed>> 首条请求的 content 分块
     */
    private function blocksOfFirstRequest(): array
    {
        self::assertCount(1, $this->requests);
        $messages = $this->requests[0]->getMessages();
        self::assertCount(1, $messages);

        return $messages[0]['content'];
    }
}
