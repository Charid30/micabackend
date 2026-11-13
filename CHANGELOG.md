# Journal des versions – Indicateur SONABHY (API)

Numérotation `MAJEUR.MINEUR.CORRECTIF` :
- **majeur** : changement important ou incompatible (ex. structure de la base) ;
- **mineur** : nouvelles fonctionnalités ;
- **correctif** : corrections de bugs.

Chaque version est marquée dans git par une étiquette (`v2.0.0`…). Le backend et la plateforme web
partagent le même numéro majeur.mineur ; le correctif avance séparément quand un seul des deux change. La version s'affiche au démarrage du serveur
(journaux PM2) : `Indicateur SONABHY API v2.0.0 : serveur démarré…`.

Changer de version : `npm version correctif|mineur|majeur` (ou `npm version 2.1.0`), puis
`git push --follow-tags`.

## [2.1.0] – 13/11/2026

### Tableau de bord
- Comparaison avec la semaine précédente : autonomies moyennes, camions chargés et taux de réalisation
  de la semaine N-1 ; stock et autonomie N-1 de chaque produit (`GET /dashboard/synthese` → `comparaison`).

### Suivi des saisies (nouveau)
- `GET /dashboard/saisies?jours=7` (droit Tableau de bord, 31 jours au plus) : grille par dépôt et par menu
  des saisies quotidiennes (à l'heure, après l'heure du rappel, en retard, manquante, non attendue),
  état des saisies hebdomadaires de la semaine en cours, dernières saisies du journal d'audit.

### Historique
- Export Excel des saisies d'une période (`GET /historique/export?debut=&fin=`, un an au plus) :
  synthèse hebdomadaire des stocks intérieurs, puis stocks, dépôts intérieurs, corridors et ventes,
  chaque saisie avec son auteur et son heure. Onglets selon les droits du compte ; un compte limité à
  certains dépôts n'exporte que leurs stocks.

## [2.0.0] – 12/11/2026

Première version numérotée. Elle regroupe tout ce qui a été construit depuis le 02/10/2026.

### Application mobile
- Alertes du compte selon les droits : stocks sous le seuil, saisies du jour à faire, sécurité, rapport publié.
- PDF d'un rapport fabriqué par le serveur (même document que la plateforme), gardé dès la publication.
- Notifications push sur les téléphones (Firebase Cloud Messaging) : mêmes messages que le navigateur.
- Vérification du mot de passe pour activer le déverrouillage par empreinte.
- Tableau de bord : stock national, évolution, ventes par jour.

### Saisie et rapports
- Saisie quotidienne, hebdomadaire ou permanente selon le menu (paramétrable).
- Stocks des dépôts intérieurs et extérieurs, autonomie, référentiel ; consultation des jours précédents en lecture seule.
- Corridors, dépôts intérieurs, temps d'attente, veilles marché et géopolitique, achats traders, encours,
  ventes, trésorerie paramétrable, recommandations, CAF moyen, Centrale SONABEL.
- RDC : Ghana, Bénin, Côte d'Ivoire et Togo (stocks, camions, chargements, réceptions, destinations).
- Rapport hebdomadaire au format REPORTING, publié chaque vendredi (rattrapage si le serveur était arrêté).
- PDF générés par le serveur (Times New Roman 12, justifié, nom de la personne en pied de page) ; export Excel.
- Historique, tableau de bord, situation avec l'État.

### Comptes et sécurité
- Droits par module et par dépôt, intérims, profil, expiration du mot de passe, double authentification.
- Sessions révocables et fermeture après inactivité ; mots de passe hachés (coût 12).
- Journal d'audit ; détection d'intrusion avec bannissement automatique (y compris les sondes visant le site).
- Sauvegardes automatiques de la base, téléchargeables par l'administrateur.
