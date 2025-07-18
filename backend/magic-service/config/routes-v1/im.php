<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Chat\Facade\MagicChatHttpApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/im', static function () {
    // Typing completions (conversationId and topicId are not required)
    Router::post('/typing/completions', [MagicChatHttpApi::class, 'typingCompletions']);

    // conversation
    Router::addGroup('/conversations', static function () {
        // Topic list query interface
        Router::post('/{conversationId}/topics/queries', [MagicChatHttpApi::class, 'getTopicList']);
        // Intelligent topic renaming
        Router::put('/{conversationId}/topics/{topicId}/name', [MagicChatHttpApi::class, 'intelligenceGetTopicName']);
        // Conversation list query interface
        Router::post('/queries', [MagicChatHttpApi::class, 'conversationQueries']);
        // Typing completions when chatting in the window
        Router::post('/{conversationId}/completions', [MagicChatHttpApi::class, 'conversationChatCompletions']);
        // Save interaction instructions
        Router::post('/{conversationId}/instructs', [MagicChatHttpApi::class, 'saveInstruct']);

        // Conversation history message scrolling load
        Router::post('/{conversationId}/messages/queries', [MagicChatHttpApi::class, 'messageQueries']);
        // (Temporary solution for frontend performance issues) Get the latest messages of several groups by conversation id.
        Router::post('/messages/queries', [MagicChatHttpApi::class, 'conversationsMessagesGroupQueries']);
    });

    // Message
    Router::addGroup('/messages', static function () {
        // (New device login) Pull the latest messages of the account
        Router::get('', [MagicChatHttpApi::class, 'pullRecentMessage']);
        // Pull all organization messages of the account (supports full sliding window pull)
        Router::get('/page', [MagicChatHttpApi::class, 'pullByPageToken']);
        // Message recipient list
        Router::get('/{messageId}/recipients', [MagicChatHttpApi::class, 'getMessageReceiveList']);
        // Pull message by app_message_id
        Router::post('/app-message-ids/{appMessageId}/queries', [MagicChatHttpApi::class, 'pullByAppMessageId']);
    });

    // File
    Router::addGroup('/files', static function () {
        Router::post('', [MagicChatHttpApi::class, 'fileUpload']);
        Router::post('/download-urls/queries', [MagicChatHttpApi::class, 'getFileDownUrl']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
