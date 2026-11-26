// screens.js — the title, pause and end screens: plain DOM overlays
// over the 3D view, with the sortie list, the controls, and the score
// breakdown line by line.

import { SORTIES, loadBestScore } from './missions.js';

export function buildScreens(onSelectSortie) {
  const title = document.getElementById('title-screen');
  const list = document.getElementById('sortie-list');
  SORTIES.forEach((sortie, i) => {
    const card = document.createElement('div');
    card.className = 'sortie-card';
    card.dataset.index = String(i);
    card.innerHTML = `
      <div class="sortie-name">${sortie.name}</div>
      <div class="sortie-blurb">${sortie.blurb}</div>
      <div class="sortie-dest">Destination: ${sortie.destination}</div>`;
    card.addEventListener('click', () => onSelectSortie(i));
    list.appendChild(card);
  });
  updateBestScore();
  return title;
}

export function updateBestScore() {
  const el = document.getElementById('best-score');
  if (el) el.textContent = `Best score: ${loadBestScore().toLocaleString('en-US')}`;
}

export function highlightSortie(index) {
  const cards = document.querySelectorAll('.sortie-card');
  cards.forEach((card, i) => {
    card.classList.toggle('selected', i === index);
  });
}

export function showScreen(name) {
  for (const id of ['title-screen', 'pause-screen', 'end-screen']) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === `${name}-screen` ? 'flex' : 'none';
  }
}

export function showEndScreen(game, mission, reason) {
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-subtitle');
  const list = document.getElementById('end-breakdown');
  const prompt = document.getElementById('end-prompt');
  const titles = {
    success: 'SORTIE COMPLETE',
    crash: 'CRASHED',
    'fuel-out': 'OUT OF FUEL',
    'time-out': 'TIME UP',
  };
  const subs = {
    success: 'Parcels delivered, rings flown, plane in one piece. Nice flying.',
    crash: 'The courier is down. The sea and the hills keep what they catch.',
    'fuel-out': 'The engine sputtered out and the glide ended where it ended.',
    'time-out': 'The clock ran out before the route was finished.',
  };
  if (title) title.textContent = titles[reason] || 'SORTIE OVER';
  if (title) title.className = reason === 'success' ? 'end-good' : 'end-bad';
  if (sub) sub.textContent = subs[reason] || '';
  if (list) {
    list.innerHTML = '';
    for (const line of mission.breakdown) {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      const label = document.createElement('span');
      label.textContent = line.label;
      const value = document.createElement('span');
      value.className = 'breakdown-value';
      value.textContent = String(line.value);
      row.appendChild(label);
      row.appendChild(value);
      list.appendChild(row);
    }
  }
  if (prompt) {
    prompt.textContent = 'Enter — fly again · R — restart this sortie · T — title screen';
  }
  showScreen('end');
}
