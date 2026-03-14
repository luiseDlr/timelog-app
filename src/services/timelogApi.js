import { Platform } from 'react-native';

const TIMELOG_HOST = 'app4.timelog.com';

// On web, route through local proxy to avoid CORS. On native, call directly.
const BASE_URL = (siteName) =>
  Platform.OS === 'web'
    ? `http://localhost:3001/timelog/${siteName}`
    : `https://${TIMELOG_HOST}/${siteName}/api/v1`;

function buildHeaders(pat) {
  return {
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function handleResponse(res) {
  if (res.status === 401) {
    throw new Error('AUTH_FAILED');
  }
  if (res.status === 403) {
    throw new Error('You don\'t have access to this resource.');
  }
  if (res.status === 404) {
    throw new Error('Item not found. It may have been deleted.');
  }
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.Message) msg = body.Message;
    } catch (_) {}
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function fetchCustomers(pat, siteName) {
  const res = await fetch(
    `${BASE_URL(siteName)}/customer`,
    { headers: buildHeaders(pat) }
  );
  if (res.status === 404) return [];
  const data = await handleResponse(res);
  const list = Array.isArray(data) ? data : (data?.Entities?.map((e) => e.Properties) ?? []);
  return list.map((c) => ({
    CustomerID: c.CustomerID,
    Name: c.Name,
    No: c.No,
  }));
}

export async function fetchProjects(pat, siteName, customerID) {
  const res = await fetch(
    `${BASE_URL(siteName)}/project/get-all?CustomerID=${customerID}`,
    { headers: buildHeaders(pat) }
  );
  if (res.status === 404) return [];
  const data = await handleResponse(res);
  const list = Array.isArray(data) ? data : (data?.Entities?.map((e) => e.Properties) ?? []);
  return list.map((p) => ({
    ProjectID: p.ProjectID,
    Name: p.Name,
    No: p.No,
    CustomerID: p.CustomerID,
  }));
}

export async function fetchTasks(pat, siteName, projectID) {
  const res = await fetch(
    `${BASE_URL(siteName)}/task/search-for-time-tracking-by-project-id-order-by-recent-registration?projectID=${projectID}`,
    { headers: buildHeaders(pat) }
  );
  if (res.status === 404) return [];
  const data = await handleResponse(res);
  const list = Array.isArray(data) ? data : (data?.Entities?.map((e) => e.Properties) ?? []);
  return list.map((t) => ({
    TaskID: t.TaskID,
    Name: t.Name,
    No: t.No,
    IsDefaultBillable: t.IsDefaultBillable,
    AdditionalTextIsRequired: t.AdditionalTextIsRequired,
    ProjectID: t.ProjectID,
  }));
}

export async function createTimeRegistration(pat, siteName, payload) {
  const res = await fetch(`${BASE_URL(siteName)}/task/registration`, {
    method: 'POST',
    headers: buildHeaders(pat),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function fetchTodayEntries(pat, siteName, date) {
  const params = new URLSearchParams({ startDate: date, endDate: date });
  const res = await fetch(
    `${BASE_URL(siteName)}/time-tracking-item/get-by-date?${params}`,
    { headers: buildHeaders(pat) }
  );
  return handleResponse(res);
}

export async function fetchTimesheetStatus(pat, siteName, dates) {
  const params = new URLSearchParams();
  dates.forEach((d) => params.append('dates', d));
  const res = await fetch(
    `${BASE_URL(siteName)}/approval/timesheets/get-status-by-dates?${params}`,
    { headers: buildHeaders(pat) }
  );
  return handleResponse(res);
}

export async function submitTimesheet(pat, siteName, dates, comment = '') {
  const res = await fetch(`${BASE_URL(siteName)}/approval/timesheets/submit-dates`, {
    method: 'POST',
    headers: buildHeaders(pat),
    body: JSON.stringify({ Dates: dates, Comment: comment, EmployeeUserID: 0 }),
  });
  return handleResponse(res);
}

export async function fetchAbsenceCodes(pat, siteName) {
  const res = await fetch(`${BASE_URL(siteName)}/absence-code/active`, {
    headers: buildHeaders(pat),
  });
  return handleResponse(res);
}

export async function createAbsenceRegistration(pat, siteName, payload) {
  const res = await fetch(`${BASE_URL(siteName)}/absence-code/registration-by-hours`, {
    method: 'POST',
    headers: buildHeaders(pat),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}
