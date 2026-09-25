# Achats — guide de test complet

À utiliser sur une base de **test**, jamais sur une base réelle.

```
cd backend
npm run seed          # données de base (efface la base !)
npm run seed:achats   # ajoute les données de démo achats (n'efface rien d'autre)
npm run dev           # redémarrer : lance aussi les alertes du jour
```

Relancer `npm run seed:achats` remplace uniquement ses propres données (étiquetées **[DEMO ACHATS]**).

| Compte | E-mail | Mot de passe | Rôle dans les tests |
|---|---|---|---|
| Acheteur | achats@frame.test | Achats@123 | crée et suit les commandes |
| Responsable achats | achats-manager@frame.test | AchatsManager@123 | **approuve** les BC |
| Propriétaire | owner@frame.test | Owner@123 | **approuve** aussi |
| Production | manager@frame.test | Manager@123 | fait les demandes d'achat |

Chaque BC de démo indique son scénario dans ses **Remarques**.

---

## 1. Approbation des bons de commande (seuil : 20 000 MAD TTC)

Le seuil se règle dans **Organisation → Entreprise → Circuit de validation**.

- [ ] **Acheteur** → Bons de commande → ouvrir « Brouillon SOUS le seuil » → *Marquer comme commandé* → passe directement à **Commandé**.
- [ ] Ouvrir « Brouillon AU-DESSUS du seuil » → *Marquer comme commandé* → message « soumis pour approbation », statut **En attente d'approbation**. Les approbateurs reçoivent une notification (cloche).
- [ ] Sur un BC en attente, l'acheteur **ne voit pas** Approuver / Refuser.
- [ ] **Responsable achats** → ouvrir « EN ATTENTE D'APPROBATION » → *Approuver* → **Commandé**, bandeau « Approuvé le … ». L'acheteur reçoit une notification.
- [ ] Refaire avec l'autre BC → *Refuser* : le motif est obligatoire → retour en **Brouillon** avec le bandeau « Approbation refusée : … ».
- [ ] **Faille fermée** : sur un BC approuvé et encore modifiable, augmenter une quantité → il repasse **En attente d'approbation**.
- [ ] Le **propriétaire** peut aussi approuver.

## 2. Envoi par e-mail (mode sans SMTP)

- [ ] Sur un BC **commandé** → *Envoyer par e-mail* → le destinataire est pré-rempli avec l'e-mail du fournisseur, et le PDF est joint.
- [ ] Envoyer → message « E-mail NON envoyé : aucun serveur d'e-mail n'est encore configuré » et historique sous l'en-tête (« non envoyé (pas de SMTP) »).
- [ ] Un **brouillon** ne peut pas être envoyé (bouton absent).
- [ ] Même chose depuis une **demande de prix** (bouton dans la carte ouverte) ; une DP en brouillon passe à **Envoyée**.
- [ ] Pour un envoi réel plus tard : renseigner `SMTP_*` dans `backend/.env` (voir `.env.example`), redémarrer, renvoyer.

## 3. Livraisons, réceptions, retours

- [ ] Bons de commande → filtre Statut → **Livraisons en retard** → le BC « LIVRAISON EN RETARD » apparaît.
- [ ] Au redémarrage du backend, notification « Late delivery » (envoyée **une seule fois**).
- [ ] « RÉCEPTION 69/70 » : la ligne affiche 69 / 70 → *Solder* (motif facultatif) → badge **Soldée**, BC **Réceptionné**. *Rouvrir* annule.
- [ ] Même BC : la ligne est saisie à la main → *Ajouter à l'inventaire* → choisir une catégorie → l'article apparaît dans l'inventaire avec EquipPro à 45 MAD, et **69 unités mises en stock**.
- [ ] « RETOUR 500 vis » : chronologie verte (réception) et rouge (retour), bandeau **« Un avoir de 480,00 MAD est attendu »**. Ajouter un **avoir** de 480 → le bandeau disparaît, « Conforme aux réceptions ».

## 4. Factures, paiements, échéancier

- [ ] « FACTURÉ EN TROP » : bandeau rouge « 300,00 MAD de plus que ce qui a été reçu ».
- [ ] « RETOUR 500 vis » (MetalSud, délai 90 j) : badge **90 j** orange sur l'échéance (accord écrit requis, Loi 69-21).
- [ ] Achats → **Factures fournisseurs** : les factures échues sont en rouge, « En retard de X j » ; les totaux « Reste à payer / En retard / À payer sous 30 j » sont renseignés.
- [ ] Ajouter une facture sans échéance → échéance calculée automatiquement (date + délai du fournisseur).
- [ ] Enregistrer un paiement supérieur au reste à payer → refusé.

## 5. Demandes de prix et comparaison

- [ ] Demandes de prix → une DP porte **Comparer** → tableau : Tôle la moins chère chez **MetalSud** (11,80), Huile chez **AcierPlus** (88) ; EquipPro **Incomplète** ; meilleur total : MetalSud.
- [ ] *Choisir* MetalSud → un **BC brouillon** est créé aux prix proposés ; les autres offres passent **Refusée**.
- [ ] Nouvelle demande de prix → ajouter **2 fournisseurs ou plus** → une DP par fournisseur, reliées pour comparaison.
- [ ] La DP brouillon « nouvel article » : pas de colonne prix tant qu'elle n'est pas envoyée.

## 6. Réapprovisionnement

- [ ] Achats → **Réapprovisionnement** : groupes **MetalSud** (Huile de coupe) et **EquipPro** (Gants), avec stock, minimum, en commande, demandé, quantité suggérée.
- [ ] *Créer le bon de commande* → formulaire pré-rempli (fournisseur + lignes + prix de l'article).

## 7. Rapports (Achats → Rapports)

- [ ] Période = mois en cours → **Relevé des déductions de TVA** : 3 lignes (virement, chèque, espèces), EquipPro signalé **« IF / ICE manquants »**. *Télécharger Excel*.
- [ ] **Export comptable** → Excel avec 2 feuilles (Journal des achats, Règlements) ; totaux **Débit = Crédit**.
- [ ] **Balance âgée** : montants en 1–30 j, 31–60 j et > 90 j. *Télécharger Excel*.

## 8. Fournisseurs

- [ ] L'icône Documents est **orange** pour AcierPlus (attestation qui expire dans 10 j) et **rouge** pour MetalSud (expirée).
- [ ] Ouvrir les documents → états « Expire bientôt » / « Expiré » ; ajouter un document avec fichier et date d'expiration.
- [ ] Au redémarrage du backend, notifications « Supplier document expiring / expired » (une seule fois par document).
- [ ] **Relevé** d'un fournisseur : solde d'ouverture, factures, avoirs, paiements, solde courant ; *Télécharger Excel*.

## 9. Demandes d'achat (production ↔ achats)

- [ ] Le badge **Demandes d'achat (N)** compte la demande en attente et la demande retardée.
- [ ] **Production** → Inventaire → 🛒 sur un article → nouvelle demande → l'acheteur est notifié.
- [ ] **Acheteur** → répondre (commandée / retardée avec motif / refusée avec motif / note) → la production est notifiée.
