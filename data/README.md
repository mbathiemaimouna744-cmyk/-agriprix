# Données d'entraînement AgriPrix

`prix_releves.csv` est une copie du jeu public **WFP Food Prices for Senegal**,
diffusé par le Humanitarian Data Exchange (HDX).

- Source et attribution : https://data.humdata.org/dataset/wfp-food-prices-for-senegal
- Fichier source : https://data.humdata.org/dataset/77b76bc7-1edd-43f6-a5e4-784498ff6aca/resource/04ffc070-6d05-4653-a9f6-9f3f893a229e/download/wfp_food_prices_sen.csv
- Licence indiquée par le projet : CC BY-IGO.
- Les données incluses sont des prix de détail observés, en XOF/kg; elles ne
  garantissent pas le prix actuel ni le prix payé au producteur.

Le fichier est filtré par `ml/train.py`. Le script enregistre les volumes, la
date des dernières données et les métriques de validation dans `ml/metadata.json`.
