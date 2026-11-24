# AgriPrix

## Démarrage local en moins de 5 minutes

Prérequis : Node.js `^20.19.0` ou `>=22.12.0`, npm, et les clés d'un projet
Supabase et d'une clé Gemini.

1. Installez les dépendances avec `npm install`.
2. Copiez `.env.example` vers `.env`, puis remplacez les valeurs fictives.
3. Lancez l'application avec ses fonctions API :

```sh
npm run dev:vercel
```

Vercel CLI peut demander une connexion et l'association à un projet. `npm run dev`
lance uniquement Vite; les fonctions API `/api/*` n'y sont pas disponibles.
Ne publiez jamais le fichier `.env` ni la clé Gemini; `.env` est ignoré par Git.
Redémarrez le serveur après toute modification de `.env`.

## Dépôt et application en ligne

- Application : https://agriprix.vercel.app
- Dépôt GitHub : https://github.com/mbathiemaimouna744-cmyk/-agriprix

Le dépôt est privé : accordez l'accès au professeur avant la remise. Au contrôle
du 24 novembre 2026, seule la branche `main` était présente; créez et alimentez
les branches `develop` et `feature` demandées par le cahier de remise.
Le site public répond, mais vérifiez que le dernier code est bien déployé :
la réponse publique de `/api/prix-wfp` n'incluait pas encore `type_prix`, champ
présent dans le code source actuel.

## Tests

Lancez les tests unitaires et d'intégration avec `npm test`. Pour générer le
rapport de couverture, utilisez `npm run test:coverage`.
Le rapport impose au moins 60 % de couverture des instructions, des fonctions
et des lignes.

## Contrat d'API

Le contrat OpenAPI est dans [openapi.yaml](./openapi.yaml). Importez ce fichier
dans Postman ou Swagger Editor pour consulter les trois fonctions serveur :
`POST /api/agent`, `GET /api/prix-wfp` et
`GET /api/prix-banque-mondiale`. Les données WFP et Banque mondiale sont
historiques ou périodiques, pas des prix en temps réel.

## Comptes de démonstration

Créez des comptes dédiés aux essais pour les rôles acheteur et agriculteur.
L'administrateur doit être un compte de confiance dont le rôle `admin` est
attribué dans `public.profiles` après exécution des scripts SQL nécessaires.
Les mots de passe de démonstration ne sont pas stockés dans ce dépôt; transmettez
les identifiants au professeur par un canal privé.

## Variables d'environnement

Créez un fichier `.env` à la racine du projet. Il doit contenir :

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

Ne partagez pas la clé Gemini et ne la publiez pas. `.env` est ignoré par Git.
Redémarrez le serveur après avoir modifié ce fichier.

## Accès aux prix du marché

La lecture de `public.prix_marche` nécessite le privilège `SELECT` pour les
rôles `anon` et `authenticated`. Exécutez cette commande dans l'éditeur SQL
Supabase :

```sql
GRANT SELECT ON TABLE public.prix_marche TO anon, authenticated;
```

Si la sécurité au niveau des lignes (RLS) est activée pour cette table, ajoutez
également une politique autorisant la lecture publique :

```sql
CREATE POLICY "prix_marche_read_anon"
ON public.prix_marche
FOR SELECT
TO anon, authenticated
USING (true);
```

## Rôles agriculteur et acheteur

Exécutez le contenu de [supabase/roles.sql](./supabase/roles.sql) dans l'éditeur
SQL du projet Supabase. Les comptes existants seront définis comme agriculteurs;
les nouveaux comptes choisiront leur rôle à l'inscription. Seuls les
agriculteurs peuvent publier ou supprimer leurs annonces.

## Statut et expiration des annonces

Après `roles.sql`, exécutez
[supabase/annonces_disponibilite.sql](./supabase/annonces_disponibilite.sql)
dans l'éditeur SQL Supabase. Les annonces restent visibles pendant 30 jours,
puis sont masquées aux autres visiteurs sans être supprimées. Les agriculteurs
peuvent les marquer comme vendues ou les remettre en vente pour 30 jours depuis
leur tableau de bord. Le vendeur et l'administration peuvent toujours consulter
les annonces vendues ou expirées.

## Comparaison visuelle des prix

L'onglet « Prix du marché » affiche des barres comparant les prix actuels par
produit et région. Une évolution historique nécessite d'enregistrer plusieurs
dates de relevés pour chaque produit et région.

## Source externe des prix

