// French display labels. Stored values and API identifiers remain unchanged.
const labels = {
  Sedan: 'Berline', SUV: 'SUV', Sport: 'Sport', Compact: 'Citadine',
  Automatic: 'Automatique', Manual: 'Manuelle',
  Petrol: 'Essence', Diesel: 'Diesel', Electric: 'Électrique', Hybrid: 'Hybride',
  confirmed: 'Confirmée', completed: 'Terminée', cancelled: 'Annulée', pending: 'En attente',
  cars: 'Véhicules', orders: 'Réservations', members: 'Membres',
  'New to the collection': 'Nouveau dans la collection',
  'The extraordinary, everyday': 'L’exception au quotidien',
  'The everyday, elevated': 'Le quotidien réinventé',
  'Room for possibility': 'Place à toutes vos envies',
  'The weekend escape': 'Une escapade en perspective',
  'A driver’s favourite': 'Le plaisir de conduire',
  'Quietly exceptional': 'L’élégance en toute discrétion',
  'Small car. Big plans.': 'Petite voiture, grandes envies.'
};

export function label(value) { return labels[value] || value; }
