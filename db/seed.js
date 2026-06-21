// Sample data for testing only. Run with: npm run seed
const store = require('./store');

const existing = store.listDeceased();
if (existing.length > 0) {
  console.log('Data already exists (' + existing.length + ' items). Skipping seed.');
  process.exit(0);
}

const d1 = store.addDeceased({
  name: 'الحاجّ محمد عبد الله',
  bio: 'رجل طيّب من أهل القرية، أحبّه الجميع. اللهم اغفر له وارحمه وأسكنه فسيح جناتك.',
  photo: null,
  deeds: ['quran', 'adhkar', 'tasbeeh', 'salah'],
});
store.setStatus(d1.id, 'approved');

const d2 = store.addDeceased({
  name: 'الحاجّة فاطمة',
  bio: 'أمٌّ حنونة، رحمها الله رحمة واسعة.',
  photo: null,
  deeds: ['quran', 'salah'],
});
store.setStatus(d2.id, 'approved');

store.addDua({ deceasedId: d1.id, name: 'من محبيه', text: 'اللهم اغفر له وارحمه واجعل قبره روضة من رياض الجنة.' });

console.log('Sample data added successfully.');
