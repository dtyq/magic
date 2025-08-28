# Tiptap per PHP - Editor di Testo Ricco 🚀
[![Ultima Versione su Packagist](https://img.shields.io/packagist/v/ueberdosis/tiptap-php.svg?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![Stato Test GitHub](https://github.com/ueberdosis/tiptap-php/actions/workflows/run-tests.yml/badge.svg)](https://github.com/ueberdosis/tiptap-php/actions/workflows/run-tests.yml)
[![Download Totali](https://img.shields.io/packagist/dt/ueberdosis/tiptap-php.svg?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![Licenza](https://img.shields.io/packagist/l/ueberdosis/tiptap-php?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![Chat](https://img.shields.io/badge/chat-su%20discord-7289da.svg?sanitize=true)](https://discord.gg/WtJ49jGshW)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub)](https://github.com/sponsors/ueberdosis)

Un pacchetto PHP per lavorare con contenuti [Tiptap](https://tiptap.dev/). Puoi trasformare JSON compatibile con Tiptap in HTML, e viceversa, sanificare i tuoi contenuti, o semplicemente modificarli.

## Installazione
Puoi installare il pacchetto tramite composer:

```bash
composer require ueberdosis/tiptap-php
```

## Utilizzo
Il pacchetto PHP imita gran parte del pacchetto JavaScript. Se conosci Tiptap, la sintassi PHP ti sembrerà familiare.

### Converti HTML Tiptap in JSON
Iniziamo convertendo uno snippet HTML in un array PHP con struttura compatibile Tiptap:

```php
(new \Tiptap\Editor)
    ->setContent('<p>Testo Esempio</p>')
    ->getDocument();

// Restituisce:
// ['type' => 'doc', 'content' => …]
```

Puoi ottenere anche una stringa JSON in PHP.

```php
(new \Tiptap\Editor)
    ->setContent('<p>Testo Esempio</p>')
    ->getJSON();

// Restituisce:
// {"type": "doc", "content": …}
```

### Converti JSON Tiptap in HTML
L'altra direzione funziona altrettanto bene. Basta passare una stringa JSON o un array PHP per generare l'HTML.

```php
(new \Tiptap\Editor)
    ->setContent([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Testo Esempio',
                    ],
                ]
            ]
        ],
    ])
    ->getHTML();

// Restituisce:
// <h1>Testo Esempio</h1>
```

Questo non aderisce completamente allo schema ProseMirror. Alcune cose sono supportate troppo, ad esempio i segni non sono consentiti in un `CodeBlock`.

Se hai bisogno di un migliore supporto schema, crea un issue con la funzionalità che ti manca.

### Evidenziazione sintassi per blocchi di codice con [highlight.php](https://github.com/scrivo/highlight.php)
L'estensione `CodeBlock` predefinita non aggiunge evidenziazione sintassi ai tuoi blocchi di codice. Tuttavia, se vuoi aggiungere evidenziazione sintassi ai tuoi blocchi di codice, c'è un'estensione speciale `CodeBlockHighlight`.

Sostituire quella predefinita funziona così:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockHighlight(),
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();

// Restituisce:
// <pre><code class="hljs php"><span class="hljs-meta">&lt;?php</span> phpinfo()</code></pre>
```

Questo è ancora senza stile. Devi [caricare un file CSS](https://highlightjs.org/download/) per aggiungere colori all'output, ad esempio così:

```html
<link rel="stylesheet" href="//unpkg.com/@highlightjs/cdn-assets@11.4.0/styles/default.min.css">
```

Boom, evidenziazione sintassi! A proposito, questo è alimentato dall'incredibile [scrivo/highlight.php](https://github.com/scrivo/highlight.php).

### Evidenziazione sintassi per blocchi di codice con [Shiki](https://github.com/shikijs/shiki) (Richiede Node.js)
C'è un evidenziatore di sintassi alternativo che utilizza [Shiki](https://github.com/shikijs/shiki). Shiki è un bellissimo evidenziatore di sintassi alimentato dallo stesso motore linguistico utilizzato da molti editor di codice. Le principali differenze dall'estensione `CodeBlockHighlight` sono: 1) devi installare il pacchetto npm `shiki`, 2) l'evidenziazione del codice Shiki funziona iniettando stili inline quindi non è necessario tirare un file css esterno, 3) puoi usare la maggior parte dei temi VS Code per evidenziare il tuo codice.

Per usare l'estensione Shiki, prima installa il pacchetto npm

```bash
npm install shiki
```

Poi segui l'esempio sotto:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockShiki,
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();
```

Per configurare il tema o il linguaggio predefinito per i blocchi di codice, passa configurazioni aggiuntive nel costruttore come mostrato sotto:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockShiki([
            'theme' => 'github-dark', // default: nord, vedi https://github.com/shikijs/shiki/blob/main/docs/themes.md
            'defaultLanguage' => 'php' // default: html, vedi https://github.com/shikijs/shiki/blob/main/docs/languages.md
            'guessLanguage' => true // default: true, se il linguaggio non è passato, prova a indovinarlo con highlight.php
        ]),
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();
```

Sotto il cofano l'estensione Shiki utilizza [Shiki PHP di Spatie](https://github.com/spatie/shiki-php), quindi consulta la documentazione per dettagli e considerazioni aggiuntive.

### Converti contenuto in testo semplice
Il contenuto può anche essere trasformato in testo semplice, ad esempio per metterlo in un indice di ricerca.

```php
(new \Tiptap\Editor)
    ->setContent('<h1>Titolo</h1><p>Paragrafo</p>')
    ->getText();

// Restituisce:
// "Titolo
//
// Paragrafo"
```

Quello che viene tra i blocchi può essere configurato, anche.

```php
(new \Tiptap\Editor)
    ->setContent('<h1>Titolo</h1><p>Paragrafo</p>')
    ->getText([
        'blockSeparator' => "\n",
    ]);

// Restituisce:
// "Titolo
// Paragrafo"
```

### Sanifica contenuto
Un ottimo caso d'uso per il pacchetto PHP è pulire (o "sanificare") il contenuto. Puoi farlo con il metodo `sanitize()`. Funziona con stringhe JSON, array PHP e HTML.

Restituirà lo stesso formato che stai usando come formato di input.

```php
(new \Tiptap\Editor)
    ->sanitize('<p>Testo Esempio<script>alert("HACKED!")</script></p>');

// Restituisce:
// '<p>Testo Esempio</p>'
```

### Modificare il contenuto
Con il metodo `descendants()` puoi scorrere tutti i nodi ricorsivamente come sei abituato dal pacchetto JavaScript. Ma in PHP, puoi persino modificare il nodo per aggiornare attributi e tutto il resto.

> Avvertimento: Devi aggiungere `&` al parametro. Questo mantiene un riferimento all'elemento originale e permette di modificare quello originale, invece di solo una copia.

```php
$editor->descendants(function (&$node) {
    if ($node->type !== 'heading') {
        return;
    }

    $node->attrs->level = 1;
});
```

### Configurazione
Passa la configurazione al costruttore dell'editor. Non c'è molto da configurare, ma almeno puoi passare il contenuto iniziale e caricare estensioni specifiche.

```php
new \Tiptap\Editor([
    'content' => '<p>Testo Esempio</p>',
    'extensions' => [
        new \Tiptap\Extensions\StarterKit,
    ],
])
```

Il `StarterKit` è caricato per default. Se vuoi usare solo quello, non c'è bisogno di impostarlo.

### Estensioni
Per default, è caricato lo [`StarterKit`](https://tiptap.dev/api/extensions/starter-kit), ma puoi passare un array personalizzato di estensioni.

```php
new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit,
        new \Tiptap\Marks\Link,
    ],
])
```

### Configura estensioni
Alcune estensioni possono essere configurate. Basta passare un array al costruttore, ecco fatto. Miriamo a supportare la stessa configurazione del pacchetto JavaScript.

```php
new \Tiptap\Editor([
    'extensions' => [
        // …
        new \Tiptap\Nodes\Heading([
            'levels' => [1, 2, 3],
        ]),
    ],
])
```

Puoi passare attributi HTML personalizzati attraverso la configurazione, anche.

```php
new \Tiptap\Editor([
    'extensions' => [
        // …
        new \Tiptap\Nodes\Heading([
            'HTMLAttributes' => [
                'class' => 'my-custom-class',
            ],
        ]),
    ],
])
```

Per lo `StarterKit`, è leggermente diverso, ma funziona come sei abituato dal pacchetto JavaScript.

```php
new \Tiptap\Editor([
    'extensions' => [
        new Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
            'heading' => [
                'HTMLAttributes' => [
                    'class' => 'my-custom-class',
                ],
            ]
        ]),
    ],
])
```

### Estendi estensioni esistenti
Se hai bisogno di cambiare piccoli dettagli delle estensioni supportate, puoi semplicemente estendere un'estensione.

```php
<?php

