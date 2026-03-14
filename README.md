# TimeLog Time Registration App

A mobile-first React Native app (powered by Expo) that lets you log work hours and absences directly against your [TimeLog](https://www.timelog.com) account — no browser login required, just a Personal Access Token (PAT).

---

## What This App Does

This app connects to the **TimeLog REST API** and lets you:

- **Log time entries** against a Customer → Project → Task hierarchy
- **Register absences** using your company's active absence codes
- **Pick a date** for each entry (defaults to today)
- **Toggle billable/non-billable** per entry
- **Add comments** (required or optional depending on the task configuration)
- **View all entries** logged for the selected date
- **Check timesheet status** (Open / Submitted / Approved / Rejected)
- **Submit your timesheet for approval** directly from the app

---

## How It Works

### Authentication

The app does **not store any credentials**. On the login screen you enter:

- **Site Name** — your TimeLog subdomain (e.g. `my_company`)
- **Personal Access Token (PAT)** — generated from your TimeLog account settings

The PAT is used only in memory for the duration of the session and sent as a `Bearer` token on every API call.

### Step-by-Step Time Registration

Time entries follow a guided 4-step wizard:

1. **Customer** — pick from all customers in your TimeLog site
2. **Project** — filtered to the selected customer
3. **Task** — filtered to the selected project, sorted by recent registrations
4. **Details** — enter date, hours, billable toggle, and an optional comment

A breadcrumb bar at the top lets you jump back to any previous step and change your selection.

### Absence Registration

Switch to the **Absence** tab to log absence hours using your company's configured absence codes. Works the same way as time entries (date, hours, optional comment).

### Timesheet Submission

After logging entries, the app shows a **Timesheet Status** card for the selected date. If the status is *Open* or *Rejected* and there are entries, you can submit the timesheet for manager approval with one tap.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React Native](https://reactnative.dev) + [Expo](https://expo.dev) ~55 |
| UI runtime | React Native Web (runs in browser via Expo web) |
| Date picker | `@react-native-community/datetimepicker` |
| Dropdown picker | `@react-native-picker/picker` |
| API | TimeLog REST API v1 (`app4.timelog.com`) |
| CORS proxy | Node.js + Express (`proxy.js`) — web only |
| Process runner | `concurrently` (starts proxy + Expo together) |

---

## Project Structure

```
timelog-app/
├── App.js                          # Root component, manages login/session state
├── proxy.js                        # Local Express proxy (CORS workaround for web)
├── index.js                        # Expo entry point
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js          # PAT + site name login form
│   │   └── TimeRegistrationScreen.js  # Main time/absence registration UI
│   ├── components/
│   │   ├── Banner.js               # Success/error notification banner
│   │   └── LoadingOverlay.js       # Full-screen loading indicator
│   └── services/
│       └── timelogApi.js           # All TimeLog REST API calls
└── assets/                         # App icons and splash images
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A TimeLog account with a valid PAT

### Install dependencies

```bash
npm install
```

### Run (web — recommended for development)

```bash
npm start
```

This starts two processes simultaneously:
- The **CORS proxy** on `http://localhost:3001` (forwards requests to TimeLog to avoid browser CORS restrictions)
- The **Expo dev server** which opens the app at `http://localhost:8081`

### Run on mobile

```bash
npm run android   # Android emulator or device
npm run ios       # iOS simulator (macOS only)
```

On native platforms the app calls the TimeLog API directly without the proxy.

---

## The CORS Proxy

Browsers block direct API calls to external domains. The `proxy.js` file is a lightweight Express server that forwards requests from the web app to TimeLog:

```
Browser → http://localhost:3001/timelog/{siteName}/... → https://app4.timelog.com/{siteName}/api/v1/...
```

This proxy runs **locally only** and is not needed for native (Android/iOS) builds.

---

## API Endpoints Used

| Action | Endpoint |
|---|---|
| Validate token / fetch customers | `GET /customer` |
| Fetch projects | `GET /project/get-all?CustomerID=...` |
| Fetch tasks | `GET /task/search-for-time-tracking-by-project-id-order-by-recent-registration?projectID=...` |
| Create time entry | `POST /task/registration` |
| Fetch entries by date | `GET /time-tracking-item/get-by-date?startDate=...&endDate=...` |
| Get timesheet status | `GET /approval/timesheets/get-status-by-dates?dates=...` |
| Submit timesheet | `POST /approval/timesheets/submit-dates` |
| Fetch absence codes | `GET /absence-code/active` |
| Create absence entry | `POST /absence-code/registration-by-hours` |

---

## Security Notes

- Your PAT is **never stored** to disk or localStorage — it lives only in React component state.
- The proxy server only forwards your own requests and runs locally on your machine.
- `.gitignore` excludes `node_modules/` and any environment files.
