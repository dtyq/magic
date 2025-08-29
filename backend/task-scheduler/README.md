# dtyq/task-scheduler

## 📦 Installazione
```
composer require dtyq/task-scheduler
php bin/hyperf.php vendor:publish dtyq/task-scheduler
```

## 🚀 Utilizzo
Vedere il servizio:
```
\Dtyq\TaskScheduler\Service\TaskSchedulerDomainService
```

## 📋 Spiegazione
> ⚠️ Supporta solo chiamate a livello di minuti

### Metodi di schedulazione
1. ⏰ Schedulazione programmata
2. 🎯 Schedulazione specifica

### Creazione di task schedulati
1. La schedulazione programmata richiede un timer per generare i dati dei task da eseguire nelle prossime n ore
2. Generare task di schedulazione basati sul tempo del task

### Esecuzione dei task
1. Eseguire i task scaduti, cambiare lo stato, se ci sono errori eseguire l'evento di errore
2. Dopo la fine della schedulazione, registrare nella tabella di archivio

### Esecuzione in background
1. Ogni giorno controllare i task di schedulazione completati oltre n giorni, eliminarli. Prevenire che la tabella di schedulazione diventi troppo grande
2. Ogni minuto controllare i task da eseguire nei prossimi n giorni, generare task di schedulazione
3. Ogni minuto controllare i task scaduti, eseguire

### Database
1. Tabella di schedulazione task (task_scheduler) utilizzata per i record dei task specifici da eseguire
2. Tabella di archivio task (task_scheduler_log) utilizzata per salvare i record dei task completati, solo per archivio, per facilitare la visualizzazione della cronologia futura
3. Tabella dei task programmati (task_scheduler_crontab) utilizzata per salvare le regole dei task programmati

## 🛠️ Ricordati di creare la struttura delle tabelle
```shell
php bin/hyperf.php migrate
```

```sql
-- auto-generated definition
create table task_scheduler
(
    id              bigint unsigned         not null primary key,
    external_id     varchar(64)             not null comment 'ID business',
    name            varchar(64)             not null comment 'Nome',
    expect_time     datetime                not null comment 'Tempo di esecuzione previsto',
    actual_time     datetime                null comment 'Tempo di esecuzione effettivo',
    type            tinyint      default 2  not null comment 'Tipo di schedulazione: 1 schedulazione programmata, 2 schedulazione specifica',
    cost_time       int          default 0  not null comment 'Tempo impiegato millisecondi',
    retry_times     int          default 0  not null comment 'Tentativi rimanenti',
    status          tinyint      default 0  not null comment 'Stato',
    callback_method json                    not null comment 'Metodo di callback',
    callback_params json                    not null comment 'Parametri di callback',
    remark          varchar(255) default '' not null comment 'Nota',
    creator         varchar(64)  default '' not null comment 'Creatore',
    created_at      datetime                not null comment 'Tempo di creazione'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_external_id_index
    on task_scheduler (external_id);

create index task_scheduler_status_expect_time_index
    on task_scheduler (status, expect_time);

-- auto-generated definition
create table task_scheduler_crontab
(
    id              bigint unsigned         not null primary key,
    name            varchar(64)             not null comment 'Nome',
    crontab         varchar(64)             not null comment 'Espressione crontab',
    last_gen_time   datetime                null comment 'Ultimo tempo di generazione',
    enabled         tinyint(1)   default 1  not null comment 'Se abilitato',
    retry_times     int          default 0  not null comment 'Totale tentativi',
    callback_method json                    not null comment 'Metodo di callback',
    callback_params json                    not null comment 'Parametri di callback',
    remark          varchar(255) default '' not null comment 'Nota',
    creator         varchar(64)  default '' not null comment 'Creatore',
    created_at      datetime                not null comment 'Tempo di creazione'
)
    collate = utf8mb4_unicode_ci;



-- auto-generated definition
-- auto-generated definition
create table task_scheduler_log
(
    id              bigint unsigned         not null primary key,
    task_id         bigint unsigned         not null comment 'ID task',
    external_id     varchar(64)             not null comment 'Identificatore business',
    name            varchar(64)             not null comment 'Nome',
    expect_time     datetime                not null comment 'Tempo di esecuzione previsto',
    actual_time     datetime                null comment 'Tempo di esecuzione effettivo',
    type            tinyint      default 2  not null comment 'Tipo',
    cost_time       int          default 0  not null comment 'Tempo impiegato',
    status          tinyint      default 0  not null comment 'Stato',
    callback_method json                    not null comment 'Metodo di callback',
    callback_params json                    not null comment 'Parametri di callback',
    remark          varchar(255) default '' not null comment 'Nota',
    creator         varchar(64)  default '' not null comment 'Creatore',
    created_at      datetime                not null comment 'Tempo di creazione',
    result          json                    null comment 'Risultato'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_log_external_id_index
    on task_scheduler_log (external_id);

create index task_scheduler_log_status_expect_time_index
    on task_scheduler_log (status, expect_time);

create index task_scheduler_log_task_id_index
    on task_scheduler_log (task_id);
```

