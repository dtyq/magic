<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class TextContentCompletionAppService extends DesignAppService
{
    private const string TOOL_NAME = 'complete_text_content';

    private const int MAX_TEXT_LENGTH = 4000;

    private const int MAX_TEXT_COMPLETION_ATTEMPTS = 3;

    protected readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('TextContentCompletionAppService');
    }

    /**
     * 根据前端组装的场景提示词，优化一段可直接写回画布文本元素的正文。
     */
    public function complete(
        Authenticatable $authenticatable,
        int $projectId,
        string $userPrompt,
        ?string $modelId = null,
    ): string {
        $dataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.text_content_completion.project_not_exists', ['project_id' => $projectId]);
        }
        $this->validateRoleHigherOrEqual($dataIsolation, $project, MemberRole::VIEWER);

        $agentFilePath = BASE_PATH . '/app/Application/Design/MicroAgent/TextContentCompleter.agent.yaml';
        $baseTextCompleterAgent = clone $this->microAgentFactory->getAgent('TextContentCompleter', $agentFilePath);
        if (! $baseTextCompleterAgent->isEnabled()) {
            $this->logger->warning('Text content completer agent is disabled', ['project_id' => $projectId]);
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.text_content_completion.agent_disabled');
        }
        $baseTextCompleterAgent->setTools($this->getTextContentCompletionTools());

        $textCompleterAgent = clone $baseTextCompleterAgent;
        $modelId = trim((string) $modelId);
        if ($modelId !== '') {
            $textCompleterAgent->setModelId($modelId);
        }

        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($dataIsolation);

        if ($modelId !== '') {
            try {
                return $this->requestTextCompletionWithRetry(
                    $textCompleterAgent,
                    $modelGatewayDataIsolation,
                    $dataIsolation,
                    $projectId,
                    $userPrompt,
                    1
                );
            } catch (Throwable $throwable) {
                $this->logger->warning('TextContentCompletionModelOverrideFailed', [
                    'error' => $throwable->getMessage(),
                    'project_id' => $projectId,
                    'model_id' => $modelId,
                ]);
            }

            try {
                return $this->requestTextCompletionWithRetry(
                    $baseTextCompleterAgent,
                    $modelGatewayDataIsolation,
                    $dataIsolation,
                    $projectId,
                    $userPrompt
                );
            } catch (Throwable $throwable) {
                $this->logger->error('TextContentCompletionFallbackFailed', [
                    'error' => $throwable->getMessage(),
                    'project_id' => $projectId,
                    'model_id' => $baseTextCompleterAgent->getModelId(),
                ]);
                return '';
            }
        }

        try {
            return $this->requestTextCompletionWithRetry(
                $baseTextCompleterAgent,
                $modelGatewayDataIsolation,
                $dataIsolation,
                $projectId,
                $userPrompt
            );
        } catch (Throwable $throwable) {
            $this->logger->error('TextContentCompletionFailed', [
                'error' => $throwable->getMessage(),
                'project_id' => $projectId,
                'model_id' => $baseTextCompleterAgent->getModelId(),
            ]);
            ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.text_content_completion.failed');
        }
    }

    private function buildUserMessage(string $userPrompt, string $retryCorrectionPrompt = ''): UserMessage
    {
        $userMessage = new UserMessage();
        $userMessage->addContent(UserMessageContent::text(trim($userPrompt)));
        if ($retryCorrectionPrompt !== '') {
            $userMessage->addContent(UserMessageContent::text($retryCorrectionPrompt));
        }

        return $userMessage;
    }

    private function requestTextCompletion(
        MicroAgent $textCompleterAgent,
        ModelGatewayDataIsolation $modelGatewayDataIsolation,
        DesignDataIsolation $dataIsolation,
        int $projectId,
        UserMessage $userMessage,
    ): ChatCompletionResponse {
        return $textCompleterAgent->easyCall(
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
                'source_id' => SourceId::DESIGN_TEXT_CONTENT_COMPLETION,
            ]
        );
    }

    private function requestTextCompletionWithRetry(
        MicroAgent $textCompleterAgent,
        ModelGatewayDataIsolation $modelGatewayDataIsolation,
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $userPrompt,
        int $maxAttempts = self::MAX_TEXT_COMPLETION_ATTEMPTS,
    ): string {
        $retryCorrectionPrompt = '';
        for ($attempt = 1; $attempt <= $maxAttempts; ++$attempt) {
            $userMessage = $this->buildUserMessage($userPrompt, $retryCorrectionPrompt);
            $response = $this->requestTextCompletion(
                $textCompleterAgent,
                $modelGatewayDataIsolation,
                $dataIsolation,
                $projectId,
                $userMessage
            );
            $this->logTextCompletionRawResponse($response, $textCompleterAgent, $projectId, $attempt, $maxAttempts);
            $extractResult = $this->extractTextFromToolCall($response);
            if ($extractResult['text'] !== '') {
                return $extractResult['text'];
            }

            $this->logger->warning('TextContentCompletionInvalidResponse', [
                'invalid_reason' => $extractResult['invalid_reason'],
                'attempt' => $attempt,
                'max_attempts' => $maxAttempts,
                'project_id' => $projectId,
                'model_id' => $response?->getModel(),
                'tool_names' => $extractResult['tool_names'],
            ]);

            if ($attempt < $maxAttempts) {
                $retryCorrectionPrompt = $this->buildRetryCorrectionPrompt($extractResult['invalid_reason'], $attempt + 1);
            }
        }

        ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.text_content_completion.invalid_response');
    }

    private function logTextCompletionRawResponse(
        ChatCompletionResponse $response,
        MicroAgent $textCompleterAgent,
        int $projectId,
        int $attempt,
        int $maxAttempts,
    ): void {
        $assistantMessage = $response->getFirstChoice()?->getMessage();
        $this->logger->info('TextContentCompletionRawResponse', [
            'attempt' => $attempt,
            'max_attempts' => $maxAttempts,
            'project_id' => $projectId,
            'model_id' => $textCompleterAgent->getModelId(),
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
            'no_assistant_message' => $commonInstruction . ' 上一次返回了空消息；本次不要返回空消息，必须调用 complete_text_content 工具。',
            'no_tool_call' => $commonInstruction . ' 上一次没有调用工具；本次不要直接输出文本，必须调用 complete_text_content 工具。',
            'wrong_tool_name' => $commonInstruction . ' 上一次调用了错误工具；本次只能调用 complete_text_content 工具，不能调用其他工具。',
            'empty_text' => $commonInstruction . ' 上一次 complete_text_content 的 text 参数为空；本次 text 必须是非空字符串，直接放优化后的文本正文。',
            default => $commonInstruction . ' 本次必须调用 complete_text_content 工具，并将非空的优化后文本正文放入 text 参数。',
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getTextContentCompletionTools(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => self::TOOL_NAME,
                    'description' => '返回优化后的画布文本元素正文',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'text' => [
                                'type' => 'string',
                                'description' => '优化后的文本正文，只包含可直接写回画布文本元素的内容，可以包含真实换行',
                            ],
                        ],
                        'required' => ['text'],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array{text: string, invalid_reason: string, tool_names: list<string>}
     */
    private function extractTextFromToolCall(ChatCompletionResponse $response): array
    {
        $assistantMessage = $response->getFirstChoice()?->getMessage();
        if (! $assistantMessage instanceof AssistantMessage) {
            return $this->buildInvalidTextCompletionExtractResult('no_assistant_message');
        }

        if (! $assistantMessage->hasToolCalls()) {
            return $this->buildInvalidTextCompletionExtractResult('no_tool_call');
        }

        $toolNames = [];
        $hasMatchedToolCall = false;
        $hasEmptyText = false;
        foreach ($assistantMessage->getToolCalls() as $toolCall) {
            $toolNames[] = $toolCall->getName();
            if ($toolCall->getName() !== self::TOOL_NAME) {
                continue;
            }

            $hasMatchedToolCall = true;
            $arguments = $toolCall->getArguments();
            $text = $this->sanitizeText((string) ($arguments['text'] ?? ''));
            if ($text === '') {
                $hasEmptyText = true;
                continue;
            }
            return [
                'text' => $text,
                'invalid_reason' => '',
                'tool_names' => $toolNames,
            ];
        }

        return $this->buildInvalidTextCompletionExtractResult($hasMatchedToolCall && $hasEmptyText ? 'empty_text' : 'wrong_tool_name', $toolNames);
    }

    /**
     * @param list<string> $toolNames
     * @return array{text: string, invalid_reason: string, tool_names: list<string>}
     */
    private function buildInvalidTextCompletionExtractResult(string $invalidReason, array $toolNames = []): array
    {
        return [
            'text' => '',
            'invalid_reason' => $invalidReason,
            'tool_names' => $toolNames,
        ];
    }

    private function sanitizeText(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/^```[a-zA-Z0-9_-]*\s*|\s*```$/u', '', $text) ?? $text;
        $text = trim($text);

        $decoded = json_decode($text, true);
        if (is_array($decoded) && isset($decoded['text']) && is_string($decoded['text'])) {
            $text = $decoded['text'];
        }

        $text = preg_replace('/^(优化后文本|文本|content|text)\s*[:：]\s*/iu', '', trim($text)) ?? $text;
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[ \t]+$/m', '', $text) ?? $text;
        $text = $this->trimBoundaryQuotes($text);

        if (mb_strlen($text) > self::MAX_TEXT_LENGTH) {
            return mb_substr($text, 0, self::MAX_TEXT_LENGTH);
        }
        return $text;
    }

    private function trimBoundaryQuotes(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/\A["\'“”‘’]+|["\'“”‘’]+\z/u', '', $text) ?? $text;
        return trim($text);
    }
}