Avant d'ajouter un prix dans l'administration, renseignez son type
(producteur, gros, détail ou prix fixé par l'État) et sa source. Les fourchettes
peuvent être enregistrées avec leurs bornes; leur valeur centrale est calculée
pour les comparaisons et n'est pas présentée comme une observation exacte. La
précision de date (jour ou mois) est conservée. Les anciens prix conservent
leurs champs vides jusqu'à vérification ; ils ne sont pas supprimés par la migration.
Pour activer ces colonnes, exécutez [supabase/prix_sources.sql](./supabase/prix_sources.sql)
dans l'éditeur SQL Supabase avant d'utiliser le formulaire d'administration. Les
prix documentés de 2026 peuvent ensuite être ajoutés sans doublons avec
[supabase/prix_donnees_2026.sql](./supabase/prix_donnees_2026.sql). L'oignon local
de Sédhiou et la pomme de terre de Sédhiou sont des fourchettes de détail de l'APS.
Les six valeurs d'oignon de septembre (Dakar, Diourbel, Kaolack, Kolda, Saint-Louis
et Thiès) sont des moyennes régionales de l'IHPC de l'ANSD, liées directement à la
note officielle. Le prix d'arachide est un prix plancher fixé par l'État, pas une
preuve du prix effectivement payé. Le prix de riz contesté n'est pas inséré. Les
anciens prix d'exemple ne sont pas supprimés.

L'API `/api/prix-wfp` récupère les dernières observations disponibles du jeu
[WFP Food Prices for Senegal sur HDX](https://data.humdata.org/dataset/wfp-food-prices-for-senegal).
Elle conserve le dernier relevé par marché, produit et région, uniquement pour
les prix de détail exprimés en XOF/kg. L'application affiche la date du relevé
et l'attribution de la source. Les séries sont généralement mensuelles et leur
fraîcheur varie : ces données ne sont pas des prix en temps réel ni des prix
garantis à la production. L'API est mise en cache pendant six heures.

L'API `/api/prix-banque-mondiale` fournit une série mensuelle agrégée pour le
Sénégal (maïs, mil, riz et sorgho) à partir du jeu [Monthly food price estimates
by product and market](https://microdata.worldbank.org/catalog/6173). Ces valeurs
combinent des prix observés et des estimations modélisées. Elles sont affichées
séparément des relevés WFP et ne représentent ni un prix observé à chaque marché
ni un prix garanti au producteur. La page affiche l'évolution historique en
FCFA/kg et les douze dernières observations disponibles. La source est mise en
cache pendant six heures.

## Photos des annonces

Après avoir exécuté [supabase/roles.sql](./supabase/roles.sql), exécutez
[supabase/photos.sql](./supabase/photos.sql) dans l'éditeur SQL Supabase. Le
bucket public autorise l'envoi et la suppression de photos par leur agriculteur,
au format JPG, PNG ou WebP, jusqu'à 5 Mo.

## Filtres des annonces

Les annonces peuvent être recherchées par produit, filtrées par région et prix
maximum, puis triées par prix croissant ou décroissant.

## Demandes d'achat

Exécutez [supabase/demandes_achat.sql](./supabase/demandes_achat.sql) dans
l'éditeur SQL Supabase. Les acheteurs connectés peuvent publier le produit, la
quantité, la région et un budget maximal facultatif recherchés. Les agriculteurs
peuvent parcourir les demandes et contacter l'acheteur par SMS. Le numéro est
visible publiquement après confirmation de l'acheteur.

## Assistant et annonces

L'assistant utilise les prix du marché et jusqu'à 30 annonces de vente récentes.
Les coordonnées téléphoniques et les identifiants des vendeurs ne sont pas
transmis au modèle; l'assistant ne doit pas présenter une offre comme une
demande d'achat ni garantir la disponibilité d'un produit.

Le formulaire agriculteur permet aussi de demander une estimation pour un
produit et une région. Le prix suggéré doit être vérifié et saisi par le vendeur.

Dans l'onglet de l'assistant, le contexte des cinq derniers échanges est conservé
tant que la page reste ouverte. Le bouton « Nouvelle discussion » efface cet
historique; il n'est pas enregistré après fermeture ou rechargement de la page.
L'assistant répond en français ou en wolof selon la langue utilisée dans la question.
Il peut aussi donner des conseils prudents sur la saison, le stockage et le bon moment pour vendre, sans transformer une tendance en certitude.

## Tableau de bord et alertes

Exécutez [supabase/alertes.sql](./supabase/alertes.sql) dans l'éditeur SQL
Supabase. Chaque utilisateur connecté peut configurer des alertes de prix dans
son tableau de bord. Les annonces publiées, évaluations et contacts récents
s'affichent également dans cet espace.

## Administration

Exécutez [supabase/admin.sql](./supabase/admin.sql) après les scripts des rôles.
Définissez manuellement le rôle `admin` d'un compte dans `public.profiles`.
Cet espace permet de supprimer les annonces signalées ou modérées et de gérer
les prix du marché. Le rôle administrateur est protégé par les politiques RLS.

## Évaluations des vendeurs

Exécutez [supabase/evaluations.sql](./supabase/evaluations.sql) dans l'éditeur SQL
Supabase. Les acheteurs connectés peuvent attribuer une note de 1 à 5 étoiles et
un commentaire à un agriculteur. Un acheteur ne peut publier qu'un avis par
vendeur; il peut ensuite le modifier ou le supprimer. Les moyennes et avis sont
consultables publiquement.
