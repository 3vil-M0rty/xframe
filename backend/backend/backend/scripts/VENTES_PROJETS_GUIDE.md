# FRAME — Ventes & Projets : guide de test

## Installation
1. Extraire `backend-cumulative.zip` et `frontend.zip` dans `xframe\` (remplacer les fichiers). Votre `.env` et votre CORS ne sont pas touchés.
2. `cd backend` → `npm install` → `npm run seed` → `npm run dev`
3. `cd frontend` → `npm install` → `npm run dev`

## Comptes de test
| Rôle | Email | Mot de passe |
|---|---|---|
| Commercial (Ventes) | ventes@frame.test | Ventes@123 |
| Responsable production | manager@frame.test | Manager@123 |

Le seed crée 3 clients, 3 devis (accepté / envoyé / brouillon), un projet avec tâches, heures, matière sortie et une dépense, une facture d'acompte payée, une facture finale en brouillon et une facture en retard.

## Parcours complet (compte Ventes)
1. **Ventes → Clients** : créer un client (ICE, IF, RC, délai de paiement).
2. **Ventes → Devis → Nouveau** : ajouter des lignes (article du stock ou texte libre, remise %, TVA 0/7/10/14/20). Vérifier les totaux HT / TVA par taux / TTC.
3. Ouvrir le devis → **PDF** → **Envoyer** (email) → **Accepter** (ou Refuser avec motif).
4. Sur le devis accepté : **Créer le projet**, puis **Facture d'acompte** (ex. 30 %).
5. **Ventes → Factures** : ouvrir l'acompte → **Émettre** (le numéro FA/AC est attribué à ce moment, sans trou, date ≥ dernière facture émise) → **Ajouter un paiement** (virement, chèque, espèces, effet…).
6. Depuis le devis : **Facture finale** → les acomptes émis sont déduits automatiquement. Émettre, encaisser.
7. Avoir : sur une facture émise → **Créer un avoir**, puis l'imputer sur une facture.
8. **Ventes → Encaissements** : balance âgée par client (non échu, 1–30, 31–60, 61–90, +90 j), factures à relancer, TVA collectée (sur encaissements vs sur débits) + export Excel.

## Projets (compte Production)
1. **Production → Projets** : liste avec avancement, CA, coût réel, marge, badges « en retard » / « hors budget ».
2. Ouvrir le projet :
   - **Tâches** : créer, assigner des employés, dates, heures estimées, statut (l'avancement = tâches terminées pondérées par les heures).
   - **Heures** : saisir des heures par employé → coût = coût employeur mensuel ÷ 191 h (figé au moment de la saisie).
   - **Matières** : sortie de stock vers le projet (ou retour) → le stock baisse et le coût entre dans le projet.
   - **Achats** : bons de commande liés au projet (champ « Projet » sur le BC).
   - **Dépenses** : sous-traitance, transport, location…
   - **Factures** : factures du projet, reste à facturer, encaissé.
   - Carte **Budget vs réel** : matières / main d'œuvre / achats / autres.
3. **Production → Planning** : frise des projets et tâches (4–12 semaines), tâches en retard en rouge.

## Droits
- Département **Ventes** (permission « sales ») : clients, devis, factures, encaissements ; consultation des projets et du stock.
- **Production / propriétaire** : gestion des projets. Achats et Ventes : lecture seule sur les projets.
- Dans **Départements**, un département peut recevoir l'accès « Ventes ».

## Limites connues
- Les emails utilisent la configuration SMTP existante (à renseigner dans `.env` pour un envoi réel).
- Une facture d'acompte contient une ligne par taux de TVA du devis.
- Une facture émise ne se modifie plus : on passe par un avoir (conforme à la pratique fiscale).
