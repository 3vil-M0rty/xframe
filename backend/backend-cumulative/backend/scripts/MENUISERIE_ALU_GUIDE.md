# FRAME — Production menuiserie aluminium : guide

## Installation
1. Extraire `backend-cumulative.zip` et `frontend.zip` dans `xframe\` (remplacer). Votre `.env` et votre CORS ne sont pas touchés.
2. `cd backend` → `npm install` → `npm run seed` → `npm run dev`
3. `cd frontend` → `npm install` → `npm run dev`

## Comptes de démonstration
| Rôle | Email | Mot de passe | Ce qu'il voit |
|---|---|---|---|
| Responsable production (ateliers Laquage + Aluminium) | manager@frame.test | Manager@123 | Tout : ateliers, catalogue, configuration, projets |
| Responsable atelier Vitrage (sans département) | employee@frame.test | Employee@123 | Uniquement **Ateliers → Vitrage** et ses ordres |
| Commercial | ventes@frame.test | Ventes@123 | Devis avec lignes « châssis » chiffrées |

Le seed crée :
- les 3 ateliers ;
- 50 articles avec leurs données techniques ;
- 5 couleurs (RAL 9016, 7016, 9005, anodisé, brut) ;
- 2 séries (Coulissant 67, Ouvrant 50) et 12 modèles ;
- le devis DV-…-0004 « Villa Anfa » (coulissants, fenêtres, porte, fixes), accepté et devenu le projet PRJ-…-0002, avec ses 3 ordres de fabrication.

## Le principe
```
Catalogue (séries + modèles + formules)
        │
Devis : ligne « châssis » (modèle, L × H, couleur, options) → prix proposé
        │  accepté
Projet : ouvrages (repère F1, F2, P1…) → modifiables après la prise de côtes
        │  « Lancer la fabrication »
OF Laquage  ─┐   barres brutes + poudre → barres laquées en stock
OF Vitrage  ─┼─► OF Aluminium : nombre de barres par profilé, accessoires, joints
             │
