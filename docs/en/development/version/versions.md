# 📝 Descrizione Versione

## 🔢 Regole Versioni

Magic adotta la regola di numerazione delle versioni x.y.z per denominare ciascuna versione, come la versione 1.2.3, dove 1 è x, 2 è y e 3 è z. Puoi utilizzare questa regola di versioning per pianificare i tuoi aggiornamenti al progetto Magic.
- x rappresenta una versione principale. Quando il core di Magic subisce ampi rifacimenti, o quando ci sono numerosi cambiamenti di rottura nelle API/UI, verrà rilasciata come versione x. I cambiamenti nelle versioni x tipicamente non possono essere compatibili con le versioni x precedenti, sebbene ciò non significhi necessariamente incompatibilità completa. La compatibilità specifica dovrebbe essere determinata in base alla guida di aggiornamento per la versione corrispondente.
- y rappresenta una versione di iterazione principale delle funzionalità. Quando alcune API/UI pubbliche subiscono cambiamenti di rottura, inclusi cambiamenti e cancellazioni di API/UI pubbliche che possono causare incompatibilità con versioni precedenti, verrà rilasciata come versione y.
- z rappresenta una versione di correzione completamente compatibile. Quando si correggono bug o problemi di sicurezza nelle funzionalità esistenti di vari componenti, verrà rilasciata come versione z. Quando un bug impedisce completamente il funzionamento di una funzionalità, potrebbero essere apportati cambiamenti di rottura nelle API anche in una versione z per correggere questo bug. Tuttavia, poiché la funzionalità era precedentemente completamente inutilizzabile, tali cambiamenti non verranno rilasciati come versione y. Oltre alle correzioni di bug, le versioni z possono includere alcune nuove funzionalità o componenti, che non influenzeranno l'uso del codice precedente.

## ⬆️ Aggiornamento Versioni

Quando desideri aggiornare le versioni di Magic, se stai aggiornando versioni x e y, segui la guida di aggiornamento per la versione corrispondente nella documentazione.

---

**Testo originale in inglese:**

# Version Description

## Version Rules

Magic adopts the x.y.z version numbering rule to name each version, such as version 1.2.3, where 1 is x, 2 is y, and 3 is z. You can use this versioning rule to plan your updates to the Magic project.
- x represents a major version. When Magic's core undergoes extensive refactoring changes, or when there are numerous breaking API/UI changes, it will be released as an x version. Changes in x versions typically cannot be compatible with previous x versions, although this doesn't necessarily mean complete incompatibility. Specific compatibility should be determined based on the upgrade guide for the corresponding version.
- y represents a major feature iteration version. When some public APIs/UIs undergo breaking changes, including changes and deletions of public APIs/UIs that may cause incompatibility with previous versions, it will be released as a y version.
- z represents a fully compatible fix version. When fixing bugs or security issues in existing features of various components, it will be released as a z version. When a bug completely prevents a feature from functioning, breaking API changes may also be made in a z version to fix this bug. However, since the feature was previously completely unusable, such changes will not be released as a y version. In addition to bug fixes, z versions may also include some new features or components, which will not affect the use of previous code.

## Upgrading Versions

When you want to upgrade Magic versions, if you are upgrading x and y versions, please follow the upgrade guide for the corresponding version in the documentation.