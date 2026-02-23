# Irregular Verbs

Quiz interactif pour réviser les verbes irréguliers anglais. L'application interroge l'élève de manière aléatoire jusqu'à ce qu'il maîtrise tous les verbes sans erreur.

## Fonctionnalités

- 53 verbes irréguliers à réviser
- 3 modes de quiz : Complet (français → anglais), Prétérit (infinitif → formes passées), Aléatoire
- Système de rounds : les verbes ratés reviennent jusqu'à zéro erreur
- Interface moderne et responsive
- Thème clair / sombre

## Installation

```bash
cd /projects/irregular-verbs

# Créer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Initialiser la base de données
python setup.py
```

## Utilisation

```bash
python app.py
```

Accéder à http://localhost:5000

## API Endpoints

- `GET /` - Page d'accueil (quiz)
- `GET /api/health` - Health check
- `GET /api/verbs` - Liste de tous les verbes

## Déploiement PyDeploy

Ce projet est conçu pour être déployé via PyDeploy.
