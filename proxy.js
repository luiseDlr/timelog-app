const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Forwards: /timelog/:siteName/<rest> → https://app4.timelog.com/:siteName/api/v1/<rest>
app.use('/timelog/:siteName', async (req, res) => {
  const { siteName } = req.params;
  const apiPath = req.path.slice(1); // remove leading slash
  const query = new URLSearchParams(req.query).toString();
  const url = `https://app4.timelog.com/${siteName}/api/v1/${apiPath}${query ? '?' + query : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    const text = await response.text();
    res.status(response.status).set('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`TimeLog proxy running at http://localhost:${PORT}`));
