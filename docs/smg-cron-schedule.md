# SMG Scraping Cron Schedule

## Setup Instructions

The SMG scraping should be scheduled using your preferred cron scheduler (e.g., Vercel Cron, GitHub Actions, or a server cron job).

## Schedule

### Previous Period
- **Frequency**: Once on startup, then daily at midnight (00:00)
- **Behavior**: Automatically skips if all 6 stores already exist in DB
- **Endpoint**: `GET /api/scrape-smg?period=previous`

### Current Period
- **Frequency**: Twice daily at 8am and 8pm (08:00, 20:00)
- **Behavior**: Always scrapes fresh and upserts to DB
- **Endpoint**: `GET /api/scrape-smg?period=current`

## Example Cron Configuration

### Using Vercel Cron (vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/scrape-smg?period=previous",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/scrape-smg?period=current",
      "schedule": "0 8,20 * * *"
    }
  ]
}
```

### Using Node.js cron library
```javascript
const cron = require('node-cron');

// Previous period — runs once on startup, then daily at midnight
// Skips automatically if all 6 stores already in DB
cron.schedule('0 0 * * *', async () => {
  console.log('Checking previous period SMG data...');
  await fetch('http://localhost:3000/api/scrape-smg?period=previous');
});

// Current period — runs twice daily at 8am and 8pm
cron.schedule('0 8,20 * * *', async () => {
  console.log('Scraping current period SMG data...');
  await fetch('http://localhost:3000/api/scrape-smg?period=current');
});

// Also run on startup
fetch('http://localhost:3000/api/scrape-smg?period=previous');
fetch('http://localhost:3000/api/scrape-smg?period=current');
```

### Using system cron (crontab)
```bash
# Previous period - daily at midnight
0 0 * * * curl http://localhost:3000/api/scrape-smg?period=previous

# Current period - 8am and 8pm
0 8,20 * * * curl http://localhost:3000/api/scrape-smg?period=current
```

## Health Check

Monitor scraping health using:
```
GET /api/smg-health
```

Returns:
- `previous_period.complete`: true if all 6 stores saved
- `previous_period.missing_stores`: array of missing store numbers
- `current_period.complete`: true if all 6 stores saved
- `current_period.hours_since_scrape`: hours since last current period scrape


