// ================================================================
// PAPILLES — Logique applicative
// RENOMME CE FICHIER EN : app.js
// Place-le dans le MÊME dossier que index.html et recettes.js
// ================================================================

// ── HISTORIQUE 3 JOURS ──────────────────────────────────────────
// Quand tu ouvres une recette, elle est mémorisée.
// Elle n'apparaît plus en première suggestion pendant JOURS_BLOCAGE jours.

const HISTORY_KEY   = 'papilles_historique';
const JOURS_BLOCAGE = 3;
const TOP_PLAT_KEY  = 'papilles_top_plat_jour';

function lireHistorique() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : { plat: [], entree: [], dessert: [] };
  } catch (e) {
    return { plat: [], entree: [], dessert: [] };
  }
}

function sauverHistorique(h) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch (e) {
    console.warn('Papilles : impossible de sauvegarder l\'historique.', e);
  }
}

function nettoyerHistorique(h) {
  const limite = JOURS_BLOCAGE * 24 * 60 * 60 * 1000;
  const now = Date.now();
  ['plat', 'entree', 'dessert'].forEach(type => {
    h[type] = (h[type] || []).filter(e => (now - e.ts) < limite);
  });
  return h;
}

function enregistrerDansHistorique(type, id) {
  const h = nettoyerHistorique(lireHistorique());
  const liste = h[type] || [];
  const idx = liste.findIndex(e => e.id === id);
  if (idx >= 0) {
    liste[idx].ts = Date.now(); // Rafraîchir le timestamp
  } else {
    liste.push({ id: id, ts: Date.now() });
  }
  h[type] = liste;
  sauverHistorique(h);
}

function estVuRecemment(type, id) {
  const h = nettoyerHistorique(lireHistorique());
  const limite = JOURS_BLOCAGE * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (h[type] || []).some(e => e.id === id && (now - e.ts) < limite);
}

// ── ENRICHISSEMENT DES DONNÉES ──────────────────────────────────
// On ajoute _type à chaque recette pour que le modal sache d'où ça vient
RECETTES.plats    = RECETTES.plats.map(r    => Object.assign({}, r, { _type: 'plat'    }));
RECETTES.entrees  = RECETTES.entrees.map(r  => Object.assign({}, r, { _type: 'entree'  }));
RECETTES.desserts = RECETTES.desserts.map(r => Object.assign({}, r, { _type: 'dessert' }));

// ── NAVIGATION ──────────────────────────────────────────────────
function naviguerVers(page) {
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  document.querySelectorAll('[data-page]').forEach(function(b) {
    b.classList.toggle('active', b.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-page]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    naviguerVers(btn.dataset.page);
  });
});

// ── INSTALLATION PWA (PC/MOBILE) ───────────────────────────────
var deferredInstallPrompt = null;
var installAppBtn = document.getElementById('install-app-btn');

function afficherBoutonInstall(show) {
  if (!installAppBtn) return;
  installAppBtn.classList.toggle('show', !!show);
}

function estDejaInstallee() {
  var standaloneIOS = window.navigator.standalone === true;
  var standalonePWA = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return standaloneIOS || standalonePWA;
}

if (installAppBtn && estDejaInstallee()) {
  afficherBoutonInstall(false);
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  afficherBoutonInstall(true);
});

window.addEventListener('appinstalled', function() {
  deferredInstallPrompt = null;
  afficherBoutonInstall(false);
});

if (installAppBtn) {
  installAppBtn.addEventListener('click', async function() {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch (e) {
      // Rien: certains navigateurs peuvent rejeter la promesse.
    }

    deferredInstallPrompt = null;
    afficherBoutonInstall(false);
  });
}

// ── RENDU HTML D'UN BADGE DE DIFFICULTÉ ─────────────────────────
function badgeDiff(d) {
  var cls = (d === 'facile' || d === 'très facile') ? 'diff-facile'
          : (d === 'moyen') ? 'diff-moyen' : 'diff-difficile';
  return '<span class="badge ' + cls + '">' + d + '</span>';
}

