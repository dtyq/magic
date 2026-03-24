<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe;

use App\Application\Chat\Service\FollowUpSuggestionAppService;
use App\Domain\Chat\Event\FollowUpSuggestionGenerateEvent;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener]
#[Listener]
class FollowUpSuggestionGenerateSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FollowUpSuggestionAppService $followUpSuggestionAppService,
        private readonly TranslatorInterface $translator,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            FollowUpSuggestionGenerateEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof FollowUpSuggestionGenerateEvent) {
            return;
        }

        try {
            if (! empty($event->language)) {
                CoContext::setLanguage($event->language);
                $this->translator->setLocale($event->language);
            }

            $dataIsolation = DataIsolation::simpleMake($event->organizationCode, $event->userId);
            $dataIsolation->setLanguage($event->language);

            $this->followUpSuggestionAppService->generateAndPersist(
                $dataIsolation,
                $event->topicId,
                $event->taskId,
            );
        } catch (Throwable $throwable) {
            $this->logger->error('generate follow-up suggestions failed', [
                'topic_id' => $event->topicId,
                'task_id' => $event->taskId,
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}
