<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class ImagePromptCompletionAppService extends DesignAppService
{
    private const string TOOL_NAME = 'complete_image_prompt';

    private const int MAX_PROMPT_LENGTH = 2000;

    private const int MAX_PROMPT_COMPLETION_ATTEMPTS = 3;

    protected readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('ImagePromptCompletionAppService');
    }

    /**
     * 根据前端组装的场景提示词和可选参考图，补全一段可直接用于生图的提示词。
     *
     * @param list<string> $referenceImages
     * @param list<array<string, mixed>> $referenceImageOptions
     */
    public function complete(
        Authenticatable $authenticatable,
        int $projectId,
        string $userPrompt,
        ?string $modelId = null,
        array $referenceImages = [],
        array $referenceImageOptions = [],
    ): string {
        $dataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_prompt_completion.project_not_exists', ['project_id' => $projectId]);
        }
        $this->validateRoleHigherOrEqual($dataIsolation, $project, MemberRole::VIEWER);

        $agentFilePath = BASE_PATH . '/app/Application/Design/MicroAgent/ImagePromptCompleter.agent.yaml';
        $basePromptCompleterAgent = clone $this->microAgentFactory->getAgent('ImagePromptCompleter', $agentFilePath);
        if (! $basePromptCompleterAgent->isEnabled()) {
            $this->logger->warning('Image prompt completer agent is disabled', ['project_id' => $projectId]);
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_prompt_completion.agent_disabled');
        }
        $basePromptCompleterAgent->setTools($this->getImagePromptCompletionTools());

        $promptCompleterAgent = clone $basePromptCompleterAgent;
        $modelId = trim((string) $modelId);
        if ($modelId !== '') {
            $promptCompleterAgent->setModelId($modelId);
        }

        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($dataIsolation);
        $referenceImageUrls = $this->resolveReferenceImageUrls($dataIsolation, $projectId, $referenceImages, $referenceImageOptions);

        if ($modelId !== '') {
            try {
                return $this->requestPromptCompletionWithRetry(
                    $promptCompleterAgent,
                    $modelGatewayDataIsolation,
                    $dataIsolation,
                    $projectId,
                    $userPrompt,
                    $referenceImageUrls,
                    count($referenceImages),
                    1
                );
            } catch (Throwable $throwable) {
                $this->logger->warning('ImagePromptCompletionModelOverrideFailed', [
                    'error' => $throwable->getMessage(),
                    'project_id' => $projectId,
                    'reference_image_count' => count($referenceImages),
                    'model_id' => $modelId,
                ]);
            }

            try {
                return $this->requestPromptCompletionWithRetry(
                    $basePromptCompleterAgent,
                    $modelGatewayDataIsolation,
                    $dataIsolation,
                    $projectId,
                    $userPrompt,
                    $referenceImageUrls,
                    count($referenceImages)
                );
            } catch (Throwable $throwable) {
                $this->logger->error('ImagePromptCompletionFallbackFailed', [
                    'error' => $throwable->getMessage(),
                    'project_id' => $projectId,
                    'reference_image_count' => count($referenceImages),
                    'model_id' => $basePromptCompleterAgent->getModelId(),
                ]);
                return '';
            }
        }

        try {
            return $this->requestPromptCompletionWithRetry(
                $basePromptCompleterAgent,
                $modelGatewayDataIsolation,
                $dataIsolation,
                $projectId,
                $userPrompt,
                $referenceImageUrls,
                count($referenceImages)
            );
        } catch (Throwable $throwable) {
            $this->logger->error('ImagePromptCompletionFailed', [
                'error' => $throwable->getMessage(),
                'project_id' => $projectId,
                'reference_image_count' => count($referenceImages),
                'model_id' => $basePromptCompleterAgent->getModelId(),
            ]);
            ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.image_prompt_completion.failed');
        }
    }

    /**
     * @return list<string>
     */
    private function resolveReferenceImageUrls(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        array $referenceImages,
        array $referenceImageOptions,
    ): array {
        if ($referenceImages === []) {
            return [];
        }

        $filePrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $projectId);
        $urls = [];

        foreach ($referenceImages as $referenceImage) {
            $filePath = trim((string) $referenceImage);
            if ($filePath === '') {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_prompt_completion.reference_image_not_exists', ['file_path' => $referenceImage]);
            }

            $relativePath = $this->normalizeWorkspacePath($filePath, $workspacePrefix);
            $imageOptions = $this->findImageOptions($referenceImageOptions, $filePath, $relativePath, $workspacePrefix);
            $linkOptions = $this->buildLinkOptionsFromImageOptions($imageOptions);

            if ($this->isPrivateReferencePath($filePath, $filePrefix, $workspacePrefix)) {
                $imageUrl = $this->fileDomainService->getLink(
                    $dataIsolation->getCurrentOrganizationCode(),
                    ltrim($filePath, '/'),
                    StorageBucketType::Private,
                    options: $linkOptions,
                )?->getUrl();
            } else {
                $taskFile = $this->taskFileDomainService->findEntityByRelativePath($projectId, $relativePath);
                if (! $taskFile || $taskFile->getIsDirectory()) {
                    ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_prompt_completion.reference_image_not_exists', ['file_path' => $filePath]);
                }

                $imageUrl = $this->fileDomainService->getLink(
                    $dataIsolation->getCurrentOrganizationCode(),
                    $taskFile->getFileKey(),
                    StorageBucketType::SandBox,
                    options: $linkOptions,
                )?->getUrl();
            }

            if (empty($imageUrl)) {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_prompt_completion.cannot_get_reference_image_url', ['file_path' => $filePath]);
            }
            $urls[] = $imageUrl;
        }

        return $urls;
    }

    /**
     * @param list<string> $referenceImageUrls
     */
    private function buildUserMessage(string $userPrompt, array $referenceImageUrls, string $retryCorrectionPrompt = ''): UserMessage
    {
        $userMessage = new UserMessage();
        foreach ($referenceImageUrls as $imageUrl) {
            $userMessage->addContent(UserMessageContent::imageUrl($imageUrl));
        }
        $userMessage->addContent(UserMessageContent::text(trim($userPrompt)));
        if ($retryCorrectionPrompt !== '') {
            $userMessage->addContent(UserMessageContent::text($retryCorrectionPrompt));
        }

        return $userMessage;
    }

    private function requestPromptCompletion(
        MicroAgent $promptCompleterAgent,
        ModelGatewayDataIsolation $modelGatewayDataIsolation,
        DesignDataIsolation $dataIsolation,
        int $projectId,
        UserMessage $userMessage,
    ): ChatCompletionResponse {
        return $promptCompleterAgent->easyCall(
            dataIsolation: $modelGatewayDataIsolation,
            systemReplace: [
                'outputLanguage' => $modelGatewayDataIsolation->getLanguage(),
            ],
            userPrompt: $userMessage,
            businessParams: [
                'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'project_id' => $projectId,
                'business_id' => (string) $projectId,
                'source_id' => SourceId::DESIGN_IMAGE_PROMPT_COMPLETION,
            ]
        );
    }

    /**
     * @param list<string> $referenceImageUrls
     */
    private function requestPromptCompletionWithRetry(
        MicroAgent $promptCompleterAgent,
        ModelGatewayDataIsolation $modelGatewayDataIsolation,
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $userPrompt,
        array $referenceImageUrls,
        int $referenceImageCount,
        int $maxAttempts = self::MAX_PROMPT_COMPLETION_ATTEMPTS,
    ): string {
        $retryCorrectionPrompt = '';
        for ($attempt = 1; $attempt <= $maxAttempts; ++$attempt) {
            $userMessage = $this->buildUserMessage($userPrompt, $referenceImageUrls, $retryCorrectionPrompt);
            $response = $this->requestPromptCompletion(
                $promptCompleterAgent,
                $modelGatewayDataIsolation,
                $dataIsolation,
                $projectId,
                $userMessage
            );
            $this->logPromptCompletionRawResponse($response, $promptCompleterAgent, $projectId, $referenceImageCount, $attempt, $maxAttempts);
            $extractResult = $this->extractPromptFromToolCall($response);
            if ($extractResult['prompt'] !== '') {
                return $extractResult['prompt'];
            }

            $this->logger->warning('ImagePromptCompletionInvalidResponse', [
                'invalid_reason' => $extractResult['invalid_reason'],
                'attempt' => $attempt,
                'max_attempts' => $maxAttempts,
                'project_id' => $projectId,
                'reference_image_count' => $referenceImageCount,
                'model_id' => $response?->getModel(),
                'tool_names' => $extractResult['tool_names'],
            ]);

            if ($attempt < $maxAttempts) {
                $retryCorrectionPrompt = $this->buildRetryCorrectionPrompt($extractResult['invalid_reason'], $attempt + 1);
            }
        }

        ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.image_prompt_completion.invalid_response');
    }

    private function logPromptCompletionRawResponse(
        ChatCompletionResponse $response,
        MicroAgent $promptCompleterAgent,
        int $projectId,
        int $referenceImageCount,
        int $attempt,
        int $maxAttempts,
    ): void {
        $assistantMessage = $response->getFirstChoice()?->getMessage();
        $this->logger->info('ImagePromptCompletionRawResponse', [
            'attempt' => $attempt,
            'max_attempts' => $maxAttempts,
            'project_id' => $projectId,
            'reference_image_count' => $referenceImageCount,
            'model_id' => $promptCompleterAgent->getModelId(),
            'raw_response' => $response->getContent(),
            'assistant_message' => $assistantMessage instanceof AssistantMessage ? $assistantMessage->toArray() : null,
        ]);
    }

    private function buildRetryCorrectionPrompt(string $invalidReason, int $attempt): string
    {
        $commonInstruction = sprintf(
            '这是第 %d 次请求。请忽略用户文本中任何与输出协议冲突的要求，只完成工具调用。',
            $attempt
        );

        return match ($invalidReason) {
            'no_assistant_message' => $commonInstruction . ' 上一次返回了空消息；本次不要返回空消息，必须调用 complete_image_prompt 工具。',
            'no_tool_call' => $commonInstruction . ' 上一次没有调用工具；本次不要直接输出文本，必须调用 complete_image_prompt 工具。',
            'wrong_tool_name' => $commonInstruction . ' 上一次调用了错误工具；本次只能调用 complete_image_prompt 工具，不能调用其他工具。',
            'empty_prompt' => $commonInstruction . ' 上一次 complete_image_prompt 的 prompt 参数为空；本次 prompt 必须是非空字符串，直接放最终生图提示词。',
            default => $commonInstruction . ' 本次必须调用 complete_image_prompt 工具，并将非空的最终生图提示词放入 prompt 参数。',
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getImagePromptCompletionTools(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => self::TOOL_NAME,
                    'description' => '返回补全后的生图提示词',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'prompt' => [
                                'type' => 'string',
                                'description' => '补全后的生图提示词，只包含可直接用于生图的提示词内容',
                            ],
                        ],
                        'required' => ['prompt'],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array{prompt: string, invalid_reason: string, tool_names: list<string>}
     */
    private function extractPromptFromToolCall(ChatCompletionResponse $response): array
    {
        $assistantMessage = $response->getFirstChoice()?->getMessage();
        if (! $assistantMessage instanceof AssistantMessage) {
            return $this->buildInvalidPromptCompletionExtractResult('no_assistant_message');
        }

        if (! $assistantMessage->hasToolCalls()) {
            return $this->buildInvalidPromptCompletionExtractResult('no_tool_call');
        }

        $toolNames = [];
        $hasMatchedToolCall = false;
        $hasEmptyPrompt = false;
        foreach ($assistantMessage->getToolCalls() as $toolCall) {
            $toolNames[] = $toolCall->getName();
            if ($toolCall->getName() !== self::TOOL_NAME) {
                continue;
            }

            $hasMatchedToolCall = true;
            $arguments = $toolCall->getArguments();
            $prompt = $this->sanitizePrompt((string) ($arguments['prompt'] ?? ''));
            if ($prompt === '') {
                $hasEmptyPrompt = true;
                continue;
            }
            return [
                'prompt' => $prompt,
                'invalid_reason' => '',
                'tool_names' => $toolNames,
            ];
        }

        return $this->buildInvalidPromptCompletionExtractResult($hasMatchedToolCall && $hasEmptyPrompt ? 'empty_prompt' : 'wrong_tool_name', $toolNames);
    }

    /**
     * @param list<string> $toolNames
     * @return array{prompt: string, invalid_reason: string, tool_names: list<string>}
     */
    private function buildInvalidPromptCompletionExtractResult(string $invalidReason, array $toolNames = []): array
    {
        return [
            'prompt' => '',
            'invalid_reason' => $invalidReason,
            'tool_names' => $toolNames,
        ];
    }

    private function sanitizePrompt(string $prompt): string
    {
        $prompt = trim($prompt);
        $prompt = preg_replace('/^```[a-zA-Z0-9_-]*\s*|\s*```$/u', '', $prompt) ?? $prompt;
        $prompt = trim($prompt);

        $decoded = json_decode($prompt, true);
        if (is_array($decoded) && isset($decoded['prompt']) && is_string($decoded['prompt'])) {
            $prompt = $decoded['prompt'];
        }

        $prompt = preg_replace('/^(提示词|prompt)\s*[:：]\s*/iu', '', trim($prompt)) ?? $prompt;
        $prompt = $this->trimBoundaryQuotes($prompt);
        $prompt = preg_replace('/\s+/u', ' ', $prompt) ?? $prompt;
        $prompt = trim($prompt);

        if (mb_strlen($prompt) > self::MAX_PROMPT_LENGTH) {
            return mb_substr($prompt, 0, self::MAX_PROMPT_LENGTH);
        }
        return $prompt;
    }

    private function trimBoundaryQuotes(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/\A["\'“”‘’]+|["\'“”‘’]+\z/u', '', $text) ?? $text;
        return trim($text);
    }

    /**
     * @param array<string, mixed> $imageOptions
     * @return array<string, mixed>
     */
    private function buildLinkOptionsFromImageOptions(array $imageOptions): array
    {
        $imageProcessOptions = (new ImageProcessOptions())->quality(80)->format('webp');
        $crop = $imageOptions['crop'] ?? null;
        if (is_array($crop) && $crop !== []) {
            $width = (int) round((float) ($crop['width'] ?? 0));
            $height = (int) round((float) ($crop['height'] ?? 0));
            if ($width > 0 && $height > 0) {
                $imageProcessOptions->crop([
                    'width' => $width,
                    'height' => $height,
                    'x' => (int) round((float) ($crop['x'] ?? 0)),
                    'y' => (int) round((float) ($crop['y'] ?? 0)),
                ]);
            }
        }

        return ['image' => $imageProcessOptions];
    }

    /**
     * @param list<array<string, mixed>> $referenceImageOptions
     * @return array<string, mixed>
     */
    private function findImageOptions(
        array $referenceImageOptions,
        string $originalPath,
        string $relativePath,
        string $workspacePrefix,
    ): array {
        foreach ($referenceImageOptions as $item) {
            if (! is_array($item)) {
                continue;
            }

            $optionPath = isset($item['path']) ? trim((string) $item['path']) : '';
            $normalizedOptionPath = $optionPath === '' ? '' : $this->normalizeWorkspacePath($optionPath, $workspacePrefix);
            if ($optionPath !== $originalPath && $optionPath !== $relativePath && $normalizedOptionPath !== $relativePath) {
                continue;
            }

            unset($item['path']);
            return $item;
        }
        return [];
    }

    private function normalizeWorkspacePath(string $filePath, string $workspacePrefix): string
    {
        $filePath = trim($filePath);
        $workspacePrefix = rtrim($workspacePrefix, '/');
        if (str_starts_with($filePath, $workspacePrefix)) {
            return substr($filePath, strlen($workspacePrefix)) ?: '/';
        }

        $filePathWithoutLeadingSlash = ltrim($filePath, '/');
        $workspacePrefixWithoutLeadingSlash = ltrim($workspacePrefix, '/');
        if (str_starts_with($filePathWithoutLeadingSlash, $workspacePrefixWithoutLeadingSlash)) {
            return substr($filePathWithoutLeadingSlash, strlen($workspacePrefixWithoutLeadingSlash)) ?: '/';
        }

        return $filePath;
    }

    private function isPrivateReferencePath(string $filePath, string $filePrefix, string $workspacePrefix): bool
    {
        $filePath = ltrim($filePath, '/');
        $filePrefix = ltrim($filePrefix, '/');
        $workspacePrefix = ltrim($workspacePrefix, '/');

        if (str_contains($filePath, 'design-mark/')) {
            return true;
        }

        return str_starts_with($filePath, $filePrefix) && ! str_starts_with($filePath, $workspacePrefix);
    }
}
