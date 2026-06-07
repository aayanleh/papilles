// ================================================================
// PAPILLES -- Logique applicative
// ================================================================

// -- HISTORIQUE 3 JOURS ------------------------------------------


// -- MISE A JOUR AUTOMATIQUE ---------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(function(reg) {

    reg.addEventListener('updatefound', function() {
      var newSW = reg.installing;
      newSW.addEventListener('statechange', function() {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // Nouveau SW pret, ancienne version encore active
          afficherBanniereMAJ(newSW);
        }
      });
    });

  });

  // Recharger si le SW prend le controle (apres skipWaiting)
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

function afficherBanniereMAJ(newSW) {
  var banniere = document.createElement('div');
  banniere.className = 'update-banner';
  banniere.innerHTML = '<span>Nouvelle version disponible !</span>'
    + '<button onclick="activerMAJ()">Mettre a jour</button>';
  document.body.appendChild(banniere);
  setTimeout(function() { banniere.classList.add('visible'); }, 50);
  window._newSW = newSW;
}

function activerMAJ() {
  if (window._newSW) {
    window._newSW.postMessage({ type: 'SKIP_WAITING' });
  }
}


var HISTORY_KEY   = 'papilles_historique';
var JOURS_BLOCAGE = 3;
var TOP_PLAT_KEY  = 'papilles_top_plat_jour';

function lireHistorique() {
  try {
    var data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : { plat: [], entree: [], dessert: [] };
  } catch (e) {
    return { plat: [], entree: [], dessert: [] };
  }
}

function sauverHistorique(h) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch (e) {
    console.warn('Papilles : sauvegarde historique impossible.', e);
  }
}

function nettoyerHistorique(h) {
  var limite = JOURS_BLOCAGE * 24 * 60 * 60 * 1000;
  var now    = Date.now();
  ['plat', 'entree', 'dessert'].forEach(function(type) {
    h[type] = (h[type] || []).filter(function(e) { return (now - e.ts) < limite; });
  });
  return h;
}

function enregistrerDansHistorique(type, id) {
  var h    = nettoyerHistorique(lireHistorique());
  var liste = h[type] || [];
  var idx   = liste.findIndex(function(e) { return e.id === id; });
  if (idx >= 0) {
    liste[idx].ts = Date.now();
  } else {
    liste.push({ id: id, ts: Date.now() });
  }
  h[type] = liste;
  sauverHistorique(h);
}

function estVuRecemment(type, id) {
  var h      = nettoyerHistorique(lireHistorique());
  var limite = JOURS_BLOCAGE * 24 * 60 * 60 * 1000;
  var now    = Date.now();
  return (h[type] || []).some(function(e) { return e.id === id && (now - e.ts) < limite; });
}

// -- ENRICHISSEMENT DES DONNEES ----------------------------------
RECETTES.plats    = RECETTES.plats.map(function(r)    { return Object.assign({}, r, { _type: 'plat'    }); });
RECETTES.entrees  = RECETTES.entrees.map(function(r)  { return Object.assign({}, r, { _type: 'entree'  }); });
RECETTES.desserts = RECETTES.desserts.map(function(r) { return Object.assign({}, r, { _type: 'dessert' }); });

// -- NAVIGATION --------------------------------------------------
function naviguerVers(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(function(b) {
    b.classList.toggle('active', b.dataset.page === page);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-page]').forEach(function(btn) {
  btn.addEventListener('click', function() { naviguerVers(btn.dataset.page); });
});

// -- INSTALLATION PWA --------------------------------------------
var deferredInstallPrompt = null;
var installAppBtn = document.getElementById('install-app-btn');

function afficherBoutonInstall(show) {
  if (!installAppBtn) return;
  installAppBtn.classList.toggle('show', !!show);
}