class CustomBold extends \Tiptap\Marks\Bold
{
    public function renderHTML($mark)
    {
        // Rende <b> invece di <strong>
        return ['b', 0]
    }
}

new \Tiptap\Editor([
    'extensions' => [
        new Paragraph,
        new Text,
        new CustomBold,
    ],
])
```

#### Estensioni personalizzate
Puoi persino costruire estensioni personalizzate. Se sei abituato all'API JavaScript, sarai sorpreso di quanto di quello funzioni anche in PHP. 🤯 Dai un'occhiata agli esempi nelle estensioni di questo repository per saperne di più sull'API delle estensioni PHP.

```php
<?php

use Tiptap\Core\Node;

class CustomNode extends Node
{
    public static $name = 'customNode';
    
    public static $priority = 100;

    public function addOptions()
    {
        return [
            'HTMLAttributes' => [],
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'my-custom-tag[data-id]',
            ],
            [
                'tag' => 'my-custom-tag',
                'getAttrs' => function ($DOMNode) {
                    return ! \Tiptap\Utils\InlineStyle::hasAttribute($DOMNode, [
                        'background-color' => '#000000',
                    ]) ? null : false;
                },
            ],
            [
                'style' => 'background-color',
                'getAttrs' => function ($value) {
                    return (bool) preg_match('/^(black)$/', $value) ? null : false;
                },
            ],
        ];
    }

    public function renderHTML($node)
    {
        return ['my-custom-tag', ['class' => 'foobar'], 0]
    }
}
```

#### Priorità delle estensioni

Le estensioni sono valutate nell'ordine di priorità decrescente. Per default, tutti i Nodes, Marks e Extensions hanno un valore di priorità di `100`.

La priorità dovrebbe essere definita quando si crea un'estensione Node per corrispondere al markup che potrebbe essere corrisposto da altri Nodes - un esempio di questo è il [TaskItem Node](src/Nodes/TaskItem.php) che ha priorità di valutazione sul [ListItem Node](src/Nodes/ListItem.php).

## Test
```bash
composer test
```

Puoi installare nodemon (`npm install -g nodemon`) per mantenere la suite di test in esecuzione e guardare i cambiamenti dei file:

```bash
composer test-watch
```

## Contributi
Consulta [CONTRIBUTING](.github/CONTRIBUTING.md) per i dettagli.

## Vulnerabilità di Sicurezza
Consulta [la nostra policy di sicurezza](../../security/policy) su come segnalare vulnerabilità di sicurezza.

## Crediti
- [Hans Pagel](https://github.com/hanspagel)
- [Tutti i Contributori](../../contributors)

## Licenza
La Licenza MIT (MIT). Consulta [File Licenza](LICENSE.md) per maggiori informazioni.

---

<!-- Testo originale (inglese) — mantenuto sotto: -->

# Tiptap for PHP
[![Latest Version on Packagist](https://img.shields.io/packagist/v/ueberdosis/tiptap-php.svg?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![GitHub Tests Action Status](https://github.com/ueberdosis/tiptap-php/actions/workflows/run-tests.yml/badge.svg)](https://github.com/ueberdosis/tiptap-php/actions/workflows/run-tests.yml)
[![Total Downloads](https://img.shields.io/packagist/dt/ueberdosis/tiptap-php.svg?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![License](https://img.shields.io/packagist/l/ueberdosis/tiptap-php?style=flat-square)](https://packagist.org/packages/ueberdosis/tiptap-php)
[![Chat](https://img.shields.io/badge/chat-on%20discord-7289da.svg?sanitize=true)](https://discord.gg/WtJ49jGshW)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub)](https://github.com/sponsors/ueberdosis)

A PHP package to work with [Tiptap](https://tiptap.dev/) content. You can transform Tiptap-compatible JSON to HTML, and the other way around, sanitize your content, or just modify it.

## Installation
You can install the package via composer:

```bash
composer require ueberdosis/tiptap-php
```

## Usage
The PHP package mimics large parts of the JavaScript package. If you know your way around Tiptap, the PHP syntax will feel familiar to you.

### Convert Tiptap HTML to JSON
Let’s start by converting a HTML snippet to a PHP array with a Tiptap-compatible structure:

```php
(new \Tiptap\Editor)
    ->setContent('<p>Example Text</p>')
    ->getDocument();

