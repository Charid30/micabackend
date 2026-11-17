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

## [2.4.0] – 17/11/2026

### Sessions actives
- Migration `042_sessions_appareil` : l'appareil (navigateur ou application mobile) est conservé avec chaque session.
- `GET /profil/sessions`, `DELETE /profil/sessions/:id`, `POST /profil/sessions/fermer-autres` : chacun voit
  les appareils connectés à son compte et ferme ceux qu'il ne reconnaît pas (jamais la session courante).
- `DELETE /administration/sessions/:id` : un administrateur ferme une session de n'importe quel compte.
- La session fermée est refusée dès la requête suivante (« Cette session a été fermée depuis un autre
  appareil ») et son flux temps réel est coupé aussitôt. Chaque fermeture est inscrite au journal d'audit.
- L'application mobile est reconnue (« Application mobile MICA ») dans l'historique des connexions.

### État du système
- `GET /administration/etat-systeme` (administrateurs) : sauvegardes, dernière revue des dépendances,
  espace disque, base (taille, dernière migration, migrations en attente), comptes, sécurité, sessions
  actives et liste des points à traiter. Aucune valeur secrète n'est renvoyée.
- `POST /administration/etat-systeme/revue-dependances` : revue des dépendances à la demande (journalisée).

### Configuration
- `.env.example` : `CORS_ORIGIN` documentée (en production : `https://indicateur.sonabhy.bf`).

 – 16/11/2026

### Relance des retardataires
- `POST /dashboard/saisies/relancer` (droit « Suivi des saisies ») : chaque agent chargé d'une saisie du jour
  non faite (droit d'écriture sur le menu et, pour les stocks, sur le dépôt ; intérims compris) reçoit une
  notification de mise à jour listant ses saisies, plus une notification du navigateur. Les administrateurs
  ne sont pas relancés ; une relance au plus par quart d'heure ; saisies sans agent responsable signalées.
- Inscrite au journal d'audit (« Relance des agents dont une saisie du jour n'est pas faite »).

### Revue mensuelle des dépendances
- Le 1er du mois à 08h00 (`AUDIT_DEPENDANCES_CRON`), `npm audit` de l'API et de la plateforme web
  (`AUDIT_DEPENDANCES_WEB_DIR`) ; résultat inscrit au journal d'audit (auteur « Système ») ;
  vulnérabilité ou revue impossible : notification aux administrateurs.
- Revue du 16/11/2026 : aucune vulnérabilité connue (API et plateforme web).

## [2.2.0] – 16/11/2026

### Messages ciblés
- Migration `041_messages` : tables `messages` et `messages_destinataires` (une ligne par destinataire,
  avec l'accusé de lecture : date, heure, adresse). **Sauvegarder la base avant `npm run migrate`.**
- `POST /messages` (administrateurs) : envoi d'un message (titre 150 caractères, texte 2 000) à un ou
  plusieurs comptes ; `GET /messages` : 100 derniers envois et accusés de lecture ; `DELETE /messages/:id` :
  retrait (le message n'est plus présenté à ceux qui ne l'ont pas lu).
- `GET /messages/a-lire` et `POST /messages/:id/lu` : messages non lus du compte connecté et accusé de
  lecture (le premier clic fait foi).
- Temps réel : le destinataire connecté reçoit le message aussitôt (signal ciblé `message-recu`) ; l'écran
  de suivi des administrateurs se met à jour à chaque lecture.
- Journal d'audit : envoi, accusé de lecture et retrait décrits avec le titre du message.

### Corrections
- Associations des messages déclarées sans contrainte côté modèle : déclarées avec, elles formaient un
  cycle qui faisait passer `sequelize.sync()` en mode « alter » au démarrage.

## [2.1.1] – 16/11/2026

### Droits
- Nouveau droit « Suivi des saisies » (`suivi-saisies`), attribué compte par compte (jamais par un profil
  type) : il remplace le droit Tableau de bord pour `GET /dashboard/saisies`.

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