---

# dtyq/task-scheduler

## 安装
```
composer require dtyq/task-scheduler
php bin/hyperf.php vendor:publish dtyq/task-scheduler
```

## 使用方式请见
```
\Dtyq\TaskScheduler\Service\TaskSchedulerDomainService
```

## 说明
> 仅支持分钟级调用

调度方式
1. 定时调度
2. 指定调度

创建调度任务
1. 定时调度需要有个定时器去生成未来 n 小时内的需要执行的任务数据
2. 根据任务时间生成调度任务

执行任务
1. 执行已到时间的任务，改变状态，如果有误则执行报错事件
2. 调度结束后，记录到归档表

后台执行
1. 每天检测超过 n 天已完成的调度任务，删除。防止调度表过大
2. 每分钟检测未来 n 天内需要执行的任务，生成调度任务
3. 每分钟检测已到时间的任务，执行

数据库
1. 任务调度表(task_scheduler) 用于具体执行的任务记录
2. 任务归档表(task_scheduler_log) 用于保存已完成的任务记录，仅做归档，方便以后回档查看历史记录
3. 定时任务表(task_scheduler_crontab) 用于保存定时任务规则

## 记得创建表结构
```shell
php bin/hyperf.php migrate
```

```sql
-- auto-generated definition
create table task_scheduler
(
    id              bigint unsigned         not null primary key,
    external_id     varchar(64)             not null comment '业务 id',
    name            varchar(64)             not null comment '名称',
    expect_time     datetime                not null comment '预期执行时间',
    actual_time     datetime                null comment '实际执行时间',
    type            tinyint      default 2  not null comment '调度类型：1 定时调度，2 指定调度',
    cost_time       int          default 0  not null comment '耗时 毫秒',
    retry_times     int          default 0  not null comment '剩余重试次数',
    status          tinyint      default 0  not null comment '状态',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_external_id_index
    on task_scheduler (external_id);

create index task_scheduler_status_expect_time_index
    on task_scheduler (status, expect_time);

-- auto-generated definition
create table task_scheduler_crontab
(
    id              bigint unsigned         not null primary key,
    name            varchar(64)             not null comment '名称',
    crontab         varchar(64)             not null comment 'crontab表达式',
    last_gen_time   datetime                null comment '最后生成时间',
    enabled         tinyint(1)   default 1  not null comment '是否启用',
    retry_times     int          default 0  not null comment '总重试次数',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间'
)
    collate = utf8mb4_unicode_ci;



-- auto-generated definition
-- auto-generated definition
create table task_scheduler_log
(
    id              bigint unsigned         not null primary key,
    task_id         bigint unsigned         not null comment '任务ID',
    external_id     varchar(64)             not null comment '业务标识',
    name            varchar(64)             not null comment '名称',
    expect_time     datetime                not null comment '预期执行时间',
    actual_time     datetime                null comment '实际执行时间',
    type            tinyint      default 2  not null comment '类型',
    cost_time       int          default 0  not null comment '耗时',
    status          tinyint      default 0  not null comment '状态',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间',
    result          json                    null comment '结果'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_log_external_id_index
    on task_scheduler_log (external_id);

create index task_scheduler_log_status_expect_time_index
    on task_scheduler_log (status, expect_time);

create index task_scheduler_log_task_id_index
    on task_scheduler_log (task_id);
```
