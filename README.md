# Competitor Intelligence Tool

## Deploy su Vercel (5 minuti)

### 1. Carica il progetto su GitHub
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/TUO-USERNAME/competitor-intelligence.git
git push -u origin main
```

### 2. Deploy su Vercel
1. Vai su **vercel.com** → "Add New Project"
2. Importa il repository GitHub
3. Click **Deploy** (zero configurazione necessaria)

### 3. Aggiungi le variabili d'ambiente
In Vercel → Settings → Environment Variables, aggiungi:

| Nome | Valore | Come ottenerla |
|------|--------|----------------|
| `META_ACCESS_TOKEN` | Il tuo token Meta | developers.facebook.com → Graph API Explorer |
| `SEMRUSH_API_KEY` | La tua chiave SEMrush | semrush.com/user/profile/api |

> Dopo aver aggiunto le variabili, fai **Redeploy** dal dashboard Vercel.

---

## Struttura progetto

```
competitor-intelligence/
├── api/
│   ├── detect.js        ← scraping homepage, trova brand e profili social
│   ├── adlibrary.js     ← Meta Ad Library API (ads attive)
│   ├── semrush.js       ← SEMrush API (traffico, keyword paid, authority)
│   └── techstack.js     ← analisi HTML (tool e pixel rilevati)
├── public/
│   └── index.html       ← frontend completo
├── vercel.json          ← routing
└── package.json
```

---

## Come funziona senza le API key

Il tool funziona anche parzialmente:
- **Senza META_ACCESS_TOKEN**: la tab "Ads attive" mostra un messaggio di configurazione
- **Senza SEMRUSH_API_KEY**: la tab "Canali" mostra un messaggio di configurazione  
- **Tech stack**: funziona sempre (non richiede API key)
- **Rilevamento profili social**: funziona sempre

---

## Aggiungere Claude AI (Fase 2)

Quando vuoi aggiungere la sintesi AI, crea il file `api/analyze.js`:

```javascript
export default async function handler(req, res) {
  const { ads, semrush, tech, domain } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analizza questi dati competitor per ${domain}:
        Ads: ${JSON.stringify(ads)}
        SEMrush: ${JSON.stringify(semrush)}
        Tech: ${JSON.stringify(tech)}
        
        Restituisci JSON con: posizionamento[], gap[], channel_note`
      }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text;
  res.json(JSON.parse(text));
}
```

Poi aggiungi `ANTHROPIC_API_KEY` nelle variabili Vercel e chiama `/api/analyze` dal frontend dopo aver raccolto tutti i dati.

---

## Aggiungere raccolta lead (gate email)

La funzione `submitGate()` in `index.html` già cattura email e dominio.
Per salvarli, crea `api/lead.js` che fa POST a:
- **Airtable** (gratuito): salva i lead in un foglio
- **Resend** (gratuito fino a 3000 email/mese): invia il report via email
- **HubSpot Free CRM**: crea il contatto automaticamente
