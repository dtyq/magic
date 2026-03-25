<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe;

use App\Application\Chat\Service\FollowUpSuggestionAppService;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionType;
use App\Domain\Chat\Repository\Persistence\MagicGeneratedSuggestionRepository;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicMessageSentSuccessEvent;
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
        private readonly MagicGeneratedSuggestionRepository $generatedSuggestionRepository,
        private readonly TranslatorInterface $translator,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            TopicMessageSentSuccessEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof TopicMessageSentSuccessEvent) {
            return;
        }

        try {
            if (! empty($event->getLanguage())) {
                CoContext::setLanguage($event->getLanguage());
                $this->translator->setLocale($event->getLanguage());
            }

            $dataIsolation = DataIsolation::simpleMake($event->getOrganizationCode(), $event->getUserId());
            $dataIsolation->setLanguage($event->getLanguage());
            $this->generatedSuggestionRepository->createGenerating(
                GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP,
                $event->getTopicId(),
                $event->getTaskId(),
                '',
                [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => (string) $event->getTopicId(),
                    'source' => 'super_magic',
                    'generator' => 'follow_up_generator',
                    'language' => $event->getLanguage(),
                ],
                $event->getUserId() !== '' ? $event->getUserId() : null,
            );

            $this->followUpSuggestionAppService->generateAndPersist(
                $dataIsolation,
                $event->getTopicId(),
                $event->getTaskId(),
            );
        } catch (Throwable $throwable) {
            $this->logger->error('generate follow-up suggestions failed', [
                'topic_id' => $event->getTopicId(),
                'task_id' => $event->getTaskId(),
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}
