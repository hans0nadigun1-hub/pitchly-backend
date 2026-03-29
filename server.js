require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get('/auth/google', (req, res) => {
  const { restaurant_name } = req.query;
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/business.manage','https://www.googleapis.com/auth/userinfo.email'],
    state: JSON.stringify({ restaurant_name })
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const { restaurant_name } = JSON.parse(state || '{}');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    await supabase.from('restaurants').upsert({
      id: userInfo.id, name: restaurant_name || userInfo.name,
      email: userInfo.email, access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, token_expiry: tokens.expiry_date,
      connected_at: new Date().toISOString(), active: true
    }, { onConflict: 'id' });
    res.send('Connexion reussie ! Vous pouvez fermer cette fenetre.');
  } catch (err) {
    res.status(500).send('Erreur: ' + err.message);
  }
});

app.post('/webhook/reviews', async (req, res) => {
  res.status(200).json({ received: true });
  try {
    const { name } = req.body;
    if (!name) return;
    const accountId = name.split('/')[1];
    const { data: resto } = await supabase.from('restaurants').select('*').eq('id', accountId).single();
    if (!resto) return;
    const review = req.body;
    const response = generateResponse(review, resto.name);
    await supabase.from('reviews').insert({
      restaurant_id: resto.id, review_id: name,
      reviewer_name: review.reviewer?.displayName || 'Client',
      star_rating: starToNumber(review.starRating),
      comment: review.comment || '', response_text: response.text,
      response_tone: response.tone, responded_at: new Date().toISOString(), auto: true
    });
  } catch (err) { console.error(err.message); }
});

app.get('/api/restaurants', async (req, res) => {
  const { data, error } = await supabase.from('restaurants').select('id,name,email,connected_at,active');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/restaurants/:id/reviews', async (req, res) => {
  const { data, error } = await supabase.from('reviews').select('*').eq('restaurant_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/stats', async (req, res) => {
  const { data: reviews } = await supabase.from('reviews').select('star_rating,auto');
  res.json({
    reviews_total: reviews?.length || 0,
    reviews_auto: reviews?.filter(r => r.auto)?.length || 0,
    avg_stars: reviews?.length ? (reviews.reduce((s,r) => s+(r.star_rating||0),0)/reviews.length).toFixed(1) : 0
  });
});

function generateResponse(review, restoName) {
  const stars = starToNumber(review.starRating);
  const prenom = review.reviewer?.displayName?.split(' ')[0] || 'client';
  if (stars >= 4) return { tone: 'warm', text: `Merci infiniment ${prenom} pour ce retour ! Toute l'equipe de ${restoName} sera heureuse de vous retrouver tres prochainement.` };
  if (stars === 3) return { tone: 'pro', text: `Merci ${prenom} pour votre retour. Nous prenons note de vos remarques et allons tout mettre en oeuvre pour nous ameliorer. A bientot chez ${restoName}.` };
  return { tone: 'empathique', text: `${prenom}, nous sommes sincerement desoles pour votre experience. Contactez-nous directement pour que nous puissions arranger cela. L'equipe ${restoName}.` };
}

function starToNumber(s) {
  return {ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5}[s] || parseInt(s) || 5;
}

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'Pitchly Backend' }));
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Pitchly Backend v1.0' }));

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Pitchly Backend running on port ${port}`));