// Returns:
// ['type' => 'doc', 'content' => …]
```

You can get a JSON string in PHP, too.

```php
(new \Tiptap\Editor)
    ->setContent('<p>Example Text</p>')
    ->getJSON();

// Returns:
// {"type": "doc", "content": …}
```

### Convert Tiptap JSON to HTML
The other way works aswell. Just pass a JSON string or an PHP array to generate the HTML.

```php
(new \Tiptap\Editor)
    ->setContent([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ]
            ]
        ],
    ])
    ->getHTML();

// Returns:
// <h1>Example Text</h1>
```

This doesn’t fully adhere to the ProseMirror schema. Some things are supported too, for example aren’t marks allowed in a `CodeBlock`.

If you need better schema support, create an issue with the feature you’re missing.

### Syntax highlighting for code blocks with [highlight.php](https://github.com/scrivo/highlight.php)
The default `CodeBlock` extension doesn’t add syntax highlighting to your code blocks. However, if you want to add syntax highlighting to your code blocks, there’s a special `CodeBlockHighlight` extension.

Swapping our the default one works like that:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockHighlight(),
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();

// Returns:
// <pre><code class="hljs php"><span class="hljs-meta">&lt;?php</span> phpinfo()</code></pre>
```

This is still unstyled. You need to [load a CSS file](https://highlightjs.org/download/) to add colors to the output, for example like that:

```html
<link rel="stylesheet" href="//unpkg.com/@highlightjs/cdn-assets@11.4.0/styles/default.min.css">
```

Boom, syntax highlighting! By the way, this is powered by the amazing [scrivo/highlight.php](https://github.com/scrivo/highlight.php).

### Syntax highlighting for code blocks with [Shiki](https://github.com/shikijs/shiki) (Requires Node.js)
There is an alternate syntax highlighter that utilizes [Shiki](https://github.com/shikijs/shiki). Shiki is a beautiful syntax highlighter powered by the same language engine that many code editors use. The major differences from the `CodeBlockHighlight` extensions are, 1) you must install the `shiki` npm package, 2) Shiki code highlighting works by injecting inline styles so pulling in a external css file is not required, 3) you can use most VS Code themes to highlight your code.

To use the Shiki extension, first install the npm package

```bash
npm install shiki
```

Then follow the example below:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockShiki,
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();
```

To configure the theme or default language for code blocks pass additonal configuration into the constructor as show below:

```php
(new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
        ]),
        new \Tiptap\Nodes\CodeBlockShiki([
            'theme' => 'github-dark', // default: nord, see https://github.com/shikijs/shiki/blob/main/docs/themes.md
            'defaultLanguage' => 'php' // default: html, see https://github.com/shikijs/shiki/blob/main/docs/languages.md
            'guessLanguage' => true // default: true, if the language isn’t passed, it tries to guess the language with highlight.php
        ]),
    ],
]))
->setContent('<pre><code>&lt;?php phpinfo()</code></pre>')
->getHTML();
```

Under the hood the Shiki extension utilizes [Shiki PHP by Spatie](https://github.com/spatie/shiki-php), so please see the documentation for additional details and considerations.

### Convert content to plain text
Content can also be transformed to plain text, for example to put it into a search index.

```php
(new \Tiptap\Editor)
    ->setContent('<h1>Heading</h1><p>Paragraph</p>')
    ->getText();

