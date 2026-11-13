// Shared dialogs and notifications. Modal state survives the sign-in-to-booking flow.
import { $, esc } from './utils.js';

export const modalState = { pendingCar: null, confirmCallback: null };
let toastTimer;

export function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),4500); }

export function modal(content) { $('#modal-content').innerHTML = `<div class="modal-inner"><button class="modal-close" data-action="close-modal" aria-label="Fermer la fenêtre">×</button>${content}</div>`; if (!$('#modal').open) $('#modal').showModal(); }

export function closeModal() { $('#modal').close(); modalState.pendingCar = null; modalState.confirmCallback = null; }

export function showError(message) { const error = $('#form-error'); if (error) { error.textContent=message; error.hidden=false; } else toast(message); }

export function confirmAction(title,description,label,callback) { modal(`<p class="eyebrow">UNE PETITE CONFIRMATION</p><h2 id="modal-title">${esc(title)}</h2><p>${esc(description)}</p><button class="button dark form-submit" data-action="confirm">${esc(label)} <span>↗</span></button><button class="text-link" style="margin-top:20px" data-action="close-modal">Revenir sans modifier</button>`); modalState.confirmCallback=callback; }

export const errorMarkup = '<p class="form-error" id="form-error" role="alert" hidden></p>';

// Ask the router to repaint without importing feature renderers into the booking code.
export function refreshPage(page) {
  if (page) location.hash = page;
  window.dispatchEvent(new Event('vellum:refresh'));
}
