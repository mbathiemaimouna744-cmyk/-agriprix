# AgriPrix

## Développement local

Installez les dépendances puis lancez l'application avec l'API :

```sh
npm install
npm run dev:vercel
```

`npm run dev` lance uniquement Vite; la fonction `/api/agent` n'y est pas disponible.
Vercel CLI peut demander une connexion et l'association à un projet.

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

## Comparaison visuelle des prix

L'onglet « Prix du marché » affiche des barres comparant les prix actuels par
produit et région. Une évolution historique nécessite d'enregistrer plusieurs
dates de relevés pour chaque produit et région.

## Photos des annonces

Après avoir exécuté [supabase/roles.sql](./supabase/roles.sql), exécutez
[supabase/photos.sql](./supabase/photos.sql) dans l'éditeur SQL Supabase. Le
bucket public autorise l'envoi et la suppression de photos par leur agriculteur,
au format JPG, PNG ou WebP, jusqu'à 5 Mo.

## Filtres des annonces

Les annonces peuvent être recherchées par produit, filtrées par région et prix
maximum, puis triées par prix croissant ou décroissant.

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