function estDejaInstallee() {
  return window.navigator.standalone === true
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function estNavigateurDesktop() {
  return window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
}

function estContexteInstallableWeb() {
  return location.protocol === 'https:' || location.hostname === 'localhost';
}

function formaterVersionDepuisCache(cacheName) {
  var brut = String(cacheName || '').trim();
  if (!brut) return '';
  var m = brut.match(/(?:^|[-_])v?(\d+(?:\.\d+)*)$/i);
  var version = m ? m[1] : brut;
  return 'Version ' + version;
}

function appliquerVersionBadge(cacheName) {
  var badge = document.getElementById('app-version');
  if (!badge) return;
  var label = formaterVersionDepuisCache(cacheName);
  if (!label) return;
  badge.textContent = label;
  badge.hidden = false;
}

function lireVersionDepuisRecettes() {
  if (typeof version === 'undefined' || version === null) return '';
  return String(version).trim();
}

function afficherVersionDepuisServiceWorker() {
  var recettesVersion = lireVersionDepuisRecettes();
  if (recettesVersion) {
    appliquerVersionBadge(recettesVersion);
    return;
  }

  var fallbackVersion = document.documentElement.getAttribute('data-app-version');
  appliquerVersionBadge(fallbackVersion);
}

if (installAppBtn && estDejaInstallee())                                              afficherBoutonInstall(false);
if (installAppBtn && !estDejaInstallee() && estContexteInstallableWeb() && estNavigateurDesktop()) afficherBoutonInstall(true);
afficherVersionDepuisServiceWorker();

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
    if (!deferredInstallPrompt) {
      alert('Installation PC :\nChrome/Edge > menu (3 points) > Installer Papilles.\nSi absent : recharge la page (Ctrl+F5) puis réessaie.');
      return;
    }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (e) {}
    deferredInstallPrompt = null;
    afficherBoutonInstall(false);
  });
}

// -- BADGE DE DIFFICULTE -----------------------------------------
function badgeDiff(d) {
  var cls = (d === 'facile' || d === 'tres facile' || d === 'très facile') ? 'diff-facile'
          : (d === 'moyen') ? 'diff-moyen' : 'diff-difficile';
  return '<span class="badge ' + cls + '">' + d + '</span>';
}

