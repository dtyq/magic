<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Public;

use App\Application\MCP\Authorization\MCPAuthorizationBindingService;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Contract\ResponseInterface as HttpResponse;
use Hyperf\Logger\LoggerFactory;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * MCP Authorization magic-service 公网回调接口。
 */
class MCPAuthorizationCallbackPublicApi
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly RequestInterface $request,
        private readonly HttpResponse $response,
        private readonly MCPAuthorizationBindingService $bindingService,
        private readonly TranslatorInterface $translator,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('MCPAuthorizationCallbackPublicApi');
    }

    /**
     * 接收授权服务器回调并在 magic-service 内完成 Token 交换和凭据绑定。
     */
    public function callback(): ResponseInterface
    {
        $locale = 'en_US';
        try {
            $locale = $this->resolveLocale($this->bindingService->getPublicCallbackLanguage(
                (string) $this->request->input('state', '')
            ));
        } catch (Throwable) {
            // state 读取失败时使用英文页面，不能影响回调错误页的输出。
        }
        $this->translator->setLocale($locale);

        try {
            $this->bindingService->bindPublic(
                (string) $this->request->input('code', ''),
                (string) $this->request->input('state', ''),
                $this->request->input('iss'),
                $this->request->input('error')
            );
        } catch (Throwable $throwable) {
            $this->logger->error('MCPAuthorizationCallbackPageFailed', [
                'state_hash' => $this->hashValue((string) $this->request->input('state', '')),
                'error_type' => get_class($throwable),
                'error' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
            return $this->response->html($this->renderPage(
                $locale,
                $this->translator->trans('mcp.authorization_callback.title.failure'),
                $this->translator->trans('mcp.authorization_callback.message.failure'),
                $this->translator->trans('mcp.authorization_callback.description.failure'),
                false
            ));
        }

        return $this->response->html($this->renderPage(
            $locale,
            $this->translator->trans('mcp.authorization_callback.title.success'),
            $this->translator->trans('mcp.authorization_callback.message.success'),
            $this->translator->trans('mcp.authorization_callback.description.success'),
            true
        ));
    }

    /**
     * 将 state 中的语种规范化为当前支持的翻译 locale。
     */
    private function resolveLocale(?string $language): string
    {
        $language = str_replace('-', '_', trim((string) $language));
        return match ($language) {
            'zh', 'zh_CN' => 'zh_CN',
            'en', 'en_US' => 'en_US',
            'th', 'th_TH' => 'th_TH',
            'ms', 'ms_MY' => 'ms_MY',
            'vi', 'vi_VN' => 'vi_VN',
            default => 'en_US',
        };
    }

    /**
     * 渲染授权回调结果页面。
     */
    private function renderPage(string $locale, string $title, string $message, string $description, bool $autoClose): string
    {
        $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeDescription = htmlspecialchars($description, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $countdownText = htmlspecialchars(
            $this->translator->trans('mcp.authorization_callback.countdown'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $manualCloseText = htmlspecialchars(
            $this->translator->trans('mcp.authorization_callback.manual_close'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $closeButtonText = htmlspecialchars(
            $this->translator->trans('mcp.authorization_callback.close_button'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $countdownHtml = $autoClose
            ? '<p id="countdown-container" class="countdown"><span id="countdown">10</span>' . $countdownText . '</p>'
                . '<p id="manual-close" hidden>' . $manualCloseText . '</p>'
                . '<button id="close-page" type="button" hidden>' . $closeButtonText . '</button>'
            : '';
        $scriptHtml = $autoClose ? <<<'HTML'
<script>
    let seconds = 10;
    const countdown = document.getElementById('countdown');
    const countdownContainer = document.getElementById('countdown-container');
    const manualClose = document.getElementById('manual-close');
    const closePage = document.getElementById('close-page');
    if (closePage) {
        closePage.addEventListener('click', () => window.close());
    }
    const timer = window.setInterval(() => {
        seconds -= 1;
        if (countdown) {
            countdown.textContent = String(seconds);
        }
        if (seconds <= 0) {
            window.clearInterval(timer);
            window.close();
            window.setTimeout(() => {
                if (countdownContainer) {
                    countdownContainer.hidden = true;
                }
                if (manualClose) {
                    manualClose.hidden = false;
                }
                if (closePage) {
                    closePage.hidden = false;
                }
            }, 100);
        }
    }, 1000);
</script>
HTML : '';

        return <<<HTML
<!doctype html>
<html lang="{$this->toHtmlLanguage($locale)}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{$safeTitle}</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f7f8fa;
            color: #1f2329;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        main {
            width: min(520px, calc(100vw - 48px));
            padding: 32px;
            background: #ffffff;
            border: 1px solid #dee0e3;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(31, 35, 41, 0.08);
            text-align: center;
        }
        h1 {
            margin: 0 0 12px;
            font-size: 24px;
            font-weight: 600;
        }
        p {
            margin: 8px 0 0;
            font-size: 15px;
            line-height: 1.7;
            color: #646a73;
        }
        .countdown {
            margin-top: 16px;
            color: #1f2329;
            font-weight: 500;
        }
        button {
            margin-top: 16px;
            padding: 8px 16px;
            border: 0;
            border-radius: 6px;
            background: #3370ff;
            color: #ffffff;
            cursor: pointer;
        }
    </style>
</head>
<body>
<main>
    <h1>{$safeTitle}</h1>
    <p>{$safeMessage}</p>
    <p>{$safeDescription}</p>
    {$countdownHtml}
</main>
{$scriptHtml}
</body>
</html>
HTML;
    }

    /**
     * 将翻译 locale 转换为 HTML lang 属性格式。
     */
    private function toHtmlLanguage(string $locale): string
    {
        return htmlspecialchars(str_replace('_', '-', $locale), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * 对 state 生成不可逆标识，仅用于日志关联。
     */
    private function hashValue(string $value): string
    {
        return $value === '' ? '' : substr(hash('sha256', $value), 0, 16);
    }
}
