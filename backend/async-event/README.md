# Eventi Asincroni ⏰

- Gli eventi verranno inseriti in una coroutine, poi eseguiti in ordine
- Il codice core è `\Dtyq\AsyncEvent\AsyncEventDispatcher::dispatch`

## 📦 Installazione
- Installazione
```
composer require dtyq/async-event
```
- Pubblicare configurazione
```
php bin/hyperf.php vendor:publish dtyq/async-event
```
- Eseguire migrazione database
```
php bin/hyperf.php migrate
```

## 🚀 Modalità d'Uso

- Per non influenzare la logica esistente, utilizzare il nuovo dispatcher

demo
```php
<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Controller;

use App\Event\DemoEvent;
use Hyperf\Di\Annotation\Inject;
use Dtyq\AsyncEvent\AsyncEventDispatcher;

class IndexController extends AbstractController
{
    /**
     * @Inject()
     */
    protected AsyncEventDispatcher $asyncEventDispatcher;

    public function index()
    {
        $user = $this->request->input('user', 'Hyperf');
        $method = $this->request->getMethod();

        $this->asyncEventDispatcher->dispatch(new DemoEvent([123,222], 9));

        return [
            'method' => $method,
            'message' => "Hello {$user}.",
        ];
    }
}

```

- Raggiunto il numero massimo di esecuzioni, è possibile effettuare notifiche di messaggio, ma è necessario aggiungere la configurazione personalmente, questo progetto fornisce solo l'evento di raggiungimento del massimo tentativo di retry


## ⚠️ Note Importanti

- Negli eventi cercare di non utilizzare il contesto della coroutine per passare dati, perché gli eventi sono asincroni, potrebbero causare inconsistenza dei dati

---

# 异步事件

- 事件将会放到一个协程中，然后按照顺序执行  
- 核心代码为`\Dtyq\AsyncEvent\AsyncEventDispatcher::dispatch`

## 安装
- 安装
```
composer require dtyq/async-event
```
- 发布配置
```
php bin/hyperf.php vendor:publish dtyq/async-event
```
- 运行数据库迁移
```
php bin/hyperf.php migrate
```

## 使用方式

- 为了不影响原有逻辑，采用新的dispatcher即可

demo
```php
<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
 
namespace App\Controller;

use App\Event\DemoEvent;
use Hyperf\Di\Annotation\Inject;
use Dtyq\AsyncEvent\AsyncEventDispatcher;

class IndexController extends AbstractController
{
    /**
     * @Inject()
     */
    protected AsyncEventDispatcher $asyncEventDispatcher;

    public function index()
    {
        $user = $this->request->input('user', 'Hyperf');
        $method = $this->request->getMethod();

        $this->asyncEventDispatcher->dispatch(new DemoEvent([123,222], 9));

        return [
            'method' => $method,
            'message' => "Hello {$user}.",
        ];
    }
}

```

- 达到最大执行次数，可以进行消息提醒，但是需要自己增加配置，本项目仅提供达到最大重试事件


## 注意事项

- 事件中尽量不要使用协程上下文来传递数据，因为事件是异步的，可能会导致数据不一致
