# Déclarations de paie & congés — guide de test

## Ce qui a été ajouté

| Écran (menu RH) | Ce que ça fait |
|---|---|
| **Déclarations → CNSS — Damancom** | Charge le **préétabli** du mois (téléchargé sur Damancom), le rapproche de la paie, ajoute les nouveaux salariés, demande la situation des assurés sans bulletin (sortant, maladie…), puis génère le **fichier de déclaration** à déposer sur Damancom (Échange de fichiers). |
| **Déclarations → Virement bancaire** | Vérifie **chaque RIB** (24 chiffres + clé de contrôle) et le RIB de la société, puis génère le fichier de **virement de masse** (Excel ou CSV). Les salariés payés en espèces/chèque sont listés à part. |
| **Déclarations → IR — versement mensuel** | Montant d'IR retenu à verser sur **Simpl-IR**, avec l'échéance (fin du mois suivant). |
| **Déclarations → IR — déclaration annuelle** | **État 9421** (traitements et salaires) à partir des paies clôturées de l'année : fichier **XML** pour Simpl-IR et version **Excel**. Échéance : avant le 1er mars. |
| **Soldes de congés** | Congés payés de chaque salarié selon le Code du travail, **solde d'ouverture** (reprise de l'ancien système), jours accordés en plus par l'entreprise, export Excel. |

Autres changements :
- Les absences (congés payés, sans solde, absences) se comptent maintenant en **jours ouvrables** selon le planning de l'entreprise, sans les jours fériés chômés. Les congés maladie restent en jours calendaires. Avant, une semaine de congé coûtait 7 jours au lieu de 6.
- Chaque bulletin enregistre ses **jours déclarés à la CNSS** (26 pour un mois complet, moins pour une embauche en cours de mois ou des jours non payés).
- **Calcul de l'IR corrigé** (`config/payrollConfig.js`) :
  - **frais professionnels** : 35 % du brut imposable jusqu'à 6 500 MAD/mois, sinon 25 % plafonné à 2 916,67 MAD/mois, calculés sur le **brut** (loi de finances 2023). L'ancien calcul (20 % après cotisations) était périmé ;
  - **charges de famille** : 500 MAD/an par personne à charge, 6 au maximum (loi de finances 2025). L'ancien montant était de 360.

  Les paies déjà clôturées ne changent pas ; les nouvelles (et les brouillons régénérés) utilisent les nouveaux taux.

## Tester

```
cd backend
npm install
npm run seed
npm run dev
```

Le seed renseigne maintenant l'IF, le n° CNSS et le RIB de la société, un n° CNSS à 9 chiffres et un RIB valide pour chaque salarié (un salarié payé en espèces), et écrit un **préétabli de démonstration** : `backend/scripts/demo-preetabli-AAAAMM.txt` (mois de la paie de démo).

Compte : **hr@frame.test / Hr@12345**.

- [ ] RH → **Déclarations**, onglet CNSS : choisir `demo-preetabli-….txt` → *Vérifier*. Un problème s'affiche : EL IDRISSI RACHID est dans le préétabli sans bulletin → choisir **SO — Sortant**. Le salarié le plus récent apparaît dans « Nouveaux salariés ». *Générer le fichier Damancom* → un `.txt` de lignes de 260 caractères (B00 à B06).
- [ ] Onglet **Virement bancaire** : 7 virements, 1 salarié en espèces listé à part. Modifier le RIB d'un salarié (un chiffre) → revenir : le fichier est bloqué et le salarié est signalé (clé RIB incorrecte).
- [ ] Onglet **IR — versement mensuel** : montant à verser et échéance.
- [ ] Onglet **IR — déclaration annuelle** : une ligne par salarié ; avertissement pour les mois sans paie clôturée ; XML et Excel.
- [ ] RH → **Soldes de congés** : Hassan (8 ans d'ancienneté) a 19,5 jours/an (+1,5). Crayon → solde d'ouverture « 10 jours au 1er janvier » → le solde repart de là. En admin : « Jours en plus par an » = 2 → tout le monde passe à 20.
- [ ] RH → Absences : un congé payé du lundi au dimanche compte **6 jours** (planning lundi–samedi).

## ⚠️ Avant la première déclaration réelle

Je n'ai pas pu récupérer les cahiers des charges officiels pour vérifier les formats champ par champ :

1. **Damancom** — les positions des champs sont dans `config/cnssBdsLayout.js`. Déposez un fichier généré sur Damancom et lisez le rapport de contrôle. Si un champ est rejeté, la correction se fait dans ce seul fichier.
2. **Simpl-IR** — les noms des éléments XML sont dans `services/simplIrService.js`. Téléchargez le XSD depuis votre espace Simpl-IR et comparez, ou faites relire la version Excel par votre comptable la première année.
3. **Banque** — le fichier Excel/CSV s'importe dans le portail entreprise ; au premier import, associez les colonnes une fois. Si votre banque impose un format fixe particulier, envoyez-moi sa spécification et je l'ajoute.
4. **Taux de paie** — revérifiez `config/payrollConfig.js` à chaque loi de finances (décembre).
