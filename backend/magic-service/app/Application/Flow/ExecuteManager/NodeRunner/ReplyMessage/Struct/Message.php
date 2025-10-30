<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct;

use App\Domain\Chat\DTO\Message\MessageInterface;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;

class Message
{
    private array $message;

    private string $id = '';

    private string $conversationId;

    private string $errorInformation;

    private ?MessageInterface $IMMessage;

    private ?ChatCompletionChoice $choice = null;

    private string $version;

    private int $time;

    public function __construct(array $message, string $conversationId, ?MessageInterface $IMMessage = null, string $version = 'v0')
    {
        $this->time = time();
        $this->message = $message;
        $this->conversationId = $conversationId;
        $this->IMMessage = $IMMessage;
        $this->version = $version;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getMessage(): array
    {
        return $this->message;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function getErrorInformation(): string
    {
        return $this->errorInformation;
    }

    public function setErrorInformation(string $errorInformation): void
    {
        $this->errorInformation = $errorInformation;
    }

    public function getIMMessage(): ?MessageInterface
    {
        return $this->IMMessage;
    }

    public function setChoice(?ChatCompletionChoice $choice): void
    {
        $this->choice = $choice;
    }

    public function toSteamResponse(string $event): string
    {
        $message = $this->message;
        $message['role'] = 'assistant';
        switch ($this->version) {
            case 'v1':
                $data = match ($event) {
                    'start' => [
                        'choices' => [],
                        'created' => $this->time,
                        'id' => $this->id,
                        'model' => 'magic',
                        'object' => 'flow',
                        'prompt_filter_results' => [],
                    ],
                    'message' => [
                        'choices' => [
                            [
                                'content_filter_results' => [],
                                'finish_reason' => $this->choice?->getFinishReason(),
                                'index' => $this->choice?->getIndex(),
                                'logprobs' => $this->choice?->getLogprobs(),
                                'delta' => $this->choice?->getMessage()?->toArray() ?? $message,
                            ],
                        ],
                        'created' => $this->time,
                        'id' => $this->id,
                        'model' => 'magic',
                        'object' => 'flow',
                    ],
                    default => [],
                };
                break;
            default:
                $data = [
                    'id' => $this->id,
                    'event' => $event,
                    'conversation_id' => $this->conversationId,
                    'message' => $message,
                ];
                if (isset($this->errorInformation)) {
                    $data['error_information'] = $this->errorInformation;
                }
        }

        return 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    }

    public function toApiResponse(): array
    {
        $message = $this->message;
        $message['role'] = 'assistant';

        $data = match ($this->version) {
            'v1' => [
                'choices' => [
                    [
                        'content_filter_results' => [],
                        'finish_reason' => 'stop',
                        'index' => 0,
                        'logprobs' => null,
                        'message' => $message,
                    ],
                ],
                'created' => $this->time,
                'id' => $this->id,
                'model' => 'magic',
                'object' => 'flow',
                'usage' => null,
            ],
            default => [
                'id' => $this->id,
                'message' => $message,
            ],
        };
        if (isset($this->errorInformation)) {
            $data['error_information'] = $this->errorInformation;
        }

        return $data;
    }

    public function replaceAttachmentUrl(bool $markdownImageFormat = false): void
    {
        if (! $this->IMMessage) {
            return;
        }
        /* @phpstan-ignore-next-line */
        if (! method_exists($this->IMMessage, 'getContent')) {
            return;
        }
        $content = $this->IMMessage->getContent();
        $handler = di(MessageAttachmentHandlerInterface::class);
        $content = $handler->handle($content, $markdownImageFormat);

        if (! method_exists($this->IMMessage, 'setContent')) {
            return;
        }
        $this->IMMessage->setContent($content);
        $this->message = $this->IMMessage->toArray();
    }
}
