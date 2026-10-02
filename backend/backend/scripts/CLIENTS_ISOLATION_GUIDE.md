# Isolation des clients — mise en place, tests, sauvegardes

## Ce qui change

- Chaque **client** (une entreprise qui vous paie) possède ses **sociétés** et ses **comptes**.
  Un client ne voit **jamais** les données d'un autre, même en tapant un identifiant dans l'URL.
- La règle n'est pas recopiée route par route : elle est appliquée **une seule fois pour toutes
  les requêtes** de la base (`services/tenantScope.js`). Une nouvelle route est protégée
  automatiquement.
- Un nouveau rôle **platform_admin** (vous, l'opérateur) : il crée les clients, les suspend, leur
  donne un administrateur. Il **ne voit aucune donnée RH ou achats** des clients : uniquement des
  totaux.
- Les **e-mails restent uniques sur toute la plateforme** (un même e-mail ne peut pas exister chez
  deux clients).
- Les **documents** (documents RH, documents fournisseurs, BL, factures, devis) envoyés à partir de
  maintenant sont **privés** : pas d'adresse publique permanente ; l'application donne un lien
  valable **5 minutes** à la personne autorisée. Les fichiers déjà envoyés gardent leur adresse
  actuelle. Photos d'employés, logos et images d'articles restent publics (affichés dans les listes).

## Mise en place sur votre base actuelle

```
cd backend
npm install
npm run dev
```

Au démarrage, le serveur **rattache automatiquement** toutes vos données existantes à un client
nommé « Default client » (une seule fois ; ensuite il ne fait plus rien). Pour choisir le nom,
lancez **avant** le premier démarrage :

```
npm run migrate:tenants -- --name="Groupe Atlas"
```

(Vous pouvez aussi le renommer plus tard dans Plateforme → Clients → Détails → Renommer.)

Créez ensuite votre compte opérateur :

```
npm run create:platform-admin -- --email=vous@frame.ma --password="Un-mot-de-passe-long"
```

Connectez-vous avec : vous arrivez sur **Plateforme → Clients**.

Base vide ? `npm run seed:admin` crée maintenant un client + son administrateur
(`npm run seed:admin -- --client="Groupe Atlas"`).

## Tester l'isolation (base de test)

```
npm run seed           # efface la base ! crée 2 clients
npm run seed:achats
npm run create:platform-admin -- --email=ops@frame.test --password="Platform@123"
```

| Compte | E-mail | Mot de passe | Client |
|---|---|---|---|
| Admin client A | admin@frame.test | Admin@123 | Atlas Group (démo) |
| Admin client B | admin-b@frame.test | AdminB@123 | Beta Trading (démo client B) |
| Opérateur | ops@frame.test | Platform@123 | aucun (plateforme) |

- [ ] **admin-b** → Organisation → Entreprise : seule « Beta Trading » apparaît. RH, Achats,
      Inventaire : aucune donnée d'Atlas.
- [ ] **admin** (client A) : ouvrez un BC, copiez son identifiant dans l'URL. Connecté en
      **admin-b**, ouvrez la même URL → « introuvable ».
- [ ] **admin-b** → Utilisateurs → créer un compte avec `hr@frame.test` → refusé
      (« e-mail déjà utilisé ») : les e-mails sont uniques sur la plateforme.
- [ ] **ops** → Plateforme → Clients : 2 clients, avec des totaux seulement. Menu RH / Achats absent.
- [ ] **ops** → *Suspendre* « Beta Trading » → **admin-b** est déconnecté à sa prochaine action et
      ne peut plus se connecter. *Réactiver* → il peut de nouveau.
- [ ] **ops** → *Nouveau client* (nom + premier admin) → se connecter avec cet admin : base vide,
      il crée sa société.
- [ ] Documents : RH → Documents → envoyer un PDF → *Voir* ouvre le fichier. Copiez l'adresse
      ouverte, attendez 5 minutes : elle ne fonctionne plus.

Test automatique (inclus dans `npm test`) : `routes/tenantIsolation.test.js` appelle **toutes les
routes de l'API** en admin du client A avec les identifiants du client B partout (URL, filtres,
corps de requête) et vérifie qu'aucune donnée de B ne sort, qu'aucune n'est modifiée ou supprimée,
et que rien n'est créé chez B.

## Sauvegardes

```
npm run backup                              # toute la base → backups/<date>/
npm run backup -- --tenant=<id du client>   # un seul client (aussi : export de ses données)
npm run backup -- --out="D:\Sauvegardes\frame\2026-09-26"
```

Une sauvegarde est un dossier (`manifest.json` + un fichier `.jsonl.gz` par collection).
**Copiez-le hors de cette machine** (autre disque, Drive…). Ne le mettez pas dans git
(ajoutez `backups/` au `.gitignore`) : il contient les données RH.

Rythme conseillé : chaque nuit (Planificateur de tâches Windows → `npm run backup` dans le dossier
backend), en gardant 7 quotidiennes + 4 hebdomadaires + 12 mensuelles. Si votre base est sur
MongoDB Atlas, activez aussi ses sauvegardes automatiques : les deux se complètent.

## Restauration — et le test mensuel

Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde. **Une fois par mois**,
restaurez la dernière dans une base **vide** séparée :

```
npm run restore -- --from=backups/2026-09-26T02-00-00 --uri="mongodb+srv://.../frame-restore-test"
```

Le script refuse une base qui contient déjà des données, restaure, puis **vérifie** que chaque
document sauvegardé est bien revenu. Pour vérifier l'application elle-même : lancez le backend avec
`MONGODB_URI` pointant sur cette base de test et connectez-vous.

En cas de sinistre réel :

```
npm run restore -- --from=backups/<date> --drop --yes                 # remplace toute la base
npm run restore -- --from=backups/<date>-client-<id> --merge --yes    # remet UN client, sans toucher aux autres
```

Démarrez ensuite le serveur une fois : il reconstruit les index.