// Returns:
// "Heading
//
// Paragraph"
```

What’s coming between blocks can be configured, too.

```php
(new \Tiptap\Editor)
    ->setContent('<h1>Heading</h1><p>Paragraph</p>')
    ->getText([
        'blockSeparator' => "\n",
    ]);

// Returns:
// "Heading
// Paragraph"
```

### Sanitize content
A great use case for the PHP package is to clean (or “sanitize”) the content. You can do that with the `sanitize()` method. Works with JSON strings, PHP arrays and HTML.

It’ll return the same format you’re using as the input format.

```php
(new \Tiptap\Editor)
    ->sanitize('<p>Example Text<script>alert("HACKED!")</script></p>');

// Returns:
// '<p>Example Text</p>'
```

### Modifying the content
With the `descendants()` method you can loop through all nodes recursively as you are used to from the JavaScript package. But in PHP, you can even modify the node to update attributes and all that.

> Warning: You need to add `&` to the parameter. Thats keeping a reference to the original item and allows to modify the original one, instead of just a copy.

```php
$editor->descendants(function (&$node) {
    if ($node->type !== 'heading') {
        return;
    }

    $node->attrs->level = 1;
});
```

### Configuration
Pass the configuration to the constructor of the editor. There’s not much to configure, but at least you can pass the initial content and load specific extensions.

```php
new \Tiptap\Editor([
    'content' => '<p>Example Text</p>',
    'extensions' => [
        new \Tiptap\Extensions\StarterKit,
    ],
])
```

The `StarterKit` is loaded by default. If you just want to use that, there’s no need to set it.

### Extensions
By default, the [`StarterKit`](https://tiptap.dev/api/extensions/starter-kit) is loaded, but you can pass a custom array of extensions aswell.

```php
new \Tiptap\Editor([
    'extensions' => [
        new \Tiptap\Extensions\StarterKit,
        new \Tiptap\Marks\Link,
    ],
])
```

### Configure extensions
Some extensions can be configured. Just pass an array to the constructor, that’s it. We’re aiming to support the same configuration as the JavaScript package.

```php
new \Tiptap\Editor([
    'extensions' => [
        // …
        new \Tiptap\Nodes\Heading([
            'levels' => [1, 2, 3],
        ]),
    ],
])
```

You can pass custom HTML attributes through the configuration, too.

```php
new \Tiptap\Editor([
    'extensions' => [
        // …
        new \Tiptap\Nodes\Heading([
            'HTMLAttributes' => [
                'class' => 'my-custom-class',
            ],
        ]),
    ],
])
```

For the `StarterKit`, it’s slightly different, but works as you are used to from the JavaScript package.

```php
new \Tiptap\Editor([
    'extensions' => [
        new Tiptap\Extensions\StarterKit([
            'codeBlock' => false,
            'heading' => [
                'HTMLAttributes' => [
                    'class' => 'my-custom-class',
                ],
            ]
        ]),
    ],
])
```

### Extend existing extensions
If you need to change minor details of the supported extensions, you can just extend an extension.

```php
<?php

