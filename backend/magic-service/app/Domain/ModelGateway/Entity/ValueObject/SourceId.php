<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

final class SourceId
{
    public const string RENAME_TOPIC = 'rename_topic';

    public const string SUMMARY_CONTENT = 'summary_content';

    public const string CHAT_COMPLETIONS = 'chat_completions';

    public const string CONVERSATION_CHAT_COMPLETION = 'conversation_chat_completion';

    public const string FRAGMENT_SAVED = 'fragment_saved';

    public const string KNOWLEDGE_EMBEDDING_TEST = 'knowledge_embedding_test';

    public const string KNOWLEDGE_EMBEDDING_MODEL_DIMENSION_PROBE = 'knowledge_embedding_model_dimension_probe';

    public const string SUPER_MAGIC = 'super_magic';

    public const string SUPER_MAGIC_AGENT_OPTIMIZER = 'super_magic_agent_optimizer';

    public const string SUPER_MAGIC_TEST_SG = 'super-magic-test-sg';

    public const string SEMANTIC_SEARCH = 'semantic_search';

    public const string API_PLATFORM = 'api_platform';

    public const string IMAGE_GENERATE = 'image_generate';

    public const string CONNECTIVITY_TEST = 'connectivity_test';

    public const string AI_SEARCH = 'ai_search';

    public const string FOLLOW_UP_SUGGESTIONS = 'follow_up_suggestions';

    public const string AI_ABILITY_CONNECTIVITY_TEST = 'ai_ability_connectivity_test';

    public const array NON_BILLING_SOURCE_IDS = [
        self::RENAME_TOPIC,
        self::SUMMARY_CONTENT,
        self::CHAT_COMPLETIONS,
        self::CONVERSATION_CHAT_COMPLETION,
        self::FRAGMENT_SAVED,
        self::KNOWLEDGE_EMBEDDING_TEST,
        self::KNOWLEDGE_EMBEDDING_MODEL_DIMENSION_PROBE,
        self::SUPER_MAGIC_AGENT_OPTIMIZER,
        self::SUPER_MAGIC_TEST_SG,
        self::SEMANTIC_SEARCH,
        self::API_PLATFORM,
        self::FOLLOW_UP_SUGGESTIONS,
        self::AI_ABILITY_CONNECTIVITY_TEST,
    ];

    public static function isNonBilling(string $sourceId): bool
    {
        return in_array($sourceId, self::NON_BILLING_SOURCE_IDS, true);
    }
}