// ── RENDU HTML D'UNE CARTE RECETTE ──────────────────────────────
function carteHTML(r, recent) {
  var badgeRecent = recent
    ? '<span class="badge badge-recent">🔄 Vu récemment</span>'
    : '';
  return [
    '<div class="recipe-card' + (recent ? ' card-recent' : '') + '"',
    '     onclick="ouvrirModal(\'' + r._type + '\', ' + r.id + ')"',
    '     role="button" tabindex="0" aria-label="' + r.nom + '">',
    '  <div class="card-left"><div class="card-emoji">' + r.emoji + '</div></div>',
    '  <div class="card-right">',
    '    <div class="card-header">',
    '      <div class="card-nom">' + r.nom + '</div>',
    '      <div class="card-origine">' + (r.origine || '') + '</div>',
    '    </div>',
    '    <div class="card-desc">' + r.description + '</div>',
    '    <div class="card-meta">',
    '      <span class="badge">⏱ ' + r.temps + ' min</span>',
    '      ' + badgeDiff(r.difficulte),
    '      ' + badgeRecent,
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

// ── AFFICHAGE D'UNE GRILLE AVEC GESTION DE L'HISTORIQUE ─────────
function afficherGrille(containerId, recettes) {
  var el = document.getElementById(containerId);
  if (!el) return;

  if (!recettes || recettes.length === 0) {
    el.innerHTML = [
      '<div class="empty">',
      '  <div class="empty-icon">🍽️</div>',
      '  <p>Aucune recette pour cette sélection.<br>',
      '  <small>Tu peux en ajouter dans <strong>recettes.js</strong> !</small></p>',
      '</div>'
    ].join('');
    return;
  }

  var type = recettes[0]._type;
  var fraiches  = recettes.filter(function(r) { return !estVuRecemment(type, r.id); });
  var recentes  = recettes.filter(function(r) { return  estVuRecemment(type, r.id); });

  var html = '';

  if (fraiches.length > 0) {
    html += fraiches.map(function(r) { return carteHTML(r, false); }).join('');
  }

  if (recentes.length > 0) {
    var separateur = fraiches.length === 0
      ? '🔄 Tout a déjà été proposé cette semaine — mais voilà quand même&nbsp;:'
      : 'Déjà vu récemment';
    html += '<div class="separator-recent"><span>' + separateur + '</span></div>';
    html += recentes.map(function(r) { return carteHTML(r, true); }).join('');
  }

  el.innerHTML = html;
}

// ── PAGE PLAT ───────────────────────────────────────────────────
var moodLabels = {
  'fatigué':  'Pour quand t\'es à plat 😴',
  'joyeux':   'Pour célébrer ce beau jour 😄',
  'stressé':  'Pour décompresser 😤',
  'amoureux': 'Pour faire battre les cœurs 🥰',
  'sportif':  'Pour le corps en mouvement 💪',
  'curieux':  'Pour voyager sans bouger 🌍'
};

// Limite volontaire pour éviter la surcharge de décision.
var NB_SUGGESTIONS_HUMEUR = 2;
var lastSurpriseByType = { plat: null, entree: null, dessert: null };
var DUREE_ROULETTE_MS = 500;
var SON_SURPRISE_ACTIF = true;
var audioUnlocked = false;
var audioFiles = {
  roulette: 'sounds/roulette_bOfDHqhZ.mp3',
  reveal: 'sounds/roulette_bOfDHqhZ.mp3'
};
var audioElements = {
  roulette: null,
  reveal: null
};

var moodPreferences = {
  'fatigué': {
    maxTemps: 30,
    preferDifficulte: ['très facile', 'facile'],
    tags: ['rapide', 'express', 'riz', 'familial', 'réconfort']
  },
  'joyeux': {
    maxTemps: 40,
    preferDifficulte: ['facile', 'moyen'],
    tags: ['partage', 'convivial', 'barbecue', 'street food']
  },
  'stressé': {
    maxTemps: 35,
    preferDifficulte: ['très facile', 'facile'],
    tags: ['réconfort', 'mijoté', 'riz', 'familial']
  },
  'amoureux': {
    maxTemps: 50,
    preferDifficulte: ['facile', 'moyen'],
    tags: ['partage', 'tradition', 'sauce', 'barbecue']
  },
  'sportif': {
    maxTemps: 40,
    preferDifficulte: ['facile', 'moyen'],
    tags: ['protéines', 'complet', 'viande', 'poulet']
  },
  'curieux': {
    maxTemps: 60,
    preferDifficulte: ['moyen', 'facile'],
    tags: ['tradition', 'africain', 'street food', 'poisson']
  }
};

function bonusStableDuJour(id, mood) {
  var d = new Date();
  var cle = mood + '-' + id + '-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  var h = 0;
  for (var i = 0; i < cle.length; i++) {
    h = ((h << 5) - h) + cle.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h % 6); // 0..5
}

function cleJour(offsetDays) {
  var d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function lireTopPlatJour() {
  try {
    var raw = localStorage.getItem(TOP_PLAT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function sauverTopPlatJour(id, mood) {
  try {
    localStorage.setItem(TOP_PLAT_KEY, JSON.stringify({ id: id, mood: mood, day: cleJour(0) }));
  } catch (e) {
    console.warn('Papilles : impossible de sauvegarder le top plat du jour.', e);
  }
}

function etaitTopHier(id) {
  var top = lireTopPlatJour();
  return !!top && top.id === id && top.day === cleJour(-1);
}

function scorePlatPourHumeur(r, mood) {
  var pref = moodPreferences[mood] || {};
  var score = 0;
  var tags = (r.tags || []).map(function(t) { return String(t).toLowerCase(); });
  var diff = (r.difficulte || '').toLowerCase();
  var temps = Number(r.temps) || 999;

  if ((r.humeurs || []).indexOf(mood) !== -1) score += 60;
  if (!estVuRecemment('plat', r.id)) score += 24;
  if (etaitTopHier(r.id)) score -= 28;

  if (typeof pref.maxTemps === 'number') {
    if (temps <= pref.maxTemps) score += 16;
    else score += Math.max(-12, pref.maxTemps - temps);
  }

  if ((pref.preferDifficulte || []).indexOf(diff) !== -1) {
    score += 10;
  }

  (pref.tags || []).forEach(function(tag) {
    if (tags.indexOf(tag) !== -1) score += 4;
  });

  score += bonusStableDuJour(r.id, mood);
  return score;
}

function platsParHumeurPertinents(mood) {
  var candidats = RECETTES.plats.filter(function(r) {
    return (r.humeurs || []).indexOf(mood) !== -1;
  });

  if (!candidats.length) {
    candidats = RECETTES.plats.slice();
  }

  return candidats
    .map(function(r) {
      return { recette: r, score: scorePlatPourHumeur(r, mood) };
    })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.recette.temps || 0) - (b.recette.temps || 0);
    })
    .map(function(x) { return x.recette; });
}

function titreResultatHumeur(mood, nb) {
  var base = moodLabels[mood] || '';
  var labelNb = (nb <= 1) ? 'Ton plat du jour' : 'Ton plat du jour + 1 alternative';
  return base ? (base + ' · ' + labelNb) : labelNb;
}

function marquerBoutonHumeur(mood) {
  document.querySelectorAll('.mood-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.mood === mood);
  });
}

function construireSelectionHumeur(mood, forceSurprise) {
  var classes = platsParHumeurPertinents(mood);
  if (!classes.length) return [];

  if (!forceSurprise) {
    return classes.slice(0, NB_SUGGESTIONS_HUMEUR);
  }

  var pool = classes.slice(0, Math.min(classes.length, 6));
  var idx = bonusStableDuJour(pool.length + mood.length, mood) % pool.length;
  var principal = pool[idx];
  var alternatives = classes.filter(function(r) { return r.id !== principal.id; });
  return [principal].concat(alternatives.slice(0, NB_SUGGESTIONS_HUMEUR - 1));
}

function afficherSuggestionsHumeur(mood, forceSurprise) {
  var found = construireSelectionHumeur(mood, !!forceSurprise);

  document.getElementById('plat-results-title').textContent = titreResultatHumeur(mood, found.length);
  afficherGrille('plat-grid', found);

  if (found.length) {
    sauverTopPlatJour(found[0].id, mood);
  }

  var res = document.getElementById('plat-results');
  res.style.display = 'block';
  setTimeout(function() { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
}

function choisirRecetteAleatoire(type, liste) {
  if (!liste || !liste.length) return null;
  if (liste.length === 1) return liste[0];

  var candidate = null;
  var tentative = 0;
  var previousId = lastSurpriseByType[type];

  while (tentative < 6) {
    candidate = liste[Math.floor(Math.random() * liste.length)];
    if (!candidate || candidate.id !== previousId) break;
    tentative++;
  }

  if (!candidate) candidate = liste[0];
  lastSurpriseByType[type] = candidate.id;
  return candidate;
}

function getAudioElement(kind) {
  if (!SON_SURPRISE_ACTIF) return null;
  if (!audioFiles[kind]) return null;

  if (!audioElements[kind]) {
    var a = new Audio(audioFiles[kind]);
    a.preload = 'auto';
    a.volume = 0.95;
    audioElements[kind] = a;
  }

  return audioElements[kind];
}

function unlockAudioIfNeeded() {
  if (!SON_SURPRISE_ACTIF || audioUnlocked) return;

  var unlock = function() {
    ['roulette', 'reveal'].forEach(function(kind) {
      var a = getAudioElement(kind);
      if (!a) return;
      try {
        a.muted = true;
        var p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(function() {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          }).catch(function() {
            a.muted = false;
          });
        } else {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        }
      } catch (e) {
        // Ignore: certains navigateurs bloquent malgré l'interaction.
      }
    });
    audioUnlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

function jouerFichierSon(kind) {
  try {
    var a = getAudioElement(kind);
    if (!a) return;

    a.currentTime = 0;
    var p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function() {
        // Ignore: peut être bloqué si le navigateur refuse l'autoplay.
      });
    }
  } catch (e) {
    // En silence si l'audio est indisponible
  }
}

function arreterSon(kind) {
  var a = getAudioElement(kind);
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch (e) {
    // Aucun traitement nécessaire.
  }
}

function jouerSonRoulette() {
  jouerFichierSon('roulette');
}

function jouerSonReveal() {
  jouerFichierSon('reveal');
}

function afficherSurpriseCategorie(type) {
  var map = {
    plat: {
      titreId: 'plat-results-title',
      gridId: 'plat-grid',
      blocId: 'plat-results',
      titre: '✨ Surprise Plat · 1 idée'
    },
    entree: {
      titreId: 'entree-results-title',
      gridId: 'entree-results-grid',
      blocId: 'entree-results',
      titre: '✨ Surprise Entrée · 1 idée'
    },
    dessert: {
      titreId: 'dessert-results-title',
      gridId: 'dessert-results-grid',
      blocId: 'dessert-results',
      titre: '✨ Surprise Dessert · 1 idée'
    }
  };

  var cfg = map[type];
  var source = (type === 'plat') ? RECETTES.plats : (type === 'entree') ? RECETTES.entrees : RECETTES.desserts;
  if (!cfg || !source || !source.length) return;

  var proposition = choisirRecetteAleatoire(type, source);
  if (!proposition) return;

  if (type === 'plat') {
    document.querySelectorAll('.mood-btn').forEach(function(b) { b.classList.remove('selected'); });
  }

  var titre = document.getElementById(cfg.titreId);
  if (titre) titre.textContent = cfg.titre;

  afficherGrille(cfg.gridId, [proposition]);

  var bloc = document.getElementById(cfg.blocId);
  if (bloc) {
    bloc.style.display = 'block';
    setTimeout(function() { bloc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }
}

function lancerSurpriseAvecRoulette(type, btn) {
  if (!btn) {
    afficherSurpriseCategorie(type);
    jouerSonReveal();
    return;
  }

  if (btn.dataset.busy === '1') return;

  var texteInitial = btn.innerHTML;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.classList.add('is-spinning');
  btn.innerHTML = '<span class="dice">🎲</span>Tirage...';
  jouerSonRoulette();

  setTimeout(function() {
    afficherSurpriseCategorie(type);
    arreterSon('roulette');
    jouerSonReveal();
    btn.innerHTML = texteInitial;
    btn.classList.remove('is-spinning');
    btn.disabled = false;
    btn.dataset.busy = '0';
  }, DUREE_ROULETTE_MS);
}

document.querySelectorAll('.mood-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var mood = btn.dataset.mood;
    marquerBoutonHumeur(mood);
    afficherSuggestionsHumeur(mood, false);
  });
});

unlockAudioIfNeeded();

var surpriseBtn = document.getElementById('plat-surprise');
if (surpriseBtn) {
  surpriseBtn.addEventListener('click', function() {
    lancerSurpriseAvecRoulette('plat', surpriseBtn);
  });
}

var surpriseEntreeBtn = document.getElementById('entree-surprise');
if (surpriseEntreeBtn) {
  surpriseEntreeBtn.addEventListener('click', function() {
    document.querySelectorAll('#entree-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
    lancerSurpriseAvecRoulette('entree', surpriseEntreeBtn);
  });
}

var surpriseDessertBtn = document.getElementById('dessert-surprise');
if (surpriseDessertBtn) {
  surpriseDessertBtn.addEventListener('click', function() {
    document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
    lancerSurpriseAvecRoulette('dessert', surpriseDessertBtn);
  });
}

document.getElementById('plat-reset').addEventListener('click', function() {
  document.querySelectorAll('.mood-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('plat-results').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── PAGE ENTRÉE ─────────────────────────────────────────────────
var envieLabels = {
  'frais':  'Frais & Léger 🌿',
  'chaud':  'Chaud & Réconfortant 🔥',
  'festif': 'Coloré & Festif 🎉',
  'express':'Express ⚡'
};

document.querySelectorAll('#entree-grid .envie-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#entree-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');

    var envie = btn.dataset.envie;
    var found = RECETTES.entrees.filter(function(r) { return r.envies.indexOf(envie) !== -1; });

    document.getElementById('entree-results-title').textContent = envieLabels[envie] || '';
    afficherGrille('entree-results-grid', found);

    var res = document.getElementById('entree-results');
    res.style.display = 'block';
    setTimeout(function() { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  });
});

document.getElementById('entree-reset').addEventListener('click', function() {
  document.querySelectorAll('#entree-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('entree-results').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── PAGE DESSERT ────────────────────────────────────────────────
var textureLabels = {
  'chocolaté':    'Tout en chocolat 🍫',
  'fruité':       'Fruité & Frais 🍓',
  'croustillant': 'Croustillant à souhait 🥐',
  'crémeux':      'Fondant & Crémeux 🍮'
};

document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');

    var tex   = btn.dataset.texture;
    var found = RECETTES.desserts.filter(function(r) { return r.textures.indexOf(tex) !== -1; });

    document.getElementById('dessert-results-title').textContent = textureLabels[tex] || '';
    afficherGrille('dessert-results-grid', found);

    var res = document.getElementById('dessert-results');
    res.style.display = 'block';
    setTimeout(function() { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  });
});

document.getElementById('dessert-reset').addEventListener('click', function() {
  document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('dessert-results').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── PAGE DÉCOUVRIR ──────────────────────────────────────────────
var filtreActif = 'tous';
var recherche   = '';

document.querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    filtreActif = tab.dataset.filter;
    afficherDecouvrir();
  });
});

var searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', function(e) {
    recherche = e.target.value.toLowerCase().trim();
    afficherDecouvrir();
  });
}