class CustomBold extends \Tiptap\Marks\Bold
{
    public function renderHTML($mark)
    {
        // Renders <b> instead of <strong>
        return ['b', 0]
    }
}

new \Tiptap\Editor([
    'extensions' => [
        new Paragraph,
        new Text,
        new CustomBold,
    ],
])
```

#### Custom extensions
You can even build custom extensions. If you are used to the JavaScript API, you will be surprised how much of that works in PHP, too. 🤯 Find a simple example below.

Make sure to dig through the extensions in this repository to learn more about the PHP extension API.

```php
<?php

use Tiptap\Core\Node;

class CustomNode extends Node
{
    public static $name = 'customNode';
    
    public static $priority = 100;

    public function addOptions()
    {
        return [
            'HTMLAttributes' => [],
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'my-custom-tag[data-id]',
            ],
            [
                'tag' => 'my-custom-tag',
                'getAttrs' => function ($DOMNode) {
                    return ! \Tiptap\Utils\InlineStyle::hasAttribute($DOMNode, [
                        'background-color' => '#000000',
                    ]) ? null : false;
                },
            ],
            [
                'style' => 'background-color',
                'getAttrs' => function ($value) {
                    return (bool) preg_match('/^(black)$/', $value) ? null : false;
                },
            ],
        ];
    }

    public function renderHTML($node)
    {
        return ['my-custom-tag', ['class' => 'foobar'], 0]
    }
}
```

#### Extension priority

Extensions are evaluated in the order of descending priority. By default, all Nodes, Marks, and Extensions, have a priority value of `100`.

Priority should be defined when creating a Node extension to match markup that could be matched be other Nodes - an example of this is the [TaskItem Node](src/Nodes/TaskItem.php) which has evaluation priority over the [ListItem Node](src/Nodes/ListItem.php).

## Testing
```bash
composer test
```

You can install nodemon (`npm install -g nodemon`) to keep the test suite running and watch for file changes:

```bash
composer test-watch
```

## Contributing
Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## Security Vulnerabilities
Please review [our security policy](../../security/policy) on how to report security vulnerabilities.

## Credits
- [Hans Pagel](https://github.com/hanspagel)
- [All Contributors](../../contributors)

## License
The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
