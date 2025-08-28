# CONTRIBUIRE 🎉

Stai cercando di contribuire a Magic — fantastico, non vediamo l'ora di vedere cosa farai. In quanto startup con risorse limitate, abbiamo grandi ambizioni per costruire le applicazioni LLM più potenti. Qualsiasi aiuto dalla community conta, davvero.

Dobbiamo essere agili e rilasciare velocemente, ma vogliamo anche assicurare che i contributori come te abbiano un'esperienza il più possibile fluida. Abbiamo preparato questa guida alla contribuzione per questo scopo, per farti familiarizzare con il codice e con il modo in cui lavoriamo con i contributori, così potrai passare rapidamente alla parte divertente.

Questa guida, come Magic stesso, è un lavoro in corso. Apprezziamo molto la tua comprensione se a volte è in ritardo rispetto al progetto reale, e accogliamo con favore qualsiasi feedback per migliorare.

Per quanto riguarda la licenza, dedica un minuto a leggere la nostra breve [License and Contributor Agreement](./LICENSE). La community aderisce anche al [code of conduct](https://github.com/dtyq/.github/blob/main/CODE_OF_CONDUCT.md). 📜

## Prima di iniziare 🔎

Cerchi qualcosa da affrontare? Sfoglia le nostre [good first issues](https://github.com/dtyq/magic/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22) e scegli una per iniziare!

Hai una bella idea o una funzionalità da aggiungere? Apri una PR nel nostro [repository principale](https://github.com/dtyq/magic) e mostraci cosa hai costruito.

Devi aggiornare una funzionalità esistente o risolvere dei bug? Apri una PR nel nostro [repository principale](https://github.com/dtyq/magic) e fai accadere la tua magia! ✨

Unisciti al divertimento, contribuisci e costruiamo qualcosa di straordinario insieme! 💡

Non dimenticare di collegare un issue esistente o aprirne uno nuovo nella descrizione della PR.

### Segnalazione bug 🐛

> [! IMPORTANT]
> Assicurati di includere le seguenti informazioni quando invii una segnalazione di bug:

- Un titolo chiaro e descrittivo
- Una descrizione dettagliata del bug, inclusi eventuali messaggi di errore
- Passi per riprodurre il bug
- Comportamento atteso
- **Log**, se disponibili; per problemi backend sono molto importanti, puoi trovarli nei docker-compose logs
- Screenshot o video, se applicabili 📷

Come priorizziamo:

| Tipo di Issue                                                                                 | Priorità        |
| --------------------------------------------------------------------------------------------- | --------------- |
| Bug in funzioni core (servizio cloud, impossibile fare il login, applicazioni non funzionanti, falle di sicurezza) | Critica         |
| Bug non critici, miglioramenti di performance                                                 | Priorità Media  |
| Correzioni minori (refusi, UI confusa ma funzionante)                                         | Bassa Priorità  |

### Richieste di funzionalità ✨

> [! NOTE]
> Assicurati di includere le seguenti informazioni quando invii una richiesta di funzionalità:

- Un titolo chiaro e descrittivo
- Una descrizione dettagliata della funzionalità
- Un caso d'uso per la funzionalità
- Qualsiasi altro contesto o screenshot relativo alla richiesta

Come priorizziamo:

| Tipo di Funzionalità                                                                           | Priorità        |
| --------------------------------------------------------------------------------------------- | --------------- |
| Funzionalità ad alta priorità etichettate da un membro del team                               | Alta Priorità   |
| Richieste popolari dalla nostra [community feedback board](https://github.com/dtyq/magic/discussions/categories/feedbacks) | Priorità Media  |
| Funzionalità non core e miglioramenti minori                                                  | Bassa Priorità  |
| Valide ma non immediate                                                                        | Futuro          |

## Inviare la tua PR 🔧

### Processo di Pull Request

1. Fork del repository
2. Prima di creare una PR, crea un issue per discutere le modifiche che vuoi fare
3. Crea un nuovo branch per le tue modifiche
4. Aggiungi i test per le tue modifiche dove appropriato 🧪
5. Assicurati che il tuo codice passi i test esistenti ✅
6. Collega l'issue nella descrizione della PR, `fixes #<issue_number>`
7. Vieni mergiato! 🚀

### Configurare il progetto

#### Frontend

Per impostare il servizio frontend, fai riferimento alla nostra guida completa nel file `frontend/README.md`: https://github.com/dtyq/magic/blob/main/frontend/README.md. Questo documento fornisce istruzioni dettagliate per configurare correttamente l'ambiente frontend.

#### Backend

Per impostare il servizio backend, fai riferimento alle istruzioni nel file `backend/README.md`: https://github.com/dtyq/magic/blob/main/backend/README.md. Questo documento contiene indicazioni passo passo per avviare il backend senza problemi.

#### Altre note importanti

Ti consigliamo di leggere attentamente questo documento prima di procedere con la configurazione, poiché contiene informazioni essenziali su:
- Prerequisiti e dipendenze
- Passaggi di installazione
- Dettagli di configurazione
- Suggerimenti comuni per il troubleshooting

Sentiti libero di contattarci se incontri problemi durante la configurazione.

## Ottenere aiuto ❓

Se rimani bloccato o hai una domanda urgente mentre contribuisci, invia le tue richieste tramite l'issue GitHub correlato.

---

Testo originale (inglese) — non cancellare, spostato sotto:

# CONTRIBUTING

So you're looking to contribute to Magic - that's awesome, we can't wait to see what you do.  As a startup with limited headcount and funding, we have grand ambitions to build most powerful LLM applications.  Any help from the community counts, truly.

We need to be nimble and ship fast given where we are, but we also want to make sure that contributors like you get as smooth an experience at contributing as possible.  We've assembled this contribution guide for that purpose, aiming at getting you familiarized with the codebase & how we work with contributors, so you could quickly jump to the fun part.

This guide, like Magic itself, is a constant work in progress.  We highly appreciate your understanding if at times it lags behind the actual project, and welcome any feedback for us to improve.

In terms of licensing, please take a minute to read our short [License and Contributor Agreement](./LICENSE).  The community also adheres to the [code of conduct](https://github.com/dtyq/.github/blob/main/CODE_OF_CONDUCT.md).

## Before you jump in

Looking for something to tackle?  Browse our [good first issues](https://github.com/dtyq/magic/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22) and pick one to get started!

Got a cool idea or feature to add?  Open a PR in our [main repo](https://github.com/dtyq/magic) and show us what you've built.

Need to update an existing feature or squash some bugs?  Open a PR in our [main repo](https://github.com/dtyq/magic) and make your magic happen!

Join the fun, contribute, and let's build something awesome together!  💡✨

Don't forget to link an existing issue or open a new issue in the PR's description.

### Bug reports

> [! IMPORTANT]
> Please make sure to include the following information when submitting a bug report:

- A clear and descriptive title
- A detailed description of the bug, including any error messages
- Steps to reproduce the bug
- Expected behavior
- **Logs**, if available, for backend issues, this is really important, you can find them in docker-compose logs
- Screenshots or videos, if applicable

How we prioritize:

| Issue Type                                                   | Priority        |
| ------------------------------------------------------------ | --------------- |
| Bugs in core functions (cloud service, cannot login, applications not working, security loopholes) | Critical        |
| Non-critical bugs, performance boosts                        | Medium Priority |
| Minor fixes (typos, confusing but working UI)                | Low Priority    |

### Feature requests

> [! NOTE]
> Please make sure to include the following information when submitting a feature request:

- A clear and descriptive title
- A detailed description of the feature
- A use case for the feature
- Any other context or screenshots about the feature request

How we prioritize:

| Feature Type                                                 | Priority        |
| ------------------------------------------------------------ | --------------- |
| High-Priority Features as being labeled by a team member     | High Priority   |
| Popular feature requests from our [community feedback board](https://github.com/dtyq/magic/discussions/categories/feedbacks) | Medium Priority |
| Non-core features and minor enhancements                     | Low Priority    |
| Valuable but not immediate                                   | Future-Feature  |
## Submitting your PR

### Pull Request Process

1.  Fork the repository
2.  Before you draft a PR, please create an issue to discuss the changes you want to make
3.  Create a new branch for your changes
4.  Please add tests for your changes accordingly
5.  Ensure your code passes the existing tests
6.  Please link the issue in the PR description, `fixes #<issue_number>`
7.  Get merged!
### Setup the project

#### Frontend

For setting up the frontend service, please refer to our comprehensive [guide](https://github.com/dtyq/magic/blob/main/frontend/README.md) in the `frontend/README. md` file.  This document provides detailed instructions to help you set up the frontend environment properly.

#### Backend

For setting up the backend service, kindly refer to our detailed [instructions](https://github.com/dtyq/magic/blob/main/backend/README.md) in the `backend/README. md` file.  This document contains step-by-step guidance to help you get the backend up and running smoothly.

#### Other things to note

We recommend reviewing this document carefully before proceeding with the setup, as it contains essential information about:
- Prerequisites and dependencies
- Installation steps
- Configuration details
- Common troubleshooting tips

Feel free to reach out if you encounter any issues during the setup process.
## Getting Help

If you ever get stuck or get a burning question while contributing, simply shoot your queries our way via the related GitHub issue.
