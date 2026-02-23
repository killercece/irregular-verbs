/**
 * Irregular Verbs Quiz
 * Logique du quiz avec système de rounds
 */

// === ÉTAT ===
let allVerbs = [];
let pool = [];
let retryList = [];
let currentIndex = 0;
let currentQuestion = null;
let roundNumber = 0;
let roundCorrect = 0;
let roundTotal = 0;
let globalCorrect = 0;
let globalTotal = 0;
let answered = false;
let settings = { count: 20, mode: 'random' };

// === INITIALISATION ===
document.addEventListener('DOMContentLoaded', () => {
    loadVerbs();
    initTheme();
    initEventListeners();
});

/**
 * Charge les verbes depuis l'API.
 */
async function loadVerbs() {
    try {
        const res = await fetch('/api/verbs');
        allVerbs = await res.json();
        document.getElementById('verb-count-info').textContent =
            `${allVerbs.length} verbes disponibles`;
    } catch (e) {
        console.error('Erreur chargement verbes:', e);
    }
}

/**
 * Initialise le thème depuis le localStorage.
 */
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Attache les écouteurs d'événements.
 */
function initEventListeners() {
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-start').addEventListener('click', startQuiz);
    document.getElementById('btn-validate').addEventListener('click', handleValidate);
    document.getElementById('btn-next-round').addEventListener('click', startRound);
    document.getElementById('btn-restart').addEventListener('click', () => {
        showScreen('screen-start');
    });
}

/**
 * Bascule entre thème clair et sombre.
 */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// === NAVIGATION ===

/**
 * Affiche un écran et masque les autres.
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    screen.classList.remove('active');
    // Force reflow pour relancer l'animation
    void screen.offsetWidth;
    screen.classList.add('active');
}

// === QUIZ ===

/**
 * Démarre un nouveau quiz avec les paramètres sélectionnés.
 */
function startQuiz() {
    const count = parseInt(document.getElementById('verb-count').value);
    const mode = document.getElementById('quiz-mode').value;
    settings = { count, mode };

    roundNumber = 0;
    globalCorrect = 0;
    globalTotal = 0;

    // Sélectionner les verbes aléatoirement
    const shuffled = [...allVerbs].sort(() => Math.random() - 0.5);
    pool = count === 0 ? shuffled : shuffled.slice(0, count);

    startRound();
}

/**
 * Démarre un nouveau round avec le pool actuel.
 */
function startRound() {
    roundNumber++;
    retryList = [];
    currentIndex = 0;
    roundCorrect = 0;
    roundTotal = pool.length;

    // Mélanger le pool
    pool.sort(() => Math.random() - 0.5);

    showScreen('screen-quiz');
    nextVerb();
}

/**
 * Passe au verbe suivant ou termine le round.
 */
function nextVerb() {
    if (currentIndex >= pool.length) {
        endRound();
        return;
    }

    const verb = pool[currentIndex];
    currentQuestion = generateQuestion(verb, settings.mode);
    answered = false;

    renderQuestion(currentQuestion);
    updateProgress();
}

/**
 * Génère une question à partir d'un verbe et d'un mode.
 */
function generateQuestion(verb, mode) {
    let questionType;

    if (mode === 'complete') {
        questionType = 'french_to_all';
    } else if (mode === 'preterit') {
        questionType = 'infinitive_to_past';
    } else {
        // Aléatoire : choisir un type au hasard
        const types = [
            'french_to_all',
            'infinitive_to_past',
            'past_to_others',
            'participle_to_others'
        ];
        questionType = types[Math.floor(Math.random() * types.length)];
    }

    switch (questionType) {
        case 'french_to_all':
            return {
                verb,
                promptLabel: 'Français',
                promptValue: verb.french,
                hint: '',
                fields: [
                    { key: 'infinitive', label: 'Infinitif', expected: verb.infinitive },
                    { key: 'past_simple', label: 'Prétérit', expected: verb.past_simple },
                    { key: 'past_participle', label: 'Participe passé', expected: verb.past_participle }
                ]
            };
        case 'infinitive_to_past':
            return {
                verb,
                promptLabel: 'Infinitif',
                promptValue: verb.infinitive,
                hint: verb.french,
                fields: [
                    { key: 'past_simple', label: 'Prétérit', expected: verb.past_simple },
                    { key: 'past_participle', label: 'Participe passé', expected: verb.past_participle }
                ]
            };
        case 'past_to_others':
            return {
                verb,
                promptLabel: 'Prétérit',
                promptValue: verb.past_simple,
                hint: verb.french,
                fields: [
                    { key: 'infinitive', label: 'Infinitif', expected: verb.infinitive },
                    { key: 'past_participle', label: 'Participe passé', expected: verb.past_participle }
                ]
            };
        case 'participle_to_others':
            return {
                verb,
                promptLabel: 'Participe passé',
                promptValue: verb.past_participle,
                hint: verb.french,
                fields: [
                    { key: 'infinitive', label: 'Infinitif', expected: verb.infinitive },
                    { key: 'past_simple', label: 'Prétérit', expected: verb.past_simple }
                ]
            };
    }
}

/**
 * Affiche la question dans l'interface.
 */
