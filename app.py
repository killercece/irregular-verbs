"""
Application Flask - Irregular Verbs
Quiz interactif pour réviser les verbes irréguliers anglais.
"""

__version__ = '1.1.0'

from flask import Flask, render_template, jsonify, request, g
import sqlite3
import json
import logging
import os
from pathlib import Path
from datetime import datetime

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
    """Crée la base de données si elle n'existe pas, ou migre si nécessaire."""
    from setup import init_database
    if not DB_PATH.exists():
        logger.info("Base de données absente, initialisation automatique...")
        init_database()
    else:
        # Migration : créer les nouvelles tables si elles n'existent pas
        conn = sqlite3.connect(DB_PATH)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        if 'sessions' not in tables:
            conn.close()
            logger.info("Migration : ajout des tables sessions...")
            init_database()
        else:
            # Vérifier si pause_state existe
            cols = [r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()]
            if 'pause_state' not in cols:
                logger.info("Migration : ajout colonne pause_state...")
                conn.execute("ALTER TABLE sessions ADD COLUMN pause_state TEXT")
                conn.commit()
            conn.close()


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


@app.route('/suivi')
def suivi():
    """Page de suivi pour les parents."""
    try:
        db = get_db()

        # Récupérer toutes les sessions complétées
        sessions = db.execute("""
            SELECT id, started_at, completed_at, mode, total_verbs,
                   total_correct, total_errors, rounds
            FROM sessions
            WHERE completed_at IS NOT NULL
            ORDER BY started_at DESC
        """).fetchall()
        sessions = [dict(s) for s in sessions]

        # Pour chaque session, récupérer les verbes en erreur
        for session in sessions:
            errors = db.execute("""
                SELECT v.infinitive, v.french, se.error_count
                FROM session_errors se
                JOIN verbs v ON v.id = se.verb_id
                WHERE se.session_id = ?
                ORDER BY se.error_count DESC
            """, (session['id'],)).fetchall()
            session['error_verbs'] = [dict(e) for e in errors]
            # Calcul du pourcentage de réussite
            total = session['total_correct'] + session['total_errors']
            session['accuracy'] = round(session['total_correct'] / total * 100) if total > 0 else 0

        # Stats globales : verbes les plus ratés
        hard_verbs = db.execute("""
            SELECT v.infinitive, v.french, v.past_simple, v.past_participle,
                   SUM(se.error_count) as total_errors,
                   COUNT(DISTINCT se.session_id) as sessions_with_error
            FROM session_errors se
            JOIN verbs v ON v.id = se.verb_id
            GROUP BY se.verb_id
            ORDER BY total_errors DESC
            LIMIT 10
        """).fetchall()
        hard_verbs = [dict(v) for v in hard_verbs]

        # Stats résumé
        total_sessions = len(sessions)
        avg_accuracy = round(sum(s['accuracy'] for s in sessions) / total_sessions) if total_sessions > 0 else 0
        avg_rounds = round(sum(s['rounds'] for s in sessions) / total_sessions, 1) if total_sessions > 0 else 0

        return render_template('suivi.html',
                               sessions=sessions,
                               hard_verbs=hard_verbs,
                               total_sessions=total_sessions,
                               avg_accuracy=avg_accuracy,
                               avg_rounds=avg_rounds)
    except sqlite3.Error as e:
        logger.error(f"Erreur base de données: {e}")
        return render_template('suivi.html',
                               sessions=[], hard_verbs=[],
                               total_sessions=0, avg_accuracy=0, avg_rounds=0)


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


@app.route('/api/sessions', methods=['POST'])
def create_session():
    """Crée une nouvelle session de quiz."""
    try:
        data = request.get_json() or {}
        mode = data.get('mode', 'random')
        total_verbs = data.get('total_verbs', 0)

        db = get_db()
        cursor = db.execute(
            "INSERT INTO sessions (mode, total_verbs) VALUES (?, ?)",
            (mode, total_verbs)
        )
        db.commit()
        return jsonify({"id": cursor.lastrowid}), 201
    except sqlite3.Error as e:
        logger.error(f"Erreur création session: {e}")
        return jsonify({"error": "Erreur base de données"}), 500


@app.route('/api/sessions/<int:session_id>', methods=['PUT'])
def complete_session(session_id):
    """Termine une session avec les résultats."""
    try:
        data = request.get_json()
        db = get_db()

        db.execute("""
            UPDATE sessions
            SET completed_at = ?, total_correct = ?, total_errors = ?, rounds = ?
            WHERE id = ?
        """, (
            datetime.now().isoformat(),
            data.get('total_correct', 0),
            data.get('total_errors', 0),
            data.get('rounds', 0),
            session_id
        ))

        # Enregistrer les erreurs par verbe
        errors = data.get('errors', [])
        for err in errors:
            db.execute(
                "INSERT INTO session_errors (session_id, verb_id, error_count) VALUES (?, ?, ?)",
                (session_id, err['verb_id'], err['count'])
            )

        db.commit()
        return jsonify({"status": "ok"}), 200
    except sqlite3.Error as e:
        logger.error(f"Erreur complétion session: {e}")
        return jsonify({"error": "Erreur base de données"}), 500


@app.route('/api/sessions/<int:session_id>/pause', methods=['PUT'])
def pause_session(session_id):
    """Sauvegarde l'état d'une session en pause."""
    try:
        data = request.get_json()
        db = get_db()

        # Sauvegarder l'état complet du quiz en JSON dans la colonne pause_state
        db.execute("""
            UPDATE sessions SET pause_state = ?, total_correct = ?, total_errors = ?, rounds = ?
            WHERE id = ? AND completed_at IS NULL
        """, (
            json.dumps(data.get('state', {})),
            data.get('total_correct', 0),
            data.get('total_errors', 0),
            data.get('rounds', 0),
            session_id
        ))
        db.commit()
        return jsonify({"status": "ok"}), 200
    except sqlite3.Error as e:
        logger.error(f"Erreur pause session: {e}")
        return jsonify({"error": "Erreur base de données"}), 500


@app.route('/api/sessions/pending')
def get_pending_session():
    """Récupère la dernière session en pause (non terminée)."""
    try:
        db = get_db()
        session = db.execute("""
            SELECT id, started_at, mode, total_verbs, total_correct,
                   total_errors, rounds, pause_state
            FROM sessions
            WHERE completed_at IS NULL AND pause_state IS NOT NULL
            ORDER BY started_at DESC LIMIT 1
        """).fetchone()

        if session:
            s = dict(session)
            s['pause_state'] = json.loads(s['pause_state']) if s['pause_state'] else None
            return jsonify(s), 200
        return jsonify(None), 200
    except sqlite3.Error as e:
        logger.error(f"Erreur récup session en pause: {e}")
        return jsonify({"error": "Erreur base de données"}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    logger.info(f"Démarrage sur le port {port}")
    app.run(debug=True, port=port, host='0.0.0.0')
