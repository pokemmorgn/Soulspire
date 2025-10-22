# Balance Reports

Rapports d'équilibrage automatiques générés par `dummyBalance.ts`.

## Format des fichiers
- `balance_YYYY-MM-DDTHH-MM-SS.json` : Rapport complet avec:
  - DPS de tous les sorts sur différents ennemis
  - Analyse d'équilibrage automatique
  - Recommandations d'ajustements

## Génération
```bash
cd server
npx ts-node src/scripts/dummyBalance.ts
```

Les rapports sont automatiquement pushés vers GitHub après génération.