function afficherDecouvrir() {
  var pool = [];
  if (filtreActif === 'tous' || filtreActif === 'plat')    pool = pool.concat(RECETTES.plats);
  if (filtreActif === 'tous' || filtreActif === 'entree')   pool = pool.concat(RECETTES.entrees);
  if (filtreActif === 'tous' || filtreActif === 'dessert')  pool = pool.concat(RECETTES.desserts);

  if (recherche) {
    pool = pool.filter(function(r) {
      return r.nom.toLowerCase().indexOf(recherche) !== -1
          || r.description.toLowerCase().indexOf(recherche) !== -1
          || (r.origine || '').toLowerCase().indexOf(recherche) !== -1
          || (r.tags || []).some(function(t) { return t.toLowerCase().indexOf(recherche) !== -1; })
          || (r.ingredients || []).some(function(i) { return i.toLowerCase().indexOf(recherche) !== -1; });
    });
  }

  var grid = document.getElementById('decouvrir-grid');
  if (!grid) return;

  if (!pool.length) {
    grid.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>Aucune recette trouvée.</p></div>';
    return;
  }

  // Dans Découvrir on affiche tout, avec badge "vu récemment" si applicable
  grid.innerHTML = pool.map(function(r) {
    return carteHTML(r, estVuRecemment(r._type, r.id));
  }).join('');
}

