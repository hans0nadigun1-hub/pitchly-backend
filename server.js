require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabase     = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ══════════════════════════════════════════════════════════
// MESSAGES
// Relance 1 : 14j inactif  → ton chaleureux
// Relance 2 : 28j inactif  → ton humour + offre
// Au-delà   : stop définitif
// ══════════════════════════════════════════════════════════
const MSG = {
  restaurant: {
    r1_sms:  (p,b) => `Bonjour ${p} ! Cela fait 2 semaines sans vous voir chez ${b} 😊 Notre chef a de nouveaux plats pour vous. On vous attend !`,
    r1_subj: (p,b) => `${p}, on pensait à vous chez ${b}`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines que vous n'êtes pas venu(e) chez ${b} et toute l'équipe pense à vous.\n\nNotre carte a évolué et nous avons de nouveaux plats qui, on en est sûrs, vous plairont.\n\nNous serions ravis de vous accueillir à nouveau très bientôt.\n\nÀ bientôt,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}... on a une question urgente 👀 Est-ce qu'on vous a fait quelque chose ? 😅 On vous réserve une surprise chez ${b}. Dernière chance !`,
    r2_subj: (p,b) => `${p}, on ne vous oublie pas — quelque chose vous attend`,
    r2_body: (p,b) => `Bonjour ${p},\n\nOn revient vers vous une dernière fois, parce que vous comptez vraiment pour nous chez ${b}.\n\nUne petite surprise vous attend à votre prochain passage — venez nous voir, on sera aux petits soins.\n\nÀ très vite,\nL'équipe ${b}`,
  },
  coiffure: {
    r1_sms:  (p,b) => `${p}, cela fait 2 semaines ✂️ Il est temps de passer chez ${b} ! On a de la disponibilité pour vous.`,
    r1_subj: (p,b) => `${p}, votre prochain rendez-vous chez ${b}`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines depuis votre dernière visite chez ${b}.\n\nNos stylistes ont hâte de vous retrouver. Contactez-nous pour fixer un rendez-vous rapidement.\n\nÀ bientôt,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, vos cheveux nous manquent 😄 Revenez chez ${b} — une surprise vous attend pour votre retour !`,
    r2_subj: (p,b) => `${p}, une surprise vous attend au salon ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nNous revenons vers vous une dernière fois.\n\nVotre fidélité est précieuse chez ${b} et un geste vous attend à votre prochain passage.\n\nÀ très bientôt,\nL'équipe ${b}`,
  },
  garage: {
    r1_sms:  (p,b) => `Bonjour ${p}, 2 semaines sans entretien chez ${b} 🔧 La saison change — pensez à votre véhicule !`,
    r1_subj: (p,b) => `${p}, votre véhicule mérite un contrôle chez ${b}`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines que votre véhicule n'est pas passé chez ${b}.\n\nUn entretien régulier évite les mauvaises surprises. Notre équipe est disponible pour vous recevoir rapidement.\n\nCordialement,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, votre voiture nous a appelés 😄 Elle dit qu'elle s'ennuie ! Passez chez ${b} — offre spéciale pour vous 🚗`,
    r2_subj: (p,b) => `${p}, offre exclusive — votre prochain entretien chez ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nOn revient vers vous une dernière fois avec une offre réservée à nos clients fidèles chez ${b}.\n\nContactez-nous en mentionnant ce message.\n\nCordialement,\nL'équipe ${b}`,
  },
  hotel: {
    r1_sms:  (p,b) => `${p}, cela fait 2 semaines depuis votre séjour chez ${b} 🏨 On aimerait vous revoir — offre ancien client disponible !`,
    r1_subj: (p,b) => `${p}, une offre exclusive vous attend chez ${b}`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines depuis votre séjour chez ${b}.\n\nNous espérons que vous en gardez un excellent souvenir et aimerions vous accueillir à nouveau avec une offre exclusive réservée à nos anciens clients.\n\nChaleureusement,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, une dernière fois 😊 ${b} vous réserve quelque chose de spécial. Répondez à ce message pour en profiter !`,
    r2_subj: (p,b) => `${p}, votre offre exclusive expire bientôt — ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nNous revenons vers vous une dernière fois avec une offre vraiment exclusive chez ${b}.\n\nRépondez simplement à cet email pour en bénéficier.\n\nChaleureusement,\nL'équipe ${b}`,
  },
  beaute: {
    r1_sms:  (p,b) => `${p}, cela fait 2 semaines sans soin chez ${b} 💆 Votre bien-être mérite mieux ! On a de la disponibilité.`,
    r1_subj: (p,b) => `${p}, votre rituel bien-être chez ${b} vous attend`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines depuis votre dernier soin chez ${b}.\n\nNous avons de nouveaux rituels adaptés à la saison. Notre équipe serait ravie de vous chouchouter à nouveau.\n\nÀ bientôt,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, votre peau et vos cheveux ont besoin de vous 😄 Dernière relance — une surprise vous attend chez ${b} !`,
    r2_subj: (p,b) => `${p}, une surprise vous attend chez ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nOn revient vers vous une dernière fois chez ${b}.\n\nUn soin offert ou une remise vous attend à votre prochain rendez-vous. Prenez soin de vous.\n\nÀ très bientôt,\nL'équipe ${b}`,
  },
  sport: {
    r1_sms:  (p,b) => `${p}, 2 semaines sans séance chez ${b} 💪 Votre corps vous attend — on a un nouveau programme pour vous !`,
    r1_subj: (p,b) => `${p}, votre programme de retour chez ${b}`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines depuis votre dernière séance chez ${b}.\n\nNos coachs ont préparé un programme de reprise adapté pour vous. Revenez quand vous voulez — on est là.\n\nÀ bientôt,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, on ne vous juge pas mais… 2 semaines de plus 😅 Revenez chez ${b} — une offre de reprise vous attend !`,
    r2_subj: (p,b) => `${p}, votre offre de reprise chez ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nOn revient vers vous une dernière fois chez ${b}.\n\nUne offre de reprise spéciale vous attend — parce que votre bien-être compte pour nous.\n\nÀ très bientôt,\nL'équipe ${b}`,
  },
  default: {
    r1_sms:  (p,b) => `Bonjour ${p} ! Cela fait 2 semaines sans vous voir chez ${b} 😊 On pense à vous et on vous attend !`,
    r1_subj: (p,b) => `${p}, l'équipe ${b} pense à vous`,
    r1_body: (p,b) => `Bonjour ${p},\n\nCela fait deux semaines que vous n'êtes pas venu(e) nous voir chez ${b}.\n\nToute l'équipe pense à vous et serait ravie de vous accueillir à nouveau.\n\nÀ très bientôt,\nL'équipe ${b}`,
    r2_sms:  (p,b) => `${p}, on revient vers vous une dernière fois 😊 Une surprise vous attend chez ${b}. À bientôt !`,
    r2_subj: (p,b) => `${p}, quelque chose vous attend chez ${b}`,
    r2_body: (p,b) => `Bonjour ${p},\n\nNous revenons vers vous une dernière fois chez ${b}.\n\nUne attention particulière vous attend à votre prochain passage.\n\nÀ très bientôt,\nL'équipe ${b}`,
  }
};

