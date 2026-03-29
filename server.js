require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Pitchly Backend v1.0' }));
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'Pitchly Backend' }));

app.get('/auth/google', (req, res) => {
  const { restaurant_name } = req.query;
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', prompt: 'consent',
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
  } catch (err) { res.status(500).send('Erreur: ' + err.message); }
});

app.get('/api/restaurants', async (req, res) => {
  const { data, error } = await supabase.from('restaurants').select('id,name,email,connected_at,active');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/stats', async (req, res) => {
  const { data: reviews } = await supabase.from('reviews').select('star_rating,auto');
  res.json({ reviews_total: reviews?.length || 0, reviews_auto: reviews?.filter(r => r.auto)?.length || 0 });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Pitchly Backend running on port ${PORT}`));
