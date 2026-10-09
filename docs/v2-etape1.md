# IPcalc V2 — étape 1 et préparation de C²

## Séparation des responsabilités

- `js/ipv4.js` : module ES de calcul pur, sans DOM ni réseau. API existante conservée (`parseNetwork`, `planSubnets`, `subnetAt`, pagination, binaire). Importable par une future application C².
- `js/app.js`, `index.html`, `styles.css` : formulaire, état de l'interface et rendu. Tout changement de paramètres invalide le résultat, vide les cartes et désactive les exports jusqu'au prochain calcul.
- `js/exports.js` : mise en forme CSV/texte et adaptateur de presse-papiers, sans modification des calculs.
- `print.css` : styles d'impression navigateur existants, extraits de la feuille d'interface. Le bouton Imprimer reste désactivé ; aucun moteur PDF ni module d'impression dédié n'est implémenté. Une future fonction d'impression devra recevoir les données calculées et ne pas recalculer les réseaux.
- `js/pwa.js`, `sw.js`, `manifest.webmanifest` : installation, cache et cycle de mise à jour autonomes. Le cache est versionné `2.0.0-step1`, sans publication de Release.

## Autonomie et chemins

Aucun service externe ni ressource distante à l'exécution. Les modules, styles, icônes et manifeste utilisent des chemins relatifs. Le build copie aussi `print.css`. Les tests navigateur servent le build dans `/IPcalc/`, pas uniquement à la racine.

Une installation locale nécessite un serveur HTTP sur localhost (ou HTTPS ailleurs), puis une première ouverture pour préparer le cache. Les calculs et les ressources mises en cache fonctionnent ensuite sans accès réseau. L'ouverture directe en `file://` ne convient pas aux modules ES et au service worker.

## Intégration future : options et obstacles

1. Importer uniquement `js/ipv4.js` dans C² et fournir une interface propre : le moteur est déjà réutilisable sans adaptation du DOM.
2. Embarquer l'application complète dans une iframe, avec son sous-dossier dédié : isolation naturelle des styles et identifiants. Prévoir les permissions de presse-papiers/téléchargement si l'iframe est sandboxée ; son origine et la politique CSP restent à définir.
3. Intégrer directement l'interface comme composant nécessitera de remplacer les accès globaux `document.getElementById`, de scoper les styles et de fournir un cycle montage/démontage des événements. L'interface actuelle n'est pas encore un composant multi-instance.

Le service worker IPcalc est limité à son dossier et son cache inclut sa portée. Il faudra coordonner son cycle de vie avec celui de C² : une application hôte peut déjà posséder son propre service worker. Aucun contrat d'échange avec C² n'est ajouté à cette étape. Aucun fichier de C² n'est modifié.

IPv6 et VLSM restent explicitement indisponibles. Ils nécessitent des moteurs futurs séparés.

## Essai dans Firefox

Depuis PowerShell, dans `C:\Users\chaoli\Documents\GitHub\IPcalc` :

```powershell
node scripts/serve.mjs
```

Ouvrir `http://localhost:4173/` dans Firefox. Le serveur utilise les fichiers sources ; aucun build ni installation de dépendances n'est nécessaire. Si Node n'est pas dans PATH, utiliser son chemin d'installation. Pour l'environnement Codex de ce poste :

```powershell
& 'C:\Users\chaoli\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/serve.mjs
```

Vérifier le résultat initial : `192.168.10.64`, `255.255.255.192`, `/26`, `192.168.10.127`, `62`. Passer en FLSM avec `192.168.10.75/24`, méthode nombre, demande `10` : préfixe `/28`, capacité `16`, lignes 1, 2, 3, 8, 9, 10. Tester ensuite les méthodes hôtes et combinée, le binaire, Copier et CSV.

Modifier l'adresse, le masque, la méthode ou une contrainte : les anciens résultats doivent disparaître immédiatement. Revenir à Aucun découpage puis recalculer. IPv6, VLSM et Imprimer restent désactivés.

Attendre « Prêt hors connexion », puis activer Fichier > Travailler hors connexion dans Firefox et recharger. Tester les deux modes disponibles. Réactiver la connexion ensuite. Si une ancienne version est en cache, accepter « Mettre à jour » lorsqu'il apparaît. Le thème suit la préférence sombre/claire du navigateur comme auparavant.

Arrêter le serveur avec Ctrl+C. Aucun push, fusion ou publication n'est nécessaire pour cet essai.

## Validation réalisée le 9 octobre 2026

- 53 tests Node réussis : IPv4, limites /0 et /31, masques invalides, trois méthodes FLSM, contraintes impossibles, pagination, binaire et exports.
- 39 tests navigateur réussis (13 scénarios sur desktop, mobile portrait et mobile paysage sombre) avec Playwright et Microsoft Edge/Chromium installé. Incluent transitions de modes, effacement des résultats après modification de chaque paramètre, pagination ouverte, exports, absence de débordement à 320 px, thèmes clair/sombre, aucune requête externe, manifeste et redémarrage hors connexion en sous-dossier `/IPcalc/`.
- Build statique et vérification de syntaxe JavaScript réussis ; inspection visuelle de captures desktop/mobile sombres.
- Le moteur `js/ipv4.js` et les exports `js/exports.js` n'ont pas été modifiés.
- Firefox : procédure manuelle fournie ci-dessus ; la suite automatisée a été exécutée sur Chromium, pas Firefox.

Particularités de l'environnement de validation : npm et les navigateurs Playwright dédiés sont absents du PATH/cache de ce poste. Les tests ont utilisé le Playwright fourni par Codex et Edge installé, sans ajouter de dépendance au projet. L'accès loopback IPv4 était bloqué ; le serveur de validation a été lancé sur localhost IPv6. Ces adaptations sont dans `test-results/` (ignoré par Git), sans modifier la configuration de test distribuée. Si nécessaire pour un essai local dans cet environnement, définir `$env:HOST='::'` avant de lancer le serveur.