function renderQuestion(question) {
    document.getElementById('prompt-label').textContent = question.promptLabel;
    document.getElementById('prompt-value').textContent = question.promptValue;
    document.getElementById('prompt-hint').textContent = question.hint;

    const fieldsContainer = document.getElementById('quiz-fields');
    fieldsContainer.innerHTML = '';

    question.fields.forEach((field, i) => {
        const div = document.createElement('div');
        div.className = 'field-group';
        div.innerHTML = `
            <label for="field-${field.key}">${field.label}</label>
            <input type="text" id="field-${field.key}" autocomplete="off"
                   autocorrect="off" autocapitalize="off" spellcheck="false"
                   data-expected="${field.expected}">
        `;
        fieldsContainer.appendChild(div);
    });

    // Bouton valider
    const btn = document.getElementById('btn-validate');
    btn.textContent = 'Valider';
    btn.className = 'btn btn-primary';

    // Focus sur le premier champ
    const firstInput = fieldsContainer.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);

    // Gestion du Enter dans les champs
    fieldsContainer.querySelectorAll('input').forEach((input, i, inputs) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (answered) {
                    handleValidate();
                } else if (i < inputs.length - 1) {
                    inputs[i + 1].focus();
                } else {
                    handleValidate();
                }
            }
        });
    });

    // Animation d'entrée
    const card = document.getElementById('quiz-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'fadeIn 0.3s ease';
}

/**
 * Met à jour la barre de progression et les scores.
 */
function updateProgress() {
    document.getElementById('round-badge').textContent = `Round ${roundNumber}`;
    document.getElementById('progress-text').textContent =
        `Verbe ${currentIndex + 1} / ${pool.length}`;
    document.getElementById('progress-fill').style.width =
        `${((currentIndex) / pool.length) * 100}%`;
    document.getElementById('score-correct').textContent = `${roundCorrect} correct`;
    document.getElementById('score-wrong').textContent =
        `${currentIndex - roundCorrect} erreur${(currentIndex - roundCorrect) !== 1 ? 's' : ''}`;
}

/**
 * Gère le clic sur Valider / Suivant.
 */
function handleValidate() {
    if (answered) {
        // Passer au verbe suivant
        currentIndex++;
        nextVerb();
        return;
    }

    // Vérifier les réponses
    const fields = document.querySelectorAll('#quiz-fields input');
    let allCorrect = true;

    fields.forEach(input => {
        const expected = input.dataset.expected;
        const answer = input.value.trim();
        const correct = checkAnswer(answer, expected);

        input.disabled = true;

        if (correct) {
            input.classList.add('correct');
        } else {
            allCorrect = false;
            input.classList.add('wrong');
            // Afficher la correction
            const correction = document.createElement('div');
            correction.className = 'field-correction';
            correction.innerHTML = `Réponse : <span>${expected}</span>`;
            input.parentElement.appendChild(correction);
        }
    });

    answered = true;
    globalTotal++;

    const card = document.getElementById('quiz-card');

    if (allCorrect) {
        roundCorrect++;
        globalCorrect++;
        card.classList.add('correct-flash');
        setTimeout(() => card.classList.remove('correct-flash'), 500);

        // Auto-avancer après 800ms si tout est correct
        const btn = document.getElementById('btn-validate');
        btn.textContent = 'Suivant';
        setTimeout(() => {
            if (answered) {
                currentIndex++;
                nextVerb();
            }
        }, 800);
    } else {
        // Ajouter le verbe à la liste de retry
        retryList.push(currentQuestion.verb);
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);

        const btn = document.getElementById('btn-validate');
        btn.textContent = 'Suivant';
    }
}

/**
 * Vérifie si une réponse est correcte.
 * Gère les alternatives séparées par " / ".
 */
function checkAnswer(answer, expected) {
    const normalizedAnswer = answer.trim().toLowerCase();
    if (!normalizedAnswer) return false;

    // Séparer les alternatives (ex: "was / were" → ["was", "were"])
    const alternatives = expected.toLowerCase().split('/').map(s => s.trim());

    // Accepter n'importe quelle alternative valide
    return alternatives.some(alt => alt === normalizedAnswer);
}

/**
 * Termine le round actuel et affiche les résultats.
 */
function endRound() {
    // Mettre à jour la barre de progression à 100%
    document.getElementById('progress-fill').style.width = '100%';

    if (retryList.length === 0) {
        // Victoire !
        showVictory();
        return;
    }

    // Afficher le résumé du round
    document.getElementById('round-result-title').textContent =
        `Round ${roundNumber} terminé !`;
    document.getElementById('round-result-score').textContent =
        `${roundCorrect} / ${roundTotal}`;

    if (retryList.length === 1) {
        document.getElementById('round-result-message').textContent =
            `Plus qu'un seul verbe à revoir !`;
    } else {
        document.getElementById('round-result-message').textContent =
            `Plus que ${retryList.length} verbes à revoir !`;
    }

    // Liste des verbes à revoir
    const listEl = document.getElementById('retry-verbs-list');
    listEl.innerHTML = '';
    retryList.forEach(verb => {
        const tag = document.createElement('span');
        tag.className = 'retry-verb-tag';
        tag.textContent = `${verb.infinitive} (${verb.french})`;
        listEl.appendChild(tag);
    });

    // Préparer le pool pour le prochain round
    pool = [...retryList];

    showScreen('screen-round-end');
}

/**
 * Affiche l'écran de victoire avec confettis.
 */
function showVictory() {
    const accuracy = globalTotal > 0
        ? Math.round((globalCorrect / globalTotal) * 100)
        : 100;

    document.getElementById('victory-rounds').textContent = roundNumber;
    document.getElementById('victory-correct').textContent = globalCorrect;
    document.getElementById('victory-accuracy').textContent = `${accuracy}%`;

    showScreen('screen-victory');
    launchConfetti();
}

/**
 * Lance une animation de confettis.
 */
function launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.width = `${6 + Math.random() * 8}px`;
        confetti.style.height = `${6 + Math.random() * 8}px`;
        container.appendChild(confetti);
    }

    setTimeout(() => container.remove(), 5000);
}
