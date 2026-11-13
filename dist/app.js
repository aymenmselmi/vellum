// Initialize the interface and load its data from the Node/PostgreSQL API.
import { $, localDate, hydrateIcons } from './js/utils.js';
import { reloadState } from './js/store.js';
import { toast } from './js/ui.js';
import { registerEvents } from './js/events.js';
import { route } from './js/router.js';

$('#year').textContent = new Date().getFullYear();
$('#pickup-date').min = localDate();
$('#pickup-date').value = localDate(1);
$('#return-date').min = localDate(2);
$('#return-date').value = localDate(4);
hydrateIcons();
registerEvents();

try {
  await reloadState();
  route();
} catch (error) {
  toast(error.message);
  $('#car-grid').innerHTML = '<div class="empty-state"><h2>Retrouvons le fil.</h2><p>Le service est momentanément indisponible. Veuillez réessayer dans un instant.</p><button class="button dark" data-action="retry">Réessayer <span>↗</span></button></div>';
}
