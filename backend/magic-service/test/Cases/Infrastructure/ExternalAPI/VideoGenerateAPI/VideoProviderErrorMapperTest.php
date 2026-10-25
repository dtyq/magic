<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

use function Hyperf\Translation\trans;

/**
 * @internal
 */
final class VideoProviderErrorMapperTest extends TestCase
{
    public function testMapsVolcengineProviderCodesToVideoErrorCodes(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::INVALID_PARAMETER,
            ProviderVideoErrorMapper::resolveVolcengine(null, [
                'error' => ['code' => 'InvalidParameter'],
            ])['errorCode'],
        );
        self::assertSame(
            VideoGenerateErrorCode::INPUT_IMAGE_SENSITIVE_CONTENT_DETECTED,
            ProviderVideoErrorMapper::resolveVolcengine(null, [
                'error' => ['code' => 'InputImageSensitiveContentDetected.FutureSubtype'],
            ])['errorCode'],
        );
    }

    public function testRefinesVolcengineInvalidParameterMessageByPayloadKeyword(): void
    {
        $result = ProviderVideoErrorMapper::resolveVolcengine(null, [
            'error' => [
                'code' => 'InvalidParameter',
                'message' => 'Error while downloading video, video height specified in the request must be less than or equal to 6000.',
            ],
        ]);

        self::assertSame(VideoGenerateErrorCode::INVALID_PARAMETER, $result['errorCode']);
        self::assertSame(
            trans('video_generate.invalid_parameter_video_dimension_exceeds_limit'),
            $result['message'],
        );
    }

    public function testMapsDashScopeProviderCodeToVideoErrorCode(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::INPUT_VIDEO_PRIVACY_FAILED,
            ProviderVideoErrorMapper::resolveDashScope(null, [
                'code' => 'InputVideoSensitiveContentDetected.PrivacyInformation',
            ]),
        );
    }

    public function testMapsNestedDashScopeErrorCodeToVideoErrorCode(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::INPUT_VIDEO_PRIVACY_FAILED,
            ProviderVideoErrorMapper::resolveDashScope(null, [
                'output' => [
                    'error' => ['code' => 'InputVideoSensitiveContentDetected.PrivacyInformation'],
                ],
            ]),
        );
    }

    public function testMapsUnknownDashScopeErrorToGenericError(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::GENERAL_ERROR,
            ProviderVideoErrorMapper::resolveDashScope(null, ['code' => 'UnknownProviderCode']),
        );
    }

    /**
     * @dataProvider geminiProviderCodeMap
     */
    public function testMapsGeminiProviderCodes(string $providerCode, VideoGenerateErrorCode $expected): void
    {
        self::assertSame(
            $expected,
            ProviderVideoErrorMapper::resolveGemini($this->requestException(400, [
                'error' => ['code' => $providerCode, 'message' => 'provider message'],
            ])),
        );
    }

    /**
     * @return iterable<string, array{string, VideoGenerateErrorCode}>
     */
    public static function geminiProviderCodeMap(): iterable
    {
        yield 'invalid argument' => ['INVALID_ARGUMENT', VideoGenerateErrorCode::INVALID_PARAMETER];
        yield 'resource exhausted' => ['RESOURCE_EXHAUSTED', VideoGenerateErrorCode::GENERAL_ERROR];
        yield 'unauthenticated' => ['UNAUTHENTICATED', VideoGenerateErrorCode::GENERAL_ERROR];
        yield 'permission denied' => ['PERMISSION_DENIED', VideoGenerateErrorCode::GENERAL_ERROR];
        yield 'rate limited' => ['RATE_LIMITED', VideoGenerateErrorCode::GENERAL_ERROR];
    }

    public function testGeminiResolverHidesProviderQuotaError(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::GENERAL_ERROR,
            ProviderVideoErrorMapper::resolveGemini($this->requestException(400, [
                'error' => [
                    'code' => 'RESOURCE_EXHAUSTED',
                    'message' => 'Quota exceeded',
                ],
            ])),
        );
    }

    public function testGeminiResolverMapsAspectRatioFromInvalidArgument(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::INVALID_ASPECT_RATIO,
            ProviderVideoErrorMapper::resolveGemini($this->requestException(400, [
                'error' => [
                    'code' => 'INVALID_ARGUMENT',
                    'message' => 'The requested aspect ratio is not supported.',
                ],
            ])),
        );
    }

    public function testGeminiResolverMapsActualProviderErrors(): void
    {
        $cases = [
            [
                'invalid_request',
                'Edited video duration (4.958s, rounded to 1st decimal: 5s) does not match config duration (3s, rounded to 1st decimal: 3s).',
                VideoGenerateErrorCode::INVALID_PARAMETER,
            ],
            [
                'content_blocked',
                "Input blocked: Sorry, we can't create videos with real people's names or likenesses.",
                VideoGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED,
            ],
            [
                'invalid_request',
                'HTTP video input is not supported by the model.',
                VideoGenerateErrorCode::INVALID_PARAMETER,
            ],
            [
                'Unable to show the generated video. The video was filtered out because it violated Google policy.',
                'Request blocked due to prohibited content guidelines.',
                VideoGenerateErrorCode::OUTPUT_VIDEO_AUDIT_FAILED,
            ],
            [
                'invalid_request',
                'Video response format duration must be positive.',
                VideoGenerateErrorCode::INVALID_PARAMETER,
            ],
        ];

        foreach ($cases as [$providerCode, $providerMessage, $expected]) {
            self::assertSame(
                $expected,
                ProviderVideoErrorMapper::resolveGemini($this->requestException(400, [
                    'error' => [
                        'code' => $providerCode,
                        'message' => $providerMessage,
                    ],
                ])),
                (string) $providerMessage,
            );
        }
    }

    /**
     * @dataProvider geminiMessageMap
     */
    public function testMapsGeminiProviderMessages(string $providerCode, string $providerMessage, VideoGenerateErrorCode $expected): void
    {
        self::assertSame(
            $expected,
            ProviderVideoErrorMapper::resolveGemini($this->requestException(400, [
                'error' => [
                    'code' => $providerCode,
                    'message' => $providerMessage,
                ],
            ])),
        );
    }

    /**
     * @return iterable<string, array{string, string, VideoGenerateErrorCode}>
     */
    public static function geminiMessageMap(): iterable
    {
        yield 'duration mismatch' => [
            'invalid_request',
            'Edited video duration (4.958s, rounded to 1st decimal: 5s) does not match config duration (3s, rounded to 1st decimal: 3s).',
            VideoGenerateErrorCode::INVALID_PARAMETER,
        ];
        yield 'real people likeness blocked' => [
            'content_blocked',
            "Input blocked: Sorry, we can't create videos with real people's names or likenesses.",
            VideoGenerateErrorCode::INPUT_TEXT_AUDIT_FAILED,
        ];
        yield 'http video input unsupported' => [
            'invalid_request',
            'HTTP video input is not supported by the model.',
            VideoGenerateErrorCode::INVALID_PARAMETER,
        ];
        yield 'filtered output video' => [
            'Unable to show the generated video. The video was filtered out because it violated policy.',
            'Request blocked due to prohibited content guidelines.',
            VideoGenerateErrorCode::OUTPUT_VIDEO_AUDIT_FAILED,
        ];
        yield 'non-positive duration' => [
            'invalid_request',
            'Video response format duration must be positive.',
            VideoGenerateErrorCode::INVALID_PARAMETER,
        ];
    }

    public function testGeminiResolverAcceptsAsyncResponseArray(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::INVALID_PARAMETER,
            ProviderVideoErrorMapper::resolveGemini(null, [
                'error' => [
                    'code' => 'invalid_request',
                    'message' => 'Video response format duration must be positive.',
                ],
            ]),
        );
    }

    public function testResolversIgnoreNonJsonResponseBodies(): void
    {
        self::assertSame(
            VideoGenerateErrorCode::GENERAL_ERROR,
            ProviderVideoErrorMapper::resolveGemini($this->requestException(500, [], 'upstream unavailable')),
        );
        self::assertSame(
            VideoGenerateErrorCode::GENERAL_ERROR,
            ProviderVideoErrorMapper::resolveDashScope(null, 'upstream unavailable'),
        );
    }

    public function testVideoErrorCodeResolvesLocalizedMessage(): void
    {
        self::assertSame('视频生成失败，请检查输入内容或稍后重试。', VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
    }

    public function testProviderExceptionKeepsSafeMessageAndOptionalErrorCode(): void
    {
        $exception = new ProviderVideoException(
            VideoGenerateErrorCode::INVALID_PROMPT,
            '视频提示词未通过内容审核，请调整后重试。',
            $this->requestException(400, []),
        );

        self::assertSame('视频提示词未通过内容审核，请调整后重试。', $exception->getMessage());
        self::assertSame((string) VideoGenerateErrorCode::INVALID_PROMPT->value, $exception->getErrorCode());
        self::assertSame(400, $exception->getHttpStatus());
        self::assertFalse($exception->isRetry());
    }

    /** @param array<string, mixed> $payload */
    private function requestException(int $status, array $payload, ?string $body = null): RequestException
    {
        return new RequestException(
            'provider raw message',
            new Request('POST', 'https://provider.example/video'),
            new Response($status, [], $body ?? json_encode($payload, JSON_THROW_ON_ERROR)),
        );
    }
}