afficherDecouvrir();

// ── MODAL ───────────────────────────────────────────────────────
function trouverRecette(type, id) {
  var sources = { plat: RECETTES.plats, entree: RECETTES.entrees, dessert: RECETTES.desserts };
  var liste = sources[type] || [];
  return liste.find(function(r) { return r.id === id; }) || null;
}

function normaliserIngredients(r) {
  var necessaires = [];
  var optionnels = [];

  if (Array.isArray(r.ingredients)) {
    necessaires = r.ingredients;
  } else if (r.ingredients && typeof r.ingredients === 'object') {
    necessaires = Array.isArray(r.ingredients.necessaires) ? r.ingredients.necessaires : [];
    optionnels = Array.isArray(r.ingredients.optionnels) ? r.ingredients.optionnels : [];
  }

  if (Array.isArray(r.ingredientsOptionnels)) {
    optionnels = optionnels.concat(r.ingredientsOptionnels);
  }
  if (Array.isArray(r.optionnels)) {
    optionnels = optionnels.concat(r.optionnels);
  }

  return {
    necessaires: necessaires,
    optionnels: optionnels
  };
}

function nettoyerIngredientSansMesure(ingredient) {
  var s = String(ingredient || '').trim();
  if (!s) return s;

  // Retire quantité + unité en début de chaîne (ex: "250 g", "1/2", "20 cl", "3 c. à soupe").
  s = s.replace(/^\s*(?:\d+(?:[\.,]\d+)?(?:\s*\/\s*\d+)?|\d+\s*(?:à|-|–)\s*\d+|un|une|quelques?)\s*(?:kg|g|mg|l|cl|ml|c\.?\s*à\s*c\.?|c\.?\s*à\s*s\.?|cuill(?:e|è)re?s?\s*à\s*(?:café|soupe)|sachet(?:s)?|pot(?:s)?|pinc(?:é|e)e?s?|bo[iî]te(?:s)?|verre(?:s)?|filet(?:s)?|tranche(?:s)?|pi[eè]ce(?:s)?|gousse(?:s)?|branches?|feuilles?)?\s*/i, '');
  s = s.replace(/^[dD]'|^[dD]e\s+|^[lL]a\s+|^[lL]e\s+|^[lL]es\s+/, '');
  return s.trim();
}

function ouvrirModal(type, id) {
  var r = trouverRecette(type, id);
  if (!r) return;

  // Enregistrer dans l'historique 3 jours
  enregistrerDansHistorique(type, id);

  var ingredients = normaliserIngredients(r);

  var ingredientsHTML = (ingredients.necessaires || []).map(function(i) {
    return '<li>' + nettoyerIngredientSansMesure(i) + '</li>';
  }).join('');

  var optionnelsHTML = (ingredients.optionnels || []).map(function(i) {
    return '<li>' + nettoyerIngredientSansMesure(i) + '</li>';
  }).join('');

  var tagsHTML = (r.tags || []).slice(0, 4).map(function(t) {
    return '<span class="badge">' + t + '</span>';
  }).join('');

  document.getElementById('modal-body').innerHTML = [
    '<div class="modal-emoji">' + r.emoji + '</div>',
    '<div class="modal-origine">' + (r.origine || '') + '</div>',
    '<div class="modal-nom">' + r.nom + '</div>',
    '<div class="modal-desc">' + r.description + '</div>',
    '<div class="modal-meta">',
    '  <span class="badge">⏱ ' + r.temps + ' min</span>',
    '  ' + badgeDiff(r.difficulte),
    '  ' + tagsHTML,
    '</div>',
    '<div class="modal-bloc">',
    '  <div class="modal-section-title">Ingrédients nécessaires</div>',
    '  <ul class="modal-ingredients-list">' + ingredientsHTML + '</ul>',
    '</div>',
    optionnelsHTML ? '<div class="modal-bloc"><div class="modal-section-title">Ingrédients optionnels</div><ul class="modal-ingredients-list">' + optionnelsHTML + '</ul></div>' : ''
  ].join('\n');

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fermerModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  // Rafraîchir Découvrir pour mettre à jour les badges
  afficherDecouvrir();
}

document.getElementById('modal-close').addEventListener('click', fermerModal);

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === document.getElementById('modal-overlay')) fermerModal();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') fermerModal();
  if (e.key === 'Enter' && e.target.classList.contains('recipe-card')) e.target.click();
});