Consommations réelles saisies par chaque atelier → coût réel du projet
```

## 1. Configuration (Production → Configuration production)
- **Ateliers** :
  - code, nom, type (laquage / aluminium / vitrage / autre), responsable, équipe et coût horaire ;
  - « Alimente » : Laquage et Vitrage alimentent l'Aluminium. Un OF Aluminium attend donc la fin des OF Laquage et Vitrage du projet.
  - Vous pouvez ajouter d'autres ateliers (Pose, Tôlerie…).
- **Couleurs** :
  - *Laqué* : produit chez vous par l'atelier de laquage, avec sa poudre.
  - *Anodisé / effet bois / autre* : acheté déjà traité.
  - Chaque couleur peut porter une plus-value en %.
  - « Choisir dans le nuancier RAL » : cherchez un RAL (« 7016 », « anthracite »…) parmi les 214 teintes RAL Classic ; le code, le nom et la teinte se remplissent tout seuls. Le code reste modifiable (« RAL 7016 Sablé »…).
  - Les projets (création, « Modifier les informations », onglet Ouvrages) choisissent leur couleur par défaut dans cette liste.
- **Paramètres** :
  - calcul de la poudre : surface × kg/m², poudre par barre, ou saisie manuelle ;
  - lame de scie, recoupe, chute réutilisable, pertes de verre et de poudre, coefficient de vente.

## 2. Articles (Production → Inventaire → « Données techniques »)
**Rubriques et sous-rubriques** (Production → Paramètres) : bouton 📁+ sur une rubrique pour lui ajouter une sous-rubrique, jusqu'à 4 niveaux. Exemple :
- Profilés aluminium › Série ATLAS 78 — coulissants, Série 50 — fenêtres & portes, Série garde-corps, Moustiquaires ;
- Accessoires & joints › Joints, Quincaillerie coulissants, Quincaillerie fenêtres & portes, Visserie…
- Verre & panneaux › Verres, Composants double vitrage, Tôles & panneaux.

Filtrer l'inventaire sur « Profilés aluminium » montre les articles de toutes ses séries ; filtrer sur une série ne montre que la série. Le même nom peut exister sous deux rubriques (« Accessoires » dans deux séries). Une sous-rubrique sans compte comptable reprend celui de sa rubrique parente. « Modifier » permet de déplacer une rubrique (avec ses sous-rubriques) sous une autre. Une rubrique qui a des sous-rubriques ne peut pas être supprimée.

Pour chaque article, indiquez :
- son **type** : profilé, verre, poudre, accessoire, joint, panneau, consommable ;
- comment il est **compté en stock** : barres, m, m², plaques, unités, kg ;
- les dimensions utiles : longueur de barre, format de plaque, conditionnement, périmètre laquable, poids au mètre, consommation de la poudre.

Les couleurs créent automatiquement des **articles variantes**, par exemple « Dormant haut coulissant 67 — RAL 9016 », avec leur propre stock.

## 3. Catalogue (Production → Catalogue châssis)
- **Bibliothèque** : 55 modèles standard. Ils couvrent :
  - coulissants : 2, 3 et 4 vantaux, galandage, levant-coulissant ;
  - ouvrants : à la française, oscillo-battant, soufflet, projetant, basculant, pivotant ;
  - fixes et châssis à meneaux ;
  - ensembles composés ;
  - portes : battante, entrée pleine, va-et-vient, pliante, service tôlée, garage, automatique ;
  - façades : mur rideau, verrières, cloison, vitrine ;
  - fermetures : volet roulant, persienne, jalousie, moustiquaires ;
  - extérieur : garde-corps, pergola bioclimatique, brise-soleil, habillage composite, marquise ;
  - vitrages : simple, double, triple, feuilleté ;
  - panneaux de remplissage.
  
  **Importer** un modèle dans une série ajoute ses variables à la série.
- **Séries** : les variables communes (jeux, recouvrements, déductions en mm). Modifier une variable met à jour tous les modèles de la série.
- **Éditeur de modèle** :
  - *Paramètres* : ce qu'on choisit sur la ligne (nombre de vantaux, moustiquaire, vitrage, remplissage…).
  - *Valeurs intermédiaires* : par exemple `wv = (L - jl + (n-1)*rc) / n`.
  - *Composants* : article (ou « depuis un paramètre »), quantité, longueur de coupe, largeur × hauteur, coupe 45/90, couleur (celle du châssis / brut / sans), atelier, condition (ex. `ms` : seulement si moustiquaire), pertes %.
  - *Main d'œuvre* : minutes par atelier.
  - *Prix* : coût × coefficient, au m², au mètre linéaire ou à l'unité.
  - *Visuel* : le schéma est dessiné à l'échelle depuis L × H. Choisissez le type (coulissant, fenêtre à la française, porte, trame / mur rideau, garde-corps…), le nombre de vantaux, l'ouverture (française, oscillo-battant, soufflet…), vantail plein, etc. Les paramètres `n`, `nx` / `ny`, `lf`, `hi` / `ha`, `ent` d'une ligne remplacent ces valeurs.
    Vous pouvez aussi **téléverser une image** (photo, dessin du catalogue fournisseur, PNG / JPG / WEBP, 5 Mo max) : elle remplace le schéma dans le catalogue, les projets et le PDF du devis. Le bouton ✕ revient au schéma.
  - Le panneau **Tester** calcule, pour une taille donnée, les besoins en unités de stock (nombre de barres selon la longueur de barre de l'article, accessoires, joints, m² de verre) et le prix proposé.
- **Formules** : `L`, `H`, les paramètres et variables, `+ - * / ^`, `min max ceil floor round(x,2) ceilto(x,50) if(c,a,b)`, `c ? a : b`, `==`, `>`, `and`, `or`.
  - Les erreurs s'affichent en direct.
  - Le serveur refuse d'enregistrer une formule invalide.
  - Utilisez un point pour les décimales (`0.5`, pas `0,5`) : la virgule sépare les arguments.

## 4. Devis (Ventes → Devis → « Ajouter un châssis »)
Choisissez le modèle, L × H, la quantité, la couleur et les options :
- le coût s'affiche (matières + laquage + main d'œuvre) avec le prix proposé et la marge ;
- la désignation est générée automatiquement ;
- le prix reste modifiable.

Sur la fiche du devis / de la facture et dans leurs PDF, chaque châssis s'affiche en bloc lisible : le schéma (ou l'image du modèle) avec ses cotes, « F1 · Coulissant 2 vantaux » en gras, puis dimensions, couleur et série, et les options en dessous. Si vous avez réécrit la désignation à la main, votre texte apparaît en note.

## 5. Projet → fabrication
1. Onglet **Ouvrages** : les châssis du devis accepté. Ajoutez-en ou corrigez les cotes après la prise de côtes.
2. Onglet **Fabrication** : besoins atelier par atelier, manques de stock, puis **Lancer la fabrication**. Cela crée un OF par atelier, avec les dépendances.
3. **Ateliers** : chaque responsable voit sa file.
   - **Laquage** : clôturer sort les barres brutes et la poudre, et met en stock les barres laquées à leur coût de revient. Le rebut est saisissable.
   - **Vitrage** : quantités prévues (m² de verre, intercalaire, butyl, dessicant, mastic).
   - **Aluminium** : matériel prévu, groupé par type — profilés (nombre de barres de la longueur de l'article, ex. « 5 barres de 6 500 mm »), accessoires, joints, tôles et MDF. Pas de fiche de débit : l'atelier coupe d'après ses propres plans. Le PDF « Fiche de fabrication » reprend ces quantités.
   - Chaque atelier peut :
     - sortir ligne par ligne (un nombre négatif = retour) ;
     - « sortir tout le reste » ;
     - ajouter une consommation hors nomenclature ;
     - à la clôture, sortir automatiquement le reste prévu. Si le stock manque, le système le signale.
4. Le **coût réel** du projet se remplit tout seul. L'onglet Fabrication compare le prévu au consommé, article par article.

## Laquage pour un client extérieur
Ateliers → **Nouvel ordre de fabrication** : choisissez l'atelier Laquage, le client, les barres et la couleur, puis cochez « Barres fournies par le client ». Seule la poudre est consommée.

## Limites actuelles
- Les verres et les tôles sont comptés en m² ou en plaques avec un % de pertes. Il n'y a pas encore d'optimisation de découpe 2D des plateaux.
- Les formules des modèles standard sont des valeurs de départ réalistes. **Chaque client doit ajuster les variables à son système de profilés** avant de chiffrer.
- Un modèle « Ensemble composé » additionne ses parties (sous-modèles). Les options des sous-modèles sont celles définies par défaut dans chaque sous-modèle.

---

## Suivi des châssis & logistique

### Compte de démonstration
| Rôle | Email | Mot de passe |
|---|---|---|
| Logistique | logistique@frame.test | Logistique@123 |

Dans la démo (projet Villa Anfa) :
- BL-…-0001 a livré **les 4 dormants seuls**, sans vantaux ni vitrage ;
- BL-…-0002 est planifié pour demain avec les vantaux et les moustiquaires de F1-1 et F1-2.

### Le principe
- Chaque ouvrage « F1 × 4 » devient 4 **châssis suivis** : F1-1 … F1-4.
- Chaque châssis est découpé en **éléments livrables**, selon le « Découpage de livraison » de son modèle (éditeur de modèle) :
  - coulissant = dormant + vantaux + vitrages + moustiquaire ;
  - fenêtre = châssis + vitrages ;
  - mur rideau = ossature + N modules vitrés + capots ;
  - volet = coffre + tablier + moteur ;
  - etc.
- Le découpage peut être modifié châssis par châssis : renommer, ajouter, couper en deux lots (« modules niveau 1 / niveau 2 »).
- Étapes de chaque élément, en quantités partielles possibles : **pas entamé → en cours → fabriqué → prêt à livrer → livré (en partie) → posé → réceptionné**.
- Chaque élément a son propre état. Exemple d'un coulissant 2 vantaux : dormant prêt, Vantail 1 en cours, Vantail 2 pas entamé. Le châssis est alors « en cours ».
- **Un élément par pièce** : dans le découpage du modèle, cochez « Un élément par pièce » (avec le nom d'une pièce, ex. « Vantail »). Un coulissant 2 vantaux donne alors « Vantail 1 » et « Vantail 2 », un 4 vantaux en donne quatre.
  - Par défaut, c'est coché pour les vantaux et les vitrages ; les modules de mur rideau restent groupés, livrables en quantités partielles.
  - Sur un châssis déjà créé, le bouton ciseaux → « Un élément par pièce » fait la même chose.
  - Les châssis pas encore entamés suivent automatiquement un changement de découpage du modèle (bouton « Recalculer »).
- Démarrer l'OF Aluminium met « en cours » les dormants, vantaux et moustiquaires ; démarrer l'OF Vitrage met « en cours » les vitrages. Chaque état se corrige ensuite à la main : « Démarré », « Annuler « démarré » ».

### Où
- **Projet → onglet Suivi** :
  - tous les châssis et leurs éléments, avec la couleur de l'étape ;
  - sélection de châssis entiers ou d'éléments (« Dormants », « Vitrages / modules »…) ;
  - actions : fabriqué, prêt à livrer, posé, réceptionné, annuler une étape, quantité partielle ;
  - « Créer un bon de livraison » ;
  - historique de chaque châssis ;
  - découpage d'un châssis ;
  - annuler un châssis (la quantité de l'ouvrage baisse de 1).
- **Production / Logistique → Suivi des projets** : chaque projet avec sa barre d'avancement par étape, les % fabriqués / prêts / livrés / posés, les éléments prêts à livrer, la prochaine livraison, les projets en retard et les châssis modifiés.
- **Logistique → À livrer** : ce qui est prêt, projet par projet. Sélections rapides :
  - tout ;
  - dormants seuls ;
  - **sans vitrage** ;
  - vitrages seuls.
  
  On saisit les quantités (par exemple 4 modules sur 12), puis « Créer le bon de livraison ».
- **Logistique → Bons de livraison** : planning (à venir, aujourd'hui, en retard, livrés…).
  - Chaque BL porte :
    - la date et le créneau ;
    - l'adresse et le contact du chantier ;
    - le **transport** : véhicule de la société (immatriculation, chauffeur), **transporteur** (nom, référence, coût) ou enlèvement client ;
    - les colis et le poids ;
    - les fournitures livrées (pattes, visserie, silicone…) ;
    - les remarques imprimées et les notes internes.
  - Cycle du BL : brouillon → planifié → parti → **livré** (reçu par, **réserves**) ; il peut aussi être annulé.
  - Un BL livré puis annulé = **retour** : les éléments redeviennent « à livrer ». C'est refusé s'ils sont déjà posés.
  - PDF avec cases de signature (livreur, client, réserves).
  - Chaque ligne du BL porte **la dimension de l'élément livré** (ex. Vantail 1 : 895 × 1190, Vitrage 1 : 823 × 1118), avec la dimension du châssis entre parenthèses. Les formules de dimension se règlent dans le découpage de livraison du modèle (colonnes Largeur / Hauteur, ex. `wv` × `hv` pour un vantail, `gw` × `gh` pour un vitrage). Si elles sont vides, c'est la dimension du châssis qui s'affiche.
  - Le coût du transporteur est ajouté automatiquement aux frais du projet.

### Automatismes
- Un OF Aluminium démarré met les châssis du projet « en fabrication ».
- Les « faits » saisis sur l'OF Aluminium et la clôture de l'OF rendent fabriqués les dormants et vantaux ; la clôture de l'OF Vitrage rend fabriqués les vitrages.
- Changer la cote, le modèle ou les options d'un ouvrage après le début de la fabrication signale le châssis **« Modifié »** (à refaire ou vérifier). Les quantités déjà livrées restent enregistrées.
- Réduire la quantité ou supprimer un ouvrage annule les châssis en trop, et l'historique signale ceux déjà fabriqués ou livrés.
- Paramètre (Configuration production) : seuls les éléments « prêts » peuvent partir en livraison (par défaut), sinon tout élément fabriqué.

### Notifications
| Quand | Qui est prévenu |
|---|---|
| Éléments marqués prêts | Logistique |
| Livraison planifiée | Chef de projet et production |
| Livraison partie | Chef de projet et ventes |
| Livrée (avec ou sans réserves) | Ventes et chef de projet |
| Projet entièrement livré | Ventes, « facture à émettre » |
| Tout posé | Ventes et chef de projet |
| Chaque jour, livraison planifiée non confirmée | Logistique |

### Droits
- Département **Logistique** (permission « logistics », à cocher dans Départements) : À livrer, Bons de livraison, Suivi, mise à jour des étapes.
- Production et propriétaires : idem, plus l'annulation d'un châssis.
- Ventes et achats : suivi en lecture seule.

---

## Parcours complet : du devis aux consommations de barres

| Qui (démo) | Compte |
|---|---|
| Admin (paramétrage, voit tout) | admin@frame.test / Admin@123 |
| Commercial (Ventes) | ventes@frame.test / Ventes@123 |
| Responsable production | manager@frame.test / Manager@123 |
| Atelier Vitrage (Imane, opératrice) | employee@frame.test / Employee@123 |
| Logistique | logistique@frame.test / Logistique@123 |

**0. Une seule fois — l'admin / le responsable production paramètre**
1. Configuration production → Ateliers (responsable + équipe de Laquage, Aluminium, Vitrage), Couleurs (nuancier RAL + poudre liée), Paramètres (barre 6 500, lame, chutes…).
2. Inventaire → articles avec leurs **Données techniques** (barres : longueur ; poudre : kg ; verre : m²…) et leur stock.
3. Catalogue châssis → importer les modèles de la bibliothèque dans une série, relier chaque composant à un article, ajuster les variables de la série, tester (L × H) jusqu'à ce que les quantités prévues soient justes. Les prix du modèle ne sont modifiables que par qui voit les montants.

**1. Ventes — le devis**
1. Ventes → Clients : créer le client.
2. Ventes → Devis → Nouveau → « Ajouter un châssis » par repère (F1, F2, P1…) : modèle, L × H, quantité, couleur, options. Prix proposé modifiable. Ajouter les lignes libres (pose, étanchéité…).
3. PDF / e-mail au client → « Marquer comme envoyé ».
4. Client d'accord → « Accepté » (production est prévenue, sans le montant) → **« Créer le projet »** : les châssis deviennent les ouvrages du projet.
5. Facture d'acompte si besoin.

**2. Production — le projet**
1. Production → Projets → le projet : chef de projet, équipe, échéance, couleur par défaut (« Modifier les informations »).
2. Onglet **Ouvrages** : après la prise de côtes sur chantier, corriger les L × H, ajouter / retirer des châssis.
3. Onglet **Fabrication** : besoins par atelier (nombre de barres par profilé, poudre, verres, accessoires, joints, tôles, MDF) et **manques de stock** → faire une Demande d'achat pour ce qui manque → **« Lancer la fabrication »** : 1 OF Laquage, 1 OF Vitrage, 1 OF Aluminium (qui attend les deux autres).

**3. Ateliers — chaque responsable dans Production → Ateliers**
1. **Laquage** : « Démarrer » → laquer → « Terminer » : sortie des barres brutes + poudre, entrée des barres laquées RAL en stock (rebut saisissable).
2. **Vitrage** : « Démarrer » (les vitrages du suivi passent « en cours ») → « Terminer » : sortie verre, intercalaire, butyl, mastic…
3. **Aluminium** (débloqué quand Laquage et Vitrage sont terminés) : imprimer la **Fiche de fabrication** (nombre de barres par profilé, accessoires et joints prévus) → « Démarrer » → saisir les châssis faits → « Terminer ».
4. **Consommations** : sur chaque OF, tableau Prévu / Consommé. On sort ligne par ligne (négatif = retour), « sortir tout le reste », ou on ajoute une consommation hors nomenclature (barre abîmée…). À la clôture, le reste prévu est sorti automatiquement (paramètre). Si le stock manque, c'est signalé (clôture forcée possible).
5. Projet → onglet Fabrication → **Consommation réelle vs prévue**, article par article (barres, poudre, verre…).

**4. Suivi & logistique**
1. Projet → **Suivi** : marquer « prêt à livrer » (dormants, vantaux, vitrages… élément par élément).
2. Logistique → **À livrer** → choisir (ex. dormants seuls, sans vitrage) → **Créer le bon de livraison** (transport, chauffeur, créneau) → Planifié → Parti → **Livré** (reçu par, réserves).
3. Après la pose : « Posé » puis « Réceptionné ».

**5. Ventes — la fin**
Projet entièrement livré → les ventes sont prévenues → « Facture finale » depuis le devis (déduit les acomptes) → encaissements. Le coût réel et la marge du projet se remplissent tout seuls (visibles par qui voit les montants).

## Qui voit les montants ?
- **Voient tout** (prix, CA, coûts, marges, budgets, dépenses, coût de revient des articles dans la production, taux horaires, règles de prix des modèles, plus-values de couleur) : administrateurs, propriétaires, départements Ventes, Finance, Comptabilité et Direction.
- **Ne voient pas les montants** : Production, ateliers, Logistique, Achats (dans les projets). Ils voient l'avancement, les heures, les quantités, les débits et les consommations en quantités. Le serveur ne leur envoie pas les montants (ce n'est pas qu'un masquage à l'écran), et enregistrer leurs écrans ne modifie pas les prix.
- **Exception au cas par cas** : Organisation → Comptes → modifier → cocher « Voir les montants » (ex. un chef de production qui suit les coûts).
- Limite : l'**Inventaire** garde ses prix pour ceux qui le gèrent.

---

## Droits d'accès (qui peut faire quoi)

**Principe.** Chaque action de la plateforme est un droit à part : `Ventes › Devis › Créer`, `RH › Salaires › Modifier`, `Logistique › Bons de livraison › Marquer livré`, `Production › Ordres de fabrication › Terminer`… (environ 150 droits, dans 10 modules). Le serveur vérifie chaque droit à chaque action ; l'écran masque les boutons qu'on n'a pas.

**Hiérarchie.**
1. **Administrateur / propriétaire** : tous les droits ; peut régler ceux de tout le monde (Organisation › Rôles & permissions).
2. **Responsable de département** (Organisation › Départements › « Responsable ») : reçoit automatiquement tous les droits du module de son département (RH, Ventes, Achats, Production, Logistique) et distribue à son équipe (Mon espace › **Droits de mon équipe**).
3. **Son équipe** = les personnes de son département + toutes celles qui lui sont rattachées (champ « Responsable » de la fiche employé), sur tous les niveaux.
4. Un responsable **ne donne que les droits qu'il a lui-même** (les autres cases sont grisées) et ne modifie jamais ses propres droits.
5. Il peut cocher « Équipe › Droits de son équipe » pour un chef d'équipe, qui distribue à son tour à ses propres collaborateurs (une partie de ses droits à lui).

**Écran « Droits d'accès ».** À gauche l'équipe en arbre ; à droite, module par module, les actions à cocher. Boutons : « Tout / Aucun » par module, « tout / rien » par ligne, **Appliquer un profil** (Chauffeur / livreur, Opérateur d'atelier, Magasinier, Commercial, Acheteur, Assistant(e) / Chargé(e) / Responsable RH…), **Profil du poste** (revenir au profil par défaut du département). Les droits en orange sont automatiques (la personne est elle-même responsable d'un département). La personne reçoit une notification quand ses droits changent.

**Profils par défaut** (tant que personne n'a personnalisé les droits d'un compte) :
- RH : selon le niveau — Assistant(e) RH (consultation, documents, contrats), Chargé(e) RH (+ fiches employés, jours fériés, soldes), Responsable RH (+ approbations, salaires, sanctions, suppression), Directeur RH (+ niveaux du personnel RH).
- Ventes, Achats : tout leur module ; Production : production, inventaire, projets ; **Logistique : son propre module** (la production ne voit plus les bons de livraison ; elle marque « démarré / fabriqué / prêt », la logistique « posé / réceptionné »).
- Montants (prix, coûts, marges) : Ventes, Finance, Comptabilité, Direction — ou le droit « Montants › Voir ».

**Démo.**
| Compte | Rôle |
|---|---|
| logistique@frame.test / Logistique@123 | Karim, responsable logistique : distribue à Said et Omar |
| chauffeur@frame.test / Chauffeur@123 | Said, chauffeur : bons de livraison (voir, parti, livré, PDF) ; peut passer une partie à Omar |
| aide-livreur@frame.test / AideLivreur@123 | Omar : voit les bons de livraison |
| hr-manager@frame.test / HrManager@123 | Karima, Directeur RH : règle les droits de Nadia |
| assistant-rh@frame.test / AssistantRh@123 | Nadia, assistante RH (profil Assistant(e) RH) |