function getMsg(sector) { return MSG[sector] || MSG.default; }

// ══════════════════════════════════════════════════════════
// ENVOI SMS — Twilio
// ══════════════════════════════════════════════════════════
async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE;
  if (!sid || !token || !from) {
    console.log(`[SMS SIMULATION] → ${to}: ${body}`);
    return { simulated: true };
  }
  const res = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ To: to, From: from, Body: body }),
    { auth: { username: sid, password: token } }
  );
  return res.data;
}

// ══════════════════════════════════════════════════════════
// ENVOI EMAIL — Brevo (300/jour gratuit)
// ══════════════════════════════════════════════════════════
async function sendEmail(to, toName, subject, text, fromName) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.log(`[EMAIL SIMULATION] → ${to} | ${subject}`);
    return { simulated: true };
  }
  const res = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender:      { name: fromName, email: process.env.BREVO_FROM_EMAIL || 'relance@pitchly.fr' },
      to:          [{ email: to, name: toName }],
      subject,
      textContent: text,
    },
    { headers: { 'api-key': key, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

// ══════════════════════════════════════════════════════════
// MOTEUR DE RELANCE AUTOMATIQUE
// Scanne chaque nuit à minuit
//
// Règle :
//   relance_count = 0 → jamais relancé
//   relance_count = 1 → relancé une fois
//   relance_count = 2 → relancé deux fois → STOP définitif
//
// Déclenchement :
//   Relance 1 : inactif depuis 14j ET relance_count = 0
//   Relance 2 : inactif depuis 28j ET relance_count = 1
//               ET dernière relance il y a au moins 14j
// ══════════════════════════════════════════════════════════
async function runRelanceEngine() {
  console.log(`\n[RELANCE] Scan — ${new Date().toLocaleString('fr-FR')}`);

  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*, restaurants(name, sector)')
      .lt('relance_count', 2)                  // Moins de 2 relances envoyées
      .or('phone.not.is.null,email.not.is.null');

    if (error) { console.error('[RELANCE] Erreur:', error.message); return; }
    if (!clients?.length) { console.log('[RELANCE] Aucun client à traiter.'); return; }

    const now = new Date();
    let sent  = 0;

    for (const client of clients) {
      try {
        const lastVisit   = new Date(client.last_visit);
        const joursInactif = Math.floor((now - lastVisit) / 86400000);
        const prenom      = client.prenom || client.nom || 'cher client';
        const bizName     = client.restaurants?.name || 'votre commerce';
        const sector      = client.restaurants?.sector || client.sector || 'default';
        const m           = getMsg(sector);
        const count       = client.relance_count || 0;

        // ── RELANCE 1 : 14j inactif, jamais relancé ──
        if (joursInactif >= 14 && count === 0) {
          console.log(`[R1] ${prenom} — ${joursInactif}j — ${bizName}`);
          if (client.phone) await sendSMS(client.phone, m.r1_sms(prenom, bizName));
          if (client.email) await sendEmail(client.email, prenom, m.r1_subj(prenom, bizName), m.r1_body(prenom, bizName), bizName);
          await supabase.from('clients').update({
            relance_count:   1,
            relance_sent_at: now.toISOString(),
          }).eq('id', client.id);
          sent++;
        }

        // ── RELANCE 2 : 28j inactif, déjà relancé 1 fois, 14j depuis la R1 ──
        else if (joursInactif >= 28 && count === 1) {
          const lastRelance = client.relance_sent_at ? new Date(client.relance_sent_at) : null;
          const joursSinceR1 = lastRelance ? Math.floor((now - lastRelance) / 86400000) : 999;

          if (joursSinceR1 >= 14) {
            console.log(`[R2] ${prenom} — ${joursInactif}j — ${bizName}`);
            if (client.phone) await sendSMS(client.phone, m.r2_sms(prenom, bizName));
            if (client.email) await sendEmail(client.email, prenom, m.r2_subj(prenom, bizName), m.r2_body(prenom, bizName), bizName);
            await supabase.from('clients').update({
              relance_count:   2,      // STOP — ne sera plus jamais relancé
              relance_sent_at: now.toISOString(),
            }).eq('id', client.id);
            sent++;
          }
        }

        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[RELANCE] Erreur client ${client.id}:`, err.message);
      }
    }

    console.log(`[RELANCE] ${sent} message(s) envoyé(s)\n`);

  } catch (err) {
    console.error('[RELANCE] Erreur moteur:', err.message);
  }
}

// Planifier le scan chaque nuit à minuit
function scheduleRelance() {
  const now   = new Date();
  const night = new Date();
  night.setHours(0, 0, 0, 0);
  night.setDate(night.getDate() + 1);
  const ms = night - now;
  console.log(`[RELANCE] Prochain scan dans ${Math.round(ms/60000)} min`);
  setTimeout(() => {
    runRelanceEngine();
    setInterval(runRelanceEngine, 24 * 60 * 60 * 1000);
  }, ms);
}

// ══════════════════════════════════════════════════════════
// API — Enregistrer une visite client
// Appelé par l'assistant vocal dès qu'un client laisse son contact
// ══════════════════════════════════════════════════════════
app.post('/api/clients/visit', async (req, res) => {
  const { restaurant_id, nom, prenom, email, phone, sector } = req.body;
  if (!restaurant_id || (!email && !phone))
    return res.status(400).json({ error: 'restaurant_id + email ou phone requis' });

  try {
    let query = supabase.from('clients').select('*').eq('restaurant_id', restaurant_id);
    if (email) query = query.eq('email', email);
    else       query = query.eq('phone', phone);
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      // Client revenu → reset relance_count pour le cycle suivant
      await supabase.from('clients').update({
        last_visit:    new Date().toISOString(),
        relance_count: 0,             // Repart à zéro
        relance_sent_at: null,
        visits:        (existing.visits || 0) + 1,
        nom:           nom    || existing.nom,
        prenom:        prenom || existing.prenom,
      }).eq('id', existing.id);
      return res.json({ action: 'updated', visits: (existing.visits || 0) + 1 });
    }

    await supabase.from('clients').insert({
      restaurant_id, nom, prenom,
      email:         email  || null,
      phone:         phone  || null,
      sector:        sector || 'default',
      last_visit:    new Date().toISOString(),
      relance_count: 0,
      visits:        1,
    });
    res.json({ action: 'created' });

  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Voir les clients d'un commerce
app.get('/api/clients/:restaurant_id', async (req, res) => {
  const { data, error } = await supabase
    .from('clients').select('*')
    .eq('restaurant_id', req.params.restaurant_id)
    .order('last_visit', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Stats relance
app.get('/api/relance/stats', async (req, res) => {
  const { data } = await supabase.from('clients').select('relance_count, last_visit');
  const now = new Date();
  res.json({
    total:      data?.length || 0,
    r1_envoyee: data?.filter(c => c.relance_count >= 1)?.length || 0,
    r2_envoyee: data?.filter(c => c.relance_count >= 2)?.length || 0,
    a_relancer: data?.filter(c => {
      const j = Math.floor((now - new Date(c.last_visit)) / 86400000);
      return j >= 14 && (c.relance_count || 0) < 2;
    })?.length || 0,
  });
});

// Déclencher manuellement (test)
app.post('/api/relance/run', async (req, res) => {
  res.json({ message: 'Relance démarrée' });
  runRelanceEngine();
});

// ══════════════════════════════════════════════════════════
// AUTH GOOGLE
// ══════════════════════════════════════════════════════════
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
    const { data: u } = await oauth2.userinfo.get();
    await supabase.from('restaurants').upsert({
      id: u.id, name: restaurant_name || u.name, email: u.email,
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date, connected_at: new Date().toISOString(), active: true
    }, { onConflict: 'id' });
    res.send('<h2>✅ Connexion réussie ! Vous pouvez fermer cette fenêtre.</h2>');
  } catch (err) { res.status(500).send('Erreur: ' + err.message); }
});

// ══════════════════════════════════════════════════════════
// WEBHOOK AVIS GOOGLE
// ══════════════════════════════════════════════════════════
app.post('/webhook/reviews', async (req, res) => {
  res.status(200).json({ received: true });
  try {
    const { name } = req.body; if (!name) return;
    const { data: resto } = await supabase.from('restaurants').select('*').eq('id', name.split('/')[1]).single();
    if (!resto) return;
    const rep = generateReviewResponse(req.body, resto.name);
    await supabase.from('reviews').insert({
      restaurant_id: resto.id, review_id: name,
      reviewer_name: req.body.reviewer?.displayName || 'Client',
      star_rating: starToNumber(req.body.starRating),
      comment: req.body.comment || '', response_text: rep.text,
      response_tone: rep.tone, responded_at: new Date().toISOString(), auto: true
    });
  } catch (err) { console.error('Webhook error:', err.message); }
});

function generateReviewResponse(review, biz) {
  const stars  = starToNumber(review.starRating);
  const prenom = review.reviewer?.displayName?.split(' ')[0] || 'client';
  if (stars >= 4) return { tone:'warm',       text:`Merci infiniment ${prenom} ! Toute l'équipe de ${biz} sera heureuse de vous retrouver bientôt. À bientôt !` };
  if (stars === 3) return { tone:'pro',        text:`Merci ${prenom} pour votre retour. Nous prenons note de vos remarques et allons nous améliorer. À bientôt chez ${biz}.` };
  return             { tone:'empathique',   text:`${prenom}, nous sommes sincèrement désolés. Contactez-nous directement — nous tenons à arranger cela. L'équipe ${biz}.` };
}
function starToNumber(s) { return {ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5}[s]||parseInt(s)||5; }

// ══════════════════════════════════════════════════════════
// API RESTAURANTS + STATS
// ══════════════════════════════════════════════════════════
app.get('/api/restaurants', async (req, res) => {
  const { data, error } = await supabase.from('restaurants').select('id,name,email,connected_at,active');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/stats', async (req, res) => {
  const { data: reviews } = await supabase.from('reviews').select('auto');
  const { data: clients } = await supabase.from('clients').select('relance_count');
  res.json({
    reviews_total:    reviews?.length || 0,
    reviews_auto:     reviews?.filter(r=>r.auto)?.length || 0,
    clients_total:    clients?.length || 0,
    relances_r1:      clients?.filter(c=>c.relance_count>=1)?.length || 0,
    relances_r2:      clients?.filter(c=>c.relance_count>=2)?.length || 0,
  });
});

app.get('/',       (req, res) => res.json({ status:'ok', service:'Pitchly v2.0', relance:'14j + 28j auto' }));
app.get('/health', (req, res) => res.json({ status:'healthy' }));

// ══════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   PITCHLY BACKEND v2.0                   ║
  ║   Port    : ${PORT}                           ║
  ║   Relance : ✅ J14 + J28 — SMS + Email   ║
  ╚══════════════════════════════════════════╝`);
  scheduleRelance();
});

module.exports = app;
