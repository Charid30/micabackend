# Journal des versions – Indicateur SONABHY (API)

Numérotation `MAJEUR.MINEUR.CORRECTIF` :
- **majeur** : changement important ou incompatible (ex. structure de la base) ;
- **mineur** : nouvelles fonctionnalités ;
- **correctif** : corrections de bugs.

Chaque version est marquée dans git par une étiquette (`v2.0.0`…). Le backend et la plateforme web
portent le même numéro et se déploient ensemble. La version s'affiche au démarrage du serveur
(journaux PM2) : `Indicateur SONABHY API v2.0.0 : serveur démarré…`.

Changer de version : `npm version correctif|mineur|majeur` (ou `npm version 2.1.0`), puis
`git push --follow-tags`.

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
