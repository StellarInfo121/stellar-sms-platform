const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Settings
export const getProvider = () => request('/settings/provider');
export const setProvider = (provider) =>
  request('/settings/provider', { method: 'POST', body: JSON.stringify({ provider }) });

// Team Members
export const getTeamMembers = () => request('/team-members');
export const createTeamMember = (data) =>
  request('/team-members', { method: 'POST', body: JSON.stringify(data) });
export const updateTeamMember = (id, data) =>
  request(`/team-members/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTeamMember = (id) =>
  request(`/team-members/${id}`, { method: 'DELETE' });

// Daily Count
export const getDailyCount = () => request('/daily-count');

// Contacts
export const getContacts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/contacts?${qs}`);
};
export const getContactGroups = () => request('/contacts/groups');
export const createContact = (data) =>
  request('/contacts', { method: 'POST', body: JSON.stringify(data) });
export const updateContact = (id, data) =>
  request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteContact = (id) =>
  request(`/contacts/${id}`, { method: 'DELETE' });
export const uploadContacts = (file, mapping) => {
  const fd = new FormData();
  fd.append('file', file);
  if (mapping) fd.append('mapping', JSON.stringify(mapping));
  return fetch(`${BASE}/contacts/upload`, { method: 'POST', body: fd }).then(r => r.json());
};
export const previewCSV = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return fetch(`${BASE}/contacts/preview-csv`, { method: 'POST', body: fd }).then(r => r.json());
};
export const getTags = () => request('/contacts/tags');
export const getImportHistory = () => request('/contacts/imports');
export const exportContacts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  window.open(`${BASE}/contacts/export?${qs}`);
};

// Conversations
export const getConversations = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/conversations?${qs}`);
};
export const getMessages = (convoId) => request(`/conversations/${convoId}/messages`);
export const assignConversation = (convoId, data) =>
  request(`/conversations/${convoId}/assign`, { method: 'POST', body: JSON.stringify(data) });
export const starConversation = (convoId) =>
  request(`/conversations/${convoId}/star`, { method: 'POST' });
export const setConversationStatus = (convoId, status) =>
  request(`/conversations/${convoId}/status`, { method: 'POST', body: JSON.stringify({ status }) });
export const sendSMS = (data) =>
  request('/sms/send', { method: 'POST', body: JSON.stringify(data) });
export const addNote = (convoId, data) =>
  request(`/conversations/${convoId}/notes`, { method: 'POST', body: JSON.stringify(data) });

// Templates
export const getTemplates = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/templates?${qs}`);
};
export const createTemplate = (data) =>
  request('/templates', { method: 'POST', body: JSON.stringify(data) });
export const updateTemplate = (id, data) =>
  request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTemplate = (id) =>
  request(`/templates/${id}`, { method: 'DELETE' });

// Campaigns
export const getCampaigns = () => request('/campaigns');
export const getCampaign = (id) => request(`/campaigns/${id}`);
export const createCampaign = (data) =>
  request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
export const sendCampaign = (id) =>
  request(`/campaigns/${id}/send`, { method: 'POST' });
export const getCampaignProgress = (id) => request(`/campaigns/${id}/progress`);
export const getCampaignMessages = (id, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/campaigns/${id}/messages?${qs}`);
};
export const exportCampaign = (id) => window.open(`${BASE}/campaigns/${id}/export`);

// Analytics
export const getAnalytics = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/analytics?${qs}`);
};
export const getAnalyticsTeam = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/analytics/team?${qs}`);
};
export const exportAnalytics = () => window.open(`${BASE}/analytics/export`);
