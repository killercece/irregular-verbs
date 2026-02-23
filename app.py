"""
Application Flask - Irregular Verbs
Quiz interactif pour réviser les verbes irréguliers anglais.
"""

__version__ = '1.0.0'

from flask import Flask, render_template, jsonify, g
import sqlite3
import logging
import os
from pathlib import Path

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialiser Flask
app = Flask(__name__)
app.secret_key = 'irregular-verbs-quiz-secret-key'

# Configuration base de données
DB_PATH = Path('data/app.db')


def ensure_db():
    """Crée la base de données si elle n'existe pas."""
    if DB_PATH.exists():
        return
    from setup import init_database
    logger.info("Base de données absente, initialisation automatique...")
    init_database()


# Auto-init au démarrage
ensure_db()


def get_db():
    """Connexion à la base de données avec réutilisation par requête."""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Ferme la connexion à la fin de la requête."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


@app.route('/')
def index():
    """Page d'accueil - Quiz des verbes irréguliers."""
    return render_template('index.html')


@app.route('/api/health')
def health():
    """Health check endpoint pour PyDeploy."""
    return jsonify({"status": "ok", "version": __version__}), 200


@app.route('/api/verbs')
def get_verbs():
    """Récupère la liste de tous les verbes irréguliers."""
    try:
        db = get_db()
        verbs = db.execute(
            "SELECT id, infinitive, past_simple, past_participle, french "
            "FROM verbs ORDER BY infinitive"
        ).fetchall()
        return jsonify([dict(v) for v in verbs]), 200
    except sqlite3.Error as e:
        logger.error(f"Erreur base de données: {e}")
        return jsonify({"error": "Erreur base de données"}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    logger.info(f"Démarrage sur le port {port}")
    app.run(debug=True, port=port, host='0.0.0.0')