// -- RENDU HTML D'UNE CARTE RECETTE ------------------------------
function carteHTML(r, recent) {
  var badgeRecent = recent ? '<span class="badge badge-recent">Vu récemment</span>' : '';
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
    '      <span class="badge">&#9200; ' + r.temps + ' min</span>',
    '      ' + badgeDiff(r.difficulte),
    '      ' + badgeRecent,
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

// -- AFFICHAGE D'UNE GRILLE --------------------------------------
function afficherGrille(containerId, recettes) {
  var el = document.getElementById(containerId);
  if (!el) return;

  if (!recettes || recettes.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">&#127859;</div><p>Aucune recette pour cette sélection.</p></div>';
    return;
  }

  var type     = recettes[0]._type;
  var fraiches = recettes.filter(function(r) { return !estVuRecemment(type, r.id); });
  var recentes = recettes.filter(function(r) { return  estVuRecemment(type, r.id); });
  var html     = '';

  if (fraiches.length > 0) {
    html += fraiches.map(function(r) { return carteHTML(r, false); }).join('');
  }
  if (recentes.length > 0) {
    var sep = fraiches.length === 0
      ? 'Tout a deja ete propose cette semaine — voila quand meme :'
      : 'Deja vu récemment';
    html += '<div class="separator-recent"><span>' + sep + '</span></div>';
    html += recentes.map(function(r) { return carteHTML(r, true); }).join('');
  }

  el.innerHTML = html;
}

// -- PAGE PLAT ---------------------------------------------------
var moodLabels = {
  'fatiguée':  'Pour quand t\'es à plat',
  'joyeuse':   'Pour célébrer ce beau jour',
  'stressée':  'Pour décompresser',
  'amoureuse': 'Pour faire battre les cœurs',
  'sportive':  'Pour le corps en mouvement',
  'curieuse':  'Pour voyager sans bouger'
};


var NB_SUGGESTIONS_HUMEUR = 3;
var lastSurpriseByType    = { plat: null, entree: null, dessert: null };
var DUREE_ROULETTE_MS     = 500;
var SON_SURPRISE_ACTIF    = true;
var audioUnlocked         = false;

// FIX #7 : audioFiles et audioElements ont les memes 3 cles
// click    = clic sur un element interactif
// roulette = son pendant l'animation de tirage
// reveal   = son a l'affichage du resultat
var audioFiles = {
  click:    'sounds/click.mp3',
  roulette: 'sounds/roulette_bOfDHqhZ.mp3',
  reveal:   'sounds/roulette_bOfDHqhZ.mp3'
};

var audioElements = {
  click:    null,
  roulette: null,
  reveal:   null
};

var moodPreferences = {
  'fatiguée':  { maxTemps: 30, preferDifficulte: ['très facile', 'facile'], tags: ['rapide', 'express', 'riz', 'familial', 'reconfort'] },
  'joyeuse':   { maxTemps: 40, preferDifficulte: ['facile', 'moyen'],       tags: ['partage', 'convivial', 'barbecue', 'street food'] },
  'stressée':  { maxTemps: 35, preferDifficulte: ['très facile', 'facile'], tags: ['reconfort', 'mijote', 'riz', 'familial'] },
  'amoureuse': { maxTemps: 50, preferDifficulte: ['facile', 'moyen'],       tags: ['partage', 'tradition', 'sauce', 'barbecue'] },
  'sportive':  { maxTemps: 40, preferDifficulte: ['facile', 'moyen'],       tags: ['proteines', 'complet', 'viande', 'poulet'] },
  'curieuse':  { maxTemps: 60, preferDifficulte: ['moyen', 'facile'],       tags: ['tradition', 'africain', 'street food', 'poisson'] }
};

function bonusStableDuJour(id, mood) {
  var d   = new Date();
  var cle = mood + '-' + id + '-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  var h   = 0;
  for (var i = 0; i < cle.length; i++) { h = ((h << 5) - h) + cle.charCodeAt(i); h |= 0; }
  return Math.abs(h % 6);
}

function cleJour(offsetDays) {
  var d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function lireTopPlatJour() {
  try { var raw = localStorage.getItem(TOP_PLAT_KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}

function sauverTopPlatJour(id, mood) {
  try { localStorage.setItem(TOP_PLAT_KEY, JSON.stringify({ id: id, mood: mood, day: cleJour(0) })); }
  catch (e) { console.warn('Papilles : sauvegarde top plat impossible.', e); }
}

function etaitTopHier(id) {
  var top = lireTopPlatJour();
  return !!top && top.id === id && top.day === cleJour(-1);
}

function scorePlatPourHumeur(r, mood) {
  var pref  = moodPreferences[mood] || {};
  var score = 0;
  var tags  = (r.tags || []).map(function(t) { return String(t).toLowerCase(); });
  var diff  = (r.difficulte || '').toLowerCase();
  var temps = Number(r.temps) || 999;

  if ((r.humeurs || []).indexOf(mood) !== -1) score += 60;
  if (!estVuRecemment('plat', r.id))          score += 24;
  if (etaitTopHier(r.id))                     score -= 28;

  if (typeof pref.maxTemps === 'number') {
    score += (temps <= pref.maxTemps) ? 16 : Math.max(-12, pref.maxTemps - temps);
  }
  if ((pref.preferDifficulte || []).indexOf(diff) !== -1) score += 10;
  (pref.tags || []).forEach(function(tag) { if (tags.indexOf(tag) !== -1) score += 4; });
  score += bonusStableDuJour(r.id, mood);
  return score;
}

function platsParHumeurPertinents(mood) {
  var candidats = RECETTES.plats.filter(function(r) { return (r.humeurs || []).indexOf(mood) !== -1; });
  if (!candidats.length) candidats = RECETTES.plats.slice();

  return candidats
    .map(function(r) { return { recette: r, score: scorePlatPourHumeur(r, mood) }; })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.recette.temps || 0) - (b.recette.temps || 0);
    })
    .map(function(x) { return x.recette; });
}

function titreResultatHumeur(mood, nb) {
  var base    = moodLabels[mood] || '';
  var labelNb = (nb <= 1) ? 'Ton plat du jour' : 'Ton plat du jour + 2 alternatives';
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
  if (!forceSurprise) return classes.slice(0, NB_SUGGESTIONS_HUMEUR);

  var pool = classes.slice(0, Math.min(classes.length, 6));
  var idx  = bonusStableDuJour(pool.length + mood.length, mood) % pool.length;
  var principal    = pool[idx];
  var alternatives = classes.filter(function(r) { return r.id !== principal.id; });
  return [principal].concat(alternatives.slice(0, NB_SUGGESTIONS_HUMEUR - 1));
}

function afficherSuggestionsHumeur(mood, forceSurprise) {
  var found = construireSelectionHumeur(mood, !!forceSurprise);
  document.getElementById('plat-results-title').textContent = titreResultatHumeur(mood, found.length);
  afficherGrille('plat-grid', found);
  if (found.length) sauverTopPlatJour(found[0].id, mood);
  var res = document.getElementById('plat-results');
  res.style.display = 'block';
  setTimeout(function() { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
}

function choisirRecetteAleatoire(type, liste) {
  if (!liste || !liste.length) return null;
  if (liste.length === 1)      return liste[0];
  var candidate  = null;
  var tentative  = 0;
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

var audioVolumes = {
  click:    0.3,    // son de clic — discret
  roulette: 0.4,    // son pendant le tirage
  reveal:   0.4     // son au resultat
};

function getAudioElement(kind) {
  if (!SON_SURPRISE_ACTIF || !audioFiles[kind]) return null;
  if (!audioElements[kind]) {
    var a     = new Audio(audioFiles[kind]);
    a.preload = 'auto';
    a.volume  = audioVolumes[kind] !== undefined ? audioVolumes[kind] : 0.4;
    audioElements[kind] = a;
  }
  return audioElements[kind];
}

function unlockAudioIfNeeded() {
  if (!SON_SURPRISE_ACTIF || audioUnlocked) return;
  var unlock = function() {
    ['click', 'roulette', 'reveal'].forEach(function(kind) {
      var a = getAudioElement(kind);
      if (!a) return;
      try {
        a.muted = true;
        var p   = a.play();
        if (p && typeof p.then === 'function') {
          p.then(function() { a.pause(); a.currentTime = 0; a.muted = false; })
           .catch(function()  { a.muted = false; });
        } else {
          a.pause(); a.currentTime = 0; a.muted = false;
        }
      } catch (e) {}
    });
    audioUnlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart',  unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart',  unlock, { once: true, passive: true });
}

var audioStartTime = {
  click:    0.25,     // commence au debut
  roulette: 1,   // ignore la premiere seconde
};

function jouerFichierSon(kind) {
  try {
    var a = getAudioElement(kind);
    if (!a) return;
    a.currentTime = audioStartTime[kind] !== undefined ? audioStartTime[kind] : 0;
    var p = a.play();
    if (p && typeof p.catch === 'function') p.catch(function() {});
  } catch (e) {}
}

function arreterSon(kind) {
  var a = getAudioElement(kind);
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch (e) {}
}

function jouerSonRoulette() { jouerFichierSon('roulette'); }
function jouerSonReveal()   { jouerFichierSon('reveal');   }

var audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function jouerTickSynthetique() {
  try {
    var ctx  = getAudioContext();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
}

function activerSonClickGlobal() {
  var sel = 'button, [data-page], .mood-btn, .envie-btn, .naim-btn, .filter-tab, .recipe-card, #modal-close, [role="button"]';
  document.addEventListener('click', function(e) {
    var cible = e.target && e.target.closest ? e.target.closest(sel) : null;
    if (!cible) return;
    jouerTickSynthetique();
    if ('vibrate' in navigator) navigator.vibrate(8);
  }, true);
}

// -- SURPRISE CATEGORIE ------------------------------------------
function afficherSurpriseCategorie(type) {
  var map = {
    plat:    { titreId: 'plat-results-title',    gridId: 'plat-grid',          blocId: 'plat-results',    titre: 'Surprise Plat · 1 idee'    },
    entree:  { titreId: 'entree-results-title',  gridId: 'entree-results-grid', blocId: 'entree-results',  titre: 'Surprise Entree · 1 idee'  },
    dessert: { titreId: 'dessert-results-title', gridId: 'dessert-results-grid',blocId: 'dessert-results', titre: 'Surprise Dessert · 1 idee' }
  };
  var cfg    = map[type];
  var source = (type === 'plat') ? RECETTES.plats : (type === 'entree') ? RECETTES.entrees : RECETTES.desserts;
  if (!cfg || !source || !source.length) return;

  var proposition = choisirRecetteAleatoire(type, source);
  if (!proposition) return;

  var titre = document.getElementById(cfg.titreId);
  if (titre) titre.textContent = cfg.titre;
  afficherGrille(cfg.gridId, [proposition]);

  var bloc = document.getElementById(cfg.blocId);
  if (bloc) {
    bloc.style.display = 'block';
    setTimeout(function() { bloc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }
}

// overrideFn : remplace afficherSurpriseCategorie (utile pour le plat mood-aware)
function lancerSurpriseAvecRoulette(type, btn, overrideFn) {
  if (!btn) {
    if (overrideFn) overrideFn(); else afficherSurpriseCategorie(type);
    jouerSonReveal();
    return;
  }
  if (btn.dataset.busy === '1') return;

  var texteInitial  = btn.innerHTML;
  btn.dataset.busy  = '1';
  btn.disabled      = true;
  btn.classList.add('is-spinning');
  btn.innerHTML     = 'Tirage...';
  jouerSonRoulette();

  setTimeout(function() {
    if (overrideFn) overrideFn(); else afficherSurpriseCategorie(type);
    arreterSon('roulette');
    jouerSonReveal();
    btn.innerHTML     = texteInitial;
    btn.classList.remove('is-spinning');
    btn.disabled      = false;
    btn.dataset.busy  = '0';
  }, DUREE_ROULETTE_MS);
}

// -- FIX #3 : Surprise Plat respecte l'humeur selectionnee -------
// Le libelle par defaut est lu depuis le HTML pour eviter les emojis dans le JS
var surpriseBtn = document.getElementById('plat-surprise');
var LIBELLE_SURPRISE_DEFAULT = surpriseBtn ? surpriseBtn.innerHTML : 'Surprise, decide pour moi';
var LIBELLE_SURPRISE_MOOD    = 'Autre idee pour cette humeur';

document.querySelectorAll('.mood-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var mood = btn.dataset.mood;
    marquerBoutonHumeur(mood);
    afficherSuggestionsHumeur(mood, false);
    if (surpriseBtn) surpriseBtn.innerHTML = LIBELLE_SURPRISE_MOOD;
  });
});

unlockAudioIfNeeded();
activerSonClickGlobal();

if (surpriseBtn) {
  surpriseBtn.addEventListener('click', function() {
    var moodActive = document.querySelector('.mood-btn.selected');
    if (moodActive) {
      var mood = moodActive.dataset.mood;
      lancerSurpriseAvecRoulette('plat', surpriseBtn, function() {
        afficherSuggestionsHumeur(mood, true);
      });
    } else {
      lancerSurpriseAvecRoulette('plat', surpriseBtn);
    }
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
  if (surpriseBtn) surpriseBtn.innerHTML = LIBELLE_SURPRISE_DEFAULT;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// -- PAGE ENTREE -------------------------------------------------
var envieLabels = {
  'frais':   'Frais & Léger',
  'chaud':   'Chaud & Réconfortant',
  'festif':  'Coloré & Festif',
  'express': 'Express'
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

// -- PAGE DESSERT ------------------------------------------------
// Labels affiches dans le titre des resultats
var textureLabels = {
  'moelleux':     'Moelleux & Doux',
  'cremeux':      'Crémeux & Fondant',
  'croustillant': 'Croustillant & Doré',
  'frais':        'Frais & Fruité'
};

// Mapping bouton -> textures acceptees dans recettes.js
// Permet de couvrir plusieurs valeurs avec un seul bouton
var textureMapping = {
  'moelleux':     ['moelleux'],
  'cremeux':      ['cremeux', 'crémeux', 'fondant'],
  'croustillant': ['croustillant'],
  'frais':        ['frais', 'juteux']
};

document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#dessert-grid .envie-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');

    var bouton      = btn.dataset.texture;
    var texValides  = textureMapping[bouton] || [bouton];

    var found = RECETTES.desserts.filter(function(r) {
      return (r.textures || []).some(function(t) { return texValides.indexOf(t) !== -1; });
    });

    document.getElementById('dessert-results-title').textContent = textureLabels[bouton] || '';
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

// -- PAGE DECOUVRIR ----------------------------------------------
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
  if (filtreActif === 'tous' || filtreActif === 'naim')     pool = pool.concat(RECETTES.naim || []);


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
    grid.innerHTML = '<div class="empty"><div class="empty-icon">&#128269;</div><p>Aucune recette trouvée.</p></div>';
    return;
  }

  grid.innerHTML = pool.map(function(r) { return carteHTML(r, estVuRecemment(r._type, r.id)); }).join('');
}

afficherDecouvrir();

// -- MODAL -------------------------------------------------------
function trouverRecette(type, id) {
  var sources = { plat: RECETTES.plats, entree: RECETTES.entrees, dessert: RECETTES.desserts, naim:RECETTES.naim || []
 };
  return (sources[type] || []).find(function(r) { return r.id === id; }) || null;
}

function normaliserIngredients(r) {
  var necessaires = [];
  var optionnels  = [];
  if (Array.isArray(r.ingredients)) {
    necessaires = r.ingredients;
  } else if (r.ingredients && typeof r.ingredients === 'object') {
    necessaires = Array.isArray(r.ingredients.necessaires) ? r.ingredients.necessaires : [];
    optionnels  = Array.isArray(r.ingredients.optionnels)  ? r.ingredients.optionnels  : [];
  }
  if (Array.isArray(r.ingredientsOptionnels)) optionnels = optionnels.concat(r.ingredientsOptionnels);
  if (Array.isArray(r.optionnels))            optionnels = optionnels.concat(r.optionnels);
  return { necessaires: necessaires, optionnels: optionnels };
}

function nettoyerIngredientSansMesure(ingredient) {
  var s = String(ingredient || '').trim();
  if (!s) return s;
  s = s.replace(/^\s*(?:\d+(?:[\.,]\d+)?(?:\s*\/\s*\d+)?|\d+\s*(?:a|-)\s*\d+|un|une|quelques?)\s*(?:kg|g|mg|l|cl|ml|c\.?\s*a\s*c\.?|c\.?\s*a\s*s\.?|cuillere?s?\s*a\s*(?:cafe|soupe)|sachet(?:s)?|pot(?:s)?|pincee?s?|boite(?:s)?|verre(?:s)?|filet(?:s)?|tranche(?:s)?|piece(?:s)?|gousse(?:s)?|branches?|feuilles?)?\s*/i, '');
  s = s.replace(/^[dD]'|^[dD]e\s+|^[lL]a\s+|^[lL]e\s+|^[lL]es\s+/, '');
  return s.trim();
}

function ouvrirModal(type, id) {
  var r = trouverRecette(type, id);
  if (!r) return;

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
    '  <span class="badge">&#9200; ' + r.temps + ' min</span>',
    '  ' + badgeDiff(r.difficulte),
    '  ' + tagsHTML,
    '</div>',
    '<div class="modal-bloc">',
    '  <div class="modal-section-title">Ingr&#233;dients n&#233;cessaires</div>',
    '  <ul class="modal-ingredients-list">' + ingredientsHTML + '</ul>',
    '</div>',
    optionnelsHTML
      ? '<div class="modal-bloc"><div class="modal-section-title">Ingr&#233;dients optionnels</div><ul class="modal-ingredients-list">' + optionnelsHTML + '</ul></div>'
      : '',
    // FIX #14 : bouton de partage
    '<div class="modal-actions">',
    '  <button class="share-btn" onclick="partagerRecette(\'' + r._type + '\', ' + r.id + ')" aria-label="Partager cette recette">',
    '    Partager cette recette',
    '  </button>',
    '</div>'
  ].join('\n');

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fermerModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
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

// -- PARTAGE DE RECETTE (#14) ------------------------------------
function partagerRecette(type, id) {
  var r = trouverRecette(type, id);
  if (!r) return;

  var texteIngredients = (r.ingredients || []).slice(0, 5).join(', ');
  var shareData = {
    title: 'Papilles — ' + r.nom,
    text:  r.nom + '\n' + r.description
           + '\nIngredients : ' + texteIngredients
           + '\n' + r.temps + ' min · ' + r.difficulte,
    url:   'https://ayanlehmahdi.github.io/papilles/'
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    navigator.share(shareData).catch(function(err) {
      if (err.name !== 'AbortError') console.warn('Partage echoue.', err);
    });
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareData.title + '\n' + shareData.text + '\n' + shareData.url)
      .then(function()  { afficherToast('Recette copiee dans le presse-papiers !'); })
      .catch(function() { afficherToast('Partage non disponible sur ce navigateur.'); });
  } else {
    afficherToast('Partage non disponible sur ce navigateur.');
  }
}

// -- TOAST NOTIFICATION ------------------------------------------
function afficherToast(message) {
  var toast         = document.createElement('div');
  toast.className   = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('toast-visible'); }, 10);
  setTimeout(function() {
    toast.classList.remove('toast-visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 2800);
}

// -- NAIM : enrichissement ------------------------------------
RECETTES.naim = (RECETTES.naim || []).map(function(r) {
    return Object.assign({}, r, { _type: 'naim' });
});

// -- NAIM : filtres ------------------------------------------
document.querySelectorAll('#naim-grid .naim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#naim-grid .naim-btn').forEach(function(b) {
            b.classList.remove('selected');
        });
        btn.classList.add('selected');

        var cat   = btn.dataset.categorie;
        var found = cat === 'tous'
            ? RECETTES.naim
            : RECETTES.naim.filter(function(r) { return r.categorie === cat; });

        afficherGrille('naim-grid-results', found);
    });
});

// Afficher tout par defaut au chargement
afficherGrille('naim-grid-results', RECETTES.naim);